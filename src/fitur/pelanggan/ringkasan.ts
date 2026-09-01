import { db, type BarisPelanggan } from '@/data/db';

export interface PelangganDenganRingkasan {
  pelanggan: BarisPelanggan;
  sisaUtang: number;
  jumlahUtangAktif: number;
  /** Tanggal utang tertua yang belum lunas — dasar pengurutan "paling lama". */
  utangTerlama: string | null;
  jatuhTempoTerdekat: string | null;
}

export type UrutanPelanggan = 'sisa' | 'lama' | 'nama';

/**
 * Ringkasan dihitung dari Dexie, bukan dari view Supabase.
 *
 * View v_ringkasan_pelanggan tetap dipakai untuk laporan, tapi angka yang
 * tampil di layar harus benar juga saat offline — jadi sumbernya data lokal.
 */
export async function daftarPelangganRingkas(
  warungId: string,
  urutan: UrutanPelanggan = 'sisa',
): Promise<PelangganDenganRingkasan[]> {
  const [pelanggan, transaksi] = await Promise.all([
    db.pelanggan
      .where('warung_id')
      .equals(warungId)
      .filter((p) => p.deleted_at === null)
      .toArray(),
    db.transaksi_utang
      .where('warung_id')
      .equals(warungId)
      .filter((t) => t.deleted_at === null && t.status !== 'lunas')
      .toArray(),
  ]);

  const perPelanggan = new Map<string, PelangganDenganRingkasan>(
    pelanggan.map((p) => [
      p.id,
      {
        pelanggan: p,
        sisaUtang: 0,
        jumlahUtangAktif: 0,
        utangTerlama: null,
        jatuhTempoTerdekat: null,
      },
    ]),
  );

  for (const t of transaksi) {
    // Baris tanpa pelanggan (penjualan tunai ke pembeli lewat) tidak punya
    // tempat di daftar ini.
    if (!t.pelanggan_id) continue;
    const baris = perPelanggan.get(t.pelanggan_id);
    if (!baris) continue;
    baris.sisaUtang += Math.max(Math.round(t.nominal) - Math.round(t.total_dibayar), 0);
    baris.jumlahUtangAktif += 1;
    if (!baris.utangTerlama || t.tanggal < baris.utangTerlama) baris.utangTerlama = t.tanggal;
    if (t.jatuh_tempo && (!baris.jatuhTempoTerdekat || t.jatuh_tempo < baris.jatuhTempoTerdekat)) {
      baris.jatuhTempoTerdekat = t.jatuh_tempo;
    }
  }

  const hasil = [...perPelanggan.values()];

  if (urutan === 'nama') {
    return hasil.sort((a, b) => a.pelanggan.nama.localeCompare(b.pelanggan.nama, 'id'));
  }
  if (urutan === 'lama') {
    // Yang tidak punya utang aktif diletakkan di belakang, bukan di depan.
    return hasil.sort((a, b) => {
      if (!a.utangTerlama) return 1;
      if (!b.utangTerlama) return -1;
      return a.utangTerlama.localeCompare(b.utangTerlama);
    });
  }
  return hasil.sort((a, b) => b.sisaUtang - a.sisaUtang);
}

/** Pencocokan pencarian: nama atau nomor WA, mengabaikan spasi dan format. */
export function cocokPencarian(baris: PelangganDenganRingkasan, kueri: string) {
  const q = kueri.trim().toLowerCase();
  if (q === '') return true;
  const nama = baris.pelanggan.nama.toLowerCase();
  const wa = (baris.pelanggan.no_wa ?? '').replace(/\D/g, '');
  return nama.includes(q) || (q.replace(/\D/g, '') !== '' && wa.includes(q.replace(/\D/g, '')));
}
