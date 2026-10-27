import { Navigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';

/**
 * Halaman Detail Utang sudah tidak ada: semuanya (isi, bayar, download) kini
 * ada di kartu riwayat pada halaman pelanggan. Alamat lama dialihkan ke sana
 * supaya tautan yang sudah tersimpan tidak mati.
 */
export function AlihkanUtang() {
  const { id = '' } = useParams<{ id: string }>();
  const utang = useLiveQuery(async () => (await db.transaksi_utang.get(id)) ?? null, [id]);
  if (utang === undefined) return null;
  return <Navigate to={utang?.pelanggan_id ? `/pelanggan/${utang.pelanggan_id}` : '/pelanggan'} replace />;
}
