import { create } from 'zustand';

export type StatusSync = 'offline' | 'menyinkronkan' | 'tersinkron';

interface StoreSync {
  status: StatusSync;
  terakhirSinkron: string | null;
  galatTerakhir: string | null;
  setStatus: (status: StatusSync, galat?: string | null) => void;
  tandaiSelesai: () => void;
}

export const useSync = create<StoreSync>((set) => ({
  status: navigator.onLine ? 'tersinkron' : 'offline',
  terakhirSinkron: null,
  galatTerakhir: null,
  setStatus: (status, galat = null) => set({ status, galatTerakhir: galat }),
  tandaiSelesai: () =>
    set({
      status: 'tersinkron',
      terakhirSinkron: new Date().toISOString(),
      galatTerakhir: null,
    }),
}));
