/**
 * ==============================================================================
 * GRASS SCENE — HAMPARAN RUMPUT LUAR & DALAM PROSEDURAL (WebGL2, FBM Noise)
 * ==============================================================================
 * Modul independen untuk merender hamparan rumput malam:
 * 1. RUMPUT LUAR (Flat Grass Landscape):
 *    - Bidang persegi datar luas (-4800 s/d 4800) pada ketinggian Y = 10.0
 *      yang membentang hingga ke cakrawala malam.
 * 2. RUMPUT DALAM KUBURAN (Terrain Plane):
 *    - Bidang persegi datar utama area pemakaman pada ketinggian Y = 10.5348.
 * 3. SHADER RUMPUT PROSEDURAL (Procedural FBM Grass Shader):
 *    - Menghasilkan serat dan rumpun rumput alami secara matematis menggunakan
 *      Fractal Brownian Motion (FBM) 4-oktaf dan Value Noise 2D tanpa tekstur gambar luar.
 * ==============================================================================
 */

const vs = `#version 300 es
layout(location=0) in vec3 aP;
uniform mat4 uVP;
out vec3 vP;
void main() {
  vP = aP;
  gl_Position = uVP * vec4(vP, 1.0);
}`;

const fs = `#version 300 es
precision highp float;
in vec3 vP;
uniform vec3 uCam;
uniform float uEx, uA;
out vec4 fC;

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

// --- Material Rumput Malam (Dalam & Luar Kuburan) ---
vec3 grassAlbedo(vec3 p, vec3 n) {
  float broad = fbm(p.xz * 0.0035);
  float clump = fbm(p.xz * 0.025 + 7.0);
  float fine = vnoise(p.xz * 0.4);

  vec3 grassDark = vec3(0.010, 0.025, 0.008);
  vec3 grassLight = vec3(0.022, 0.042, 0.015);
  vec3 meadow = vec3(0.016, 0.032, 0.012);

  vec3 col = mix(grassDark, grassLight, clump);
  col = mix(col, meadow, broad * 0.5);
  col *= 0.85 + 0.3 * fine;

  return col * (0.75 + 0.25 * n.y);
}

void main() {
  // Hitung normal permukaan otomatis dari turunan ruang layar
  vec3 dx = dFdx(vP);
  vec3 dy = dFdy(vP);
  vec3 n = normalize(cross(dx, dy));

  vec3 v = normalize(uCam - vP);
  if (dot(n, v) < 0.0) n = -n;

  // Pencahayaan malam: Ambient langit-tanah + Diffuse sinar bulan
  vec3 L = normalize(vec3(0.5, 0.9, 0.4));
  float d = max(dot(n, L), 0.0);

  float h = n.y * 0.5 + 0.5;
  vec3 amb = mix(vec3(0.38, 0.43, 0.54), vec3(0.78, 0.88, 1.0), h);
  vec3 l = amb * 0.8 + vec3(1.0, 0.95, 0.85) * d * 0.65;

  // Kabut malam berdasarkan jarak horizontal dari kamera
  float distCam = length(vP.xz - uCam.xz);
  float fog = smoothstep(1000.0, 4600.0, distCam);
  vec3 fogCol = vec3(0.024, 0.038, 0.068);

  vec3 grass = grassAlbedo(vP, n);
  vec3 litGrass = pow(grass, vec3(0.45)) * l * uEx;
  fC = vec4(mix(litGrass, fogCol * uEx, fog), uA);
}`;

/**
 * Membuat Vertex Array Object (VAO) untuk sebuah bidang datar persegi (quad) 2 segitiga
 * pada bentangan koordinat X dan Z tertentu pada ketinggian Y konstan.
 *
 * @param {WebGL2RenderingContext} gl - Konteks WebGL2 aktif (mengganti target alokasi buffer dan VAO).
 * @param {number} x0 - Batas minimum koordinat X (mengubah tepi kiri bentangan bidang rumput).
 * @param {number} x1 - Batas maksimum koordinat X (mengubah tepi kanan bentangan bidang rumput).
 * @param {number} z0 - Batas minimum koordinat Z (mengubah tepi depan/selatan bentangan bidang rumput).
 * @param {number} z1 - Batas maksimum koordinat Z (mengubah tepi belakang/utara bentangan bidang rumput).
 * @param {number} y - Elevasi/ketinggian konstan bidang pada sumbu Y (mengubah tinggi letak bidang rumput di world space).
 * @returns {WebGLVertexArrayObject} Objek VAO yang membungkus buffer posisi vertex dan indeks segitiga quad.
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
 * Menginisialisasi scene hamparan rumput luar dan dalam (Grass Scene) beserta shader FBM prosedural.
 *
 * @param {WebGL2RenderingContext} gl - Konteks rendering WebGL2 aktif.
 *        Mengubah parameter ini mengalihkan pembuatan VAO/VBO rumput dan kompilasi shader ke konteks WebGL target.
 * @returns {{ render: Function, renderLandscape: Function, drawTerrain: Function, getTerrainHeight: Function }}
 *          Objek pengontrol scene rumput.
 */
export function createGrassScene(gl) {
  /**
   * Mengompilasi shader GLSL (Vertex / Fragment) untuk program rumput.
   * @param {number} type - Tipe shader WebGL (`gl.VERTEX_SHADER` atau `gl.FRAGMENT_SHADER`).
   *        Mengubah parameter ini menentukan tahapan pipeline shader yang dikompilasi.
   * @param {string} source - Kode sumber GLSL shader.
   *        Mengubah kode sumber ini memodifikasi pola FBM rumput (`grassAlbedo`) atau pencahayaan malam.
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
  const uCam = gl.getUniformLocation(pg, "uCam");
  const uEx = gl.getUniformLocation(pg, "uEx");
  const uA = gl.getUniformLocation(pg, "uA");

  // 1. Bidang rumput luar datar (-4800..4800, Y = 10.0)
  const R = 4800;
  const landVao = makeFlatQuadVao(gl, -R, R, -R, R, 10.0);

  // 2. Bidang rumput dalam kuburan datar (Y = 10.5348)
  const gx = 0;
  const baseY = 10.5348;
  const gz = -134.4178;
  const halfX = 537.8171;
  const halfZ = 660.3497;
  const terrainVao = makeFlatQuadVao(gl, gx - halfX, gx + halfX, gz - halfZ, gz + halfZ, baseY);

  /**
   * Mengembalikan elevasi ketinggian permukaan rumput dasar area dalam.
   * @param {number} [x] - Koordinat posisi horizontal X (opsional).
   * @param {number} [z] - Koordinat posisi kedalaman Z (opsional).
   * @returns {number} Ketinggian elevasi bidang rumput (Y = 10.535).
   */
  function getTerrainHeight(x, z) {
    return 10.535;
  }

  /**
   * Merender bidang tanah rumput luar perimeter kuburan berukuran sangat luas (flat grass landscape).
   * @returns {void}
   */
  function renderLandscape() {
    gl.bindVertexArray(landVao);
    gl.uniform1f(uA, 1.0);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  /**
   * Merender bidang tanah rumput utama di dalam batas kuburan (terrain plane).
   * @param {number} [alpha=1.0] - Nilai transparansi/opacity tanah dari 0.0 (transparan) hingga 1.0 (solid).
   *        Mengubah parameter ini mengatur tingkat kepekatan rendering hamparan rumput dalam.
   * @returns {void}
   */
  function drawTerrain(alpha = 1.0) {
    gl.bindVertexArray(terrainVao);
    gl.uniform1f(uA, alpha);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
  }

  /**
   * Merender keseluruhan hamparan rumput luar (landscape) dan rumput dalam (terrain) per frame.
   *
   * @param {Float32Array|number[]} VP - Matriks gabungan Proyeksi-Pandang (View-Projection Matrix $P \times V$).
   *        Mengubah VP akan menyesuaikan proyeksi bidang rumput terhadap sudut pandang kamera.
   * @param {number[]|[number, number, number]} eye - Koordinat posisi kamera pengamat di dunia 3D `[x, y, z]`.
   *        Digunakan oleh shader untuk menghitung arah normal permukaan dan jarak kabut malam.
   * @param {Object} [options={}] - Konfigurasi render tambahan:
   * @param {number} [options.exposure=1.4] - Faktor eksposur pencahayaan malam pada rumput.
   *        Mengubah nilai exposure akan menerangkan atau menggelapkan tampilan rumput malam.
   * @returns {void}
   */
  function render(VP, eye, options = {}) {
    const { exposure = 1.4 } = options;

    gl.useProgram(pg);
    gl.uniformMatrix4fv(uVP, false, VP);
    gl.uniform3fv(uCam, eye);
    gl.uniform1f(uEx, exposure);
    gl.disable(gl.BLEND);

    renderLandscape();
    drawTerrain(1.0);
  }

  return { render, renderLandscape, drawTerrain, getTerrainHeight };
}
