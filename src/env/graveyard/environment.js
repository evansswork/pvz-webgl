/**
 * ==============================================================================
 * GRAVEYARD ENVIRONMENT — BINTANG LANGIT, RUMPUT LUAR & DALAM KUBURAN
 * ==============================================================================
 * 1. BINTANG LANGIT MALAM:
 *    - Titik-titik putih (gl.POINTS) yang disebar acak di langit
 * 2. RUMPUT LUAR (Flat Grass Plane):
 *    - 1 bidang persegi datar besar (4 titik, 2 segitiga) di ketinggian Y = 10.0
 * 3. RUMPUT DALAM KUBURAN (Terrain Plane):
 *    - 1 bidang persegi datar (4 titik, 2 segitiga) di ketinggian Y = 10.535
 * ==============================================================================
 */

import { m4 } from "../../core/math.js";
import { OBJEK_GRAVEYARD } from "./data.js";

// helper pembuat VAO untuk 1 bidang datar (4 titik, 2 segitiga)
function makeFlatQuadVao(gl, x0, x1, z0, z1, y) {
  const pos = new Float32Array([
    x0, y, z0,
    x1, y, z0,
    x0, y, z1,
    x1, y, z1,
  ]);
  const idx = new Uint16Array([0, 2, 1, 1, 2, 3]);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  return vao;
}

export function createEnvironment(gl, U, ID4) {
  // 1. Titik-titik bintang di langit (gl.POINTS)
  const numStars = 400;
  const starVerts = [];
  for (let i = 0; i < numStars; i++) {
    starVerts.push(
      (Math.random() - 0.5) * 9000,
      400 + Math.random() * 2100,
      (Math.random() - 0.5) * 9000,
    );
  }
  const skyVao = gl.createVertexArray();
  gl.bindVertexArray(skyVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(starVerts), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  // 2. Bidang rumput luar datar (-4800..4800, Y = 10.0)
  const R = 4800;
  const landVao = makeFlatQuadVao(gl, -R, R, -R, R, 10.0);

  // 3. Bidang rumput dalam kuburan datar (Y = 10.535)
  const ground = OBJEK_GRAVEYARD.find((o) => o.nama === "Plane");
  const [gx, baseY, gz] = [ground.matrix[12], ground.matrix[13], ground.matrix[14]];
  const halfX = Math.abs(ground.matrix[0]);
  const halfZ = Math.abs(ground.matrix[6]);
  const terrainVao = makeFlatQuadVao(gl, gx - halfX, gx + halfX, gz - halfZ, gz + halfZ, baseY);

  function renderSky(camEye) {
    gl.bindVertexArray(skyVao);
    gl.uniformMatrix4fv(U.uM, false, m4.T(camEye[0], 0, camEye[2]));
    gl.uniform3fv(U.uC, [0, 0, 0]);
    gl.uniform3fv(U.uH, [1, 1, 1]);
    gl.uniformMatrix4fv(U.uR, false, ID4);
    gl.uniform1f(U.uA, 1.0);
    gl.uniform1i(U.uTerrain, 10);
    gl.depthMask(false);
    gl.drawArrays(gl.POINTS, 0, numStars);
    gl.depthMask(true);
    gl.uniform1i(U.uTerrain, 0);
    gl.bindVertexArray(null);
  }

  function renderLandscape() {
    gl.bindVertexArray(landVao);
    gl.uniformMatrix4fv(U.uM, false, ID4);
    gl.uniform3fv(U.uC, [0, 0, 0]);
    gl.uniform3fv(U.uH, [1, 1, 1]);
    gl.uniformMatrix4fv(U.uR, false, ID4);
    gl.uniform1f(U.uA, 1.0);
    gl.uniform1i(U.uTerrain, 9);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    gl.uniform1i(U.uTerrain, 0);
    gl.bindVertexArray(null);
  }

  function drawTerrain(alpha) {
    gl.bindVertexArray(terrainVao);
    gl.uniformMatrix4fv(U.uM, false, ID4);
    gl.uniform3fv(U.uC, [0, 0, 0]);
    gl.uniform3fv(U.uH, [1, 1, 1]);
    gl.uniform1f(U.uA, alpha);
    gl.uniform1i(U.uTerrain, 1);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    gl.uniform1i(U.uTerrain, 0);
  }

  return { renderSky, renderLandscape, drawTerrain };
}
