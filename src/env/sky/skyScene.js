/**
 * ==============================================================================
 * SKY SCENE — LANGIT MALAM BERBINTANG 3D (WebGL2, gl.POINTS)
 * ==============================================================================
 * Modul independen untuk merender kubah langit malam berbintang:
 * - Membangkitkan 400 titik bintang acak di ruang 3D (gl.POINTS) tanpa tekstur berat.
 * - Kubah bintang otomatis mengikuti posisi kamera horizontal (X & Z) untuk
 *   menciptakan ilusi jarak tak terhingga (skybox illusion).
 * ==============================================================================
 */

import { m4 } from "../../core/math.js";

const vs = `#version 300 es
layout(location=0) in vec3 aP;
uniform mat4 uVP, uM;
void main() {
  vec3 vP = (uM * vec4(aP, 1.0)).xyz;
  gl_Position = uVP * vec4(vP, 1.0);
  gl_PointSize = 2.5;
}`;

const fs = `#version 300 es
precision highp float;
out vec4 fC;
void main() {
  fC = vec4(1.0, 1.0, 1.0, 1.0);
}`;

/**
 * Menginisialisasi scene langit malam berbintang 3D (Sky Scene).
 * Mengalokasikan shader khusus partikel bintang (gl.POINTS) dan Vertex Array Object (VAO).
 *
 * @param {WebGL2RenderingContext} gl - Konteks rendering WebGL2 aktif.
 *        Mengubah parameter ini mengalihkan alokasi VAO/VBO dan program shader ke konteks WebGL target.
 * @returns {{ render: function(Float32Array|number[], number[]): void }} Objek pengontrol scene langit malam dengan metode `render`.
 */
export function createSkyScene(gl) {
  /**
   * Mengompilasi shader GLSL (Vertex / Fragment) untuk program langit berbintang.
   * @param {number} type - Tipe shader WebGL (`gl.VERTEX_SHADER` atau `gl.FRAGMENT_SHADER`).
   *        Mengubah parameter ini menentukan tahapan pipeline shader yang dikompilasi.
   * @param {string} source - Kode sumber GLSL shader.
   *        Mengubah kode sumber ini memodifikasi ukuran titik bintang (`gl_PointSize`) atau warna bintang.
   * @returns {WebGLShader} Objek shader yang telah dikompilasi.
   */
  function compileShader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  const pg = gl.createProgram();
  gl.attachShader(pg, compileShader(gl.VERTEX_SHADER, vs));
  gl.attachShader(pg, compileShader(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(pg, 0, "aP");
  gl.linkProgram(pg);

  const uVP = gl.getUniformLocation(pg, "uVP");
  const uM = gl.getUniformLocation(pg, "uM");

  // Titik-titik bintang di langit malam (gl.POINTS)
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

  /**
   * Merender partikel titik-titik bintang di kubah langit malam per frame.
   * Posisi bintang ditranslasikan mengikuti posisi kamera horizontal (X & Z)
   * dengan `depthMask(false)` agar selalu berada di latar belakang terjauh.
   *
   * @param {Float32Array|number[]} VP - Matriks gabungan View-Projection ($P \times V$) dari kamera.
   *        Mengubah matriks ini menyesuaikan proyeksi posisi bintang terhadap sudut pandang kamera.
   * @param {number[]|[number, number, number]} camEye - Vektor koordinat posisi kamera pengamat `[x, y, z]` di ruang dunia.
   *        Mengubah nilai ini menggeser pusat kubah bintang agar selalu mengikuti pergerakan horizontal kamera.
   * @returns {void}
   */
  function render(VP, camEye) {
    gl.useProgram(pg);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(skyVao);
    gl.uniformMatrix4fv(uVP, false, VP);
    gl.uniformMatrix4fv(uM, false, m4.T(camEye[0], 0, camEye[2]));
    gl.depthMask(false);
    gl.drawArrays(gl.POINTS, 0, numStars);
    gl.depthMask(true);
    gl.bindVertexArray(null);
  }

  return { render };
}
