/* =========================================================================
   peashooter/animation.js — Animasi Peashooter (rubrik)

   OTOMATIS (kebiasaan, jalan terus tanpa tombol):
     ARBITRARY  : daun di belakang kepala mengepak naik-turun. Diputar terhadap
                  ENGSEL di pangkal daun; arah engsel = (arah daun × normal
                  kepala) dimiringkan ke arah normal → sumbu miring, bukan X/Y/Z
                  → M4.rotateArbitraryAxis.
     SCALING    : mata membesar (melotot 1 → 1.45×), lalu menutup (tinggi 0.08),
                  lalu terbuka lagi — tiap ±5 detik.

   DIPENCET:
     TRANSLATE  : shoot — kepala mundur ancang-ancang, kacang melesat keluar
                         (posisi kacang += kecepatan·dt), kepala tersentak mundur
                         lalu kembali.
     ROTATE     : look  — kepala menoleh kiri lalu kanan mencari zombie
                         (rotasi sumbu Y di leher).

   HIERARCHICAL: kepala membawa mata, moncong, bibir & daun kepala (anak-anaknya)
                 setiap kali leher berputar / kepala bergeser.
   ========================================================================= */
import { V3, M4, seg, Ease } from '../../core/math.js';

export function psMakePose() {
  return {
    rootPos: [0, 0, 0], rootRotY: 0, rootScale: 1,
    bodyScale: [1, 1, 1],
    lowerRot: [0, 0, 0], upperRot: [0, 0, 0], neckRot: [0, 0, 0],
    headOffset: [0, 0, 0],                    // TRANSLATE kepala (ruang leher, +Z = depan)
    headScale: [1, 1, 1], snoutScale: [1, 1, 1],
    leafRot: Array(4).fill(0), headLeafRot: [0, 0, 0],
    headLeafFlap: 0,                          // ARBITRARY: sudut engsel daun kepala (rad)
    eyeScale: [1, 1, 1],                      // SCALING: mata
  };
}

/** Kebiasaan: napas, goyang pelan, DAUN KEPALA (arbitrary axis) & MATA (scaling) */
export function psIdle(pose, t) {
  pose.bodyScale[1] *= 1 + 0.016 * Math.sin(t * 2.4);
  pose.neckRot[0] += 0.04 * Math.sin(t * 1.2 + 0.4);
  pose.neckRot[2] += 0.03 * Math.sin(t * 0.9);
  pose.upperRot[0] += 0.03 * Math.sin(t * 1.2 + 1.1);
  pose.lowerRot[2] += 0.02 * Math.sin(t * 0.9 - 0.6);
  for (let i = 0; i < 4; i++) pose.leafRot[i] += 0.035 * Math.sin(t * 1.7 + i * 1.4);

  // ARBITRARY: daun kepala mengepak naik-turun
  pose.headLeafFlap += 0.42 * Math.sin(t * 2.6) + 0.08 * Math.sin(t * 5.3);

  // SCALING: melotot → tutup → buka, siklus 5 detik
  const u = t % 5.0;
  const big = Ease.outBack(seg(u, 1.0, 1.45)) * (1 - Ease.inOutSine(seg(u, 2.3, 2.5)));  // 1 → 1.45× → 1
  const shut = Math.sin(Math.PI * seg(u, 2.45, 2.85));                                      // tutup lalu buka
  const s = 1 + 0.45 * big;
  pose.eyeScale[0] *= s; pose.eyeScale[2] *= s;
  pose.eyeScale[1] *= s * (1 - 0.92 * shut);
}

/** Respons hentakan teredam (dipakai untuk recoil) */
const kick = (tt) => (tt > 0 ? Math.exp(-tt * 7.5) * Math.sin(tt * 19) : 0);

export const PS_ACTIONS = {
  /* tumbuh dari tanah (dipakai viewer saat dibuka) */
  grow: {
    dur: 2.6,
    apply(p, pose) {
      pose.rootScale *= Math.max(0.001, Ease.outBack(seg(p, 0, 0.45)));
      pose.bodyScale[1] *= 1 + 0.22 * Math.sin(Math.PI * seg(p, 0, 0.45)) * (1 - seg(p, 0.3, 0.45));
      const h = Math.max(0.001, Ease.outBack(seg(p, 0.25, 0.6)));
      pose.headScale = pose.headScale.map((v) => v * h);
      pose.snoutScale[1] *= Math.max(0.001, Ease.outElastic(seg(p, 0.45, 0.95)));
      pose.headLeafRot[2] += -1.4 * (1 - Ease.outBack(seg(p, 0.55, 0.9)));
      for (let i = 0; i < 4; i++) pose.leafRot[i] += 0.9 * (1 - Ease.outBack(seg(p, 0.1 + i * 0.05, 0.5 + i * 0.05)));
    },
  },

  /* ---------- TRANSLATE: tembak ----------
     Kepala digeser mundur (ancang-ancang) → kacang keluar → kepala tersentak
     mundur lalu kembali. Kacangnya sendiri bergerak lurus ke depan.        */
  shoot: {
    dur: 1.4,
    apply(p, pose, ctx, st, world) {
      const t = p * 1.4, fireT = 0.5;
      if (t < fireT) {
        const c = Ease.inOutSine(seg(t, 0, fireT));
        pose.headOffset[2] += -0.07 * c;                       // mundur ancang-ancang
        pose.neckRot[0] += -0.12 * c;
      } else {
        const tt = t - fireT;
        pose.headOffset[2] += -0.07 * Math.exp(-tt * 9) - 0.05 * kick(tt);   // tersentak lalu kembali
        pose.neckRot[0] += -0.12 * Math.exp(-tt * 9) + 0.08 * kick(tt);
        pose.headLeafRot[2] += 0.5 * kick(tt - 0.05);
      }
      if (t >= fireT && !ctx.fired) { ctx.fired = true; world.firePea(); }
    },
  },

  /* ---------- ROTATE: menoleh kiri-kanan mencari zombie ----------
     Rotasi sumbu Y leher: 0 → +40° (tahan) → −40° (tahan) → 0.            */
  look: {
    dur: 3.4,
    apply(p, pose) {
      const t = p * 3.4, A = 0.7;
      const k1 = Ease.inOutCubic(seg(t, 0.0, 0.6));            // ke kiri
      const k2 = Ease.inOutCubic(seg(t, 1.3, 2.1));            // ke kanan
      const k3 = Ease.inOutCubic(seg(t, 2.8, 3.4));            // kembali ke depan
      const yaw = A * k1 - 2 * A * k2 + A * k3;
      pose.neckRot[1] += yaw;
      pose.upperRot[1] += 0.12 * yaw;                          // batang atas sedikit ikut
      const stop = Math.sin(Math.PI * seg(t, 0.5, 0.9)) + Math.sin(Math.PI * seg(t, 2.0, 2.4));
      pose.headLeafRot[2] += 0.25 * stop;                      // daun kepala "telat" saat berhenti
    },
  },
};

/** Tulis pose ke node Peashooter */
export function applyPeashooterPose(ps, pose) {
  ps.root.resetPose();
  ps.root.position = V3.add(ps.root.position, pose.rootPos);
  ps.root.rotation[1] += pose.rootRotY;
  ps.root.scale = [pose.rootScale, pose.rootScale, pose.rootScale];
  ps.body.scale = pose.bodyScale.slice();
  const addRot = (n, r) => { n.rotation = V3.add(n.rotation, r); };
  addRot(ps.stemLower, pose.lowerRot);
  addRot(ps.stemUpper, pose.upperRot);
  addRot(ps.neck, pose.neckRot);
  addRot(ps.headLeaf, pose.headLeafRot);
  ps.head.position = V3.add(ps.head.position, pose.headOffset);    // TRANSLATE
  ps.head.scale = pose.headScale.slice();
  ps.snout.scale = pose.snoutScale.slice();
  ps.leaves.forEach((lf, i) => { lf.rotation[2] += pose.leafRot[i]; });
  ps.eyes.forEach((e) => { e.scale = pose.eyeScale.slice(); });   // SCALING

  /* ARBITRARY AXIS: daun kepala diputar terhadap engsel di pangkalnya.
     P     = pangkal daun (ruang kepala)
     u     = normalize( (arah daun × normal kepala) + 0.45·normal )   → sumbu miring
     pre   = M4.rotateArbitraryAxis(P, u, θ) = T(P)·Rx⁻¹·Ry⁻¹·Rz(θ)·Ry·Rx·T(−P)   */
  const hl = ps.headLeaf;
  hl.pre = null;
  hl.updateLocal();
  const dir = V3.norm(M4.transformDir(hl.local, hl.midrib));
  const hinge = V3.norm(V3.add(V3.cross(dir, ps.headLeafNormal), V3.scale(ps.headLeafNormal, 0.45)));
  hl.pre = M4.rotateArbitraryAxis(hl.position, hinge, pose.headLeafFlap);

  ps.root.updateWorld();
  const hw = ps.head.world;                                        // untuk penanda sumbu (tombol X)
  ps.flapAxis = { pivot: M4.transformPoint(hw, hl.position), axis: V3.norm(M4.transformDir(hw, hinge)), weight: 0.35 };
}
