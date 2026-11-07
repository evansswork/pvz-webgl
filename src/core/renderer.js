/* =========================================================================
   renderer.js — WebGL murni: shader toon, outline kartun, bayangan planar,
   scene graph (Hierarchical Transformation)

   Pakai: new Renderer(gl) → drawScene(groups, cam), digambar di atas
   environment (context WebGL2 yang sama). Tiap group = { roots, stage, scale }:
   `stage` menempatkan ruang karakter ke dunia (T · Ry · S), jadi kode karakter
   tetap bekerja di satuan aslinya (tanah = y 0).
   ========================================================================= */
import { V3, M4 } from './math.js';

export const TOON_VS = `
precision highp float; precision mediump int;
attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aOutlineN;
uniform mat4 uModel, uView, uProj, uShadow;
uniform mat3 uNormalMat;
uniform int uMode;            // 0 = lit, 1 = outline, 2 = shadow
uniform float uOutline;          // tebal outline (sudah dikali skala stage)
varying vec3 vN; varying vec3 vW;
void main(){
  vec4 w = uModel * vec4(aPos, 1.0);
  vec3 n = normalize(uNormalMat * aNormal);
  if (uMode == 1) { w.xyz += normalize(uNormalMat * aOutlineN) * uOutline; }
  if (uMode == 2) { w = uShadow * w; }
  vN = n; vW = w.xyz;
  gl_Position = uProj * uView * w;
}`;

export const TOON_FS = `
precision highp float; precision mediump int;
varying vec3 vN; varying vec3 vW;
uniform int uMode;
uniform vec3 uSunCol;
uniform vec3 uColor, uLightDir, uFillDir, uCamPos, uSkyCol, uGroundCol, uFogCol, uOutlineCol, uRimCol;
uniform float uSpec, uShin, uEmissive, uAlpha, uFogNear, uFogFar, uSoft;
uniform float uFogDen, uExposure, uFill, uShadowA;   // uFogDen > 0 → kabut eksponensial (scene malam)
uniform int uTone;                                    // 1 = tone mapping ACES (scene malam)
uniform int uPLn;                                     // jumlah lampu titik (maks. 4)
uniform vec3 uPLpos[4]; uniform vec3 uPLcol[4]; uniform float uPLrad[4];
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float fogF(float d) { return uFogDen > 0.0 ? clamp(1.0 - exp(-d * uFogDen), 0.0, 0.85) : smoothstep(uFogNear, uFogFar, d); }
vec3 finish(vec3 c, float fog) {
  c = mix(c, uFogCol, fog);
  if (uTone == 1) {
    // Reinhard pada luminans (white point 1.6): highlight lembut tanpa menggeser hue,
    // jadi hijau Peashooter & kuning Sunflower tetap seperti aslinya di malam hari
    c *= uExposure;
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c *= (1.0 + l / 2.56) / (1.0 + l);
    l = dot(c, vec3(0.299, 0.587, 0.114));
    c = clamp(mix(vec3(l), c, 1.12), 0.0, 1.0);
  }
  return c;
}
void main(){
  float fog = fogF(length(vW - uCamPos));
  if (uMode == 1) { gl_FragColor = vec4(finish(uOutlineCol, fog), 1.0); return; }
  if (uMode == 2) { gl_FragColor = vec4(0.02, 0.05, 0.02, uAlpha * (1.0 - fog)); return; }
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 L = normalize(uLightDir), V = normalize(uCamPos - vW), H = normalize(L + V);
  float ndl = dot(N, L);
  float diff = smoothstep(-0.30, 0.45, ndl);            // terminator lembut
  float band = smoothstep(0.55, 0.65, ndl) * 0.10;      // satu step kartun
  vec3 hemi = mix(uGroundCol, uSkyCol, N.y * 0.5 + 0.5);
  float fill = smoothstep(-0.1, 0.8, dot(N, normalize(uFillDir))) * uFill;   // lampu isi
  vec3 col = uColor * (hemi * 0.48 + (diff * 0.64 + band) * uSunCol + fill);
  // lampu titik hangat (teras & jendela rumah) — diberi step kartun juga
  for (int i = 0; i < 4; i++) {
    if (i >= uPLn) break;
    vec3 d = uPLpos[i] - vW; float r = length(d); vec3 l = d / r;
    float att = 1.0 / (1.0 + (r * r) / (uPLrad[i] * uPLrad[i]));
    float k = smoothstep(-0.15, 0.5, dot(N, l));
    col += uColor * uPLcol[i] * att * k;
    float sp = pow(max(dot(N, normalize(l + V)), 0.0), uShin);
    col += uPLcol[i] * att * smoothstep(0.30, 0.65, sp) * uSpec * 0.6;
  }
  float sp = pow(max(dot(N, H), 0.0), uShin);
  sp = smoothstep(0.30, 0.65, sp) * uSpec;              // highlight mengkilap ala referensi
  float rimF = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  col += sp * uSunCol * vec3(1.0, 0.97, 0.90) + rimF * 0.20 * hemi * uColor + rimF * uRimCol * smoothstep(-0.2, 0.6, ndl + 0.3) + uColor * uEmissive;
  float a = uAlpha;
  if (uSoft > 0.5) a *= pow(max(dot(N, V), 0.0), 2.2);   // glow memudar di tepi
  gl_FragColor = vec4(finish(col, fog), a);
}`;

/**
 * Mengompilasi dan me-link vertex shader serta fragment shader menjadi program WebGL,
 * sekaligus mengumpulkan lokasi attribute dan uniform yang aktif.
 *
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - Konteks WebGL aktif yang digunakan untuk alokasi resource GPU.
 *        Utk mengganti: target context WebGL tempat shader program akan dicompile dan di-link.
 * @param {string} vs - Kode sumber GLSL untuk vertex shader.
 *        Utk mengganti: logika kalkulasi posisi vertex, transformasi matrix, dan penjalaran atribut ke fragment shader.
 * @param {string} fs - Kode sumber GLSL untuk fragment shader.
 *        Utk mengganti: logika pewarnaan fragmen/piksel (pencahayaan toon, bayangan, fog, rim lighting).
 * @returns {{ p: WebGLProgram, u: Record<string, WebGLUniformLocation>, a: Record<string, number> }}
 *          Objek berisi program GPU yang siap pakai (`p`), map lokasi uniform (`u`), dan map lokasi attribute (`a`).
 */
export function compile(gl, vs, fs) {
  const mk = (type, src) => {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  const p = gl.createProgram();
  gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  const a = {}, na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < na; i++) { const info = gl.getActiveAttrib(p, i); a[info.name] = gl.getAttribLocation(p, info.name); }
  return { p, u, a };
}

/* ------------------------------- Mesh (GPU) ------------------------------- */
export class Mesh {
  /**
   * Mengunggah data geometri CPU (posisi, normal, indeks) ke VBO/IBO di memori GPU,
   * serta menghitung normal rata-rata untuk outline tanpa retakan.
   *
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - Konteks WebGL aktif tempat buffer GPU dibuat.
   *        Utk mengganti: target canvas / konteks rendering WebGL.
   * @param {{ pos: number[], nor: number[], idx: number[] }} geo - Objek deskripsi geometri mentah.
   *        - `geo.pos`: array koordinat vertex [x, y, z, ...]. Utk mengganti bentuk/posisi titik 3D mesh.
   *        - `geo.nor`: array vektor normal per vertex [nx, ny, nz, ...]. Utk mengganti arah pantulan cahaya/shading.
   *        - `geo.idx`: array indeks segitiga faces. Utk mengganti urutan/konektivitas segitiga pembentuk permukaan.
   */
  constructor(gl, geo) {
    this.gl = gl;
    // Normal "outline": rata-rata normal untuk vertex di posisi sama → outline tanpa retak di sambungan
    const P = geo.pos, N = geo.nor, map = new Map(), on = new Float32Array(N.length);
    const key = (i) => `${Math.round(P[i] * 1e4)},${Math.round(P[i + 1] * 1e4)},${Math.round(P[i + 2] * 1e4)}`;
    for (let i = 0; i < P.length; i += 3) {
      const k = key(i), s = map.get(k) || [0, 0, 0];
      s[0] += N[i]; s[1] += N[i + 1]; s[2] += N[i + 2]; map.set(k, s);
    }
    for (let i = 0; i < P.length; i += 3) {
      const s = map.get(key(i)), l = Math.hypot(s[0], s[1], s[2]);
      if (l > 1e-3) { on[i] = s[0] / l; on[i + 1] = s[1] / l; on[i + 2] = s[2] / l; }
      else { on[i] = N[i]; on[i + 1] = N[i + 1]; on[i + 2] = N[i + 2]; }
    }
    this.vbo = this._buf(gl.ARRAY_BUFFER, new Float32Array(P));
    this.nbo = this._buf(gl.ARRAY_BUFFER, new Float32Array(N));
    this.obo = this._buf(gl.ARRAY_BUFFER, on);
    const big = P.length / 3 > 65535;
    this.ibo = this._buf(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(geo.idx) : new Uint16Array(geo.idx));
    this.type = big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    this.count = geo.idx.length;
  }

  /**
   * Helper internal untuk membuat WebGLBuffer, mengikat (bind), dan mengisi data statis ke GPU.
   *
   * @param {number} t - Tipe target buffer (misal: `gl.ARRAY_BUFFER` atau `gl.ELEMENT_ARRAY_BUFFER`).
   *        Utk mengganti: jenis data GPU (apakah data atribut vertex atau data indeks elemen segitiga).
   * @param {BufferSource} d - TypedArray berisi data biner yang dikirim ke GPU.
   *        Utk mengganti: isi array koordinat posisi, normal, atau indeks yang dialokasikan di VRAM.
   * @returns {WebGLBuffer} Objek buffer WebGL yang sudah terisi data.
   */
  _buf(t, d) { const b = this.gl.createBuffer(); this.gl.bindBuffer(t, b); this.gl.bufferData(t, d, this.gl.STATIC_DRAW); return b; }
}

/* ------------------- Node: scene graph untuk transformasi hierarki ------------------
   local  = pre · T(position) · Ry · Rx · Rz · S(scale)
   world  = parent.world · local     ← anak otomatis ikut bergerak bersama induknya
   `pre`  dipakai untuk rotasi sumbu sembarang (arbitrary axis) di ruang induk.        */
export class Node {
  /**
   * Membuat simpul baru dalam pohon scene graph transformasi hierarki.
   *
   * @param {string} name - Nama penanda atau identitas node (misal: "head", "stem", "arm").
   *        Utk mengganti: label identifikasi node saat debugging atau pencarian node dalam hierarki.
   * @param {Mesh|null} [mesh=null] - Geometri mesh GPU yang digambar pada node ini (bisa null jika hanya bertindak sebagai pivot/group).
   *        Utk mengganti: bentuk 3D yang ditampilkan oleh node ini.
   * @param {object|null} [mat=null] - Properti material visual mesh (warna, specular, shininess, outline, alpha, dll).
   *        Utk mengganti: tampilan warna dan karakteristik shader permukaan dari node ini.
   */
  constructor(name, mesh = null, mat = null) {
    this.name = name; this.mesh = mesh; this.mat = mat;
    this.children = []; this.parent = null;
    this.position = [0, 0, 0]; this.rotation = [0, 0, 0]; this.scale = [1, 1, 1];
    this.pre = null; this.meshMatrix = null; this.visible = true;
    this.local = M4.identity(); this.world = M4.identity();
  }

  /**
   * Menambahkan satu atau beberapa child node ke dalam node ini dan menetapkan parent-nya.
   *
   * @param {...Node} cs - Daftar child node yang akan dijadikan anak dari node ini.
   *        Utk mengganti: susunan hierarki rantai pohon (child otomatis mengikuti transformasi induk).
   * @returns {Node} Mengembalikan instance node ini (chainable).
   */
  add(...cs) { for (const c of cs) { c.parent = this; this.children.push(c); } return this; }

  /**
   * Menghapus child node tertentu dari daftar anak node ini.
   *
   * @param {Node} c - Referensi instance child node yang ingin dilepaskan dari hierarki parent.
   *        Utk mengganti: node anak mana yang dicopot dari pohon relasi transformasi.
   */
  remove(c) { this.children = this.children.filter((x) => x !== c); c.parent = null; }

  /**
   * Menyimpan pose default awal (posisi, rotasi, skala, pre-matrix) dari node ini beserta seluruh anaknya
   * ke dalam properti internal `base` untuk keperluan reset pose nanti.
   */
  saveBase() { this.base = { p: [...this.position], r: [...this.rotation], s: [...this.scale], pre: this.pre }; this.children.forEach((c) => c.saveBase()); }

  /**
   * Mengembalikan transformasi node dan seluruh child-nya ke kondisi awal yang disimpan via `saveBase()`.
   */
  resetPose() {
    if (this.base) { this.position = [...this.base.p]; this.rotation = [...this.base.r]; this.scale = [...this.base.s]; }
    this.pre = this.base ? this.base.pre : null; this.children.forEach((c) => c.resetPose());
  }

  /**
   * Menghitung matriks transformasi lokal (`this.local`) berdasarkan nilai `position`, `rotation`, `scale`,
   * dan optional matriks `pre` (untuk rotasi arbitrary axis).
   */
  updateLocal() {
    const [rx, ry, rz] = this.rotation;
    let m = M4.chain(M4.translation(...this.position), M4.rotationY(ry), M4.rotationX(rx), M4.rotationZ(rz), M4.scaling(...this.scale));
    if (this.pre) m = M4.multiply(this.pre, m);
    this.local = m;
  }

  /**
   * Menghitung matriks transformasi koordinat dunia (`this.world`) secara rekursif ke seluruh rantai keturunan.
   *
   * @param {Float32Array|number[]|null} [parentWorld=null] - Matriks world milik node induk (4x4).
   *        Utk mengganti: basis koordinat acuan induk; jika null, matriks lokal dianggap sebagai koordinat akar dunia.
   */
  updateWorld(parentWorld = null) {
    this.updateLocal();
    this.world = parentWorld ? M4.multiply(parentWorld, this.local) : this.local;
    for (const c of this.children) c.updateWorld(this.world);
  }

  /**
   * Melakukan traversal (pre-order depth-first) ke node ini dan seluruh keturunannya selama berstatus visible.
   *
   * @param {(node: Node) => void} fn - Callback fungsi yang dijalankan untuk setiap node yang dikunjungi.
   *        Utk mengganti: aksi/operasi yang ingin dieksekusi pada tiap node (misal: pengumpulan mesh untuk di-render).
   */
  traverse(fn) { if (!this.visible) return; fn(this); for (const c of this.children) c.traverse(fn); }

  /**
   * Mengambil posisi translasi absolut node di koordinat ruang dunia (world space).
   *
   * @returns {[number, number, number]} Koordinat [x, y, z] node dalam world space.
   */
  worldPos() { return [this.world[12], this.world[13], this.world[14]]; }
}

/**
 * Membuat objek konfigurasi material untuk shader toon dengan nilai default yang dapat di-override.
 *
 * @param {[number, number, number]} color - Warna dasar RGB objek dalam rentang [0, 1].
 *        Utk mengganti: rona/warna diffuse utama pada permukaan model 3D (misal: hijau Peashooter, kuning Sunflower).
 * @param {object} [o={}] - Objek penimpa opsi properti material.
 *        - `o.spec`: intensitas kilauan highlight specular (default: 0.35). Utk mengganti tingkat kekilapan benda.
 *        - `o.shin`: kehalusan/ketajaman highlight specular (default: 40). Utk mengganti fokus titik kilau.
 *        - `o.emissive`: faktor cahaya yang dipancarkan sendiri (default: 0). Utk mengganti efek bercahaya mandiri.
 *        - `o.alpha`: tingkat transparansi/opacity (default: 1). Utk mengganti kepekatan objek tembus pandang.
 *        - `o.outline`: boolean aktifkan garis luar kartun (default: true). Utk mengganti ada/tidaknya outline.
 *        - `o.outlineW`: ketebalan garis outline (default: 0.016). Utk mengganti tebal-tipisnya garis batas kartun.
 *        - `o.shadow`: boolean apakah objek memproyeksikan bayangan planar (default: true). Utk mengganti ada/tidaknya bayangan lantai.
 *        - `o.additive`: boolean gunakan mode blending additive (default: false). Utk mengganti mode efek cahaya glow.
 *        - `o.xray`: boolean render selalu tembus tanpa depth test (default: false). Utk mengganti visibilitas indikator pivot.
 *        - `o.soft`: boolean efek transparansi memudar di tepi sudut pandang (default: false).
 * @returns {object} Objek gabungan parameter material lengkap siap pakai oleh renderer.
 */
export function material(color, o = {}) {
  return Object.assign({ color, spec: 0.35, shin: 40, emissive: 0, alpha: 1, outline: true, outlineW: 0.016, shadow: true, additive: false }, o);
}

/* ------------------------------- Renderer -------------------------------- */
export class Renderer {
  /**
   * Menginisialisasi renderer toon WebGL, mengompilasi program shader, dan menyiapkan default environment.
   *
   * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - Konteks WebGL kanvas aktif yang dipakai untuk proses rendering bersama environment.
   *        Utk mengganti: target konteks grafik WebGL yang menampung draw call karakter 3D.
   */
  constructor(gl) {
    this.gl = gl;
    this.toon = compile(gl, TOON_VS, TOON_FS);
    // nilai default; scene utama menimpanya lewat toonNightEnv() (lighting.js)
    this.env = {
      lightDir: V3.norm([0.55, 1.0, 0.75]),
      skyCol: [1.0, 0.98, 0.94], groundCol: [0.55, 0.62, 0.42], fogNear: 18, fogFar: 46,
      outline: [0.07, 0.05, 0.04],
      fillDir: [-0.7, 0.35, -0.8], fill: 0.22, rimCol: [0, 0, 0],
      fogDen: 0, fogCol: [0.86, 0.94, 0.98], tone: 0, exposure: 1, groundY: 0, shadowA: 0.32,
      lamps: [],                                   // [{ pos, col, rad }] maks. 4
    };
  }

  /**
   * Menghitung matriks proyeksi bayangan planar (planar shadow matrix) yang meratakan geometri ke bidang lantai horizontal.
   *
   * @param {number} [g=this.env.groundY] - Ketinggian bidang tanah pada sumbu Y tempat bayangan jatuh.
   *        Utk mengganti: level elevasi permukaan lantai/rumput agar bayangan tidak melayang atau tenggelam.
   * @param {number} [eps=0.004] - Offset ketinggian epsilon kecil di atas bidang tanah.
   *        Utk mengganti: batas toleransi z-fighting antara bayangan hitam tipis dan permukaan tanah asli.
   * @returns {Float32Array} Matriks transformasi 4x4 untuk proyeksi bayangan miring.
   */
  shadowMatrix(g = this.env.groundY, eps = 0.004) {
    const L = this.env.lightDir, m = M4.identity();
    m[4] = -L[0] / L[1]; m[5] = 0; m[6] = -L[2] / L[1];
    m[12] = (L[0] / L[1]) * g; m[13] = g + eps; m[14] = (L[2] / L[1]) * g;
    return m;
  }

  /**
   * Mengikat (bind) VBO atribut posisi, normal, outline normal, dan IBO indeks segitiga dari sebuah mesh ke pipeline WebGL.
   *
   * @param {Mesh} mesh - Objek mesh GPU yang VBO/IBO-nya akan dihubungkan ke shader attributes (`aPos`, `aNormal`, `aOutlineN`).
   *        Utk mengganti: buffer geometri vertex yang sedang aktif dibaca oleh kartu grafis saat draw call.
   */
  _bindMesh(mesh) {
    const gl = this.gl, a = this.toon.a;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo); gl.enableVertexAttribArray(a.aPos); gl.vertexAttribPointer(a.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.nbo); gl.enableVertexAttribArray(a.aNormal); gl.vertexAttribPointer(a.aNormal, 3, gl.FLOAT, false, 0, 0);
    if (a.aOutlineN !== undefined) { gl.bindBuffer(gl.ARRAY_BUFFER, mesh.obo); gl.enableVertexAttribArray(a.aOutlineN); gl.vertexAttribPointer(a.aOutlineN, 3, gl.FLOAT, false, 0, 0); }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
  }

  /**
   * Mengatur nilai uniform model, material, dan mode render ke shader toon, lalu memanggil `gl.drawElements`.
   *
   * @param {{ mesh: Mesh, mat: object, model: Float32Array, scale: number }} item - Data objek individual yang akan dirender.
   *        - `item.mesh`: referensi GPU buffer geometri. Utk mengganti bentuk 3D yang digambar.
   *        - `item.mat`: properti material (warna, kilau, alpha, tebal outline). Utk mengganti atribut shader warna/tampilan.
   *        - `item.model`: matriks model dunia akhir (stage · world · meshMatrix). Utk mengganti letak, rotasi, dan skala objek di dunia.
   *        - `item.scale`: faktor skala stage karakter. Utk mengganti penskalaan proporsional ketebalan garis outline.
   * @param {number} mode - Mode pass shader toon:
   *        - `0`: Render warna objek berbayang toon reguler (lit pass).
   *        - `1`: Render siluet tebal outline kartun (inverted hull pass).
   *        - `2`: Render siluet bayangan planar ke tanah (shadow pass).
   *        Utk mengganti: tahap pipeline rendering visual mana yang sedang dieksekusi pada item tersebut.
   */
  _draw(item, mode) {
    const gl = this.gl, u = this.toon.u, m = item.mat;
    gl.uniformMatrix4fv(u.uModel, false, item.model);
    gl.uniformMatrix3fv(u.uNormalMat, false, M4.normalMatrix(item.model));
    gl.uniform1i(u.uMode, mode);
    gl.uniform3fv(u.uColor, m.color);
    gl.uniform1f(u.uSpec, m.spec); gl.uniform1f(u.uShin, m.shin);
    gl.uniform1f(u.uEmissive, m.emissive); gl.uniform1f(u.uAlpha, mode === 2 ? this.env.shadowA : m.alpha);
    gl.uniform1f(u.uOutline, m.outlineW * item.scale); gl.uniform1f(u.uSoft, m.soft ? 1 : 0);
    this._bindMesh(item.mesh);
    gl.drawElements(gl.TRIANGLES, item.mesh.count, item.mesh.type, 0);
  }

  /**
   * Menggambar seluruh scene graph karakter ke kanvas WebGL dalam beberapa pass render (bayangan, objek, outline, transparan, xray).
   *
   * @param {Array<{ roots: Node[], stage?: Float32Array, scale?: number }>} groups - Daftar grup karakter/objek scene graph.
   *        - `roots`: array root Node dari karakter (hierarki model). Utk mengganti struktur tulang/pohon mesh yang digambar.
   *        - `stage`: matriks 4x4 penempatan ruang karakter ke dunia (posisi baris/grid, rotasi hadap, skala stage). Utk mengganti letak penempatan karakter di scene.
   *        - `scale`: faktor pengali skala ukuran karakter (default 1). Utk mengganti rasio ketebalan garis outline agar serasi dengan ukuran karakter.
   * @param {{ view: Float32Array, proj: Float32Array, eye: [number, number, number] }} cam - Objek konfigurasi kamera aktif.
   *        - `cam.view`: matriks View (posisi & orientasi kamera). Utk mengganti sudut pandang penglihatan penonton/kamera.
   *        - `cam.proj`: matriks Proyeksi (perspektif/ortografis). Utk mengganti aspek rasio canvas, FOV (field of view), near/far clipping plane.
   *        - `cam.eye`: koordinat posisi mata/kamera [x, y, z]. Utk mengganti kalkulasi vektor pandang V pada pencahayaan spekular, rim light, dan kabut (fog).
   */
  drawScene(groups, cam) {
    const gl = this.gl, E = this.env;

    // ---- kumpulkan objek dari scene graph (model = stage · world · meshMatrix)
    const items = [];
    for (const g of groups) {
      const st = g.stage || null, sc = g.scale || 1;
      for (const r of g.roots) r.traverse((n) => {
        if (!n.mesh) return;
        let model = n.meshMatrix ? M4.multiply(n.world, n.meshMatrix) : n.world;
        if (st) model = M4.multiply(st, model);
        items.push({ mesh: n.mesh, mat: n.mat, model, scale: sc });
      });
    }

    gl.useProgram(this.toon.p);
    const u = this.toon.u;
    gl.uniformMatrix4fv(u.uView, false, cam.view);
    gl.uniformMatrix4fv(u.uProj, false, cam.proj);
    gl.uniformMatrix4fv(u.uShadow, false, this.shadowMatrix());
    gl.uniform3fv(u.uLightDir, E.lightDir); gl.uniform3fv(u.uSunCol, E.sunCol || [1, 1, 1]);
    gl.uniform3fv(u.uFillDir, E.fillDir); gl.uniform1f(u.uFill, E.fill); gl.uniform3fv(u.uCamPos, cam.eye);
    gl.uniform3fv(u.uSkyCol, E.skyCol); gl.uniform3fv(u.uGroundCol, E.groundCol); gl.uniform3fv(u.uRimCol, E.rimCol);
    gl.uniform3fv(u.uFogCol, E.fogCol);
    gl.uniform1f(u.uFogNear, E.fogNear); gl.uniform1f(u.uFogFar, E.fogFar);
    gl.uniform1f(u.uFogDen, E.fogDen); gl.uniform1i(u.uTone, E.tone); gl.uniform1f(u.uExposure, E.exposure);
    gl.uniform3fv(u.uOutlineCol, E.outline);
    const lamps = E.lamps.slice(0, 4);
    gl.uniform1i(u.uPLn, lamps.length);
    if (lamps.length) {
      const pad = (k, n) => { const out = []; for (let i = 0; i < 4; i++) out.push(...(lamps[i] ? [].concat(lamps[i][k]) : Array(n).fill(0))); return new Float32Array(out); };
      gl.uniform3fv(u['uPLpos[0]'], pad('pos', 3)); gl.uniform3fv(u['uPLcol[0]'], pad('col', 3)); gl.uniform1fv(u['uPLrad[0]'], pad('rad', 1));
    }
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
    gl.enable(gl.CULL_FACE);

    const xray = items.filter((i) => i.mat.xray);
    const opaque = items.filter((i) => i.mat.alpha >= 1 && !i.mat.xray);
    const transp = items.filter((i) => i.mat.alpha < 1);

    // 1) bayangan planar (stencil → tiap piksel digelapkan sekali saja)
    gl.enable(gl.STENCIL_TEST); gl.stencilFunc(gl.EQUAL, 0, 0xff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -2);
    for (const it of opaque) if (it.mat.shadow) this._draw(it, 2);
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.disable(gl.STENCIL_TEST); gl.disable(gl.BLEND);
    gl.depthMask(true); gl.enable(gl.CULL_FACE);

    // 2) objek berwarna
    gl.cullFace(gl.BACK);
    for (const it of opaque) this._draw(it, 0);

    // 3) outline kartun (inverted hull: muka depan dibuang, hull diperbesar sepanjang normal)
    gl.cullFace(gl.FRONT);
    for (const it of opaque) if (it.mat.outline) this._draw(it, 1);
    gl.cullFace(gl.BACK);

    // 4) objek transparan (glow matahari)
    gl.enable(gl.BLEND); gl.depthMask(false);
    for (const it of transp) {
      gl.blendFunc(gl.SRC_ALPHA, it.mat.additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
      this._draw(it, 0);
    }
    gl.depthMask(true); gl.disable(gl.BLEND);

    // 5) penanda sumbu rotasi (selalu terlihat, menembus kepala)
    gl.disable(gl.DEPTH_TEST);
    for (const it of xray) this._draw(it, 0);
    gl.enable(gl.DEPTH_TEST);

    // kembalikan state supaya renderer environment tidak terpengaruh
    gl.disable(gl.CULL_FACE);
    const a = this.toon.a;
    for (const k in a) gl.disableVertexAttribArray(a[k]);
  }
}
