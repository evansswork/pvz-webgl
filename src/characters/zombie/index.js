/**
 * ==============================================================================
 * ZOMBIE — shader + update + render (dipakai scene utama lewat main.js)
 * ==============================================================================
 * Model  : model.js      (pohon tulang & bagian tubuh)
 * Animasi: animation.js  (pose per frame)
 * Tulang : ZombieNode.js (BoneNode & ZombiePart)
 * ==============================================================================
 */
import { buildZombie } from "./model.js";
import { makeZombieAnimator, applyZombiePose } from "./animation.js";

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
         - Wrap diffuse (terminator lembut seperti kulit)
         - Hemisphere ambient (langit dingin di atas, pantulan lantai hangat di bawah)
         - Ambient occlusion kontak (dekat lantai lebih gelap)
         - Blinn-Phong specular + rim light */
      const FS = PREC + `varying vec3 vN,vW;
uniform vec3 uC,uL,uE;
void main(){
  vec3 N=normalize(vN),V=normalize(uE-vW);if(dot(N,V)<0.)N=-N;vec3 L=normalize(uL);
  float ndl=dot(N,L);
  float d=max((ndl+.2)/1.2,0.);
  float f=max(dot(N,normalize(vec3(-.6,.3,.5))),0.)*.22;
  vec3 hemi=mix(vec3(.20,.18,.16),vec3(.33,.36,.40),N.y*.5+.5);
  float ao=mix(.72,1.,smoothstep(0.,.4,vW.y));
  float sp=pow(max(dot(N,normalize(L+V)),0.),32.)*.24;
  float rim=pow(1.-max(dot(N,V),0.),3.)*.18;
  vec3 sickly=vec3(-.04,.05,-.02)*(f+.1);
  vec3 col=uC*(hemi*ao+vec3(1.,.97,.92)*.85*d+f*ao)+vec3(sp)+uC*rim*ao+sickly;
  gl_FragColor=vec4(col,1.);}`;
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
  gl.useProgram(pr);

  // Pemetaan lokasi atribut dan uniform shader utama
  const aP = gl.getAttribLocation(pr, "aP");
  const aN = gl.getAttribLocation(pr, "aN");
  const U = { aP, aN };
  for (const k of ["uPr", "uV", "uM", "uNm", "uC", "uL", "uE"]) {
    U[k] = gl.getUniformLocation(pr, k);
  }

  // Arah cahaya (directional light)
  const LIGHT_DIR = [0.5, 0.9, 0.4]; // Searah dengan matahari di graveyard

  const { getBone } = buildZombie(gl);
  const animWraps = makeZombieAnimator();
  let animT = 0;

  /**
   * update: Memperbarui kondisi animasi dan matriks lokal setiap tulang kerangka zombie per frame.
   * @param {number} dt - Delta waktu sejak frame sebelumnya (detik)
   * @param {Object} state - Status jalan zombie { isWalking, walkTime }
   */
  function update(dt, state = {}) {
    animT += dt;
    const A = animWraps(animT, state.walkTime || 0, !!state.isWalking);
    applyZombiePose(getBone, A);
  }

  /**
   * Render karakter zombie di posisi dunia
   * 5. HIERARCHICAL TRANSFORMATION:
   * parentWorldWrap mewariskan transformasi dari root world matrix ke setiap tulang
   */
  function render(Pr, V, parentWorldWrap, eye) {
    gl.useProgram(pr);

    // Pastikan default VAO aktif agar buffer binding zombie tidak mengganggu VAO graveyard
    gl.bindVertexArray(null);

    gl.uniformMatrix4fv(U.uPr, false, new Float32Array(Pr));
    gl.uniformMatrix4fv(U.uV, false, new Float32Array(V));
    gl.uniform3fv(U.uL, LIGHT_DIR);
    gl.uniform3fv(U.uE, eye);

    // Gambar pohon tulang zombie hierarkis
    getBone("root").render(gl, parentWorldWrap, U);
  }

  return { update, render };
}
