/**
 * ==============================================================================
 * HIGHWAY / JALAN RAYA BESAR SCENE (WEBGL2)
 * ==============================================================================
 * Modul 3D Jalan Raya Besar yang berada di sisi depan pintu pagar utama Kuburan (Graveyard)
 * di sisi Utara (+Z) dan memisahkannya dengan Area Rumah & Pekarangan (House) di sisi Selatan (-Z).
 *
 * Fitur Jalan Raya:
 * 1. Badan jalan aspal 4 lajur lebar (X: -2600 s/d +2600, Z: -976 s/d -812, pusat: -894)
 * 2. Trotoar beton pejalan kaki dan pembatas curb di kedua sisi (Utara & Selatan)
 * 3. Marka jalan lengkap:
 *    - Garis ganda kuning solid di tengah jalan (Z = -894)
 *    - Garis putus-putus putih pemisah lajur (Z = -935 & -853)
 *    - Garis bahu jalan putih solid
 *    - Zebra Cross (penyeberangan jalan raya) tepat sejajar dengan pintu gerbang utama kuburan (X: 53 s/d 197)
 *      menghubungkan gerbang kuburan langsung dengan halaman depan rumah di seberang
 * 4. Deretan tiang lampu jalan raya (Street Lamps) di sepanjang trotoar dengan
 *    tudung lampu bersinar hangat nokturnal
 * ==============================================================================
 */

import { NIGHT_GLSL } from "../../lighting.js";

export function createHighwayScene(gl) {
  const P = [];
  const N = [];
  const C = [];
  const TI = [];
  const WI = [];
  let vc = 0;

  const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];

  function addFaces(color, faces) {
    const col = hex(color);
    faces.forEach((f) => {
      let n = cross(sub(f[1], f[0]), sub(f[2], f[0]));
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      n = n.map((x) => x / l);

      const b = vc;
      f.forEach((v) => {
        P.push(v[0], v[1], v[2]);
        N.push(n[0], n[1], n[2]);
        C.push(col[0], col[1], col[2]);
        vc++;
      });

      for (let i = 1; i < f.length - 1; i++) {
        TI.push(b, b + i, b + i + 1);
        WI.push(b, b + i, b + i, b + i + 1, b + i + 1, b);
      }
    });
  }

  function box(col, x0, y0, z0, x1, y1, z1) {
    const v = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ];
    const F = [
      [0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7],
      [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0],
    ];
    addFaces(col, F.map((f) => f.map((i) => v[i])));
  }

  function cyl(col, cx, y0, cz, r, h, s = 12) {
    const top = [], bot = [], F = [];
    for (let i = 0; i < s; i++) {
      const a = (i / s) * Math.PI * 2, x = cx + r * Math.cos(a), z = cz + r * Math.sin(a);
      top.push([x, y0 + h, z]);
      bot.push([x, y0, z]);
    }
    for (let i = 0; i < s; i++) {
      const j = (i + 1) % s;
      F.push([bot[i], bot[j], top[j], top[i]]);
    }
    F.push(top, bot);
    addFaces(col, F);
  }

  // ---------------------------------------------------------------------------
  // 1. BADAN JALAN ASPAL (Pindah ke sisi depan kuburan / gerbang utama Z ≈ -765)
  // ---------------------------------------------------------------------------
  const X_MIN = -2600.0;
  const X_MAX = 2600.0;
  const ROAD_Z0 = -976.0; // Sisi Selatan (Menghadap Pekarangan Rumah)
  const ROAD_Z1 = -812.0; // Sisi Utara (Menghadap Pintu Masuk Kuburan)
  const BASE_Y = 9.50;    // Dasar fondasi jalan raya (menancap kokoh di bawah tanah 10.20)
  const ROAD_Y = 11.50;   // Permukaan aspal jalan raya (tinggi di atas tanah 10.20)
  const CURB_Y = 12.10;   // Trotoar & curb beton pejalan kaki (+0.60 di atas aspal)

  // Lapisan aspal hitam kokoh berpijak di atas tanah
  box("#1e2024", X_MIN, BASE_Y, ROAD_Z0, X_MAX, ROAD_Y, ROAD_Z1);

  // ---------------------------------------------------------------------------
  // 2. TROTOAR BETON & CURB PEMBATAS (KEDUA SISI)
  // ---------------------------------------------------------------------------
  // Sisi Utara (Menghadap Pintu Masuk Kuburan): Z -812 s/d -788
  box("#8a8f99", X_MIN, BASE_Y, -812.0, X_MAX, CURB_Y, -808.0); // Curb tepi jalan Utara
  box("#727780", X_MIN, BASE_Y, -808.0, X_MAX, CURB_Y, -788.0); // Trotoar Utara

  // Sisi Selatan (Menghadap Pekarangan Rumah): Z -1000 s/d -976
  box("#727780", X_MIN, BASE_Y, -1000.0, X_MAX, CURB_Y, -980.0); // Trotoar Selatan
  box("#8a8f99", X_MIN, BASE_Y, -980.0, X_MAX, CURB_Y, -976.0); // Curb tepi jalan Selatan

  // ---------------------------------------------------------------------------
  // 3. MARKA JALAN RAYA (Zebra Cross & Garis Kuning telah dihapus)
  // ---------------------------------------------------------------------------
  const MARK_Y0 = ROAD_Y + 0.02;
  const MARK_Y1 = ROAD_Y + 0.07;
  const CENTER_Z = -894.0;

  // A. Garis Solid Putih di Tepi Bahu Jalan (Shoulder Lines)
  box("#f0f1f5", X_MIN, MARK_Y0, ROAD_Z0 + 5.5, X_MAX, MARK_Y1, ROAD_Z0 + 7.3); // -970.5 s/d -968.7
  box("#f0f1f5", X_MIN, MARK_Y0, ROAD_Z1 - 7.3, X_MAX, MARK_Y1, ROAD_Z1 - 5.5); // -819.3 s/d -817.5

  // B. Garis Putus-Putus Putih Pemisah Lajur (Dashed Lane Dividers)
  const DASH_LEN = 35.0;
  const DASH_GAP = 25.0;
  const STEP = DASH_LEN + DASH_GAP;
  const LANE_Z1 = CENTER_Z - 41.0; // -935.0 (Lajur Selatan)
  const LANE_Z2 = CENTER_Z + 41.0; // -853.0 (Lajur Utara)

  for (let x = X_MIN; x < X_MAX; x += STEP) {
    box("#eef0f5", x, MARK_Y0, LANE_Z1 - 0.9, x + DASH_LEN, MARK_Y1, LANE_Z1 + 0.9);
    box("#eef0f5", x, MARK_Y0, LANE_Z2 - 0.9, x + DASH_LEN, MARK_Y1, LANE_Z2 + 0.9);
  }

  // ---------------------------------------------------------------------------
  // 4. TIANG LAMPU JALAN RAYA (Dihapus sesuai permintaan)
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // 5. APRON PENYAMBUNG GERBANG KUBURAN & HALAMAN RUMAH
  // ---------------------------------------------------------------------------
  const PLAZA_CX = 125.0;
  // Sambungan batu dari pintu masuk kuburan (Z: -765 s/d -788) ke trotoar Utara
  box("#444852", PLAZA_CX - 78.0, BASE_Y, -788.0, PLAZA_CX + 78.0, 11.85, -765.0);

  // Sambungan dari trotoar Selatan (Z: -1025 s/d -1000) ke bibir pekarangan rumah
  box("#5a5f6b", PLAZA_CX - 78.0, BASE_Y, -1025.0, PLAZA_CX + 78.0, CURB_Y, -1000.0);

  // --- Buat Shader Program WebGL2 untuk Jalan Raya ---
  const vsSource = `#version 300 es
  layout(location=0) in vec3 aP;
  layout(location=1) in vec3 aN;
  layout(location=2) in vec3 aC;
  uniform mat4 uVP;
  out vec3 vP;
  out vec3 vN;
  out vec3 vC;
  void main() {
    vP = aP;
    vN = aN;
    vC = aC;
    gl_Position = uVP * vec4(aP, 1.0);
  }`;

  const fsSource = `#version 300 es
  precision highp float;
  in vec3 vP;
  in vec3 vN;
  in vec3 vC;
  uniform vec3 uCam;
  uniform float uExposure;
  uniform int uMode; // 0 = Shaded, 1 = Flat, 2 = Wireframe
  uniform vec3 uWireCol;
  out vec4 fragColor;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  ${NIGHT_GLSL}

  void main() {
    if (uMode == 2) {
      fragColor = vec4(uWireCol, 1.0);
      return;
    }
    if (uMode == 1) {
      fragColor = vec4(vC, 1.0);
      return;
    }

    vec3 n = normalize(vN);

    // ---- Pencahayaan malam (lihat src/lighting.js) ----
    vec3 light = nightAmbient(n) + nightMoon(n);
    // kilau basah tipis di aspal & marka dari bulan
    vec3 viewDir = normalize(uCam - vP);
    float sheen = pow(max(dot(n, normalize(N_MOON_DIR + viewDir)), 0.0), 24.0) * 0.18;

    // Tekstur aspal halus berbintik kerikil (noise)
    float grain = (hash(floor(vP.xz * 2.5)) - 0.5) * 0.08;
    vec3 baseCol = vC + grain * step(0.1, 0.5 - vC.r);

    // Deteksi lampu jalan (kaca kuning berpendar mandiri)
    float isLamp = step(0.8, vC.r) * step(0.7, vC.g) * step(0.4, vC.b);
    vec3 emissive = vec3(1.0, 0.92, 0.55) * 2.8 * isLamp;

    // Kabut malam di kejauhan
    float dist = length(uCam - vP);
    float fog = 1.0 - exp(-dist * 0.00035);
    vec3 fogCol = vec3(0.024, 0.038, 0.068);

    vec3 col = baseCol * light + N_MOON_COL * sheen + emissive;
    col = mix(col, fogCol, clamp(fog, 0.0, 0.85));
    col = nightTone(col * uExposure);

    fragColor = vec4(col, 1.0);
  }`;

  function compileShader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
    }
    return s;
  }

  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(program);

  const uVP = gl.getUniformLocation(program, "uVP");
  const uCam = gl.getUniformLocation(program, "uCam");
  const uExposure = gl.getUniformLocation(program, "uExposure");
  const uMode = gl.getUniformLocation(program, "uMode");
  const uWireCol = gl.getUniformLocation(program, "uWireCol");

  // VAO & Buffers
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const pVbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, pVbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(P), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

  const nVbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, nVbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(N), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

  const cVbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, cVbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(C), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);

  const triIbo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triIbo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(TI), gl.STATIC_DRAW);

  const wireIbo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wireIbo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(WI), gl.STATIC_DRAW);

  gl.bindVertexArray(null);

  function render(VP, camEye, options = {}) {
    const { mode = 0, exposure = 1.4 } = options;

    gl.useProgram(program);
    gl.uniformMatrix4fv(uVP, false, VP);
    gl.uniform3fv(uCam, camEye);
    gl.uniform1f(uExposure, exposure);

    gl.bindVertexArray(vao);

    if (mode === 2) {
      gl.uniform1i(uMode, 2);
      gl.uniform3fv(uWireCol, [0.95, 0.85, 0.35]);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wireIbo);
      gl.drawElements(gl.LINES, WI.length, gl.UNSIGNED_INT, 0);
    } else {
      gl.uniform1i(uMode, mode === 1 ? 1 : 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triIbo);
      gl.drawElements(gl.TRIANGLES, TI.length, gl.UNSIGNED_INT, 0);
    }

    gl.bindVertexArray(null);
  }

  return {
    render,
    triangleCount: TI.length / 3,
    vertexCount: P.length / 3,
  };
}
