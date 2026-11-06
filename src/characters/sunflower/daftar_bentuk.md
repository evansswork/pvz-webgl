# Daftar Bentuk & Rotasi Karakter Sunflower

Dokumen ini merangkum pemodelan geometri dan semua transformasi (terutama rotasi) pada karakter Sunflower.
Sumber: [`model.js`](model.js) (bentuk & hierarki), [`animation.js`](animation.js) (pose & animasi), [`index.js`](index.js) (efek Sun), [`../../core/geometry.js`](../../core/geometry.js) (rumus bentuk).

---

## I. Klasifikasi Geometri

| Kategori | Bentuk / Metode | Bagian Karakter |
| :--- | :--- | :--- |
| **Quadric 1** | **Ellipsoid** | Wajah/kepala, 2 mata, 2 kilau mata, simpul pangkal batang (`baseKnot`), sendi batang (`joint`), simpul leher (`neckKnot`), inti Sun, glow Sun |
| **Quadric 2** | **Cylinder** | Batang bawah (`stemLower`) dan batang atas (`stemUpper`) |
| **Quadric 3** | **Elliptic Paraboloid** | 16 kelopak (lensa dari dua permukaan paraboloid) |
| **Quadric 4** | **Cone** | 12 sinar Sun |
| **Kurva 3D** | **Bézier kubik 3D** | 4 daun (permukaan di antara 2 kurva Bézier), mulut (tube mengikuti kurva Bézier di permukaan wajah) |
| **Turunan kurva** | **Tube** | 4 tulang daun mengikuti garis tengah daun, mulut |

Rumus quadric yang dipakai:

```text
Ellipsoid    : x²/rx² + y²/ry² + z²/rz² = 1
Cylinder     : x²/r² + z²/r² = 1,  0 ≤ y ≤ h
Paraboloid   : z = c − k·(x²/a² + y²/b²)
               depan   z = t − (t + d)·u²   (cembung)
               belakang z = −d·u²
               dengan x = a·u·cosθ, y = b·u·sinθ, 0 ≤ u ≤ 1
Cone         : x² + z² = (r·(1 − y/h))²
Bézier kubik : B(t) = (1−t)³P0 + 3(1−t)²t P1 + 3(1−t)t² P2 + t³ P3
```

---

## II. Hierarki (Scene Graph)

```text
root ─ body ─┬─ leaf[0..3] ─ vein[0..3]
             ├─ baseKnot
             └─ stemLower ─┬─ joint
                           └─ stemUpper ─ neck ─┬─ neckKnot
                                                └─ face ─┬─ head, eyeL/R ─ shine, mouth
                                                         └─ petalRing ─ petalPivot[0..15] ─ petal[0..15]
```

`world_anak = world_induk × local_anak`, dengan `local = pre × T(position) × Ry × Rx × Rz × S(scale)`.
Di scene utama, seluruh karakter dibawa ke dunia oleh `stage = T(petak rumput) × Ry(0) × S(TILE/2)` ([`cast.js`](../../cast.js)).

---

## III. Rincian Bagian Model

### 1. Kepala & Wajah
* **Wajah (`head`)**: Ellipsoid pipih `rx 0.62 × ry 0.52 × rz 0.20`.
* **Mata (`eyeL/R`)**: Ellipsoid hitam pipih `0.072 × 0.118 × 0.05`, ditempel di permukaan wajah (posisi z dihitung dari rumus ellipsoid wajah).
* **Kilau mata (`shine`)**: Ellipsoid putih kecil `0.024 × 0.03 × 0.012`, anak dari mata.
* **Mulut (`mouth`)**: Tube dengan radius membesar di tengah, mengikuti **kurva Bézier 3D** (4 titik kontrol) yang diproyeksikan ke permukaan wajah sehingga mulut menempel melengkung.

### 2. Kelopak
* **16 kelopak** dalam 2 lapis: 8 depan (kuning terang, `a 0.165 × b 0.265`) dan 8 belakang (oranye, `a 0.175 × b 0.29`).
* Tiap kelopak = **lensa dari dua elliptic paraboloid** yang bertemu di tepi oval.
* Disusun melingkar mengikuti keliling elips wajah.

### 3. Leher & Batang
* **Simpul leher (`neckKnot`)**: Ellipsoid `0.1 × 0.1 × 0.07`.
* **Batang atas (`stemUpper`)**: Cylinder `r 0.048`, tinggi `0.56`.
* **Sendi batang (`joint`)**: Ellipsoid bulat `r 0.056` di sambungan batang.
* **Batang bawah (`stemLower`)**: Cylinder `r 0.052`, tinggi `0.62`.
* Batang dibuat **2 segmen** supaya bisa terlihat melengkung lewat hierarki.

### 4. Daun & Pangkal
* **4 daun**: kanan, kiri, depan (lebar), belakang. Tiap daun = permukaan di antara **2 kurva Bézier kubik 3D** (batas kiri & kanan), bagian tengah diturunkan (cekung), ujung menekuk ke bawah, diberi ketebalan.
* **Tulang daun (`vein`)**: Tube mengikuti garis tengah daun.
* **Simpul pangkal (`baseKnot`)**: Ellipsoid `0.085 × 0.07 × 0.085`.

### 5. Efek Sun (keluar saat tombol `1`)
* **Inti**: Ellipsoid `0.26 × 0.26 × 0.2`.
* **12 sinar**: Cone, disusun melingkar.
* **Glow**: Ellipsoid transparan `0.7`, blending additive.

---

## IV. Daftar Rotasi

### A. Rotasi pose awal (statis, dari `model.js`)

| Bagian | Sumbu | Nilai | Tujuan |
| :--- | :--- | :--- | :--- |
| `leaf[i]` | Y | yaw tiap daun (0.18, π−0.18, −π/2−0.05, π/2+0.25) | Menyebar daun ke 4 arah |
| `stemLower` | X | −0.10 rad | Batang bawah sedikit condong |
| `stemUpper` | X | +0.26 rad | Batang atas menekuk (bentuk lengkung) |
| `neck` | X | −0.16 rad | Kepala menunduk sedikit |
| `eyeL/R` | X, Y | X −0.12, Y ±0.25 rad | Mata mengikuti lengkung wajah |
| `petalPivot[i]` | Z | −θ, θ = i/16 · 2π | Mengarahkan kelopak radial melingkar |
| `petal[i]` | X | −0.17 (depan) / −0.26 (belakang) rad | Kelopak condong ke belakang |

### B. Rotasi animasi (`animation.js`)

| Animasi | Bagian | Sumbu | Besar | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **Sway — tombol `2` (ROTATE)** | `neck` | **Z** | ±0.38 rad (≈ ±21.8°), 2× bolak-balik | Kepala goyang kiri-kanan; wajah, mata, mulut, 16 kelopak ikut (hierarki) |
| Sway | `stemUpper` | Z | −0.06 × arah goyang | Batang atas melawan sedikit agar seimbang |
| Sway | `petal[i]` | X | 0.12 rad, fase telat | Kelopak "telat" mengikuti gerak kepala |
| Sun — tombol `1` | `neck` | X | ±0.10 rad | Mengangguk saat mendorong Sun keluar |
| Sun | `petal[i]` | X | +0.25 rad | Kelopak mengembang saat Sun keluar |
| Idle (otomatis) | `stemUpper`, `neck` | X | ±0.03 rad | Ayunan napas pelan |
| Idle | `petal[i]` | X | ±0.04 rad, fase beda tiap kelopak | Kelopak bergetar halus |
| Grow — tombol `G` | `petal[i]` | X | 1.2 → 0 rad | Kelopak membuka saat tumbuh |
| Grow | `leaf[i]` | Z | 0.9 → 0 rad | Daun membuka dari posisi tegak |
| Efek Sun | `sun` | Y | `atan2` ke kamera | Billboard: Sun selalu menghadap kamera |
| Efek Sun | `sunSpin` | Z | `time × 1.4` rad | Sinar Sun berputar terus |

### C. Rotasi Arbitrary Axis — 4 daun (otomatis)

Tiap daun diputar terhadap **engsel di pangkalnya** dengan sumbu miring (bukan X/Y/Z):

```text
P     = posisi pangkal daun (ruang body)
dir   = arah daun (pangkal → ujung)
u     = normalize( (atas × dir) + 0.35·atas )        ← sumbu miring
θ     = gust · 0.17 · sin(1.9t + 1.35i)              ← daun naik-turun tertiup angin
gust  = 0.65 + 0.35·sin(0.45t)                        ← hembusan datang-pergi
M     = T(P) · Rx(−α) · Ry(−β) · Rz(θ) · Ry(β) · Rx(α) · T(−P)   (M4.rotateArbitraryAxis)
```

Tekan `X` untuk menampilkan penanda sumbu (batang merah + ujung cone) pada daun pertama.

---

## V. Transformasi Lain (untuk rubrik)

| Rubrik | Bagian | Detail |
| :--- | :--- | :--- |
| **Translate** — tombol `1` | `face` | Wajah mundur −0.08 lalu maju +0.12 (sumbu Z leher), lalu kembali |
| Translate | Sun | Naik dari wajah → melayang melengkung → jatuh ke rumput |
| **Scaling** — otomatis | `eyeL/R` | Tinggi mata 1 → 0.1 → 1, kedip 0.35 detik tiap 3.2 detik (tiap siklus ke-3 kedip 2×) |
| Scaling | `body` | Tinggi 1 ± 0.018 (napas) |
| Scaling — tombol `G` | `root`, `face`, `petal[i]` | 0 → 1 dengan easing `outBack` (tumbuh) |
| Scaling | Sun | Muncul 0 → 1, menghilang 1 → 0 |
| **Hierarchical** | seluruh rantai | `root → body → stemLower → stemUpper → neck → face → mata/mulut/kelopak` |
