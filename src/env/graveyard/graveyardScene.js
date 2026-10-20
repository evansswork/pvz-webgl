/**
 * ==============================================================================
 * GRAVEYARD SCENE ADAPTER
 * ==============================================================================
 * Mengemas scene kuburan (graveyard) menjadi modul yang dapat dipanggil
 * oleh renderer utama gabungan.
 * ==============================================================================
 */

import { $, cv, gl, pg, U, ID4 } from "./webgl.js";
import { OBJEK_GRAVEYARD } from "./data.js";
import { M4 } from "./libs.js";
import { KINDS, hx, UM, STONE_RANGE } from "./geometry.js";
import { TERRAIN_GL, drawTerrain } from "./terrain.js";
import { MOUND_RANGE } from "./mound.js";
import { GRAVESTONE_RANGE } from "./gravestone.js";
import { GRAVESLAB_RANGE } from "./graveslab.js";
import { drawEntrance, ENTRANCE_REPLACED } from "./entrance.js";
import { HOUSE_WALL, wallHalfWorld } from "./houseWall.js";
import { drawTree } from "./tree.js";
import { createEnvironment } from "./environment.js";
import { isBrokenBackWallPart, isMainGate } from "./wallRepair.js";

export function createGraveyardScene() {
  // VAO utama untuk semua bentuk dasar
  const pv = gl.createVertexArray();
  const pb = gl.createBuffer();
  gl.bindVertexArray(pv);
  gl.bindBuffer(gl.ARRAY_BUFFER, pb);
  gl.bufferData(gl.ARRAY_BUFFER, UM.arr, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  /**
   * Mengambil ketinggian tanah akurat di koordinat (x, z) dunia
   */
  function getTerrainHeight(x, z) {
    const t = TERRAIN_GL;
    const x0 = t.min[0], z0 = t.min[1];
    const sx = t.size[0], sz = t.size[1];
    if (x < x0 || x > x0 + sx || z < z0 || z > z0 + sz) return 10.535;

    const nx = Math.ceil(sx / 8);
    const nz = Math.ceil(sz / 8);
    const cols = nx + 1;

    const u = Math.max(0, Math.min(nx - 0.001, ((x - x0) / sx) * nx));
    const v = Math.max(0, Math.min(nz - 0.001, ((z - z0) / sz) * nz));

    const ix = Math.floor(u);
    const iz = Math.floor(v);
    const fx = u - ix;
    const fz = v - iz;

    const h00 = t.pos[(iz * cols + ix) * 3 + 1];
    const h10 = t.pos[(iz * cols + (ix + 1)) * 3 + 1];
    const h01 = t.pos[((iz + 1) * cols + ix) * 3 + 1];
    const h11 = t.pos[((iz + 1) * cols + (ix + 1)) * 3 + 1];

    const h0 = h00 + (h10 - h00) * fx;
    const h1 = h01 + (h11 - h01) * fx;
    return h0 + (h1 - h0) * fz;
  }

  // Environment (Langit malam & Landscape rumput luar berlubang untuk area makam)
  const env = createEnvironment(gl, U, ID4, getTerrainHeight);

  // Filter objek yang dihilangkan: pohon, rumah di kuburan, dan peti mayat kayu
  const isHousePart = (ob, i) =>
    HOUSE_WALL.has(i) ||
    ENTRANCE_REPLACED[ob.nama] !== undefined ||
    (ob.jenis === "plane" && !ob.nama.startsWith("Cube") && ob.nama !== "Plane") ||
    (ob.jenis !== "pagar" &&
      ob.posisi[1] > 25 &&
      ob.posisi[2] > 150 &&
      ob.posisi[2] < 425 &&
      ob.posisi[0] > -30 &&
      ob.posisi[0] < 280 &&
      !(ob.jenis === "balok" && Math.abs(ob.warna[0] - 0.089) < 0.01));

  const isRemoved = (ob, i) =>
    ob.jenis === "pohon" ||
    ob.nama === "Cube.750" ||
    ob.nama === "Cube.751" ||
    isBrokenBackWallPart(ob) ||
    isMainGate(ob) ||
    isHousePart(ob, i);

  /**
   * Menggambar semua objek di lingkungan graveyard
   */
  function drawShapes(a, only, onlyComplex, sel, customTransforms) {
    gl.bindVertexArray(pv);
    gl.uniform1i(U.uMode, onlyComplex ? 0 : 1);
    gl.uniformMatrix4fv(U.uR, false, ID4);

    OBJEK_GRAVEYARD.forEach((ob, i) => {
      if (only !== undefined && i !== only) return;
      // Hilangkan pohon, rumah di kuburan, dan peti mayat kayu
      if (isRemoved(ob, i)) return;

      // 1. Tanah dasar
      if (onlyComplex && ob.nama === "Plane") {
        drawTerrain(a);
        gl.bindVertexArray(pv);
        return;
      }

      // 2. Tangga & Pintu kapel
      if (onlyComplex && ENTRANCE_REPLACED[ob.nama]) {
        if (ENTRANCE_REPLACED[ob.nama] === "draw") drawEntrance(a, pv);
        return;
      }

      let k = 0;
      if (ob.jenis === "silinder") k = 1;
      else if (ob.jenis === "kerucut") k = 2;
      else if (ob.jenis === "torus") k = 3;
      else if (ob.jenis === "ellipsoid") k = 4;
      else if (ob.jenis === "plane") k = 5;
      else if (ob.jenis === "pohon") k = 6;

      // 3. Pohon prosedural
      if (ob.jenis === "pohon") {
        drawTree(ob, i, a, onlyComplex, sel);
        return;
      }

      let kProxy = k;
      if (k === 5) {
        kProxy = ob.nama.startsWith("Cube") ? 4 : 0;
      } else if (k === 6) {
        kProxy = 0;
      }

      const isStone = onlyComplex && k === 5 && ob.nama.startsWith("Cube");
      const custom = !onlyComplex
        ? null
        : MOUND_RANGE.has(i)
          ? [MOUND_RANGE.get(i), 2]
          : GRAVESTONE_RANGE.has(i)
            ? [GRAVESTONE_RANGE.get(i), 3]
            : GRAVESLAB_RANGE.has(i)
              ? [GRAVESLAB_RANGE.get(i), 4]
              : null;

      const r = custom
        ? UM.ranges[custom[0]]
        : isStone
          ? UM.ranges[STONE_RANGE]
          : UM.ranges[kProxy];

      // Terapkan matriks objek, dengan dukungan transform kustom (misal: salib miring)
      let m = ob.matrix;
      if (customTransforms && customTransforms[ob.nama]) {
        m = M4.mul(m, customTransforms[ob.nama]);
      }

      gl.uniformMatrix4fv(U.uM, false, m);
      gl.uniform3fv(U.uC, ob.pusat);
      gl.uniform3fv(U.uH, ob.nama === "Plane" ? [1, 1, 0.004] : ob.ukuran_proksi);
      gl.uniform3fv(
        U.uCol,
        i === sel
          ? [1, 1, 0.2]
          : onlyComplex
            ? (k === 5 && ob.nama === "Plane")
              ? [0.015, 0.025, 0.01]
              : ob.warna
            : hx(KINDS[k][1]),
      );
      gl.uniform1f(U.uA, i === sel ? Math.max(a, 0.8) : a);

      const isWall = onlyComplex && !custom && HOUSE_WALL.has(i);
      if (custom) {
        gl.uniform1i(U.uTerrain, custom[1]);
      } else if (isWall) {
        gl.uniform1i(U.uTerrain, 8);
        gl.uniform3fv(U.uHW, wallHalfWorld(ob));
      }

      gl.drawArrays(gl.TRIANGLES, r[0], r[1]);
      if (custom || isWall) gl.uniform1i(U.uTerrain, 0);
    });

    gl.bindVertexArray(null);
  }

  /**
   * Render fungsi lengkap untuk scene graveyard
   */
  function render(VP, eye, options = {}) {
    const {
      mode = 0,
      exposure = 1.4,
      sel = -1,
      customTransforms = null,
    } = options;

    gl.useProgram(pg);
    gl.uniformMatrix4fv(U.uVP, false, VP);
    gl.uniform3fv(U.uCam, eye);
    gl.uniform1f(U.uEx, exposure);
    gl.uniformMatrix4fv(U.uR, false, ID4);
    gl.disable(gl.BLEND);

    // 1. Gambar Langit Malam (Skydome dengan Bulan, Bintang, dan Awan)
    env.renderSky(eye, VP, exposure);

    // 2. Gambar Landscape Rumput di Sekitar Kuburan
    env.renderLandscape(eye, VP, exposure);

    if (mode === 0) {
      drawShapes(1, undefined, true, sel, customTransforms);
      if (sel >= 0) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        drawShapes(0.0, sel, false, sel, customTransforms);
        gl.depthMask(true);
      }
    } else if (mode === 1) {
      drawShapes(1, undefined, false, sel, customTransforms);
    } else {
      drawShapes(1, undefined, true, sel, customTransforms);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      drawShapes(0.42, undefined, false, sel, customTransforms);
      gl.depthMask(true);
    }
  }

  return {
    render,
    getTerrainHeight,
    objects: OBJEK_GRAVEYARD,
  };
}
