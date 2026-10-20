/* =========================================================================
   math.js — Library vektor & matriks 4x4 (column-major, sama seperti WebGL)
   Ditulis sendiri, TANPA library eksternal (tidak memakai Three.js / glMatrix)
   ========================================================================= */

export const V3 = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm(a) { const l = Math.hypot(a[0], a[1], a[2]); return l < 1e-9 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};

export const M4 = {
  identity() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },

  /** out = a * b  (b diterapkan dulu ke titik, lalu a) */
  multiply(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  },
  chain(...ms) { return ms.reduce((acc, m) => M4.multiply(acc, m)); },

  /* ---------------- TRANSLATE ---------------- */
  translation(x, y, z) { const m = M4.identity(); m[12] = x; m[13] = y; m[14] = z; return m; },

  /* ---------------- SCALING ------------------ */
  scaling(x, y, z) { const m = M4.identity(); m[0] = x; m[5] = y; m[10] = z; return m; },

  /* ---------------- ROTATE (sumbu utama) ----- */
  rotationX(a, c = Math.cos(a), s = Math.sin(a)) { const m = M4.identity(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
  rotationY(a, c = Math.cos(a), s = Math.sin(a)) { const m = M4.identity(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
  rotationZ(a, c = Math.cos(a), s = Math.sin(a)) { const m = M4.identity(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },

  /* ---------------- ROTATE ARBITRARY AXIS ----
     Rotasi sebesar `angle` terhadap garis yang melewati titik P dengan arah u.
     Metode klasik Grafkom (7 langkah):
       M = T(P) · Rx(-α) · Ry(-β) · Rz(θ) · Ry(β) · Rx(α) · T(-P)
       1. T(-P)  : geser garis supaya melewati titik asal
       2. Rx(α)  : putar terhadap X sampai u berada di bidang XZ
       3. Ry(β)  : putar terhadap Y sampai u berimpit dengan sumbu Z
       4. Rz(θ)  : rotasi yang diinginkan
       5-7.      : kembalikan dengan invers langkah 3, 2, 1
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

  /** Rumus Rodrigues (hasilnya identik dengan rotateArbitraryAxis untuk P = 0). Dipakai sebagai pembanding/tes. */
  rotationAxis(axis, angle) {
    const [x, y, z] = V3.norm(axis), c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
    const m = M4.identity();
    m[0] = t * x * x + c;     m[1] = t * x * y + s * z; m[2] = t * x * z - s * y;
    m[4] = t * x * y - s * z; m[5] = t * y * y + c;     m[6] = t * y * z + s * x;
    m[8] = t * x * z + s * y; m[9] = t * y * z - s * x; m[10] = t * z * z + c;
    return m;
  },

  perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), m = new Float32Array(16);
    m[0] = f / aspect; m[5] = f; m[10] = (far + near) / (near - far); m[11] = -1; m[14] = (2 * far * near) / (near - far);
    return m;
  },

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

  /** Matriks normal 3x3 = transpose(invers(3x3 kiri-atas)) */
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

  transformPoint(m, p) {
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15] || 1;
    return [(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w,
            (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w,
            (m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]) / w];
  },
  transformDir(m, d) {
    return [m[0] * d[0] + m[4] * d[1] + m[8] * d[2], m[1] * d[0] + m[5] * d[1] + m[9] * d[2], m[2] * d[0] + m[6] * d[1] + m[10] * d[2]];
  },

  /** Matriks dari basis (x, y, z) dan posisi p — dipakai untuk menempelkan objek ke permukaan */
  basis(x, y, z, p = [0, 0, 0]) {
    const m = M4.identity();
    m[0] = x[0]; m[1] = x[1]; m[2] = x[2];
    m[4] = y[0]; m[5] = y[1]; m[6] = y[2];
    m[8] = z[0]; m[9] = z[1]; m[10] = z[2];
    m[12] = p[0]; m[13] = p[1]; m[14] = p[2];
    return m;
  },
  /** Orientasi yang membuat sumbu lokal +Z menghadap `fwd`, dengan +Y sedekat mungkin ke `up` */
  facing(fwd, up = [0, 1, 0], p = [0, 0, 0]) {
    const z = V3.norm(fwd);
    let x = V3.cross(up, z);
    if (V3.len(x) < 1e-6) x = V3.cross([1, 0, 0], z);
    x = V3.norm(x);
    return M4.basis(x, V3.cross(z, x), z, p);
  },

  /** Matriks rotasi yang memutar sumbu +Y ke arah `dir` */
  alignY(dir) {
    const d = V3.norm(dir), y = [0, 1, 0];
    const ax = V3.cross(y, d), s = V3.len(ax), c = V3.dot(y, d);
    if (s < 1e-6) return c > 0 ? M4.identity() : M4.rotationX(Math.PI);
    return M4.rotationAxis(ax, Math.atan2(s, c));
  },
};

/* ------------------------------ Easing ---------------------------------- */
export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const seg = (p, a, b) => clamp01((p - a) / (b - a));
export const Ease = {
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
  smooth: (t) => t * t * (3 - 2 * t),
};
