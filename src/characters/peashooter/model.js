/* =========================================================================
   peashooter.js — Karakter PEASHOOTER (Plants vs. Zombies)
   Hierarki:
   root ─ body ─┬─ leaf[0..3] ─ vein[0..3]
                ├─ baseKnot
                └─ stemLower ─ stemUpper ─ neck ─┬─ collar
                                                 └─ head ─┬─ eyeL/R ─ shine
                                                          ├─ headLeaf ─ headVein
                                                          └─ snout ─┬─ snoutInner, snoutBack
                                                                    └─ lip
   Quadric : ellipsoid (kepala, mata), cylinder (penghubung batang–kepala),
             CONE terpotong (moncong luar & dalam)
   Kurva   : batang (tube Bézier), daun, daun belakang kepala
   Lain    : torus (bibir moncong)
   ========================================================================= */
import { V3, M4 } from '../../core/math.js';
import { ellipsoid, cylinder, cone, coneFrustum, torus, disc, Bezier, tube, leaf } from '../../core/geometry.js';
import { Mesh, Node, material } from '../../core/renderer.js';

export const PS_COLORS = {
  head: [0.60, 0.82, 0.27],
  lip: [0.74, 0.91, 0.38],
  inner: [0.015, 0.04, 0.012],
  eye: [0.04, 0.05, 0.03],
  stem: [0.27, 0.56, 0.20],
  leaf: [0.32, 0.64, 0.23],
  vein: [0.22, 0.47, 0.15],
  pea: [0.56, 0.80, 0.24],
};

export function buildPeashooter(gl) {
  const C = PS_COLORS;
  const M = {
    head: material(C.head, { spec: 0.6, shin: 60 }),
    lip: material(C.lip, { spec: 0.55, shin: 50, outlineW: 0.012 }),
    inner: material(C.inner, { spec: 0.0, shin: 20, outline: false, shadow: false }),
    eye: material(C.eye, { spec: 1.0, shin: 60, outlineW: 0.008 }),
    shine: material([1, 1, 1], { spec: 0, emissive: 0.5, outline: false, shadow: false }),
    stem: material(C.stem, { spec: 0.45, shin: 34 }),
    leaf: material(C.leaf, { spec: 0.35, shin: 30 }),
    vein: material(C.vein, { spec: 0.2, outline: false }),
  };
  const HEAD = { rx: 0.40, ry: 0.38, rz: 0.45 };

  const root = new Node('Peashooter');
  root.rotation = [0, Math.PI / 2, 0];        // menghadap +X (arah zombie datang)
  const body = new Node('body');
  root.add(body);

  /* ---------------- DAUN: 4 helai dari 2 kurva Bézier ---------------- */
  const leafSpecs = [
    { yaw: 0.25, length: 0.78, width: 0.33, lift: 0.17, tipDrop: -0.13 },
    { yaw: Math.PI - 0.25, length: 0.78, width: 0.33, lift: 0.17, tipDrop: -0.13 },
    { yaw: -Math.PI / 2, length: 0.7, width: 0.36, lift: 0.15, tipDrop: -0.12 },
    { yaw: Math.PI / 2 + 0.1, length: 0.7, width: 0.34, lift: 0.17, tipDrop: -0.12 },
  ];
  const leaves = leafSpecs.map((s, i) => {
    const lf = leaf(s);
    const node = new Node('leaf' + i, new Mesh(gl, lf.geo), M.leaf);
    node.position = [Math.cos(s.yaw) * 0.04, 0.13, -Math.sin(s.yaw) * 0.04];
    node.rotation = [0, s.yaw, 0];
    node.add(new Node('vein' + i, new Mesh(gl, tube(lf.vein, (t) => 0.013 * (1 - t) + 0.004, 8)), M.vein));
    body.add(node);
    return node;
  });
  const baseKnot = new Node('baseKnot', new Mesh(gl, ellipsoid(0.085, 0.07, 0.085)), M.stem);
  baseKnot.position = [0, 0.13, 0];
  body.add(baseKnot);

  /* ---------------- BATANG: 2 segmen tube mengikuti kurva Bézier 3D ----------------
     Mengecil ke atas & melengkung (S) seperti referensi tampak samping.           */
  const lowerCurve = [[0, 0, 0], [0, 0.16, -0.06], [0, 0.30, -0.08], [0, 0.44, -0.03]];
  const upperCurve = [[0, 0, 0], [0, 0.11, 0.04], [0, 0.22, 0.07], [0, 0.32, 0.03]];
  const stemLower = new Node('stemLower', new Mesh(gl, tube(Bezier.sample(lowerCurve, 24), (t) => 0.056 - 0.006 * t, 14)), M.stem);
  stemLower.position = [0, 0.11, 0];
  const stemUpper = new Node('stemUpper', new Mesh(gl, tube(Bezier.sample(upperCurve, 24), (t) => 0.05 - 0.008 * t, 14)), M.stem);
  stemUpper.position = lowerCurve[3].slice();
  body.add(stemLower);
  stemLower.add(stemUpper);

  /* ---------------- LEHER: penghubung cylinder pendek ---------------- */
  const neck = new Node('neck');
  neck.position = upperCurve[3].slice();
  stemUpper.add(neck);
  const collar = new Node('collar', new Mesh(gl, cylinder(0.078, 0.06, 24, 1)), M.stem);
  collar.position = [0, -0.01, 0];
  neck.add(collar);

  /* ---------------- KEPALA: ellipsoid memanjang ke depan ---------------- */
  const head = new Node('head', new Mesh(gl, ellipsoid(HEAD.rx, HEAD.ry, HEAD.rz, 36, 56)), M.head);
  head.position = [0, 0.04 + HEAD.ry * 0.9, -0.06];
  neck.add(head);
  const onHead = (d) => {
    const n0 = V3.norm(d);
    const k = 1 / Math.sqrt((n0[0] / HEAD.rx) ** 2 + (n0[1] / HEAD.ry) ** 2 + (n0[2] / HEAD.rz) ** 2);
    const p = V3.scale(n0, k);
    return { p, n: V3.norm([p[0] / HEAD.rx ** 2, p[1] / HEAD.ry ** 2, p[2] / HEAD.rz ** 2]) };
  };

  // Mata: ellipsoid hitam pipih menempel di permukaan kepala + kilau
  const eyeGeo = ellipsoid(0.056, 0.086, 0.03, 18, 24);
  const shineGeo = ellipsoid(0.02, 0.026, 0.01, 10, 14);
  const eyes = [-1, 1].map((sx) => {
    const { p, n } = onHead([0.62 * sx, 0.42, 0.66]);
    const e = new Node('eye', new Mesh(gl, eyeGeo), M.eye);
    e.pre = M4.facing(n, [0, 1, 0], V3.sub(p, V3.scale(n, 0.008)));
    const sh = new Node('shine', new Mesh(gl, shineGeo), M.shine);
    sh.position = [-0.016 * sx, 0.032, 0.026];
    e.add(sh);
    head.add(e);
    return e;
  });

  // Daun di belakang kepala: 2 kurva Bézier (cara sama dengan daun bawah), ujung melengkung
  const hl = leaf({ length: 0.36, width: 0.12, lift: 0.13, lift2: 0.15, tipDrop: -0.03, sag: 0.02, thick: 0.016, nt: 24, ns: 8 });
  const headLeafBase = onHead([0, 0.62, -0.78]);
  const headLeaf = new Node('headLeaf', new Mesh(gl, hl.geo), M.leaf);
  headLeaf.position = V3.sub(headLeafBase.p, V3.scale(headLeafBase.n, 0.02));
  headLeaf.rotation = [0, Math.PI / 2, 0.35];   // ke belakang (−Z) & sedikit naik
  headLeaf.add(new Node('headVein', new Mesh(gl, tube(hl.vein, (t) => 0.008 * (1 - t) + 0.003, 6)), M.vein));
  headLeaf.midrib = V3.norm([0.36, -0.03, 0]);  // arah daun kepala (pangkal → ujung), untuk engsel arbitrary axis
  head.add(headLeaf);

  // Moncong: CONE TERPOTONG (outer + inner) + dasar gelap + bibir TORUS
  const SN = { r0: 0.12, r1: 0.245, h: 0.5, wall: 0.032 };
  const snout = new Node('snout', new Mesh(gl, coneFrustum(SN.r0, SN.r1, SN.h, 40, 6)), M.head);
  snout.position = [0, 0.035, 0.30];
  snout.rotation = [Math.PI / 2, 0, 0];        // sumbu +Y cone → +Z kepala
  head.add(snout);
  const innerR = (y) => SN.r0 - SN.wall + ((SN.r1 - SN.r0) * y) / SN.h;
  const inner = new Node('snoutInner', new Mesh(gl, coneFrustum(innerR(0.14), innerR(SN.h), SN.h - 0.14, 40, 4, true)), M.inner);
  inner.position = [0, 0.14, 0];
  const back = new Node('snoutBack', new Mesh(gl, disc(innerR(0.14) + 0.004, 36)), M.inner);
  back.position = [0, 0.14, 0];
  const lip = new Node('lip', new Mesh(gl, torus(SN.r1 - SN.wall / 2, SN.wall * 0.75, 48, 14)), M.lip);
  lip.position = [0, SN.h, 0];
  snout.add(inner, back, lip);

  root.saveBase();
  return { root, body, leaves, stemLower, stemUpper, neck, head, eyes, headLeaf, headLeafNormal: headLeafBase.n, snout, lip, materials: M, SN };
}

/* ---------- Peluru kacang polong + percikan ---------- */
export function buildPeaAssets(gl) {
  return {
    pea: new Mesh(gl, ellipsoid(0.1, 0.1, 0.1, 16, 22)),
    bit: new Mesh(gl, ellipsoid(0.035, 0.035, 0.035, 8, 10)),
    mPea: material(PS_COLORS.pea, { spec: 0.7, shin: 50, outlineW: 0.012 }),
    mBit: material(PS_COLORS.pea, { spec: 0.3, outline: false, shadow: false }),
  };
}
