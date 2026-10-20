import { OBJEK_GRAVEYARD } from "./data.js";
import { UM } from "./geometry.js";
import { fbm } from "./libs.js";

// =====================================================================
//  GUNDUKAN TANAH MAKAM
// =====================================================================
//  Petak tanah makam (6 kotak cokelat-oranye) diganti gundukan tanah:
//   • puncak membulat + punggung memanjang di tengah (khas gundukan makam)
//   • sisi landai yang turun dan menyatu dengan tanah dasar
//   • permukaan bergumpal (noise), tiap gundukan bentuknya berbeda
//   • warna & tekstur diatur shader (uTerrain = 2): tanah lembap, kerikil,
//     rumput liar tipis di kaki gundukan
//  Mesh dibuat di ruang [-1,1] terhadap kotak aslinya, jadi posisi, putaran
//  dan ukurannya tetap mengikuti data kotak (uC / uH / matrix).
// =====================================================================
const MOUND = {
  cols: 36, // jumlah petak mesh melebar
  rows: 88, // jumlah petak mesh memanjang
  crown: 0.9, // tinggi puncak (1.0 = setinggi atap kotak lama)
};

// Petak tanah makam = balok berwarna cokelat-oranye (0.089, 0.037, 0.013)
const isGraveSoil = (ob) =>
  ob.jenis === "balok" &&
  Math.abs(ob.warna[0] - 0.089) < 0.01 &&
  Math.abs(ob.warna[1] - 0.037) < 0.01 &&
  ob.warna[2] < 0.02;

// Tinggi gundukan di titik (u, v) pada petak [-1,1]²: 0 = di tepi, 1 = puncak
function moundHeight(u, v, seed) {
  const edge = 1 - (Math.pow(Math.abs(u), 2.4) + Math.pow(Math.abs(v), 3.0)); // kubah lonjong
  if (edge <= 0) return 0;
  const dome = Math.pow(edge, 0.55); // sisi landai, puncak membulat
  const ridge = 0.07 * Math.exp(-(u * u) / 0.12); // punggung memanjang di tengah
  const lumps = (fbm(u * 3 + seed, v * 6 + seed) - 0.5) * 0.16 * Math.min(1, edge * 4); // gumpalan tanah
  return Math.min(1, Math.max(0, dome + ridge + lumps));
}

function buildMoundTriangles(seed) {
  const { cols, rows, crown } = MOUND;
  const at = (iu, iv) => {
    const u = -1 + (2 * iu) / cols,
      v = -1 + (2 * iv) / rows;
    return [u, v, -1 + (crown + 1) * moundHeight(u, v, seed * 7.31)]; // z = -1 (dasar) … crown (puncak)
  };
  const tri = [];
  for (let iv = 0; iv < rows; iv++)
    for (let iu = 0; iu < cols; iu++) {
      const a = at(iu, iv),
        b = at(iu + 1, iv),
        c = at(iu + 1, iv + 1),
        d = at(iu, iv + 1);
      tri.push(...a, ...b, ...c, ...a, ...c, ...d);
    }
  return new Float32Array(tri);
}

// Daftarkan satu mesh gundukan per petak tanah -> MOUND_RANGE[indeks objek] = nomor range di UM
const MOUND_RANGE = new Map();
(function addMounds() {
  const meshes = [];
  OBJEK_GRAVEYARD.forEach((ob, i) => {
    if (isGraveSoil(ob)) meshes.push([i, buildMoundTriangles(i)]);
  });
  const total = meshes.reduce((sum, [, m]) => sum + m.length, 0);
  const merged = new Float32Array(UM.arr.length + total);
  merged.set(UM.arr);
  let offset = UM.arr.length;
  for (const [i, m] of meshes) {
    merged.set(m, offset);
    UM.ranges.push([offset / 3, m.length / 3]); // [titik awal, jumlah titik]
    MOUND_RANGE.set(i, UM.ranges.length - 1);
    offset += m.length;
  }
  UM.arr = merged;
})();

export { MOUND_RANGE };
