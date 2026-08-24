/** Sisi terpanjang foto setelah diperkecil. */
export const SISI_MAKS = 512;

/**
 * Memperkecil foto sebelum disimpan dan diunggah.
 *
 * Foto langsung dari kamera HP bisa 3–5 MB. Mengunggahnya apa adanya boros
 * kuota pemilik warung, lambat di sinyal lemah, dan cepat menghabiskan
 * kuota Storage. 512px sudah lebih dari cukup untuk foto pengenal
 * berukuran kecil di daftar pelanggan.
 */
export async function perkecilGambar(berkas: File | Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(berkas);
  const skala = Math.min(1, SISI_MAKS / Math.max(bitmap.width, bitmap.height));
  const lebar = Math.round(bitmap.width * skala);
  const tinggi = Math.round(bitmap.height * skala);

  const kanvas = document.createElement('canvas');
  kanvas.width = lebar;
  kanvas.height = tinggi;

  const konteks = kanvas.getContext('2d');
  if (!konteks) throw new Error('Gagal memproses gambar di perangkat ini.');
  konteks.drawImage(bitmap, 0, 0, lebar, tinggi);
  bitmap.close();

  const hasil = await new Promise<Blob | null>((selesai) =>
    kanvas.toBlob(selesai, 'image/jpeg', 0.82),
  );
  if (!hasil) throw new Error('Gagal menyimpan gambar.');
  return hasil;
}
