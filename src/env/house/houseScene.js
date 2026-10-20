/**
 * ==============================================================================
 * HOUSE & PEKARANGAN SCENE (WEBGL2)
 * ==============================================================================
 * Modul 3D Rumah dan Pekarangan diadaptasi dari house/rumah_pekarangan_webgl.html:
 * 1. Seluruh 43 bagian arsitektur rumah & pekarangan (Tanah, Teras, 10 Jalur Rumput,
 *    Tepi Rumput, Fondasi, Dinding 1 & 2, Lis, Atap Pelana Gable, Cerobong, Pintu,
 *    Gagang Pintu Ellipsoid, Anak Tangga, Kanopi, 2 Tiang Frustum, dan 6 Jendela).
 * 2. Ditransformasikan ke koordinat dunia gabungan:
 *    - Skala: 22x (sesuai proporsi dunia kuburan, tinggi rumah ~320 unit)
 *    - Posisi: Z di kisaran 730 s/d 1280 (di seberang jalan raya), X berpusat di 0
 *    - Arah hadap: Menghadap Selatan (-Z), lurus menatap jalan raya & kuburan
 * 3. Mendukung render shader realistis (pencahayaan malam bulan, ambient, spekular),
 *    flat color, dan wireframe.
 * ==============================================================================
 */

import { NIGHT_GLSL } from "../../lighting.js";

export function createHouseScene(gl) {
  const P = [];
  const N = [];
  const C = [];
  const TI = [];
  const WI = [];
  const parts = [];
  let vc = 0;

  const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];

  // Parameter transformasi dari ruang lokal rumah ke ruang dunia gabungan:
  // Rumah berpindah ke seberang jalan raya (Z < -1000) dan menghadap ke Utara (+Z)
  // menatap langsung ke jalan raya dan pintu gerbang utama kuburan (X ≈ 125).
  const S = 38.0;          // Skala perbesaran (seimbang dengan luas megah kuburan)
  const Y_BASE = 10.535;   // Ketinggian tanah kuburan / pekarangan
  const TX = 125.0;        // Sumbu X sejajar dengan pintu gerbang utama kuburan & zebra cross
  const TZ = -1404.0;      // Pusat pergeseran Z agar ujung rumput di Z = -1005 (menyentuh trotoar)

  function transformPos(localP) {
    // localP = [x, y, z] di mana +X adalah depan rumah, +Y tinggi, Z lebar
    // Rotasi agar depan rumah (+X lokal) menghadap ke Utara (+Z dunia):
    // X_dunia = TX - S * z
    // Y_dunia = Y_BASE + S * y
    // Z_dunia = TZ + S * x
    return [
      TX - S * localP[2],
      Y_BASE + S * localP[1],
      TZ + S * localP[0],
    ];
  }

  function transformNormal(localN) {
    return [
      -localN[2],
      localN[1],
      localN[0],
    ];
  }

  function addPart(name, type, color, faces) {
    const col = hex(color);
    const mn = [1e9, 1e9, 1e9];
    const mx = [-1e9, -1e9, -1e9];

    // Konversi titik-titik wajah ke ruang dunia
    const worldFaces = faces.map((f) =>
      f.map((v) => {
        const wp = transformPos(v);
        for (let i = 0; i < 3; i++) {
          mn[i] = Math.min(mn[i], wp[i]);
          mx[i] = Math.max(mx[i], wp[i]);
        }
        return wp;
      })
    );

    const c = [0, 1, 2].map((i) => (mn[i] + mx[i]) / 2);
    const p = {
      name,
      type,
      v0: vc,
      t0: TI.length,
      w0: WI.length,
      c,
      size: [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]],
      col,
    };

    worldFaces.forEach((f) => {
      let n = cross(sub(f[1], f[0]), sub(f[2], f[0]));
      const l = Math.hypot(n[0], n[1], n[2]) || 1;
      n = n.map((x) => x / l);

      const fc = [0, 1, 2].map((i) => f.reduce((s, v) => s + v[i], 0) / f.length);
      const d = sub(fc, c);
      if (n[0] * d[0] + n[1] * d[1] + n[2] * d[2] < 0) n = n.map((x) => -x);

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

    p.vn = vc - p.v0;
    p.tn = TI.length - p.t0;
    p.wn = WI.length - p.w0;
    parts.push(p);
  }

  // --- Primitif Geometri Rumah (Koordinat Lokal) ---
  function box(name, col, x0, y0, z0, x1, y1, z1) {
    const v = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ];
    const F = [
      [0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7],
      [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0],
    ];
    addPart(name, "box", col, F.map((f) => f.map((i) => v[i])));
  }

  function gable(name, col, x0, x1, z0, z1, y0, h) {
    const xm = (x0 + x1) / 2, yr = y0 + h;
    addPart(name, "prisma segitiga", col, [
      [[x0, y0, z0], [x0, y0, z1], [xm, yr, z1], [xm, yr, z0]],
      [[x1, y0, z1], [x1, y0, z0], [xm, yr, z0], [xm, yr, z1]],
      [[x0, y0, z0], [xm, yr, z0], [x1, y0, z0]],
      [[x0, y0, z1], [x1, y0, z1], [xm, yr, z1]],
      [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    ]);
  }

  function frustum(name, col, cx, y0, cz, r0, r1, h, s = 14) {
    const top = [], bot = [], F = [];
    for (let i = 0; i < s; i++) {
      const a = (i / s) * Math.PI * 2, c = Math.cos(a), n = Math.sin(a);
      top.push([cx + r1 * c, y0 + h, cz + r1 * n]);
      bot.push([cx + r0 * c, y0, cz + r0 * n]);
    }
    for (let i = 0; i < s; i++) {
      const j = (i + 1) % s;
      F.push([bot[i], bot[j], top[j], top[i]]);
    }
    F.push(top, bot);
    addPart(name, "cone terpotong", col, F);
  }

  function ellipsoid(name, col, cx, cy, cz, rx, ry, rz, S_seg = 12, R_ring = 8) {
    const F = [];
    const pt = (i, j) => {
      const a = (Math.PI * i) / R_ring, b = (2 * Math.PI * j) / S_seg;
      return [
        cx + rx * Math.sin(a) * Math.cos(b),
        cy + ry * Math.cos(a),
        cz + rz * Math.sin(a) * Math.sin(b),
      ];
    };
    for (let i = 0; i < R_ring; i++) {
      for (let j = 0; j < S_seg; j++) {
        if (i === 0) F.push([pt(0, 0), pt(1, j + 1), pt(1, j)]);
        else if (i === R_ring - 1) F.push([pt(i, j), pt(i, j + 1), pt(R_ring, 0)]);
        else F.push([pt(i, j), pt(i, j + 1), pt(i + 1, j + 1), pt(i + 1, j)]);
      }
    }
    addPart(name, "ellipsoid", col, F);
  }

  // --- Bangun Seluruh Elemen Rumah & Pekarangan ---
  box("Tanah dasar", "#6b4a2f", -14.4, -0.5, -10.2, 10.9, 0, 10.0);
  box("Teras batu", "#b9b2a3", -6.6, 0, -9.6, -4.2, 0.08, 9.2);

  for (let i = 0; i < 10; i++) {
    const z0 = -9.6 + i * 1.88;
    box(
      "Jalur rumput " + (i + 1),
      i % 2 ? "#4f9a30" : "#68b23f",
      -4.2, 0, z0, 10.0, 0.1, z0 + 1.88
    );
  }

  box("Tepi rumput ujung", "#8a8f94", 10.0, 0, -9.9, 10.5, 0.15, 9.5);
  box("Tepi rumput kiri", "#8a8f94", -4.2, 0, -9.9, 10.0, 0.15, -9.6);
  box("Tepi rumput kanan", "#8a8f94", -4.2, 0, 9.2, 10.0, 0.15, 9.5);
  box("Fondasi rumah", "#8c8a85", -13.8, 0, -9.6, -6.2, 0.6, 9.6);
  box("Dinding lantai 1", "#eadcb8", -13.6, 0.6, -9.4, -6.4, 5.4, 9.4);
  box("Lis pemisah lantai", "#f4f0e4", -13.7, 5.4, -9.5, -6.3, 5.6, 9.5);
  box("Dinding lantai 2", "#e4d3a9", -13.6, 5.6, -9.4, -6.4, 10.3, 9.4);
  gable("Atap", "#a0452e", -14.6, -5.4, -10.2, 10.2, 10.3, 2.8);
  box("Cerobong", "#8a4b38", -11.4, 10.8, 5.0, -10.2, 14.2, 6.6);
  box("Tutup cerobong", "#4f4f52", -11.55, 14.2, 4.85, -10.05, 14.45, 6.75);
  box("Kusen pintu", "#f6f3ea", -6.5, 0.6, -1.5, -6.25, 4.3, 1.5);
  box("Pintu", "#7a3f1e", -6.5, 0.6, -1.2, -6.2, 4.0, 1.2);
  ellipsoid("Gagang pintu", "#d4af37", -6.2, 2.12, 0.9, 0.11, 0.15, 0.11, 10, 6);
  box("Anak tangga", "#c9c2b2", -6.4, 0.08, -2.0, -5.6, 0.4, 2.0);
  box("Kanopi teras", "#a0452e", -6.4, 4.6, -2.6, -4.6, 4.85, 2.6);
  frustum("Tiang teras 1", "#f4f1ea", -4.8, 0.08, -2.3, 0.2, 0.13, 4.52);
  frustum("Tiang teras 2", "#f4f1ea", -4.8, 0.08, 2.3, 0.2, 0.13, 4.52);

  function win(label, zc, yb, w, h, sill) {
    box(label + " (kusen)", "#f6f3ea", -6.5, yb - 0.2, zc - w / 2 - 0.2, -6.28, yb + h + 0.2, zc + w / 2 + 0.2);
    box(label + " (kaca)", "#8fd0ee", -6.5, yb, zc - w / 2, -6.2, yb + h, zc + w / 2);
    if (sill) {
      box(label + " (ambang)", "#cfc8b8", -6.5, yb - 0.35, zc - w / 2 - 0.35, -6.0, yb - 0.2, zc + w / 2 + 0.35);
    }
  }

  win("Jendela bawah 1", -5.8, 2.3, 2.4, 1.9, true);
  win("Jendela bawah 2", 5.8, 2.3, 2.4, 1.9, true);
  [-6.6, -2.2, 2.2, 6.6].forEach((z, i) =>
    win("Jendela atas " + (i + 1), z, 6.7, 1.9, 2.3, false)
  );

  // --- Buat Shader Program WebGL2 untuk Rumah ---
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
  uniform int uMode; // 0 = Shaded malam, 1 = Flat Color, 2 = Wireframe
  uniform vec3 uWireCol;
  out vec4 fragColor;
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
    vec3 viewDir = normalize(uCam - vP);

    // ---- Pencahayaan malam (lihat src/lighting.js) ----
    // ambient langit biru + cahaya bulan dingin + cahaya hangat dari rumah
    vec3 light = nightAmbient(n) + nightMoon(n) + nightLamps(vP, n);

    // Kaca jendela: memantulkan bulan + lampu kamar menyala dari dalam
    float isGlass = step(0.7, vC.b) * step(vC.r, 0.65);
    vec3 halfV = normalize(N_MOON_DIR + viewDir);
    float spec = pow(max(dot(n, halfV), 0.0), 32.0);
    vec3 specLight = N_MOON_COL * spec * (0.25 + 0.6 * isGlass);

    vec3 col = vC * light + specLight;
    if (isGlass > 0.5) {
      // tiap jendela sedikit beda terangnya (tirai / lampu kamar), tengah lebih terang
      float id = floor(vP.x / 90.0) + floor(vP.y / 120.0) * 7.0;
      float lit = 0.75 + 0.25 * fract(sin(id * 12.9898) * 43758.5453);
      float edge = 1.0 - 0.35 * smoothstep(0.2, 1.0, abs(n.y));
      col = mix(col, N_WIN_GLOW * lit * edge * 1.15, 0.88) + specLight;
    }

    // Kabut atmosferik malam lembut di kejauhan
    float dist = length(uCam - vP);
    float fog = 1.0 - exp(-dist * 0.00035);
    col = mix(col, N_FOG_COL, clamp(fog, 0.0, 0.85));
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

  // VAO & VBOs
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
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(TI), gl.STATIC_DRAW);

  // Wireframe IBO terpisah
  const wireIbo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wireIbo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(WI), gl.STATIC_DRAW);

  gl.bindVertexArray(null);

  /**
   * Render Rumah dan Pekarangan
   */
  function render(VP, camEye, options = {}) {
    const { mode = 0, exposure = 1.4 } = options;

    gl.useProgram(program);
    gl.uniformMatrix4fv(uVP, false, VP);
    gl.uniform3fv(uCam, camEye);
    gl.uniform1f(uExposure, exposure);

    gl.bindVertexArray(vao);

    if (mode === 2) {
      // Wireframe murni
      gl.uniform1i(uMode, 2);
      gl.uniform3fv(uWireCol, [0.35, 0.95, 0.55]);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, wireIbo);
      gl.drawElements(gl.LINES, WI.length, gl.UNSIGNED_SHORT, 0);
    } else {
      // Shaded (mode 0) atau Flat (mode 1)
      gl.uniform1i(uMode, mode === 1 ? 1 : 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, triIbo);
      gl.drawElements(gl.TRIANGLES, TI.length, gl.UNSIGNED_SHORT, 0);
    }

    gl.bindVertexArray(null);
  }

  return {
    render,
    parts,
    triangleCount: TI.length / 3,
    vertexCount: P.length / 3,
  };
}
