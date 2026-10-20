import { gl, pg, U, ID4 } from "./webgl.js";
import { OBJEK_GRAVEYARD } from "./data.js";
import { valueNoise, fbm, smoothstep } from "./libs.js";
import { isBrokenBackWallPart, isMainGate } from "./wallRepair.js";

// =====================================================================
//  TANAH KUBURAN (medan / terrain)
// =====================================================================
//  Dulu tanah hanya satu kotak datar. Sekarang berupa permukaan
//  bergelombang landai yang dibangun dari kisi titik:
//   • bukit landai + gundukan kecil (noise)  -> tinggi paling sekitar ±1.9
//   • DATAR di dekat benda (batu jalan, makam, pagar, kapel) supaya
//     benda tidak melayang atau terkubur
//   • warna rumput <-> tanah terinjak diatur di shader memakai
//     "peta tanah" (splat map): R = jarak ke benda, G = jarak ke jalan setapak
// =====================================================================
const TERRAIN = {
  cell: 8, // jarak antar titik kisi (satuan dunia)
  rolling: 1.5, // tinggi bukit landai
  bumpy: 0.35, // tinggi gundukan kecil
  flatNear: [2, 30], // jarak ke benda: <2 datar penuh, >30 bergelombang penuh
  reach: 60, // jarak maksimum yang dicatat di peta tanah
};

// ---- kotak jejak (footprint) sebuah benda di bidang tanah (X-Z) ----
function footprint(ob) {
  const m = ob.matrix;
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        // sudut kotak proksi di ruang lokal -> ruang dunia
        const lx = ob.pusat[0] + sx * Math.max(Math.abs(ob.ukuran_proksi[0]), 0.02);
        const ly = ob.pusat[1] + sy * Math.max(Math.abs(ob.ukuran_proksi[1]), 0.02);
        const lz = ob.pusat[2] + sz * Math.max(Math.abs(ob.ukuran_proksi[2]), 0.02);
        const x = m[0] * lx + m[4] * ly + m[8] * lz + m[12];
        const z = m[2] * lx + m[6] * ly + m[10] * lz + m[14];
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }
  return { minX, maxX, minZ, maxZ };
}

// ---- bangun mesh tanah + peta tanah, lalu kirim ke GPU ----
const TERRAIN_GL = (function createTerrain() {
  const ground = OBJEK_GRAVEYARD.find((o) => o.nama === "Plane"); // plane tanah dasar
  const baseY = ground.posisi[1];
  const halfX = Math.abs(ground.matrix[0]),
    halfZ = Math.abs(ground.matrix[6]);
  const x0 = ground.posisi[0] - halfX,
    x1 = ground.posisi[0] + halfX;
  const z0 = ground.posisi[2] - halfZ,
    z1 = ground.posisi[2] + halfZ;
  const nx = Math.ceil((x1 - x0) / TERRAIN.cell),
    nz = Math.ceil((z1 - z0) / TERRAIN.cell);
  const cols = nx + 1,
    rows = nz + 1;
  const R = TERRAIN.reach;

  // 1) Jarak tiap titik kisi ke benda terdekat, dan ke batu jalan terdekat
  const distAll = new Float32Array(cols * rows).fill(R);
  const distPath = new Float32Array(cols * rows).fill(R);
  for (const ob of OBJEK_GRAVEYARD) {
    const isRoof = ob.jenis === "plane" && !ob.nama.startsWith("Cube"); // atap: abaikan
    if (ob === ground || isRoof) continue;
    // Abaikan benda yang dihapus: pohon, peti mayat, puing dinding hancur, pagar utama, dan rumah di kuburan
    if (ob.jenis === "pohon" || ob.nama === "Cube.750" || ob.nama === "Cube.751" || isBrokenBackWallPart(ob) || isMainGate(ob)) continue;
    if (ob.posisi[1] > 25 && ob.posisi[2] > 150 && ob.posisi[2] < 425 && ob.posisi[0] > -30 && ob.posisi[0] < 280) continue;
    const isPath = ob.jenis === "plane"; // batu jalan setapak
    const f = footprint(ob);
    const ixA = Math.max(0, Math.floor((f.minX - R - x0) / ((x1 - x0) / nx)));
    const ixB = Math.min(nx, Math.ceil((f.maxX + R - x0) / ((x1 - x0) / nx)));
    const izA = Math.max(0, Math.floor((f.minZ - R - z0) / ((z1 - z0) / nz)));
    const izB = Math.min(nz, Math.ceil((f.maxZ + R - z0) / ((z1 - z0) / nz)));
    for (let iz = izA; iz <= izB; iz++)
      for (let ix = ixA; ix <= ixB; ix++) {
        const x = x0 + ((x1 - x0) * ix) / nx,
          z = z0 + ((z1 - z0) * iz) / nz;
        const d = Math.hypot(Math.max(f.minX - x, 0, x - f.maxX), Math.max(f.minZ - z, 0, z - f.maxZ));
        const k = iz * cols + ix;
        if (d < distAll[k]) distAll[k] = d;
        if (isPath && d < distPath[k]) distPath[k] = d;
      }
  }

  // 2) Titik-titik mesh: tinggi = dasar + gelombang (diredam dekat benda)
  const pos = new Float32Array(cols * rows * 3);
  const splat = new Uint8Array(cols * rows * 4);
  for (let iz = 0; iz < rows; iz++)
    for (let ix = 0; ix < cols; ix++) {
      const k = iz * cols + ix;
      const x = x0 + ((x1 - x0) * ix) / nx,
        z = z0 + ((z1 - z0) * iz) / nz;
      const flat = smoothstep(TERRAIN.flatNear[0], TERRAIN.flatNear[1], distAll[k]);
      // Redam gelombang di sisi selatan makam (Z < -740) agar menyatu rata ke jalan raya
      const southFlat = smoothstep(-785.0, -740.0, z);
      const rolling = (fbm(x / 220, z / 220) - 0.5) * 2 * TERRAIN.rolling;
      const bumps = (valueNoise(x / 16, z / 16) - 0.5) * 2 * TERRAIN.bumpy;
      pos.set([x, baseY + flat * southFlat * (rolling + bumps), z], k * 3);
      splat[k * 4] = (distAll[k] / R) * 255;
      splat[k * 4 + 1] = (distPath[k] / R) * 255;
      splat[k * 4 + 3] = 255;
    }

  // 3) Susun segitiga: tiap petak kisi = 2 segitiga
  const idx = new Uint16Array(nx * nz * 6);
  let n = 0;
  for (let iz = 0; iz < nz; iz++)
    for (let ix = 0; ix < nx; ix++) {
      const a = iz * cols + ix,
        b = a + 1,
        c = a + cols,
        d = c + 1;
      idx.set([a, c, b, b, c, d], n);
      n += 6;
    }

  // 4) Kirim ke GPU (VAO sendiri + tekstur peta tanah)
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, splat);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  ["uTerrain", "uSplat", "uTerrMin", "uTerrSize"].forEach((name) => (U[name] = gl.getUniformLocation(pg, name)));
  return { vao, tex, count: idx.length, min: [x0, z0], size: [x1 - x0, z1 - z0], pos };
})();

// Gambar tanah (dipanggil dari drawShapes pada mode model & gabungan)
function drawTerrain(alpha) {
  const t = TERRAIN_GL;
  gl.bindVertexArray(t.vao);
  gl.uniformMatrix4fv(U.uM, false, ID4); // posisi titik sudah di koordinat dunia
  gl.uniform3fv(U.uC, [0, 0, 0]);
  gl.uniform3fv(U.uH, [1, 1, 1]);
  gl.uniform1f(U.uA, alpha);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, t.tex);
  gl.uniform1i(U.uSplat, 0);
  gl.uniform2fv(U.uTerrMin, t.min);
  gl.uniform2fv(U.uTerrSize, t.size);
  gl.uniform1i(U.uTerrain, 1); // shader: pakai warna rumput/tanah
  gl.drawElements(gl.TRIANGLES, t.count, gl.UNSIGNED_SHORT, 0);
  gl.uniform1i(U.uTerrain, 0);
}

export { TERRAIN_GL, drawTerrain };
