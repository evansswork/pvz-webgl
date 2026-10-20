/* =========================================================================
   sunflower/animation.js — Animasi Sunflower (rubrik)

   OTOMATIS (kebiasaan, jalan terus tanpa tombol):
     ARBITRARY  : daun bergerak naik-turun pelan seperti tertiup angin.
                  Tiap daun diputar terhadap ENGSEL di pangkalnya. Arah engsel
                  = (atas × arah daun) dimiringkan sedikit ke atas, jadi sumbunya
                  miring (bukan sumbu X/Y/Z) → M4.rotateArbitraryAxis.
     SCALING    : mata berkedip: tinggi mata di-scale 1 → 0.1 → 1
                  (kadang kedip 2×).

   DIPENCET:
     TRANSLATE  : sun   — kepala mundur ancang-ancang lalu maju, keluar Sun yang
                         melayang lalu jatuh ke rumput (posisi berpindah).
     ROTATE     : sway  — kepala bergoyang kiri-kanan (rotasi sumbu Z di leher).

   HIERARCHICAL: tiap gerak leher otomatis membawa wajah, mata, mulut & 16
                 kelopak (anak-anaknya) — world = parent.world · local.
   ========================================================================= */
import { V3, M4, seg, Ease } from '../../core/math.js';

export function sfMakePose() {
  return {
    rootPos: [0, 0, 0], rootRotY: 0, rootScale: 1,
    bodyScale: [1, 1, 1],
    lowerRot: [0, 0, 0], upperRot: [0, 0, 0], neckRot: [0, 0, 0],
    faceOffset: [0, 0, 0],                    // TRANSLATE wajah (ruang leher)
    faceScale: 1, glow: 0,
    petalRot: Array.from({ length: 16 }, () => [0, 0]),
    petalScale: Array(16).fill(1),
    leafRot: Array(4).fill(0),
    leafFlap: Array(4).fill(0),               // ARBITRARY: sudut engsel tiap daun (rad)
    eyeScaleY: 1,                             // SCALING: kedip
  };
}

/** Kebiasaan: napas, goyang pelan, DAUN (arbitrary axis) & KEDIP (scaling) */
export function sfIdle(pose, t) {
  pose.bodyScale[1] *= 1 + 0.018 * Math.sin(t * 2.6);
  pose.upperRot[0] += 0.03 * Math.sin(t * 1.3 + 0.6);
  pose.neckRot[0] += 0.03 * Math.sin(t * 1.3 + 1.2);
  for (let i = 0; i < 16; i++) pose.petalRot[i][0] += 0.04 * Math.sin(t * 2.2 + i * 0.7);

  // ARBITRARY: daun naik-turun, hembusan angin datang-pergi
  const gust = 0.65 + 0.35 * Math.sin(t * 0.45);
  for (let i = 0; i < 4; i++) pose.leafFlap[i] += gust * 0.17 * Math.sin(t * 1.9 + i * 1.35);

  // SCALING: kedip tiap 3.2 dtk, tiap siklus ke-3 kedip dua kali
  const cyc = Math.floor(t / 3.2), u = t - cyc * 3.2;
  const blink = (a) => (u > a && u < a + 0.16 ? Math.sin(((u - a) / 0.16) * Math.PI) : 0);
  const b = Math.max(blink(2.9), cyc % 3 === 2 ? blink(2.62) : 0);
  pose.eyeScaleY *= 1 - 0.9 * b;
}

export const SF_ACTIONS = {
  /* tumbuh dari benih (dipakai viewer saat dibuka) */
  grow: {
    dur: 2.8,
    apply(p, pose) {
      pose.rootScale *= Math.max(0.001, Ease.outBack(seg(p, 0.0, 0.5)));
      pose.bodyScale[1] *= 1 + 0.25 * Math.sin(Math.PI * seg(p, 0.0, 0.5)) * (1 - seg(p, 0.3, 0.5));
      pose.faceScale *= Math.max(0.001, Ease.outBack(seg(p, 0.25, 0.65)));
      for (let i = 0; i < 16; i++) {
        const k = (i % 2 ? 8 + (i >> 1) : i >> 1) * 0.022;
        pose.petalScale[i] *= Math.max(0.001, Ease.outBack(seg(p, 0.42 + k, 0.72 + k)));
        pose.petalRot[i][0] += 1.2 * (1 - Ease.outCubic(seg(p, 0.42 + k, 0.8 + k)));
      }
      for (let i = 0; i < 4; i++) pose.leafRot[i] += 0.9 * (1 - Ease.outBack(seg(p, 0.1 + i * 0.05, 0.5 + i * 0.05)));
    },
  },

  /* ---------- TRANSLATE: keluarkan Sun ----------
     Wajah digeser mundur (ancang-ancang) lalu maju mendorong Sun keluar.
     Sun sendiri bergerak: naik dari kepala → melayang → jatuh ke rumput.   */
  sun: {
    dur: 2.0,
    apply(p, pose, ctx, st, world) {
      const t = p * 2.0;
      const back = Ease.inOutSine(seg(t, 0, 0.45));                       // mundur
      const push = Ease.outBack(seg(t, 0.45, 0.7));                       // maju cepat
      const ret = Ease.inOutSine(seg(t, 0.9, 1.8));                       // kembali
      // z wajah: 0 → −0.08 (mundur) → +0.12 (maju) → 0
      pose.faceOffset[2] += (-0.08 * back + 0.20 * push) * (1 - ret);
      pose.faceOffset[1] += 0.03 * Math.sin(Math.PI * seg(t, 0.4, 1.2));
      pose.glow += 0.35 * Math.sin(Math.PI * seg(t, 0.3, 1.0));
      pose.neckRot[0] += 0.10 * back * (1 - push) - 0.06 * Math.sin(Math.PI * seg(t, 0.45, 1.1));
      for (let i = 0; i < 16; i++) pose.petalRot[i][0] += 0.25 * Math.sin(Math.PI * seg(t, 0.45, 1.0));
      if (t >= 0.55 && !ctx.spawned) { ctx.spawned = true; world.spawnSun(); }
    },
  },

  /* ---------- ROTATE: kepala goyang kiri-kanan ----------
     Rotasi sumbu Z leher: 0 → +θ → −θ → +θ → −θ → 0 (θ ≈ 21°).           */
  sway: {
    dur: 3.2,
    apply(p, pose) {
      const w = Ease.inOutCubic(seg(p, 0, 0.15)) * (1 - Ease.inOutCubic(seg(p, 0.85, 1)));
      const a = Math.sin(p * Math.PI * 4);                                 // 2 kali bolak-balik
      pose.neckRot[2] += w * 0.38 * a;
      pose.upperRot[2] += -w * 0.06 * a;                                   // batang sedikit melawan (seimbang)
      for (let i = 0; i < 16; i++) pose.petalRot[i][0] += w * 0.12 * Math.sin(p * Math.PI * 4 - 0.6); // kelopak telat ikut
    },
  },
};

/** Tulis pose ke node-node sunflower (dipanggil tiap frame) */
export function applySunflowerPose(sf, pose) {
  sf.root.resetPose();
  sf.root.position = V3.add(sf.root.position, pose.rootPos);
  sf.root.rotation[1] += pose.rootRotY;
  sf.root.scale = [pose.rootScale, pose.rootScale, pose.rootScale];
  sf.body.scale = pose.bodyScale.slice();
  const addRot = (n, r) => { n.rotation = V3.add(n.rotation, r); };
  addRot(sf.stemLower, pose.lowerRot);
  addRot(sf.stemUpper, pose.upperRot);
  addRot(sf.neck, pose.neckRot);
  sf.face.position = V3.add(sf.face.position, pose.faceOffset);      // TRANSLATE
  sf.face.scale = [pose.faceScale, pose.faceScale, pose.faceScale];
  sf.petals.forEach((pt, i) => {
    pt.rotation[0] += pose.petalRot[i][0];
    pt.rotation[2] += pose.petalRot[i][1];
    const s = pose.petalScale[i]; pt.scale = [s, s, s];
  });
  sf.leaves.forEach((lf, i) => { lf.rotation[2] += pose.leafRot[i]; });
  sf.eyes.forEach((e) => { e.scale = [1, pose.eyeScaleY, 1]; });     // SCALING
  const M = sf.materials;
  M.face.emissive = pose.glow * 0.6; M.petalF.emissive = pose.glow; M.petalB.emissive = pose.glow * 0.8;

  /* ARBITRARY AXIS: daun diputar terhadap engsel di pangkalnya.
     P    = pangkal daun (ruang body)
     u    = normalize( (atas × arah daun) + 0.35·atas )   → sumbu miring
     pre  = M4.rotateArbitraryAxis(P, u, θ) = T(P)·Rx⁻¹·Ry⁻¹·Rz(θ)·Ry·Rx·T(−P)   */
  sf.flapAxis = null;
  sf.leaves.forEach((lf, i) => {
    lf.pre = null;
    lf.updateLocal();
    const dir = V3.norm(M4.transformDir(lf.local, lf.midrib));
    const hinge = V3.norm(V3.add(V3.cross([0, 1, 0], dir), [0, 0.35, 0]));
    lf.pre = M4.rotateArbitraryAxis(lf.position, hinge, pose.leafFlap[i]);
    if (i === 0) sf.flapAxis = { leaf: lf, hinge };
  });

  sf.root.updateWorld();
  if (sf.flapAxis) {                                       // untuk penanda sumbu (tombol X)
    const { leaf, hinge } = sf.flapAxis, bw = leaf.parent.world;
    sf.flapAxis = { pivot: M4.transformPoint(bw, leaf.position), axis: V3.norm(M4.transformDir(bw, hinge)), weight: 0.5 };
  }
}
