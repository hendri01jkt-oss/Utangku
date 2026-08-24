import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Menggabungkan className dengan aman: kelas Tailwind yang bentrok dimenangkan yang terakhir. */
export const cn = (...kelas: ClassValue[]) => twMerge(clsx(kelas));
