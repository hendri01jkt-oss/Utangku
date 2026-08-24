import { useEffect } from 'react';
import { mulaiMesinSync } from './mesin';

/** Menyalakan mesin sync selama warung aktif diketahui. */
export function useMesinSync(warungId: string | undefined) {
  useEffect(() => {
    if (!warungId) return;
    return mulaiMesinSync(warungId);
  }, [warungId]);
}
