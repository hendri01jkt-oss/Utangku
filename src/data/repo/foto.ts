import { db } from '@/data/db';
import { kirim } from '@/lib/api';
import { perkecilGambar } from '@/lib/gambar';
import { jadwalkanSync } from '@/data/sync/mesin';

/** Path foto di R2: segmen pertama adalah warung_id. Server yang menentukannya; ini hanya catatan di baris pelanggan. */
export const jalurFoto = (warungId: string, pelangganId: string) =>
  `${warungId}/${pelangganId}.jpg`;

/**
 * Menyimpan foto ke perangkat lebih dulu, unggah menyusul.
 *
 * Foto yang diambil tanpa sinyal tetap tersimpan dan tetap tampil; mesin
 * sync yang mengangkatnya ke R2 begitu jaringan tersedia.
 */
export async function simpanFotoLokal(
  warungId: string,
  pelangganId: string,
  berkas: File | Blob,
) {
  const kecil = await perkecilGambar(berkas);
  await db.foto.put({
    pelanggan_id: pelangganId,
    warung_id: warungId,
    blob: kecil,
    terunggah: 0,
  });
  jadwalkanSync('foto-baru');
  return kecil;
}

export const hapusFotoLokal = (pelangganId: string) => db.foto.delete(pelangganId);

export const ambilFotoLokal = (pelangganId: string) => db.foto.get(pelangganId);

/** Mengunggah semua foto yang masih menunggu. Dipanggil mesin sync. */
export async function unggahFotoTertunda(): Promise<number> {
  const menunggu = await db.foto.filter((f) => f.terunggah === 0).toArray();
  let terunggah = 0;

  for (const foto of menunggu) {
    await kirim(`/foto/${foto.pelanggan_id}`, {
      method: 'PUT',
      badan: foto.blob,
      tipe: 'image/jpeg',
    });
    await db.foto.update(foto.pelanggan_id, { terunggah: 1 });
    terunggah += 1;
  }

  return terunggah;
}

/**
 * Mengambil foto yang sudah ada di R2 tapi belum ada di perangkat ini —
 * misalnya setelah pemilik warung berganti HP. Fotonya
 * privat, jadi diunduh lewat API dengan token masuk lalu disimpan sebagai
 * blob supaya ke depannya tetap tampil walau offline.
 */
export async function unduhFotoHilang(warungId: string): Promise<number> {
  const pelanggan = await db.pelanggan
    .where('warung_id')
    .equals(warungId)
    .filter((p) => p.foto_path !== null && p.deleted_at === null)
    .toArray();

  let terunduh = 0;
  for (const p of pelanggan) {
    if (await db.foto.get(p.id)) continue;

    let respons: Response;
    try {
      respons = await kirim(`/foto/${p.id}`);
    } catch {
      continue;
    }

    await db.foto.put({
      pelanggan_id: p.id,
      warung_id: warungId,
      blob: await respons.blob(),
      terunggah: 1,
    });
    terunduh += 1;
  }
  return terunduh;
}
