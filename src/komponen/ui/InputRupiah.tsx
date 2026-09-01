import { useId } from 'react';
import { cn } from '@/lib/cn';
import { formatAngka, formatRupiah, parseRupiah } from '@/lib/uang';
import { kelasKotakInput } from './Input';

interface Props {
  label?: string;
  /** Nominal dalam rupiah penuh, selalu bilangan bulat. */
  nilai: number;
  onChange: (nominal: number) => void;
  galat?: string;
  /** Tombol nominal cepat, mis. [5000, 10000, 20000, 50000]. */
  pintasan?: number[];
  placeholder?: string;
  autoFocus?: boolean;
  /**
   * Menyembunyikan gema nilai di bawah kotak.
   *
   * Gema itu berguna sebagai penegasan bahwa mask membaca angkanya dengan
   * benar. Tapi di dalam baris rincian item ia berdiri persis di atas
   * Subtotal yang menyebut angka yang sama, jadi ia hanya menambah tinggi
   * baris — dan tinggi baris mahal ketika daftar itu dipakai di layar 390px
   * sambil melayani pembeli.
   */
  ringkas?: boolean;
}

/**
 * Input uang dengan mask ribuan.
 *
 * Yang disimpan ke state selalu `number` bulat — teks bermask hanya tampilan.
 * inputMode="numeric" memunculkan papan angka di HP, jadi pemilik warung
 * tidak perlu berpindah keyboard saat mencatat.
 */
export function InputRupiah({
  label,
  nilai,
  onChange,
  galat,
  pintasan,
  placeholder = '0',
  autoFocus,
  ringkas,
}: Props) {
  const idInput = useId();
  const idBantuan = `${idInput}-bantuan`;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={idInput} className="text-sm text-teks-redup">
          {label}
        </label>
      ) : null}

      <div className={cn(kelasKotakInput, 'min-h-13', galat && 'border-bahaya/50')}>
        <span className="text-teks-samar">Rp</span>
        <input
          id={idInput}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          value={nilai === 0 ? '' : formatAngka(nilai)}
          onChange={(e) => onChange(parseRupiah(e.target.value))}
          placeholder={placeholder}
          aria-invalid={galat ? true : undefined}
          aria-describedby={galat ? idBantuan : undefined}
          className={cn(
            'angka w-full bg-transparent py-2 text-lg font-semibold text-teks-utama outline-none',
            'placeholder:font-normal placeholder:text-teks-samar',
          )}
        />
      </div>

      {pintasan?.length ? (
        <div className="mt-1 flex flex-wrap gap-2">
          {pintasan.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(nilai + n)}
              className={cn(
                'angka rounded-full border border-garis bg-putih px-3 py-1.5 text-xs text-teks-redup',
                'transition-colors hover:bg-permukaan-2 hover:text-teks-utama',
              )}
            >
              + {formatAngka(n)}
            </button>
          ))}
          {nilai > 0 ? (
            <button
              type="button"
              onClick={() => onChange(0)}
              className="rounded-full px-3 py-1.5 text-xs text-teks-samar hover:text-teks-utama"
            >
              Hapus
            </button>
          ) : null}
        </div>
      ) : null}

      {galat ? (
        <p id={idBantuan} className="text-xs text-bahaya">
          {galat}
        </p>
      ) : null}

      {nilai > 0 && !ringkas ? (
        <p className="text-xs text-teks-samar">{formatRupiah(nilai)}</p>
      ) : null}
    </div>
  );
}
