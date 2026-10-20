# Daftar Lengkap Bentuk Geometri Karakter Zombie

Dokumen ini merangkum seluruh pemodelan geometri 3D pada karakter Zombie yang diimplementasikan dalam [`gabungan/zombie/main.js`](file:///D:/Users/Natan/3-university/PCU/1-academic/Subject/semester-5/grafkom/tugas/gabungan/zombie/main.js) dan [`gabungan/zombie/zombieScene.js`](file:///D:/Users/Natan/3-university/PCU/1-academic/Subject/semester-5/grafkom/tugas/gabungan/zombie/zombieScene.js).

---

## I. Klasifikasi Geometri Grafika Komputer

| Kategori | Bentuk / Metode | Bagian Karakter |
| :--- | :--- | :--- |
| **Quadric (3 Jenis)** | **Ellipsoid** | Kepala (*textured*), bola mata, pupil, lubang hidung, kerutan dahi, bibir atas & bawah (*curved*), rongga mulut, lidah, otot dagu, kancing jas, lipatan lengan jas, sabuk, pinggul celana, sendi bahu, sendi siku, telapak tangan, sendi jari (*knuckle*), ujung jari, kuku, sendi pinggul, sendi lutut, sepatu, dan piringan alas (*disc*). |
| | **Cylinder** | Leher, betis kaki, ruas-ruas jari, dan urat-urat mata (*bloodshot veins*). |
| | **Cone / Truncated Cone** | Lengan jas atas, lengan jas bawah, potongan paha celana, dan potongan celana melorot kaki kanan. |
| **Objek Lain** | **Box** | Sol sepatu, kepala gesper sabuk, saku/kantong jas, motif garis-garis dasi, dan gigi. |
| | **Mesh Segitiga** | Jas compang-camping (`jacket`), kerah jas (`prism`), simpul & badan dasi (`prism`), serta tepi sobekan celana bergerigi (`ragged`). |
| **Kurva 3D** | **Kurva Bézier 3D (Tube)** | Helai rambut (5 helai dengan ayunan animasi) dan struktur lengkung rahang bawah (mandibula huruf-U). |

---

## II. Rincian Lengkap Bagian Anatomi & Geometri

### 1. Kepala & Wajah
* **Kepala**: *Ellipsoid* besar dengan deformasi vertex noise (`texturedEllipsoid`) untuk menghasilkan kontur tengkorak zombie yang penyok, asimetris, dan berpori-pori. Posisinya condong maju ke depan mengikuti postur membungkuk.
* **Mata**:
  * **Bola Mata Kanan**: *Ellipsoid* besar (radius 0.105 × 0.105 × 0.09).
  * **Bola Mata Kiri**: *Ellipsoid* lebih kecil (radius 0.08 × 0.08 × 0.07).
  * **Pupil Kanan & Kiri**: *Ellipsoid* kecil berwarna hitam.
  * **Urat Mata (*Bloodshot Veins*)**: Puluhan *cylinder* sangat tipis berwarna merah darah (35 cabang di mata kanan, 25 cabang di mata kiri) yang menyusuri permukaan bola mata.
* **Hidung**: 2 *Ellipsoid* kecil pipih miring sebagai lubang hidung kiri dan kanan.
* **Kerutan Dahi**: 2 baris *ellipsoid* tipis melintang horizontal yang dimiringkan mengikuti profil dahi zombie.
* **Rahang Bawah (Mandibula)**:
  * **Tulang Lengkung Rahang**: *Mesh tube* yang disapu mengikuti **Kurva Bézier 3D** (4 titik kontrol) membentuk lengkung huruf-U yang rapi dan menyambung ke engsel telinga.
  * **Otot Bawah Dagu**: *Ellipsoid* penyambung antara dasar rahang dan leher (*submental area*).
* **Mulut & Bibir**:
  * **Bibir Atas**: *Curved ellipsoid* melengkung ke bawah menonjol dari wajah.
  * **Bibir Bawah**: *Curved ellipsoid* melengkung ke atas yang menempel pada tulang rahang.
  * **Rongga Mulut**: *Ellipsoid* merah tua di bagian dalam kepala.
  * **Lidah**: *Ellipsoid* pipih merah muda yang terletak di dalam rahang.
* **Gigi**: **6 buah Box kecil** bertaring tidak rata (*snaggletooth*) dengan rotasi Z dan ukuran acak:
  * 2 gigi atas (menempel pada kepala).
  * 4 gigi bawah (menempel pada rahang dan ikut bergerak saat animasi mulut).
* **Rambut**: **5 helai aktif** *mesh tube* tipis yang disapu mengikuti **Kurva Bézier 3D** di atas ubun-ubun kepala (masing-masing bergerak melambai dengan beda fase).

---

### 2. Leher & Badan
* **Leher**: *Cylinder* pendek miring menghubungkan punggung atas ke kepala.
* **Badan (Kemeja/Shirt)**: *Ellipsoid* memanjang condong ke depan (posisi bungkuk).
* **Jas (Coat)**:
  * **Badan Jas**: *Mesh segitiga* kustom (`jacket`) yang mengikuti lekukan tubuh elips, terbuka di bagian dada/perut dan memiliki ujung compang-camping di bawah.
  * **Kerah Jas**: *Mesh segitiga prism* untuk kerah kiri dan kerah kanan.
  * **Kantong Jas**: 2 buah *box* tipis di kiri dan kanan jas.
  * **Kancing Jas**: 3 buah *ellipsoid* kecil hitam vertikal di sisi bukaan jas.
* **Dasi (Tie)**:
  * **Simpul Dasi**: *Mesh segitiga prism* 5 titik sudut.
  * **Badan Dasi**: *Mesh segitiga prism* 6 titik sudut yang menjuntai di atas dada.
  * **Motif Dasi**: 4 buah *box* putih tipis melintang secara berjarak sebagai garis motif dasi.
* **Sabuk & Gesper**:
  * **Tali Sabuk**: *Ellipsoid* melingkar berwarna kulit gelap di pinggang.
  * **Gesper (*Buckle*)**: *Box* perak/abu-abu di bagian tengah depan sabuk.
* **Pinggul Celana**: *Ellipsoid* bertekstur kerutan kain (`texturedEllipsoid`) sebagai pangkal paha celana.

---

### 3. Lengan & Tangan (Kiri & Kanan)
* **Sendi Bahu**: *Ellipsoid* sebagai sendi bola penyambung lengan ke badan.
* **Lengan Jas Atas**: *Cone* terpotong (*truncated cone / frustum*) mengecil dari bahu ke siku.
* **Sendi Siku**: *Ellipsoid* sebagai engsel siku.
* **Lengan Jas Bawah**: *Cone* terpotong (*truncated cone / frustum*) mengecil dari siku ke pergelangan tangan.
* **Lipatan Kain Jas**: 3 cincin *ellipsoid* melingkar (2 di lengan atas, 1 di lengan bawah) untuk memberi volume kerutan lengan.
* **Telapak Tangan**: *Ellipsoid* warna kulit zombie di ujung jas.
* **Jari-Jari Tangan (5 Jari: Jempol, Telunjuk, Tengah, Manis, Kelingking)**:
  * **Ruas Atas**: *Cylinder*.
  * **Sendi Tengah (*Knuckle*)**: *Ellipsoid*.
  * **Ruas Bawah**: *Cylinder* mengecil.
  * **Ujung Jari**: *Ellipsoid*.
  * **Kuku Jari**: *Ellipsoid* tipis berwarna krem gading di setiap ujung jari.

---

### 4. Kaki & Sepatu (Kiri & Kanan)
* **Sendi Pinggul**: *Ellipsoid* sendi di pangkal paha.
* **Paha Celana**: *Cone* terpotong dengan deformasi gelombang noise lipatan kain (`pantsTexture`).
* **Sobekan Tepi Celana Paha**: *Mesh segitiga* bergerigi (`ragged`) melingkar di ujung sobekan paha.
* **Potongan Celana Melorot (Kaki Kanan)**:
  * Satu potongan kain *cone* bertekstur terpisah yang melorot di atas pergelangan kaki kanan.
  * 2 *mesh segitiga* bergerigi (`ragged`) di tepi atas dan bawah potongan kain tersebut.
* **Sendi Lutut**: *Ellipsoid* pada persendian lutut.
* **Betis / Kaki Bawah**: *Cylinder* warna kulit hijau pucat zombie.
* **Sepatu**: *Ellipsoid* memanjang berwarna cokelat tua.
* **Sol Sepatu**: *Box* tipis memanjang di bagian dasar sepatu berwarna gelap.

---

### 5. Objek Panggung (Environment)
* **Piringan Panggung (*Disc Platform*)**: *Ellipsoid* pipih melingkar berdiameter besar di dasar lantai sebagai pijakan tempat zombie berdiri.