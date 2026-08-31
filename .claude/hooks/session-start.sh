#!/bin/bash
#
# Penjaga remote git untuk UtangKu.
#
# Latar belakangnya: pekerjaan Tahap 13 pernah ter-push ke repo yang salah
# (hendri01jkt-oss/website-pertama, yang menampung aplikasi lain di branch
# berbeda). Penyebabnya bukan kecerobohan sesaat, melainkan sesuatu yang
# berulang secara struktural — container sesi remote di-clone ulang dari repo
# sumber yang terdaftar di sesi, sehingga `git remote set-url` apa pun yang
# diperbaiki di sesi sebelumnya ikut hilang.
#
# Yang membuatnya sulit disadari: kedua repo punya riwayat commit yang
# identik, jadi "0 ahead, 0 behind" terhadap origin terlihat menenangkan
# padahal remote-nya salah. Satu-satunya pemeriksaan yang bisa membedakan
# keduanya adalah URL remote-nya sendiri — dan itu harus dibaca SEBELUM ada
# instruksi apa pun yang berujung push.
#
# Hook ini tidak memperbaiki remote secara diam-diam. Memperbaikinya sendiri
# akan menyembunyikan gejalanya dan membuat push ke repo salah jadi mustahil
# dilacak; yang dibutuhkan justru peringatan yang terbaca di awal sesi.
set -uo pipefail

DIHARAPKAN='hendri01jkt-oss/utangku'

cd "${CLAUDE_PROJECT_DIR:-$PWD}" 2>/dev/null || exit 0

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  exit 0
fi

# Kredensial disamarkan sebelum apa pun dicetak. Sebagian lingkungan
# menyisipkan token ke dalam URL remote, dan keluaran hook ini masuk ke
# catatan sesi — token yang tercetak di sana ikut tersimpan.
samarkan() { sed -E 's#(://)[^/@]+@#\1***@#g'; }

DAFTAR_REMOTE="$(git remote -v 2>/dev/null | samarkan)"
URL_ORIGIN="$(git remote get-url origin 2>/dev/null || true)"
URL_AMAN="$(printf '%s' "$URL_ORIGIN" | samarkan)"

# Sarikan "pemilik/repo" dari bentuk URL apa pun: https, ssh, dengan atau
# tanpa akhiran .git. Perbandingan huruf kecil karena nama repo GitHub tidak
# membedakan besar-kecil huruf (Utangku dan utangku adalah repo yang sama),
# dan mengabaikan itu akan memunculkan peringatan palsu.
sarikan() {
  printf '%s' "$1" \
    | sed -E 's#^[a-zA-Z0-9+.-]+://##; s#^[^/@]+@##; s#^[^/:]+[:/]##; s#\.git$##; s#/$##' \
    | tr '[:upper:]' '[:lower:]'
}

AKTUAL="$(sarikan "$URL_ORIGIN")"

echo "Pemeriksaan remote git (hook SessionStart):"
echo
echo "$DAFTAR_REMOTE"
echo

if [ -z "$URL_ORIGIN" ]; then
  echo "PERINGATAN: repo ini tidak punya remote bernama 'origin'."
  echo "JANGAN push apa pun sebelum memastikan tujuannya bersama pengguna."
  exit 0
fi

if [ "$AKTUAL" = "$DIHARAPKAN" ]; then
  echo "Remote origin sudah benar: $URL_AMAN"
  echo "Aman untuk push ke repo UtangKu."
  exit 0
fi

cat <<PESAN
=====================================================================
PERINGATAN: REMOTE ORIGIN MENGARAH KE REPO YANG SALAH
=====================================================================

  seharusnya : $DIHARAPKAN
  sebenarnya : $AKTUAL
  URL penuh  : $URL_AMAN

JANGAN menjalankan 'git push' apa pun ke origin dalam keadaan ini.
Push ke repo yang salah pernah terjadi di project ini dan mencemari
repo milik aplikasi lain.

Perlu diketahui: membandingkan commit TIDAK bisa mendeteksi masalah ini.
Repo-repo tersebut punya riwayat yang identik, jadi "0 ahead, 0 behind"
tetap muncul meski remote-nya salah. Hanya URL-nya yang membedakan.

Yang harus dilakukan lebih dulu:

  git remote set-url origin https://github.com/hendri01jkt-oss/Utangku
  git remote -v          # pastikan hasilnya sudah benar

Perbaikan itu hanya bertahan selama sesi ini. Perbaikan permanennya ada
di sisi pengguna: mengganti repo sumber sesi remote ini menjadi
hendri01jkt-oss/Utangku. Sampaikan itu ke pengguna.
=====================================================================
PESAN
