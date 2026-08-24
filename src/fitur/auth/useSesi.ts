import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
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
 * Mengambil warung milik pengguna. RLS sudah menyaring per keanggotaan,
 * jadi kueri ini tidak perlu (dan tidak boleh) menyaring sendiri di client.
 */
async function ambilWarung(): Promise<Warung | null> {
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
      try {
        const warung = await ambilWarung();
        set({
          sesi,
          warung,
          status: warung ? 'siap' : 'perlu_onboarding',
        });
      } catch {
        // Gagal memuat warung (mis. jaringan mati) bukan alasan melempar
        // pengguna keluar — sesinya tetap sah. Onboarding akan mencoba lagi.
        set({ sesi, warung: null, status: 'perlu_onboarding' });
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
    set({ status: 'tamu', sesi: null, warung: null });
  },
}));
