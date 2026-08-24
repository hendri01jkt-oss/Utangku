import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { useSesi } from './fitur/auth/useSesi';

export default function App() {
  const inisialisasi = useSesi((s) => s.inisialisasi);

  useEffect(() => inisialisasi(), [inisialisasi]);

  return <RouterProvider router={router} />;
}
