// ============ MATRIKS ============
const M4 = {
  mul(a, b) {
    const o = new Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        o[c * 4 + r] =
          a[r] * b[c * 4] +
          a[r + 4] * b[c * 4 + 1] +
          a[r + 8] * b[c * 4 + 2] +
          a[r + 12] * b[c * 4 + 3];
      }
    }
    return o;
  },
  persp(f, a, n, z) {
    const t = 1 / Math.tan(f / 2),
      r = 1 / (n - z);
    return [
      t / a,
      0,
      0,
      0,
      0,
      t,
      0,
      0,
      0,
      0,
      (z + n) * r,
      -1,
      0,
      0,
      2 * z * n * r,
      0,
    ];
  },
  look(e, c, u) {
    let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]];
    let l = Math.hypot(...z) || 1;
    z = [z[0] / l, z[1] / l, z[2] / l];
    let x = [
      u[1] * z[2] - u[2] * z[1],
      u[2] * z[0] - u[0] * z[2],
      u[0] * z[1] - u[1] * z[0],
    ];
    l = Math.hypot(...x) || 1;
    x = [x[0] / l, x[1] / l, x[2] / l];
    let y = [
      z[1] * x[2] - z[2] * x[1],
      z[2] * x[0] - z[0] * x[2],
      z[0] * x[1] - z[1] * x[0],
    ];
    return [
      x[0],
      y[0],
      z[0],
      0,
      x[1],
      y[1],
      z[1],
      0,
      x[2],
      y[2],
      z[2],
      0,
      -x[0] * e[0] - x[1] * e[1] - x[2] * e[2],
      -y[0] * e[0] - y[1] * e[1] - y[2] * e[2],
      -z[0] * e[0] - z[1] * e[1] - z[2] * e[2],
      1,
    ];
  },
  inv(a) {
    const [
      a00,
      a01,
      a02,
      a03,
      a10,
      a11,
      a12,
      a13,
      a20,
      a21,
      a22,
      a23,
      a30,
      a31,
      a32,
      a33,
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
    let det =
      b00 * b11 -
      b01 * b10 +
      b02 * b09 +
      b03 * b08 -
      b04 * b07 +
      b05 * b06;
    if (!det) return null;
    det = 1.0 / det;
    return [
      (a11 * b11 - a12 * b10 + a13 * b09) * det,
      (a02 * b10 - a01 * b11 - a03 * b09) * det,
      (a31 * b05 - a32 * b04 + a33 * b03) * det,
      (a22 * b04 - a21 * b05 - a23 * b03) * det,
      (a12 * b08 - a10 * b11 - a13 * b07) * det,
      (a00 * b11 - a02 * b08 + a03 * b07) * det,
      (a32 * b02 - a30 * b05 - a33 * b01) * det,
      (a20 * b05 - a22 * b02 + a23 * b01) * det,
      (a10 * b10 - a11 * b08 + a13 * b06) * det,
      (a01 * b08 - a00 * b10 - a03 * b06) * det,
      (a30 * b04 - a31 * b02 + a33 * b00) * det,
      (a21 * b02 - a20 * b04 - a23 * b00) * det,
      (a11 * b07 - a10 * b09 - a12 * b06) * det,
      (a00 * b09 - a01 * b07 + a02 * b06) * det,
      (a31 * b01 - a30 * b03 - a32 * b00) * det,
      (a20 * b03 - a21 * b01 + a22 * b00) * det,
    ];
  },
  xf(m, v) {
    const w = m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15];
    return [
      (m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12]) / w,
      (m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13]) / w,
      (m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]) / w,
    ];
  },
  xd(m, v) {
    return [
      m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
      m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2],
    ];
  },
};

// ---- noise sederhana (nilai acak yang dihaluskan), untuk tinggi tanah ----
const hash2 = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function valueNoise(x, y) {
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
function fbm(x, y) {
  // 3 lapis noise, makin halus makin lemah -> hasil 0..1
  return (
    (0.5 * valueNoise(x, y) + 0.25 * valueNoise(x * 2, y * 2) + 0.125 * valueNoise(x * 4, y * 4)) /
    0.875
  );
}
const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export { M4, hash2, valueNoise, fbm, smoothstep, clamp01 };
