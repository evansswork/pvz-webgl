/* =========================================================================
   sunflower.js — Karakter SUNFLOWER (Plants vs. Zombies)
   Hierarki:
   root ─ body ─┬─ leaf[0..3] ─ vein[0..3]
                ├─ baseKnot
                └─ stemLower ─ joint ─ stemUpper ─ neck ─┬─ neckKnot
                                                         └─ face ─┬─ head, eyeL/R, shineL/R, mouth
                                                                  └─ petalRing ─ pivot[i] ─ petal[i]
   ========================================================================= */
import { V3, M4 } from '../../core/math.js';
import { ellipsoid, cylinder, paraboloidLens, Bezier, tube, leaf } from '../../core/geometry.js';
import { Mesh, Node, material } from '../../core/renderer.js';

export const SF_COLORS = {
  petalFront: [1.0, 0.83, 0.27],
  petalBack: [0.96, 0.70, 0.17],
  face: [0.84, 0.55, 0.36],
  eye: [0.04, 0.03, 0.03],
  mouth: [0.08, 0.04, 0.03],
  stem: [0.27, 0.56, 0.20],
  leaf: [0.32, 0.64, 0.23],
  vein: [0.22, 0.47, 0.15],
};

export function buildSunflower(gl) {
  const C = SF_COLORS;
  const M = {
    petalF: material(C.petalFront, { spec: 0.45, shin: 30 }),
    petalB: material(C.petalBack, { spec: 0.35, shin: 30 }),
    face: material(C.face, { spec: 0.42, shin: 70 }),
    eye: material(C.eye, { spec: 1.0, shin: 60, outlineW: 0.008 }),
    shine: material([1, 1, 1], { spec: 0, emissive: 0.5, outline: false, shadow: false }),
    mouth: material(C.mouth, { spec: 0.4, shin: 50, outlineW: 0.006 }),
    stem: material(C.stem, { spec: 0.45, shin: 34 }),
    leaf: material(C.leaf, { spec: 0.4, shin: 30 }),
    vein: material(C.vein, { spec: 0.2, outline: false }),
  };

  /* ---------------- dimensi utama ---------------- */
  const HEAD = { rx: 0.62, ry: 0.52, rz: 0.2 };
  const STEM_L = 0.62, STEM_U = 0.56;

  const root = new Node('Sunflower');
  const body = new Node('body');
  root.add(body);

  /* ---------------- DAUN: 4 helai, permukaan dari 2 kurva Bézier ---------------- */
  const leafSpecs = [
    { yaw: 0.18, length: 0.98, width: 0.27, lift: 0.17, tipDrop: -0.13 },             // kanan
    { yaw: Math.PI - 0.18, length: 0.98, width: 0.27, lift: 0.17, tipDrop: -0.13 },   // kiri
    { yaw: -Math.PI / 2 - 0.05, length: 0.68, width: 0.3, lift: 0.14, tipDrop: -0.11 }, // depan (lebar)
    { yaw: Math.PI / 2 + 0.25, length: 0.78, width: 0.25, lift: 0.18, tipDrop: -0.12 },  // belakang
  ];
  const leaves = leafSpecs.map((s, i) => {
    const lf = leaf(s);
    const node = new Node('leaf' + i, new Mesh(gl, lf.geo), M.leaf);
    node.position = [Math.cos(s.yaw) * 0.04, 0.13, -Math.sin(s.yaw) * 0.04];
    node.rotation = [0, s.yaw, 0];
    node.midrib = V3.norm([s.length, s.tipDrop, 0]);   // arah daun (pangkal → ujung), untuk engsel arbitrary axis
    const vein = new Node('vein' + i, new Mesh(gl, tube(lf.vein, (t) => 0.013 * (1 - t) + 0.004, 8)), M.vein);
    node.add(vein);
    body.add(node);
    node.curves = lf.curves;
    return node;
  });
  const baseKnot = new Node('baseKnot', new Mesh(gl, ellipsoid(0.085, 0.07, 0.085)), M.stem);
  baseKnot.position = [0, 0.13, 0];
  body.add(baseKnot);

  /* ---------------- BATANG: 2 cylinder (hierarki → bisa melengkung) ---------------- */
  const stemLower = new Node('stemLower', new Mesh(gl, cylinder(0.052, STEM_L)), M.stem);
  stemLower.position = [0, 0.12, 0];
  stemLower.rotation = [-0.10, 0, 0];
  const joint = new Node('joint', new Mesh(gl, ellipsoid(0.056, 0.056, 0.056, 14, 20)), M.stem);
  joint.position = [0, STEM_L, 0];
  joint.mat = Object.assign({}, M.stem, { outline: false });
  const stemUpper = new Node('stemUpper', new Mesh(gl, cylinder(0.048, STEM_U)), M.stem);
  stemUpper.position = [0, STEM_L, 0];
  stemUpper.rotation = [0.26, 0, 0];
  body.add(stemLower);
  stemLower.add(joint, stemUpper);

  /* ---------------- LEHER + KEPALA ---------------- */
  const neck = new Node('neck');
  neck.position = [0, STEM_U, 0];
  neck.rotation = [-0.16, 0, 0];
  stemUpper.add(neck);
  const neckKnot = new Node('neckKnot', new Mesh(gl, ellipsoid(0.1, 0.1, 0.07, 16, 24)), M.stem);
  neckKnot.position = [0, 0.03, 0.0];
  neck.add(neckKnot);

  const face = new Node('face');
  face.position = [0, 0.06, 0.15];
  neck.add(face);

  const head = new Node('head', new Mesh(gl, ellipsoid(HEAD.rx, HEAD.ry, HEAD.rz, 36, 56)), M.face);
  face.add(head);
  const surfZ = (x, y) => HEAD.rz * Math.sqrt(Math.max(0, 1 - (x * x) / (HEAD.rx * HEAD.rx) - (y * y) / (HEAD.ry * HEAD.ry)));

  // Mata: ellipsoid hitam pipih + kilau putih kecil
  const eyeGeo = ellipsoid(0.072, 0.118, 0.05, 18, 24);
  const shineGeo = ellipsoid(0.024, 0.03, 0.012, 10, 14);
  const eyes = [-1, 1].map((sx) => {
    const x = 0.19 * sx, y = 0.1;
    const e = new Node('eye', new Mesh(gl, eyeGeo), M.eye);
    e.position = [x, y, surfZ(x, y) - 0.012];
    e.rotation = [-0.12, sx * 0.25, 0];
    const sh = new Node('shine', new Mesh(gl, shineGeo), M.shine);
    sh.position = [-0.022, 0.045, 0.044];
    e.add(sh);
    face.add(e);
    return e;
  });

  // Mulut: tube mengikuti kurva Bézier 3D yang menempel di permukaan wajah
  const mouth2D = [[-0.30, -0.075], [-0.15, -0.30], [0.15, -0.30], [0.30, -0.075]];
  const mouthCtrl = mouth2D.map(([x, y]) => [x, y, surfZ(x, y) + 0.004]);
  const mouthPts = Bezier.sample(mouthCtrl, 40).map(([x, y]) => [x, y, surfZ(x, y) + 0.006]);
  const mouth = new Node('mouth', new Mesh(gl, tube(mouthPts, (t) => 0.014 + 0.016 * Math.sin(Math.PI * t), 10)), M.mouth);
  face.add(mouth);

  // Kelopak: 16 elliptic paraboloid, 2 lapis (depan 8 + belakang 8) melingkari kepala
  const petalRing = new Node('petalRing');
  petalRing.position = [0, 0, -0.03];
  face.add(petalRing);
  const petalGeoF = new Mesh(gl, paraboloidLens(0.165, 0.265, 0.05, 0.04));
  const petalGeoB = new Mesh(gl, paraboloidLens(0.175, 0.29, 0.055, 0.04));
  const ellR = (th) => (HEAD.rx * HEAD.ry) / Math.hypot(HEAD.ry * Math.sin(th), HEAD.rx * Math.cos(th));
  const petals = [];
  for (let i = 0; i < 16; i++) {
    const back = i % 2 === 1;
    const th = (i / 16) * Math.PI * 2;
    const pivot = new Node('petalPivot' + i);
    pivot.rotation = [0, 0, -th];                       // arah radial
    const p = new Node('petal' + i, back ? petalGeoB : petalGeoF, back ? M.petalB : M.petalF);
    p.position = [0, ellR(th) * 0.74, back ? -0.07 : -0.015];
    p.rotation = [back ? -0.26 : -0.17, 0, 0];          // condong ke belakang
    p.meshMatrix = M4.translation(0, back ? 0.27 : 0.245, 0); // engsel di pangkal kelopak
    pivot.add(p);
    petalRing.add(pivot);
    petals.push(p);
  }

  root.saveBase();
  return { root, body, leaves, stemLower, stemUpper, joint, neck, face, head, eyes, mouth, petalRing, petals, materials: M, mouthCtrl };
}
