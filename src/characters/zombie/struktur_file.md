# Dokumentasi Struktur dan Fungsi File: Graveyard & Zombie

Dokumen ini menjelaskan fungsi, peran, dan arsitektur teknis dari file-file utama pada modul lingkungan (*Graveyard*) dan karakter (*Zombie*) dalam proyek Grafika Komputer berbasis WebGL2.

---

## 1. `gabungan/graveyard/geometry.js`
**Peran Utama:** Generator mesh geometri dasar (*unit mesh*) dan bentuk prosedural untuk seluruh objek lingkungan di scene Graveyard (kuburan).

### Fungsi & Komponen Kunci:
- **`KINDS` & `hx(h)`:**
  - `KINDS`: Daftar metadata bentuk primitif (nama dan kode warna representasi proksi: Balok, Silinder, Kerucut, Torus, Ellipsoid, Plane, dan Proksi Organik).
  - `hx(h)`: Helper untuk mengonversi kode warna heksadesimal (misal `#8c8c8c`) menjadi array nilai RGB ter-normalisasi $[0.0, 1.0]$.
- **`unitMeshes()`:**
  - Membangun seluruh bentuk geometri 3D dasar dengan ukuran unit (berada pada rentang $[-1, 1]$).
  - Seluruh koordinat vertex disatukan ke dalam satu array `Float32Array` besar (`UM.arr`) untuk efisiensi pengiriman buffer ke GPU.
  - Menghasilkan daftar `ranges` yang mencatat offset titik awal dan jumlah vertex untuk setiap bentuk:
    1. **Balok / Box (indeks 0):** 6 sisi kubus (12 segitiga).
    2. **Silinder (indeks 1):** Tabung bersisi 20 segmen dengan tutup atas dan bawah.
    3. **Kerucut (indeks 2):** Kerucut alas lingkaran 20 segmen dengan puncak runcing.
    4. **Torus (indeks 3):** Cincin donat parametrik untuk detail salib/ornamen makam.
    5. **Ellipsoid (indeks 4):** Bentuk lonjong/bola parametrik berbasis koordinat bola.
    6. **Frustum (indeks 5):** Silinder meruncing (rasio atas 0.75) untuk dahan dan batang pohon.
    7. **Ellipsoid Bergelombang (indeks 6):** Daun/rimbunan pohon yang dideformasi dengan fungsi sinus dan kosinus guna menghasilkan kontur tidak rata secara organik.
- **`buildStoneTriangles({ half, radius, steps })` & `STONE_RANGE`:**
  - Generator prosedural untuk batu jalan setapak (*stepping stones*) dengan sudut membulat (*fillet/chamfer*).
  - Mengambil titik-titik kisi kubus $8 \times 8 \times 8$, membulatkan sudutnya ke bidang bola kecil (`roundPoint`), lalu menggabungkannya ke buffer utama `UM` pada rentang indeks `STONE_RANGE`.
- **`roundedBoxTriangles(tri, center, half, radius)`:**
  - Helper pembangun balok bersudut membulat pada posisi dan dimensi tertentu.

---

## 2. `gabungan/graveyard/libs.js`
**Peran Utama:** Library matematika aljabar linier (matriks 4×4 dan vektor) serta fungsi *procedural noise* untuk kontur tanah makam.

### Fungsi & Komponen Kunci:
- **Objek `M4` (Matriks 4×4 - Format Kolom-Utama / Column-Major):**
  - `M4.mul(a, b)`: Perkalian matriks $4 \times 4$ untuk menggabungkan transformasi Model, View, dan Projection.
  - `M4.persp(f, a, n, z)`: Menghasilkan matriks proyeksi perspektif berdasarkan Field of View ($f$), aspek rasio ($a$), *near plane* ($n$), dan *far plane* ($z$).
  - `M4.look(e, c, u)`: Menghasilkan matriks pandangan kamera (*View Matrix / LookAt*) dari posisi mata (`eye`), target (`center`), dan vektor atas (`up`).
  - `M4.inv(a)`: Menghitung invers matriks $4 \times 4$ menggunakan determinan dan kofaktor. Fungsi ini esensial untuk *unprojecting* koordinat mouse 2D ke sinar 3D (*raycasting*).
  - `M4.xf(m, v)`: Transformasi titik (Point Transformation) 3D dengan pembagian koordinat homogen $w$.
  - `M4.xd(m, v)`: Transformasi arah vektor 3D tanpa translasi.
- **Procedural Noise & Interpolasi:**
  - `hash2(x, y)`: Pembangkit nilai pseudorandom deterministik berbasis fungsi sinus.
  - `valueNoise(x, y)`: Noise bernilai 2D yang dihaluskan dengan kurva Hermite (smoothstep).
  - `fbm(x, y)`: *Fractal Brownian Motion* (3 oktaf noise) untuk menghasilkan elevasi tanah makam yang bergelombang alami.
  - `smoothstep(a, b, v)` & `clamp01(v)`: Fungsi kurva transisi halus berbentuk S dan pembatas nilai $[0, 1]$.

---

## 3. `gabungan/zombie/ZombieNode.js`
**Peran Utama:** Struktur data berorientasi objek untuk *Scene Graph* dan pemodelan hierarkis (*Hierarchical Modeling*) karakter Zombie.

### Kelas & Komponen Kunci:
- **Class `ZombiePart`:**
  - Merepresentasikan satu bagian mesh individual tubuh zombie (seperti potongan jas robek, satu bola mata, dasi, gigi, kancing, dll.).
  - Properti: `geometry` (posisi vertex, normal, indeks), `localMatrix`, warna dasar, jenis primitif, offset ledakan (`off`), dan faktor dispersi (`amt`).
  - `setup()`: Menginisialisasi buffer WebGL pada GPU (`pBuffer` untuk posisi, `nBuffer` untuk normal vektor, dan `iBuffer` untuk indeks elemen).
  - `render(gl, parentWorldWrap, shaderData, explodeFactor, isRealColor, typesMap)`:
    - Menghitung matriks transformasi gabungan dunia:
      $$W = \text{parentWorldWrap} \times M_{\text{explode}} \times \text{localMatrix}$$
    - Mengirim matriks model ($W$) dan matriks normal ($\text{transpose}(\text{inverse}(W))$) ke uniform shader.
    - Mengikat buffer atribut vertex dan memanggil `gl.drawElements(gl.TRIANGLES, ...)`.
- **Class `BoneNode`:**
  - Merepresentasikan sendi atau tulang pada kerangka zombie (*skeleton/rigging*).
  - Properti: `name`, `animMatrix` (matriks transformasi animasi lokal tulang saat ini), `children` (tulang anak), dan `parts` (kumpulan `ZombiePart` yang menempel pada tulang ini).
  - `setup(gl)`: Melakukan traversal rekursif untuk menginisialisasi seluruh `parts` dan `children`.
  - `render(gl, parentWrap, shaderData, explodeFactor, isRealColor, typesMap)`:
    - Mengimplementasikan konsep *Hierarchical Transformation*:
      $$\text{currentWrap} = \text{parentWrap} \times \text{animMatrix}$$
    - Meneruskan matriks `currentWrap` ke seluruh `parts` pada tulang tersebut, lalu secara rekursif memanggil `.render()` pada semua `children`.

---

## 4. `gabungan/zombie/zombieScene.js`
**Peran Utama:** Factory adapter dan *scene manager* lengkap untuk karakter Zombie. File ini merakit seluruh geometri tubuh, menyusun hierarki kerangka, mengatur shader pencahayaan, dan mengontrol kalkulasi animasi dinamis.

### Fungsi & Komponen Kunci:
- **Factory `createZombieScene(gl)`:**
  - Menginisialisasi shader khusus zombie, memetakan uniform/atribut, membangun geometri, dan mengembalikan interface kontrol `{ update, render, bones, TYPES, ROOT }`.
- **Shader & Sistem Pencahayaan:**
  - Menggunakan Vertex Shader (`VS`) dan Fragment Shader (`FS`) dengan teknik pencahayaan realistis:
    - *Shadow Mapping (PCF 5×5)* untuk bayangan lembut.
    - *Wrap diffuse* untuk pencahayaan lembut pada kulit zombie.
    - *Hemisphere ambient lighting* (langit sejuk di atas, pantulan tanah hangat di bawah).
    - *Blinn-Phong specular reflection* dan *Rim lighting*.
  - Menyertakan shader pass kedalaman bayangan (`VS_D`, `FS_D`).
- **Pemodelan Parametrik Karakter:**
  - Membentuk ratusan bagian tubuh zombie menggunakan kombinasi primitif matematika:
    - `pantsTexture`: Tekstur celana dengan deformasi noise lipatan kain.
    - `curvedEllipsoid`: Bentuk elipsoid yang ditekuk untuk lekukan tubuh.
    - `texturedEllipsoid`, jas compang-camping (`ragged`), dasi, gigi, mulut berongga, dan rambut.
  - Mendaftarkan bagian-bagian tersebut ke tulang terkait menggunakan fungsi `add(...)`.
- **Penyusunan Hierarki Kerangka (*Rigging*):**
  - Membangun pohon relasi tulang:
    `root` $\to$ `body` $\to$ `head` (termasuk `jaw`, `eyeL/R`, `hair0-9`), serta sendi tangan (`armL/R_upper` $\to$ `armL/R_lower`) dan kaki (`legL/R_upper` $\to$ `legL/R_lower`).
- **Mesin Animasi (`animWraps` & `update`):**
  - Menghitung rotasi Euler dan pergeseran pivot (*pivot rotation*) untuk setiap sendi secara dinamis berdasarkan parameter:
    - Waktu animasi (`animT`) untuk gerakan *idle* (bernapas dan bergoyang pelan).
    - Langkah kaki dan ayunan tangan bergantian saat berjalan (`isWalking`).
    - Gerakan kelopak mata berkedip (*blinking*).
    - Goyangan helai rambut dan bukaan rahang zombie.
    - Pose bangkit dari tanah makam (`riseProgress`).
- **Rendering Karakter (`render`):**
  - Mengikat program shader zombie, mengatur matriks View & Proyeksi, arah sumber cahaya, dan posisi kamera (*eye*), lalu memicu render hierarkis dari tulang `root`.

---

## 5. `gabungan/graveyard/main.js`
**Peran Utama:** Skrip *driver* utama (standalone runner) untuk menampilkan, menguji, dan mengontrol scene Graveyard secara mandiri.

### Fungsi & Komponen Kunci:
- **Inisialisasi Buffer & Shader (`init`):**
  - Mengikat Vertex Array Object (VAO) dan mengunggah array vertex primitif `UM.arr` ke GPU buffer.
  - Membaca data `OBJEK_GRAVEYARD` untuk menghitung statistik jumlah objek dan menampilkan panel keterangan bentuk (UI legend).
- **Kontrol Kamera Orbit Bola:**
  - Mengatur orientasi kamera interaktif berbasis koordinat bola: `yaw` (rotasi horizontal), `pit` (rotasi vertikal), `dist` (jarak zoom), dan target pandang (`cam.t`).
  - Mendukung interaksi pointer mouse: drag tombol kiri (rotasi), drag tombol kanan / Shift+Drag (panning kamera), dan scroll roda mouse (zooming).
- **Mouse Picking via Raycasting (`ray` & `pick`):**
  - `ray(px, py)`: Mengonversi koordinat piksel 2D pada layar browser menjadi sinar vektor 3D (*ray origin* & *ray direction*) menggunakan invers matriks View-Projection ($(\text{VP})^{-1}$).
  - `pick(px, py)`: Melakukan uji perpotongan sinar terhadap kotak pembatas objek (*Ray-AABB intersection test*) pada seluruh objek di `OBJEK_GRAVEYARD`. Objek yang terdeteksi akan disorot (*highlight*) dan informasinya ditampilkan pada panel info UI.
- **Penggambaran Lingkungan (`drawShapes`):**
  - Melakukan perulangan pada seluruh data `OBJEK_GRAVEYARD`.
  - Mengganti bentuk kotak proksi dengan mesh prosedural khusus saat dalam mode detail:
    - Tanah dasar diganti dengan medan bergelombang procedural (`drawTerrain`).
    - Tangga dan pintu masuk diganti dengan mesh gerbang batu (`drawEntrance`).
    - Pohon digambar menggunakan cabang dan daun prosedural (`drawTree`).
    - Gundukan tanah makam (`MOUND_RANGE`), batu nisan (`GRAVESTONE_RANGE`), peti kubur (`GRAVESLAB_RANGE`), dan batu jalan setapak (`STONE_RANGE`).
- **Game/Render Loop (`frame`):**
  - Menangani penyesuaian ukuran canvas dengan resolusi layar (`devicePixelRatio`).
  - Mengalkulasi matriks gabungan `VP = M4.mul(M4.persp(...), M4.look(...))`.
  - Mengatur 3 mode visualisasi:
    - Mode 0: Model kompleks asli lingkungan kuburan.
    - Mode 1: Bentuk proksi dasar (*unit mesh blockout*).
    - Mode 2: Tampilan gabungan transparan (model asli dengan overlay proksi).
  - Memanggil `requestAnimationFrame(frame)` untuk perulangan render berkelanjutan.
