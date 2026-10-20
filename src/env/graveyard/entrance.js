import { gl, pg, U, ID4 } from "./webgl.js";
import { OBJEK_GRAVEYARD } from "./data.js";
import { UM, roundedBoxTriangles } from "./geometry.js";
import { hash2, valueNoise, smoothstep } from "./libs.js";
import { slabTopTriangles } from "./graveslab.js";

// =====================================================================
//  PINTU RUMAH & TANGGA
// =====================================================================
//  • Tangga  : dulu satu kotak padat (5 anak tangga di model asli).
//              Sekarang 2 anak tangga batu, bagian tengahnya aus terinjak,
//              tepi miring, retak & gompal. Ukurannya mengikuti kotak tangga
//              (Plane.001), tinggi puncaknya = ambang pintu.
//  • Pintu   : dulu dua kotak hitam. Sekarang:
//      - dua bingkai lengkung gotik dari batu bersambungan (sambungan
//        melingkar seperti batu busur / voussoir)
//      - daun pintu ganda dari papan kayu tua (alur antar papan cekung,
//        serat & simpul kayu, makin gelap dan lembap ke bawah)
//      - pita besi, engsel, paku keling, dan cincin gagang
//  Semua dibuat di koordinat DUNIA, lalu digambar dengan matriks identitas.
//  Warna: shader 5 = kayu, 6 = besi, 7 = batu bingkai (lihat fragment shader).
// =====================================================================
const ENTRANCE = {
  steps: 2, // jumlah anak tangga
  planks: 8, // jumlah papan di lebar daun pintu
  springY: 165, // tinggi tempat lengkung mulai (untuk sambungan batu busur)
  // Kontur lengkung (setengah KIRI, dari bawah ke puncak), diambil dari model aslinya
  frameIn: [[85.7, 54.4], [85.9, 164.0], [91.3, 199.2], [106.6, 214.0], [127.6, 228.1]], // bukaan pintu
  frameMid: [[81.7, 46.7], [81.7, 165.3], [87.8, 205.3], [104.6, 221.5], [127.6, 237.0]], // batas bingkai 1 & 2
  frameOut: [[77.6, 38.8], [77.6, 168.1], [84.3, 211.7], [102.6, 229.3], [127.6, 246.2]], // tepi luar bingkai 2
  stoneColor: [0.115, 0.115, 0.125],
};

// Kotak pembatas objek di koordinat dunia (sumbu sejajar)
function worldAABB(ob) {
  const m = ob.matrix,
    mn = [1e9, 1e9, 1e9],
    mx = [-1e9, -1e9, -1e9];
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const l = [ob.pusat[0] + sx * ob.ukuran_proksi[0], ob.pusat[1] + sy * ob.ukuran_proksi[1], ob.pusat[2] + sz * ob.ukuran_proksi[2]];
        for (let a = 0; a < 3; a++) {
          const v = m[a] * l[0] + m[4 + a] * l[1] + m[8 + a] * l[2] + m[12 + a];
          mn[a] = Math.min(mn[a], v);
          mx[a] = Math.max(mx[a], v);
        }
      }
  return { min: mn, max: mx };
}
const findObj = (name) => OBJEK_GRAVEYARD.find((o) => o.nama === name);

// Setengah kontur kiri -> lingkaran penuh (kiri naik, kanan turun), berpusat di cx
function mirrorLoop(half, cx) {
  const right = half.slice(0, -1).reverse().map(([x, y]) => [2 * cx - x, y]);
  return half.concat(right);
}

// ---- Bingkai lengkung: cincin antara dua kontur, muka depan di zFront ----
function archRingTriangles(tri, inner, outer, zFront, zBack) {
  const n = inner.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [ia, ib, oa, ob] = [inner[i], inner[j], outer[i], outer[j]];
    const P = (p, z) => [p[0], p[1], z];
    tri.push(P(oa, zFront), P(ob, zFront), P(ib, zFront), P(oa, zFront), P(ib, zFront), P(ia, zFront)); // muka depan
    tri.push(P(ia, zFront), P(ib, zFront), P(ib, zBack), P(ia, zFront), P(ib, zBack), P(ia, zBack)); // sisi dalam (reveal)
    tri.push(P(oa, zFront), P(ob, zFront), P(ob, zBack), P(oa, zFront), P(ob, zBack), P(oa, zBack)); // sisi luar
  }
}

// ---- Kubah kecil (kepala paku keling) menghadap -z ----
function domeTriangles(tri, cx, cy, cz, r) {
  const N = 8,
    ring = (k, rr, z) => [cx + Math.cos((k / N) * 6.2832) * rr, cy + Math.sin((k / N) * 6.2832) * rr, z];
  for (let k = 0; k < N; k++) {
    const a0 = ring(k, r, cz),
      a1 = ring(k + 1, r, cz),
      b0 = ring(k, r * 0.6, cz - 0.45 * r),
      b1 = ring(k + 1, r * 0.6, cz - 0.45 * r),
      top = [cx, cy, cz - 0.7 * r];
    tri.push(a0, a1, b1, a0, b1, b0, b0, b1, top);
  }
}

// ---- Susun semua bagian di koordinat dunia ----
const ENTRANCE_GL = (function createEntrance() {
  const E = ENTRANCE;
  const stairsObj = findObj("Plane.001"),
    wallObj = findObj("Cube.183"),
    frame1Obj = findObj("Cube.184"),
    frame2Obj = findObj("Cube.185");
  const stair = worldAABB(stairsObj),
    wallZ = worldAABB(wallObj).min[2];
  const z1 = worldAABB(frame1Obj).min[2],
    z2 = worldAABB(frame2Obj).min[2];
  const cx = E.frameIn[E.frameIn.length - 1][0];
  const groups = [];
  const build = (mode, color, fn) => {
    const tri = [];
    fn(tri);
    groups.push({ mode, color, tri });
  };

  // 1) TANGGA: tiap anak tangga = pelat batu aus; makin ke belakang makin tinggi
  build(4, stairsObj.warna, (tri) => {
    const [x0, y0, z0] = stair.min,
      [x1, y1, zBack] = stair.max;
    const W = (x1 - x0) / 2,
      H = y1 - y0,
      D = zBack - z0,
      n = E.steps;
    for (let s = 0; s < n; s++) {
      const depth = (D * (n - s)) / n; // anak tangga bawah paling dalam (menjorok), atas paling dekat rumah
      const height = (H * (s + 1)) / n;
      const slab = [];
      slabTopTriangles(slab, {
        hW: W - s * 1.2,
        hL: depth / 2,
        hH: height / 2,
        ext: 0,
        bevel: 1.0,
        seed: 31.7 + s * 5.1,
        nw: 44,
        nl: s === 0 ? 64 : 40,
        seams: false,
        cracks: 2,
        chips: 2,
        dip: { width: 26, depth: 0.9 }, // tengah aus karena terinjak
      });
      const cxS = (x0 + x1) / 2,
        cyS = y0 + height / 2,
        czS = zBack - depth / 2;
      for (const p of slab) tri.push([cxS + p[0], cyS + p[2], czS + p[1]]); // kanonik (lebar, panjang, tinggi) -> dunia
    }
  });

  // 2) BINGKAI LENGKUNG: dua cincin batu
  const inL = mirrorLoop(E.frameIn, cx),
    midL = mirrorLoop(E.frameMid, cx),
    outL = mirrorLoop(E.frameOut, cx);
  build(7, E.stoneColor, (tri) => {
    archRingTriangles(tri, inL, midL, z1, wallZ); // bingkai dalam (paling menonjol)
    archRingTriangles(tri, midL, outL, z2, wallZ); // bingkai luar
  });

  // 3) DAUN PINTU: papan kayu ganda; alur antar papan cekung
  const zLeaf = wallZ - 1.1; // permukaan depan daun pintu
  const xL = E.frameIn[0][0] + 0.2,
    xR = 2 * cx - xL,
    plankW = (xR - xL) / E.planks;
  const yb = E.frameIn[0][1] + 0.1;
  const archTop = (x) => {
    // tinggi tepi atas bukaan di posisi x (interpolasi garis patah kontur dalam)
    const xm = x <= cx ? x : 2 * cx - x,
      pts = E.frameIn;
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      if (xm >= a[0] && xm <= b[0]) return a[1] + ((b[1] - a[1]) * (xm - a[0])) / (b[0] - a[0] || 1);
    }
    return pts[1][1];
  };
  const halfWidthAt = (y) => {
    const pts = E.frameIn;
    for (let i = 1; i < pts.length - 1; i++) if (y <= pts[i + 1][1]) return cx - (pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * (y - pts[i][1])) / (pts[i + 1][1] - pts[i][1] || 1));
    return 0;
  };
  build(5, [0.04, 0.025, 0.015], (tri) => {
    const COLS = 112,
      ROWS = 100;
    const xs = Array.from({ length: COLS + 1 }, (_, k) => xL + ((xR - xL) * k) / COLS);
    const pt = (k, r) => {
      const x = xs[k],
        top = archTop(x) - 0.5;
      const y = yb + ((top - yb) * r) / ROWS;
      const u = (x - xL) / plankW,
        f = u - Math.floor(u);
      const edge = Math.min(f, 1 - f) * plankW;
      const groove = 1 - smoothstep(0.15, 0.8, edge); // alur antar papan
      const seam = 1 - smoothstep(0.2, 1.2, Math.abs(x - cx)); // celah tengah (dua daun)
      const offset = hash2(Math.floor(u) * 3.1, 1.7) * 0.28; // papan tidak rata
      const grain = (valueNoise(x * 2.2, y * 0.12) - 0.5) * 0.14 + (valueNoise(x * 7, y * 0.6) - 0.5) * 0.05;
      const rot = (1 - smoothstep(54, 66, y)) * valueNoise(x * 0.9, y * 0.9) * 0.9; // dasar pintu lapuk
      return [x, y, zLeaf + groove * 0.5 + seam * 0.5 + offset + grain + rot];
    };
    for (let k = 0; k < COLS; k++)
      for (let r = 0; r < ROWS; r++) {
        const a = pt(k, r),
          b = pt(k + 1, r),
          c = pt(k + 1, r + 1),
          d = pt(k, r + 1);
        tri.push(a, b, c, a, c, d);
      }
  });

  // 4) BESI: pita (strap), engsel, paku keling, pelat gagang
  build(6, [0.012, 0.012, 0.014], (tri) => {
    const zi = zLeaf - 0.45; // pusat tebal besi (sedikit di depan kayu)
    for (const y of [86, 134, 182]) {
      const hw = halfWidthAt(y) - 1.2; // setengah lebar bukaan di tinggi ini
      for (const side of [-1, 1]) {
        const xOuter = cx + side * hw,
          xInner = cx + side * 3.2,
          mid = (xOuter + xInner) / 2,
          half = Math.abs(xOuter - xInner) / 2;
        roundedBoxTriangles(tri, [mid, y, zi], [half, 2.6, 0.6], 0.35); // pita memanjang
        roundedBoxTriangles(tri, [xOuter - side * 3.2, y, zi - 0.15], [3.4, 4.2, 0.75], 0.4); // pelat engsel
        for (let x = xInner + side * 3; Math.abs(x - cx) < hw - 7; x += side * 8) domeTriangles(tri, x, y, zi - 0.55, 0.95); // paku keling
        for (const dy of [-2.6, 0, 2.6]) domeTriangles(tri, xOuter - side * 3.2, y + dy * 1.4, zi - 0.9, 0.9); // paku engsel
      }
    }
    // pelat dan lubang kunci untuk gagang cincin
    for (const side of [-1, 1]) roundedBoxTriangles(tri, [cx + side * 9, 112, zi], [3.2, 5.2, 0.55], 0.4);
  });

  // Kirim ke GPU: satu VBO untuk semua kelompok
  const total = groups.reduce((s, g) => s + g.tri.length, 0);
  const data = new Float32Array(total * 3);
  let off = 0;
  for (const g of groups) {
    g.first = off / 3;
    g.count = g.tri.length;
    for (const p of g.tri) {
      data[off++] = p[0];
      data[off++] = p[1];
      data[off++] = p[2];
    }
    g.tri = null;
  }
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  U.uDoor = gl.getUniformLocation(pg, "uDoor");
  const handles = [-1, 1].map((s) => [cx + s * 9, 112, zLeaf - 2.1]); // pusat cincin gagang
  return { vao, groups, handles, door: [cx, E.springY, xL, plankW], tris: total / 3 };
})();

// Gambar tangga + pintu (mode model & gabungan). shapesVao = VAO bentuk dasar, untuk cincin gagang.
function drawEntrance(alpha, shapesVao) {
  const e = ENTRANCE_GL;
  gl.bindVertexArray(e.vao);
  gl.uniformMatrix4fv(U.uM, false, ID4);
  gl.uniform3fv(U.uC, [0, 0, 0]);
  gl.uniform3fv(U.uH, [1, 1, 1]);
  gl.uniform1f(U.uA, alpha);
  gl.uniform4fv(U.uDoor, e.door);
  for (const g of e.groups) {
    gl.uniform3fv(U.uCol, g.color);
    gl.uniform1i(U.uTerrain, g.mode);
    gl.drawArrays(gl.TRIANGLES, g.first, g.count);
  }
  // cincin gagang: torus bentuk dasar (sumbu Z = menghadap depan), besi
  gl.bindVertexArray(shapesVao);
  gl.uniform3fv(U.uCol, [0.012, 0.012, 0.014]);
  gl.uniform1i(U.uTerrain, 6);
  const t = UM.ranges[3];
  for (const c of e.handles) {
    gl.uniform3fv(U.uC, c);
    gl.uniform3fv(U.uH, [5, 5, 1.5]);
    gl.drawArrays(gl.TRIANGLES, t[0], t[1]);
  }
  gl.uniform1i(U.uTerrain, 0);
  gl.uniform3fv(U.uC, [0, 0, 0]);
  gl.uniform3fv(U.uH, [1, 1, 1]);
}
// Objek lama yang digantikan oleh tangga & pintu di atas (hanya pada mode model/gabungan)
const ENTRANCE_REPLACED = { "Plane.001": "draw", "Cube.184": "skip", "Cube.185": "skip" };

export { worldAABB, drawEntrance, ENTRANCE_REPLACED };
