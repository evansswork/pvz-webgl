import { gl, U, ID4 } from "./webgl.js";
import { M4 } from "./libs.js";
import { KINDS, hx, UM } from "./geometry.js";

/* ---------- POHON PROSEDURAL ----------
   Disusun di ruang lokal objek (sumbu Z lokal = atas):
   akar & pangkal melebar -> batang besar meruncing -> cabang -> kanopi gumpalan daun */
const TM = {
  T: (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1],
  S: (x, y, z) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1],
  // rotasi yang memutar sumbu +Z ke arah d (rumus Rodrigues)
  align(d) {
    const l = Math.hypot(d[0], d[1], d[2]) || 1,
      x = d[0] / l,
      y = d[1] / l,
      z = d[2] / l;
    const s = Math.hypot(x, y);
    if (s < 1e-6) return z > 0 ? ID4 : TM.S(1, -1, -1);
    const kx = -y / s,
      ky = x / s,
      c = z,
      t = 1 - c;
    return [
      t * kx * kx + c, t * kx * ky, -s * ky, 0,
      t * kx * ky, t * ky * ky + c, s * kx, 0,
      s * ky, -s * kx, c, 0,
      0, 0, 0, 1,
    ];
  },
};
function buildTree(ob, idx) {
  const m = ob.matrix;
  // skala tiap sumbu lokal -> bangun pohon di ruang berskala seragam agar tidak gepeng
  const sx = Math.hypot(m[0], m[1], m[2]),
    sy = Math.hypot(m[4], m[5], m[6]),
    sz = Math.hypot(m[8], m[9], m[10]);
  let seed = (idx + 1) * 7919 + 104729;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const c = [ob.pusat[0] * sx, ob.pusat[1] * sy, ob.pusat[2] * sz];
  const e = [
    Math.abs(ob.ukuran[0] * sx),
    Math.abs(ob.ukuran[1] * sy),
    Math.abs(ob.ukuran[2] * sz),
  ];
  const H = e[2] * 2,
    z0 = c[2] - e[2];
  const Sinv = TM.S(1 / sx, 1 / sy, 1 / sz);
  const parts = [];
  // legend: indeks KINDS untuk mode "Shape asli"
  const add = (r, legend, col, ctr, dir, hx, hy, hz) =>
    parts.push({
      r,
      legend,
      col,
      M: M4.mul(Sinv, M4.mul(TM.T(...ctr), M4.mul(TM.align(dir), TM.S(hx, hy, hz)))),
    });
  // bentuk sepanjang ruas A->B (silinder/frustum/kerucut, sumbu Z unit = arah ruas)
  const seg = (r, legend, col, A, B, rad) => {
    const d = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
    add(r, legend, col, [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2], d, rad, rad, Math.hypot(...d) / 2);
  };
  const lerp = (A, B, t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];

  const bark = ob.warna,
    barkD = bark.map((v) => v * 0.65);
  const r0 = 0.07 * H; // jari-jari pangkal batang (batang besar)
  const C = [c[0], c[1], z0 + 0.66 * H]; // pusat kanopi
  const Rx = e[0] * 0.8,
    Ry = e[1] * 0.8,
    Rz = 0.3 * H;

  // --- batang: 2 ruas meruncing, sedikit condong ke pusat kanopi ---
  const B = [c[0] * 0.55, c[1] * 0.55, z0 - 0.02 * H];
  const Tp = [C[0], C[1], z0 + 0.62 * H];
  const Md = lerp(B, Tp, 0.45);
  Md[0] += (rnd() - 0.5) * r0 * 1.2;
  Md[1] += (rnd() - 0.5) * r0 * 1.2;
  seg(5, 1, bark, B, Md, r0);
  add(4, 1, bark, Md, [0, 0, 1], r0 * 0.76, r0 * 0.76, r0 * 0.76); // sambungan ruas
  seg(5, 1, bark, Md, Tp, r0 * 0.75);
  // pucuk batang utama menembus kanopi
  seg(5, 1, bark, Tp, [C[0], C[1], C[2] + 0.45 * Rz], r0 * 0.56);

  // --- pangkal melebar + akar yang menjalar di tanah ---
  add(4, 1, barkD, [B[0], B[1], z0 + 0.02 * H], [0, 0, 1], r0 * 1.55, r0 * 1.55, 0.08 * H);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 6.2832 + rnd() * 0.6,
      ca = Math.cos(a),
      sa = Math.sin(a);
    const len = r0 * (2.4 + rnd() * 1.2);
    seg(
      2, 2, barkD,
      [B[0] + ca * r0 * 0.5, B[1] + sa * r0 * 0.5, z0 + 0.05 * H],
      [B[0] + ca * len, B[1] + sa * len, z0 - 0.01 * H],
      r0 * 0.42,
    );
  }

  // --- cabang utama: dari batang atas menyebar ke dalam kanopi ---
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * 6.2832 + rnd() * 0.5;
    const S0 = lerp(Md, Tp, 0.35 + rnd() * 0.55);
    const E = [
      C[0] + Math.cos(a) * Rx * 0.62,
      C[1] + Math.sin(a) * Ry * 0.62,
      C[2] - 0.05 * Rz + rnd() * 0.35 * Rz,
    ];
    seg(5, 1, bark, S0, E, r0 * 0.32);
  }

  // --- kanopi: banyak gumpalan daun bergelombang ---
  const leaf = [0.028, 0.06, 0.016];
  const leafCol = (k) => {
    const v = (0.8 + rnd() * 0.4) * k;
    return [leaf[0] * v * (0.85 + rnd() * 0.3), leaf[1] * v, leaf[2] * v * (0.7 + rnd() * 0.6)];
  };
  const tilt = () => [(rnd() - 0.5) * 0.7, (rnd() - 0.5) * 0.7, 1];
  const blob = (ctr, sxr, syr, szr, k) => add(6, 4, leafCol(k), ctr, tilt(), sxr, syr, szr);
  // inti kanopi (lebih gelap karena di dalam)
  blob([C[0], C[1], C[2] + 0.05 * Rz], Rx * 0.62, Ry * 0.62, Rz * 0.62, 0.75);
  // cincin bawah-tengah
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 6.2832 + rnd() * 0.4,
      rr = 0.58 + rnd() * 0.12,
      s = 0.42 + rnd() * 0.12;
    blob(
      [C[0] + Math.cos(a) * Rx * rr, C[1] + Math.sin(a) * Ry * rr, C[2] - 0.12 * Rz + (rnd() - 0.5) * 0.3 * Rz],
      Rx * s, Ry * s, Rz * s * 1.05, 0.9,
    );
  }
  // lapisan atas (lebih terang, terkena cahaya)
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * 6.2832 + rnd() * 0.8;
    blob(
      [C[0] + Math.cos(a) * Rx * 0.3, C[1] + Math.sin(a) * Ry * 0.3, C[2] + 0.42 * Rz],
      Rx * 0.4, Ry * 0.4, Rz * 0.42, 1.12,
    );
  }
  // mahkota puncak
  blob([C[0], C[1], C[2] + 0.68 * Rz], Rx * 0.3, Ry * 0.3, Rz * 0.32, 1.2);
  return parts;
}
// sel = indeks objek yang sedang dipilih (disorot kuning)
function drawTree(ob, i, a, onlyComplex, sel) {
  const parts = ob.treeParts || (ob.treeParts = buildTree(ob, i));
  gl.uniformMatrix4fv(U.uM, false, ob.matrix);
  gl.uniform1f(U.uA, i == sel ? Math.max(a, 0.8) : a);
  gl.uniform3fv(U.uC, [0, 0, 0]);
  gl.uniform3fv(U.uH, [1, 1, 1]);
  for (const p of parts) {
    gl.uniformMatrix4fv(U.uR, false, p.M);
    gl.uniform3fv(
      U.uCol,
      i == sel ? [1, 1, 0.2] : onlyComplex ? p.col : hx(KINDS[p.legend][1]),
    );
    gl.drawArrays(gl.TRIANGLES, UM.ranges[p.r][0], UM.ranges[p.r][1]);
  }
  gl.uniformMatrix4fv(U.uR, false, ID4); // kembalikan agar objek lain normal
}

export { buildTree, drawTree };
