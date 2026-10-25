-- Skema D1 UtangKu (pengganti Postgres di Supabase).
-- Waktu disimpan sebagai teks ISO-8601 UTC, id sebagai teks UUID.
-- Hak akses yang dulu dijaga RLS kini dijaga Worker (src/worker), karena
-- D1 tidak punya RLS: setiap query WAJIB difilter warung_id milik pengguna.

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE profiles (
  id           TEXT PRIMARY KEY REFERENCES users(id),
  nama_lengkap TEXT,
  no_wa        TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE warung (
  id                     TEXT PRIMARY KEY,
  pemilik_id             TEXT NOT NULL REFERENCES users(id),
  nama_warung            TEXT NOT NULL,
  alamat                 TEXT,
  no_wa_warung           TEXT,
  logo_path              TEXT,
  template_pesan_tagihan TEXT NOT NULL DEFAULT '',
  tempo_default_hari     INTEGER NOT NULL DEFAULT 0,
  lebar_struk            INTEGER NOT NULL DEFAULT 58,
  created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX warung_pemilik_idx ON warung(pemilik_id);

CREATE TABLE warung_anggota (
  warung_id  TEXT NOT NULL REFERENCES warung(id),
  user_id    TEXT NOT NULL REFERENCES users(id),
  role       TEXT NOT NULL DEFAULT 'pemilik' CHECK (role IN ('pemilik','kasir')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (warung_id, user_id)
);

CREATE TABLE pelanggan (
  id                         TEXT PRIMARY KEY,
  warung_id                  TEXT NOT NULL REFERENCES warung(id),
  nama                       TEXT NOT NULL,
  no_wa                      TEXT,
  alamat                     TEXT,
  foto_path                  TEXT,
  catatan                    TEXT,
  status                     TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif','nonaktif')),
  token_pantau               TEXT NOT NULL UNIQUE,
  pin_pantau                 TEXT NOT NULL CHECK (length(pin_pantau) = 6),
  terakhir_dilihat_pelanggan TEXT,
  created_at                 TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at                 TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at                 TEXT
);
CREATE INDEX pelanggan_warung_upd_idx ON pelanggan(warung_id, updated_at);

CREATE TABLE transaksi_utang (
  id                      TEXT PRIMARY KEY,
  warung_id               TEXT NOT NULL REFERENCES warung(id),
  pelanggan_id            TEXT REFERENCES pelanggan(id),
  jenis                   TEXT NOT NULL DEFAULT 'utang' CHECK (jenis IN ('utang','tunai')),
  tanggal                 TEXT NOT NULL,
  nominal                 REAL NOT NULL,
  keterangan              TEXT,
  jatuh_tempo             TEXT,
  status                  TEXT NOT NULL DEFAULT 'belum_lunas' CHECK (status IN ('belum_lunas','sebagian','lunas')),
  total_dibayar           REAL NOT NULL DEFAULT 0,
  reminder_hari_sebelum   INTEGER NOT NULL DEFAULT 3,
  reminder_terkirim_untuk TEXT,
  dibuat_oleh             TEXT,
  nomor_struk             TEXT,
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at              TEXT
);
CREATE INDEX transaksi_warung_upd_idx ON transaksi_utang(warung_id, updated_at);
CREATE INDEX transaksi_pelanggan_idx ON transaksi_utang(pelanggan_id);

CREATE TABLE transaksi_item (
  id           TEXT PRIMARY KEY,
  warung_id    TEXT NOT NULL REFERENCES warung(id),
  transaksi_id TEXT NOT NULL REFERENCES transaksi_utang(id),
  urutan       INTEGER NOT NULL DEFAULT 0,
  nama_item    TEXT NOT NULL,
  qty          INTEGER NOT NULL,
  harga_satuan REAL NOT NULL,
  subtotal     REAL GENERATED ALWAYS AS (qty * harga_satuan) VIRTUAL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at   TEXT
);
CREATE INDEX item_warung_upd_idx ON transaksi_item(warung_id, updated_at);
CREATE INDEX item_transaksi_idx ON transaksi_item(transaksi_id);

CREATE TABLE pembayaran (
  id           TEXT PRIMARY KEY,
  warung_id    TEXT NOT NULL REFERENCES warung(id),
  transaksi_id TEXT NOT NULL REFERENCES transaksi_utang(id),
  pelanggan_id TEXT NOT NULL REFERENCES pelanggan(id),
  tanggal      TEXT NOT NULL,
  nominal      REAL NOT NULL,
  metode       TEXT NOT NULL DEFAULT 'tunai' CHECK (metode IN ('tunai','transfer','qris','lainnya')),
  catatan      TEXT,
  dibuat_oleh  TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at   TEXT
);
CREATE INDEX bayar_warung_upd_idx ON pembayaran(warung_id, updated_at);
CREATE INDEX bayar_transaksi_idx ON pembayaran(transaksi_id);

CREATE TABLE subscriptions (
  warung_id               TEXT PRIMARY KEY REFERENCES warung(id),
  tier                    TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free','pro')),
  status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
  tanggal_mulai_langganan TEXT,
  tanggal_expired         TEXT,
  payment_provider        TEXT,
  payment_reference       TEXT,
  trial_sampai            TEXT NOT NULL,
  updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE payment_orders (
  order_id                TEXT PRIMARY KEY,
  warung_id               TEXT NOT NULL REFERENCES warung(id),
  amount                  REAL NOT NULL,
  status                  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','settlement','expired','failed')),
  midtrans_transaction_id TEXT,
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE pantau_percobaan (
  token_pantau    TEXT PRIMARY KEY,
  gagal           INTEGER NOT NULL DEFAULT 0,
  gagal_terakhir  TEXT NOT NULL,
  terkunci_sampai TEXT
);

-- Pengaman tebakan login: mencegah coba-coba kata sandi.
CREATE TABLE login_percobaan (
  kunci           TEXT PRIMARY KEY,
  gagal           INTEGER NOT NULL DEFAULT 0,
  gagal_terakhir  TEXT NOT NULL,
  terkunci_sampai TEXT
);
