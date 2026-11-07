/**
 * ==============================================================================
 * GRAVEYARD SCENE ADAPTER (WebGL2, Shaders, & Scene Rendering)
 * ==============================================================================
 * Modul khusus untuk merender objek-objek batu kuburan (nisan, makam, jalan setapak,
 * tembok keliling, tiang utama, dan pohon tua).
 * Langit malam (sky) dan hamparan rumput (grass) telah dipisahkan ke modul
 * `src/env/sky/skyScene.js` dan `src/env/grass/grassScene.js`.
 * ==============================================================================
 */

import { OBJEK_GRAVEYARD } from "./data.js";
import { UM, STONE_RANGE } from "../../core/geometry.js";
import { GRAVESTONE_RANGE } from "./gravestone.js";

// =====================================================================
//  1. SHADER GRAVEYARD (Khusus Objek Batu Kuburan & Pohon Tua)
// =====================================================================
const vs = `#version 300 es
layout(location=0) in vec3 aP;
uniform mat4 uVP, uM, uR;
uniform vec3 uC, uH;
out vec3 vP;
void main() {
  vec3 p = (uR * vec4(aP * uH, 1.0)).xyz + uC;
  vP = (uM * vec4(p, 1.0)).xyz;
  gl_Position = uVP * vec4(vP, 1.0);
}`;

const fs = `#version 300 es
precision highp float;
in vec3 vP;
uniform vec3 uCol, uCam;
uniform float uEx, uA;
uniform int uTerrain;

// --- Fungsi Noise Prosedural Simpel (Tanpa File Gambar/Tekstur Luar) ---
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.0; a *= 0.5; }
  return s / 0.9375;
}
// Noise 3D ringan agar tekstur batu konsisten di semua sisi (atas, depan, samping)
float n3(vec3 p, float sc) {
  return vnoise(p.xz * sc + vec2(p.y * sc * 0.77, p.y * sc * 0.31));
}

// --- Material Batu Kuburan Realistis (Nisan, Makam, Jalan Setapak, Tembok) ---
vec3 stoneAlbedo(vec3 p, vec3 n, vec3 base) {
  float h = max(p.y - 10.535, 0.0);                    // ketinggian dari permukaan tanah
  float grain = n3(p, 1.6);                            // pori-pori/butiran halus batu
  float blotch = fbm(p.xz * 0.18 + vec2(p.y * 0.15));  // bercak batu tua tidak rata
  float streak = vnoise(vec2((p.x + p.z) * 0.6, p.y * 0.05)); // noda air hujan vertikal

  // Variasi warna dasar batu + noda pelapukan
  vec3 col = base * (0.78 + 0.44 * grain);
  col *= 1.0 - 0.25 * smoothstep(0.50, 0.85, blotch);
  col *= 1.0 - 0.22 * smoothstep(0.45, 0.80, streak) * smoothstep(0.0, 35.0, h);

  // Lumut hijau gelap: merambat di bagian bawah batu & permukaan yang menghadap atas
  float nearGround = 1.0 - smoothstep(0.0, 18.0, h);
  float mossMask = smoothstep(0.45, 0.72, blotch + nearGround * 0.55 - 0.10);
  vec3 mossCol = mix(vec3(0.010, 0.024, 0.008), vec3(0.020, 0.035, 0.011), grain);
  col = mix(col, mossCol, mossMask * 0.75 * (0.45 + 0.55 * max(n.y, 0.0)));

  // Ambient Occlusion (bayangan kontak gelap di kaki batu tempat menancap ke tanah)
  float groundAO = mix(0.45, 1.0, smoothstep(0.0, 5.5, h));
  return col * groundAO * (0.80 + 0.20 * n.y);
}

out vec4 fC;
void main() {
  // Hitung normal permukaan otomatis dari turunan ruang layar
  vec3 dx = dFdx(vP);
  vec3 dy = dFdy(vP);
  vec3 n = normalize(cross(dx, dy));

  vec3 v = normalize(uCam - vP);
  if (dot(n, v) < 0.0) n = -n;

  // Bump normal tipis khusus objek batu agar permukaan balok tampak bertekstur pahatan
  vec3 bump = vec3(
    n3(vP + vec3(0.35, 0.0, 0.0), 1.2) - n3(vP - vec3(0.35, 0.0, 0.0), 1.2),
    n3(vP + vec3(0.0, 0.35, 0.0), 1.2) - n3(vP - vec3(0.0, 0.35, 0.0), 1.2),
    n3(vP + vec3(0.0, 0.0, 0.35), 1.2) - n3(vP - vec3(0.0, 0.0, 0.35), 1.2)
  );
  n = normalize(n + bump * 0.22);

  // Pencahayaan malam: Ambient langit-tanah + Diffuse sinar bulan + Specular & Rim
  vec3 L = normalize(vec3(0.5, 0.9, 0.4));
  float d = max(dot(n, L), 0.0);

  float h = n.y * 0.5 + 0.5;
  vec3 amb = mix(vec3(0.38, 0.43, 0.54), vec3(0.78, 0.88, 1.0), h);
  vec3 l = amb * 0.8 + vec3(1.0, 0.95, 0.85) * d * 0.65;

  // Kabut malam berdasarkan jarak horizontal dari kamera
  float distCam = length(vP.xz - uCam.xz);
  float fog = smoothstep(1000.0, 4600.0, distCam);
  vec3 fogCol = vec3(0.024, 0.038, 0.068);

  // Objek batu kuburan: warna batu berlumut + pantulan sinar bulan (specular & rim)
  vec3 stone = stoneAlbedo(vP, n, uCol);
  vec3 H = normalize(L + v);
  float spec = pow(max(dot(n, H), 0.0), 24.0) * 0.16;
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.12 * max(n.y + 0.3, 0.0);

  vec3 gc = (pow(stone, vec3(0.45)) * l + vec3(0.75, 0.85, 1.0) * (spec + rim)) * vec3(0.86, 0.93, 1.06) * uEx;
  gc = mix(gc, fogCol * uEx, fog);
  // Tone mapping ACES agar kontras cahaya malam lembut dan realistis
  gc = clamp((gc * (2.51 * gc + 0.03)) / (gc * (2.43 * gc + 0.59) + 0.14), 0.0, 1.0);
  fC = vec4(gc, uA);
}`;

// =====================================================================
//  2. INISIALISASI WEBGL2 & PROGRAM SHADER
// =====================================================================
const $ = (id) => document.getElementById(id);
const cv = $("c");
const gl = cv.getContext("webgl2", { antialias: true, stencil: true });
if (!gl) alert("WebGL2 tidak didukung!");

const pg = gl.createProgram();

/**
 * Mengompilasi kode sumber shader (Vertex atau Fragment) dan menautkannya ke WebGL Program.
 * @param {number} t - Tipe shader WebGL: `gl.VERTEX_SHADER` atau `gl.FRAGMENT_SHADER`.
 *        Mengubah parameter ini menentukan apakah kode GLSL diproses pada tahap pemrosesan verteks atau pewarnaan piksel/fragmen.
 * @param {string} s - String kode sumber GLSL shader (source code).
 *        Mengubah string ini memodifikasi logika transformasi verteks (vs) atau formula pencahayaan dan material warna (fs).
 * @returns {void}
 */
const sh = (t, s) => {
  const o = gl.createShader(t);
  gl.shaderSource(o, s);
  gl.compileShader(o);
  gl.attachShader(pg, o);
};
sh(gl.VERTEX_SHADER, vs);
sh(gl.FRAGMENT_SHADER, fs);
gl.bindAttribLocation(pg, 0, "aP");
gl.linkProgram(pg);
gl.useProgram(pg);

const U = {};
["uVP", "uM", "uR", "uC", "uH", "uCol", "uCam", "uEx", "uA", "uTerrain"].forEach(
  (n) => (U[n] = gl.getUniformLocation(pg, n)),
);
const ID4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
gl.uniformMatrix4fv(U.uR, false, ID4);

// =====================================================================
//  3. SCENE GRAVEYARD
// =====================================================================
/**
 * Inisialisasi dan konfigurasi scene lingkungan Kuburan (Graveyard).
 * Mengelola VAO primitif terpadu serta rendering nisan, makam, jalan setapak, tembok, tiang, dan pohon tua.
 * @returns {{render: Function, getTerrainHeight: Function}} Objek pengontrol scene graveyard.
 */
export function createGraveyardScene() {
  const pv = gl.createVertexArray();
  const pb = gl.createBuffer();
  gl.bindVertexArray(pv);
  gl.bindBuffer(gl.ARRAY_BUFFER, pb);
  gl.bufferData(gl.ARRAY_BUFFER, UM.arr, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  /**
   * Mengembalikan elevasi ketinggian permukaan tanah dasar area kuburan.
   * Digunakan oleh logika karakter/zombie saat melangkah di area kuburan agar menapak pas di atas tanah.
   * @param {number} [x] - Koordinat posisi horizontal X (opsional).
   * @param {number} [z] - Koordinat posisi kedalaman Z (opsional).
   * @returns {number} Ketinggian elevasi bidang tanah kuburan (Y = 10.535).
   */
  function getTerrainHeight(x, z) {
    return 10.535;
  }

  /**
   * Menggambar seluruh objek 3D statis kuburan (nisan makam, jalan setapak batu, tembok perimeter, tiang, dan pohon tua).
   * Melakukan iterasi terhadap array data `OBJEK_GRAVEYARD` dan mengirimkan uniform matriks, ukuran proksi, serta warna ke GPU.
   * @returns {void}
   */
  function drawShapes() {
    gl.bindVertexArray(pv);
    gl.uniformMatrix4fv(U.uR, false, ID4);

    OBJEK_GRAVEYARD.forEach((ob, i) => {
      let k = 0;
      if (ob.jenis === "silinder") k = 1;
      else if (ob.jenis === "kerucut") k = 2;
      else if (ob.jenis === "torus") k = 3;
      else if (ob.jenis === "ellipsoid") k = 4;
      else if (ob.jenis === "plane") k = 5;

      const kProxy = k === 5 ? (ob.nama.startsWith("Cube") ? 4 : 0) : k;
      const isStone = k === 5 && ob.nama.startsWith("Cube");
      const custom = GRAVESTONE_RANGE.has(i) ? [GRAVESTONE_RANGE.get(i), 3] : null;

      const r = custom
        ? UM.ranges[custom[0]]
        : isStone
          ? UM.ranges[STONE_RANGE]
          : UM.ranges[kProxy];

      gl.uniformMatrix4fv(U.uM, false, ob.matrix);
      gl.uniform3fv(U.uC, ob.pusat);
      gl.uniform3fv(U.uH, ob.ukuran_proksi);
      gl.uniform3fv(U.uCol, ob.warna);
      gl.uniform1f(U.uA, 1);

      if (custom) gl.uniform1i(U.uTerrain, custom[1]);
      gl.drawArrays(gl.TRIANGLES, r[0], r[1]);
      if (custom) gl.uniform1i(U.uTerrain, 0);
    });

    gl.bindVertexArray(null);
  }

  /**
   * Render utama objek-objek batu kuburan per frame.
   * @param {Float32Array|Array<number>} VP - Matriks gabungan Proyeksi-Pandang (View-Projection Matrix $P \times V$).
   *        Mengubah VP akan mengubah sudut pandang kamera, perspektif FOV, atau posisi kamera terhadap kuburan.
   * @param {Array<number>} eye - Koordinat posisi kamera pengamat di dunia 3D `[x, y, z]`.
   *        Digunakan oleh shader untuk menghitung vektor pandang (view vector), specular highlight sinar bulan, rim light, dan jarak kabut malam.
   * @param {Object} [options={}] - Konfigurasi render tambahan:
   * @param {number} [options.exposure=1.4] - Faktor eksposur pencahayaan malam.
   *        Mengubah nilai exposure akan menerangkan atau menggelapkan suasana malam di area kuburan sebelum proses tone mapping ACES.
   * @returns {void}
   */
  function render(VP, eye, options = {}) {
    const { exposure = 1.4 } = options;

    gl.useProgram(pg);
    gl.uniformMatrix4fv(U.uVP, false, VP);
    gl.uniform3fv(U.uCam, eye);
    gl.uniform1f(U.uEx, exposure);
    gl.uniformMatrix4fv(U.uR, false, ID4);
    gl.disable(gl.BLEND);

    drawShapes();
  }

  return { render, getTerrainHeight };
}

export { cv, gl };
