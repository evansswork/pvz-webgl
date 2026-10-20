import { m4, M, sub, nrm, tr, inv, seg, axisRot, cr, dt } from "./libs.js";

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
 * @param {Array<number>} p - Data posisi vertex [x0, y0, z0, x1, ...]
 * @param {Array<number>} n - Data normal vektor [nx0, ny0, nz0, ...]
 * @param {Array<number>} i - Indeks segitiga [i0, i1, i2, ...]
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
 * @param {number} rows - Jumlah baris kisi
 * @param {number} cols - Jumlah kolom kisi
 * @param {Array<number>} idx - Array target untuk menampung indeks segitiga
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
 * @param {Array<number>} p - Array posisi vertex
 * @param {Array<number>} idx - Array indeks segitiga
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
 * @param {number} rx - Radius sumbu X
 * @param {number} ry - Radius sumbu Y
 * @param {number} rz - Radius sumbu Z
 * @param {number} sl - Jumlah segmen horizontal (slice)
 * @param {number} st - Jumlah segmen vertikal (stack)
 * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
 */
function ellipsoid(rx, ry, rz, sl = 32, st = 20) {
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
 * @param {number} r1 - Radius lingkaran bawah (y = -0.5)
 * @param {number} r2 - Radius lingkaran atas (y = +0.5)
 * @param {number} sl - Jumlah segmen melingkar
 * @param {boolean} caps - Apakah diberi penutup alas & atas
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
 * @param {number} r - Radius silinder
 * @param {number} sl - Segmen melingkar
 * @param {boolean} caps - Apakah memiliki tutup
 * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
 */
const cylinder = (r, sl, caps) => frustum(r, r, sl, caps);

/**
 * BUKAN QUADRIC: TORUS (Cincin Donat)
 * Menghasilkan bentuk donat berpusat di sumbu Y dengan radius utama R dan radius tabung r.
 * Digunakan untuk: kerah baju, manset lengan, dan lubang bibir zombie.
 * @param {number} R - Jarak dari pusat cincin ke tengah tabung
 * @param {number} r - Radius penampang tabung
 * @param {number} su - Segmen pembagian keliling cincin utama
 * @param {number} sv - Segmen pembagian penampang tabung
 * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
 */
function torus(R, r, su = 36, sv = 14) {
  const p = [],
    n = [],
    i = [];
  for (let a = 0; a <= su; a++) {
    const u = (2 * Math.PI * a) / su;
    for (let b = 0; b <= sv; b++) {
      const v = (2 * Math.PI * b) / sv;
      p.push(
        (R + r * Math.cos(v)) * Math.cos(u),
        r * Math.sin(v),
        (R + r * Math.cos(v)) * Math.sin(u),
      );
      n.push(
        Math.cos(v) * Math.cos(u),
        Math.sin(v),
        Math.cos(v) * Math.sin(u),
      );
    }
  }
  grid(su, sv, i);
  return pack(p, n, i);
}

/**
 * QUADRIC: ELLIPTIC PARABOLOID
 * Menghasilkan kubah mangkuk elips dangkal dengan persamaan z = h * (1 - x²/a² - y²/b²).
 * Digunakan untuk: tempurung rongga mulut dan bentuk kelopak mata.
 * @param {number} a - Radius semi-sumbu X
 * @param {number} b - Radius semi-sumbu Y
 * @param {number} h - Kedalaman/tinggi parabola
 * @param {number} rg - Jumlah cincin konsentris (radial grid)
 * @param {number} sl - Jumlah potongan melingkar (angular slices)
 * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
 */
function paraboloid(a, b, h, rg = 10, sl = 28) {
  const p = [],
    n = [],
    i = [];
  for (let k = 0; k <= rg; k++) {
    const r = k / rg;
    for (let j = 0; j <= sl; j++) {
      const th = (2 * Math.PI * j) / sl,
        x = a * r * Math.cos(th),
        y = b * r * Math.sin(th);
      p.push(x, y, h * (1 - r * r));
      n.push(...nrm([(2 * h * x) / a / a, (2 * h * y) / b / b, 1]));
    }
  }
  grid(rg, sl, i);
  return pack(p, n, i);
}

/**
 * BUKAN QUADRIC: BOX (Balok 3D)
 * Menghasilkan balok dengan dimensi lebar (w), tinggi (h), dan kedalaman (d).
 * Memiliki 6 sisi dengan vektor normal tegak lurus per-sisi (flat shading).
 * Digunakan untuk: gigi zombie, sol sepatu, dan ikat pinggang.
 * @param {number} w - Lebar (lebar sumbu X)
 * @param {number} h - Tinggi (tinggi sumbu Y)
 * @param {number} d - Kedalaman (panjang sumbu Z)
 * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
 */
function box(w, h, d) {
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
 * @param {Array<Array<number>>} P - Empat titik kontrol [P0, P1, P2, P3]
 * @param {number} t - Parameter interpolasi dari 0.0 sampai 1.0
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
 * @param {Function} path - Fungsi parameter lintasan t => [x, y, z]
 * @param {Function} rf - Fungsi profil radius terhadap t => r
 * @param {number} ns - Jumlah segmen sepanjang lintasan
 * @param {number} rs - Jumlah segmen melingkar penampang tabung
 * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
 */
function tube(path, rf, ns = 28, rs = 10) {
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
 * MESH KURVA: LEAF (Permukaan Daun / Bidang Lentur)
 * Membangun lembaran permukaan melengkung yang dibatasi oleh dua kurva Bézier kubik
 * (batas kiri L dan batas kanan R), dengan efek cekungan di tengah (cup).
 * Digunakan untuk: kerah baju zombie yang terlipat dan daun telinga.
 * @param {Array<Array<number>>} L - Empat titik kontrol kurva tepi kiri
 * @param {Array<Array<number>>} R - Empat titik kontrol kurva tepi kanan
 * @param {number} cup - Kedalaman lengkungan cekungan tengah
 * @param {number} nt - Segmen pembagian longitudinal (sepanjang daun)
 * @param {number} ns - Segmen pembagian transversal (lebar daun)
 * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
 */
function leaf(L, R, cup, nt = 22, ns = 8) {
  const p = [],
    i = [];
  for (let a = 0; a <= nt; a++) {
    const t = a / nt,
      l = bz(L, t),
      r = bz(R, t);
    for (let b = 0; b <= ns; b++) {
      const s = b / ns;
      p.push(
        l[0] + (r[0] - l[0]) * s,
        l[1] +
          (r[1] - l[1]) * s -
          cup * Math.sin(Math.PI * s) * Math.sin(Math.PI * t),
        l[2] + (r[2] - l[2]) * s,
      );
    }
  }
  grid(nt, ns, i);
  return pack(p, normals(p, i), i);
}

/**
 * MESH SEGITIGA: PRISM (Ekstrusi Poligon 2D)
 * Mengambil sekumpulan titik poligon 2D pada bidang XY, lalu mengekstrusinya
 * sepanjang sumbu Z setebal d, lengkap dengan sisi samping dan tutup depan-belakang.
 * Digunakan untuk: lidah zombie dan ujung dasi berbentuk panah.
 * @param {Array<Array<number>>} pts - Titik-titik poligon 2D [[x0, y0], [x1, y1], ...]
 * @param {number} d - Ketebalan ekstrusi sumbu Z
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
 * @param {number} rx - Radius kontur jas sumbu X
 * @param {number} ry - Radius kontur jas sumbu Y
 * @param {number} rz - Radius kontur jas sumbu Z
 * @param {number} open - Sudut bukaan jas di bagian depan (radian)
 * @param {number} phT - Sudut elevasi atas jas (leher)
 * @param {number} phB - Sudut elevasi bawah jas (pinggul)
 * @param {number} nr - Jumlah baris vertikal kisi
 * @param {number} nc - Jumlah kolom keliling kisi
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
 * @param {number} r - Radius keliling celana
 * @param {number} h - Kedalaman gerigi robekan
 * @param {number} teeth - Jumlah gigi robekan di sekeliling celana
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

export { pack, grid, normals, ellipsoid, frustum, cylinder, torus, paraboloid, box, bz, tube, leaf, prism, jacket, ragged };
