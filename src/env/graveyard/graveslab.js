import { OBJEK_GRAVEYARD } from "./data.js";
import { UM, roundedBoxTriangles } from "./geometry.js";
import { hash2, valueNoise, smoothstep, clamp01 } from "./libs.js";
import { GROUND_Y } from "./gravestone.js";

// =====================================================================
//  BATU KUBURAN (pelat makam datar + peti makam)
// =====================================================================
//  Tiap makam abu-abu terdiri dari beberapa bagian yang bertumpuk:
//   • "rim"   : bingkai luar yang rata di tanah
//   • "cover" : penutup makam, sedikit lebih tinggi dari bingkai
//   • "chest" : peti batu bertutup lengkung (makam tengah di baris atas)
//  Detail pelapukannya:
//   • permukaan berbutir + bergelombang halus, tepi aus dan miring (bevel)
//   • sambungan pelat melintang, retakan bercabang, sudut gompal
//   • peti: alas, badan berpanel (tiang panel), tutup lengkung yang lapuk
//   • warna: shader 4 (batu berlumut jarang, noda hujan, bercak)
// =====================================================================
const GRAVESLAB_STYLE = {
  "Cube.740": "rim",
  "Cube.743": "rim",
  "Cube.745": "rim",
  "Cube.746": "rim",
  "Cube.750": "rim",
  "Cube.741": "cover",
  "Cube.742": "cover",
  "Cube.744": "cover",
  "Cube.747": "cover",
  "Cube.751": "chest",
};

// jarak titik (px,py) ke ruas garis A-B
function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay;
  const t = clamp01(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ---- Pelat datar berpermukaan lapuk. Koordinat: x = lebar, y = panjang, z = tinggi ----
//  opsi: seams (sambungan melintang), cracks (jumlah retakan), chips (jumlah sudut gompal),
//        vault (turunnya tepi pelat -> tutup lengkung), nw / nl (kerapatan mesh)
function slabTopTriangles(tri, o) {
  const { hW, hL, hH, ext, bevel, seed, nw, nl, vault } = o;
  const zb = -hH - ext; // dasar pelat
  const rnd = (k) => hash2(seed * 1.7 + k * 5.3, seed * 0.37 + k * 2.9); // acak 0..1, tetap untuk seed yang sama

  // retakan: garis patah dari tepi panjang ke arah dalam
  const cracks = [];
  for (let c = 0; c < o.cracks; c++) {
    const side = rnd(c * 3 + 1) > 0.5 ? 1 : -1;
    let x = side * hW,
      y = (rnd(c * 3 + 2) - 0.5) * 1.6 * hL;
    const pts = [[x, y]];
    const slope = rnd(c * 3 + 3) - 0.5,
      len = 22 + rnd(c * 3 + 4) * 28;
    for (let s = 1; s <= 6; s++) {
      x -= side * (len / 6);
      y += slope * (len / 6) + (rnd(c * 17 + s) - 0.5) * 5;
      pts.push([x, y]);
    }
    cracks.push(pts);
  }
  // sudut gompal
  const chips = [];
  for (let c = 0; c < o.chips; c++)
    chips.push({ x: (rnd(40 + c) > 0.5 ? 1 : -1) * hW, y: (rnd(50 + c) > 0.5 ? 1 : -1) * hL, R: 5 + rnd(60 + c) * 4 });
  const seamsY = o.seams ? [-hL / 3, hL / 3] : []; // pelat tersambung jadi 3 bagian

  // tinggi permukaan atas di titik (x, y)
  const topAt = (x, y) => {
    const edge = Math.min(hW - bevel - Math.abs(x), hL - bevel - Math.abs(y)); // jarak ke tepi
    let h = hH - bevel;
    h -= (valueNoise(x * 0.7 + seed, y * 0.7) - 0.5) * 0.2 + (valueNoise(x * 0.15 + seed * 2, y * 0.15) - 0.5) * 0.3; // butiran + gelombang
    h -= 0.35 * (1 - smoothstep(0, 3, edge)) * (0.4 + valueNoise(x * 0.5, y * 0.5 + seed)); // tepi aus
    if (vault) h -= vault * (x * x) / (hW * hW); // tutup melengkung: tepi lebih rendah
    if (o.dip) h -= o.dip.depth * (1 - smoothstep(o.dip.width * 0.5, o.dip.width, Math.abs(x))); // bagian tengah aus terinjak
    for (const sy of seamsY) h -= 0.55 * (1 - smoothstep(0.25, 0.7, Math.abs(y - sy))); // alur sambungan
    for (const pts of cracks) {
      let d = 1e9;
      for (let s = 0; s < pts.length - 1; s++) d = Math.min(d, distToSegment(x, y, pts[s][0], pts[s][1], pts[s + 1][0], pts[s + 1][1]));
      h -= 0.5 * (1 - smoothstep(0.15, 0.55, d)); // alur retakan
    }
    for (const c of chips) h -= Math.pow(clamp01(1 - Math.hypot(x - c.x, y - c.y) / c.R), 1.5); // gompal
    return Math.max(h, zb + 0.3);
  };
  const P = (i, j) => {
    const x = -(hW - bevel) + (2 * (hW - bevel) * i) / nw,
      y = -(hL - bevel) + (2 * (hL - bevel) * j) / nl;
    return [x, y, topAt(x, y)];
  };

  // 1) permukaan atas
  for (let j = 0; j < nl; j++)
    for (let i = 0; i < nw; i++) {
      const a = P(i, j),
        b = P(i + 1, j),
        c = P(i + 1, j + 1),
        d = P(i, j + 1);
      tri.push(a, b, c, a, c, d);
    }
  // 2) tepi miring + dinding samping, mengikuti keliling kisi
  const border = [];
  for (let i = 0; i <= nw; i++) border.push([i, 0]);
  for (let j = 1; j <= nl; j++) border.push([nw, j]);
  for (let i = nw - 1; i >= 0; i--) border.push([i, nl]);
  for (let j = nl - 1; j >= 1; j--) border.push([0, j]);
  border.push(border[0]);
  const outer = ([i, j]) => {
    const p = P(i, j);
    const ox = i === 0 ? -1 : i === nw ? 1 : 0,
      oy = j === 0 ? -1 : j === nl ? 1 : 0;
    return [p[0] + ox * bevel, p[1] + oy * bevel, p[2] - bevel];
  };
  for (let k = 0; k < border.length - 1; k++) {
    const p = border[k],
      q = border[k + 1];
    const a = P(...p),
      b = P(...q),
      c = outer(q),
      d = outer(p);
    tri.push(a, b, c, a, c, d); // bevel
    const lo = (v) => [v[0], v[1], zb];
    tri.push(d, c, lo(c), d, lo(c), lo(d)); // dinding ke dasar
  }
}

// ---- Peti makam: alas + badan berpanel + tutup lengkung ----
function chestTriangles(tri, { hW, hL, hH, seed }) {
  const H2 = 2 * hH,
    plH = 0.16 * H2,
    lidH = 0.45 * H2;
  const zb = -hH,
    zPl = zb + plH,
    zLid = hH - lidH; // batas alas | badan | tutup
  const r = 0.8;
  roundedBoxTriangles(tri, [0, 0, (zb + zPl) / 2], [hW, hL, plH / 2], r); // alas peti
  const bw = hW - 2.4,
    bl = hL - 3.5;
  roundedBoxTriangles(tri, [0, 0, (zPl + zLid) / 2], [bw, bl, (zLid - zPl) / 2 + 0.3], r); // badan peti
  for (const sx of [-1, 1])
    for (const f of [-0.8, -0.27, 0.27, 0.8]) // tiang panel di dua sisi panjang
      roundedBoxTriangles(tri, [sx * (bw + 0.5), f * bl, (zPl + zLid) / 2], [1.0, 1.8, (zLid - zPl) / 2 - 0.2], 0.4);
  // tutup: pelat lapuk bertepi lengkung (turun ke arah samping)
  const lid = [];
  slabTopTriangles(lid, { hW: hW - 0.4, hL: hL - 0.4, hH: lidH / 2, ext: 0, bevel: 0.9, seed, nw: 44, nl: 100, vault: 0.22 * H2, seams: false, cracks: 1, chips: 1 });
  const shift = zLid + lidH / 2;
  tri.push(...lid.map((p) => [p[0], p[1], p[2] + shift]));
}

// ---- Bangun mesh satu bagian makam (hasil ternormalisasi seperti batu nisan) ----
function buildGraveSlab(ob, i, style) {
  const m = ob.matrix;
  const hs = [0, 1, 2].map((a) => Math.max(Math.abs(ob.ukuran_proksi[a]) * Math.hypot(m[a * 4], m[a * 4 + 1], m[a * 4 + 2]), 0.01));
  const flipZ = m[9] < 0 ? -1 : 1;
  const centerY = m[1] * ob.pusat[0] + m[5] * ob.pusat[1] + m[9] * ob.pusat[2] + m[13];
  const ext = style === "rim" ? Math.min(6, Math.max(0, centerY - hs[2] - (GROUND_Y - 1.5))) : 0; // bingkai ditanam sedikit
  const d = { hW: hs[0], hL: hs[1], hH: hs[2], ext, seed: i * 7.13 };
  const tri = [];
  if (style === "chest") chestTriangles(tri, d);
  else if (style === "cover") slabTopTriangles(tri, { ...d, bevel: 0.6, nw: 56, nl: 128, seams: true, cracks: 2, chips: 1 });
  else slabTopTriangles(tri, { ...d, bevel: 0.6, nw: 24, nl: 60, seams: false, cracks: 1, chips: 2 });
  const out = new Float32Array(tri.length * 3);
  tri.forEach((p, j) => {
    out[j * 3] = p[0] / hs[0];
    out[j * 3 + 1] = p[1] / hs[1];
    out[j * 3 + 2] = (p[2] * flipZ) / hs[2];
  });
  return out;
}

// Daftarkan mesh -> GRAVESLAB_RANGE[indeks objek] = nomor range di UM
const GRAVESLAB_RANGE = new Map();
(function addGraveSlabs() {
  const meshes = [];
  OBJEK_GRAVEYARD.forEach((ob, i) => {
    const style = GRAVESLAB_STYLE[ob.nama];
    if (style) meshes.push([i, buildGraveSlab(ob, i, style)]);
  });
  const total = meshes.reduce((sum, [, m]) => sum + m.length, 0);
  const merged = new Float32Array(UM.arr.length + total);
  merged.set(UM.arr);
  let offset = UM.arr.length;
  for (const [i, m] of meshes) {
    merged.set(m, offset);
    UM.ranges.push([offset / 3, m.length / 3]);
    GRAVESLAB_RANGE.set(i, UM.ranges.length - 1);
    offset += m.length;
  }
  UM.arr = merged;
})();

export { slabTopTriangles, GRAVESLAB_RANGE };
