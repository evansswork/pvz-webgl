// ============ BENTUK DASAR (unit mesh) ============
const KINDS = [
  ["Balok (kotak)", "#8c8c8c"],
  ["Silinder tipis", "#36261e"],
  ["Kerucut runcing", "#1b331b"],
  ["Torus (cincin / busur)", "#707070"],
  ["Ellipsoid (mesh bulat)", "#a0a0a0"],
  ["Plane / lempeng pipih", "#1e2e17"],
  ["Proksi organik (Box/Gabungan)", "#293623"],
];
const hx = (h) =>
  [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255);

function unitMeshes() {
  const A = [],
    ranges = [];
  const T = (a, b, c) => A.push(...a, ...b, ...c);
  const q = (a, b, c, d) => {
    T(a, b, c);
    T(a, c, d);
  };
  let s = A.length;
  const P = (x, y, z) => [x, y, z];

  // 0 box
  q(P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1));
  q(P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1), P(1, -1, -1));
  q(P(-1, 1, -1), P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1));
  q(P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1));
  q(P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1));
  q(P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1));
  ranges.push([s / 3, (A.length - s) / 3]);

  // 1 silinder
  const N = 20;
  s = A.length;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 6.2832,
      b = ((i + 1) / N) * 6.2832;
    const x0 = Math.cos(a),
      y0 = Math.sin(a),
      x1 = Math.cos(b),
      y1 = Math.sin(b);
    q(P(x0, y0, -1), P(x1, y1, -1), P(x1, y1, 1), P(x0, y0, 1));
    T(P(0, 0, 1), P(x0, y0, 1), P(x1, y1, 1));
    T(P(0, 0, -1), P(x1, y1, -1), P(x0, y0, -1));
  }
  ranges.push([s / 3, (A.length - s) / 3]);

  // 2 kerucut
  s = A.length;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 6.2832,
      b = ((i + 1) / N) * 6.2832;
    const x0 = Math.cos(a),
      y0 = Math.sin(a),
      x1 = Math.cos(b),
      y1 = Math.sin(b);
    T(P(x0, y0, -1), P(x1, y1, -1), P(0, 0, 1));
    T(P(0, 0, -1), P(x1, y1, -1), P(x0, y0, -1));
  }
  ranges.push([s / 3, (A.length - s) / 3]);

  // 3 torus
  s = A.length;
  const R = 0.7,
    r = 0.3,
    nu = 28,
    nv = 12;
  const tp = (u, v) => {
    const w = R + r * Math.cos(v);
    return P(w * Math.cos(u), w * Math.sin(u), (r * Math.sin(v)) / r);
  };
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const u0 = (i / nu) * 6.2832,
        u1 = ((i + 1) / nu) * 6.2832;
      const v0 = (j / nv) * 6.2832,
        v1 = ((j + 1) / nv) * 6.2832;
      q(tp(u0, v0), tp(u1, v0), tp(u1, v1), tp(u0, v1));
    }
  ranges.push([s / 3, (A.length - s) / 3]);

  // 4 ellipsoid
  s = A.length;
  const sp = (a, b) =>
    P(Math.sin(a) * Math.cos(b), Math.sin(a) * Math.sin(b), Math.cos(a));
  for (let i = 0; i < 12; i++)
    for (let j = 0; j < 20; j++) {
      const a0 = (i / 12) * 3.1416,
        a1 = ((i + 1) / 12) * 3.1416;
      const b0 = (j / 20) * 6.2832,
        b1 = ((j + 1) / 20) * 6.2832;
      q(sp(a0, b0), sp(a1, b0), sp(a1, b1), sp(a0, b1));
    }
  ranges.push([s / 3, (A.length - s) / 3]);

  // 5 frustum (silinder meruncing, rasio atas 0.75) — batang & cabang pohon
  s = A.length;
  const KT = 0.75;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 6.2832,
      b = ((i + 1) / N) * 6.2832;
    const x0 = Math.cos(a),
      y0 = Math.sin(a),
      x1 = Math.cos(b),
      y1 = Math.sin(b);
    q(P(x0, y0, -1), P(x1, y1, -1), P(x1 * KT, y1 * KT, 1), P(x0 * KT, y0 * KT, 1));
    T(P(0, 0, 1), P(x0 * KT, y0 * KT, 1), P(x1 * KT, y1 * KT, 1));
    T(P(0, 0, -1), P(x1, y1, -1), P(x0, y0, -1));
  }
  ranges.push([s / 3, (A.length - s) / 3]);

  // 6 ellipsoid bergelombang (gumpalan daun) — permukaan tidak rata spt rimbunan daun
  s = A.length;
  const lp = (a, b) => {
    const r =
      1 +
      Math.sin(a) * (0.09 * Math.sin(5 * b + 2 * a) + 0.06 * Math.cos(9 * b - 3 * a)) +
      0.05 * Math.cos(4 * a);
    return P(r * Math.sin(a) * Math.cos(b), r * Math.sin(a) * Math.sin(b), r * Math.cos(a));
  };
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 28; j++) {
      const a0 = (i / 16) * 3.1416,
        a1 = ((i + 1) / 16) * 3.1416;
      const b0 = (j / 28) * 6.2832,
        b1 = ((j + 1) / 28) * 6.2832;
      q(lp(a0, b0), lp(a1, b0), lp(a1, b1), lp(a0, b1));
    }
  ranges.push([s / 3, (A.length - s) / 3]);

  return { arr: new Float32Array(A), ranges };
}
const UM = unitMeshes();

// =====================================================================
//  BATU JALAN SETAPAK  (276 batu, semuanya memakai bentuk yang sama)
// =====================================================================
//  Bentuk asli: kotak pipih berukuran 4 × 4 × 0.2 (setengah ukuran
//  2 × 2 × 0.1) dengan sudut & tepi membulat kecil (radius ≈ 0.038).
//
//  Cara membuatnya:
//   1. Ambil titik-titik di permukaan kubus dari kisi 8 × 8 × 8.
//   2. Tiap titik "dibulatkan": digeser ke bidang bola kecil di sudutnya.
//   3. Hasilnya dibagi setengah ukuran, sehingga berada di rentang
//      [-1, 1] (uC / uH tiap objek yang akan menyesuaikan ukurannya).
//  Total: 296 titik, 294 segi empat = 588 segitiga.
// =====================================================================
const STONE = {
  half: [2, 2, 0.1], // setengah ukuran batu pada sumbu X, Y, Z lokal
  radius: 0.0377, // radius pembulatan sudut / tepi
  steps: [0.04, 0.33, 0.8, 1.0], // posisi titik kisi (simetris, tanpa 0)
};

function buildStoneTriangles({ half, radius, steps }) {
  const inner = half.map((h) => h - radius); // kotak dalam (sebelum dibulatkan)
  const grid = [...steps].reverse().map((s) => -s).concat(steps); // -1 … +1, 8 nilai

  // Titik di permukaan kubus -> posisi batu yang sudah dibulatkan (ternormalisasi)
  const roundPoint = (p) => {
    const len = Math.hypot(...p);
    return p.map(
      (v, axis) =>
        (Math.sign(v) * (inner[axis] + (Math.abs(v) / len) * radius)) / half[axis],
    );
  };

  const tri = [];
  // Satu sisi kubus = 7 × 7 segi empat -> masing-masing jadi 2 segitiga
  const addFace = (axis, side) => {
    const u = (axis + 1) % 3,
      v = (axis + 2) % 3;
    const at = (i, j) => {
      const p = [0, 0, 0];
      p[axis] = side; // sumbu sisi ini terkunci di -1 atau +1
      p[u] = grid[i];
      p[v] = grid[j];
      return roundPoint(p);
    };
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        const a = at(i, j),
          b = at(i + 1, j),
          c = at(i + 1, j + 1),
          d = at(i, j + 1);
        tri.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
    }
  };

  for (const axis of [0, 1, 2]) {
    addFace(axis, -1);
    addFace(axis, +1);
  }
  return new Float32Array(tri);
}

// Tambahkan mesh batu ke daftar bentuk dasar (UM) -> dapat nomor STONE_RANGE
const STONE_RANGE = (function () {
  const stone = buildStoneTriangles(STONE);
  const merged = new Float32Array(UM.arr.length + stone.length);
  merged.set(UM.arr);
  merged.set(stone, UM.arr.length);
  UM.ranges.push([UM.arr.length / 3, stone.length / 3]); // [titik awal, jumlah titik]
  UM.arr = merged;
  return UM.ranges.length - 1;
})();

// ---- Balok bersudut membulat (koordinat relatif pusat) ----
function roundedBoxTriangles(tri, center, half, radius) {
  const steps = [0.04, 0.33, 0.8, 1.0];
  const grid = [...steps].reverse().map((s) => -s).concat(steps);
  const inner = half.map((h) => h - radius);
  const point = (p) => {
    const len = Math.hypot(...p);
    return p.map((v, a) => center[a] + Math.sign(v) * (inner[a] + (Math.abs(v) / len) * radius));
  };
  for (const axis of [0, 1, 2])
    for (const side of [-1, 1]) {
      const u = (axis + 1) % 3,
        v = (axis + 2) % 3;
      const at = (i, j) => {
        const p = [0, 0, 0];
        p[axis] = side;
        p[u] = grid[i];
        p[v] = grid[j];
        return point(p);
      };
      for (let i = 0; i < 7; i++)
        for (let j = 0; j < 7; j++) {
          const a = at(i, j),
            b = at(i + 1, j),
            c = at(i + 1, j + 1),
            d = at(i, j + 1);
          tri.push(a, b, c, a, c, d);
        }
    }
}

export { KINDS, hx, UM, STONE_RANGE, roundedBoxTriangles };
