/* =========================================================================
   geometry.js — Pembuat mesh: QUADRIC + KURVA BÉZIER
   Setiap fungsi mengembalikan { pos:[], nor:[], idx:[] }
   Quadric:  ellipsoid, cylinder, elliptic paraboloid (lens kelopak), cone
   Kurva  :  Bézier kubik 3D → tube (mulut, tulang daun) & permukaan daun
   ========================================================================= */
import { V3, M4, seg, m4, M, sub, nrm, tr, inv, axisRot, cr, dt } from './math.js';

/**
 * Membuat container geometri 3D kosong dengan buffer posisi, normal, dan indeks.
 * @returns {{ pos: number[], nor: number[], idx: number[] }} Objek geometri kosong
 */
export function newGeo() { return { pos: [], nor: [], idx: [] }; }

/**
 * Menambahkan sebuah vertex (posisi dan normal) ke dalam objek geometri.
 * @param {{ pos: number[], nor: number[], idx: number[] }} g - Objek geometri target yang akan ditambahkan vertex
 * @param {[number, number, number]} p - Vektor posisi vertex [x, y, z] untuk menentukan koordinat titik
 * @param {[number, number, number]} n - Vektor normal vertex [nx, ny, nz] untuk pencahayaan dan orientasi permukaan
 * @returns {number} Indeks vertex baru yang berhasil ditambahkan
 */
export function pushV(g, p, n) { g.pos.push(p[0], p[1], p[2]); g.nor.push(n[0], n[1], n[2]); return g.pos.length / 3 - 1; }

/**
 * Menyusun indeks poligon segitiga (triangulasi) untuk grid teratur quad berukuran rows x cols.
 * Vertex diasumsikan telah dimasukkan berurutan baris demi baris mulai dari indeks `base`.
 * @param {{ pos: number[], nor: number[], idx: number[] }} g - Objek geometri tempat indeks segitiga disimpan
 * @param {number} base - Offset indeks awal vertex pada buffer (indeks vertex sudut kiri atas grid)
 * @param {number} rows - Jumlah baris titik vertex pada grid (mengubah tinggi/resolusi vertikal grid)
 * @param {number} cols - Jumlah kolom titik vertex pada grid (mengubah lebar/resolusi horizontal grid)
 */
export function gridIdx(g, base, rows, cols) {
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = base + r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      g.idx.push(a, d, b, b, d, e);
    }
  }
}

/**
 * Menyamakan arah winding (urutan putaran segitiga CCW/CW) dengan arah normal vertex
 * agar culling sisi belakang (back-face culling) dan efek cel-shading/outline konsisten menghadap luar.
 * @param {{ pos: number[], nor: number[], idx: number[] }} g - Objek geometri yang urutan indeks poligonnya akan disesuaikan
 * @returns {{ pos: number[], nor: number[], idx: number[] }} Objek geometri yang sama setelah orientasinya dirapikan
 */
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

/**
 * Menggabungkan beberapa geometri terpisah beserta matriks transformasinya masing-masing menjadi satu kesatuan mesh tunggal.
 * @param {Array<[{ pos: number[], nor: number[], idx: number[] }, number[]]>} list - Daftar pasangan `[geometri, matriks4x4]` yang akan ditransformasikan dan digabung
 * @returns {{ pos: number[], nor: number[], idx: number[] }} Geometri hasil gabungan (posisi dan normal telah ditransformasikan)
 */
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
/**
 * Menghasilkan geometri kuadrik elipsoid (bola atau lonjong) terpusat di titik asal.
 * @param {number} rx - Jari-jari semi-sumbu X (mengubah lebar elipsoid secara horizontal ke samping)
 * @param {number} ry - Jari-jari semi-sumbu Y (mengubah tinggi elipsoid secara vertikal ke atas-bawah)
 * @param {number} rz - Jari-jari semi-sumbu Z (mengubah kedalaman elipsoid ke depan-belakang)
 * @param {number} [lat=28] - Jumlah segmen garis lintang vertikal / latitude (mengatur kehalusan lengkungan dari kutub atas ke bawah)
 * @param {number} [lon=44] - Jumlah segmen garis bujur horizontal / longitude (mengatur kehalusan keliling memutar elipsoid)
 * @returns {{ pos: number[], nor: number[], idx: number[] }}
 */
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
/**
 * Menghasilkan geometri kuadrik silinder/tabung tegak lurus sumbu Y lengkap dengan tutup atas dan bawah.
 * @param {number} r - Jari-jari lingkaran alas dan tutup silinder (mengubah ketebalan silinder)
 * @param {number} h - Tinggi silinder sepanjang sumbu Y (mengubah panjang dari y = 0 hingga y = h)
 * @param {number} [seg=28] - Jumlah segmen melingkar penampang tabung (mengatur kebulatan sisi silinder)
 * @param {number} [rings=4] - Jumlah pembagian cincin vertikal sepanjang badan silinder (mengatur kerapatan subdivisi tinggi)
 * @returns {{ pos: number[], nor: number[], idx: number[] }}
 */
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
/**
 * Menghasilkan geometri kuadrik paraboloid eliptik ganda (berbentuk lensa cembung/cekung),
 * umum digunakan untuk kelopak bunga matahari (Sunflower).
 * @param {number} a - Radius semi-sumbu X penampang oval kelopak (mengatur lebar kelopak)
 * @param {number} b - Radius semi-sumbu Y penampang oval kelopak (mengatur panjang vertikal kelopak)
 * @param {number} depth - Kedalaman lengkungan paraboloid sisi belakang (mengatur kecekungan/kelengkungan belakang)
 * @param {number} thick - Ketebalan puncak paraboloid sisi depan (mengatur kecembungan puncak lensa di tengah)
 * @param {number} [segU=10] - Jumlah segmen radial dari pusat kelopak ke tepi luar (mengatur kehalusan gradasi dari tengah ke tepi)
 * @param {number} [segV=36] - Jumlah segmen sudut melingkar di sekeliling kelopak (mengatur kehalusan bentuk tepi oval)
 * @returns {{ pos: number[], nor: number[], idx: number[] }}
 */
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
/**
 * Menghasilkan geometri kuadrik kerucut (cone) dengan alas melingkar pada y = 0 dan puncak di (0, h, 0).
 * @param {number} r - Jari-jari lingkaran alas kerucut (mengatur kelebaran dasar kerucut)
 * @param {number} h - Tinggi kerucut dari dasar ke puncak lancip (mengatur kelancipan/panjang kerucut)
 * @param {number} [seg=14] - Jumlah segmen poligon melingkar sekeliling kerucut (mengatur kehalusan kebulatan dasar)
 * @returns {{ pos: number[], nor: number[], idx: number[] }}
 */
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
/**
 * Menghasilkan kerucut terpotong (frustum) tanpa tutup, membentang dari y = 0 sampai y = h.
 * @param {number} r0 - Jari-jari lingkaran pada posisi bawah y = 0 (mengatur bukaan/lebar bawah)
 * @param {number} r1 - Jari-jari lingkaran pada posisi atas y = h (mengatur bukaan/lebar atas)
 * @param {number} h - Tinggi frustum kerucut pada sumbu Y (mengatur jarak vertikal antar lingkaran)
 * @param {number} [seg=36] - Jumlah segmen melingkar (mengatur kehalusan kontur silindris/kerucut)
 * @param {number} [rings=6] - Jumlah pembagian cincin vertikal sepanjang badan (mengatur kehalusan subdivisi tinggi)
 * @param {boolean} [inward=false] - Arah vektor normal; jika true, normal menghadap ke dalam sumbu (cocok untuk interior berlubang seperti rongga moncong peashooter)
 * @returns {{ pos: number[], nor: number[], idx: number[] }}
 */
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
/**
 * Menghasilkan geometri torus (bentuk donat) pada bidang XZ berpusat di titik asal.
 * @param {number} R - Jari-jari mayor dari pusat asal ke sumbu lingkaran tabung (mengatur lebar cincin donat keseluruhan)
 * @param {number} r - Jari-jari minor penampang tabung melingkar (mengatur ketebalan badan tabung donat)
 * @param {number} [segU=40] - Jumlah segmen melingkari cincin utama donat (mengatur kebulatan lingkaran besar)
 * @param {number} [segV=14] - Jumlah segmen penampang tabung donat (mengatur kebulatan profil ketebalan)
 * @returns {{ pos: number[], nor: number[], idx: number[] }}
 */
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

/**
 * Menghasilkan geometri cakram (disc) 2D datar melingkar pada bidang XZ yang menghadap ke arah +Y.
 * @param {number} r - Jari-jari lingkaran cakram (mengatur luas atau radius piringan)
 * @param {number} [seg=36] - Jumlah subdivisi sudut melingkar (mengatur kehalusan bentuk lingkaran)
 * @returns {{ pos: number[], nor: number[], idx: number[] }}
 */
export function disc(r, seg = 36) {
  const g = newGeo(), c = pushV(g, [0, 0, 0], [0, 1, 0]);
  for (let j = 0; j <= seg; j++) { const th = (2 * Math.PI * j) / seg; pushV(g, [r * Math.sin(th), 0, r * Math.cos(th)], [0, 1, 0]); }
  for (let j = 0; j < seg; j++) g.idx.push(c, c + 1 + j, c + 2 + j);
  return orient(g);
}

/* ============================ OBJEK LAIN: BOX ================================
   Balok w × h × d berpusat di titik asal (normal datar per sisi).              */
/**
 * Menghasilkan geometri balok/kotak (box) 3D dengan normal rata (flat) per masing-masing dari 6 sisinya.
 * @param {number} w - Lebar balok sepanjang sumbu X (mengubah dimensi lebar horizontal)
 * @param {number} h - Tinggi balok sepanjang sumbu Y (mengubah dimensi tinggi vertikal)
 * @param {number} d - Kedalaman balok sepanjang sumbu Z (mengubah dimensi tebal depan-belakang)
 * @returns {{ pos: number[], nor: number[], idx: number[] }}
 */
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

/* ================================ KURVA BÉZIER ================================
   B(t) = (1−t)³P0 + 3(1−t)²t P1 + 3(1−t)t² P2 + t³ P3                           */
export const Bezier = {
  /**
   * Menghitung posisi titik 3D pada kurva Bézier kubik berdasarkan nilai t parameter.
   * @param {Array<[number, number, number]>} P - Array 4 titik kontrol pembentuk kurva Bézier [[x,y,z], ...] (mengubah bentuk dan orientasi kurva)
   * @param {number} t - Nilai parameter interpolasi kurva dari 0.0 (titik awal P0) sampai 1.0 (titik akhir P3)
   * @returns {[number, number, number]} Koordinat [x, y, z] hasil evaluasi kurva pada parameter t
   */
  point(P, t) {
    const u = 1 - t, b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
    return [0, 1, 2].map((k) => b0 * P[0][k] + b1 * P[1][k] + b2 * P[2][k] + b3 * P[3][k]);
  },
  /**
   * Menghitung vektor tangen (turunan pertama / arah maju kurva) pada nilai t parameter.
   * @param {Array<[number, number, number]>} P - Array 4 titik kontrol kurva Bézier kubik
   * @param {number} t - Nilai parameter evaluasi dari 0.0 sampai 1.0
   * @returns {[number, number, number]} Vektor arah singgung/tangen (belum dinormalisasi) pada titik t
   */
  tangent(P, t) {
    const u = 1 - t;
    return [0, 1, 2].map((k) => 3 * u * u * (P[1][k] - P[0][k]) + 6 * u * t * (P[2][k] - P[1][k]) + 3 * t * t * (P[3][k] - P[2][k]));
  },
  /**
   * Mengambil sampel titik-titik diskrit sepanjang kurva Bézier kubik secara merata.
   * @param {Array<[number, number, number]>} P - Array 4 titik kontrol kurva Bézier kubik
   * @param {number} n - Jumlah segmen pembagian sampel (mengubah kerapatan titik sampel kurva)
   * @returns {Array<[number, number, number]>} Array berisi n+1 koordinat titik sampel sepanjang kurva
   */
  sample(P, n) { const pts = []; for (let i = 0; i <= n; i++) pts.push(Bezier.point(P, i / n)); return pts; },
};

/**
 * Menghasilkan tabung (tube) 3D yang membungkus deretan titik lintasan kurva,
 * dengan radius fleksibel yang dapat bervariasi di setiap titik t menggunakan frame parallel transport.
 * @param {Array<[number, number, number]>} points - Daftar urutan koordinat titik 3D sebagai lintasan atau tulang belakang tabung
 * @param {function(number): number} radiusFn - Fungsi pemetaan radius `(t) => r`, menerima t dari 0.0 s.d 1.0 (mengatur variasi ketebalan tabung di setiap segmen lintasan)
 * @param {number} [radial=12] - Jumlah segmen sudut melingkar penampang tabung (mengatur kebulatan penampang silinder pipa)
 * @returns {{ pos: number[], nor: number[], idx: number[] }}
 */
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
/**
 * Menghasilkan geometri daun parametrik 3D berdinding ganda (solid bervolume)
 * dibentuk dari batas kurva Bézier kiri-kanan serta lekukan tengah.
 * @param {object} options - Konfigurasi parameter bentuk daun:
 * @param {number} options.length - Panjang total daun di sepanjang sumbu X (mengubah bentangan daun dari pangkal ke ujung)
 * @param {number} options.width - Setengah lebar daun di sepanjang sumbu Z (mengubah kelebaran mekar daun ke samping)
 * @param {number} [options.lift=0.16] - Ketinggian angkat kurva pada sepertiga awal daun (mengatur kelengkungan naik daun dekat tangkai)
 * @param {number|null} [options.lift2=null] - Ketinggian angkat kurva pada dua pertiga panjang daun; jika null otomatis mengikuti 0.9 * lift (mengatur kelengkungan punggung daun bagian tengah)
 * @param {number} [options.tipDrop=-0.12] - Ketinggian ujung daun relatif terhadap pangkal (nilai negatif membuat ujung daun terkulai/menunduk ke bawah)
 * @param {number} [options.sag=0.06] - Kedalaman cekungan di garis tengah daun (mengatur seberapa melengkung membentuk talang/cekungan di tengah helai daun)
 * @param {number} [options.thick=0.022] - Ketebalan dinding solid daun (mengatur ketebalan mesh atas ke bawah agar memiliki volume 3D)
 * @param {number} [options.nt=30] - Resolusi pembagian segmen memanjang dari pangkal ke ujung (mengatur kehalusan lengkungan daun sepanjang sumbu panjang)
 * @param {number} [options.ns=10] - Resolusi pembagian segmen melintang dari tepi kiri ke kanan (mengatur kehalusan penampang melintang daun)
 * @returns {{ geo: { pos: number[], nor: number[], idx: number[] }, vein: Array<[number, number, number]>, curves: { left: Array<[number, number, number]>, right: Array<[number, number, number]> } }}
 */
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
/**
 * Menghasilkan geometri bidang datar segi empat (plane) pada sumbu XZ dengan posisi y = 0 menghadap ke atas.
 * @param {number} w - Lebar bidang sepanjang sumbu X (mengubah dimensi lebar bentangan bidang)
 * @param {number} d - Kedalaman/panjang bidang sepanjang sumbu Z (mengubah dimensi kedalaman bentangan bidang)
 * @param {any} [color] - Parameter cadangan warna jika diperlukan untuk atribut visual
 * @returns {{ pos: number[], nor: number[], idx: number[] }}
 */
export function plane(w, d, color) {
  const g = newGeo();
  pushV(g, [-w / 2, 0, -d / 2], [0, 1, 0]); pushV(g, [w / 2, 0, -d / 2], [0, 1, 0]);
  pushV(g, [-w / 2, 0, d / 2], [0, 1, 0]); pushV(g, [w / 2, 0, d / 2], [0, 1, 0]);
  g.idx.push(0, 2, 1, 1, 2, 3);
  return orient(g);
}


/* =========================================================================
   GEOMETRI KHUSUS ZOMBIE (digabung dari src/characters/zombie/geometry.js)
   Mengembalikan format TypedArray { p: Float32Array, n: Float32Array, i: Uint16Array }
   ========================================================================= */
/**
 * ==============================================================================
 * GENERATOR GEOMETRI 3D KARAKTER (geometry.js)
 * ==============================================================================
 * Menyediakan fungsi-fungsi pembangun geometri primitif (Quadric, Non-Quadric,
 * Kurva Parametrik Bézier, dan Mesh Segitiga Prosedural) yang digunakan untuk
 * menyusun seluruh anatomi dan pakaian karakter Zombie.
 * ==============================================================================
 */

/**
 * pack: Mengemas array koordinat biasa menjadi format TypedArray WebGL
 * (Float32Array untuk posisi & normal, Uint16Array untuk indeks segitiga).
 * @param {Array<number>} p - Data posisi vertex [x0, y0, z0, x1, ...] (mengubah koordinat posisi seluruh titik vertex)
 * @param {Array<number>} n - Data normal vektor [nx0, ny0, nz0, ...] (mengubah arah pencahayaan dan pantulan shading)
 * @param {Array<number>} i - Indeks segitiga [i0, i1, i2, ...] (mengubah urutan pembentukan poligon segitiga antar vertex)
 * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}} Objek geometri terpaket
 */
function pack(p, n, i) {
  return {
    p: new Float32Array(p),
    n: new Float32Array(n),
    i: new Uint16Array(i),
  };
}

/**
 * grid: Melakukan triangulasi otomatis pada kisi grid 2D berukuran (rows x cols).
 * Setiap sel persegi (quad) dipecah menjadi 2 buah segitiga (6 indeks).
 * @param {number} rows - Jumlah baris kisi (mengatur pembagian segmen arah baris/tinggi)
 * @param {number} cols - Jumlah kolom kisi (mengatur pembagian segmen arah kolom/keliling)
 * @param {Array<number>} idx - Array target untuk menampung indeks segitiga hasil triangulasi
 */
function grid(rows, cols, idx) {
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c,
        b = a + cols + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
}

/**
 * normals: Menghitung vektor normal per-vertex secara otomatis melalui akumulasi
 * cross product sisi-sisi segitiga dari seluruh poligon yang berbagi vertex tersebut.
 * @param {Array<number>} p - Array datar posisi vertex [x0, y0, z0, ...] (sumber titik koordinat untuk menghitung bidang permukaan)
 * @param {Array<number>} idx - Array indeks segitiga (urutan titik pembentuk segitiga untuk penentuan arah normal bidang)
 * @returns {Array<number>} Array vektor normal per-vertex yang telah dinormalisasi
 */
function normals(p, idx) {
  const n = new Array(p.length).fill(0);
  for (let k = 0; k < idx.length; k += 3) {
    const a = idx[k] * 3,
      b = idx[k + 1] * 3,
      c = idx[k + 2] * 3;
    const f = cr(
      [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]],
      [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]],
    );
    for (const v of [a, b, c]) {
      n[v] += f[0];
      n[v + 1] += f[1];
      n[v + 2] += f[2];
    }
  }
  for (let v = 0; v < n.length; v += 3) {
    const l = Math.hypot(n[v], n[v + 1], n[v + 2]) || 1;
    n[v] /= l;
    n[v + 1] /= l;
    n[v + 2] /= l;
  }
  return n;
}

/**
 * QUADRIC: ELLIPSOID
 * Menghasilkan bentuk elipsoid (bola lonjong) parametrik dengan radius semi-sumbu rx, ry, rz.
 * Digunakan untuk: kepala zombie, bola mata, hidung, daging rahang, dan sendi.
 * @param {number} rx - Radius semi-sumbu X (mengubah lebar elipsoid secara horizontal)
 * @param {number} ry - Radius semi-sumbu Y (mengubah tinggi elipsoid secara vertikal)
 * @param {number} rz - Radius semi-sumbu Z (mengubah kedalaman/ketebalan elipsoid ke depan-belakang)
 * @param {number} [sl=32] - Jumlah segmen horizontal / slice (mengatur kehalusan keliling horizontal)
 * @param {number} [st=20] - Jumlah segmen vertikal / stack (mengatur kehalusan lengkungan dari kutub atas ke bawah)
 * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
 */
function zEllipsoid(rx, ry, rz, sl = 32, st = 20) {
  const p = [],
    n = [],
    i = [];
  for (let a = 0; a <= st; a++) {
    const ph = (Math.PI * a) / st;
    for (let b = 0; b <= sl; b++) {
      const th = (2 * Math.PI * b) / sl;
      const x = rx * Math.sin(ph) * Math.cos(th),
        y = ry * Math.cos(ph),
        z = rz * Math.sin(ph) * Math.sin(th);
      p.push(x, y, z);
      const v = nrm([x / rx / rx, y / ry / ry, z / rz / rz]);
      n.push(...v);
    }
  }
  grid(st, sl, i);
  return pack(p, n, i);
}

/**
 * QUADRIC: FRUSTUM (Silinder / Kerucut Terpancung)
 * Menghasilkan silinder meruncing dengan radius alas r1, radius atas r2, dan tinggi 1.
 * Dilengkapi dengan tutup atas dan bawah (jika caps = true).
 * Digunakan untuk: lengan baju, lengan bawah, leher, dan kaki zombie.
 * @param {number} r1 - Radius lingkaran bawah pada y = -0.5 (mengubah diameter pangkal/bawah)
 * @param {number} r2 - Radius lingkaran atas pada y = +0.5 (mengubah diameter ujung/atas)
 * @param {number} [sl=24] - Jumlah segmen melingkar (mengatur kebulatan penampang silinder/frustum)
 * @param {boolean} [caps=true] - Menentukan apakah diberi penutup alas dan atas (true untuk mesh tertutup/solid, false untuk pipa/lubang)
 * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
 */
function frustum(r1, r2, sl = 24, caps = true) {
  const p = [],
    n = [],
    i = [],
    sl0 = r1 - r2;
  for (let a = 0; a <= 1; a++)
    for (let b = 0; b <= sl; b++) {
      const th = (2 * Math.PI * b) / sl,
        r = a ? r2 : r1,
        y = a ? 0.5 : -0.5;
      p.push(r * Math.cos(th), y, r * Math.sin(th));
      n.push(...nrm([Math.cos(th), sl0, Math.sin(th)]));
    }
  grid(1, sl, i);
  if (caps)
    for (const [y, r, ny] of [
      [-0.5, r1, -1],
      [0.5, r2, 1],
    ]) {
      if (r <= 0) continue;
      const c = p.length / 3;
      p.push(0, y, 0);
      n.push(0, ny, 0);
      for (let b = 0; b <= sl; b++) {
        const th = (2 * Math.PI * b) / sl;
        p.push(r * Math.cos(th), y, r * Math.sin(th));
        n.push(0, ny, 0);
      }
      for (let b = 0; b < sl; b++)
        ny > 0
          ? i.push(c, c + 2 + b, c + 1 + b)
          : i.push(c, c + 1 + b, c + 2 + b);
    }
  return pack(p, n, i);
}

/**
 * cylinder: Shorthand pembangun silinder seragam (radius atas = radius bawah = r).
 * @param {number} r - Radius silinder seragam (mengubah ketebalan silinder dari atas hingga bawah)
 * @param {number} [sl=24] - Jumlah segmen melingkar (mengatur kebulatan penampang tabung)
 * @param {boolean} [caps=true] - Menentukan apakah silinder diberi penutup di kedua ujungnya
 * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
 */
const zCylinder = (r, sl, caps) => frustum(r, r, sl, caps);

/**
 * QUADRIC: CONE (Kerucut Biasa / Penuh)
 * Menghasilkan kerucut penuh berpusat di titik asal (y dari -h/2 sampai +h/2)
 * dengan radius alas r, tinggi h, dan ujung lancip (radius 0).
 * Jika down = false (default), ujung lancip menghadap ke atas (+Y).
 * Jika down = true, ujung lancip menghadap ke bawah (-Y).
 * @param {number} r - Radius lingkaran alas kerucut pada sumbu X (mengubah lebar dasar kerucut)
 * @param {number} [h=1] - Tinggi total kerucut sepanjang sumbu Y (mengubah tinggi/kelancipan kerucut)
 * @param {number} [sl=18] - Jumlah segmen melingkar (mengatur kehalusan keliling alas kerucut)
 * @param {boolean} [down=false] - Arah orientasi kerucut; true jika ujung lancip menghadap ke bawah (-Y), false jika menghadap ke atas (+Y)
 * @param {number} [rz=r] - Radius lingkaran alas kerucut pada sumbu Z (mengubah kedalaman dasar kerucut jika berbentuk elips; default sama dengan r)
 * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
 */
export function zCone(r, h = 1, sl = 18, down = false, rz = r) {
  const p = [],
    n = [],
    i = [],
    r1x = down ? 0 : r,
    r2x = down ? r : 0,
    r1z = down ? 0 : rz,
    r2z = down ? rz : 0,
    nySlope = down ? -r : r;
  for (let a = 0; a <= 1; a++)
    for (let b = 0; b <= sl; b++) {
      const th = (2 * Math.PI * b) / sl,
        radX = a ? r2x : r1x,
        radZ = a ? r2z : r1z,
        y = a ? h / 2 : -h / 2;
      p.push(radX * Math.cos(th), y, radZ * Math.sin(th));
      n.push(...nrm([h * Math.cos(th), nySlope, h * Math.sin(th)]));
    }
  grid(1, sl, i);
  const capY = down ? h / 2 : -h / 2,
    capNy = down ? 1 : -1,
    c = p.length / 3;
  p.push(0, capY, 0);
  n.push(0, capNy, 0);
  for (let b = 0; b <= sl; b++) {
    const th = (2 * Math.PI * b) / sl;
    p.push(r * Math.cos(th), capY, rz * Math.sin(th));
    n.push(0, capNy, 0);
  }
  for (let b = 0; b < sl; b++)
    capNy > 0
      ? i.push(c, c + 2 + b, c + 1 + b)
      : i.push(c, c + 1 + b, c + 2 + b);
  return pack(p, n, i);
}

/**
 * BUKAN QUADRIC: BOX (Balok 3D)
 * Menghasilkan balok dengan dimensi lebar (w), tinggi (h), dan kedalaman (d).
 * Memiliki 6 sisi dengan vektor normal tegak lurus per-sisi (flat shading).
 * Digunakan untuk: gigi zombie, sol sepatu, dan ikat pinggang.
 * @param {number} w - Lebar balok sepanjang sumbu X (mengubah ukuran ke samping)
 * @param {number} h - Tinggi balok sepanjang sumbu Y (mengubah ukuran ke atas-bawah)
 * @param {number} d - Kedalaman balok sepanjang sumbu Z (mengubah ukuran tebal ke depan-belakang)
 * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
 */
function zBox(w, h, d) {
  const x = w / 2,
    y = h / 2,
    z = d / 2,
    p = [],
    n = [],
    i = [];
  const F = [
    // Depan (+Z)
    [[0, 0, 1], [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]],
    // Belakang (-Z)
    [[0, 0, -1], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]]],
    // Kanan (+X)
    [[1, 0, 0], [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]]],
    // Kiri (-X)
    [[-1, 0, 0], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]]],
    // Atas (+Y)
    [[0, 1, 0], [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]]],
    // Bawah (-Y)
    [[0, -1, 0], [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]]],
  ];
  let k = 0;
  for (const [fn, vs] of F) {
    for (const v of vs) {
      p.push(...v);
      n.push(...fn);
    }
    i.push(k, k + 1, k + 2, k, k + 2, k + 3);
    k += 4;
  }
  return pack(p, n, i);
}

/**
 * KURVA BÉZIER KUBIK: bz(P, t)
 * Menghitung posisi titik 3D pada kurva Bézier berorde 3 berdasarkan parameter t [0, 1]
 * dengan formula polinomial Bernstein:
 * B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
 * @param {Array<Array<number>>} P - Empat titik kontrol [P0, P1, P2, P3] (mengatur bentuk dan lintasan kelengkungan kurva)
 * @param {number} t - Parameter interpolasi dari 0.0 (awal kurva di P0) sampai 1.0 (akhir kurva di P3)
 * @returns {Array<number>} Koordinat titik [x, y, z] pada kurva
 */
const bz = (P, t) => {
  const m = 1 - t;
  return [0, 1, 2].map(
    (k) =>
      m * m * m * P[0][k] +
      3 * m * m * t * P[1][k] +
      3 * m * t * t * P[2][k] +
      t * t * t * P[3][k],
  );
};

/**
 * MESH KURVA: TUBE (Tabung Melengkung)
 * Menyapu (sweeping) penampang lingkaran dengan radius r(t) di sepanjang kurva lintasan 3D.
 * Menggunakan kerangka koordinat lokal Frenet-Serret untuk orientasi penampang.
 * Digunakan untuk: helai rambut zombie dan dasi yang melambai.
 * @param {Function} path - Fungsi parameter lintasan `(t) => [x, y, z]` (menentukan bentuk alur/tulang lintasan tabung)
 * @param {Function} rf - Fungsi profil radius `(t) => r` (mengatur tebal-tipisnya diameter tabung di sepanjang lintasan t)
 * @param {number} [ns=28] - Jumlah segmen pembagian sepanjang lintasan kurva (mengatur kehalusan belokan alur kurva)
 * @param {number} [rs=10] - Jumlah segmen melingkar penampang tabung (mengatur kebulatan keliling tabung)
 * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
 */
function zTube(path, rf, ns = 28, rs = 10) {
  const p = [],
    n = [],
    i = [];
  let ref = [0, 1, 0];
  for (let a = 0; a <= ns; a++) {
    const t = a / ns,
      c = path(t),
      T = nrm(
        sub(path(Math.min(1, t + 1e-3)), path(Math.max(0, t - 1e-3))),
      );
    if (Math.abs(dt(T, ref)) > 0.95) ref = [1, 0, 0];
    const S = nrm(cr(T, ref)),
      U = cr(S, T),
      r = rf(t);
    for (let b = 0; b <= rs; b++) {
      const th = (2 * Math.PI * b) / rs,
        d = [0, 1, 2].map(
          (k) => S[k] * Math.cos(th) + U[k] * Math.sin(th),
        );
      p.push(c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r);
      n.push(...d);
    }
  }
  grid(ns, rs, i);
  return pack(p, n, i);
}

/**
 * MESH SEGITIGA: PRISM (Ekstrusi Poligon 2D)
 * Mengambil sekumpulan titik poligon 2D pada bidang XY, lalu mengekstrusinya
 * sepanjang sumbu Z setebal d, lengkap dengan sisi samping dan tutup depan-belakang.
 * Digunakan untuk: lidah zombie dan ujung dasi berbentuk panah.
 * @param {Array<Array<number>>} pts - Titik-titik poligon 2D `[[x0, y0], [x1, y1], ...]` (mengatur profil bentuk datar poligon yang diekstrusi)
 * @param {number} d - Ketebalan ekstrusi sepanjang sumbu Z (mengubah ketebalan prisma/volume 3D)
 * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
 */
function prism(pts, d) {
  const p = [],
    i = [],
    cx = pts.reduce((s, v) => s + v[0], 0) / pts.length,
    cy = pts.reduce((s, v) => s + v[1], 0) / pts.length;
  // Tutup depan (+d/2) dan belakang (-d/2)
  for (const z of [d / 2, -d / 2]) {
    const c = p.length / 3;
    p.push(cx, cy, z);
    for (const v of pts) p.push(v[0], v[1], z);
    for (let k = 0; k < pts.length; k++) {
      const a = c + 1 + k,
        b = c + 1 + ((k + 1) % pts.length);
      z > 0 ? i.push(c, a, b) : i.push(c, b, a);
    }
  }
  // Sisi samping poligon
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k],
      b = pts[(k + 1) % pts.length],
      c = p.length / 3;
    p.push(
      a[0], a[1], d / 2,
      b[0], b[1], d / 2,
      b[0], b[1], -d / 2,
      a[0], a[1], -d / 2,
    );
    i.push(c, c + 3, c + 2, c, c + 2, c + 1);
  }
  return pack(p, normals(p, i), i);
}

/**
 * MESH SEGITIGA PROSEDURAL: JACKET (Jas Zombie Robek)
 * Membangun jas yang membungkus tubuh zombie, terbuka di bagian dada/depan,
 * dengan efek compang-camping dan sobekan acak di bagian bawah menggunakan kombinasi
 * beberapa gelombang sinus (multi-frequency wave noise).
 * @param {number} rx - Radius kontur jas pada sumbu X (mengatur kelebaran jas ke samping)
 * @param {number} ry - Radius kontur jas pada sumbu Y (mengatur panjang jas dari atas ke bawah)
 * @param {number} rz - Radius kontur jas pada sumbu Z (mengatur ketebalan jas ke depan-belakang)
 * @param {number} open - Sudut bukaan belahan jas di bagian dada depan dalam radian (mengatur seberapa lebar dada jas terbuka)
 * @param {number} phT - Sudut elevasi bola batas atas jas / leher (mengatur posisi kerah jas)
 * @param {number} phB - Sudut elevasi bola batas bawah jas / pinggul (mengatur panjang jatuh kain jas ke bawah)
 * @param {number} [nr=14] - Jumlah baris vertikal kisi mesh jas (mengatur resolusi subdivisi vertikal)
 * @param {number} [nc=30] - Jumlah kolom keliling kisi mesh jas (mengatur resolusi subdivisi keliling dan detail robekan)
 * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
 */
function jacket(rx, ry, rz, open, phT, phB, nr = 14, nc = 30) {
  const p = [],
    i = [];
  for (let r = 0; r <= nr; r++)
    for (let c = 0; c <= nc; c++) {
      const th = open + ((2 * Math.PI - 2 * open) * c) / nc;

      // Pinggiran compang-camping acak menggunakan kombinasi gelombang sinusoidal
      const angle = (c / nc) * Math.PI * 2;
      const ragged =
        Math.sin(angle * 5) * 0.4 +
        Math.sin(angle * 9 + 2) * 0.3 +
        Math.sin(angle * 13 + 4) * 0.2;

      const fade = Math.pow(r / nr, 2); // Efek sobekan perlahan menguat ke arah bawah
      const pb = phB + ragged * 0.3 * fade;
      const ph = phT + ((pb - phT) * r) / nr;

      let x = rx * Math.sin(ph) * Math.sin(th);
      let y = ry * Math.cos(ph);
      let z = rz * Math.sin(ph) * Math.cos(th);

      // Beri efek flare (melebar) keluar di bawah agar jas tidak melengkung masuk ke selangkangan
      x *= 1 + fade * 0.15;
      z *= 1 + fade * 0.15;

      // Noise gerigi mikro pada tepi kain paling bawah
      if (r === nr) y += c % 2 === 0 ? -0.015 : 0.015;

      p.push(x, y, z);
    }
  grid(nr, nc, i);
  return pack(p, normals(p, i), i);
}

/**
 * MESH SEGITIGA: RAGGED (Tepi Kain Sobek / Gerigi Celana)
 * Menghasilkan cincin pita melingkar berujung gerigi zig-zag tajam.
 * Digunakan untuk: efek robekan kain pada ujung celana zombie di dekat lutut/betis.
 * @param {number} r - Radius keliling celana (mengatur diameter pipa robekan kain celana)
 * @param {number} h - Kedalaman gerigi robekan celana (mengatur panjang rumbai-rumbai sobekan)
 * @param {number} [teeth=9] - Jumlah ujung gigi robekan di sekeliling celana (mengatur frekuensi gerigi sobekan)
 * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
 */
function ragged(r, h, teeth = 9) {
  const p = [],
    i = [],
    N = teeth * 2;
  for (let j = 0; j <= N; j++) {
    const th = (2 * Math.PI * j) / N;
    p.push(r * Math.cos(th), 0, r * Math.sin(th));
    const rr = r * 1.05,
      y = -(j % 2 ? h : h * 0.25);
    p.push(rr * Math.cos(th), y, rr * Math.sin(th));
  }
  for (let j = 0; j < N; j++) {
    const a = j * 2;
    i.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  return pack(p, normals(p, i), i);
}


// ============ BENTUK DASAR (unit mesh) ============
/**
 * Mengonversi kode warna heksadesimal RGB (contoh: "#ff8800") menjadi array komponen warna ternormalisasi [0.0 - 1.0].
 * @param {string} h - String heksadesimal warna berformat "#rrggbb" (mengganti nilai warna target yang ingin dikonversi)
 * @returns {[number, number, number]} Array RGB [r, g, b] dengan rentang nilai 0 hingga 1
 */
const hx = (h) =>
  [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16) / 255);

/**
 * Membangun buffer unit mesh statis gabungan (box, silinder, kerucut, torus, ellipsoid) untuk rendering instanced/primitif lingkungan.
 * @returns {{ arr: Float32Array, ranges: Array<[number, number]> }} Objek data buffer vertex dan rentang offset segitiga per bentuk primitif
 */
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

  // 0 box (balok 6 sisi = 12 segitiga)
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

  return { arr: new Float32Array(A), ranges };
}
const UM = unitMeshes();

// Batu jalan setapak sekarang langsung memakai bentuk balok biasa (indeks 0 = 12 segitiga)
const STONE_RANGE = 0;



export {
  hx,
  UM,
  STONE_RANGE,
  pack,
  grid,
  normals,
  zEllipsoid,
  frustum,
  zCylinder,
  zBox,
  bz,
  zTube,
  prism,
  jacket,
  ragged,
};
