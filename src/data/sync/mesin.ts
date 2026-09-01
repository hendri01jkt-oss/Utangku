import { db, type EntriOutbox, type NamaEntitas } from '@/data/db';
import { ambilSupabase } from '@/lib/supabase';
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
  // 5xx: server sedang bermasalah, bukan muatan kita yang salah.
  if (status >= 500) return true;
  return /failed to fetch|networkerror|load failed|timeout/i.test(pesan);
}

interface HasilDorong {
  terkirim: number;
  terhentiJaringan: boolean;
}

/**
 * Kolom yang tidak pernah berubah setelah sebuah baris lahir.
 *
 * Identitas baris, warung pemiliknya, waktu pembuatan, dan siapa yang
 * membuatnya bukan sesuatu yang boleh berpindah lewat sinkronisasi. Database
 * menegakkan hal yang sama: hak UPDATE pada kolom-kolom ini memang tidak
 * diberikan ke peran authenticated.
 */
const KOLOM_TETAP = new Set(['id', 'warung_id', 'created_at', 'dibuat_oleh']);

/**
 * Entitas yang TIDAK PERNAH dibuat lewat sinkronisasi, hanya diperbarui.
 *
 * Baris warung lahir dari RPC `buat_warung()` saat onboarding, dan policy
 * INSERT-nya mensyaratkan `pemilik_id = auth.uid()`. Sementara `pemilik_id`
 * justru sengaja tidak pernah ikut dikirim — kepemilikan warung tidak boleh
 * berpindah lewat sinkronisasi biasa. Kedua aturan itu benar sendiri-
 * sendiri, tapi berarti klien secara struktural tidak akan pernah bisa
 * meng-INSERT warung: yang didapat selalu "new row violates row-level
 * security policy for table warung".
 *
 * Dan itu tidak bisa dipulihkan dengan mencoba INSERT dulu lalu jatuh ke
 * UPDATE, karena Postgres memeriksa WITH CHECK SEBELUM pelanggaran kunci
 * unik muncul — 23505 yang jadi pemicu jalur cadangan tidak pernah sempat
 * terjadi.
 */
const ENTITAS_TANPA_SISIP = new Set<NamaEntitas>(['warung']);

interface HasilKirim {
  error: { message: string; code?: string } | null;
  status?: number;
}

/** Memperbarui baris yang sudah ada, tanpa menyentuh kolom identitas. */
async function ubahDiServer(entri: EntriOutbox): Promise<HasilKirim> {
  const supabase = await ambilSupabase();
  const perubahan = Object.fromEntries(
    Object.entries(entri.muatan).filter(([kunci]) => !KOLOM_TETAP.has(kunci)),
  );

  const { error, status, data } = await supabase
    .from(entri.entitas)
    .update(perubahan as never)
    .eq('id', entri.id)
    .select('id');

  if (error) return { error, status };

  // UPDATE yang tidak mengenai baris apa pun TIDAK dianggap berhasil. Kalau
  // dibiarkan, entrinya dihapus dari antrean dan perubahan pengguna lenyap
  // tanpa jejak — persis kegagalan yang paling sulit disadari.
  if (!data || data.length === 0) {
    return {
      error: { message: 'Baris tidak ditemukan di server saat hendak diperbarui.' },
      status: 404,
    };
  }

  return { error: null, status };
}

/**
 * Mengirim satu entri: INSERT untuk baris baru, UPDATE untuk yang sudah ada.
 *
 * Dulu ini satu panggilan `upsert`, dan itu ternyata TIDAK PERNAH berhasil
 * untuk transaksi_utang. PostgREST menerjemahkan upsert menjadi
 * `INSERT ... ON CONFLICT DO UPDATE SET <semua kolom muatan>`, dan Postgres
 * memeriksa hak UPDATE untuk setiap kolom di klausa itu — tanpa peduli
 * apakah konfliknya benar-benar terjadi. Karena `id`, `warung_id`, dan
 * `dibuat_oleh` sengaja dibuat tak-bisa-diubah, seluruh pernyataan ditolak
 * dengan "permission denied for table transaksi_utang", bahkan untuk baris
 * yang baru pertama kali dikirim.
 *
 * Memberi hak UPDATE pada kolom-kolom itu memang akan membuat upsert lolos,
 * tapi harganya terlalu mahal: sebuah utang jadi bisa dipindahkan ke warung
 * lain atau berganti identitas lewat sinkronisasi. Jadi yang menyesuaikan
 * adalah klien, bukan jaminan di database.
 */
async function kirimEntri(entri: EntriOutbox): Promise<HasilKirim> {
  if (ENTITAS_TANPA_SISIP.has(entri.entitas)) return ubahDiServer(entri);

  const supabase = await ambilSupabase();
  const sisip = await supabase.from(entri.entitas).insert(entri.muatan as never);
  // 23505 = unique_violation, artinya barisnya sudah ada di server dan yang
  // dimaksud entri ini adalah perubahan, bukan pembuatan.
  if (!sisip.error || sisip.error.code !== '23505') return sisip;

  return ubahDiServer(entri);
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

/**
 * Satu halaman perubahan untuk satu tabel.
 *
 * Tabel warung menyimpan identitasnya di kolom `id`, sedangkan tabel data
 * lain memakai `warung_id` — jadi penyaringnya dipisah, bukan dipaksakan
 * jadi satu ekspresi.
 */
async function ambilHalaman(entitas: NamaEntitas, warungId: string, kursor: string) {
  const supabase = await ambilSupabase();
  if (entitas === 'warung') {
    return supabase
      .from('warung')
      .select('*')
      .eq('id', warungId)
      .gte('updated_at', kursor)
      .order('updated_at', { ascending: true })
      .limit(BATAS_TARIK);
  }

  return supabase
    .from(entitas)
    .select('*')
    .eq('warung_id', warungId)
    .gte('updated_at', kursor)
    .order('updated_at', { ascending: true })
    .limit(BATAS_TARIK);
}

/**
 * Menarik perubahan server sejak penanda terakhir, per tabel.
 *
 * Memakai gte (bukan gt) supaya baris yang stempel waktunya persis sama
 * dengan penanda tidak terlewat. Konsekuensinya baris batas ikut terambil
 * lagi, dan itu tidak apa-apa karena penulisannya idempoten.
 */
async function tarik(warungId: string): Promise<number> {
  let masuk = 0;

  for (const entitas of ENTITAS) {
    let kursor = await bacaKursor(entitas);

    for (;;) {
      const { data, error } = await ambilHalaman(entitas, warungId, kursor);

      if (error) throw error;
      if (!data || data.length === 0) break;

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

    await tarik(warungAktif);

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
    if (gagalKarenaJaringan(undefined, pesan)) {
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
