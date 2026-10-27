/** Jam:menit (24 jam) menurut jam perangkat, dari cap waktu ISO. Kosong bila tidak terbaca. */
export function jamDari(iso: string | null | undefined): string {
  if (!iso) return '';
  const waktu = new Date(iso);
  if (Number.isNaN(waktu.getTime())) return '';
  return `${String(waktu.getHours()).padStart(2, '0')}:${String(waktu.getMinutes()).padStart(2, '0')}`;
}
