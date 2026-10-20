# Push project lokal ke GitHub

Repository tujuan: [evansswork/pvz-webgl](https://github.com/evansswork/pvz-webgl).

Saat panduan ini disiapkan, folder `/Users/nave/Downloads/pvz-webgl 2` belum memiliki `.git`, sedangkan repository tujuan sudah memiliki branch `main`. Gunakan clone agar commit berikutnya tersambung dengan riwayat repository tersebut.

## 1. Clone repository yang sudah ada

Jalankan di Terminal macOS atau terminal VS Code:

```bash
cd /Users/nave/Downloads
git clone https://github.com/evansswork/pvz-webgl.git pvz-webgl-upload
cd pvz-webgl-upload
```

`pvz-webgl-upload` adalah folder kerja Git baru. Jika nama itu sudah digunakan, pilih nama folder baru dan sesuaikan perintah `cd`. Folder sumber `pvz-webgl 2` tetap tersedia.

## 2. Salin versi project lokal

Masih dari folder `pvz-webgl-upload`, jalankan:

```bash
rsync -av --exclude='.git/' --exclude='.DS_Store' --exclude='._*' --exclude='.env' --exclude='.env.*' --exclude='node_modules/' --exclude='dist/' --exclude='.vscode/' --exclude='.idea/' "../pvz-webgl 2/" ./
```

Tanda kutip diperlukan karena nama folder sumber mengandung spasi. Perintah ini menyalin versi lokal, termasuk README, ke checkout hasil clone. File dengan path sama diperbarui; file lain yang hanya ada di repository tetap ada. Metadata `.git` hasil clone tetap digunakan.

## 3. Periksa dan jalankan project

```bash
git status --short
git diff --stat
git diff -- README.md
python3 -m http.server 8000
```

Buka http://localhost:8000/ dan periksa scene, kontrol `1`–`4`, gerakan daun/mata, serta perjalanan Zombie. Hentikan server dengan `Ctrl+C` setelah selesai. `git diff` menampilkan perubahan file yang sudah dilacak; file baru tercantum pada `git status`.

## 4. Commit dan push

```bash
git add README.md .gitignore docs index.html viewer.html src
git diff --cached --stat
git diff --cached --check
git commit -m "Perbarui project PvZ WebGL dan dokumentasi penilaian UTS"
git push origin main
```

Periksa daftar file yang akan di-commit sebelum menjalankan commit. Jika Git menampilkan `nothing to commit`, berarti tidak ada perubahan baru untuk disimpan.

Jika Git meminta identitas, isi identitas kamu untuk repository ini, lalu ulangi commit:

```bash
git config user.name "Nama Kamu"
git config user.email "email-yang-kamu-pakai-di-GitHub"
```

Jika push meminta autentikasi, gunakan akun yang memiliki akses tulis ke repository. Ikuti login GitHub melalui pengelola kredensial yang tersedia; jika menggunakan prompt HTTPS, gunakan personal access token sebagai pengganti password akun. Jangan menaruh token dalam source code atau README.

Jika push ditolak karena branch remote mendapat commit baru, jalankan dari checkout ini:

```bash
git pull --rebase origin main
```

Jika muncul konflik, periksa file yang ditandai `git status`, gabungkan perubahan yang diperlukan, jalankan `git add` untuk file yang diselesaikan, lalu `git rebase --continue`. Setelah rebase selesai, ulangi `git push origin main`. Gunakan `git rebase --abort` jika ingin kembali ke keadaan sebelum rebase untuk meninjau konflik terlebih dahulu.

## 5. Verifikasi di GitHub

Buka repository dan pastikan commit baru terlihat, README tampil, serta folder `src` berisi versi terbaru. Lengkapi identitas anggota, kelas lengkap, tautan laporan/video, dan gambar karakter yang masih ditandai di README sebelum pengumpulan.

Untuk pekerjaan berikutnya, buka folder `pvz-webgl-upload` di editor agar perubahan langsung tercatat Git. Alur berikutnya cukup periksa perubahan, `git add` file terkait, `git commit`, dan `git push`.
