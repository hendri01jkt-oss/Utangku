import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { db, kosongkanDataLokal } from '@/data/db';
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

interface StoreSesi {
  status: StatusSesi;
  sesi: Session | null;
  warung: Warung | null;
  /** Dipanggil sekali saat aplikasi dijalankan. */
  inisialisasi: () => () => void;
  /** Dipakai onboarding setelah warung berhasil dibuat. */
  setWarung: (warung: Warung) => void;
  keluar: () => Promise<void>;
}

/**
 * Mengambil warung milik pengguna dari server. RLS sudah menyaring per
 * keanggotaan, jadi kueri ini tidak perlu (dan tidak boleh) menyaring
 * sendiri di client.
 */
async function ambilWarungDariServer(): Promise<Warung | null> {
  const { data, error } = await supabase
    .from('warung')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export const useSesi = create<StoreSesi>((set) => ({
  status: 'memuat',
  sesi: null,
  warung: null,

  inisialisasi: () => {
    const terapkan = async (sesi: Session | null) => {
      if (!sesi) {
        set({ status: 'tamu', sesi: null, warung: null });
        return;
      }

      // Tampilkan dari salinan lokal DULU, tanpa menunggu jaringan sedetik
      // pun. Saat offline, kueri PostgREST butuh sekitar tujuh detik untuk
      // menyerah — dan selama itu pemilik warung hanya melihat layar
      // "Memuat…". Aplikasi yang menjanjikan jalan tanpa sinyal tidak boleh
      // menahan tampilannya di belakang panggilan jaringan.
      const tersimpan = await db.warung.toCollection().first();
      if (tersimpan) set({ sesi, warung: tersimpan, status: 'siap' });

      try {
        const segar = await ambilWarungDariServer();
        if (segar) {
          await db.warung.put(segar);
          set({ sesi, warung: segar, status: 'siap' });
          return;
        }
        // Server bilang tidak ada warung. Itu hanya dipercaya kalau memang
        // belum ada salinan lokal; kalau ada, salinan lokal dipertahankan
        // supaya gangguan sesaat tidak melempar pemilik ke onboarding.
        if (!tersimpan) set({ sesi, warung: null, status: 'perlu_onboarding' });
      } catch {
        // Jaringan mati bukan alasan melempar pengguna keluar — sesinya
        // tetap sah. Kalau belum pernah ada salinan lokal (login pertama
        // tanpa sinyal), onboarding yang akan mencoba lagi.
        if (!tersimpan) set({ sesi, warung: null, status: 'perlu_onboarding' });
      }
    };

    void supabase.auth.getSession().then(({ data }) => terapkan(data.session));

    const { data: langganan } = supabase.auth.onAuthStateChange((peristiwa, sesi) => {
      // Penyegaran token tidak mengubah apa pun yang perlu dimuat ulang.
      if (peristiwa === 'TOKEN_REFRESHED') {
        set({ sesi });
        return;
      }
      void terapkan(sesi);
    });

    return () => langganan.subscription.unsubscribe();
  },

  setWarung: (warung) => set({ warung, status: 'siap' }),

  keluar: async () => {
    await supabase.auth.signOut();
    // Data warung sebelumnya harus hilang dari perangkat: satu HP bisa
    // dipakai bergantian, dan catatan utang orang lain tidak boleh tertinggal
    // di IndexedDB.
    await kosongkanDataLokal();
    set({ status: 'tamu', sesi: null, warung: null });
  },
}));
