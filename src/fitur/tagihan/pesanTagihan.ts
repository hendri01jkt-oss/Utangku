import type { BarisTransaksi } from '@/data/db';
import { sisaUtang, tanggalHariIni } from '@/data/repo/transaksi';
import { formatRupiah } from '@/lib/uang';

/** Baris rincian yang ikut ditulis di pesan; sisanya diringkas. */
const MAKS_RINCIAN = 8;

export const TEMPLATE_BAWAAN = `Halo {nama} 🙏
Ini pengingat dari {warung}.

Sisa utang Anda: *{sisa}*
{rincian}

Mohon dapat diselesaikan ya. Terima kasih 🙏`;

const formatTanggalPendek = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export interface DataPesan {
  namaPelanggan: string;
  namaWarung: string;
  utangBelumLunas: BarisTransaksi[];
}

/**
 * Mengisi template menjadi pesan siap kirim.
 *
 * Penggantian dilakukan dalam satu kali sapuan atas seluruh teks, bukan
 * berantai per variabel. Kalau berantai, isi sebuah variabel yang kebetulan
 * memuat tulisan seperti "{nama}" akan ikut tergantikan pada putaran
 * berikutnya — dan keterangan utang datang dari ketikan bebas pemilik warung.
 */
export function susunPesanTagihan(template: string, data: DataPesan): string {
  const aktif = data.utangBelumLunas.filter((t) => sisaUtang(t) > 0);
  const total = aktif.reduce((jumlah, t) => jumlah + sisaUtang(t), 0);

  const barisRincian = aktif
    .slice(0, MAKS_RINCIAN)
    .map(
      (t) =>
        `• ${formatTanggalPendek(t.tanggal)} — ${t.keterangan ?? 'tanpa keterangan'}: ${formatRupiah(sisaUtang(t))}`,
    );
  if (aktif.length > MAKS_RINCIAN) {
    barisRincian.push(`• dan ${aktif.length - MAKS_RINCIAN} catatan lainnya`);
  }

  const tempoTerdekat = aktif
    .map((t) => t.jatuh_tempo)
    .filter((t): t is string => t !== null)
    .sort()[0];

  const nilai: Record<string, string> = {
    nama: data.namaPelanggan,
    warung: data.namaWarung,
    sisa: formatRupiah(total),
    rincian: barisRincian.join('\n'),
    jatuh_tempo: tempoTerdekat ? formatTanggalPendek(tempoTerdekat) : 'belum ditentukan',
  };

  return template.replace(/\{(nama|warung|sisa|rincian|jatuh_tempo)\}/g, (cocok, kunci: string) =>
    Object.hasOwn(nilai, kunci) ? (nilai[kunci] as string) : cocok,
  );
}

/** Pratinjau template dengan data contoh, untuk halaman Pengaturan. */
export function contohPesan(template: string, namaWarung: string): string {
  const hariIni = tanggalHariIni();
  const contoh = (nominal: number, keterangan: string): BarisTransaksi => ({
    id: 'contoh',
    warung_id: 'contoh',
    pelanggan_id: 'contoh',
    jenis: 'utang',
    tanggal: hariIni,
    nominal,
    keterangan,
    jatuh_tempo: hariIni,
    status: 'belum_lunas',
    total_dibayar: 0,
    reminder_hari_sebelum: 3,
    reminder_terkirim_untuk: null,
    dibuat_oleh: null,
    created_at: hariIni,
    updated_at: hariIni,
    deleted_at: null,
  });

  return susunPesanTagihan(template, {
    namaPelanggan: 'Bu Siti',
    namaWarung,
    utangBelumLunas: [contoh(90_000, 'nasi + es teh'), contoh(25_000, 'gorengan')],
  });
}
