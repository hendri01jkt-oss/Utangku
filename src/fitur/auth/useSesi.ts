import { create } from 'zustand';
import { api, bacaToken, GalatApi, PERISTIWA_SESI_HABIS, simpanToken } from '@/lib/api';
import { db, kosongkanDataLokal } from '@/data/db';
import { tulisSalinanServer } from '@/data/sync/salinanServer';
import type { Tables } from '@/data/database.types';

export type Warung = Tables<'warung'>;

/**
 * Empat keadaan sesi yang menentukan ke mana pengguna diarahkan:
 *
 *   memuat           – sesi sedang dipulihkan dari penyimpanan lokal
 *   tamu             – belum masuk
 *   perlu_onboarding – sudah masuk tapi belum punya warung
 *   siap             – sudah masuk dan warung tersedia
 */
export type StatusSesi = 'memuat' | 'tamu' | 'perlu_onboarding' | 'siap';

/** Pengguna yang sedang masuk. Bentuk `user.id` dipertahankan agar pemakai lama tetap jalan. */
export interface Sesi {
  user: { id: string; email: string };
}

interface StoreSesi {
  status: StatusSesi;
  sesi: Sesi | null;
  warung: Warung | null;
  /** Dipanggil sekali saat aplikasi dijalankan. */
  inisialisasi: () => () => void;
  /** Dipanggil setelah masuk/daftar berhasil: token sudah disimpan, muat sesinya. */
  mulaiSesi: (token: string, user: { id: string; email: string }) => Promise<void>;
  /** Dipakai onboarding setelah warung berhasil dibuat. */
  setWarung: (warung: Warung) => void;
  keluar: (opsi?: { paksa?: boolean }) => Promise<void>;
}

/** Mengambil warung milik pengguna dari server; server sudah menyaring per keanggotaan. */
async function ambilWarungDariServer(): Promise<Warung | null> {
  const { warung } = await api<{ warung: Warung | null }>('/warung');
  return warung;
}

/** Membaca `sub` dari token tanpa memeriksa tanda tangan; hanya untuk mode tanpa sinyal. */
function bacaIdDariToken(token: string): string | null {
  try {
    const isi = token.split('.')[1];
    if (!isi) return null;
    const json = atob(isi.replace(/-/g, '+').replace(/_/g, '/'));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
}

export const useSesi = create<StoreSesi>((set) => ({
  status: 'memuat',
  sesi: null,
  warung: null,

  inisialisasi: () => {
    const terapkan = async (sesi: Sesi | null) => {
      if (!sesi) {
        set({ status: 'tamu', sesi: null, warung: null });
        return;
      }

      // Tampilkan dari salinan lokal DULU, tanpa menunggu jaringan sedetik
      // pun. Aplikasi yang menjanjikan jalan tanpa sinyal tidak boleh
      // menahan tampilannya di belakang panggilan jaringan.
      const tersimpan = await db.warung.toCollection().first();
      if (tersimpan) set({ sesi, warung: tersimpan, status: 'siap' });

      try {
        const segar = await ambilWarungDariServer();
        if (segar) {
          /*
           * Salinan server TIDAK ditulis begitu saja: selama masih ada
           * kiriman tertunda, versi lokal yang menang (aturan yang sama
           * dengan mesin sync). Kalau tidak, nama warung yang baru diubah
           * tampak batal sendiri.
           */
          const ditulis = await tulisSalinanServer('warung', [segar]);
          const tampil = ditulis === 0 ? ((await db.warung.get(segar.id)) ?? segar) : segar;
          set({ sesi, warung: tampil, status: 'siap' });
          return;
        }
        // Server bilang tidak ada warung. Itu hanya dipercaya kalau memang
        // belum ada salinan lokal.
        if (!tersimpan) set({ sesi, warung: null, status: 'perlu_onboarding' });
      } catch {
        // Jaringan mati bukan alasan melempar pengguna keluar.
        if (!tersimpan) set({ sesi, warung: null, status: 'perlu_onboarding' });
      }
    };

    let batal = false;

    void (async () => {
      const token = bacaToken();
      if (!token) {
        if (!batal) void terapkan(null);
        return;
      }
      try {
        // Sekaligus memperpanjang masa berlaku token (sesi bergulir).
        const { token: baru, user } = await api<{
          token: string;
          user: { id: string; email: string };
        }>('/auth/saya');
        simpanToken(baru);
        if (!batal) void terapkan({ user });
      } catch (galat) {
        if (batal) return;
        if (galat instanceof GalatApi && galat.status === 401) {
          // Token ditolak: sesi benar-benar berakhir.
          simpanToken(null);
          void terapkan(null);
          return;
        }
        // Tanpa sinyal: token tersimpan dianggap masih sah; pakai data lokal.
        const lokal = await db.warung.toCollection().first();
        const id = bacaIdDariToken(token);
        if (lokal && id) {
          set({ sesi: { user: { id, email: '' } }, warung: lokal, status: 'siap' });
        } else {
          set({ status: 'tamu', sesi: null, warung: null });
        }
      }
    })();

    // Server menolak token di tengah jalan (mis. sinkronisasi): kembali ke
    // halaman masuk TANPA mengosongkan data lokal — kiriman tertunda aman.
    const saatSesiHabis = () => {
      simpanToken(null);
      set({ status: 'tamu', sesi: null });
    };
    window.addEventListener(PERISTIWA_SESI_HABIS, saatSesiHabis);

    return () => {
      batal = true;
      window.removeEventListener(PERISTIWA_SESI_HABIS, saatSesiHabis);
    };
  },

  mulaiSesi: async (token, user) => {
    simpanToken(token);
    const tersimpan = await db.warung.toCollection().first();
    set({ sesi: { user }, warung: tersimpan ?? null, status: tersimpan ? 'siap' : 'memuat' });
    try {
      const segar = await ambilWarungDariServer();
      if (segar) {
        await tulisSalinanServer('warung', [segar]);
        set({ sesi: { user }, warung: segar, status: 'siap' });
      } else {
        set({ sesi: { user }, warung: null, status: 'perlu_onboarding' });
      }
    } catch {
      set({
        sesi: { user },
        warung: tersimpan ?? null,
        status: tersimpan ? 'siap' : 'perlu_onboarding',
      });
    }
  },

  setWarung: (warung) => set({ warung, status: 'siap' }),

  keluar: async (opsi) => {
    /*
     * Penjaga terakhir, bukan pengganti dialog konfirmasi di UI.
     *
     * Pengosongan data lokal di bawah ikut membuang antrean outbox, jadi
     * keluar saat masih ada kiriman tertunda berarti membuang catatan yang
     * tidak punya salinan di mana pun. Dialog di useKeluar sudah menanyakan
     * hal ini lebih dulu; penjaga di sini memastikan pemanggil baru yang
     * lupa bertanya tidak bisa menghapusnya tanpa sengaja.
     */
    const tertunda = await db.outbox.count();
    if (tertunda > 0 && !opsi?.paksa) {
      throw new Error(
        `Masih ada ${tertunda} catatan yang belum terkirim. Sinkronkan dulu sebelum keluar.`,
      );
    }

    simpanToken(null);
    // Data warung sebelumnya harus hilang dari perangkat: satu HP bisa
    // dipakai bergantian, dan catatan utang orang lain tidak boleh tertinggal
    // di IndexedDB.
    await kosongkanDataLokal();
    set({ status: 'tamu', sesi: null, warung: null });
  },
}));
