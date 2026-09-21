# Lembar

Website portofolio karya tulis untuk mahasiswa dan penulis pemula. Situs statis (HTML/CSS/JS biasa, tanpa build step) yang bisa langsung di-hosting gratis lewat **GitHub Pages**, lengkap dengan halaman **admin** untuk mengelola konten.

## Cara Kerja Singkat

- **`index.html`** — situs publik. Membaca daftar karya dari `data/karya.json` dan profil penulis dari `data/penulis.json`.
- **`admin/index.html`** — panel admin (dikunci password) untuk tambah/edit/hapus karya & profil penulis. Karena situs ini statis (tidak ada server), panel admin menyimpan perubahan dengan cara **commit langsung ke repo GitHub-mu** lewat GitHub API.
- **"Kirim Karya"** di situs publik **tidak menyimpan otomatis** (situs statis tidak bisa menulis data tanpa admin). Tombol ini membuka email ke alamatmu berisi karya yang dikirim pengunjung; kamu lalu menambahkannya lewat panel admin setelah diperiksa.

---

## Langkah 1 — Unggah ke GitHub

1. Buat repository baru di GitHub, **Public** (perlu Public untuk GitHub Pages gratis), misalnya bernama `lembar`.
2. Unggah **semua isi folder ini** ke repo tersebut (lewat web GitHub "Add file → Upload files", atau `git push` kalau kamu terbiasa pakai Git).

## Langkah 2 — Aktifkan GitHub Pages

1. Di repo, buka **Settings → Pages**.
2. Pada **Source**, pilih **Deploy from a branch**.
3. Pilih branch `main` dan folder `/ (root)`, lalu **Save**.
4. Tunggu 1-2 menit. Situsmu akan tersedia di `https://<username>.github.io/<nama-repo>/`.

## Langkah 3 — Atur `config.js`

Buka file `config.js` di repo, klik ikon pensil (edit), lalu ganti:

- `adminEmail` → email kamu sendiri (untuk menerima kiriman karya dari pengunjung).
- `github.owner` → username GitHub kamu.
- `github.repo` → nama repo ini.
- `github.branch` → biasanya `main`.

Simpan (commit) perubahan.

## Langkah 4 — Buat Password Admin

1. Buka `https://<username>.github.io/<nama-repo>/admin/generate-password-hash.html`.
2. Ketik password yang kamu inginkan untuk admin. Halaman ini bekerja sepenuhnya di browser (tidak mengirim apa pun ke internet) dan langsung menampilkan **hash**-nya.
3. Salin hash tersebut, tempel ke `adminPasswordHash` di `config.js` (di antara tanda kutip), lalu commit.

**Simpan password aslinya baik-baik** — hanya kamu yang boleh tahu.

## Langkah 5 — Buat GitHub Personal Access Token

Token ini yang dipakai panel admin untuk menyimpan perubahan ke repo.

1. Buka **github.com → foto profil → Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. **Generate new token**.
3. **Repository access** → pilih **Only select repositories** → pilih repo `lembar` kamu saja (jangan beri akses ke semua repo).
4. **Permissions → Repository permissions → Contents** → set ke **Read and write**.
5. Klik **Generate token**, lalu **salin token-nya** (hanya muncul sekali!).

⚠️ **Token ini setara kunci ke repo-mu.** Jangan bagikan ke siapa pun, jangan tempel di tempat publik. Kalau merasa bocor, langsung hapus (revoke) dari halaman token GitHub dan buat yang baru.

## Langkah 6 — Masuk ke Panel Admin

1. Buka `https://<username>.github.io/<nama-repo>/admin/`.
2. Masukkan password yang kamu buat di Langkah 4.
3. Di layar **Koneksi GitHub**, isi Owner, Nama Repo, Branch (biasanya sudah terisi dari `config.js`), dan **tempel Personal Access Token** dari Langkah 5.
4. Klik **Simpan & Sambungkan**. Kalau berhasil, muncul tanda **Terhubung**.

Token ini hanya tersimpan di browser perangkatmu (localStorage) — tidak ikut ter-commit ke repo, dan tidak berlaku di perangkat lain kecuali kamu login & masukkan token lagi di sana.

## Memakai Panel Admin

- **Tab Karya** — tambah, edit, atau hapus karya. Setiap simpan = 1 commit baru ke `data/karya.json`.
- **Tab Penulis** — kelola bio & kontak tiap penulis. Profil otomatis dibuat saat kamu menambahkan karya dengan nama penulis baru.
- **Tab Pengaturan** — untuk mengganti repo/token, atau "Lupakan token" (logout dari sisi GitHub, tanpa mengubah password admin).
- **Kunci** (pojok kanan atas) — keluar dari panel admin di perangkat ini.

Setelah menyimpan, situs publik butuh **sekitar 30–60 detik** sampai GitHub Pages selesai memproses ulang sebelum perubahan terlihat (coba refresh halaman publiknya).

## Data Contoh

`data/karya.json` dan `data/penulis.json` sudah diisi 2 karya contoh berlabel `[Contoh]`. Hapus lewat panel admin begitu kamu mulai menambahkan karya asli, supaya pengunjung tidak melihat data contoh.

## Struktur Berkas

```
index.html                       halaman publik
style.css                        semua styling (situs publik + admin)
icons.js                         ikon & fungsi bantu bersama
config.js                        pengaturan (email, repo GitHub, hash password admin)
app.js                           logika situs publik
data/karya.json                  data karya (dibaca situs publik, ditulis panel admin)
data/penulis.json                data profil penulis
admin/index.html                 halaman panel admin
admin/admin.js                   logika panel admin (koneksi GitHub API)
admin/generate-password-hash.html  alat bantu offline membuat hash password
```

## Batasan yang Perlu Diketahui

- **Bukan sistem login yang aman secara penuh.** Password admin dicek di browser (client-side). Cukup untuk mencegah orang iseng, tapi orang yang cukup teknis berpotensi membaca kode sumber. Jangan pakai untuk data sensitif.
- **Token GitHub wajib dirahasiakan.** Siapa pun yang memegangnya bisa mengubah isi repo-mu.
- **Repo harus Public** supaya GitHub Pages gratis bisa jalan — artinya isi `data/karya.json` & `data/penulis.json` bisa dilihat siapa saja yang tahu caranya (ini memang isi yang sama dengan yang tampil di situs, jadi tidak masalah).
- Kalau nanti butuh fitur "pengguna publik unggah karya langsung tersimpan otomatis" tanpa lewat email + admin, itu perlu backend sungguhan (misalnya Firebase) — bisa diminta dibangunkan kapan saja.
