/* =========================================================================
   peashooter/index.js — Spesifikasi karakter Peashooter (dipakai scene utama lewat cast.js)
   ========================================================================= */
import { V3, M4, Ease, seg } from '../../core/math.js';
import { Node } from '../../core/renderer.js';
import { Animator } from '../../core/animator.js';
import { buildPeashooter, buildPeaAssets } from './model.js';
import { PS_ACTIONS, psIdle, psMakePose, applyPeashooterPose } from './animation.js';

export default {
  build({ gl, fx, peaHit = null }) {   // peaHit(posLokal) → true kalau kacang mengenai sesuatu (scene utama: zombie)
    const ps = buildPeashooter(gl);
    const A = buildPeaAssets(gl);
    const peas = [], splats = [];

    function spawnSplat(pos) {
      const s = { t: 0, bits: [] };
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4;
        const n = new Node('bit', A.bit, A.mBit);
        n.position = pos.slice();
        n.vel = [Math.cos(a) * (1.2 + Math.random()), 1.4 + Math.random() * 1.6, Math.sin(a) * (1.2 + Math.random())];
        fx.add(n); s.bits.push(n);
      }
      splats.push(s);
    }

    const world = {
      firePea() {
        ps.root.updateWorld();
        const sw = ps.snout.world;
        const tip = M4.transformPoint(sw, [0, ps.SN.h + 0.02, 0]);
        let dir = V3.norm(M4.transformDir(sw, [0, 1, 0]));
        const n = new Node('pea', A.pea, A.mPea);
        n.position = tip;
        peas.push({ n, vel: V3.scale(dir, 7.5), t: 0 });
        fx.add(n);
      }
    };
    const anim = new Animator({ actions: PS_ACTIONS, idle: psIdle, makePose: psMakePose, world });

    /** TRANSLATE peluru tiap frame: posisi += kecepatan · dt */
    function updateFx(dt) {
      for (let i = peas.length - 1; i >= 0; i--) {
        const p = peas[i]; p.t += dt;
        p.n.position = V3.add(p.n.position, V3.scale(p.vel, dt));
        const s = Ease.outBack(Math.min(1, p.t / 0.12)); p.n.scale = [s, s, s];
        if ((peaHit && peaHit(p.n.position)) || p.n.position[0] > 9 || p.n.position[1] < 0.08 || p.t > 3) {
          spawnSplat(p.n.position); fx.remove(p.n); peas.splice(i, 1);
        }
      }
      for (let i = splats.length - 1; i >= 0; i--) {
        const s = splats[i]; s.t += dt;
        for (const b of s.bits) {
          b.vel[1] -= 9.8 * dt;
          b.position = V3.add(b.position, V3.scale(b.vel, dt));
          if (b.position[1] < 0.03) { b.position[1] = 0.03; b.vel = [b.vel[0] * 0.5, 0, b.vel[2] * 0.5]; }
          const k = Math.max(0.001, 1 - seg(s.t, 0.35, 0.8));
          b.scale = [k, k * (b.position[1] <= 0.031 ? 0.4 : 1), k];
        }
        if (s.t > 0.8) { s.bits.forEach((b) => fx.remove(b)); splats.splice(i, 1); }
      }
    }

    return {
      root: ps.root, ps, anim,
      update(dt, time) {
        const pose = anim.update(dt, time);
        applyPeashooterPose(ps, pose);
        updateFx(dt);
      },
      trigger: (n) => anim.trigger(n),
      axisInfo: () => ps.flapAxis,
    };
  },
};
