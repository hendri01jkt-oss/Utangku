import { db, type EntriOutbox, type NamaEntitas } from '@/data/db';
import { api, GalatApi } from '@/lib/api';
import { unduhFotoHilang, unggahFotoTertunda } from '@/data/repo/foto';
import { tulisSalinanServer } from './salinanServer';
import { useSync } from './useSync';

/*
 * Urutan menentukan urutan TARIK. transaksi_item diletakkan sesudah
 * transaksi_utang supaya induknya sudah ada di perangkat sebelum barisnya
 * masuk — tampilan yang menggabungkan keduanya jadi tidak pernah sempat
 * menampilkan item tanpa transaksi.
 */
const ENTITAS: readonly NamaEntitas[] = [
  'warung',
  'pelanggan',
  'transaksi_utang',
  'transaksi_item',
  'pembayaran',
];

/** Batas baris per permintaan saat menarik data. */
const BATAS_TARIK = 500;
const JEDA_MUTASI_MS = 2_000;
const JEDA_BERKALA_MS = 60_000;
const BACKOFF_AWAL_MS = 2_000;
const BACKOFF_MAKS_MS = 60_000;
const AWAL_WAKTU = '1970-01-01T00:00:00.000Z';

let warungAktif: string | null = null;
let sedangJalan = false;
/** Permintaan sync yang datang saat sync lain berjalan, dijalankan sesudahnya. */
let adaPermintaanSusulan = false;
let percobaanJaringan = 0;
let timerMutasi: ReturnType<typeof setTimeout> | null = null;
let timerBackoff: ReturnType<typeof setTimeout> | null = null;
let timerBerkala: ReturnType<typeof setInterval> | null = null;

const kunciKursor = (entitas: NamaEntitas) => `kursor:${entitas}`;

async function bacaKursor(entitas: NamaEntitas): Promise<string> {
  const baris = await db.meta.get(kunciKursor(entitas));
  return baris?.nilai ?? AWAL_WAKTU;
}

const tulisKursor = (entitas: NamaEntitas, nilai: string) =>
  db.meta.put({ kunci: kunciKursor(entitas), nilai });

/**
 * Membedakan gagal jaringan dari gagal validasi.
 *
 * Gagal jaringan layak dicoba lagi; gagal validasi (RLS, hak kolom, batasan
 * kolom) tidak akan berubah hasilnya berapa kali pun diulang, jadi entrinya
 * ditandai dan dilewati supaya antrean tidak macet selamanya.
 */
function gagalKarenaJaringan(status: number | undefined, pesan: string): boolean {
  if (!navigator.onLine) return true;
  if (status === undefined || status === 0) return true;
  // 401: token kedaluwarsa. Bukan salah muatan; entri jangan ditandai gagal
  // permanen, cukup menunggu pengguna masuk lagi.
  if (status === 401) return true;
  // 5xx: server sedang bermasalah, bukan muatan kita yang salah.
  if (status >= 500) return true;
  return /failed to fetch|networkerror|load failed|timeout/i.test(pesan);
}

interface HasilDorong {
  terkirim: number;
  terhentiJaringan: boolean;
}

interface HasilKirim {
  error: { message: string } | null;
  status?: number;
}

/**
 * Mengirim satu entri ke server.
 *
 * Satu panggilan PUT untuk INSERT maupun UPDATE: server sendiri yang
 * menentukan baris itu baru atau sudah ada, mengabaikan kolom yang tidak
 * boleh berubah (identitas, warung, pembuat), dan menolak baris milik
 * warung lain. Klien tidak perlu lagi menebak.
 */
async function kirimEntri(entri: EntriOutbox): Promise<HasilKirim> {
  try {
    await api(`/sinkron/${entri.entitas}`, { method: 'PUT', json: { muatan: entri.muatan } });
    return { error: null };
  } catch (galat) {
    if (galat instanceof GalatApi) return { error: { message: galat.message }, status: galat.status };
    throw galat;
  }
}

/** Menyalurkan outbox berurutan. */
async function dorong(): Promise<HasilDorong> {
  let terkirim = 0;

  for (;;) {
    // Hanya entri tanpa galat yang disalurkan; yang bergalat menunggu
    // datanya diperbaiki pengguna (mengubah baris akan menghapus galatnya).
    const entri = await db.outbox.orderBy('urutan').filter((e) => e.galat === null).first();
    if (!entri || entri.urutan === undefined) break;

    const { error, status } = await kirimEntri(entri);

    if (!error) {
      await db.outbox.delete(entri.urutan);
      terkirim += 1;
      continue;
    }

    if (gagalKarenaJaringan(status, error.message)) {
      await db.outbox.update(entri.urutan, { percobaan: entri.percobaan + 1 });
      return { terkirim, terhentiJaringan: true };
    }

    await db.outbox.update(entri.urutan, {
      percobaan: entri.percobaan + 1,
      galat: error.message,
    });
  }

  return { terkirim, terhentiJaringan: false };
}

/** Satu halaman perubahan untuk satu tabel; server menyaring per warung. */
async function ambilHalaman(entitas: NamaEntitas, kursor: string) {
  const { data } = await api<{ data: { id: string; updated_at: string }[] }>(
    `/sinkron/${entitas}?sejak=${encodeURIComponent(kursor)}&batas=${BATAS_TARIK}`,
  );
  return data;
}

/**
 * Menarik perubahan server sejak penanda terakhir, per tabel.
 *
 * Memakai gte (bukan gt) supaya baris yang stempel waktunya persis sama
 * dengan penanda tidak terlewat. Konsekuensinya baris batas ikut terambil
 * lagi, dan itu tidak apa-apa karena penulisannya idempoten.
 */
async function tarik(): Promise<number> {
  let masuk = 0;

  for (const entitas of ENTITAS) {
    let kursor = await bacaKursor(entitas);

    for (;;) {
      const data = await ambilHalaman(entitas, kursor);
      if (data.length === 0) break;

      // Baris yang masih menunggu dikirim tidak ditimpa data server; aturan
      // itu dipegang satu tempat supaya tidak ada penulis yang lupa.
      masuk += await tulisSalinanServer(entitas, data);

      const kursorBaru = data[data.length - 1]?.updated_at ?? kursor;
      const habis = data.length < BATAS_TARIK;
      // Kalau satu halaman penuh berisi stempel waktu yang sama persis,
      // menaikkan kursor tidak mungkin — berhenti daripada berputar selamanya.
      if (habis || kursorBaru === kursor) {
        kursor = kursorBaru;
        break;
      }
      kursor = kursorBaru;
    }

    await tulisKursor(entitas, kursor);
  }

  return masuk;
}

/**
 * Sistem operasi bisa mengaku online padahal server tidak terjangkau —
 * wifi hotel dengan halaman login, sinyal seolah penuh tapi data mati.
 * Setelah dua kegagalan beruntun, berhenti menampilkan "Menyinkronkan" yang
 * berputar tanpa ujung dan katakan apa adanya bahwa server tidak tersambung.
 */
function statusSaatGagalJaringan() {
  if (!navigator.onLine) return 'offline' as const;
  return percobaanJaringan >= 2 ? ('offline' as const) : ('menyinkronkan' as const);
}

function jadwalkanBackoff() {
  if (timerBackoff) clearTimeout(timerBackoff);
  const jeda = Math.min(BACKOFF_AWAL_MS * 2 ** percobaanJaringan, BACKOFF_MAKS_MS);
  percobaanJaringan += 1;
  timerBackoff = setTimeout(() => void sinkronSekarang('backoff'), jeda);
}

export async function sinkronSekarang(_alasan: string): Promise<void> {
  if (!warungAktif) return;

  if (sedangJalan) {
    adaPermintaanSusulan = true;
    return;
  }

  const { setStatus, tandaiSelesai } = useSync.getState();

  if (!navigator.onLine) {
    setStatus('offline');
    return;
  }

  sedangJalan = true;
  setStatus('menyinkronkan');

  try {
    // Foto diunggah sebelum barisnya dikirim: baris pelanggan sudah membawa
    // foto_path, jadi kalau urutannya terbalik, perangkat lain sempat
    // melihat path yang berkasnya belum ada.
    await unggahFotoTertunda();

    // Dorong dulu baru tarik: memperkecil jendela waktu saat data server
    // bisa menimpa perubahan lokal yang belum terkirim.
    const hasil = await dorong();

    if (hasil.terhentiJaringan) {
      setStatus(statusSaatGagalJaringan());
      jadwalkanBackoff();
      return;
    }

    await tarik();

    // Foto yang ada di Storage tapi belum ada di perangkat ini (mis. setelah
    // ganti HP). Gagal di sini tidak boleh menggagalkan sinkronisasi data —
    // catatan utang jauh lebih penting daripada foto.
    try {
      await unduhFotoHilang(warungAktif);
    } catch {
      /* diabaikan dengan sengaja */
    }

    percobaanJaringan = 0;
    if (timerBackoff) {
      clearTimeout(timerBackoff);
      timerBackoff = null;
    }
    tandaiSelesai();
  } catch (galat) {
    const pesan = galat instanceof Error ? galat.message : String(galat);
    const status = galat instanceof GalatApi ? galat.status : undefined;
    if (gagalKarenaJaringan(status, pesan)) {
      setStatus(statusSaatGagalJaringan(), pesan);
      jadwalkanBackoff();
    } else {
      setStatus('tersinkron', pesan);
    }
  } finally {
    sedangJalan = false;
    if (adaPermintaanSusulan) {
      adaPermintaanSusulan = false;
      void sinkronSekarang('susulan');
    }
  }
}

/** Dipanggil setiap mutasi. Ditunda sebentar agar beberapa mutasi beruntun jadi satu sync. */
export function jadwalkanSync(alasan: string) {
  if (timerMutasi) clearTimeout(timerMutasi);
  timerMutasi = setTimeout(() => void sinkronSekarang(alasan), JEDA_MUTASI_MS);
}

/**
 * Menyalakan mesin sync untuk satu warung. Mengembalikan fungsi pemberhenti.
 *
 * Pemicunya: aplikasi dibuka, jaringan kembali tersambung, setiap mutasi
 * (tertunda 2 detik), berkala 60 detik selama tab terlihat, dan tombol
 * manual di header.
 */
export function mulaiMesinSync(warungId: string): () => void {
  warungAktif = warungId;
  percobaanJaringan = 0;

  const saatOnline = () => {
    percobaanJaringan = 0;
    void sinkronSekarang('online');
  };
  const saatOffline = () => useSync.getState().setStatus('offline');
  const saatTerlihat = () => {
    if (document.visibilityState === 'visible') void sinkronSekarang('kembali-terlihat');
  };

  window.addEventListener('online', saatOnline);
  window.addEventListener('offline', saatOffline);
  document.addEventListener('visibilitychange', saatTerlihat);

  timerBerkala = setInterval(() => {
    if (document.visibilityState === 'visible') void sinkronSekarang('berkala');
  }, JEDA_BERKALA_MS);

  void sinkronSekarang('aplikasi-dibuka');

  return () => {
    window.removeEventListener('online', saatOnline);
    window.removeEventListener('offline', saatOffline);
    document.removeEventListener('visibilitychange', saatTerlihat);
    if (timerBerkala) clearInterval(timerBerkala);
    if (timerMutasi) clearTimeout(timerMutasi);
    if (timerBackoff) clearTimeout(timerBackoff);
    timerBerkala = timerMutasi = timerBackoff = null;
    warungAktif = null;
  };
}
