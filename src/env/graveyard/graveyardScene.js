/**
 * ==============================================================================
 * GRAVEYARD SCENE ADAPTER (WebGL2, Shaders, & Scene Rendering)
 * ==============================================================================
 */

import { OBJEK_GRAVEYARD } from "./data.js";
import { M4 } from "../../core/math.js";
import { KINDS, hx, UM, STONE_RANGE } from "../../core/geometry.js";
import { GRAVESTONE_RANGE } from "./gravestone.js";
import { createEnvironment } from "./environment.js";

// =====================================================================
//  1. SHADER GRAVEYARD
// =====================================================================
//  uTerrain = 0/3: objek biasa, batu nisan & balok makam -> warna polos uCol
//  uTerrain = 1/9: rumput datar (dalam & luar kuburan) + kabut jauh
//  uTerrain = 10 : titik-titik bintang putih di langit (gl.POINTS)
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
  gl_PointSize = 2.5;
}`;

const fs = `#version 300 es
precision highp float;
in vec3 vP;
uniform vec3 uCol, uCam;
uniform float uEx, uA;
uniform int uMode;
uniform int uTerrain;

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

// Rumput malam bernuansa hijau alami (dipakai di dalam & luar kuburan)
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

out vec4 fC;
void main() {
  // 10 = Titik-titik bintang putih di langit
  if (uTerrain == 10) {
    fC = vec4(1.0, 1.0, 1.0, 1.0);
    return;
  }

  vec3 dx = dFdx(vP);
  vec3 dy = dFdy(vP);
  vec3 n = normalize(cross(dx, dy));

  vec3 v = normalize(uCam - vP);
  if (dot(n, v) < 0.0) n = -n;

  vec3 L = normalize(vec3(0.5, 0.9, 0.4));
  float d = max(dot(n, L), 0.0);

  float h = n.y * 0.5 + 0.5;
  vec3 amb = mix(vec3(0.4, 0.45, 0.55), vec3(0.8, 0.9, 1.0), h);
  vec3 l = amb * 0.8 + vec3(1.0, 0.95, 0.85) * d * 0.6;

  if (uMode == 0) {
    if (uTerrain == 9 || uTerrain == 1) {
      vec3 grass = grassAlbedo(vP, n);
      float distCam = length(vP.xz - uCam.xz);
      float fog = smoothstep(1000.0, 4600.0, distCam);
      vec3 fogCol = vec3(0.024, 0.038, 0.068);
      vec3 litGrass = pow(grass, vec3(0.45)) * l * uEx;
      fC = vec4(mix(litGrass, fogCol * uEx, fog), uA);
      return;
    }
    vec3 gc = pow(uCol, vec3(0.45)) * l * vec3(0.86, 0.93, 1.06) * uEx;
    gc = clamp((gc * (2.51 * gc + 0.03)) / (gc * (2.43 * gc + 0.59) + 0.14), 0.0, 1.0);
    fC = vec4(gc, uA);
  } else {
    float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    fC = vec4(uCol * l * uEx + vec3(rim * 0.3), uA);
  }
}`;

// =====================================================================
//  2. INISIALISASI WEBGL2 & PROGRAM SHADER
// =====================================================================
const $ = (id) => document.getElementById(id);
const cv = $("c");
const gl = cv.getContext("webgl2", { antialias: true, stencil: true });
if (!gl) alert("WebGL2 tidak didukung!");

const pg = gl.createProgram();
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
["uVP", "uM", "uR", "uC", "uH", "uCol", "uCam", "uEx", "uA", "uMode", "uTerrain"].forEach(
  (n) => (U[n] = gl.getUniformLocation(pg, n)),
);
const ID4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
gl.uniformMatrix4fv(U.uR, false, ID4);

// =====================================================================
//  3. SCENE GRAVEYARD
// =====================================================================
export function createGraveyardScene() {
  const pv = gl.createVertexArray();
  const pb = gl.createBuffer();
  gl.bindVertexArray(pv);
  gl.bindBuffer(gl.ARRAY_BUFFER, pb);
  gl.bufferData(gl.ARRAY_BUFFER, UM.arr, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  function getTerrainHeight() {
    return 10.535;
  }

  const env = createEnvironment(gl, U, ID4);

  function drawShapes(a, only, onlyComplex, sel, customTransforms) {
    gl.bindVertexArray(pv);
    gl.uniform1i(U.uMode, onlyComplex ? 0 : 1);
    gl.uniformMatrix4fv(U.uR, false, ID4);

    OBJEK_GRAVEYARD.forEach((ob, i) => {
      if (only !== undefined && i !== only) return;

      if (onlyComplex && ob.nama === "Plane") {
        env.drawTerrain(a);
        gl.bindVertexArray(pv);
        return;
      }

      let k = 0;
      if (ob.jenis === "silinder") k = 1;
      else if (ob.jenis === "kerucut") k = 2;
      else if (ob.jenis === "torus") k = 3;
      else if (ob.jenis === "ellipsoid") k = 4;
      else if (ob.jenis === "plane") k = 5;

      const kProxy = k === 5 ? (ob.nama.startsWith("Cube") ? 4 : 0) : k;
      const isStone = onlyComplex && k === 5 && ob.nama.startsWith("Cube");

      const custom = !onlyComplex
        ? null
        : GRAVESTONE_RANGE.has(i)
          ? [GRAVESTONE_RANGE.get(i), 3]
          : null;

      const r = custom
        ? UM.ranges[custom[0]]
        : isStone
          ? UM.ranges[STONE_RANGE]
          : UM.ranges[kProxy];

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

      if (custom) gl.uniform1i(U.uTerrain, custom[1]);
      gl.drawArrays(gl.TRIANGLES, r[0], r[1]);
      if (custom) gl.uniform1i(U.uTerrain, 0);
    });

    gl.bindVertexArray(null);
  }

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

    env.renderSky(eye);
    env.renderLandscape();

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

export { cv, gl, pg, U, ID4 };
