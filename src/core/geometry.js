/* =========================================================================
   geometry.js — Pembuat mesh: QUADRIC + KURVA BÉZIER
   Setiap fungsi mengembalikan { pos:[], nor:[], idx:[] }
   Quadric:  ellipsoid, cylinder, elliptic paraboloid (lens kelopak), cone
   Kurva  :  Bézier kubik 3D → tube (mulut, tulang daun) & permukaan daun
   ========================================================================= */
import { V3, M4, seg } from './math.js';

export function newGeo() { return { pos: [], nor: [], idx: [] }; }
export function pushV(g, p, n) { g.pos.push(p[0], p[1], p[2]); g.nor.push(n[0], n[1], n[2]); return g.pos.length / 3 - 1; }

/** Index quad untuk grid rows x cols (vertex disusun per baris mulai dari `base`) */
export function gridIdx(g, base, rows, cols) {
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = base + r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      g.idx.push(a, d, b, b, d, e);
    }
  }
}

/** Menyamakan arah winding segitiga dengan normal vertex (supaya back-face culling & outline benar) */
export function orient(g) {
  const P = g.pos, N = g.nor, I = g.idx;
  for (let i = 0; i < I.length; i += 3) {
    const a = I[i] * 3, b = I[i + 1] * 3, c = I[i + 2] * 3;
    const e1 = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]];
    const e2 = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
    const fn = V3.cross(e1, e2);
    const vn = [N[a] + N[b] + N[c], N[a + 1] + N[b + 1] + N[c + 1], N[a + 2] + N[b + 2] + N[c + 2]];
    if (V3.dot(fn, vn) < 0) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; }
  }
  return g;
}

/** Gabungkan banyak geometri (masing-masing dengan matriks transform) menjadi satu */
export function mergeGeo(list) {
  const out = newGeo();
  for (const [g, m] of list) {
    const base = out.pos.length / 3, nm = M4.normalMatrix(m);
    for (let i = 0; i < g.pos.length; i += 3) {
      const p = M4.transformPoint(m, [g.pos[i], g.pos[i + 1], g.pos[i + 2]]);
      const n = g.nor;
      const nn = V3.norm([nm[0] * n[i] + nm[3] * n[i + 1] + nm[6] * n[i + 2],
                          nm[1] * n[i] + nm[4] * n[i + 1] + nm[7] * n[i + 2],
                          nm[2] * n[i] + nm[5] * n[i + 1] + nm[8] * n[i + 2]]);
      pushV(out, p, nn);
    }
    for (const k of g.idx) out.idx.push(base + k);
  }
  return out;
}

/* ============================ QUADRIC 1: ELLIPSOID ============================
   x²/rx² + y²/ry² + z²/rz² = 1
   Parametrik: x = rx·cosφ·sinθ, y = ry·sinφ, z = rz·cosφ·cosθ
   Normal    : ∇F = (x/rx², y/ry², z/rz²)                                       */
export function ellipsoid(rx, ry, rz, lat = 28, lon = 44) {
  const g = newGeo();
  for (let i = 0; i <= lat; i++) {
    const phi = -Math.PI / 2 + (Math.PI * i) / lat, cp = Math.cos(phi), sp = Math.sin(phi);
    for (let j = 0; j <= lon; j++) {
      const th = (2 * Math.PI * j) / lon;
      const p = [rx * cp * Math.sin(th), ry * sp, rz * cp * Math.cos(th)];
      let n = V3.norm([p[0] / (rx * rx), p[1] / (ry * ry), p[2] / (rz * rz)]);
      if (V3.len(n) === 0) n = [0, Math.sign(sp) || 1, 0];
      pushV(g, p, n);
    }
  }
  gridIdx(g, 0, lat + 1, lon + 1);
  return orient(g);
}

/* ============================ QUADRIC 2: CYLINDER =============================
   x²/r² + z²/r² = 1,  0 ≤ y ≤ h  (plus tutup atas & bawah)                    */
export function cylinder(r, h, seg = 28, rings = 4) {
  const g = newGeo();
  for (let i = 0; i <= rings; i++) {
    const y = (h * i) / rings;
    for (let j = 0; j <= seg; j++) {
      const th = (2 * Math.PI * j) / seg, x = Math.sin(th), z = Math.cos(th);
      pushV(g, [r * x, y, r * z], [x, 0, z]);
    }
  }
  gridIdx(g, 0, rings + 1, seg + 1);
  for (const [y, ny] of [[0, -1], [h, 1]]) {
    const c = pushV(g, [0, y, 0], [0, ny, 0]);
    const s = g.pos.length / 3;
    for (let j = 0; j <= seg; j++) { const th = (2 * Math.PI * j) / seg; pushV(g, [r * Math.sin(th), y, r * Math.cos(th)], [0, ny, 0]); }
    for (let j = 0; j < seg; j++) g.idx.push(c, s + j, s + j + 1);
  }
  return orient(g);
}

/* ======================= QUADRIC 3: ELLIPTIC PARABOLOID =======================
   z = c − k·(x²/a² + y²/b²)    ← paraboloid eliptik (BUKAN ellipsoid/cylinder)
   Kelopak = "lensa" dari DUA paraboloid eliptik yang bertemu di tepi oval:
     depan   : z = t − (t+d)·u²   (cembung, menghadap depan)
     belakang: z =   −   d ·u²
   dengan x = a·u·cosθ, y = b·u·sinθ, 0 ≤ u ≤ 1                                 */
export function paraboloidLens(a, b, depth, thick, segU = 10, segV = 36) {
  const g = newGeo();
  const kf = thick + depth, kb = depth;
  const rows = 2 * segU + 1;
  for (let w = 0; w < rows; w++) {
    const front = w <= segU;
    const u = front ? w / segU : (2 * segU - w) / segU;
    for (let j = 0; j <= segV; j++) {
      const th = (2 * Math.PI * j) / segV, cx = Math.cos(th), sy = Math.sin(th);
      const x = a * u * cx, y = b * u * sy;
      const z = front ? thick - kf * u * u : -kb * u * u;
      let n;
      if (w === segU) n = V3.norm([cx / a, sy / b, 0]);                       // tepi: normal radial
      else if (front) n = V3.norm([(2 * kf * x) / (a * a), (2 * kf * y) / (b * b), 1]);
      else n = V3.norm([(-2 * kb * x) / (a * a), (-2 * kb * y) / (b * b), -1]);
      pushV(g, [x, y, z], n);
    }
  }
  gridIdx(g, 0, rows, segV + 1);
  return orient(g);
}

/* ============================ QUADRIC 4: CONE (environment) ===================
   x² + z² = (r·(1 − y/h))²                                                      */
export function cone(r, h, seg = 14) {
  const g = newGeo(), l = Math.hypot(r, h);
  for (let j = 0; j <= seg; j++) {
    const th = (2 * Math.PI * j) / seg, x = Math.sin(th), z = Math.cos(th);
    const n = [x * h / l, r / l, z * h / l];
    pushV(g, [r * x, 0, r * z], n);
    pushV(g, [0, h, 0], n);
  }
  for (let j = 0; j < seg; j++) { const a = j * 2; g.idx.push(a, a + 2, a + 1); }
  const c = pushV(g, [0, 0, 0], [0, -1, 0]), s = g.pos.length / 3;
  for (let j = 0; j <= seg; j++) { const th = (2 * Math.PI * j) / seg; pushV(g, [r * Math.sin(th), 0, r * Math.cos(th)], [0, -1, 0]); }
  for (let j = 0; j < seg; j++) g.idx.push(c, s + j, s + j + 1);
  return orient(g);
}

/* ===================== QUADRIC 4b: CONE TERPOTONG (frustum) ===================
   Potongan permukaan cone x² + z² = (r0 + (r1 − r0)·y/h)²,  0 ≤ y ≤ h.
   Ujung terbuka (tanpa tutup). inward = true → normal menghadap ke sumbu
   (dipakai untuk dinding dalam moncong).                                        */
export function coneFrustum(r0, r1, h, seg = 36, rings = 6, inward = false) {
  const g = newGeo(), l = Math.hypot(h, r1 - r0), sgn = inward ? -1 : 1;
  for (let i = 0; i <= rings; i++) {
    const y = (h * i) / rings, r = r0 + ((r1 - r0) * i) / rings;
    for (let j = 0; j <= seg; j++) {
      const th = (2 * Math.PI * j) / seg, x = Math.sin(th), z = Math.cos(th);
      pushV(g, [r * x, y, r * z], V3.scale([x * h / l, -(r1 - r0) / l, z * h / l], sgn));
    }
  }
  gridIdx(g, 0, rings + 1, seg + 1);
  return orient(g);
}

/* ============================ OBJEK LAIN: TORUS ==============================
   (√(x² + z²) − R)² + y² = r²   — bibir moncong. Torus BUKAN quadric (derajat 4). */
export function torus(R, r, segU = 40, segV = 14) {
  const g = newGeo();
  for (let i = 0; i <= segU; i++) {
    const u = (2 * Math.PI * i) / segU, cu = Math.cos(u), su = Math.sin(u);
    for (let j = 0; j <= segV; j++) {
      const v = (2 * Math.PI * j) / segV, cv = Math.cos(v), sv = Math.sin(v);
      pushV(g, [(R + r * cv) * su, r * sv, (R + r * cv) * cu], [cv * su, sv, cv * cu]);
    }
  }
  gridIdx(g, 0, segU + 1, segV + 1);
  return orient(g);
}

/** Cakram datar (dipakai untuk "dasar gelap" di dalam moncong & papan target) */
export function disc(r, seg = 36) {
  const g = newGeo(), c = pushV(g, [0, 0, 0], [0, 1, 0]);
  for (let j = 0; j <= seg; j++) { const th = (2 * Math.PI * j) / seg; pushV(g, [r * Math.sin(th), 0, r * Math.cos(th)], [0, 1, 0]); }
  for (let j = 0; j < seg; j++) g.idx.push(c, c + 1 + j, c + 2 + j);
  return orient(g);
}

/* ============================ OBJEK LAIN: BOX ================================
   Balok w × h × d berpusat di titik asal (normal datar per sisi).              */
export function box(w, h, d) {
  const g = newGeo(), x = w / 2, y = h / 2, z = d / 2;
  const faces = [
    [[1, 0, 0], [[x, -y, -z], [x, y, -z], [x, y, z], [x, -y, z]]],
    [[-1, 0, 0], [[-x, -y, z], [-x, y, z], [-x, y, -z], [-x, -y, -z]]],
    [[0, 1, 0], [[-x, y, -z], [-x, y, z], [x, y, z], [x, y, -z]]],
    [[0, -1, 0], [[-x, -y, z], [-x, -y, -z], [x, -y, -z], [x, -y, z]]],
    [[0, 0, 1], [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]],
    [[0, 0, -1], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]]],
  ];
  for (const [n, q] of faces) {
    const b = g.pos.length / 3;
    q.forEach((p) => pushV(g, p, n));
    g.idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  return orient(g);
}

/* ===================== MESH SEGITIGA BERTEBAL (jas, dasi, kerah) ==============
   `grid[i][j]` = titik permukaan luar (rows × cols), `nrm` = normal luar.
   Lapis dalam = titik − normal·tebal; keempat tepi ditutup dinding sehingga
   menjadi benda pejal (outline kartun bekerja rapi).                           */
export function thickSurface(grid, nrm, thick, keep = null) {
  const g = newGeo(), R = grid.length, C = grid[0].length;
  const vid = (l, i, j) => l * R * C + i * C + j;
  const edgeN = (i, j) => {
    const c = grid[(R - 1) >> 1][(C - 1) >> 1];
    let o = V3.sub(grid[i][j], c); o = V3.sub(o, V3.scale(nrm[i][j], V3.dot(o, nrm[i][j])));
    return V3.norm(o);
  };
  for (let l = 0; l < 2; l++) {
    for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
      const n = nrm[i][j];
      let vn = l === 0 ? n : V3.scale(n, -1);
      if (i === 0 || j === 0 || i === R - 1 || j === C - 1) vn = V3.norm(V3.add(V3.scale(vn, 0.5), edgeN(i, j)));
      pushV(g, l === 0 ? grid[i][j] : V3.sub(grid[i][j], V3.scale(n, thick)), vn);
    }
    for (let i = 0; i < R - 1; i++) for (let j = 0; j < C - 1; j++) {
      if (keep && !keep(i, j)) continue;
      const a = vid(l, i, j), b = a + 1, d = a + C, e = d + 1;
      g.idx.push(a, d, b, b, d, e);
    }
  }
  const wall = (pairs) => { for (let k = 0; k < pairs.length - 1; k++) {
    const [i0, j0] = pairs[k], [i1, j1] = pairs[k + 1];
    const a = vid(0, i0, j0), b = vid(0, i1, j1), c = vid(1, i0, j0), d = vid(1, i1, j1);
    g.idx.push(a, b, c, b, d, c);
  } };
  if (!keep) {
    wall([...Array(R).keys()].map((i) => [i, 0])); wall([...Array(R).keys()].map((i) => [i, C - 1]));
    wall([...Array(C).keys()].map((j) => [0, j])); wall([...Array(C).keys()].map((j) => [R - 1, j]));
  }
  return orient(g);
}

/** Normal permukaan grid via beda hingga, diarahkan sesuai `outward(p)` */
export function gridNormals(grid, outward) {
  const R = grid.length, C = grid[0].length;
  return grid.map((row, i) => row.map((p, j) => {
    const dv = V3.sub(grid[Math.min(i + 1, R - 1)][j], grid[Math.max(i - 1, 0)][j]);
    const du = V3.sub(grid[i][Math.min(j + 1, C - 1)], grid[i][Math.max(j - 1, 0)]);
    let n = V3.norm(V3.cross(du, dv));
    if (V3.len(n) === 0) n = outward(p);
    if (V3.dot(n, outward(p)) < 0) n = V3.scale(n, -1);
    return n;
  }));
}

/* ====== CONE TERPOTONG DENGAN TEPI SOBEK (celana robek) ======
   Sama seperti coneFrustum (sepanjang −Y dari 0 ke −h) tetapi tepi bawah
   bergerigi: segitiga-segitiga tak beraturan. Dinding luar + dalam.           */
export function raggedFrustum(r0, r1, h, jag, seed = 3, seg = 30, rings = 5) {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const tooth = []; for (let j = 0; j <= seg; j++) tooth.push(j % 2 ? jag * (0.35 + rnd()) : jag * 0.1 * rnd());
  tooth[seg] = tooth[0];
  const l = Math.hypot(h, r1 - r0);
  const grid = [], nr = [];
  for (let i = 0; i <= rings; i++) {
    const row = [], nrow = [];
    for (let j = 0; j <= seg; j++) {
      const th = (2 * Math.PI * j) / seg, x = Math.sin(th), z = Math.cos(th);
      const hh = h + (i / rings) * tooth[j], y = -(hh * i) / rings, t = Math.min(1, -y / h);
      const r = r0 + (r1 - r0) * t;
      row.push([r * x, y, r * z]); nrow.push([x * h / l, -(r1 - r0) / l, z * h / l]);
    }
    grid.push(row); nr.push(nrow);
  }
  return thickSurface(grid, nr.map((r) => r.map(V3.norm)), 0.012);
}

/* ================================ KURVA BÉZIER ================================
   B(t) = (1−t)³P0 + 3(1−t)²t P1 + 3(1−t)t² P2 + t³ P3                           */
export const Bezier = {
  point(P, t) {
    const u = 1 - t, b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
    return [0, 1, 2].map((k) => b0 * P[0][k] + b1 * P[1][k] + b2 * P[2][k] + b3 * P[3][k]);
  },
  tangent(P, t) {
    const u = 1 - t;
    return [0, 1, 2].map((k) => 3 * u * u * (P[1][k] - P[0][k]) + 6 * u * t * (P[2][k] - P[1][k]) + 3 * t * t * (P[3][k] - P[2][k]));
  },
  sample(P, n) { const pts = []; for (let i = 0; i <= n; i++) pts.push(Bezier.point(P, i / n)); return pts; },
};

/** Tube (tabung) mengikuti deretan titik kurva, radius boleh berubah: radiusFn(t) */
export function tube(points, radiusFn, radial = 12) {
  const g = newGeo(), n = points.length;
  const T = points.map((p, i) => V3.norm(V3.sub(points[Math.min(i + 1, n - 1)], points[Math.max(i - 1, 0)])));
  // frame awal tegak lurus tangen, lalu "parallel transport" sepanjang kurva
  let ref = Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let N = V3.norm(V3.cross(V3.cross(T[0], ref), T[0]));
  const frames = [];
  for (let i = 0; i < n; i++) {
    N = V3.norm(V3.sub(N, V3.scale(T[i], V3.dot(N, T[i]))));
    frames.push([N, V3.cross(T[i], N)]);
  }
  for (let i = 0; i < n; i++) {
    const r = radiusFn(i / (n - 1)), [Nn, Bn] = frames[i];
    for (let j = 0; j <= radial; j++) {
      const a = (2 * Math.PI * j) / radial, ca = Math.cos(a), sa = Math.sin(a);
      const d = [Nn[0] * ca + Bn[0] * sa, Nn[1] * ca + Bn[1] * sa, Nn[2] * ca + Bn[2] * sa];
      pushV(g, V3.add(points[i], V3.scale(d, r)), d);
    }
  }
  gridIdx(g, 0, n, radial + 1);
  // tutup ujung (bulat sedikit supaya rapi)
  for (const [i, sgn] of [[0, -1], [n - 1, 1]]) {
    const r = radiusFn(i / (n - 1)), [Nn, Bn] = frames[i], t = V3.scale(T[i], sgn);
    const c = pushV(g, V3.add(points[i], V3.scale(t, r * 0.6)), t), s = g.pos.length / 3;
    for (let j = 0; j <= radial; j++) {
      const a = (2 * Math.PI * j) / radial;
      const d = V3.add(V3.scale(Nn, Math.cos(a)), V3.scale(Bn, Math.sin(a)));
      pushV(g, V3.add(points[i], V3.scale(d, r)), V3.norm(V3.add(d, t)));
    }
    for (let j = 0; j < radial; j++) g.idx.push(c, s + j, s + j + 1);
  }
  return orient(g);
}

/* ================================ DAUN (KURVA) ================================
   Dua kurva Bézier kubik 3D sebagai batas KIRI dan KANAN daun.
   Titik di antara keduanya diisi interpolasi linear:  P(t,s) = (1−s)·L(t) + s·R(t)
   lalu bagian tengah diturunkan → permukaan cekung, ujung menekuk ke bawah.
   Permukaan diberi ketebalan (solid) supaya outline kartun terbentuk rapi.        */
export function leaf({ length: L, width: W, lift = 0.16, lift2 = null, tipDrop = -0.12, sag = 0.06, thick = 0.022, nt = 30, ns = 10 }) {
  const left = [[0, 0, 0], [0.26 * L, lift, 1.05 * W], [0.7 * L, lift2 === null ? lift * 0.9 : lift2, 0.95 * W], [L, tipDrop, 0]];
  const right = left.map((p) => [p[0], p[1], -p[2]]);
  const top = [];
  for (let i = 0; i <= nt; i++) {
    const t = i / nt, Lp = Bezier.point(left, t), Rp = Bezier.point(right, t), row = [];
    for (let j = 0; j <= ns; j++) {
      const s = j / ns, p = V3.lerp(Lp, Rp, s);
      p[1] -= sag * 4 * s * (1 - s) * Math.sin(Math.PI * Math.min(1, t * 1.15));
      row.push(p);
    }
    top.push(row);
  }
  // normal permukaan atas (beda hingga)
  const tipDir = V3.norm(Bezier.tangent(left, 1));
  const nrm = top.map((row, i) => row.map((p, j) => {
    const dt = V3.sub(top[Math.min(i + 1, nt)][j], top[Math.max(i - 1, 0)][j]);
    const ds = V3.sub(top[i][Math.min(j + 1, ns)], top[i][Math.max(j - 1, 0)]);
    let n = V3.norm(V3.cross(ds, dt));
    if (n[1] < 0) n = V3.scale(n, -1);
    if (V3.len(n) === 0) n = [0, 1, 0];
    return n;
  }));
  const g = newGeo(), mid = ns / 2;
  const edgeOut = (i, j) => {
    let o = V3.sub(top[i][j], top[i][mid]);
    if (V3.len(o) < 1e-5) o = i === 0 ? [-1, 0, 0] : tipDir;
    return V3.norm(o);
  };
  const vid = (layer, i, j) => layer * (nt + 1) * (ns + 1) + i * (ns + 1) + j;
  for (let layer = 0; layer < 2; layer++) {
    for (let i = 0; i <= nt; i++) {
      const th = thick * Math.pow(Math.sin(Math.PI * Math.min(0.98, Math.max(0.04, i / nt))), 0.6);
      for (let j = 0; j <= ns; j++) {
        const n = nrm[i][j];
        const p = layer === 0 ? top[i][j] : V3.sub(top[i][j], V3.scale(n, th));
        let vn = layer === 0 ? n : V3.scale(n, -1);
        if (j === 0 || j === ns || i === 0 || i === nt) vn = V3.norm(V3.add(V3.scale(vn, 0.45), edgeOut(i, j)));
        pushV(g, p, vn);
      }
    }
    gridIdx(g, vid(layer, 0, 0), nt + 1, ns + 1);
  }
  // dinding tepi kiri & kanan
  for (const j of [0, ns]) {
    for (let i = 0; i < nt; i++) {
      const a = vid(0, i, j), b = vid(0, i + 1, j), c = vid(1, i, j), d = vid(1, i + 1, j);
      g.idx.push(a, b, c, b, d, c);
    }
  }
  orient(g);
  // tulang daun mengikuti garis tengah kurva
  const vein = [];
  for (let i = 1; i < nt; i++) vein.push(V3.add(top[i][mid], V3.scale(nrm[i][mid], 0.012)));
  return { geo: g, vein, curves: { left, right } };
}

/* Bidang datar (rumput / lantai) */
export function plane(w, d, color) {
  const g = newGeo();
  pushV(g, [-w / 2, 0, -d / 2], [0, 1, 0]); pushV(g, [w / 2, 0, -d / 2], [0, 1, 0]);
  pushV(g, [-w / 2, 0, d / 2], [0, 1, 0]); pushV(g, [w / 2, 0, d / 2], [0, 1, 0]);
  g.idx.push(0, 2, 1, 1, 2, 3);
  return orient(g);
}
