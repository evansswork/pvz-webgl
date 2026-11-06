# Daftar Bentuk & Rotasi Karakter Peashooter

Dokumen ini merangkum pemodelan geometri dan semua transformasi (terutama rotasi) pada karakter Peashooter.
Sumber: [`model.js`](model.js) (bentuk & hierarki), [`animation.js`](animation.js) (pose & animasi), [`index.js`](index.js) (kacang & percikan), [`../../core/geometry.js`](../../core/geometry.js) (rumus bentuk).

---

## I. Klasifikasi Geometri

| Kategori | Bentuk / Metode | Bagian Karakter |
| :--- | :--- | :--- |
| **Quadric 1** | **Ellipsoid** | Kepala, 2 mata, 2 kilau mata, simpul pangkal batang (`baseKnot`), kacang (peluru), percikan kacang |
| **Quadric 2** | **Cylinder** | Penghubung batang–kepala (`collar`) |
| **Quadric 3** | **Cone terpotong (frustum)** | Moncong luar (`snout`) dan dinding dalam moncong (`snoutInner`) |
| **Kurva 3D** | **Bézier kubik 3D** | Batang bawah & atas (tube mengikuti kurva Bézier), 4 daun dan daun belakang kepala (permukaan di antara 2 kurva Bézier) |
| **Turunan kurva** | **Tube** | Batang, 4 tulang daun, tulang daun kepala |
| **Objek lain** | **Torus** | Bibir moncong (`lip`), bukan quadric (derajat 4) |
| | **Disc** | Dasar gelap lubang moncong (`snoutBack`) |

Rumus yang dipakai:

```text
Ellipsoid      : x²/rx² + y²/ry² + z²/rz² = 1
Cylinder       : x²/r² + z²/r² = 1,  0 ≤ y ≤ h
Cone terpotong : x² + z² = (r0 + (r1 − r0)·y/h)²,  0 ≤ y ≤ h
Torus          : (√(x² + z²) − R)² + y² = r²
Bézier kubik   : B(t) = (1−t)³P0 + 3(1−t)²t P1 + 3(1−t)t² P2 + t³ P3
```

---

## II. Hierarki (Scene Graph)

```text
root ─ body ─┬─ leaf[0..3] ─ vein[0..3]
             ├─ baseKnot
             └─ stemLower ─ stemUpper ─ neck ─┬─ collar
                                              └─ head ─┬─ eyeL/R ─ shine
                                                       ├─ headLeaf ─ headVein
                                                       └─ snout ─┬─ snoutInner, snoutBack
                                                                 └─ lip
```

`world_anak = world_induk × local_anak`, dengan `local = pre × T(position) × Ry × Rx × Rz × S(scale)`.
Di scene utama, seluruh karakter dibawa ke dunia oleh `stage = T(petak rumput) × Ry(−π/2) × S(TILE/2)` ([`cast.js`](../../cast.js)).

---

## III. Rincian Bagian Model

### 1. Kepala
* **Kepala (`head`)**: Ellipsoid memanjang ke depan `rx 0.40 × ry 0.38 × rz 0.45`.
* **Mata (`eyeL/R`)**: Ellipsoid hitam pipih `0.056 × 0.086 × 0.03`, ditempel tepat di permukaan kepala dan diorientasikan mengikuti normal ellipsoid (`M4.facing`).
* **Kilau mata (`shine`)**: Ellipsoid putih kecil `0.02 × 0.026 × 0.01`.
* **Daun belakang kepala (`headLeaf`)**: Permukaan dari **2 kurva Bézier 3D** (panjang 0.36, lebar 0.12), ujung melengkung, ditempel di belakang-atas kepala. Tulangnya (`headVein`) berupa tube.

### 2. Moncong
* **Moncong luar (`snout`)**: **Cone terpotong** `r0 0.12 → r1 0.245`, panjang `0.5`, melebar ke depan.
* **Dinding dalam (`snoutInner`)**: Cone terpotong dengan normal menghadap ke dalam (`inward = true`), tebal dinding `0.032`.
* **Dasar lubang (`snoutBack`)**: Disc gelap untuk memberi kesan lubang dalam.
* **Bibir (`lip`)**: Torus di ujung moncong, warna hijau lebih terang.

### 3. Leher & Batang
* **Penghubung (`collar`)**: Cylinder pendek `r 0.078`, tinggi `0.06`.
* **Batang atas (`stemUpper`)**: Tube mengikuti **kurva Bézier 3D** `(0,0,0) → (0,0.11,0.04) → (0,0.22,0.07) → (0,0.32,0.03)`, radius mengecil 0.05 → 0.042.
* **Batang bawah (`stemLower`)**: Tube mengikuti **kurva Bézier 3D** `(0,0,0) → (0,0.16,−0.06) → (0,0.30,−0.08) → (0,0.44,−0.03)`, radius 0.056 → 0.05.
* Dua kurva berlawanan arah membentuk **lengkung S** seperti referensi tampak samping.

### 4. Daun & Pangkal
* **4 daun**: Permukaan di antara **2 kurva Bézier kubik 3D** (batas kiri & kanan), cekung di tengah, ujung menekuk ke bawah, diberi ketebalan.
* **Tulang daun (`vein`)**: Tube mengikuti garis tengah daun.
* **Simpul pangkal (`baseKnot`)**: Ellipsoid `0.085 × 0.07 × 0.085`.

### 5. Efek Tembakan (tombol `3`)
* **Kacang**: Ellipsoid bulat `r 0.1`.
* **Percikan**: 9 ellipsoid kecil `r 0.035` saat kacang mengenai Zombie / tanah.

---

## IV. Daftar Rotasi

### A. Rotasi pose awal (statis, dari `model.js`)

| Bagian | Sumbu | Nilai | Tujuan |
| :--- | :--- | :--- | :--- |
| `root` | Y | +π/2 | Depan lokal Peashooter menghadap +X |
| `leaf[i]` | Y | yaw tiap daun (0.25, π−0.25, −π/2, π/2+0.1) | Menyebar daun ke 4 arah |
| `headLeaf` | Y, Z | Y π/2, Z 0.35 rad | Daun kepala mengarah ke belakang & sedikit naik |
| `snout` | X | π/2 | Sumbu +Y cone diputar menjadi +Z kepala (moncong ke depan) |
| `eyeL/R` | basis | `M4.facing(normal kepala)` | Mata menghadap searah normal permukaan kepala |

### B. Rotasi animasi (`animation.js`)

| Animasi | Bagian | Sumbu | Besar | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **Look — tombol `4` (ROTATE)** | `neck` | **Y** | 0 → +0.7 → −0.7 → 0 rad (≈ ±40°) | Kepala menoleh kiri lalu kanan; mata, moncong, daun kepala ikut (hierarki) |
| Look | `stemUpper` | Y | 0.12 × sudut leher | Batang atas sedikit ikut memutar |
| Look | `headLeaf` | Z | +0.25 rad saat berhenti | Daun kepala "telat" saat kepala berhenti |
| Shoot — tombol `3` | `neck` | X | −0.12 rad + hentakan teredam | Ancang-ancang ke belakang lalu recoil |
| Shoot | `headLeaf` | Z | 0.5 × hentakan | Daun kepala tersentak saat menembak |
| Idle (otomatis) | `neck` | X, Z | X ±0.04, Z ±0.03 rad | Kepala bergoyang pelan |
| Idle | `stemUpper` | X | ±0.03 rad | Ayunan batang atas |
| Idle | `stemLower` | Z | ±0.02 rad | Ayunan batang bawah |
| Idle | `leaf[i]` | Z | ±0.035 rad, fase beda tiap daun | Daun bawah bergerak halus |
| Grow — tombol `G` | `headLeaf` | Z | −1.4 → 0 rad | Daun kepala membuka saat tumbuh |
| Grow | `leaf[i]` | Z | 0.9 → 0 rad | Daun bawah membuka dari posisi tegak |

### C. Rotasi Arbitrary Axis — daun belakang kepala (otomatis)

Daun kepala diputar terhadap **engsel tetap di pangkalnya** dengan sumbu miring (bukan X/Y/Z). Sumbu ditulis di ruang kepala, jadi ikut berputar saat kepala menoleh (hierarki).

```text
P   = (0, 0.246, −0.314)                             ← pangkal daun kepala (ruang head)
u   = normalize(0.8, 0.5, −0.4) ≈ (0.781, 0.488, −0.390) ← sumbu miring: ke samping, atas, belakang
θ   = 0.42·sin(2.6t) + 0.08·sin(5.3t)                ← daun mengepak naik-turun
M   = T(P) · Rx(−α) · Ry(−β) · Rz(θ) · Ry(β) · Rx(α) · T(−P)   (M4.rotateArbitraryAxis)
```

Konstanta sumbu: `HEAD_LEAF_AXIS` di [`animation.js`](animation.js).

Tekan `X` untuk menampilkan penanda sumbu (batang merah + ujung cone) pada daun kepala.

---

## V. Transformasi Lain (untuk rubrik)

| Rubrik | Bagian | Detail |
| :--- | :--- | :--- |
| **Translate** — tombol `3` | `head` | Kepala mundur −0.07 (sumbu Z leher) untuk ancang-ancang, tersentak saat menembak, lalu kembali |
| Translate | Kacang | `posisi += kecepatan × dt`, kecepatan 7.5 searah moncong |
| Translate | Percikan | Terlempar ke atas lalu jatuh dengan gravitasi 9.8 |
| **Scaling** — otomatis | `eyeL/R` | Mata melotot 1 → 1.45×, lalu menutup (tinggi ≈ 0.08) dan membuka, siklus 5 detik |
| Scaling | `body` | Tinggi 1 ± 0.016 (napas) |
| Scaling — tombol `G` | `root`, `head`, `snout` | 0 → 1 dengan easing `outBack` / `outElastic` (moncong memantul) |
| Scaling | Kacang, percikan | Kacang muncul 0 → 1; percikan mengecil sampai hilang |
| **Hierarchical** | seluruh rantai | `root → body → stemLower → stemUpper → neck → head → mata/moncong/daun kepala` |
