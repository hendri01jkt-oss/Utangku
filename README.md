# UtangKu

Catatan utang pelanggan untuk warung, warteg, dan warkop. Aplikasi web (PWA)
yang **tetap jalan tanpa sinyal** — semua catatan disimpan di perangkat lebih
dulu, lalu disinkronkan ke server saat jaringan kembali.

- Produksi: <https://utangku.netlify.app>
- Rencana lengkap dan urutan pembangunan: [PLAN.md](./PLAN.md)

## Menjalankan di komputer sendiri

```bash
npm install
cp .env.example .env   # lalu isi nilainya, lihat bagian berikut
npm run dev            # http://localhost:5173
```

Perintah lain:

| Perintah | Gunanya |
|---|---|
| `npm run build` | `tsc -b && vite build` → keluaran ke `dist/` |
| `npm run build:pages` | Build + salin `404.html` (untuk GitHub Pages) |
| `npm run typecheck` | Periksa tipe tanpa membangun |
| `npm run lint` | `oxlint --deny-warnings` (peringatan dianggap galat) |
| `npm run cek:kontras` | Pastikan semua pasangan warna ≥ 4.5:1 (WCAG AA) |
| `npm run preview` | Menyajikan hasil build produksi |

## Environment variable

Nilainya diambil dari Supabase Dashboard → Project Settings → API.

| Nama | Isi |
|---|---|
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Kunci `sb_publishable_…` |
| `VITE_SUPABASE_PROJECT_REF` | Project ref saja |

Kunci publishable memang aman berada di browser — seluruh pembatasan akses
ditegakkan oleh RLS di Postgres, bukan oleh kerahasiaan kunci. Yang **tidak
boleh** masuk ke sini atau ke repo adalah `service_role` key.

`.env` sudah masuk `.gitignore`. Di Netlify, nilainya disimpan sebagai
environment variable project, bukan di dalam repo.

> Ketiga variabel dibaca saat **build**, bukan saat aplikasi berjalan. Vite
> menyalin nilainya langsung ke dalam berkas JavaScript. Konsekuensinya:
> mengubah nilai di Netlify tidak berpengaruh sampai ada build ulang, dan
> build yang berjalan tanpa variabel ini akan menghasilkan aplikasi yang
> gagal saat dibuka.

## Deploy (Netlify)

Konfigurasi ada di [`netlify.toml`](./netlify.toml) dan
[`public/_redirects`](./public/_redirects):

- **Build command** `npm run build`, **publish directory** `dist`
- **Fallback SPA** `/* → /index.html 200` — UtangKu memakai React Router,
  jadi tanpa aturan ini setiap tautan langsung dan setiap refresh di halaman
  selain `/` akan menghasilkan 404
- **Chunk hilang** `/assets/* → 404` — klien dengan `index.html` versi lama
  meminta berkas ber-hash yang sudah tidak ada. Membiarkannya jatuh ke
  fallback SPA akan mengirim HTML yang menyamar jadi JavaScript
- **Header cache**: aset ber-hash `immutable` selamanya; `sw.js`,
  `index.html`, dan manifest selalu divalidasi ulang supaya pembaruan tidak
  tertahan berhari-hari di cache browser

### Menghubungkan repo (sekali saja)

Netlify perlu izin OAuth ke GitHub, jadi langkah ini dikerjakan lewat
dashboard:

1. <https://app.netlify.com/projects/utangku> → **Project configuration →
   Build & deploy → Link repository**
2. Pilih `hendri01jkt-oss/Utangku`, branch `main`
3. Build command dan publish directory akan terbaca sendiri dari
   `netlify.toml` — tidak perlu diisi manual

Setelah tertaut, setiap push ke `main` memicu build dan deploy otomatis.

## Deploy (GitHub Pages) — alternatif

Dipakai selagi kredit Netlify habis. Keduanya bisa hidup berdampingan:
konfigurasi Netlify tidak disentuh, dan bedanya hanya pada awalan alamat.

| | Netlify | GitHub Pages |
|---|---|---|
| Alamat | akar domain `/` | subpath `/<nama-repo>/` |
| Fallback SPA | `_redirects` (200 rewrite) | `404.html` (status 404) |
| Dipicu oleh | push ke `main` (setelah repo tertaut) | `.github/workflows/deploy-gh-pages.yml` |

Awalan alamat diatur variabel `BASE_PATH` saat build. Bawaannya `/`, jadi
Netlify tidak perlu tahu apa-apa; workflow Pages mengisinya dari nama repo
yang sebenarnya (`github.event.repository.name`), bukan ditulis tangan.

Membangun versi Pages secara lokal:

```bash
BASE_PATH=/Utangku/ npm run build:pages
```

`build:pages` menjalankan build biasa lalu menyalin `dist/index.html`
menjadi `dist/404.html`. GitHub Pages tidak punya aturan rewrite; satu-
satunya kesepakatannya adalah menyajikan `404.html` untuk alamat tanpa
berkas. Dengan isi yang sama persis, `/pelanggan/123` tetap memuat aplikasi
— hanya saja responsnya berstatus 404, bukan 200.

### Langkah sekali jalan di GitHub

1. **Settings → Pages → Source: GitHub Actions**
2. **Settings → Secrets and variables → Actions → New repository secret**,
   isi `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY`
   (opsional `VITE_SUPABASE_PROJECT_REF`). Workflow sengaja berhenti dengan
   pesan jelas kalau dua yang pertama kosong — build yang lolos tanpa
   keduanya menghasilkan aplikasi yang gagal saat dibuka.
3. Tambahkan alamat Pages ke **Supabase → Authentication → URL
   Configuration → Redirect URLs**

> GitHub Pages untuk repo **privat** hanya tersedia di paket berbayar
> (Pro/Team/Enterprise). Di paket gratis, repo harus dijadikan publik dulu.

## Supabase

Migrasi ada di [`supabase/migrations/`](./supabase/migrations), bernomor urut
dan diterapkan berurutan. Tipe TypeScript-nya di-generate ke
`src/data/database.types.ts`.

**Authentication → URL Configuration** harus memakai domain produksi, bukan
`localhost`, kalau tidak tautan konfirmasi email dan reset kata sandi akan
mengarah ke komputer penerimanya sendiri:

- **Site URL**: `https://utangku.netlify.app`
- **Redirect URLs**: `https://utangku.netlify.app/**`,
  `https://<akun>.github.io/Utangku/**` (kalau memakai Pages), dan
  `http://localhost:5173/**` untuk pengembangan

## Arsitektur singkat

```
src/
  app/        router, layout, penjaga rute, prompt PWA
  fitur/      pelanggan · utang · pembayaran · tagihan · laporan · pengaturan · auth
  komponen/   komponen UI dasar
  data/       db.ts (Dexie) · repo/ (satu-satunya jalan ke data) · sync/ (outbox + mesin sync)
  lib/        uang · tanggal · wa · supabase
  gaya/       token warna
```

Dua aturan yang menjaga sifat offline-first, dan melanggarnya akan merusaknya:

1. **Komponen UI tidak pernah memanggil Supabase langsung.** Semua tulis-baca
   lewat `data/repo/*`, yang menulis ke Dexie dan antrean outbox dalam satu
   transaksi. Kalau ada komponen yang menembak jaringan sendiri, fitur itu
   akan mati begitu sinyal hilang.
2. **Status utang tidak pernah ditulis dari klien.** `status` dan
   `total_dibayar` adalah turunan dari daftar pembayaran, dihitung ulang oleh
   trigger di Postgres dan oleh perhitungan yang sama di sisi lokal. Hak
   tulis kedua kolom itu memang dicabut di level database.
