import { formatRupiahDatar } from '@/lib/uang';
import { namaBerkas, namaBulan, type Laporan } from './dataLaporan';

const tanggalPendek = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const labelStatus: Record<string, string> = {
  belum_lunas: 'Belum lunas',
  sebagian: 'Sebagian',
  lunas: 'Lunas',
};

function judulPeriode(laporan: Laporan) {
  return `${namaBulan(laporan.periode.mulai)} – ${namaBulan(laporan.periode.sampai)}`;
}

/**
 * PDF rekap: ringkasan di atas, lalu tabel utang baru dan pembayaran.
 *
 * Pustakanya dimuat dinamis supaya tidak ikut membebani bundle utama —
 * sebagian besar pembukaan aplikasi tidak pernah menyentuh halaman laporan,
 * dan target UtangKu adalah HP kelas bawah.
 */
/** jspdf-autotable menaruh posisi akhir tabel di sini, tapi tidak mengetiknya. */
type DokumenTabel = { lastAutoTable?: { finalY: number } };

export async function buatPdf(laporan: Laporan, namaWarung: string) {
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const posisi = doc as unknown as DokumenTabel;
  const akhirTabel = (cadangan: number) => posisi.lastAutoTable?.finalY ?? cadangan;

  const merah: [number, number, number] = [198, 40, 40];
  const abu: [number, number, number] = [244, 244, 246];
  const KIRI = 40;

  doc.setFontSize(16);
  doc.text(namaWarung, KIRI, 46);
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Rekap Utang — ${judulPeriode(laporan)}`, KIRI, 62);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 80,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    body: [
      ['Utang baru periode ini', formatRupiahDatar(laporan.totalUtangBaru)],
      ['Tertagih periode ini', formatRupiahDatar(laporan.totalTertagih)],
      ['Penjualan tunai periode ini', formatRupiahDatar(laporan.totalPenjualanTunai)],
      [
        `Sisa piutang per ${tanggalPendek(laporan.periode.sampai)}`,
        formatRupiahDatar(laporan.sisaPiutang),
      ],
      ['Pelanggan masih berutang', String(laporan.jumlahPelangganBerutang)],
    ],
  });

  const judulSeksi = (teks: string) => {
    const y = akhirTabel(80) + 28;
    doc.setFontSize(12);
    doc.text(teks, KIRI, y);
    return y + 8;
  };

  autoTable(doc, {
    startY: judulSeksi('Utang Baru'),
    head: [['Tanggal', 'Pelanggan', 'Keterangan', 'Jatuh tempo', 'Status', 'Nominal']],
    body: laporan.utangBaru.map((t) => [
      tanggalPendek(t.tanggal),
      t.namaPelanggan,
      t.keterangan,
      t.jatuhTempo ? tanggalPendek(t.jatuhTempo) : '—',
      labelStatus[t.status] ?? t.status,
      formatRupiahDatar(t.nominal),
    ]),
    foot: [['', '', '', '', 'Total', formatRupiahDatar(laporan.totalUtangBaru)]],
    headStyles: { fillColor: merah },
    footStyles: { fillColor: abu, textColor: 20, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 5: { halign: 'right' } },
  });

  autoTable(doc, {
    startY: judulSeksi('Penjualan Tunai'),
    head: [['Tanggal', 'Pembeli', 'Keterangan', 'Nominal']],
    body: laporan.penjualanTunai.map((t) => [
      tanggalPendek(t.tanggal),
      t.namaPelanggan,
      t.keterangan,
      formatRupiahDatar(t.nominal),
    ]),
    foot: [['', '', 'Total', formatRupiahDatar(laporan.totalPenjualanTunai)]],
    headStyles: { fillColor: merah },
    footStyles: { fillColor: abu, textColor: 20, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 3: { halign: 'right' } },
  });

  autoTable(doc, {
    startY: judulSeksi('Pembayaran Diterima'),
    head: [['Tanggal', 'Pelanggan', 'Metode', 'Catatan', 'Nominal']],
    body: laporan.pembayaran.map((b) => [
      tanggalPendek(b.tanggal),
      b.namaPelanggan,
      b.metode,
      b.catatan,
      formatRupiahDatar(b.nominal),
    ]),
    foot: [['', '', '', 'Total', formatRupiahDatar(laporan.totalTertagih)]],
    headStyles: { fillColor: merah },
    footStyles: { fillColor: abu, textColor: 20, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 4: { halign: 'right' } },
  });

  const halaman = doc.getNumberOfPages();
  for (let i = 1; i <= halaman; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `Dibuat dengan UtangKu · Halaman ${i} dari ${halaman}`,
      KIRI,
      doc.internal.pageSize.getHeight() - 24,
    );
  }

  return doc;
}

export async function unduhPdf(laporan: Laporan, namaWarung: string) {
  const doc = await buatPdf(laporan, namaWarung);
  doc.save(`${namaBerkas(namaWarung, laporan.periode)}.pdf`);
}

/**
 * Excel rekap: tiga lembar, dengan nominal sebagai ANGKA (bukan teks
 * "Rp 90.000") supaya pemilik warung bisa langsung menjumlah dan
 * mengolahnya sendiri.
 */
export async function buatExcel(laporan: Laporan, namaWarung: string) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser');

  const judulKolom = { fontWeight: 'bold' as const, backgroundColor: '#f4f4f6' };
  const uang = { type: Number, format: '#,##0' } as const;

  const ringkasan = [
    [{ value: 'Rekap UtangKu', fontWeight: 'bold' as const, span: 2 }],
    [{ value: 'Warung' }, { value: namaWarung }],
    [{ value: 'Periode mulai' }, { value: laporan.periode.mulai }],
    [{ value: 'Periode sampai' }, { value: laporan.periode.sampai }],
    [{ value: 'Utang baru' }, { value: laporan.totalUtangBaru, ...uang }],
    [{ value: 'Tertagih' }, { value: laporan.totalTertagih, ...uang }],
    [{ value: 'Penjualan tunai' }, { value: laporan.totalPenjualanTunai, ...uang }],
    [{ value: 'Sisa piutang akhir periode' }, { value: laporan.sisaPiutang, ...uang }],
    [
      { value: 'Pelanggan masih berutang' },
      { value: laporan.jumlahPelangganBerutang, type: Number },
    ],
  ];

  const lembarUtang = [
    [
      { value: 'Tanggal', ...judulKolom },
      { value: 'Pelanggan', ...judulKolom },
      { value: 'Keterangan', ...judulKolom },
      { value: 'Jatuh tempo', ...judulKolom },
      { value: 'Status', ...judulKolom },
      { value: 'Nominal', ...judulKolom },
    ],
    ...laporan.utangBaru.map((t) => [
      { value: t.tanggal },
      { value: t.namaPelanggan },
      { value: t.keterangan },
      { value: t.jatuhTempo ?? '' },
      { value: labelStatus[t.status] ?? t.status },
      { value: t.nominal, ...uang },
    ]),
  ];

  const lembarTunai = [
    [
      { value: 'Tanggal', ...judulKolom },
      { value: 'Pembeli', ...judulKolom },
      { value: 'Keterangan', ...judulKolom },
      { value: 'Nominal', ...judulKolom },
    ],
    ...laporan.penjualanTunai.map((t) => [
      { value: t.tanggal },
      { value: t.namaPelanggan },
      { value: t.keterangan },
      { value: t.nominal, ...uang },
    ]),
  ];

  const lembarBayar = [
    [
      { value: 'Tanggal', ...judulKolom },
      { value: 'Pelanggan', ...judulKolom },
      { value: 'Metode', ...judulKolom },
      { value: 'Catatan', ...judulKolom },
      { value: 'Nominal', ...judulKolom },
    ],
    ...laporan.pembayaran.map((b) => [
      { value: b.tanggal },
      { value: b.namaPelanggan },
      { value: b.metode },
      { value: b.catatan },
      { value: b.nominal, ...uang },
    ]),
  ];

  return writeXlsxFile([
    {
      sheet: 'Ringkasan',
      data: ringkasan,
      columns: [{ width: 28 }, { width: 30 }],
    },
    {
      sheet: 'Utang Baru',
      data: lembarUtang,
      columns: [
        { width: 12 },
        { width: 22 },
        { width: 30 },
        { width: 12 },
        { width: 14 },
        { width: 14 },
      ],
    },
    {
      sheet: 'Penjualan Tunai',
      data: lembarTunai,
      columns: [{ width: 12 }, { width: 22 }, { width: 30 }, { width: 14 }],
    },
    {
      sheet: 'Pembayaran',
      data: lembarBayar,
      columns: [{ width: 12 }, { width: 22 }, { width: 12 }, { width: 30 }, { width: 14 }],
    },
  ]);
}

export async function unduhExcel(laporan: Laporan, namaWarung: string) {
  const hasil = await buatExcel(laporan, namaWarung);
  await hasil.toFile(`${namaBerkas(namaWarung, laporan.periode)}.xlsx`);
}
