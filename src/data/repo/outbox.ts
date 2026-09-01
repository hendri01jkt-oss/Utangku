import { db, type EntriOutbox, type NamaEntitas } from '@/data/db';
import { formatRupiah } from '@/lib/uang';

export interface EntriBermasalah {
  urutan: number;
  entitas: NamaEntitas;
  id: string;
  /** Satu baris yang bisa dikenali pemilik warung, mis. "Utang Bu Siti". */
  judul: string;
  /** Keterangan tambahan: nominal, tanggal, atau nama yang terkait. */
  rincian: string;
  galat: string;
  percobaan: number;
  dibuat_at: string;
}

const LABEL_ENTITAS: Record<NamaEntitas, string> = {
  warung: 'Data warung',
  pelanggan: 'Pelanggan',
  transaksi_utang: 'Utang',
  transaksi_item: 'Rincian item',
  pembayaran: 'Pembayaran',
};

/**
 * Menerjemahkan satu entri outbox menjadi kalimat yang berarti bagi pemilik
 * warung.
 *
 * Isi outbox adalah muatan JSON mentah berisi UUID — tidak ada gunanya
 * ditunjukkan apa adanya. Yang ingin diketahui pemilik warung cuma satu:
 * catatan MANA yang belum sampai ke server. Jadi nama pelanggan dan
 * nominalnya dicari dari data lokal, bukan ditebak dari muatan.
 */
async function ringkas(entri: EntriOutbox): Promise<{ judul: string; rincian: string }> {
  const muatan = entri.muatan;
  const nama = async (pelangganId: unknown) => {
    if (typeof pelangganId !== 'string') return null;
    return (await db.pelanggan.get(pelangganId))?.nama ?? null;
  };

  if (entri.entitas === 'transaksi_utang') {
    const pelanggan = await nama(muatan['pelanggan_id']);
    const nominal = typeof muatan['nominal'] === 'number' ? muatan['nominal'] : 0;
    return {
      judul: pelanggan ? `Utang ${pelanggan}` : 'Utang',
      rincian: [
        formatRupiah(nominal),
        typeof muatan['tanggal'] === 'string' ? muatan['tanggal'] : null,
        typeof muatan['keterangan'] === 'string' && muatan['keterangan'] ? muatan['keterangan'] : null,
      ]
        .filter(Boolean)
        .join(' · '),
    };
  }

  if (entri.entitas === 'pembayaran') {
    const pelanggan = await nama(muatan['pelanggan_id']);
    const nominal = typeof muatan['nominal'] === 'number' ? muatan['nominal'] : 0;
    return {
      judul: pelanggan ? `Pembayaran ${pelanggan}` : 'Pembayaran',
      rincian: formatRupiah(nominal),
    };
  }

  if (entri.entitas === 'pelanggan') {
    const namaPelanggan = typeof muatan['nama'] === 'string' ? muatan['nama'] : null;
    return {
      judul: namaPelanggan ? `Pelanggan ${namaPelanggan}` : 'Pelanggan',
      rincian: typeof muatan['no_wa'] === 'string' && muatan['no_wa'] ? muatan['no_wa'] : '',
    };
  }

  return {
    judul: LABEL_ENTITAS[entri.entitas],
    rincian: typeof muatan['nama_warung'] === 'string' ? muatan['nama_warung'] : '',
  };
}

/** Entri yang ditolak server, terlama dulu — urutan antreannya sendiri. */
export async function daftarOutboxBermasalah(): Promise<EntriBermasalah[]> {
  const entri = await db.outbox.orderBy('urutan').filter((e) => e.galat !== null).toArray();

  return Promise.all(
    entri.map(async (e) => {
      const { judul, rincian } = await ringkas(e);
      return {
        urutan: e.urutan ?? 0,
        entitas: e.entitas,
        id: e.id,
        judul,
        rincian,
        galat: e.galat ?? '',
        percobaan: e.percobaan,
        dibuat_at: e.dibuat_at,
      };
    }),
  );
}

/**
 * Menghapus penanda galat sehingga entri masuk antrean lagi.
 *
 * Dibutuhkan setelah penyebab penolakan diperbaiki di sisi aplikasi. Tanpa
 * ini, entri yang pernah ditolak akan dilewati selamanya — dan itu memang
 * disengaja, supaya satu baris rusak tidak menyumbat seluruh antrean. Yang
 * kurang selama ini hanyalah tombol untuk mencabut penanda itu.
 */
export async function cobaUlangSemua(): Promise<number> {
  const entri = await db.outbox.filter((e) => e.galat !== null).toArray();

  await db.transaction('rw', db.outbox, async () => {
    for (const e of entri) {
      if (e.urutan === undefined) continue;
      await db.outbox.update(e.urutan, { galat: null, percobaan: 0 });
    }
  });

  return entri.length;
}
