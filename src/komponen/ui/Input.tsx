import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  bantuan?: string;
  galat?: string;
  awalan?: ReactNode;
  akhiran?: ReactNode;
}

/** Kelas dasar kotak input — dipakai ulang oleh InputRupiah. */
export const kelasKotakInput =
  'flex items-center gap-2 rounded-[var(--radius-kontrol)] kaca px-3 min-h-11 ' +
  'focus-within:border-gold-400/60 transition-colors';

export function Input({
  label,
  bantuan,
  galat,
  awalan,
  akhiran,
  className,
  id,
  ...sisa
}: Props) {
  const idOtomatis = useId();
  const idInput = id ?? idOtomatis;
  const idBantuan = `${idInput}-bantuan`;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={idInput} className="text-sm text-teks-redup">
          {label}
        </label>
      ) : null}

      <div className={cn(kelasKotakInput, galat && 'border-bahaya/50')}>
        {awalan ? <span className="text-teks-samar">{awalan}</span> : null}
        <input
          id={idInput}
          aria-invalid={galat ? true : undefined}
          aria-describedby={galat || bantuan ? idBantuan : undefined}
          className={cn(
            'w-full bg-transparent py-2 text-teks-utama outline-none',
            'placeholder:text-teks-samar',
            className,
          )}
          {...sisa}
        />
        {akhiran ? <span className="text-teks-samar">{akhiran}</span> : null}
      </div>

      {galat || bantuan ? (
        <p
          id={idBantuan}
          className={cn('text-xs', galat ? 'text-bahaya' : 'text-teks-samar')}
        >
          {galat ?? bantuan}
        </p>
      ) : null}
    </div>
  );
}
