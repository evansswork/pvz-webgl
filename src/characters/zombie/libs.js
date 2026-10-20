"use strict";

/**
 * ==============================================================================
 * MODUL MATEMATIKA & TRANSFORMASI 3D (libs.js)
 * ==============================================================================
 * Menyediakan operasi aljabar linier, manipulasi matriks 4x4 berformat column-major,
 * kalkulasi vektor 3D, proyeksi kamera, dan rotasi sumbu arbitrer untuk WebGL.
 * ==============================================================================
 */

/**
 * m4: Kumpulan fungsi generator matriks transformasi dasar 4x4 (Column-Major).
 */
const m4 = {
  /**
   * Menghasilkan Matriks Identitas 4x4.
   * Matriks netral di mana mengalikan matriks ini tidak mengubah nilai objek.
   * @returns {Array<number>} Array 16 elemen matriks identitas
   */
  I() {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  },

  /**
   * Menghasilkan Matriks Translasi (pergeseran posisi di ruang 3D).
   * @param {number} x - Pergeseran sumbu X
   * @param {number} y - Pergeseran sumbu Y
   * @param {number} z - Pergeseran sumbu Z
   * @returns {Array<number>} Matriks translasi 4x4
   */
  T(x, y, z) {
    return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
  },

  /**
   * Menghasilkan Matriks Skalasi (perbesaran/pengecilan objek).
   * @param {number} x - Faktor skala sumbu X
   * @param {number} y - Faktor skala sumbu Y
   * @param {number} z - Faktor skala sumbu Z
   * @returns {Array<number>} Matriks skalasi 4x4
   */
  S(x, y, z) {
    return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1];
  },

  /**
   * Menghasilkan Matriks Rotasi terhadap sumbu X (Pitch).
   * @param {number} a - Sudut rotasi dalam satuan radian
   * @returns {Array<number>} Matriks rotasi sumbu X 4x4
   */
  X(a) {
    const c = Math.cos(a),
      s = Math.sin(a);
    return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
  },

  /**
   * Menghasilkan Matriks Rotasi terhadap sumbu Y (Yaw).
   * @param {number} a - Sudut rotasi dalam satuan radian
   * @returns {Array<number>} Matriks rotasi sumbu Y 4x4
   */
  Y(a) {
    const c = Math.cos(a),
      s = Math.sin(a);
    return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
  },

  /**
   * Menghasilkan Matriks Rotasi terhadap sumbu Z (Roll).
   * @param {number} a - Sudut rotasi dalam satuan radian
   * @returns {Array<number>} Matriks rotasi sumbu Z 4x4
   */
  Z(a) {
    const c = Math.cos(a),
      s = Math.sin(a);
    return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  },
};

/**
 * Mengalikan dua buah matriks 4x4: output = a * b (Column-Major).
 * Digunakan untuk menggabungkan transformasi geometri.
 * @param {Array<number>} a - Matriks pertama (16 elemen)
 * @param {Array<number>} b - Matriks kedua (16 elemen)
 * @returns {Array<number>} Matriks hasil perkalian (16 elemen)
 */
function mul(a, b) {
  const o = new Array(16);
  for (let i = 0; i < 4; i++) {
    const b0 = b[i * 4],
      b1 = b[i * 4 + 1],
      b2 = b[i * 4 + 2],
      b3 = b[i * 4 + 3];
    for (let r = 0; r < 4; r++)
      o[i * 4 + r] =
        b0 * a[r] + b1 * a[4 + r] + b2 * a[8 + r] + b3 * a[12 + r];
  }
  return o;
}

/**
 * M: Mengalikan rantai matriks secara berurutan dari kiri ke kanan.
 * Contoh: M(A, B, C) = (A * B) * C
 * @param {...Array<number>} ms - Daftar matriks 4x4 yang akan dikalikan
 * @returns {Array<number>} Matriks hasil perkalian gabungan
 */
function M(...ms) {
  return ms.reduce((a, b) => mul(a, b));
}

/**
 * axisRot: Menghasilkan matriks rotasi terhadap sumbu arbitrer sembarang (Rodrigues' Rotation Formula).
 * @param {Array<number>} ax - Vektor sumbu rotasi [x, y, z]
 * @param {number} a - Sudut rotasi dalam satuan radian
 * @returns {Array<number>} Matriks rotasi 4x4
 */
function axisRot(ax, a) {
  const l = Math.hypot(...ax) || 1,
    x = ax[0] / l,
    y = ax[1] / l,
    z = ax[2] / l,
    c = Math.cos(a),
    s = Math.sin(a),
    k = 1 - c;
  return [
    x * x * k + c,
    y * x * k + z * s,
    z * x * k - y * s,
    0,
    x * y * k - z * s,
    y * y * k + c,
    z * y * k + x * s,
    0,
    x * z * k + y * s,
    y * z * k - x * s,
    z * z * k + c,
    0,
    0,
    0,
    0,
    1,
  ];
}

/**
 * inv: Menghitung invers dari matriks 4x4.
 * Digunakan untuk:
 * 1. Mengubah koordinat dunia kembali ke koordinat lokal.
 * 2. Menghitung Normal Matrix = transpose(inverse(WorldMatrix)).
 * @param {Array<number>} a - Matriks 4x4 yang akan dibalik
 * @returns {Array<number>} Matriks invers 4x4 (atau matriks identitas jika singular/det=0)
 */
function inv(a) {
  const [
    a00, a01, a02, a03,
    a10, a11, a12, a13,
    a20, a21, a22, a23,
    a30, a31, a32, a33,
  ] = a;
  const b00 = a00 * a11 - a01 * a10,
    b01 = a00 * a12 - a02 * a10,
    b02 = a00 * a13 - a03 * a10,
    b03 = a01 * a12 - a02 * a11,
    b04 = a01 * a13 - a03 * a11,
    b05 = a02 * a13 - a03 * a12,
    b06 = a20 * a31 - a21 * a30,
    b07 = a20 * a32 - a22 * a30,
    b08 = a20 * a33 - a23 * a30,
    b09 = a21 * a32 - a22 * a31,
    b10 = a21 * a33 - a23 * a31,
    b11 = a22 * a33 - a23 * a32;
  let d =
    b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!d) return m4.I();
  d = 1 / d;
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * d,
    (a02 * b10 - a01 * b11 - a03 * b09) * d,
    (a31 * b05 - a32 * b04 + a33 * b03) * d,
    (a22 * b04 - a21 * b05 - a23 * b03) * d,
    (a12 * b08 - a10 * b11 - a13 * b07) * d,
    (a00 * b11 - a02 * b08 + a03 * b07) * d,
    (a32 * b02 - a30 * b05 - a33 * b01) * d,
    (a20 * b05 - a22 * b02 + a23 * b01) * d,
    (a10 * b10 - a11 * b08 + a13 * b06) * d,
    (a01 * b08 - a00 * b10 - a03 * b06) * d,
    (a30 * b04 - a31 * b02 + a33 * b00) * d,
    (a21 * b02 - a20 * b04 - a23 * b00) * d,
    (a11 * b07 - a10 * b09 - a12 * b06) * d,
    (a00 * b09 - a01 * b07 + a02 * b06) * d,
    (a31 * b01 - a30 * b03 - a32 * b00) * d,
    (a20 * b03 - a21 * b01 + a22 * b00) * d,
  ];
}

/**
 * tr: Menghitung transposisi matriks 4x4 (menukar baris menjadi kolom).
 * Berguna saat menghitung matriks normal untuk shader.
 * @param {Array<number>} a - Matriks 4x4
 * @returns {Array<number>} Matriks transpose 4x4
 */
function tr(a) {
  return [
    a[0], a[4], a[8], a[12],
    a[1], a[5], a[9], a[13],
    a[2], a[6], a[10], a[14],
    a[3], a[7], a[11], a[15],
  ];
}

/**
 * persp: Menghasilkan matriks proyeksi perspektif 3D.
 * Menghasilkan ilusi kedalaman (objek yang jauh terlihat lebih kecil).
 * @param {number} f - Field of View (FOV) dalam satuan radian
 * @param {number} as - Rasio aspek viewport (width / height)
 * @param {number} n - Jarak bidang dekat (near clipping plane)
 * @param {number} fa - Jarak bidang jauh (far clipping plane)
 * @returns {Array<number>} Matriks proyeksi perspektif 4x4
 */
function persp(f, as, n, fa) {
  const t = 1 / Math.tan(f / 2),
    nf = 1 / (n - fa),
    o = new Array(16).fill(0);
  o[0] = t / as;
  o[5] = t;
  o[10] = (fa + n) * nf;
  o[11] = -1;
  o[14] = 2 * fa * n * nf;
  return o;
}

/**
 * look: Menghasilkan matriks pandangan kamera (View Matrix / Look-At).
 * Memposisikan dan mengarahkan kamera di ruang 3D.
 * @param {Array<number>} e - Posisi mata kamera (eye) [x, y, z]
 * @param {Array<number>} c - Titik target fokus kamera (center) [x, y, z]
 * @param {Array<number>} u - Vektor arah atas dunia (up vector, biasanya [0, 1, 0])
 * @returns {Array<number>} Matriks view 4x4
 */
function look(e, c, u) {
  let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]];
  z = nrm(z);
  let x = nrm(cr(u, z));
  const y = cr(z, x);
  return [
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dt(x, e), -dt(y, e), -dt(z, e), 1,
  ];
}

/**
 * cr: Perkalian silang (Cross Product) dua vektor 3D: a x b.
 * Menghasilkan vektor yang tegak lurus terhadap kedua vektor input.
 * @param {Array<number>} a - Vektor pertama [x, y, z]
 * @param {Array<number>} b - Vektor kedua [x, y, z]
 * @returns {Array<number>} Vektor hasil cross product
 */
const cr = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/**
 * dt: Perkalian titik (Dot Product) dua vektor 3D: a . b.
 * Menghitung skalar yang merefleksikan kosinus sudut antara kedua vektor.
 * @param {Array<number>} a - Vektor pertama [x, y, z]
 * @param {Array<number>} b - Vektor kedua [x, y, z]
 * @returns {number} Nilai skalar dot product
 */
const dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/**
 * nrm: Normalisasi vektor 3D (mengubah panjang vektor menjadi 1 unit / unit vector).
 * @param {Array<number>} a - Vektor input [x, y, z]
 * @returns {Array<number>} Unit vektor hasil normalisasi
 */
const nrm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * sub: Pengurangan vektor 3D: a - b.
 * @param {Array<number>} a - Vektor pertama [x, y, z]
 * @param {Array<number>} b - Vektor kedua [x, y, z]
 * @returns {Array<number>} Vektor selisih [ax-bx, ay-by, az-bz]
 */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

/**
 * seg: Menghasilkan matriks transformasi untuk menempatkan mesh silinder (berorientasi sumbu Y dan tinggi 1)
 * agar membentang tepat di antara titik A dan titik B di ruang 3D.
 * @param {Array<number>} A - Titik pangkal [x, y, z]
 * @param {Array<number>} B - Titik ujung [x, y, z]
 * @returns {Array<number>} Matriks transformasi gabungan (Translasi * Rotasi * Skalasi)
 */
function seg(A, B) {
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

/**
 * ortho: Menghasilkan matriks proyeksi ortografis (Orthographic Projection).
 * Digunakan oleh kamera cahaya directional untuk merender shadow depth map (tanpa distorsi perspektif).
 * @param {number} l - Batas kiri (left)
 * @param {number} r - Batas kanan (right)
 * @param {number} b - Batas bawah (bottom)
 * @param {number} t - Batas atas (top)
 * @param {number} n - Jarak bidang dekat (near)
 * @param {number} f - Jarak bidang jauh (far)
 * @returns {Array<number>} Matriks proyeksi ortografis 4x4
 */
function ortho(l, r, b, t, n, f) {
  const o = new Array(16).fill(0);
  o[0] = 2 / (r - l);
  o[5] = 2 / (t - b);
  o[10] = -2 / (f - n);
  o[12] = -(r + l) / (r - l);
  o[13] = -(t + b) / (t - b);
  o[14] = -(f + n) / (f - n);
  o[15] = 1;
  return o;
}

export { m4, M, sub, nrm, tr, inv, seg, axisRot, cr, dt, persp, look, ortho };
