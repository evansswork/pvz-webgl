import { OBJEK_GRAVEYARD } from "./data.js";
import { UM, roundedBoxTriangles } from "./geometry.js";
import { valueNoise, smoothstep, clamp01 } from "./libs.js";

// =====================================================================
//  BATU NISAN, SALIB BATU & ALAS MAKAM
// =====================================================================
//  Dulu semuanya kotak polos. Sekarang tiap benda dibangun sesuai
//  bentuk aslinya, dengan detail pelapukan:
//   • papan nisan  : lengkung bulat, lengkung terkikis, bertakik, pecah
//                    -> tepi miring (bevel), permukaan kasar, panel cekung,
//                       tulisan terukir & salib kecil, sedikit miring,
//                       tertanam di tanah
//   • salib batu   : dua balok bersudut membulat
//   • alas makam   : dua tingkat balok bersudut membulat
//   • warna        : batu berlumut di bagian bawah, noda hujan, bercak (shader 3)
//  Semua mesh dibuat di ruang lokal objek, jadi posisi, putaran & ukuran
//  tetap mengikuti data (matrix / pusat / ukuran_proksi).
// =====================================================================
const GROUND_Y = 10.535; // tinggi tanah dasar

// Nama objek -> jenis bentuk
const GRAVESTONE_STYLE = {
  "Cube.002": "lengkung",
  "Cube.590": "lengkung",
  "Cube.442": "terkikis",
  "Cube.700": "terkikis",
  "Cube.560": "takik",
  "Cube.586": "takik",
  "Cube.587": "takik",
  "Cube.588": "pecah",
  Cube: "salib",
  "Cube.594": "salib",
  "Cube.595": "salib",
  "Cube.181": "salib",
  "Cube.001": "alas",
  "Cube.003": "alas",
  "Cube.592": "alas",
  "Cube.593": "alas",
  "Cube.596": "alas",
  "Cube.597": "alas",
  "Cube.589": "alas",
};
// Sumbu lokal yang menjadi LEBAR (0 = X, 1 = Y). Selain ini, lebar = X.
const GRAVESTONE_WIDTH_AXIS = { "Cube.588": 1 };
const GRAVESTONE_TEXT_SIDE = 1; // sisi papan yang diberi tulisan: +1 atau -1

// ---- Garis atas papan nisan: tinggi atas di posisi lebar x ----
function makeTopOutline(style, hW, hH, seed) {
  const H2 = 2 * hH;
  const arch = (x) => hH - hW + Math.sqrt(Math.max(hW * hW - x * x, 0)); // setengah lingkaran
  if (style === "lengkung") return arch;
  if (style === "terkikis")
    return (x) => {
      // lengkung dengan bahu kanan yang terkikis / gompal
      const chip = smoothstep(0.1 * hW, 0.45 * hW, x) * (1 - smoothstep(0.7 * hW, hW, x));
      const jag = (valueNoise(x * 0.6 + seed, 3.0) - 0.5) * 0.025 * H2 * chip;
      return arch(x) - 0.05 * H2 * chip + jag;
    };
  if (style === "takik")
    return (x) =>
      // atas hampir rata, sedikit turun ke tepi, dengan takik di tengah
      hH - 0.03 * H2 * (Math.abs(x) / hW) - 0.075 * H2 * Math.exp(-Math.pow(x / (0.13 * hW), 2));
  // "pecah": patah miring dan bergerigi
  return (x) => {
    const u = x * 0.18 + seed;
    const zigzag = Math.abs((((u % 2) + 2) % 2) - 1); // gelombang segitiga 0..1
    return hH - 0.2 * hH * ((x + hW) / (2 * hW)) - 0.12 * hH * zigzag - (x > 0.2 * hW ? 0.15 * hH : 0);
  };
}

// ---- Papan nisan: lempeng dengan tepi miring, permukaan kasar & ukiran ----
function slabTriangles(tri, { hW, hT, hH, ext, style, seed }) {
  const bevel = Math.min(0.8, hT * 0.3);
  const zb = -hH - ext; // dasar (ditanam di tanah)
  const top = makeTopOutline(style, hW, hH, seed);
  const carve = style !== "pecah"; // papan pecah tidak diukir
  const NT = 64,
    M = 96; // kisi muka: lebar × tinggi
  const xin = (k) => (hW - bevel) * Math.sin(Math.PI * (k / NT - 0.5)); // rapat di tepi
  const zin = (k) => top(xin(k)) - bevel;

  // kedalaman ukiran (cekung ke dalam) di titik (x, z)
  const lines = [[0.32, 0.55], [0.16, 0.42], [0.02, 0.5], [-0.14, 0.36], [-0.3, 0.22]]; // [tinggi, panjang]
  const carveDepth = (x, z, side) => {
    if (!carve) return 0;
    const ax = Math.abs(x);
    const panel =
      (1 - smoothstep(0.64 * hW, 0.7 * hW, ax)) *
      smoothstep(-0.56 * hH - 1, -0.56 * hH + 1, z) *
      (1 - smoothstep(0.52 * hH - 1, 0.52 * hH + 1, z));
    let d = 0.35 * panel; // panel cekung
    if (side === GRAVESTONE_TEXT_SIDE) {
      for (const [zl, len] of lines) {
        const g = (1 - smoothstep(0.5, 1.0, Math.abs(z - zl * hH) / 0.8)) * (1 - smoothstep(len * hW - 2, len * hW, ax));
        d += 0.5 * g * panel; // baris tulisan
      }
      const s = 0.16 * hW,
        cz = 0.72 * hH; // salib kecil di atas panel
      const bar = (1 - smoothstep(0.5, 1.0, ax / 0.8)) * (1 - smoothstep(1.2 * s, 1.5 * s, Math.abs(z - cz)));
      const arm = (1 - smoothstep(0.5, 1.0, Math.abs(z - (cz + 0.35 * s)) / 0.8)) * (1 - smoothstep(0.9 * s, s, ax));
      d += 0.5 * Math.max(bar, arm);
    }
    return d;
  };

  // titik di muka depan (side = +1) / belakang (side = -1)
  const face = (side, k, r) => {
    const x = xin(k),
      zt = zin(k),
      z = zb + ((zt - zb) * r) / M;
    const edge = clamp01(Math.min(hW - bevel - Math.abs(x), zt - z) / 2.5); // 0 di tepi -> tepi tetap rapi
    const grain =
      (valueNoise(x * 0.8 + seed, z * 0.8 + side * 5) - 0.5) * 0.26 +
      (valueNoise(x * 0.2 + seed * 2, z * 0.2) - 0.5) * 0.38; // kasar halus + bergelombang
    return [x, side * (hT - edge * grain - carveDepth(x, z, side)), z];
  };
  for (const side of [1, -1])
    for (let r = 0; r < M; r++)
      for (let k = 0; k < NT; k++) {
        const a = face(side, k, r),
          b = face(side, k + 1, r),
          c = face(side, k + 1, r + 1),
          d = face(side, k, r + 1);
        tri.push(a, b, c, a, c, d);
      }

  // tepi luar (bevel + dinding samping): mengikuti keliling muka
  const loop = [];
  for (let r = 0; r <= M; r++) loop.push([0, r]);
  for (let k = 1; k <= NT; k++) loop.push([k, M]);
  for (let r = M - 1; r >= 0; r--) loop.push([NT, r]);
  const outer = (side, [k, r]) => {
    let x, z;
    if (k === 0) {
      x = -hW;
      z = zb + ((top(-hW) - zb) * r) / M;
    } else if (k === NT) {
      x = hW;
      z = zb + ((top(hW) - zb) * r) / M;
    } else {
      x = hW * Math.sin(Math.PI * (k / NT - 0.5));
      z = top(x);
    }
    return [x, side * (hT - bevel), z];
  };
  for (let i = 0; i < loop.length - 1; i++) {
    const [p, q] = [loop[i], loop[i + 1]];
    for (const side of [1, -1]) {
      // miring antara muka dan dinding
      const a = face(side, p[0], p[1]),
        b = face(side, q[0], q[1]),
        c = outer(side, q),
        d = outer(side, p);
      tri.push(a, b, c, a, c, d);
    }
    // dinding samping
    const a = outer(1, p),
      b = outer(1, q),
      c = outer(-1, q),
      d = outer(-1, p);
    tri.push(a, b, c, a, c, d);
  }
}

// ---- Salib batu: bilah tegak + lengan (lebar bilah ≈ 20% lebar lengan) ----
function crossTriangles(tri, { hW, hT, hH }) {
  const bar = 0.2 * hW; // setengah lebar bilah
  const r = Math.min(1.0, hT * 0.25);
  roundedBoxTriangles(tri, [0, 0, 0], [bar, hT, hH], r); // bilah tegak
  // lengan: setinggi bilah, di sekitar 2/3 tinggi; sedikit lebih tipis agar tidak tumpang-tindih sebidang
  roundedBoxTriangles(tri, [0, 0, 0.333 * hH], [hW, hT * 0.97, bar], r);
}

// ---- Alas makam: dua tingkat ----
function plinthTriangles(tri, { hW, hT, hH, ext }) {
  const r = Math.min(0.9, hH * 0.12);
  const inset = Math.min(3, 0.1 * Math.min(hW, hT));
  const zb = -hH - ext,
    zMid = 0.3 * hH,
    zt = hH;
  roundedBoxTriangles(tri, [0, 0, (zb + zMid) / 2], [hW, hT, (zMid - zb) / 2], r); // tingkat bawah
  roundedBoxTriangles(tri, [0, 0, (zMid - 0.2 + zt) / 2], [hW - inset, hT - inset, (zt - zMid + 0.2) / 2], r); // tingkat atas
}

// ---- Bangun mesh satu benda, hasilnya ternormalisasi ke ruang [-1,1] benda tsb ----
function buildGravestone(ob, i, style) {
  const m = ob.matrix;
  const hs = [0, 1, 2].map((a) => Math.max(Math.abs(ob.ukuran_proksi[a]) * Math.hypot(m[a * 4], m[a * 4 + 1], m[a * 4 + 2]), 0.01)); // setengah ukuran dunia
  const wAx = GRAVESTONE_WIDTH_AXIS[ob.nama] || 0,
    tAx = 1 - wAx;
  const flipZ = m[9] < 0 ? -1 : 1; // sumbu Z lokal menghadap ke bawah?
  // tinggi dasar benda di dunia -> berapa dalam harus ditanam supaya tidak melayang
  const centerY = m[1] * ob.pusat[0] + m[5] * ob.pusat[1] + m[9] * ob.pusat[2] + m[13];
  const ext = style === "salib" ? 0 : Math.min(6, Math.max(0, centerY - hs[2] - (GROUND_Y - 1.5)));
  const dims = { hW: hs[wAx], hT: hs[tAx], hH: hs[2], ext, style, seed: i * 7.13 };
  const tri = [];
  if (style === "salib") crossTriangles(tri, dims);
  else if (style === "alas") plinthTriangles(tri, dims);
  else slabTriangles(tri, dims);

  // papan nisan sedikit miring (tidak setegak penggaris)
  const isSlab = style !== "salib" && style !== "alas";
  const rnd = (s) => valueNoise(i * 3.7 + s, s * 1.3) - 0.5;
  const leanT = isSlab ? rnd(1) * 0.035 : 0,
    leanW = isSlab ? rnd(2) * 0.02 : 0;
  const out = new Float32Array(tri.length * 3);
  tri.forEach((p, j) => {
    const up = p[2] + dims.hH + ext; // tinggi dari dasar
    const s = [0, 0, 0];
    s[wAx] = p[0] + up * leanW;
    s[tAx] = p[1] + up * leanT;
    s[2] = p[2] * flipZ;
    for (let a = 0; a < 3; a++) out[j * 3 + a] = s[a] / hs[a];
  });
  return out;
}

// Daftarkan mesh tiap batu nisan -> GRAVESTONE_RANGE[indeks objek] = nomor range di UM
const GRAVESTONE_RANGE = new Map();
(function addGravestones() {
  const meshes = [];
  OBJEK_GRAVEYARD.forEach((ob, i) => {
    const style = GRAVESTONE_STYLE[ob.nama];
    if (style) meshes.push([i, buildGravestone(ob, i, style)]);
  });
  const total = meshes.reduce((sum, [, m]) => sum + m.length, 0);
  const merged = new Float32Array(UM.arr.length + total);
  merged.set(UM.arr);
  let offset = UM.arr.length;
  for (const [i, m] of meshes) {
    merged.set(m, offset);
    UM.ranges.push([offset / 3, m.length / 3]);
    GRAVESTONE_RANGE.set(i, UM.ranges.length - 1);
    offset += m.length;
  }
  UM.arr = merged;
})();

export { GROUND_Y, GRAVESTONE_RANGE };
