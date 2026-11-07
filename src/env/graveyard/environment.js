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

/**
 * Membuat Vertex Array Object (VAO) untuk sebuah bidang datar persegi (quad) 2 segitiga
 * pada bentangan koordinat X dan Z tertentu pada ketinggian Y konstan.
 * @param {WebGL2RenderingContext} gl - Konteks WebGL aktif (mengganti target alokasi buffer dan VAO)
 * @param {number} x0 - Batas minimum koordinat X (mengubah tepi kiri bentangan bidang)
 * @param {number} x1 - Batas maksimum koordinat X (mengubah tepi kanan bentangan bidang)
 * @param {number} z0 - Batas minimum koordinat Z (mengubah tepi belakang bentangan bidang)
 * @param {number} z1 - Batas maksimum koordinat Z (mengubah tepi depan bentangan bidang)
 * @param {number} y - Elevasi/ketinggian konstan bidang pada sumbu Y (mengubah tinggi letak bidang tanah di world space)
 * @returns {WebGLVertexArrayObject} Objek VAO yang membungkus buffer posisi vertex dan indeks segitiga quad
 */
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

/**
 * Menginisialisasi komponen lingkungan (environment) pemakaman/graveyard meliputi:
 * bintang-bintang langit malam (point particles), bidang rumput luar luas (landscape),
 * dan bidang rumput pekarangan kuburan utama (terrain).
 * @param {WebGL2RenderingContext} gl - Konteks WebGL2 aktif (mengganti konteks grafis tempat pipeline rendering dan VAO dikonfigurasi)
 * @param {Object} U - Objek referensi lokasi variabel uniform pada shader graveyard aktif (mengganti akses ke uM, uC, uH, uR, uA, uTerrain)
 * @param {Float32Array|number[]} ID4 - Matriks identitas 4x4 konstan (digunakan sebagai transformasi dasar default tanpa rotasi/translasi)
 * @returns {{ renderSky: function(number[]): void, renderLandscape: function(): void, drawTerrain: function(number): void }} Objek controller environment berisi fungsi render langit, lanskap luar, dan terrain dalam
 */
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

  /**
   * Merender partikel titik-titik bintang di kubah langit malam (gl.POINTS).
   * Posisi bintang ditranslasikan mengikuti posisi kamera horizontal (X & Z)
   * agar kubah bintang tampak berada pada jarak tak terhingga (skybox illusion).
   * @param {number[]|[number, number, number]} camEye - Vektor koordinat posisi kamera pengamat `[x, y, z]` di ruang dunia (mengubah pusat translasi kubah bintang agar selalu mengikuti posisi kamera)
   */
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

  /**
   * Merender bidang tanah rumput luar perimeter kuburan berukuran sangat luas (flat grass plane).
   */
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

  /**
   * Merender bidang tanah rumput utama di dalam batas kuburan (terrain plane).
   * @param {number} alpha - Nilai transparansi/opacity tanah dari 0.0 (transparan penuh) hingga 1.0 (pekat/solid) (mengubah tingkat kepekatan rendering tanah, misal saat efek fading transisi)
   */
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
