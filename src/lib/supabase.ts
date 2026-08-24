import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/data/database.types';

const url = import.meta.env.VITE_SUPABASE_URL;
const kunci = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !kunci) {
  throw new Error(
    'VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY belum diisi. ' +
      'Salin .env.example menjadi .env lalu isi nilainya.',
  );
}

export const supabase = createClient<Database>(url, kunci, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Menangkap ?code=... dari tautan reset password dan konfirmasi email.
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
