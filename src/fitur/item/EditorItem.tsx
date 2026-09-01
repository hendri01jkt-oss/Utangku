import { Plus, Trash2 } from 'lucide-react';
import { Input, InputRupiah } from '@/komponen/ui';
import { itemKosong, subtotalItem, totalItem, itemTerisi, type ItemBaru } from '@/data/repo/item';
import { formatRupiah } from '@/lib/uang';

/**
 * Daftar rincian item: nama, qty, harga satuan, subtotal terhitung.
 *
 * Dipakai bersama oleh form utang dan form penjualan tunai. Keduanya harus
 * menghitung total dengan cara yang persis sama — kalau masing-masing punya
 * salinannya sendiri, cepat atau lambat salah satunya akan berbeda dan
 * angka struk tidak lagi cocok dengan angka yang tercatat.
 */
export function EditorItem({
  item,
  onUbah,
}: {
  item: ItemBaru[];
  onUbah: (item: ItemBaru[]) => void;
}) {
  const ubahBaris = (indeks: number, ubahan: Partial<ItemBaru>) => {
    onUbah(item.map((baris, i) => (i === indeks ? { ...baris, ...ubahan } : baris)));
  };

  const hapusBaris = (indeks: number) => {
    const sisa = item.filter((_, i) => i !== indeks);
    // Selalu sisakan satu baris kosong: daftar yang benar-benar kosong
    // membuat pemiliknya harus menekan "Tambah item" hanya untuk mulai.
    onUbah(sisa.length > 0 ? sisa : [itemKosong()]);
  };

  return (
    <div className="flex flex-col gap-3">
      {item.map((baris, indeks) => (
        <div
          key={indeks}
          className="flex flex-col gap-2 rounded-[var(--radius-kontrol)] border border-garis p-3"
        >
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Input
                label={`Item ${indeks + 1}`}
                value={baris.nama_item}
                onChange={(e) => ubahBaris(indeks, { nama_item: e.target.value })}
                placeholder="mis. nasi rames"
              />
            </div>
            <button
              type="button"
              onClick={() => hapusBaris(indeks)}
              aria-label={`Hapus item ${indeks + 1}`}
              className="mb-1 flex size-11 shrink-0 items-center justify-center rounded-full text-teks-redup hover:bg-permukaan-2"
            >
              <Trash2 size={18} aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-[5rem_1fr] gap-2">
            <Input
              label="Qty"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={String(baris.qty)}
              onChange={(e) =>
                // Kolom yang sedang dikosongkan pengguna tidak boleh langsung
                // dipaksa jadi 1 — itu memakan angka yang sedang diketik.
                ubahBaris(indeks, { qty: Math.max(0, Math.floor(Number(e.target.value) || 0)) })
              }
            />
            <InputRupiah
              label="Harga satuan"
              nilai={baris.harga_satuan}
              onChange={(nilai) => ubahBaris(indeks, { harga_satuan: nilai })}
              ringkas
            />
          </div>

          <p className="text-right text-xs text-teks-redup">
            Subtotal <span className="angka font-medium">{formatRupiah(subtotalItem(baris))}</span>
          </p>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onUbah([...item, itemKosong()])}
        className="flex min-h-11 items-center justify-center gap-1.5 rounded-[var(--radius-kontrol)] border border-dashed border-garis text-sm font-medium text-teks-redup"
      >
        <Plus size={16} aria-hidden />
        Tambah item
      </button>

      <div className="flex items-center justify-between rounded-[var(--radius-kontrol)] bg-permukaan-2 px-3 py-2.5">
        <span className="text-sm text-teks-redup">Total</span>
        <span className="angka text-lg font-semibold">
          {formatRupiah(totalItem(itemTerisi(item)))}
        </span>
      </div>
    </div>
  );
}
