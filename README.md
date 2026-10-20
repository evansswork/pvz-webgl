# Plants vs. Zombies — Proyek UTS Grafika Komputer

Rekonstruksi adegan 3D bertema **Plants vs. Zombies** menggunakan JavaScript dan WebGL langsung, tanpa Three.js. **Sunflower, Peashooter, dan Zombie** berada dalam satu environment yang menghubungkan kuburan, jalan raya, serta rumah dan pekarangan. Model dibuat secara prosedural melalui geometri parametrik, kurva Bézier, dan mesh segitiga.

Repository: [evansswork/pvz-webgl](https://github.com/evansswork/pvz-webgl).

README ini menjelaskan implementasi dan demonstrasi sesuai rubrik UTS. Pemetaan berikut merupakan bukti di kode; nilai akhir ditentukan dosen berdasarkan hasil visual, demonstrasi, dan kelengkapan pengumpulan.

## Identitas dan tautan pengumpulan

Lengkapi bagian **belum diisi** sebelum dikumpulkan. Pembagian karakter di tabel merupakan tempat pengisian tanggung jawab anggota, bukan atribusi yang sudah dikonfirmasi.

| Data | Isi |
|---|---|
| Mata kuliah | Grafika Komputer — UTS |
| Kelas lengkap | **A1**, gunakan format lengkap, misalnya A1 |
| Kelompok | **3** |
| Anggota pembuat Sunflower | **C14210281 Giulian Suryadinata** |
| Anggota pembuat Peashooter | **C14240079 Evan Suryadinata** |
| Anggota pembuat Zombie | **C14240154 Nataniel Joshe** |
| Kontribusi environment dan integrasi | **C14240154 Nataniel Joshe & C14240079 Evan Suryadinata S** |
| Video trailer YouTube, sekitar 1–2 menit | **Belum diisi** |
| Dokumen laporan/penjelasan | **C14210281,C14240079,C14240154** |

## Menjalankan project

Kebutuhan: Python 3 untuk server lokal dan browser yang mendukung **WebGL 2** untuk scene gabungan. Project tidak membutuhkan instalasi npm atau proses build. Viewer tanaman dan halaman Zombie membuat konteks WebGL sendiri.

Untuk mengambil project dari GitHub:

```bash
git clone https://github.com/evansswork/pvz-webgl.git
cd pvz-webgl
```

Dari folder project yang berisi `index.html`, jalankan:

```bash
python3 -m http.server 8000
```

| Halaman | Alamat |
|---|---|
| Scene gabungan, tiga karakter dan environment | http://localhost:8000/ |
| Viewer Sunflower | http://localhost:8000/viewer.html?c=sunflower |
| Viewer Peashooter | http://localhost:8000/viewer.html?c=peashooter |
| Viewer Zombie | http://localhost:8000/src/characters/zombie/zombie.html |

File menggunakan ES modules, sehingga perlu dibuka melalui server HTTP. Jika halaman tidak tampil, periksa Console browser, dukungan WebGL, dan folder tempat server dijalankan. Hentikan server dengan `Ctrl+C`. Font judul scene utama dimuat dari Google Fonts dan memiliki font pengganti jika koneksi tidak tersedia.

## Konsep adegan dan alur cerita

Pada malam hari, Sunflower dan Peashooter berjaga di halaman rumah. Zombie muncul di jalan setapak kuburan, keluar melalui gerbang, menyeberangi jalan raya, lalu masuk ke halaman menuju jalur Peashooter. Sunflower menghasilkan Sun, sementara Peashooter menembakkan kacang untuk mempertahankan rumah.

Perjalanan Zombie berjalan otomatis dan dapat diulang dengan `J`. Zombie berhenti di depan Peashooter. Kacang pecah menjadi percikan ketika memasuki pendekatan volume badan Zombie. Interaksi ini merupakan demonstrasi animasi; kode tidak menerapkan sistem HP, kemenangan, atau kekalahan.

## Kontrol

### Scene gabungan

| Input | Fungsi |
|---|---|
| `W A S D` atau tombol panah | Kamera maju, mundur, dan bergeser |
| `Space` / `E` | Kamera naik |
| `Q` / `C` | Kamera turun |
| Tahan `Shift` | Gerak kamera lebih cepat |
| Tahan `Z` | Gerak kamera lebih pelan untuk mengambil detail |
| Drag mouse | Mengubah arah pandang |
| Scroll | Dorongan kamera maju/mundur |
| `P` | Mengaktifkan/menonaktifkan orbit otomatis kamera di sekitar tanaman |
| `V` | Berpindah di antara preset kamera |
| `1` | Sunflower mengeluarkan Sun; wajah bergeser mundur lalu maju |
| `2` | Kepala Sunflower bergoyang kiri-kanan |
| `3` | Peashooter menembak; kepala bergerak dan kacang melesat |
| `4` | Kepala Peashooter menoleh kiri-kanan |
| `J` | Mengulang perjalanan Zombie dari kuburan |
| `X` | Menampilkan/menyembunyikan penanda sumbu rotasi daun tanaman |

Scaling mata dan gerakan daun tanaman berjalan otomatis. Mendekatlah agar gerak kecil ini terlihat. Penanda `X` membantu menunjukkan posisi dan arah sumbu daun.

### Viewer karakter

Pada **viewer tanaman**, `1` memicu aksi utama, `2` memutar kepala, `G` menumbuhkan ulang karakter, `T` memainkan trailer karakter, `X` mengubah tampilan penanda sumbu, `B` mengganti latar studio, `H` menyembunyikan HUD, dan `R` mengembalikan kamera. Drag untuk orbit dan scroll untuk zoom. Pada viewer Peashooter, tombol tembak adalah `1`; pada scene gabungan tombolnya `3`.

Pada **viewer Zombie**, drag untuk orbit dan scroll untuk zoom. `E` memisahkan/menggabungkan bagian, `C` mengganti mode warna, `A` mengaktifkan/menonaktifkan animasi, dan `S` mengaktifkan/menonaktifkan bayangan.

## Pemetaan rubrik penilaian

Rubrik pada lembar penilaian memuat sepuluh komponen, masing-masing berbobot 10, dengan total 100.

| Kriteria | Bobot | Implementasi dan bukti | Cara menunjukkan |
|---|---:|---|---|
| 3D Curve, harus pada karakter | 10 | Daun dan tulang daun tanaman menggunakan Bézier; batang Peashooter berupa tube Bézier 3D; rambut dan rahang Zombie mengikuti Bézier. [Geometri tanaman](src/core/geometry.js), [model Peashooter](src/characters/peashooter/model.js), [model Zombie](src/characters/zombie/zombieScene.js). | Ambil detail batang, daun, rambut, dan rahang dari samping serta depan. |
| Object 1 | 10 | Ellipsoid untuk wajah Sunflower, kepala Peashooter, serta kepala dan sendi Zombie. [Sunflower](src/characters/sunflower/model.js), [Peashooter](src/characters/peashooter/model.js), [Zombie](src/characters/zombie/zombieScene.js). | Tunjukkan volume kepala dari beberapa sudut. |
| Object 2 | 10 | Cylinder pada batang Sunflower, penghubung batang–kepala Peashooter, serta leher, betis, dan ruas jari Zombie. Sumber model sama seperti baris Object 1. | Perlihatkan batang, penghubung kepala, dan anggota tubuh Zombie. |
| Object 3, wajib quadric selain ellipsoid dan cylinder | 10 | **Elliptic paraboloid** pada kelopak Sunflower; **cone terpotong** pada moncong Peashooter dan lengan jas Zombie. [Geometri tanaman](src/core/geometry.js), [geometri Zombie](src/characters/zombie/geometry.js). | Sorot kelopak dan moncong dari samping, serta bentuk lengan jas. |
| Aesthetic: environment dan objek smooth saat transformasi | 10 | Kuburan, jalan, rumah, pencahayaan malam, toon shading tanaman, outline, bayangan planar tanaman, easing animasi, dan kamera dengan damping. [Environment](src/env/), [lighting](src/lighting.js), [renderer](src/core/renderer.js), [kamera](src/drone.js). | Rekam panorama dan transisi gerakan karakter/kamera. Kualitas visual dinilai dari hasil render. |
| Translate | 10 | Wajah Sunflower dan Sun berpindah; kepala Peashooter dan peluru bergeser; Zombie berjalan di lintasan. [Animasi Sunflower](src/characters/sunflower/animation.js), [Peashooter](src/characters/peashooter/index.js), [scene utama](src/main.js). | Tekan `1`, `3`, lalu `J` di scene utama. |
| Rotate | 10 | Rotasi Z pada leher Sunflower, rotasi Y pada leher Peashooter, rotasi sendi dan arah hadap Zombie. [Animasi Sunflower](src/characters/sunflower/animation.js), [animasi Peashooter](src/characters/peashooter/animation.js), [Zombie](src/characters/zombie/zombieScene.js). | Tekan `2`, `4`, dan rekam gerakan Zombie. |
| Scaling | 10 | Mata Sunflower menyusut saat berkedip; mata Peashooter membesar lalu berkedip; badan Zombie berdenyut dan matanya berkedip. Sumber: kedua file animasi tanaman dan `zombieScene.js`. | Rekam detail mata beberapa detik; `G` di viewer tanaman juga menunjukkan pertumbuhan. |
| Rotate Arbitrary Axis | 10 | Daun Sunflower dan daun belakang kepala Peashooter berputar terhadap engsel miring melalui `M4.rotateArbitraryAxis`. [Matematika](src/core/math.js), kedua file animasi tanaman. | Tekan `X` dan sorot daun saat bergerak otomatis. Catatan khusus Zombie dijelaskan di bawah. |
| Hierarchical Transformation | 10 | Scene graph tanaman menggunakan `world = parent.world × local`; Zombie memakai hierarki `BoneNode`. [Node tanaman](src/core/renderer.js), [BoneNode Zombie](src/characters/zombie/ZombieNode.js), [penempatan karakter](src/cast.js). | Putar kepala tanaman: mata, mulut, kelopak/moncong ikut bergerak. Rekam bahu–siku dan pinggul–lutut Zombie. |
| **Total bobot** | **100** | | |

Sphere dan ellipsoid dihitung sebagai jenis yang sama sesuai catatan rubrik. Torus adalah permukaan berderajat empat, sehingga tidak digunakan sebagai bukti Object 3 yang wajib quadric. Bukti Object 3 menggunakan paraboloid atau cone.

## Pemodelan tiap karakter

### Sunflower

Implementasi: [model](src/characters/sunflower/model.js), [animasi](src/characters/sunflower/animation.js), [aksi dan efek Sun](src/characters/sunflower/index.js).

| Bagian | Bentuk/metode |
|---|---|
| Wajah, mata, kilau mata, dan sambungan | Ellipsoid dengan ukuran berbeda |
| Batang | Dua segmen cylinder |
| 16 kelopak, dua lapis masing-masing delapan | Lensa dari dua permukaan elliptic paraboloid |
| Empat daun | Permukaan bertebal dari dua batas kurva Bézier kubik 3D |
| Tulang daun | Tube mengikuti garis tengah daun |
| Mulut | Tube mengikuti sampel Bézier yang dipetakan ke permukaan wajah |

Kelopak memakai bentuk `z = c − k(x²/a² + y²/b²)`, bukan ellipsoid pipih. Perubahan ukuran, orientasi, dan penempatan paraboloid menghasilkan susunan kelopak melingkar.

Saat `1` ditekan di scene utama, wajah bergeser mundur lalu maju dan Sun muncul, melayang, kemudian turun ke rumput. Tombol `2` memutar leher terhadap Z, sehingga wajah, mata, mulut, dan kelopak ikut bergoyang. Empat daun bergerak otomatis terhadap engsel miring, sementara mata berkedip melalui scaling tinggi hingga sekitar 0,1 kali ukuran awal.

### Peashooter

Implementasi: [model](src/characters/peashooter/model.js), [animasi](src/characters/peashooter/animation.js), [peluru dan percikan](src/characters/peashooter/index.js).

| Bagian | Bentuk/metode |
|---|---|
| Kepala, mata, kilau mata | Ellipsoid |
| Penghubung batang–kepala | Cylinder pendek |
| Moncong luar dan dalam | Cone terpotong dengan radius yang berubah sepanjang sumbu |
| Dasar lubang moncong | Disc gelap |
| Bibir moncong | Torus |
| Batang melengkung | Dua segmen tube mengikuti kurva Bézier kubik 3D |
| Empat daun dan daun belakang kepala | Permukaan dari batas Bézier dan tube tulang daun |
| Peluru dan percikan | Ellipsoid; objek efek tambahan |

Cone terpotong mengikuti `x² + z² = [r0 + (r1 − r0)y/h]²`. Dinding bagian dalam dan dasar gelap memberi kedalaman pada lubang moncong. Batang Bézier memiliki dua segmen agar geraknya dapat diwariskan melalui hierarki.

Saat `3` ditekan di scene utama, kepala melakukan ancang-ancang dan recoil, lalu kacang bergerak dengan `posisi += kecepatan × dt`. Tombol `4` memutar leher terhadap Y. Daun belakang kepala mengepak otomatis terhadap engsel miring. Mata membesar hingga sekitar 1,45 kali ukuran awal, kemudian menutup dan membuka dalam siklus sekitar lima detik.

### Zombie

Implementasi gabungan: [zombieScene.js](src/characters/zombie/zombieScene.js), [geometri](src/characters/zombie/geometry.js), [hierarki tulang](src/characters/zombie/ZombieNode.js). Viewer mandiri menggunakan [main.js Zombie](src/characters/zombie/main.js).

| Bagian | Bentuk/metode |
|---|---|
| Kepala, mata, sendi, telapak tangan, dan sepatu | Ellipsoid, sebagian dengan deformasi prosedural |
| Leher, betis, dan ruas jari | Cylinder |
| Lengan jas dan potongan celana | Cone terpotong, sebagian dengan deformasi lipatan |
| Gigi, sol sepatu, kantong jas, dan gesper | Box |
| Jas, kerah, dasi, dan tepi sobekan | Mesh segitiga prosedural |
| Rambut dan struktur lengkung rahang | Tube mengikuti kurva Bézier 3D |

Scene utama menerapkan matriks `T(posisi) × Ry(arah hadap) × S(55)` untuk membawa Zombie ke dunia gabungan. Animasi tubuh meliputi napas, kepala menoleh, mata berkedip, rahang bergerak, serta ayunan tangan dan kaki. Zombie muncul dalam keadaan berdiri (`riseProgress = 1`), kemudian berjalan mengikuti `ZOMBIE_PATH` di `src/main.js`.

**Catatan Rotate Arbitrary Axis pada Zombie:** fungsi `axisRot` menerima sumbu umum, tetapi animasi rahang dalam `zombieScene.js` saat ini memasukkan `jawAxis = [1, 0, 0]`. Gerak rahang tersebut merupakan rotasi terhadap garis melalui pivot yang sejajar X. Bukti animasi dengan sumbu miring pada project ini berasal dari daun Sunflower dan Peashooter. Jika kriteria sumbu miring diwajibkan untuk setiap karakter, animasi Zombie perlu disesuaikan dan didemonstrasikan sebelum diklaim memenuhi bagian tersebut.

Dokumen tambahan: [daftar bentuk Zombie](src/characters/zombie/daftar_bentuk.md) dan [struktur modul asal](src/characters/zombie/struktur_file.md). Keduanya masih memuat beberapa path dari project asal; tautan pada README ini mengikuti struktur project sekarang.

## Penjelasan transformasi

### Translate, rotate, dan scaling

[src/core/math.js](src/core/math.js) menyediakan `M4.translation`, `M4.rotationX/Y/Z`, dan `M4.scaling`. Pada node tanaman, matriks lokal disusun sebagai:

```text
local = pre × T(position) × Ry × Rx × Rz × S(scale)
```

Matriks paling kanan diterapkan terlebih dahulu pada vektor kolom. Translasi mengubah posisi, rotasi mengubah orientasi, dan scaling mengubah ukuran. Scaling tidak seragam memungkinkan tinggi mata menyusut saat berkedip tanpa menyusutkan lebarnya.

### Rotasi terhadap arbitrary axis

`M4.rotateArbitraryAxis(P, u, θ)` memutar objek terhadap garis melalui titik `P`, berarah `u`. Implementasi menyusun tujuh transformasi:

```text
M = T(P) × Rx(−α) × Ry(−β) × Rz(θ) × Ry(β) × Rx(α) × T(−P)
```

Objek digeser agar garis sumbu melewati origin, sumbu disejajarkan dengan Z, rotasi dilakukan, kemudian penyelarasan dan pergeseran dikembalikan. Pada daun Sunflower, arah engsel berasal dari cross product arah atas dengan arah daun, ditambah komponen ke atas sehingga sumbunya miring. Peashooter menghitung engsel dari arah daun belakang kepala dan normal kepala.

### Hierarchical transformation

Transformasi anak diwarisi dari induknya:

```text
world_anak = world_induk × local_anak
model_di_scene = stage × world_node
stage = T(petak_rumput) × Ry(arah_hadap) × S(skala_karakter)
```

Contoh rantai utama tanaman:

```text
Sunflower:  root → body → stemLower → stemUpper → neck → face → mata/mulut/kelopak
Peashooter: root → body → stemLower → stemUpper → neck → head → mata/moncong/daun kepala
```

Ketika leher berputar, bagian kepala dan seluruh turunannya mengikuti tanpa mengatur posisi tiap bagian secara terpisah. Zombie menggunakan prinsip sama melalui `BoneNode`, misalnya lengan atas → lengan bawah serta kaki atas → kaki bawah.

## Environment, pencahayaan, dan kehalusan animasi

Environment dibagi menjadi kuburan dengan gerbang, nisan, pohon, dan terrain; jalan raya penghubung; serta rumah dua lantai dan pekarangan rumput. Ketiga karakter dirender dalam scene gabungan yang sama.

[src/lighting.js](src/lighting.js) menyediakan data pencahayaan malam untuk rumah, jalan, dan renderer tanaman: arah bulan, warna ambient, fog, lampu teras, cahaya jendela, serta parameter tone mapping. Kuburan dan Zombie juga memiliki shader masing-masing. Tanaman menggunakan toon shading, outline, rim light, dan bayangan planar di halaman.

Animasi memakai selisih waktu antar-frame (`dt`), fungsi sinus, dan easing untuk memperhalus perubahan pose. Kamera drone memakai damping pada gerakan dan arah pandang. Kecepatan frame tetap bergantung pada perangkat dan browser.

## Panduan demonstrasi dan video trailer

Untuk memeriksa rubrik saat presentasi, tampilkan scene gabungan, tekan `1`–`4`, lalu ambil detail mata dan daun yang bergerak otomatis. Gunakan `X` untuk membantu menjelaskan sumbu daun dan `J` untuk mengulang perjalanan Zombie. Viewer karakter dapat dipakai untuk memperlihatkan bentuk dari beberapa sudut.

Video pengumpulan mengikuti catatan rubrik: **berbentuk promosi/trailer dengan storyline, sekitar 1–2 menit**. Penjelasan teknis dapat ditempatkan dalam laporan dan presentasi. Berikut usulan pengambilan gambar sekitar 90 detik; waktunya merupakan rencana, bukan timestamp video yang sudah dibuat.

| Rentang rencana | Adegan | Fitur yang perlu terlihat |
|---|---|---|
| 00:00–00:12 | Panorama malam dari kuburan menuju rumah | Environment dan suasana |
| 00:12–00:27 | Zombie keluar dari kuburan dan menyeberang jalan | Translate, rotate, hierarki tangan/kaki |
| 00:27–00:43 | Detail Sunflower, menghasilkan Sun lalu bergoyang | Paraboloid kelopak, kurva daun, translate, rotate, scaling mata, gerak engsel daun |
| 00:43–01:00 | Detail Peashooter menoleh dan bersiap | Batang Bézier, cone moncong, scaling mata, gerak daun kepala |
| 01:00–01:18 | Peashooter menembak Zombie | Translate peluru, recoil, percikan, transformasi hierarki |
| 01:18–01:30 | Tampilan bersama di halaman dan judul penutup | Tiga karakter dalam satu environment dan penyelesaian alur trailer |

Orbit otomatis `P` membantu pengambilan gambar tanaman. Trailer bawaan `T` di viewer tanaman berdurasi 20 detik per karakter dan dapat menjadi bahan cuplikan. Video pengumpulan tetap perlu menampilkan alur gabungan dan seluruh fitur yang diminta. Jika ingin menyertakan nama anggota dalam video, tempatkan pada credits sesuai catatan rubrik.

## Checklist sebelum dikumpulkan

- [ ] Isi nama, NRP/NIM, kelas lengkap, kelompok, dan pembagian satu karakter per anggota.
- [ ] Konfirmasi pilihan Plants vs. Zombies tidak sama dengan kelompok lain sesuai aturan kelas.
- [ ] Periksa kemiripan ketiga karakter dan environment terhadap referensi game.
- [ ] Uji semua transformasi di browser dan pastikan fitur yang dinilai terlihat jelas.
- [ ] Konfirmasi ketentuan arbitrary axis per karakter; tindak lanjuti catatan Zombie bila diperlukan.
- [ ] Siapkan minimal dua gambar setiap karakter dari perspektif berbeda di dokumen penjelasan, total minimal enam gambar.
- [ ] Siapkan video promosi/trailer sekitar 1–2 menit dengan storyline dan semua fitur yang diminta.
- [ ] Isi tautan YouTube dan laporan pada bagian identitas serta dokumen pengumpulan kelas.
- [ ] Push source code dan README, lalu periksa isi repository GitHub.
- [ ] Kumpulkan link GitHub, code files, link YouTube, dan laporan sebelum presentasi.
- [ ] Isi timestamp pada dokumen kelas setelah pengisian dokumen selesai, sesuai instruksi lembar penilaian.

## Struktur project

```text
index.html                    Scene gabungan
viewer.html                   Viewer Sunflower/Peashooter
README.md                     Penjelasan project dan rubrik
docs/PUSH_KE_GITHUB.md         Panduan upload ke repository yang sudah ada
src/
  main.js                     Integrasi scene, lintasan Zombie, kontrol, render loop
  drone.js                    Kamera bebas, preset, dan orbit otomatis
  lighting.js                 Data dan fungsi pencahayaan malam
  cast.js                     Transformasi penempatan tanaman di environment
  viewer.js                   Pemilihan karakter untuk viewer
  core/
    math.js                   Operasi vektor/matriks, arbitrary axis, easing
    geometry.js               Generator geometri, kurva Bézier, tube, daun
    renderer.js               Shader tanaman, scene graph, outline, bayangan
    animator.js               Pengatur aksi animasi
    app.js, hud.css           Kamera dan antarmuka viewer tanaman
    lawn.js, sun.js           Environment viewer dan efek Sun
  characters/
    sunflower/                Model, animasi, dan spesifikasi Sunflower
    peashooter/                Model, animasi, spesifikasi, dan efek tembakan
    zombie/                   Model, geometri, tulang, shader, dan viewer Zombie
  env/
    graveyard/                Kuburan dan objek pendukung
    road/                     Jalan raya
    house/                    Rumah dan pekarangan
    core/transform.js         Operasi matriks environment
```

## Upload ke GitHub

Folder hasil salinan/ekstraksi dapat tidak memiliki metadata Git. Karena repository tujuan sudah memiliki riwayat pada branch `main`, ikuti [panduan push ke GitHub](docs/PUSH_KE_GITHUB.md) untuk clone repository, menyalin versi lokal, memeriksa perubahan, lalu commit dan push.
