import { db } from '@/data/db';
import { supabase } from '@/lib/supabase';
import { perkecilGambar } from '@/lib/gambar';
import { jadwalkanSync } from '@/data/sync/mesin';

const BUCKET = 'foto-pelanggan';

/** Path di Storage: segmen pertama adalah warung_id, itu dasar policy-nya. */
export const jalurFoto = (warungId: string, pelangganId: string) =>
  `${warungId}/${pelangganId}.jpg`;

/**
 * Menyimpan foto ke perangkat lebih dulu, unggah menyusul.
 *
 * Foto yang diambil tanpa sinyal tetap tersimpan dan tetap tampil; mesin
 * sync yang mengangkatnya ke Storage begitu jaringan tersedia.
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
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(jalurFoto(foto.warung_id, foto.pelanggan_id), foto.blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    if (error) throw error;

    await db.foto.update(foto.pelanggan_id, { terunggah: 1 });
    terunggah += 1;
  }

  return terunggah;
}

/**
 * Mengambil foto yang sudah ada di Storage tapi belum ada di perangkat ini —
 * misalnya setelah pemilik warung berganti HP. Bucket-nya privat, jadi
 * berkasnya diunduh lewat URL bertanda tangan lalu disimpan sebagai blob
 * supaya ke depannya tetap tampil walau offline.
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

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(p.foto_path as string, 60);
    if (error || !data) continue;

    const respons = await fetch(data.signedUrl);
    if (!respons.ok) continue;

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
