/**
 * ==============================================================================
 * ZOMBIE SCENE ADAPTER
 * ==============================================================================
 * Mengemas model, hierarki tulang (BoneNode), dan animasi Zombie
 * menjadi modul scene yang siap digabungkan dengan lingkungan Graveyard.
 * ==============================================================================
 */

import { m4, M, sub, nrm, tr, inv, seg, axisRot, cr, dt, persp, look, ortho } from "./libs.js";
import { pack, grid, normals, ellipsoid, frustum, cylinder, torus, paraboloid, box, bz, tube, leaf, prism, jacket, ragged } from "./geometry.js";
import { ZombiePart, BoneNode } from "./ZombieNode.js";

export function createZombieScene(gl) {
  "use strict";

      const PREC = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
      const VS = `attribute vec3 aP;attribute vec3 aN;uniform mat4 uPr,uV,uM,uNm;varying vec3 vN,vW;
void main(){vec4 w=uM*vec4(aP,1.);vW=w.xyz;vN=mat3(uNm)*aN;gl_Position=uPr*uV*w;}`;
      /* Fragment shader pencahayaan realistis:
         - Shadow mapping + PCF 5x5 (bayangan lembut, termasuk self-shadow)
         - Wrap diffuse (terminator lembut seperti kulit)
         - Hemisphere ambient (langit dingin di atas, pantulan lantai hangat di bawah)
         - Ambient occlusion kontak (dekat lantai lebih gelap)
         - Blinn-Phong specular (ikut terhalang bayangan) + rim light */
      const FS = PREC + `varying vec3 vN,vW;
uniform vec3 uC,uL,uE;uniform mat4 uLM;uniform sampler2D uSh;uniform float uShOn,uGnd,uTx;
float unpackD(vec4 c){return dot(c,vec4(1.,1./255.,1./65025.,1./16581375.));}
float shadowAt(vec3 N,vec3 L){
  if(uShOn<.5)return 1.;
  float ndl=dot(N,L);
  vec3 Nl=ndl<0.?-N:N;
  float a=abs(ndl);
  vec4 ls=uLM*vec4(vW+Nl*(.004+.012*(1.-a)),1.);
  vec3 p=ls.xyz/ls.w*.5+.5;
  if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.)return 1.;
  float s=0.;
  for(int x=-2;x<=2;x++)for(int y=-2;y<=2;y++){
    float d=unpackD(texture2D(uSh,p.xy+vec2(float(x),float(y))*uTx*1.3));
    s+=(p.z-.0004>d)?0.:1.;
  }
  return s/25.;
}
void main(){
  vec3 N=normalize(vN),V=normalize(uE-vW);if(dot(N,V)<0.)N=-N;vec3 L=normalize(uL);
  float ndl=dot(N,L);
  float sh=shadowAt(N,L);
  float d=max((ndl+.2)/1.2,0.)*sh;
  float f=max(dot(N,normalize(vec3(-.6,.3,.5))),0.)*.22;
  vec3 hemi=mix(vec3(.20,.18,.16),vec3(.33,.36,.40),N.y*.5+.5);
  float ao=uGnd>.5?mix(.55,1.,smoothstep(.05,.6,length(vW.xz))):mix(.72,1.,smoothstep(0.,.4,vW.y));
  float sp=pow(max(dot(N,normalize(L+V)),0.),32.)*.24*sh;
  float rim=pow(1.-max(dot(N,V),0.),3.)*.18;
  vec3 sickly=vec3(-.04,.05,-.02)*(f+.1);
  vec3 col=uC*(hemi*ao+vec3(1.,.97,.92)*.85*d+f*ao)+vec3(sp)+uC*rim*ao+sickly;
  gl_FragColor=vec4(col,1.);}`;
      /* shader untuk shadow pass: simpan kedalaman dari sudut pandang cahaya (di-pack ke RGBA) */
      const VS_D = `attribute vec3 aP;uniform mat4 uM,uLM;void main(){gl_Position=uLM*uM*vec4(aP,1.);}`;
      const FS_D = PREC + `void main(){vec4 e=fract(gl_FragCoord.z*vec4(1.,255.,65025.,16581375.));
e-=e.yzww*vec4(1./255.,1./255.,1./255.,0.);gl_FragColor=e;}`;
      // Fungsi pembantu untuk mengompilasi shader WebGL (Vertex / Fragment)
      function sh(t, s) {
        const o = gl.createShader(t);
        gl.shaderSource(o, s);
        gl.compileShader(o);
        if (!gl.getShaderParameter(o, gl.COMPILE_STATUS))
          console.error(gl.getShaderInfoLog(o));
        return o;
      }

      // Fungsi pembantu untuk menautkan (link) Vertex & Fragment Shader menjadi WebGLProgram
      function prog(vs, fs) {
        const p = gl.createProgram();
        gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
        gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
        gl.linkProgram(p);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS))
          console.error(gl.getProgramInfoLog(p));
        return p;
      }

  // Program shader utama untuk rendering zombie dengan pencahayaan penuh
  const pr = prog(VS, FS);
  // Program shader sekunder untuk shadow pass (hanya mencatat nilai kedalaman Z)
  const prD = prog(VS_D, FS_D);
  gl.useProgram(pr);

  // Pemetaan lokasi atribut dan uniform shader utama
  const aP = gl.getAttribLocation(pr, "aP");
  const aN = gl.getAttribLocation(pr, "aN");
  const U = { aP, aN };
  for (const k of ["uPr", "uV", "uM", "uNm", "uC", "uL", "uE", "uLM", "uSh", "uShOn", "uGnd", "uTx"]) {
    U[k] = gl.getUniformLocation(pr, k);
  }

  // Pemetaan lokasi atribut dan uniform shader kedalaman (shadow pass)
  const UD = {
    aP: gl.getAttribLocation(prD, "aP"),
    aN: -1,
    uM: gl.getUniformLocation(prD, "uM"),
    uLM: gl.getUniformLocation(prD, "uLM"),
    uNm: null,
    uC: null,
  };

  // Konfigurasi arah cahaya (directional light) dan matriks proyeksi bayangan (LIGHT_M)
  const LIGHT_DIR = [0.5, 0.9, 0.4]; // Searah dengan matahari di graveyard
  const LIGHT_M = (() => {
    const Ld = nrm(LIGHT_DIR), C = [0, 1.05, 0.1], D = 5;
    const E = [C[0] + Ld[0] * D, C[1] + Ld[1] * D, C[2] + Ld[2] * D];
    return M(ortho(-2, 2, -2, 2, 1, 9), look(E, C, [0, 1, 0]));
  })();

      function mesh(g) { return g; };
      /* ============ JENIS OBJEK & WARNA ============ */
      const hex = (h) =>
        [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);
      const TYPES = {
        ellipsoid: { c: "#6fb3c8", label: "Ellipsoid", q: 1 },
        cylinder: { c: "#6a8fdc", label: "Cylinder", q: 1 },
        cone: { c: "#ec8a45", label: "Cone terpotong", q: 1 },
        box: { c: "#9aa0a6", label: "Box", q: 0 },
        curve: { c: "#e2699a", label: "Mesh kurva Bézier", q: 0 },
        tri: { c: "#72b863", label: "Mesh segitiga", q: 0 },
      };

  let animOn = true;
  let animT = 0;
  let explode = 0;
  let real = true; // Warna asli zombie

// ROOT rotasi dasar (sebelumnya m4.Y(-0.8) sehingga hadapnya miring 46 derajat.
// Sekarang m4.I() agar arah hadap zombie lurus sempurna searah sumbu +Z)
const ROOT = [m4.I()];
const CENTER = [[0, 1.15, 0.3]];

// Registry penyimpanan instance BoneNode berdasarkan nama
const bones = {};
/**
 * getBone: Mengambil atau membuat simpul tulang BoneNode berdasarkan nama.
 * @param {string} name - Nama simpul tulang
 * @returns {BoneNode}
 */
function getBone(name) {
  if (!bones[name]) bones[name] = new BoneNode(name);
  return bones[name];
}

// ============ PENYUSUNAN STRUKTUR POHON TULANG HIERARKIS (SCENE GRAPH) ============
// root -> body -> (head, armL_upper, armR_upper, legL_upper, legR_upper)
getBone("root").children.push(getBone("body"));
getBone("body").children.push(getBone("head"), getBone("armL_upper"), getBone("armR_upper"), getBone("legL_upper"), getBone("legR_upper"));
getBone("head").children.push(getBone("jaw"), getBone("eyeL"), getBone("eyeR"));
for(let i=0; i<10; i++) getBone("head").children.push(getBone("hair"+i));
getBone("armL_upper").children.push(getBone("armL_lower"));
getBone("armR_upper").children.push(getBone("armR_lower"));
getBone("legL_upper").children.push(getBone("legL_lower"));
getBone("legR_upper").children.push(getBone("legR_lower"));

const PARTS = [];
/**
 * add: Mendaftarkan satu komponen bagian tubuh (mesh) ke tulang tertentu dalam hierarki.
 * @param {number} charIndex - Indeks karakter
 * @param {Object} m - Data geometri {p, n, i}
 * @param {Array<number>} Mx - Matriks posisi & orientasi lokal part
 * @param {string} t - Tipe primitif geometris
 * @param {string} c - Kode warna HEX
 * @param {string} bone - Nama tulang pemilik (default: "body")
 */
function add(charIndex, m, Mx, t, c, bone) {
  const cColor = hex(c);
  m.type = t;
  const center = CENTER[charIndex];
  const off = nrm(sub([Mx[12], Mx[13], Mx[14]], center));
  const d = Math.hypot(...sub([Mx[12], Mx[13], Mx[14]], center));
  const amt = 0.25 + d * 0.7;
  let part = new ZombiePart(gl, m, Mx, cColor, t, off, amt, charIndex);
  PARTS.push(part);
  getBone(bone || "body").parts.push(part);
}
/* ============ PENYUSUNAN KARAKTER ============ */

      const RC = {
        stem: "#3f8a2e",
        leaf: "#4f9e3c",
        pea: "#7cc23c",
        peaD: "#62a82f",
        black: "#15171a",
        face: "#c9824a",
        petal: "#f2c230",
        vein: "#3a7a2a",
        mouth: "#3b1f10",
        skin: "#7e9a6a",
        skinD: "#6c8759",
        nostril: "#4a5e3d",
        coat: "#6b4526",
        shirt: "#d8d4c8",
        tie: "#b3262b",
        pants: "#3f5a8a",
        shoe: "#5a3a1e",
        sole: "#35230f",
        eye: "#efeee6",
        tongue: "#c86a6a",
        tooth: "#eee8d0",
        hair: "#2b2b2b",
        mouthCav: "#8c3131",
        gum: "#a44444",
        lip: "#7a4038",
      };

      /**
       * leafCurves: Menghasilkan kurva kontrol Bézier pembatas tepi daun (tepi kiri dan kanan).
       * @param {number} len - Panjang daun
       * @param {number} w - Lebar daun
       * @param {number} tipY - Ketinggian ujung daun
       * @returns {Array<Array<Array<number>>>} Pasangan titik kontrol kurva batas kiri & kanan
       */
      function leafCurves(len, w, tipY) {
        return [
          [
            [0, 0.05, 0],
            [len * 0.22, 0.3, -w * 0.95],
            [len * 0.68, 0.28, -w * 0.85],
            [len, tipY, 0],
          ],
          [
            [0, 0.05, 0],
            [len * 0.22, 0.3, w * 0.95],
            [len * 0.68, 0.28, w * 0.85],
            [len, tipY, 0],
          ],
        ];
      }

      /**
       * pantsTexture: Menghasilkan geometri silinder celana dengan kerutan kain (wrinkled fabric noise).
       * @param {number} r1 - Radius lingkaran bawah
       * @param {number} r2 - Radius lingkaran atas
       * @param {number} nr - Segmen baris vertikal
       * @param {number} nc - Segmen kolom melingkar
       * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
       */
      function pantsTexture(r1, r2, nr = 10, nc = 24) {
        const p = [],
          i = [];
        for (let a = 0; a <= nr; a++) {
          const y = a / nr - 0.5,
            r = r1 + (r2 - r1) * (a / nr);
          for (let b = 0; b <= nc; b++) {
            const th = (2 * Math.PI * b) / nc;
            // Gelombang noise untuk lipatan vertikal & horizontal kain
            const noise =
              Math.sin(th * 10) * Math.cos(y * 20) * 0.004 +
              Math.sin(th * 15 + y * 10) * 0.002;
            p.push((r + noise) * Math.cos(th), y, (r + noise) * Math.sin(th));
          }
        }
        grid(nr, nc, i);
        return pack(p, normals(p, i), i);
      }

      /**
       * curvedEllipsoid: Membangun elipsoid yang ditekuk/dilengkungkan pada sumbu Y dan Z.
       * Digunakan untuk bagian tubuh yang melengkung natural seperti bahu, dagu, dan lekukan paha.
       * @param {number} rx - Radius sumbu X
       * @param {number} ry - Radius sumbu Y
       * @param {number} rz - Radius sumbu Z
       * @param {number} bendY - Faktor kelengkungan sumbu Y
       * @param {number} bendZ - Faktor kelengkungan sumbu Z
       * @param {number} sl - Slices melingkar
       * @param {number} st - Stacks vertikal
       * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
       */
      function curvedEllipsoid(rx, ry, rz, bendY, bendZ, sl = 24, st = 16) {
        const p = [],
          i = [];
        for (let a = 0; a <= st; a++) {
          const ph = (Math.PI * a) / st;
          for (let b = 0; b <= sl; b++) {
            const th = (2 * Math.PI * b) / sl;
            let x = rx * Math.sin(ph) * Math.cos(th);
            let y = ry * Math.cos(ph);
            let z = rz * Math.sin(ph) * Math.sin(th);
            let factor = (x * x) / (rx * rx);
            y += bendY * factor;
            z += bendZ * factor;
            p.push(x, y, z);
          }
        }
        grid(st, sl, i);
        return pack(p, normals(p, i), i);
      }

      /**
       * texturedEllipsoid: Elipsoid dengan gangguan permukaan (noise) untuk efek kerutan kain atau kulit kasar.
       * @param {number} rx - Radius sumbu X
       * @param {number} ry - Radius sumbu Y
       * @param {number} rz - Radius sumbu Z
       * @param {number} sl - Slices
       * @param {number} st - Stacks
       * @param {string} type - Jenis tekstur ("cloth" untuk kain jas, "skin" untuk tengkorak bergelombang)
       * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
       */
      function texturedEllipsoid(rx, ry, rz, sl = 24, st = 16, type = "cloth") {
        const p = [],
          i = [];
        for (let a = 0; a <= st; a++) {
          const ph = (Math.PI * a) / st;
          for (let b = 0; b <= sl; b++) {
            const th = (2 * Math.PI * b) / sl;
            let noise = 0;
            if (type === "cloth")
              noise =
                Math.sin(th * 10) * Math.cos(ph * 15) * 0.004 +
                Math.sin(th * 20 + ph * 8) * 0.002;
            else if (type === "skin") {
              // Deformasi tengkorak yang tidak rata (penyok & asimetris) menggunakan frekuensi rendah
              const skull =
                Math.sin(th * 2) * Math.cos(ph * 3) * 0.012 +
                Math.sin(th * 3 + ph * 2) * 0.008;
              // Kerutan halus/pori-pori
              const micro = Math.cos(th * 15 + ph * 11) * 0.0015;
              // Kalikan dengan sin(ph) agar noise bernilai 0 di titik kutub atas (ubun-ubun)
              // Ini mencegah terjadinya "pusaran / ikatan siomay" akibat pertemuan semua titik th.
              noise = (skull + micro) * Math.sin(ph);
            }
            p.push(
              (rx + noise) * Math.sin(ph) * Math.cos(th),
              (ry + noise) * Math.cos(ph),
              (rz + noise) * Math.sin(ph) * Math.sin(th),
            );
          }
        }
        grid(st, sl, i);
        return pack(p, normals(p, i), i);
      }

      /* ---------- ZOMBIE ---------- */
      (function () {
        const charIndex = 0;
        for (const s of [-1, 1]) {
          const legX = s * 0.13;
          const upperLegBone = s < 0 ? "legL_upper" : "legR_upper";
          const lowerLegBone = s < 0 ? "legL_lower" : "legR_lower";
          add(
            charIndex,
            mesh(ellipsoid(0.1, 0.07, 0.19)),
            m4.T(legX, 0.08, 0.06),
            "ellipsoid",
            RC.shoe,
            lowerLegBone,
          ); // sepatu
          add(
            charIndex,
            mesh(box(0.19, 0.035, 0.36)),
            m4.T(legX, 0.022, 0.06),
            "box",
            RC.sole,
            lowerLegBone,
          ); // sol
          add(
            charIndex,
            mesh(cylinder(0.05, 16)),
            seg([legX, 0.12, 0.03], [legX, 0.55, 0]),
            "cylinder",
            RC.skin,
            lowerLegBone,
          ); // betis
          add(
            charIndex,
            mesh(ellipsoid(0.07, 0.07, 0.07, 18, 12)),
            m4.T(legX, 0.55, 0),
            "ellipsoid",
            RC.skin,
            upperLegBone,
          ); // sendi lutut
          add(
            charIndex,
            mesh(ellipsoid(0.115, 0.115, 0.115, 18, 12)),
            m4.T(legX, 0.95, -0.01),
            "ellipsoid",
            RC.pants,
            upperLegBone,
          ); // sendi pinggul
          add(
            charIndex,
            mesh(pantsTexture(0.095, 0.115, 10, 24)),
            seg([legX, 0.42, 0], [legX, 0.98, -0.02]),
            "cone",
            RC.pants,
            upperLegBone,
          ); // celana bertekstur
          add(
            charIndex,
            mesh(ragged(0.097, 0.09)),
            m4.T(legX, 0.42, 0),
            "tri",
            RC.pants,
            upperLegBone,
          );
          if (s > 0) {
            // potongan celana terpisah jatuh di atas pergelangan kaki kanan
            add(
              charIndex,
              mesh(pantsTexture(0.085, 0.075, 6, 20)),
              seg([legX, 0.13, 0.02], [legX, 0.26, 0.01]),
              "cone",
              RC.pants, lowerLegBone,
            );
            add(
              charIndex,
              mesh(ragged(0.087, 0.045)),
              m4.T(legX, 0.13, 0.02),
              "tri",
              RC.pants, lowerLegBone,
            );
            add(
              charIndex,
              mesh(ragged(0.077, 0.045)),
              M(m4.T(legX, 0.26, 0.01), m4.X(Math.PI)),
              "tri",
              RC.pants, lowerLegBone,
            );
          }
        }

        // pinggul celana
        add(
          charIndex,
          mesh(texturedEllipsoid(0.22, 0.14, 0.16, 28, 18)),
          m4.T(0, 0.98, -0.02),
          "ellipsoid",
          RC.pants,
        );

        // sabuk dan gesper
        const beltM = M(m4.T(0, 1.08, 0.02), m4.X(0.1));
        add(
          charIndex,
          mesh(ellipsoid(0.24, 0.04, 0.2, 24, 12)),
          beltM,
          "ellipsoid",
          "#2b2520",
        ); // sabuk kulit gelap
        add(
          charIndex,
          mesh(box(0.08, 0.06, 0.015)),
          M(m4.T(0, 1.05, 0.22), m4.X(0.1)),
          "box",
          "#4d4d4d",
        ); // gesper emas

        const bodyMatrix = M(m4.T(0, 1.26, 0.1), m4.X(0.55));
        add(
          charIndex,
          mesh(ellipsoid(0.24, 0.4, 0.2)),
          bodyMatrix,
          "ellipsoid",
          RC.shirt,
        ); // badan
        add(
          charIndex,
          mesh(jacket(0.26, 0.43, 0.22, 0.42, 0.35, 2.5)),
          bodyMatrix,
          "tri",
          RC.coat,
        ); // jas
        // kantong jas
        add(
          charIndex,
          mesh(box(0.07, 0.06, 0.01)),
          M(bodyMatrix, m4.T(0.14, -0.17, 0.188), m4.X(-0.05), m4.Y(0.15)),
          "box",
          RC.coat,
        );
        add(
          charIndex,
          mesh(box(0.07, 0.06, 0.01)),
          M(bodyMatrix, m4.T(-0.14, -0.17, 0.188), m4.X(-0.05), m4.Y(-0.15)),
          "box",
          RC.coat,
        );

        const lap = mesh(
          prism(
            [
              [0, 0],
              [0.1, 0.04],
              [0.015, -0.3],
            ],
            0.02,
          ),
        );
        add(
          charIndex,
          mesh(ellipsoid(0.015, 0.015, 0.01, 10, 8)),
          M(bodyMatrix, m4.T(-0.15, 0.15, 0.18), m4.X(-0.05)),
          "ellipsoid",
          "#111111",
        );
        add(
          charIndex,
          mesh(ellipsoid(0.015, 0.015, 0.01, 10, 8)),
          M(bodyMatrix, m4.T(-0.15, 0.07, 0.2), m4.X(-0.05)),
          "ellipsoid",
          "#111111",
        );
        add(
          charIndex,
          mesh(ellipsoid(0.015, 0.015, 0.01, 10, 8)),
          M(bodyMatrix, m4.T(-0.15, -0.03, 0.2), m4.X(-0.05)),
          "ellipsoid",
          "#111111",
        );
        // Z dinaikkan ke 0.14 agar tidak tenggelam di dada atas
        add(
          charIndex,
          lap,
          M(bodyMatrix, m4.T(0.045, 0.37, 0.14), m4.Y(0.55), m4.X(-0.15)),
          "tri",
          RC.coat,
        ); // kerah kanan
        add(
          charIndex,
          lap,
          M(
            bodyMatrix,
            m4.T(-0.045, 0.37, 0.14),
            m4.Y(-0.55),
            m4.X(-0.15),
            m4.S(-1, 1, 1),
          ),
          "tri",
          RC.coat,
        ); // kerah kiri

        // Dasi dinaikkan Z-nya dan dimiringkan lebih tajam (X=-0.35)
        // Ini memastikan garis lurus dasi benar-benar melangkahi perut elips yang cembung (tidak menembus di tengah)
        // 1. Simpul dasi
        add(
          charIndex,
          mesh(
            prism(
              [
                [0, 0.02],
                [0.035, 0.01],
                [0.025, -0.04],
                [-0.025, -0.04],
                [-0.035, 0.01],
              ],
              0.024,
            ),
          ),
          M(bodyMatrix, m4.T(0, 0.37, 0.15), m4.X(-0.1)),
          "tri",
          RC.tie,
        );
        // 2. Badan dasi
        add(
          charIndex,
          mesh(
            prism(
              [
                [0, 0],
                [0.025, 0],
                [0.06, -0.32],
                [0, -0.42],
                [-0.06, -0.32],
                [-0.025, 0],
              ],
              0.02,
            ),
          ),
          M(bodyMatrix, m4.T(0, 0.35, 0.14), m4.X(-0.35)),
          "tri",
          RC.tie,
        );
        for (let i = 1; i <= 4; i++) {
          const yLocal = -i * 0.07;
          const wHalf = 0.025 + 0.035 * (-yLocal / 0.32);
          add(
            charIndex,
            mesh(box(wHalf * 2 * 1.05, 0.008, 0.002)),
            M(
              bodyMatrix,
              m4.T(0, 0.35, 0.14),
              m4.X(-0.35),
              m4.T(0, yLocal, 0.011),
              m4.Z(-0.35),
            ),
            "box",
            "#ffffff",
          );
        }
        add(
          charIndex,
          mesh(cylinder(0.07, 16)),
          seg([0, 1.55, 0.28], [0, 1.66, 0.42]),
          "cylinder",
          RC.skinD,
        ); // leher
        add(
          charIndex,
          mesh(texturedEllipsoid(0.3, 0.32, 0.29, 36, 24, "skin")),
          m4.T(0, 1.85, 0.5),
          "ellipsoid",
          RC.skin,
          "head",
        ); // kepala (bertekstur)
        add(
          charIndex,
          mesh(ellipsoid(0.105, 0.105, 0.09)),
          m4.T(0.13, 1.91, 0.73),
          "ellipsoid",
          RC.eye,
          "eyeR",
        ); // mata besar
        add(
          charIndex,
          mesh(ellipsoid(0.08, 0.08, 0.07)),
          m4.T(-0.13, 1.9, 0.73),
          "ellipsoid",
          RC.eye,
          "eyeL",
        ); // mata kecil
        add(
          charIndex,
          mesh(ellipsoid(0.026, 0.026, 0.02, 14, 10)),
          m4.T(0.13, 1.91, 0.82),
          "ellipsoid",
          RC.black,
          "eyeR",
        );
        add(
          charIndex,
          mesh(ellipsoid(0.022, 0.022, 0.018, 14, 10)),
          m4.T(-0.13, 1.9, 0.795),
          "ellipsoid",
          RC.black,
          "eyeL",
        );
        // --- fungsi pembuat urat tipis ---
        function makeVeins(cx, cy, cz, r, bone, numVeins) {
          const veinM = mesh(cylinder(0.0002, 6));
          for (let i = 0; i < numVeins; i++) {
            // mulai dari belakang mata (z negatif)
            let phi = Math.random() * Math.PI * 2;
            let theta = Math.PI - 0.2; // dekat kutub belakang
            let p1 = [
              cx + r * Math.sin(theta) * Math.cos(phi),
              cy + r * Math.sin(theta) * Math.sin(phi),
              cz + r * Math.cos(theta),
            ];

            // buat 3 ruas per urat agar sedikit berbelok-belok maju ke depan
            for (let j = 0; j < 5; j++) {
              theta -= 0.3 + Math.random() * 0.3; // maju ke depan (theta mengecil)
              phi += (Math.random() - 0.5) * 0.8; // belok kiri/kanan acak
              if (theta < Math.PI / 4.5) break; // jangan sampai nutupi pupil hitam di depan
              let p2 = [
                cx + (r + 0.001) * Math.sin(theta) * Math.cos(phi),
                cy + (r + 0.001) * Math.sin(theta) * Math.sin(phi),
                cz + (r + 0.001) * Math.cos(theta),
              ];
              add(charIndex, veinM, seg(p1, p2), "cylinder", "#aa1111", bone);
              p1 = p2;
            }
          }
        }
        makeVeins(0.13, 1.91, 0.73, 0.105, "eyeR", 35);
        makeVeins(-0.13, 1.9, 0.73, 0.08, "eyeL", 25);
        // ---------------------------------
        // hidung (lubang hidung oval miring) - posisinya ditarik maju (Z) dan sedikit ditebalkan agar tidak tenggelam oleh tekstur kepala
        add(
          charIndex,
          mesh(ellipsoid(0.014, 0.028, 0.006, 12, 8)),
          M(m4.T(0.04, 1.815, 0.789), m4.Z(0.2)),
          "ellipsoid",
          RC.nostril,
          "head",
        );
        add(
          charIndex,
          mesh(ellipsoid(0.014, 0.028, 0.006, 12, 8)),
          M(m4.T(-0.04, 1.81, 0.789), m4.Z(-0.9)),
          "ellipsoid",
          RC.nostril,
          "head",
        );
        // --- STRUKTUR RAHANG (MANDIBULA) ---
        // Menggunakan bentuk tabung yang disapu di sepanjang kurva Bezier agar membentuk
        // satu kesatuan rahang huruf-U yang mulus dan bersih, tanpa benjolan-benjolan ellipsoid.
        const jawCurve = [
          [-0.2, 1.72, 0.55], // Titik awal (engsel rahang kiri)
          [-0.15, 1.53, 0.83], // Titik kontrol (lengkung dagu kiri depan)
          [0.15, 1.53, 0.83], // Titik kontrol (lengkung dagu kanan depan)
          [0.2, 1.72, 0.55], // Titik akhir (engsel rahang kanan)
        ];
        // rf (ketebalan) disesuaikan agar proporsional dengan kepala (tidak terlalu tebal)
        add(
          charIndex,
          mesh(
            tube(
              (t) => bz(jawCurve, t),
              (t) => 0.035 + 0.015 * Math.sin(t * Math.PI),
              24,
              14,
            ),
          ),
          m4.I(),
          "curve",
          RC.skin,
          "jaw",
        );
        // Isi/otot bawah dagu (submental area) untuk menyambungkan dasar rahang ke leher
        add(
          charIndex,
          mesh(ellipsoid(0.16, 0.035, 0.14, 18, 12)),
          M(m4.T(0, 1.64, 0.66), m4.X(0.55)),
          "ellipsoid",
          RC.skinD,
          "jaw",
        );
        // ------------------------------------------
        add(
          charIndex,
          mesh(curvedEllipsoid(0.13, 0.015, 0.025, -0.03, -0.04)),
          m4.T(0, 1.745, 0.795),
          "ellipsoid",
          RC.lip,
          "head",
        ); // bibir atas (menonjol keluar dari wajah, warnanya beda dari kulit)
        add(
          charIndex,
          mesh(curvedEllipsoid(0.145, 0.018, 0.03, 0.04, -0.06)),
          m4.T(0, 1.66, 0.798),
          "ellipsoid",
          RC.lip,
          "jaw",
        ); // bibir bawah (ikut rahang, lebih tebal dari bibir atas)
        // rongga mulut ditebalkan (rz) dan ditarik masuk (Z dikurangi)
        // agar saling memotong dengan bola kepala/rahang sehingga membentuk kurva lekukan lubang yang menyatu
        add(
          charIndex,
          mesh(ellipsoid(0.155, 0.13, 0.11, 32, 18)),
          m4.T(0, 1.688, 0.67),
          "ellipsoid",
          RC.mouthCav,
          "head",
        ); // rongga mulut oval, merah tuaf
        add(
          charIndex,
          mesh(ellipsoid(0.075, 0.028, 0.05, 20, 10)),
          m4.T(0, 1.652, 0.67),
          "ellipsoid",
          RC.tongue,
          "jaw",
        ); // lidah ditarik masuk sedikit mengikuti rongga
        // gigi — dibuat tidak rata (snaggletooth): tiap gigi beda ukuran, beda kedalaman, & sedikit miring (rotasi Z),
        // gigi atas menempel ke kepala (diam), gigi bawah menempel ke rahang (ikut buka-tutup)
        const upperTeeth = [
          //{x:-.115,z:.795,w:.032,h:.05, d:.026,r:.18},
          //{x:-.068,z:.815,w:.036,h:.036,d:.028,r:-.06},
          { x: -0.022, z: 0.825, w: 0.034, h: 0.055, d: 0.03, r: 0.08 },
          //{x:.028, z:.82, w:.032,h:.032,d:.027,r:-.1},
          //{x:.075, z:.805,w:.035,h:.048,d:.027,r:.12},
          { x: 0.118, z: 0.785, w: 0.03, h: 0.034, d: 0.024, r: -0.16 },
        ];
        for (const t of upperTeeth)
          add(
            charIndex,
            mesh(box(t.w, t.h, t.d)),
            M(m4.T(t.x, 1.726 - t.h / 2, t.z), m4.Z(t.r)),
            "box",
            RC.tooth,
            "head",
          );
        const lowerTeeth = [
          //{x:-.125,z:.78, w:.03, h:.038,d:.024,r:-.12},
          { x: -0.078, z: 0.805, w: 0.034, h: 0.055, d: 0.028, r: 0.1 },
          { x: -0.03, z: 0.818, w: 0.03, h: 0.03, d: 0.026, r: -0.05 },
          //{x:.02,  z:.822,w:.036,h:.05, d:.029,r:.09},
          { x: 0.07, z: 0.802, w: 0.032, h: 0.034, d: 0.026, r: -0.14 },
          { x: 0.115, z: 0.782, w: 0.029, h: 0.044, d: 0.023, r: 0.15 },
        ];
        for (const t of lowerTeeth)
          add(
            charIndex,
            mesh(box(t.w, t.h, t.d)),
            M(m4.T(t.x, 1.686 + t.h / 2, t.z), m4.Z(t.r)),
            "box",
            RC.tooth,
            "jaw",
          );
        // add(charIndex,mesh(ellipsoid(.125,.016,.045)),m4.T(0,1.682,.75),"ellipsoid",RC.gum,"jaw");      // gusi bawah, di tepi oval (antara oval & pangkal gigi)
        // add(charIndex,mesh(ellipsoid(.125,.016,.045)),m4.T(0,1.722,.75),"ellipsoid",RC.gum,"head");    // gusi atas, di tepi oval (tetap di kepala)
        const hairData = [
          // [x, z, dx (arah ujung), dy_extra (panjang)]
          [-0.2, 0.45, 0.1, 0.02],
          [-0.15, 0.47, 0.12, 0.0],
          // [-0.10, 0.42, -0.08,  0.01],
          // [-0.05, 0.49,  0.09, -0.02],
          [0.0, 0.44, -0.1, 0.04],
          // [ 0.05, 0.48,  0.09, -0.01],
          [0.1, 0.41, 0.11, 0.02],
          [0.15, 0.47, -0.09, 0.01],
          // [ 0.20, 0.43,  0.13, -0.03],
          // [ 0.25, 0.46,  0.08,  0.02]
        ];
        {
          let hi = 0;
          for (const [x, z, dx, dy_extra] of hairData) {
            const y =
              1.85 +
              0.32 *
                Math.sqrt(
                  Math.max(0, 1 - (x / 0.3) ** 2 - ((z - 0.5) / 0.29) ** 2),
                );
            const dy = y - 2.15 + dy_extra;

            const HP = [
              [x, y, z],
              [x + 0.02, 2.25 + dy, z - 0.02],
              [x + dx, 2.25 + dy, z - 0.08],
              [x + dx - 0.02, 2.1 + dy, z - 0.15],
            ];
            add(
              charIndex,
              mesh(
                tube(
                  (t) => bz(HP, t),
                  (t) => 0.003 - 0.002 * t,
                  18,
                  6,
                ),
              ),
              m4.I(),
              "curve",
              RC.hair,
              "hair" + hi,
            );
            hi++;
          }
        } // rambut (kurva 3D, tiap helai bergoyang beda fase

        // Kerutan dahi (3 garis membentang horizontal bertumpuk, dikembalikan seperti sebelumnya)
        // Ditambahkan rotasi m4.X agar elipsoidnya miring ke belakang, menyatu mulus mengikuti profil kemiringan dahi
        add(
          charIndex,
          mesh(ellipsoid(0.11, 0.0001, 0.035, 10, 10)),
          M(m4.T(0, 2.02, 0.72), m4.X(-0.4)),
          "ellipsoid",
          RC.nostril,
          "head",
        );
        add(
          charIndex,
          mesh(ellipsoid(0.09, 0.0001, 0.03, 10, 10)),
          M(m4.T(0, 2.06, 0.69), m4.X(-0.6)),
          "ellipsoid",
          RC.nostril,
          "head",
        );
        // add(charIndex,mesh(ellipsoid(.04,.0001,.02,10,10)),M(m4.T(0,2.10,.65),m4.X(-.8)),"ellipsoid",RC.nostril,"head");

        const shoulderM = mesh(ellipsoid(0.1, 0.11, 0.1, 18, 12));
        for (const s of [-1, 1]) {
          const Sh = [s * 0.26, 1.47, 0.29],
            S = Sh,
            E = [s * 0.32, 1.35, 0.65],
            W = [s * 0.28, 1.3, 0.92];
          const up = s < 0 ? "armL_upper" : "armR_upper",
            lo = s < 0 ? "armL_lower" : "armR_lower";
          add(charIndex, shoulderM, m4.T(...Sh), "ellipsoid", RC.coat, up); // sendi bahu — sambungan lengan ke badan
          add(
            charIndex,
            mesh(frustum(0.088, 0.066, 18, false)),
            seg(S, E),
            "cone",
            RC.coat,
            up,
          ); // lengan jas atas
          add(
            charIndex,
            mesh(ellipsoid(0.068, 0.068, 0.068, 16, 12)),
            m4.T(...E),
            "ellipsoid",
            RC.coat,
            lo,
          ); // sendi siku
          add(
            charIndex,
            mesh(frustum(0.066, 0.052, 18, false)),
            seg(E, W),
            "cone",
            RC.coat,
            lo,
          ); // lengan jas bawah
          add(
            charIndex,
            mesh(ellipsoid(0.072, 0.015, 0.072, 16, 8)),
            M(seg(S, E), m4.T(0, 0.2, 0), m4.X(0.2)),
            "ellipsoid",
            RC.coat,
            up,
          );
          add(
            charIndex,
            mesh(ellipsoid(0.074, 0.015, 0.074, 16, 8)),
            M(seg(S, E), m4.T(0, -0.1, 0), m4.X(-0.1)),
            "ellipsoid",
            RC.coat,
            up,
          );
          add(
            charIndex,
            mesh(ellipsoid(0.062, 0.015, 0.062, 16, 8)),
            M(seg(E, W), m4.T(0, 0.1, 0), m4.Z(0.15)),
            "ellipsoid",
            RC.coat,
            lo,
          );
          const Wh = [W[0], W[1] + 0.05, W[2]]; // Geser base koordinat tangan ke atas (masuk ke dalam jas)
          add(
            charIndex,
            mesh(ellipsoid(0.07, 0.085, 0.045, 18, 12)),
            m4.T(Wh[0], Wh[1] - 0.08, Wh[2] + 0.01),
            "ellipsoid",
            RC.skin, lo, ); // telapak tangan
          const buildFinger = (
            dx,
            dy,
            dz,
            length1,
            length2,
            curveZ,
            curveX,
            isThumb = false,
          ) => {
            // Sekarang cX dan cZ langsung mengontrol arah jari, termasuk jempol!
            const tX1 = curveX;
            const tZ1 = curveZ;
            // Rasio tekukan ruas kedua (jempol sedikit berbeda dari jari lain agar tidak terlalu melengkung ke belakang)
            const tX2 = isThumb ? curveX * 0.7 : curveX * 0.5;
            const tZ2 = isThumb ? curveZ : curveZ - length2 * 0.6;

            const J0 = [Wh[0] + dx, Wh[1] + dy, Wh[2] + dz];
            const J1 = [J0[0] + tX1, J0[1] - length1, J0[2] + tZ1];
            const J2 = [J1[0] + tX2, J1[1] - length2 * 0.8, J1[2] + tZ2],
              r = 0.015;

            add(
              charIndex,
              mesh(cylinder(r, 10)),
              seg(J0, J1),
              "cylinder",
              RC.skin,
              lo,
            ); // ruas atas
            add(
              charIndex,
              mesh(ellipsoid(r, r, r, 10, 8)),
              m4.T(...J1),
              "ellipsoid",
              RC.skin,
              lo,
            ); // sendi tengah (knuckle)
            add(
              charIndex,
              mesh(cylinder(r * 0.85, 10)),
              seg(J1, J2),
              "cylinder",
              RC.skin,
              lo,
            ); // ruas bawah
            add(
              charIndex,
              mesh(ellipsoid(r * 0.85, r * 0.85, r * 0.85, 10, 8)),
              m4.T(...J2),
              "ellipsoid",
              RC.skin,
              lo,
            ); // ujung jari

            // Kuku: Posisikan di sisi luar jempol (menjauhi telapak) agar tidak tersembunyi
            const nailM = isThumb
              ? M(
                  m4.T(J2[0] - s * r * 0.75, J2[1] - 0.002, J2[2]),
                  m4.Y(-s * 1.4),
                )
              : M(m4.T(J2[0], J2[1] - 0.003, J2[2] + r * 0.75), m4.X(0.2));
            add(
              charIndex,
              mesh(ellipsoid(r * 0.6, r * 0.7, r * 0.15, 12, 8)),
              nailM,
              "ellipsoid",
              "#e8d9c1",
              lo,
            );
          };
          // Jika Anda ingin mengubah arah menunjuknya jempol, silakan ubah dua angka sebelum 'true' di bawah ini:
          // (0 adalah cZ / arah depan-belakang, s*-.035 adalah cX / arah samping)
          buildFinger(
            s * -0.035,
            -0.11,
            0.025,
            0.015,
            0.018,
            0,
            s * -0.035,
            true,
          ); // Jempol (lebih dekat, lebih pendek)
          buildFinger(s * -0.025, -0.13, 0.03, 0.04, 0.035, 0.03, s * 0.005); // Telunjuk
          buildFinger(s * 0.005, -0.135, 0.035, 0.045, 0.04, 0.02, 0); // Tengah
          buildFinger(s * 0.035, -0.125, 0.03, 0.04, 0.035, 0.01, s * -0.005); // Manis
          buildFinger(s * 0.042, -0.11, 0.02, 0.025, 0.02, 0, s * 0.025); // Kelingking (sangat mepet, lebih pendek)
        }
      })();

      /* posisi & arah karakter di panggung */
      
      

      
getBone("root").setup(gl);
  const discM = ellipsoid(1.05, 0.02, 1.05, 40, 6);
  const discPart = new ZombiePart(gl, discM, m4.I(), [0,0,0], "ellipsoid", [0,0,0], 0, 0);
  discPart.setup();


      // SEED acak tiap kali halaman dibuka, supaya fase animasi (goyang, kedip, twitch) selalu sedikit berbeda
      const SEED = Math.random() * 1000;

      /**
       * pivotRot: Melakukan rotasi objek terhadap titik tumpu tertentu (pivot point) di ruang 3D.
       * Formula: Translasi(+pivot) * Rotasi * Translasi(-pivot)
       * @param {Array<number>} p - Titik tumpu engsel sendi [px, py, pz]
       * @param {Array<number>} Rm - Matriks rotasi yang ingin diterapkan
       * @returns {Array<number>} Matriks transformasi gabungan
       */
      function pivotRot(p, Rm) {
        return M(m4.T(p[0], p[1], p[2]), Rm, m4.T(-p[0], -p[1], -p[2]));
      }

      // hash1: pseudo-random [0,1) dari sebuah angka — dipakai supaya twitch/kedip tidak terasa berulang identik
      function hash1(n) {
        const s = Math.sin(n) * 43758.5453;
        return s - Math.floor(s);
      }

      // amplop sentakan singkat & acak setiap `period` detik (dipakai utk twitch kepala/lengan)
      function twitchEnv(t, period, seedOff) {
        const st = t + seedOff,
          cyc = Math.floor(st / period),
          localT = st - cyc * period,
          dur = 0.16;
        const rnd = hash1(cyc * 13.71 + seedOff * 3.13);
        if (localT > dur) return 0;
        return Math.sin((Math.PI * localT) / dur) * (0.35 + 0.65 * rnd);
      }

      // amplop kedip mata: acak apakah berkedip di siklus ini, lalu tutup-buka cepat
      function blinkEnv(t, seedOff) {
        const period = 3.1,
          st = t + seedOff,
          cyc = Math.floor(st / period),
          localT = st - cyc * period,
          dur = 0.14;
        const willBlink = hash1(cyc * 5.21 + seedOff) > 0.55;
        if (!willBlink || localT > dur) return 1;
        return 1 - Math.sin((Math.PI * localT) / dur) * 0.92;
      }

  /**
   * animWraps: Menghitung pose matriks animasi seluruh sendi kerangka berdasarkan waktu dan kondisi.
   * Mengatur animasi idle (napas, goyangan), jalan kaki (walk), kedipan mata, dan pose bangkit.
   * @param {number} T - Waktu berjalan animasi (detik)
   * @param {number} walkTime - Waktu siklus langkah berjalan
   * @param {boolean} isWalking - Status apakah zombie sedang melangkah
   * @param {number} riseProgress - Progress animasi bangkit dari kubur (0.0 = tertidur di bawah tanah, 1.0 = tegak)
   * @returns {Object} Kumpulan matriks pembungkus pose untuk tiap sendi
   */
  function animWraps(T, walkTime = 0, isWalking = false, riseProgress = 1) {
    // (1) TRANSLATE + (3) SCALING — napas zombie: ritme asimetris
    const breathe = Math.sin(T * 1.6) + 0.4 * Math.sin(T * 3.7 + 1);
    const bob = animOn ? breathe * 0.025 : 0;
    const pulse = animOn ? 1 + breathe * 0.014 : 1;

    // goyang badan (sway) + membungkuk
    const waistPivot = [0, 1.02, 0.15];
    const swayAngle = animOn ? Math.sin(T * 0.5 + SEED * 2) * 0.05 : 0;
    const hunch = animOn ? 0.05 + Math.sin(T * 0.5 + SEED * 2) * 0.018 : 0;
    const postureWrap = pivotRot(
      waistPivot,
      M(m4.X(hunch), m4.Z(swayAngle))
    );

    // Langkah bobbing saat berjalan
    const walkBob = (isWalking && animOn) ? Math.abs(Math.sin(walkTime * 4.2)) * 0.06 : 0;
    const idleWrap = M(
      m4.T(0, bob + walkBob, Math.sin(T * 0.8) * 0.02),
      postureWrap,
      m4.S(pulse, pulse, pulse)
    );

    // (2) ROTATE — kepala menoleh kiri-kanan + tilt
    const headPivot = [0, 1.72, 0.42];
    const headStep = Math.floor(T * 1.7) / 1.7;
    let headAngle = animOn ? Math.sin(T * 0.8) * 0.35 : 0;
    let headTilt = animOn
      ? Math.sin(headStep * 0.9 + SEED * 5) * 0.05 +
        twitchEnv(T, 4.4, SEED * 11) * 0.16
      : 0;

    // Saat bangkit dari kubur, kepala mendongak ke atas
    if (riseProgress < 1.0) {
      const riseHead = -0.45 * (1.0 - riseProgress);
      headTilt += riseHead;
    }

    const headWrap = pivotRot(
      headPivot,
      M(m4.Y(headAngle), m4.Z(headTilt))
    );

    // (4) ROTASI RAHANG — engsel rahang (mandibular pivot) tepat di pertemuan pangkal rahang & kepala [0, 1.72, 0.55]
    const jawPivot = [0, 1.72, 0.55]; // titik tumpu engsel rahang sesuai titik awal/akhir jawCurve
    const jawBase = 0.12; // mulut sedikit terbuka saat diam agar gigi & rongga mulut terlihat rapi
    const jawSwing = animOn ? ((1 - Math.cos(T * 2.2)) / 2) * 0.45 : 0;
    const jawAngle = jawBase + jawSwing;
    const jawAxis = [1, 0, 0]; // sumbu engsel horizontal rapi (seperti mekanisme pvz-webgl)
    const jawWrap = pivotRot(jawPivot, axisRot(jawAxis, jawAngle));

    // (5) HIERARCHICAL TRANSFORMATION — lengan berayun (bahu -> siku)
    function armWrap(s, o) {
      const shPivot = [s * 0.26, 1.47, 0.29];
      let shAngle = animOn ? Math.sin(T * o.freq + o.phase) * o.amp : 0;
      shAngle += animOn ? twitchEnv(T, o.twPeriod, o.twSeed) * o.twAmp : 0;

      // Ayunan langkah saat berjalan
      if (isWalking && animOn) {
        const walkArmAngle = Math.sin(walkTime * 4.2 + (s < 0 ? Math.PI : 0)) * 0.55;
        shAngle = shAngle * 0.3 + walkArmAngle;
      }

      // Saat bangkit, kedua lengan terentang ke atas
      if (riseProgress < 1.0) {
        shAngle += -1.25 * (1.0 - riseProgress);
      }

      const shWrap = pivotRot(shPivot, m4.X(shAngle));
      const elPivot = [s * 0.32, 1.35, 0.65];
      let elAngle = animOn
        ? o.loose + Math.sin(T * o.freq + o.phase + 1) * o.elAmp
        : 0;

      if (isWalking && animOn) {
        elAngle += 0.2 + Math.max(0, Math.sin(walkTime * 4.2 + (s < 0 ? Math.PI : 0))) * 0.35;
      }

      const elWrap = pivotRot(elPivot, m4.X(elAngle));
      return { shWrap, elWrap };
    }

    const armL = armWrap(-1, {
      freq: 1.35,
      phase: 0,
      amp: 0.5,
      elAmp: 0.25,
      loose: 0.32,
      twPeriod: 5.2,
      twSeed: SEED * 7 + 10,
      twAmp: 0.4,
    });
    const armR = armWrap(1, {
      freq: 1.05,
      phase: Math.PI * 0.6,
      amp: 0.3,
      elAmp: 0.16,
      loose: 0.14,
      twPeriod: 3.7,
      twSeed: SEED * 17 + 90,
      twAmp: 0.22,
    });

    // Kaki: pinggul dan lutut terpisah
    function legWrap(s, phase, hipBase, kneeBase) {
      const hipPivot = [s * 0.13, 0.95, -0.01];
      let hipAngle =
        hipBase + (animOn ? Math.sin(T * 1.35 + phase) * 0.055 : 0);

      const kneePivot = [s * 0.13, 0.55, 0];
      let kneeAngle =
        kneeBase + (animOn ? Math.sin(T * 1.35 + phase) * 0.03 : 0);

      // Langkah berjalan penuh
      if (isWalking && animOn) {
        const walkLegPhase = walkTime * 4.2 + (s < 0 ? 0 : Math.PI);
        const walkHip = Math.sin(walkLegPhase) * 0.65;
        const walkKnee = Math.max(0, -Math.sin(walkLegPhase)) * 0.85 + 0.1;
        hipAngle = hipAngle * 0.15 + walkHip;
        kneeAngle = kneeAngle * 0.15 + walkKnee;
      }

      const hipWrap = pivotRot(hipPivot, m4.X(hipAngle));
      const kneeWrap = pivotRot(kneePivot, m4.X(kneeAngle));
      return { hipWrap, kneeWrap };
    }

    const legL = legWrap(-1, 0, -0.35, 0.45);
    const legR = legWrap(1, Math.PI, 0.1, 0.15);

    function hairWrap(idx) {
      const pivot = [0, 2.2, 0.4];
      return pivotRot(
        pivot,
        m4.Z(animOn ? Math.sin(T * 2.1 + idx * 2.1 + SEED * 4) * 0.05 : 0)
      );
    }
    const hair = Array.from({ length: 10 }, (_, i) => hairWrap(i));
    const blink = animOn ? blinkEnv(T, SEED * 13) : 1;

    return {
      idleWrap,
      headWrap,
      jawWrap,
      armL,
      armR,
      legL,
      legR,
      hair,
      blink,
    };
  }


  /**
   * update: Memperbarui kondisi animasi dan matriks lokal setiap tulang kerangka zombie per frame.
   * @param {number} dt - Delta waktu sejak frame sebelumnya (detik)
   * @param {Object} state - Status kontrol zombie { animOn, explode, real, isWalking, walkTime, riseProgress }
   */
  function update(dt, state = {}) {
    animOn = state.animOn !== undefined ? state.animOn : true;
    if (animOn) animT += dt;
    explode = state.explode !== undefined ? state.explode : 0;
    real = state.real !== undefined ? state.real : true;

    const isWalking = !!state.isWalking;
    const walkTime = state.walkTime || 0;
    const riseProgress = state.riseProgress !== undefined ? state.riseProgress : 1.0;

    // Hitung pose semua tulang
    const A = animWraps(animT, walkTime, isWalking, riseProgress);
    getBone("root").animMatrix = ROOT[0];
    getBone("body").animMatrix = A.idleWrap;
    getBone("head").animMatrix = A.headWrap;
    getBone("jaw").animMatrix = A.jawWrap;
    for (let i = 0; i < 10; i++) getBone("hair" + i).animMatrix = A.hair[i];
    getBone("eyeL").animMatrix = M(m4.T(0, 1.9, 0), m4.S(1, A.blink, 1), m4.T(0, -1.9, 0));
    getBone("eyeR").animMatrix = M(m4.T(0, 1.91, 0), m4.S(1, A.blink, 1), m4.T(0, -1.91, 0));
    getBone("armL_upper").animMatrix = A.armL.shWrap;
    getBone("armL_lower").animMatrix = A.armL.elWrap;
    getBone("armR_upper").animMatrix = A.armR.shWrap;
    getBone("armR_lower").animMatrix = A.armR.elWrap;
    getBone("legL_upper").animMatrix = A.legL.hipWrap;
    getBone("legL_lower").animMatrix = A.legL.kneeWrap;
    getBone("legR_upper").animMatrix = A.legR.hipWrap;
    getBone("legR_lower").animMatrix = A.legR.kneeWrap;
  }

  /**
   * Render karakter zombie di posisi dunia
   * 5. HIERARCHICAL TRANSFORMATION:
   * parentWorldWrap mewariskan transformasi dari root world matrix ke setiap tulang
   */
  function render(Pr, V, parentWorldWrap, eye, options = {}) {
    gl.useProgram(pr);

    // Pastikan default VAO aktif agar buffer binding zombie tidak mengganggu VAO graveyard
    gl.bindVertexArray(null);

    gl.uniformMatrix4fv(U.uPr, false, new Float32Array(Pr));
    gl.uniformMatrix4fv(U.uV, false, new Float32Array(V));
    gl.uniform3fv(U.uL, LIGHT_DIR);
    gl.uniform3fv(U.uE, eye);
    gl.uniformMatrix4fv(U.uLM, false, new Float32Array(LIGHT_M));
    gl.uniform1f(U.uShOn, 0); // Shadow pass internal dinonaktifkan di scene gabungan
    gl.uniform1f(U.uGnd, 0);

    // Gambar pohon tulang zombie hierarkis
    getBone("root").render(gl, parentWorldWrap, U, explode, real, TYPES);
  }

  return {
    update,
    render,
    bones,
    TYPES,
    ROOT,
  };
}
