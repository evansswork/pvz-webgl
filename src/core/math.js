/* =========================================================================
   math.js — Library vektor & matriks 4x4 (column-major, sama seperti WebGL)
   Ditulis sendiri, TANPA library eksternal (tidak memakai Three.js / glMatrix)
   ========================================================================= */

/**
 * V3 — Operasi Aljabar Vektor 3 Dimensi [x, y, z]
 */
export const V3 = {
  /**
   * Penjumlahan dua vektor 3D (a + b).
   * @param {Array<number>} a - Vektor pertama [x, y, z]. Nilai acuan awal posisi/arah.
   * @param {Array<number>} b - Vektor kedua [x, y, z]. Penambah untuk menggeser posisi atau menjumlahkan arah.
   * @returns {Array<number>} Vektor hasil penjumlahan [x, y, z].
   */
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],

  /**
   * Pengurangan dua vektor 3D (a - b).
   * @param {Array<number>} a - Vektor pertama/target [x, y, z].
   * @param {Array<number>} b - Vektor kedua/pengurang [x, y, z]. Mengubah vektor acuan untuk menghasilkan arah selisih dari b ke a.
   * @returns {Array<number>} Vektor selisih [x, y, z].
   */
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],

  /**
   * Perkalian skalar vektor 3D (a * s).
   * @param {Array<number>} a - Vektor asal [x, y, z]. Arah atau koordinat dasar.
   * @param {number} s - Nilai faktor pengali skalar. Mengubah panjang/magnitudo vektor (memperbesar jika s > 1, memperkecil jika s < 1, membalik arah jika s negatif).
   * @returns {Array<number>} Vektor hasil penskalaan [x, y, z].
   */
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],

  /**
   * Perkalian titik / Dot Product (a · b).
   * @param {Array<number>} a - Vektor pertama [x, y, z].
   * @param {Array<number>} b - Vektor kedua [x, y, z]. Nilai pembanding untuk menghitung proyeksi atau cosinus sudut antar dua vektor (misal arah pandang vs normal permukaan untuk intensitas cahaya).
   * @returns {number} Nilai skalar dot product.
   */
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],

  /**
   * Perkalian silang / Cross Product (a x b).
   * @param {Array<number>} a - Vektor pertama [x, y, z].
   * @param {Array<number>} b - Vektor kedua [x, y, z]. Mengubah arah orientasi bidang datar yang dibentuk a dan b untuk menghasilkan sumbu rotasi atau normal yang tegak lurus terhadap keduanya.
   * @returns {Array<number>} Vektor 3D baru yang tegak lurus terhadap vektor a dan b.
   */
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],

  /**
   * Menghitung panjang / magnitudo Euclidean vektor (|a|).
   * @param {Array<number>} a - Vektor 3D [x, y, z]. Komponen jarak spasial yang akan diukur panjangnya.
   * @returns {number} Nilai panjang skalar vektor (hypot).
   */
  len: (a) => Math.hypot(a[0], a[1], a[2]),

  /**
   * Normalisasi vektor (menjadikan panjang = 1 tanpa mengubah arah).
   * @param {Array<number>} a - Vektor asal [x, y, z]. Diubah skalanya menjadi vektor satuan unit agar aman dipakai pada perhitungan pencahayaan dan matriks orientasi.
   * @returns {Array<number>} Vektor satuan [x, y, z] dengan panjang 1 (atau [0,0,0] jika vektor awal mendekati nol).
   */
  norm(a) { const l = Math.hypot(a[0], a[1], a[2]); return l < 1e-9 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l]; },

  /**
   * Interpolasi Linear (Lerp) antara dua vektor 3D.
   * @param {Array<number>} a - Vektor awal [x, y, z] saat t = 0.
   * @param {Array<number>} b - Vektor akhir [x, y, z] saat t = 1.
   * @param {number} t - Faktor interpolasi (0.0 sampai 1.0). Mengubah pergeseran persentase posisi dari titik a menuju b untuk menghasilkan pergerakan/animasi yang halus.
   * @returns {Array<number>} Vektor perantara hasil interpolasi [x, y, z].
   */
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};

/**
 * M4 — Operasi Matriks Transformasi 4x4 (Format Column-Major Standar WebGL)
 */
export const M4 = {
  /**
   * Membuat matriks identitas 4x4 (tanpa translasi, rotasi, atau penskalaan).
   * @returns {Float32Array} Matriks identitas 16 elemen di mana diagonal utamanya bernilai 1.
   */
  identity() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },

  /**
   * Perkalian dua matriks 4x4: out = a * b.
   * Pada transformasi verteks v: (a * b) * v = a * (b * v), artinya transformasi b diterapkan lebih dulu, disusul a.
   * @param {Float32Array|Array<number>} a - Matriks transformasi induk/kedua.
   * @param {Float32Array|Array<number>} b - Matriks transformasi lokal/pertama yang akan digabungkan di bawah pengaruh matriks a.
   * @returns {Float32Array} Matriks 4x4 hasil perkalian komposit.
   */
  multiply(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  },

  /**
   * Mengalikan deretan matriks transformasi secara berantai dari kiri ke kanan.
   * @param {...(Float32Array|Array<number>)} ms - Daftar matriks yang akan dikalikan berurutan (misal: T, R, S).
   * @returns {Float32Array} Matriks gabungan akhir.
   */
  chain(...ms) { return ms.reduce((acc, m) => M4.multiply(acc, m)); },

  /* ---------------- TRANSLATE ---------------- */
  /**
   * Membuat matriks translasi (pergeseran posisi objek di ruang 3D).
   * @param {number} x - Jarak pergeseran pada sumbu horizontal X (positif = kanan, negatif = kiri).
   * @param {number} y - Jarak pergeseran pada sumbu vertikal Y (positif = naik, negatif = turun).
   * @param {number} z - Jarak pergeseran pada sumbu kedalaman Z (positif = maju/mendekat, negatif = mundur/menjauh).
   * @returns {Float32Array} Matriks translasi 4x4.
   */
  translation(x, y, z) { const m = M4.identity(); m[12] = x; m[13] = y; m[14] = z; return m; },

  /* ---------------- SCALING ------------------ */
  /**
   * Membuat matriks penskalaan (mengubah ukuran objek).
   * @param {number} x - Faktor perbesaran/pengecilan sumbu X (misal 2.0 = melebar 2x lipat).
   * @param {number} y - Faktor perbesaran/pengecilan sumbu Y (misal 0.1 = memipih untuk efek mata berkedip).
   * @param {number} z - Faktor perbesaran/pengecilan sumbu Z (mengubah ketebalan kedalaman objek).
   * @returns {Float32Array} Matriks scaling 4x4.
   */
  scaling(x, y, z) { const m = M4.identity(); m[0] = x; m[5] = y; m[10] = z; return m; },

  /* ---------------- ROTATE (sumbu utama) ----- */
  /**
   * Membuat matriks rotasi mengelilingi sumbu X (pitch).
   * @param {number} a - Sudut putar dalam satuan radian (misal Math.PI / 4 = 45 derajat).
   * @param {number} [c=Math.cos(a)] - Nilai cosinus sudut a (opsional, untuk optimasi menghindari rekalkulasi trigonometri).
   * @param {number} [s=Math.sin(a)] - Nilai sinus sudut a (opsional).
   * @returns {Float32Array} Matriks rotasi sumbu X.
   */
  rotationX(a, c = Math.cos(a), s = Math.sin(a)) { const m = M4.identity(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },

  /**
   * Membuat matriks rotasi mengelilingi sumbu Y (yaw / arah hadap).
   * @param {number} a - Sudut putar dalam satuan radian (memutar orientasi hadap objek ke kiri/kanan).
   * @param {number} [c=Math.cos(a)] - Nilai cosinus sudut a (opsional).
   * @param {number} [s=Math.sin(a)] - Nilai sinus sudut a (opsional).
   * @returns {Float32Array} Matriks rotasi sumbu Y.
   */
  rotationY(a, c = Math.cos(a), s = Math.sin(a)) { const m = M4.identity(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },

  /**
   * Membuat matriks rotasi mengelilingi sumbu Z (roll / gelengan kepala).
   * @param {number} a - Sudut putar dalam satuan radian (memiringkan objek ke samping kiri/kanan).
   * @param {number} [c=Math.cos(a)] - Nilai cosinus sudut a (opsional).
   * @param {number} [s=Math.sin(a)] - Nilai sinus sudut a (opsional).
   * @returns {Float32Array} Matriks rotasi sumbu Z.
   */
  rotationZ(a, c = Math.cos(a), s = Math.sin(a)) { const m = M4.identity(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },

  /* ---------------- ROTATE ARBITRARY AXIS ----
     Rotasi sebesar `angle` terhadap garis yang melewati titik P dengan arah u.
     Metode klasik Grafkom (7 langkah):
       M = T(P) · Rx(-α) · Ry(-β) · Rz(θ) · Ry(β) · Rx(α) · T(-P)
  */
  /**
   * Membuat matriks rotasi terhadap sumbu sembarang (arbitrary axis) yang melewati titik pivot P.
   * @param {Array<number>} P - Titik tumpu / engsel rotasi [x, y, z]. Mengubah letak poros putar di ruang 3D (misal pangkal engsel daun atau rahang zombie).
   * @param {Array<number>} axis - Vektor arah garis sumbu putar [x, y, z]. Menentukan kemiringan arah poros rotasi.
   * @param {number} angle - Sudut putaran dalam radian. Mengubah seberapa jauh objek berputar pada poros tersebut.
   * @returns {Float32Array} Matriks gabungan 7 transformasi klasik rotasi sumbu sembarang.
   */
  rotateArbitraryAxis(P, axis, angle) {
    const [a, b, c] = V3.norm(axis);
    const d = Math.hypot(b, c);
    const T = M4.translation(-P[0], -P[1], -P[2]);
    const Ti = M4.translation(P[0], P[1], P[2]);
    // Rx(α): cos α = c/d, sin α = b/d  (kalau d = 0, sumbu sudah sejajar X)
    const Rx = d > 1e-9 ? M4.rotationX(0, c / d, b / d) : M4.identity();
    const Rxi = d > 1e-9 ? M4.rotationX(0, c / d, -b / d) : M4.identity();
    // Ry(β): cos β = d, sin β = -a  → memetakan (a, 0, d) ke (0, 0, 1)
    const Ry = M4.rotationY(0, d, -a);
    const Ryi = M4.rotationY(0, d, a);
    const Rz = M4.rotationZ(angle);
    return M4.chain(Ti, Rxi, Ryi, Rz, Ry, Rx, T);
  },

  /**
   * Rumus Rotasi Rodrigues terhadap sumbu unit yang melewati titik pusat asal (0, 0, 0).
   * @param {Array<number>} axis - Vektor arah sumbu rotasi [x, y, z]. Mengubah arah orientasi poros putar.
   * @param {number} angle - Sudut putaran dalam radian.
   * @returns {Float32Array} Matriks rotasi 4x4.
   */
  rotationAxis(axis, angle) {
    const [x, y, z] = V3.norm(axis), c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
    const m = M4.identity();
    m[0] = t * x * x + c;     m[1] = t * x * y + s * z; m[2] = t * x * z - s * y;
    m[4] = t * x * y - s * z; m[5] = t * y * y + c;     m[6] = t * y * z + s * x;
    m[8] = t * x * z + s * y; m[9] = t * y * z - s * x; m[10] = t * z * z + c;
    return m;
  },

  /**
   * Membuat matriks proyeksi perspektif kamera 3D.
   * @param {number} fovy - Bidang pandang vertikal (Field of View) dalam radian. Mengubah efek zoom/lensa (nilai lebih kecil = telefoto/zoom in, nilai besar = fish eye/zoom out).
   * @param {number} aspect - Aspek rasio layar (lebar / tinggi canvas). Menjaga objek tidak terdistorsi gepeng/lonjong saat ukuran window berubah.
   * @param {number} near - Jarak bidang potong dekat (near clipping plane). Objek yang lebih dekat dari ini tidak akan dirender.
   * @param {number} far - Jarak bidang potong jauh (far clipping plane). Objek yang lebih jauh dari ini dipotong/hilang.
   * @returns {Float32Array} Matriks proyeksi perspektif 4x4.
   */
  perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = f / aspect; m[5] = f; m[10] = (far + near) / (near - far); m[11] = -1; m[14] = (2 * far * near) / (near - far);
    return m;
  },

  /**
   * Membuat matriks kamera pandang dunia (View Matrix) mengarahkan kamera ke titik target.
   * @param {Array<number>} eye - Posisi koordinat kamera di dunia [x, y, z]. Mengubah lokasi penempatan pengamat.
   * @param {Array<number>} target - Titik koordinat yang ditatap kamera [x, y, z]. Mengubah arah fokus pandang kamera.
   * @param {Array<number>} up - Vektor arah atas dunia [x, y, z] (biasanya [0, 1, 0]). Menentukan kemiringan/roll kamera agar tidak terbalik.
   * @returns {Float32Array} Matriks pandang (View Matrix) 4x4.
   */
  lookAt(eye, target, up) {
    const z = V3.norm(V3.sub(eye, target));
    const x = V3.norm(V3.cross(up, z));
    const y = V3.cross(z, x);
    const m = M4.identity();
    m[0] = x[0]; m[4] = x[1]; m[8] = x[2];
    m[1] = y[0]; m[5] = y[1]; m[9] = y[2];
    m[2] = z[0]; m[6] = z[1]; m[10] = z[2];
    m[12] = -V3.dot(x, eye); m[13] = -V3.dot(y, eye); m[14] = -V3.dot(z, eye);
    return m;
  },

  /**
   * Menghitung matriks balikan / invers ($M^{-1}$).
   * @param {Float32Array|Array<number>} m - Matriks 4x4 asal yang ingin diinverskan. Mengubah transformasi maju menjadi transformasi balik (misal mengubah koordinat dunia kembali ke koordinat lokal).
   * @returns {Float32Array} Matriks invers 4x4 (atau matriks identitas jika matriks asal singular/determinan = 0).
   */
  invert(m) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
    const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10;
    const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
    const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30;
    const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return M4.identity();
    det = 1 / det;
    const o = new Float32Array(16);
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;  o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;  o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;  o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;  o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;  o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return o;
  },

  /**
   * Menghitung matriks normal 3x3 = transpose(invers(3x3 model/world)).
   * @param {Float32Array|Array<number>} m - Matriks model transformasi 4x4. Diambil submatriks rotasi dan penskalaannya agar vektor normal pencahayaan tetap tegak lurus meski objek mengalami skala non-uniform.
   * @returns {Float32Array} Matriks 3x3 untuk transformasi vektor normal ke GPU shader.
   */
  normalMatrix(m) {
    const a00 = m[0], a01 = m[1], a02 = m[2], a10 = m[4], a11 = m[5], a12 = m[6], a20 = m[8], a21 = m[9], a22 = m[10];
    const b01 = a22 * a11 - a12 * a21, b11 = -a22 * a10 + a12 * a20, b21 = a21 * a10 - a11 * a20;
    let det = a00 * b01 + a01 * b11 + a02 * b21;
    const o = new Float32Array(9);
    if (!det) { o[0] = o[4] = o[8] = 1; return o; }
    det = 1 / det;
    // invers (column-major) lalu langsung ditranspose
    o[0] = b01 * det; o[3] = (-a22 * a01 + a02 * a21) * det; o[6] = (a12 * a01 - a02 * a11) * det;
    o[1] = b11 * det; o[4] = (a22 * a00 - a02 * a20) * det;  o[7] = (-a12 * a00 + a02 * a10) * det;
    o[2] = b21 * det; o[5] = (-a21 * a00 + a01 * a20) * det; o[8] = (a11 * a00 - a01 * a10) * det;
    return o;
  },

  /**
   * Mentransformasikan titik posisi 3D dengan matriks 4x4 (memperhitungkan translasi dan pembagian komponen homogen w).
   * @param {Float32Array|Array<number>} m - Matriks transformasi yang memetakan ruang (misal stage world matrix).
   * @param {Array<number>} p - Koordinat titik posisi 3D [x, y, z] yang ingin dipindahkan ke sistem koordinat baru.
   * @returns {Array<number>} Posisi titik 3D baru [x, y, z].
   */
  transformPoint(m, p) {
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15] || 1;
    return [(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w,
            (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w,
            (m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]) / w];
  },

  /**
   * Mentransformasikan vektor arah 3D dengan matriks 4x4 (hanya dipengaruhi rotasi dan skala, mengabaikan translasi posisi).
   * @param {Float32Array|Array<number>} m - Matriks transformasi orientasi.
   * @param {Array<number>} d - Vektor arah [dx, dy, dz] yang ingin diubah orientasinya mengikuti ruang matriks (misal arah tembakan peluru).
   * @returns {Array<number>} Vektor arah 3D yang baru.
   */
  transformDir(m, d) {
    return [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]];
  },

  /**
   * Membuat matriks dari tiga sumbu basis ortogonal (x, y, z) dan posisi pergeseran p.
   * Digunakan untuk menempelkan objek lokal mengikuti kontur permukaan 3D.
   * @param {Array<number>} x - Vektor sumbu lokal X baru [x, y, z].
   * @param {Array<number>} y - Vektor sumbu lokal Y baru [x, y, z] (misal vektor normal permukaan).
   * @param {Array<number>} z - Vektor sumbu lokal Z baru [x, y, z].
   * @param {Array<number>} [p=[0, 0, 0]] - Titik koordinat penempatan objek di permukaan.
   * @returns {Float32Array} Matriks orientasi basis 4x4.
   */
  basis(x, y, z, p = [0, 0, 0]) {
    const m = M4.identity();
    m[0] = x[0]; m[1] = x[1]; m[2] = x[2];
    m[4] = y[0]; m[5] = y[1]; m[6] = y[2];
    m[8] = z[0]; m[9] = z[1]; m[10] = z[2];
    m[12] = p[0]; m[13] = p[1]; m[14] = p[2];
    return m;
  },

  /**
   * Orientasi yang membuat sumbu lokal +Z menghadap ke `fwd`, dengan orientasi atas sedekat mungkin ke `up`.
   * @param {Array<number>} fwd - Vektor arah hadap depan yang ditargetkan [x, y, z].
   * @param {Array<number>} [up=[0, 1, 0]] - Vektor acuan arah atas dunia.
   * @param {Array<number>} [p=[0, 0, 0]] - Posisi pergeseran titik tumpu objek [x, y, z].
   * @returns {Float32Array} Matriks orientasi hadap 4x4.
   */
  facing(fwd, up = [0, 1, 0], p = [0, 0, 0]) {
    const z = V3.norm(fwd);
    let x = V3.cross(up, z);
    if (V3.len(x) < 1e-6) x = V3.cross([1, 0, 0], z);
    x = V3.norm(x);
    return M4.basis(x, V3.cross(z, x), z, p);
  },

  /**
   * Matriks rotasi yang memutar sumbu default +Y ke arah target `dir`.
   * @param {Array<number>} dir - Vektor arah target [x, y, z] yang akan disejajarkan dengan sumbu tinggi silinder/kerucut.
   * @returns {Float32Array} Matriks rotasi penyelarasan sumbu Y.
   */
  alignY(dir) {
    const d = V3.norm(dir), y = [0, 1, 0];
    const ax = V3.cross(y, d), s = V3.len(ax), c = V3.dot(y, d);
    if (s < 1e-6) return c > 0 ? M4.identity() : M4.rotationX(Math.PI);
    return M4.rotationAxis(ax, Math.atan2(s, c));
  },
};

/* ------------------------------ Easing ---------------------------------- */
/**
 * Membatasi nilai desimal agar selalu berada pada rentang tertutup [0.0, 1.0].
 * @param {number} x - Nilai angka input yang akan dipangkas batasnya.
 * @returns {number} Nilai yang diapit antara 0 dan 1.
 */
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Normalisasi segmen posisi p terhadap batas interval [a, b] menjadi rentang 0 sampai 1.
 * @param {number} p - Posisi/waktu saat ini.
 * @param {number} a - Nilai batas awal segmen (saat nilai output mulai naik dari 0).
 * @param {number} b - Nilai batas akhir segmen (saat nilai output mencapai 1).
 * @returns {number} Nilai transisi ternormalisasi [0.0 - 1.0].
 */
export const seg = (p, a, b) => clamp01((p - a) / (b - a));

/**
 * Kumpulan fungsi kurva Easing animasi (mengubah laju perubahan waktu linier t menjadi dinamis/organik).
 */
export const Ease = {
  /**
   * Easing In-Out Kubik: Lambat di awal, cepat di tengah, melambat di akhir.
   * @param {number} t - Waktu/progres animasi (0.0 sampai 1.0).
   * @returns {number} Nilai perpindahan berbobot kurva kubik.
   */
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),

  /**
   * Easing Out Kubik: Gerakan cepat di awal lalu melambat secara halus hingga berhenti.
   * @param {number} t - Waktu progres animasi (0.0 sampai 1.0).
   * @returns {number} Nilai progres teredam.
   */
  outCubic: (t) => 1 - Math.pow(1 - t, 3),

  /**
   * Easing In-Out Sinusoidal: Transisi lembut sinusoidal bolak-balik (bagus untuk goyangan idle alami).
   * @param {number} t - Waktu progres (0.0 sampai 1.0).
   * @returns {number} Nilai gelombang sinus berbobot [0.0 - 1.0].
   */
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,

  /**
   * Easing Out Back: Melecut sedikit melampaui target (overshoot) lalu membal kembali ke posisi akhir.
   * @param {number} t - Waktu progres (0.0 sampai 1.0). Digunakan saat koin Sun atau peluru kacang membesar secara elastis.
   * @returns {number} Nilai progres dengan efek overshoot membal.
   */
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },

  /**
   * Easing Out Elastic: Bergetar pegas memantul beberapa kali sebelum tenang di titik akhir.
   * @param {number} t - Waktu progres (0.0 sampai 1.0).
   * @returns {number} Nilai pantulan elastis pegas.
   */
  outElastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1),

  /**
   * Kurva Hermite Smoothstep klasik: $3t^2 - 2t^3$.
   * @param {number} t - Waktu linier input (0.0 sampai 1.0).
   * @returns {number} Nilai transisi dengan turunan pertama nol di kedua ujung interval.
   */
  smooth: (t) => t * t * (3 - 2 * t),
};

/* ======================== ALIAS & HELPER ZOMBIE ========================
   Menyatukan fungsi-fungsi yang dipakai Zombie (sebelumnya di zombie/libs.js)
   agar langsung menggunakan V3 dan M4 dari core/math.js tanpa duplikasi.   */

/**
 * Shorthand helper pembuatan matriks transformasi dasar.
 */
export const m4 = {
  I: M4.identity,
  T: M4.translation,
  S: M4.scaling,
  /** @param {number} a - Sudut rotasi sumbu X dalam radian. */
  X: (a) => M4.rotationX(a),
  /** @param {number} a - Sudut rotasi sumbu Y dalam radian. */
  Y: (a) => M4.rotationY(a),
  /** @param {number} a - Sudut rotasi sumbu Z dalam radian. */
  Z: (a) => M4.rotationZ(a),
};

export const M = M4.chain;
export const axisRot = M4.rotationAxis;
export const inv = M4.invert;
export const persp = M4.perspective;
export const look = M4.lookAt;
export const sub = V3.sub;
export const nrm = V3.norm;
export const cr = V3.cross;
export const dt = V3.dot;

/**
 * Melakukan transpose matriks 4x4 (menukar baris menjadi kolom).
 * Digunakan untuk pemetaan normal matriks dan format data seragam GLSL.
 * @param {Array<number>|Float32Array} a - Matriks 4x4 input (16 elemen) yang akan dibalik baris dan kolomnya.
 * @returns {Array<number>} Array 16 elemen hasil transpose.
 */
export function tr(a) {
  return [
    a[0], a[4], a[8], a[12],
    a[1], a[5], a[9], a[13],
    a[2], a[6], a[10], a[14],
    a[3], a[7], a[11], a[15],
  ];
}

/**
 * Membuat matriks proyeksi ortografis (proyeksi sejajar tanpa distorsi perspektif kedalaman).
 * @param {number} l - Batas koordinat sisi kiri (left volume clipping).
 * @param {number} r - Batas koordinat sisi kanan (right volume clipping).
 * @param {number} b - Batas koordinat sisi bawah (bottom volume clipping).
 * @param {number} t - Batas koordinat sisi atas (top volume clipping).
 * @param {number} n - Jarak bidang dekat (near plane).
 * @param {number} f - Jarak bidang jauh (far plane).
 * @returns {Float32Array} Matriks ortografis 4x4 untuk kamera shadow map.
 */
export function ortho(l, r, b, t, n, f) {
  const o = new Float32Array(16);
  o[0] = 2 / (r - l);
  o[5] = 2 / (t - b);
  o[10] = -2 / (f - n);
  o[12] = -(r + l) / (r - l);
  o[13] = -(t + b) / (t - b);
  o[14] = -(f + n) / (f - n);
  o[15] = 1;
  return o;
}

/**
 * Membangun matriks transformasi silinder yang menghubungkan tepat dari titik A ke titik B.
 * Menggabungkan translasi ke titik tengah, rotasi penyelarasan arah, dan penskalaan panjang.
 * @param {Array<number>} A - Koordinat titik pangkal [x, y, z] (misal sendi bahu atau pangkal paha).
 * @param {Array<number>} B - Koordinat titik ujung [x, y, z] (misal sendi siku atau lutut).
 * @returns {Float32Array} Matriks 4x4 komposit untuk menggambar segmen tulang/lengan silinder.
 */
export function segBetween(A, B) {
  const d = sub(B, A),
    len = Math.hypot(...d),
    n = nrm(d);
  const ax = [n[2], 0, -n[0]],
    s = Math.hypot(...ax);
  const R =
    s < 1e-6
      ? n[1] > 0
        ? m4.I()
        : m4.X(Math.PI)
      : axisRot(ax, Math.atan2(s, n[1]));
  return M(
    m4.T((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2),
    R,
    m4.S(1, len, 1),
  );
}

// Alias kompatibilitas penuh untuk semua modul (graveyard, house, highway, drone, main)
M4.mul = M4.multiply;
M4.persp = M4.perspective;
M4.look = M4.lookAt;
M4.inv = M4.invert;
M4.xf = M4.transformPoint;
M4.xd = M4.transformDir;

export const mul = M4.multiply;
export const add = V3.add;
export const cross = V3.cross;
export const dot = V3.dot;

/**
 * Interpolasi linear skalar antara nilai bilangan a dan b.
 * @param {number} a - Nilai skalar awal saat t = 0.
 * @param {number} b - Nilai skalar akhir saat t = 1.
 * @param {number} t - Faktor persentase interpolasi (0.0 sampai 1.0).
 * @returns {number} Nilai skalar perantara.
 */
export const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Mengonversi kode warna heksadesimal web menjadi format warna normalisasi RGB [0.0 - 1.0].
 * @param {string} s - String hex color diawali tanda pagar (misal: "#68b23f").
 * @returns {Array<number>} Array 3 elemen [r, g, b] dalam rentang float 0.0 sampai 1.0 untuk seragam uniform WebGL.
 */
export const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);

/**
 * Melakukan transformasi rotasi terhadap titik poros (pivot point) tertentu: T(pivot) · R · T(-pivot).
 * @param {Array<number>} pivot - Koordinat pusat rotasi [x, y, z] yang menjadi engsel putaran.
 * @param {Float32Array|Array<number>} rotationMatrix - Matriks rotasi murni yang ingin diterapkan pada pivot tersebut.
 * @returns {Float32Array} Matriks gabungan hasil rotasi berporos pada titik pivot.
 */
export function pivotRot(pivot, rotationMatrix) {
  return M(
    m4.T(pivot[0], pivot[1], pivot[2]),
    rotationMatrix,
    m4.T(-pivot[0], -pivot[1], -pivot[2]),
  );
}

/**
 * Fungsi Hash pseudo-random 2D deterministik.
 * @param {number} x - Koordinat input sumbu horizontal X.
 * @param {number} y - Koordinat input sumbu vertikal Y.
 * @returns {number} Bilangan acak pseudo-deterministik float antara 0.0 sampai 1.0.
 */
export const hash2 = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/**
 * Menghasilkan nilai tekstur noise 2D terinterpolasi halus (Value Noise).
 * @param {number} x - Koordinat ruang X.
 * @param {number} y - Koordinat ruang Y (misal koordinat bidang gundukan tanah kuburan).
 * @returns {number} Ketinggian/variasi noise halus pada koordinat (x, y).
 */
export function valueNoise(x, y) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const fx = x - xi,
    fy = y - yi;
  const u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi),
    b = hash2(xi + 1, yi),
    c = hash2(xi, yi + 1),
    d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/**
 * Fractal Brownian Motion (FBM) multi-oktaf berbasis Value Noise.
 * Menggabungkan beberapa layer frekuensi noise untuk menciptakan kontur tanah dan rumput alami.
 * @param {number} x - Koordinat spasial sumbu X.
 * @param {number} y - Koordinat spasial sumbu Y.
 * @returns {number} Nilai elevasi/fraktal multi-frekuensi bernilai normal.
 */
export function fbm(x, y) {
  return (
    (0.5 * valueNoise(x, y) + 0.25 * valueNoise(x * 2, y * 2) + 0.125 * valueNoise(x * 4, y * 4)) /
    0.875
  );
}

/**
 * Fungsi Smoothstep: Menginterpolasi nilai transisi dengan batasan threshold bawah dan atas.
 * @param {number} a - Batas bawah ambang rentang (saat nilai output bernilai 0).
 * @param {number} b - Batas atas ambang rentang (saat nilai output mencapai 1).
 * @param {number} v - Nilai masukan penguji.
 * @returns {number} Nilai interpolasi halus berbentuk kurva S [0.0 - 1.0].
 */
export const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
