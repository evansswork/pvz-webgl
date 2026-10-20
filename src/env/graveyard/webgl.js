import { vs, fs } from "./shaders.js";

// Inisialisasi karena data sudah diproses jadi OBJEK_GRAVEYARD

const $ = (id) => document.getElementById(id);
const cv = $("c");
const gl = cv.getContext("webgl2", { antialias: true, stencil: true }); // stencil: bayangan planar karakter
if (!gl) alert("WebGL2 tidak didukung!");

// ---------- program shader & lokasi uniform ----------
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
["uVP", "uM", "uR", "uC", "uH", "uCol", "uCam", "uEx", "uA", "uMode", "uHW"].forEach(
  (n) => (U[n] = gl.getUniformLocation(pg, n)),
);
const ID4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
gl.uniformMatrix4fv(U.uR, false, ID4);

export { $, cv, gl, pg, U, ID4 };
