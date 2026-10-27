import { siapkanStruk } from './dataStruk';
import { gambarStruk, namaBerkasStruk } from './gambarStruk';

/**
 * Mengunduh catatan utang sebagai gambar PNG ke perangkat.
 *
 * Isinya disusun dari data lokal, jadi tetap jalan tanpa sinyal.
 */
export async function unduhCatatan(transaksiId: string): Promise<void> {
  const siap = await siapkanStruk(transaksiId);
  if (!siap) throw new Error('Data utang tidak ditemukan di perangkat ini.');

  const blob = await gambarStruk(siap.data);
  const alamat = URL.createObjectURL(blob);
  const tautan = document.createElement('a');
  tautan.href = alamat;
  tautan.download = namaBerkasStruk(siap.data);
  document.body.appendChild(tautan);
  tautan.click();
  tautan.remove();
  // Dilepas sesudah unduhan sempat dimulai; langsung dilepas bisa membatalkannya.
  setTimeout(() => URL.revokeObjectURL(alamat), 10_000);
}
