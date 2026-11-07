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
//  1. SHADER GRAVEYARD (Unified Shader: Batu Kuburan & Pohon Tua)
// =====================================================================
//
//  SIAPA SAJA YANG MENGGUNAKAN SHADER INI?
//  ---------------------------------------------------------------------
//  Shader ini dirancang sebagai UNIFIED ENVIRONMENTAL SHADER (satu shader
//  serbaguna efisien) yang dipakai bersama oleh seluruh objek di kuburan:
//    1. Batu Nisan & Alas Makam (Cube.001 s/d Cube.018)
//    2. Balok Pelat Penutup & Bingkai Makam (Cube.019 s/d Cube.032)
//    3. Lempeng Batu Jalan Setapak (Cube.033 s/d Cube.064)
//    4. 6 Tiang Utama Batu (2 gerbang depan + 4 tiang sudut perimeter)
//    5. 5 Rentang Tembok Batu Polos Keliling (depan, belakang, samping)
//    6. Pohon Tua Angker Besar:
//       - Batang liuk bawah & atas (silinder)
//       - 5 Dahan cabang besar (silinder)
//       - 2 Ranting meruncing (kerucut)
//       - 6 Gumpalan kanopi dedaunan kelam (quadric ellipsoid)
//
//  KENAPA BATU DAN POHON BISA MEMAKAI SATU SHADER YANG SAMA?
//  ---------------------------------------------------------------------
//  - Fleksibilitas Warna (`uCol`): Saat menggambar batu, GPU dikirimi warna
//    abu-abu (`#0a0b0c` / `#2c2b2c`); saat menggambar pohon, dikirimi warna
//    kayu cokelat tua (`KAYU_TUA`) atau daun hijau gelap (`DAUN_KELAM`).
//  - Multi-Peran Fungsi Noise Prosedural:
//    * `grain` (pori-pori mikro) -> Di nisan jadi pori batu; di batang jadi
//      pori kulit kayu; di kanopi jadi tekstur helai daun.
//    * `streak` (noda vertikal sumbu Y) -> Di tembok jadi lelehan air hujan;
//      di batang kayu jadi guratan serat kayu membujur.
//    * `blotch` (bercak FBM) -> Di batu jadi bercak lapuk tua; di kayu jadi
//      kulit kayu mengelupas.
//  - Respon Elevasi Ketinggian (`nearGround`): Objek di dekat tanah (kaki batu &
//    pangkal pohon) otomatis berlumut hijau lembap; sedangkan objek di atas
//    (kanopi daun & pucuk dahan) otomatis bersih dari lumut dan hanya menerima
//    kilau sinar bulan (specular & rim light).
//  - Keuntungan Teknis: GPU tidak perlu berganti-ganti program shader
//    (Zero Shader Switching Overhead), rendering menjadi super cepat (60 FPS).
//
//  CARA KERJA SHADER PIPELINE KUBURAN:
//  ---------------------------------------------------------------------
//  1. VERTEX SHADER (`vs`):
//     - Menerima atribut posisi vertex unit [-1, 1] (`aP`) dari buffer geometri terpadu (`UM.arr`).
//     - Mengalikan `aP` dengan ukuran proksi `uH` (half-dimensions) untuk membentuk dimensi balok yang pas.
//     - Mengaplikasikan matriks rotasi lokal `uR` dan menambahkan offset pusat `uC`.
//     - Mengalikan hasil dengan matriks transformasi model dunia `uM` untuk menghasilkan koordinat
//       dunia nyata `vP` (world position).
//     - Mengalikan `vP` dengan matriks View-Projection `uVP` kamera untuk memproyeksikannya ke layar (`gl_Position`).
//
//  2. FRAGMENT SHADER (`fs`):
//     - Menghitung vektor normal bidang secara dinamis tanpa buffer normal, menggunakan
//       screen-space partial derivatives: `dFdx(vP)` dan `dFdy(vP)`.
//     - Menghasilkan detail tonjolan pahatan batu (surface bump) menggunakan turunan fungsi noise 3D (`n3`).
//     - Memanggil fungsi prosedural `stoneAlbedo()` untuk menghasilkan tekstur butiran pori batu,
//       bercak lapuk tua, noda air hujan vertikal, lumut hijau lembap merambat di kaki batu,
//       dan bayangan kontak Ambient Occlusion (AO).
//     - Menghitung pencahayaan malam atmosferik:
//       * Hemispherical Ambient (pantulan biru langit di atas dan lantai di bawah).
//       * Directional Moonlight Diffuse + Blinn-Phong Specular dan Rim Light.
//       * Kabut atmosferik biru tua (`fog`) berdasarkan jarak horizontal ke kamera.
//       * Tone mapping filmis ACES untuk menghasilkan kontras warna malam yang kaya dan lembut.
// =====================================================================

/**
 * GLSL Vertex Shader untuk objek-objek kuburan.
 * 
 * PARAMETER UNIFORM & EFEK JIKA MENGGANTI NILAINYA:
 * - `uVP` (mat4): Matriks View-Projection ($P \times V$).
 *   * Kalau diganti/diubah: Sudut kamera, posisi sudut pandang (view), dan perspektif FOV berubah.
 * - `uM` (mat4): Matriks Model Dunia dari objek (`ob.matrix`).
 *   * Kalau diganti/diubah: Menggeser posisi translasi dunia objek (X, Y, Z), skala, serta rotasi orientasi objek.
 * - `uR` (mat4): Matriks rotasi lokal tambahan (default: Identity Matrix 4x4).
 *   * Kalau diganti/diubah: Memutar objek pada pivot lokalnya sendiri sebelum matriks dunia diterapkan.
 * - `uC` (vec3): Titik offset pusat lokal objek (`ob.pusat`).
 *   * Kalau diganti/diubah: Menggeser titik pivot bentuk geometri objek relatif terhadap posisi induknya.
 * - `uH` (vec3): Setengah ukuran proksi dimensi objek (`ob.ukuran_proksi`).
 *   * Kalau diganti/diubah: Mengubah dimensi panjang (X), tinggi (Y), atau tebal (Z) fisik balok/mesh.
 */
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

/**
 * GLSL Fragment Shader untuk objek-objek kuburan.
 *
 * PARAMETER UNIFORM & EFEK JIKA MENGGANTI NILAINYA:
 * - `uCol` (vec3): Warna albedo dasar objek RGB [r, g, b] dari `data.js`.
 *   * Kalau diganti: Warna dasar batu atau pohon berubah (misal batu nisan jadi lebih kelam atau lebih terang).
 * - `uCam` (vec3): Posisi koordinat kamera pengamat di dunia 3D [x, y, z].
 *   * Kalau diganti: Menentukan arah datangnya pandangan mata (view direction) untuk specular sinar bulan,
 *     efek rim lighting di tepi batu, dan perhitungan ketebalan kabut jarak jauh.
 * - `uEx` (float): Faktor exposure / intensitas kecerahan malam (default 1.4).
 *   * Kalau dinaikkan: Suasana malam menjadi lebih terang/benderang.
 *   * Kalau diturunkan: Suasana malam menjadi semakin gulita/gelap pekat.
 * - `uA` (float): Nilai transparansi alpha (default 1.0).
 *   * Kalau diturunkan di bawah 1.0: Objek menjadi transparan tembus pandang.
 * - `uTerrain` (int): Kode material khusus nisan/makam dari `GRAVESTONE_RANGE`.
 */
const fs = `#version 300 es
precision highp float;
in vec3 vP;
uniform vec3 uCol, uCam;
uniform float uEx, uA;
uniform int uTerrain;

// --- Fungsi Noise Prosedural Simpel (Tanpa File Gambar/Tekstur Luar) ---

// Fungsi hash pseudo-acak 2D ke 1D
// Kalau konstanta 127.1 / 311.7 diganti: Pola sebaran bintik acak akan bergeser ke pola noise yang baru.
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Value Noise 2D dengan interpolasi kurva Hermite halus (smoothstep)
// Menghasilkan gradasi noise halus berkelanjutan antar-titik grid integer.
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal Brownian Motion (FBM) 4-oktaf
// Mengakumulasi 4 lapisan noise dengan frekuensi ganda (2.0) dan amplitudo separuh (0.5).
// Kalau jumlah iterasi loop ditambah: Detail tekstur makin padat dan tajam, namun beban GPU bertambah.
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.0; a *= 0.5; }
  return s / 0.9375;
}

// Noise 3D ringan berbasis proyeksi bidang silang (XZ dan Y)
// Parameter sc: Faktor skala frekuensi kerapatan noise.
// Kalau sc diperbesar: Pori-pori dan butiran tekstur tampak lebih kecil/padat merata di seluruh sisi balok.
float n3(vec3 p, float sc) {
  return vnoise(p.xz * sc + vec2(p.y * sc * 0.77, p.y * sc * 0.31));
}

// --- Material Tekstur Prosedural Alami (Digunakan Bersama: Batu Kuburan & Pohon Tua) ---
/**
 * Menghitung warna tekstur permukaan material alam secara prosedural matematis.
 * 
 * SIAPA YANG MEMAKAINYA:
 * 1. Objek Batu (Nisan, Makam, Tembok, Tiang, Jalan Setapak):
 *    - Base color abu-abu + grain (pori batu) + streak (noda air hujan) + blotch (lapuk tua).
 * 2. Pohon Tua (Batang, Dahan, Ranting, Kanopi Daun):
 *    - Base color kayu tua / daun kelam + grain (pori kayu/daun) + streak (alur serat kayu) + blotch (kulit terkelupas).
 * 
 * @param p: Posisi titik piksel di ruang dunia 3D (world position).
 * @param n: Vektor normal permukaan bidang di titik tersebut.
 * @param base: Warna RGB dasar material dari uniform uCol.
 * @return: Warna akhir permukaan berlumut dan bertekstur sebelum diproses pencahayaan.
 */
vec3 stoneAlbedo(vec3 p, vec3 n, vec3 base) {
  // Jarak ketinggian piksel dari permukaan tanah kuburan (GROUND_Y = 10.535).
  // Kalau angka 10.535 diganti: Batas elevasi dasar lumut dan AO akan naik atau turun.
  float h = max(p.y - 10.535, 0.0);

  // 1. Pori-pori mikro batu (grain)
  // Kalau frekuensi 1.6 diperbesar: Butiran pori-pori batu menjadi lebih halus dan rapat.
  float grain = n3(p, 1.6);

  // 2. Bercak noda batu tua lapuk (blotch)
  // Kalau faktor 0.18 diperbesar: Bercak lapuk menjadi lebih kecil-kecil dan tersebar banyak.
  float blotch = fbm(p.xz * 0.18 + vec2(p.y * 0.15));

  // 3. Noda bekas tetesan air hujan vertikal (streak)
  // Dipengaruhi oleh koordinat tinggi Y (p.y * 0.05) untuk memberikan ilusi lelehan air dari atas ke bawah.
  float streak = vnoise(vec2((p.x + p.z) * 0.6, p.y * 0.05));

  // Kombinasi warna dasar batu dengan variasi butiran dan noda pelapukan
  vec3 col = base * (0.78 + 0.44 * grain);
  col *= 1.0 - 0.25 * smoothstep(0.50, 0.85, blotch);
  col *= 1.0 - 0.22 * smoothstep(0.45, 0.80, streak) * smoothstep(0.0, 35.0, h);

  // 4. Lapisan lumut hijau lembap (moss):
  // Lumut tumbuh subur di bagian kaki batu yang dekat dengan tanah (h < 18.0) serta permukaan yang menghadap atas (n.y > 0).
  // Kalau nilai 18.0 dinaikkan: Lumut akan merambat memanjat lebih tinggi ke atas nisan/tembok.
  float nearGround = 1.0 - smoothstep(0.0, 18.0, h);
  float mossMask = smoothstep(0.45, 0.72, blotch + nearGround * 0.55 - 0.10);
  vec3 mossCol = mix(vec3(0.010, 0.024, 0.008), vec3(0.020, 0.035, 0.011), grain);
  col = mix(col, mossCol, mossMask * 0.75 * (0.45 + 0.55 * max(n.y, 0.0)));

  // 5. Contact Ambient Occlusion (bayangan gelap di dasar batu tempat menancap ke tanah)
  // Kalau nilai 5.5 diperbesar: Bayangan oklusi di pangkal nisan menjadi lebih tebal dan luas.
  float groundAO = mix(0.45, 1.0, smoothstep(0.0, 5.5, h));
  return col * groundAO * (0.80 + 0.20 * n.y);
}

out vec4 fC;
void main() {
  // Hitung vektor normal permukaan secara dinamis menggunakan turunan parsial layar (screen-space derivative).
  // Menghilangkan kebutuhan buffer normal terpisah per vertex, sangat hemat memori VRAM.
  vec3 dx = dFdx(vP);
  vec3 dy = dFdy(vP);
  vec3 n = normalize(cross(dx, dy));

  // Vektor arah pandang dari piksel menuju kamera pengamat (view vector)
  vec3 v = normalize(uCam - vP);
  if (dot(n, v) < 0.0) n = -n;

  // Bump Normal: Memberikan efek pahatan kasar pada permukaan balok batu tanpa menambah jumlah poligon.
  // Kalau pengali 0.22 diperbesar: Permukaan batu tampak terpahat lebih kasar dan bergelombang terjal.
  // Kalau diperkecil ke 0.0: Permukaan balok menjadi rata licin sempurna.
  vec3 bump = vec3(
    n3(vP + vec3(0.35, 0.0, 0.0), 1.2) - n3(vP - vec3(0.35, 0.0, 0.0), 1.2),
    n3(vP + vec3(0.0, 0.35, 0.0), 1.2) - n3(vP - vec3(0.0, 0.35, 0.0), 1.2),
    n3(vP + vec3(0.0, 0.0, 0.35), 1.2) - n3(vP - vec3(0.0, 0.0, 0.35), 1.2)
  );
  n = normalize(n + bump * 0.22);

  // Arah sinar bulan malam hari (Directional Moonlight Vector)
  // Kalau vektor (0.5, 0.9, 0.4) diubah: Sudut jatuh bayangan dan arah cahaya bulan akan berpindah.
  vec3 L = normalize(vec3(0.5, 0.9, 0.4));
  float d = max(dot(n, L), 0.0);

  // Pencahayaan Ambient Hemisfer:
  // Bagian atas menerima pantulan biru terang langit malam, bagian bawah menerima warna tanah gelap.
  float h = n.y * 0.5 + 0.5;
  vec3 amb = mix(vec3(0.38, 0.43, 0.54), vec3(0.78, 0.88, 1.0), h);
  vec3 l = amb * 0.8 + vec3(1.0, 0.95, 0.85) * d * 0.65;

  // Kabut atmosferik malam (Fog):
  // Dihitung berdasarkan jarak horizontal XZ piksel terhadap kamera (distCam).
  // Kalau rentang (1000.0, 4600.0) digeser:
  // - Nilai awal (1000.0) diperkecil: Kabut mulai muncul lebih dekat dengan kamera.
  // - Nilai akhir (4600.0) diperkecil: Pemandangan jarak jauh lebih cepat hilang tertutup kabut tebal.
  float distCam = length(vP.xz - uCam.xz);
  float fog = smoothstep(1000.0, 4600.0, distCam);
  vec3 fogCol = vec3(0.024, 0.038, 0.068);

  // Kalkulasi Albedo Tekstur Batu + Pantulan Sinar Bulan
  vec3 stone = stoneAlbedo(vP, n, uCol);
  vec3 H = normalize(L + v);

  // Blinn-Phong Specular (kilau pantulan sinar bulan pada batu):
  // Kalau pangkat 24.0 diperbesar: Kilau highlight bulan makin mengecil tajam (seperti marmer mengkilap).
  // Kalau intensitas 0.16 dinaikkan: Kilau pantulan bulan pada batu nisan makin terang benderang.
  float spec = pow(max(dot(n, H), 0.0), 24.0) * 0.16;

  // Rim Light (pendar cahaya dingin di tepi siluet batu kuburan):
  // Kalau pangkat 3.0 diganti: Lebar pendaran cahaya tepi batu akan melebar atau menyempit.
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0) * 0.12 * max(n.y + 0.3, 0.0);

  // Gabungkan pencahayaan batu, highlight, exposure, dan kabut malam
  vec3 gc = (pow(stone, vec3(0.45)) * l + vec3(0.75, 0.85, 1.0) * (spec + rim)) * vec3(0.86, 0.93, 1.06) * uEx;
  gc = mix(gc, fogCol * uEx, fog);

  // Tone Mapping ACES Filmic:
  // Menghasilkan kompresi kontras kurva S-curve ala film bioskop agar highlight tidak pecah/overexpose.
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
