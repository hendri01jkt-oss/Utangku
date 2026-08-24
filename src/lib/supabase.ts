import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/data/database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const kunci = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !kunci) {
  throw new Error(
    'VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY belum diisi. ' +
      'Salin .env.example menjadi .env lalu isi nilainya.',
  );
}

let janji: Promise<SupabaseClient<Database>> | null = null;

/**
 * Klien Supabase dimuat saat pertama kali dibutuhkan, bukan saat aplikasi
 * dibuka.
 *
 * Pustakanya sekitar 52 kB terkompresi — seperempat dari seluruh unduhan
 * awal — padahal UtangKu menggambar layar pertamanya dari Dexie dan sama
 * sekali tidak menyentuh jaringan untuk itu. Menundanya membuat aplikasi
 * tampil lebih cepat di HP kelas bawah, dan tetap tampil di sinyal buruk.
 *
 * Modulnya di-cache service worker, jadi pemanggilan berikutnya instan.
 */
export function ambilSupabase(): Promise<SupabaseClient<Database>> {
  janji ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient<Database>(url, kunci, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Menangkap ?code=... dari tautan reset password dan konfirmasi email.
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    }),
  );
  return janji;
}
