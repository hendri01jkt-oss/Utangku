import { db, type BarisWarung } from '@/data/db';
import { sekarang, simpanDanAntre } from './dasar';

/**
 * Mengubah pengaturan warung.
 *
 * Ditulis lewat outbox seperti data lain, jadi mengubah template pesan atau
 * nama warung tetap bisa dilakukan tanpa sinyal dan menyusul terkirim.
 */
export async function ubahWarung(
  id: string,
  perubahan: Partial<
    Pick<
      BarisWarung,
      | 'nama_warung'
      | 'no_wa_warung'
      | 'alamat'
      | 'tempo_default_hari'
      | 'template_pesan_tagihan'
      | 'logo_path'
      | 'lebar_struk'
    >
  >,
) {
  const lama = await db.warung.get(id);
  if (!lama) throw new Error('Warung tidak ditemukan di perangkat ini.');
  return simpanDanAntre('warung', db.warung, {
    ...lama,
    ...perubahan,
    updated_at: sekarang(),
  });
}
