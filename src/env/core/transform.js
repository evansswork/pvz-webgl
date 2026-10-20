/**
 * ==============================================================================
 * CORE TRANSFORM MODULE
 * ==============================================================================
 * Mengimplementasikan 5 prinsip transformasi grafika komputer:
 * 1. TRANSLATE            : Perpindahan posisi objek di ruang 3D
 * 2. ROTATE               : Rotasi terhadap sumbu utama (X, Y, Z)
 * 3. SCALING              : Penskalaan ukuran objek per-sumbu atau seragam
 * 4. ROTATE ARBITRARY AXIS: Rotasi terhadap sumbu sembarang (rumus Rodrigues)
 * 5. HIERARCHICAL         : Perkalian matriks bertingkat (World -> Parent -> Child)
 * ==============================================================================
 */

// Format matriks: Float32Array atau Array 16 elemen, urutan Column-Major (OpenGL/WebGL standard)
// Kolom 0: [m0,  m1,  m2,  m3 ] -> X-axis vector
// Kolom 1: [m4,  m5,  m6,  m7 ] -> Y-axis vector
// Kolom 2: [m8,  m9,  m10, m11] -> Z-axis vector
// Kolom 3: [m12, m13, m14, m15] -> Translation (Tx, Ty, Tz, 1)

export const m4 = {
  // Matriks Identitas (I)
  I() {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ];
  },

  // 1. TRANSLATE: Geser koordinat sejauh (tx, ty, tz)
  T(tx, ty, tz) {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      tx, ty, tz, 1,
    ];
  },

  // 3. SCALING: Skala ukuran per sumbu (sx, sy, sz)
  S(sx, sy, sz) {
    return [
      sx, 0, 0, 0,
      0, sy, 0, 0,
      0, 0, sz, 0,
      0, 0, 0, 1,
    ];
  },

  // 2. ROTATE X: Putar terhadap sumbu X sebesar rad radian
  X(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return [
      1,  0, 0, 0,
      0,  c, s, 0,
      0, -s, c, 0,
      0,  0, 0, 1,
    ];
  },

  // 2. ROTATE Y: Putar terhadap sumbu Y sebesar rad radian
  Y(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return [
      c, 0, -s, 0,
      0, 1,  0, 0,
      s, 0,  c, 0,
      0, 0,  0, 1,
    ];
  },

  // 2. ROTATE Z: Putar terhadap sumbu Z sebesar rad radian
  Z(rad) {
    const c = Math.cos(rad), s = Math.sin(rad);
    return [
       c, s, 0, 0,
      -s, c, 0, 0,
       0, 0, 1, 0,
       0, 0, 0, 1,
    ];
  },
};

/**
 * Perkalian dua matriks 4x4: O = A * B (kolom-mayor)
 */
export function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4 + 0],
          b1 = b[c * 4 + 1],
          b2 = b[c * 4 + 2],
          b3 = b[c * 4 + 3];
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[r] * b0 +
        a[r + 4] * b1 +
        a[r + 8] * b2 +
        a[r + 12] * b3;
    }
  }
  return o;
}

/**
 * 5. HIERARCHICAL TRANSFORMATION:
 * Menggabungkan rantai transformasi bertingkat dari induk ke anak.
 * M(M_world, M_parent, M_child, M_local)
 */
export function M(...matrices) {
  return matrices.reduce((acc, curr) => mul(acc, curr));
}

/**
 * 4. ROTATE ARBITRARY AXIS:
 * Rotasi terhadap sumbu sembarang ax = [x, y, z] sebesar rad radian.
 * Menggunakan formulasi rotasi Rodrigues dalam representasi matriks 4x4.
 * Sumbu ax dinormalisasi secara otomatis.
 */
export function axisRot(ax, rad) {
  const l = Math.hypot(ax[0], ax[1], ax[2]) || 1;
  const x = ax[0] / l,
        y = ax[1] / l,
        z = ax[2] / l;
  const c = Math.cos(rad),
        s = Math.sin(rad),
        k = 1 - c;

  return [
    x * x * k + c,     y * x * k + z * s, z * x * k - y * s, 0,
    x * y * k - z * s, y * y * k + c,     z * y * k + x * s, 0,
    x * z * k + y * s, y * z * k - x * s, z * z * k + c,     0,
    0,                 0,                 0,                 1,
  ];
}

/**
 * Rotasi terhadap titik tumpu (pivot point) tertentu:
 * T(pivot) * R * T(-pivot)
 */
export function pivotRot(pivot, rotationMatrix) {
  return M(
    m4.T(pivot[0], pivot[1], pivot[2]),
    rotationMatrix,
    m4.T(-pivot[0], -pivot[1], -pivot[2])
  );
}

/**
 * Invers matriks 4x4
 */
export function inv(a) {
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

  let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
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
 * Transpose matriks 4x4
 */
export function tr(a) {
  return [
    a[0], a[4], a[8],  a[12],
    a[1], a[5], a[9],  a[13],
    a[2], a[6], a[10], a[14],
    a[3], a[7], a[11], a[15],
  ];
}

// Proyeksi Perspektif
export function persp(fov, aspect, near, far) {
  const t = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  const o = new Array(16).fill(0);
  o[0] = t / aspect;
  o[5] = t;
  o[10] = (far + near) * nf;
  o[11] = -1;
  o[14] = 2 * far * near * nf;
  return o;
}

// Proyeksi Ortografis
export function ortho(l, r, b, t, n, f) {
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

// Kamera LookAt
export function look(eye, target, up) {
  let z = [eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]];
  z = nrm(z);
  let x = nrm(cross(up, z));
  const y = cross(z, x);

  return [
    x[0], y[0], z[0], 0,
    x[1], y[1], z[1], 0,
    x[2], y[2], z[2], 0,
    -dot(x, eye), -dot(y, eye), -dot(z, eye), 1,
  ];
}

// Vector math utilities
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const nrm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const lerp = (a, b, t) => a + (b - a) * t;
export const lerp3 = (a, b, t) => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
