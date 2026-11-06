/* =========================================================================
   sunflower/index.js — Spesifikasi karakter Sunflower (dipakai scene utama lewat cast.js)
   ========================================================================= */
import { V3, Ease } from '../../core/math.js';
import { Animator } from '../../core/animator.js';
import { buildSunAssets, makeSun } from '../../core/sun.js';
import { buildSunflower } from './model.js';
import { SF_ACTIONS, sfIdle, sfMakePose, applySunflowerPose } from './animation.js';

export default {
  build({ gl, fx }) {
    const sf = buildSunflower(gl);
    const sunAssets = buildSunAssets(gl);
    const suns = [];

    const world = {
      spawnSun() {
        const n = makeSun(sunAssets), from = sf.face.worldPos(), a = Math.random() * Math.PI * 2;
        const to = [from[0] + Math.cos(a) * 1.3 + 0.4, 0.3, from[2] + Math.abs(Math.sin(a)) * 1.2 + 0.4];
        suns.push({ n, t: 0, from, to }); fx.add(n);
      }
    };
    const anim = new Animator({ actions: SF_ACTIONS, idle: sfIdle, makePose: sfMakePose, world });

    function updateSuns(dt, time, camEye) {
      for (let i = suns.length - 1; i >= 0; i--) {
        const s = suns[i]; s.t += dt; const t = s.t;
        let p, sc;
        if (t < 0.7) { const k = Ease.outCubic(t / 0.7); p = V3.add(s.from, [0, 0.9 * k, 0.35 * k]); sc = Ease.outBack(Math.min(1, t / 0.5)); }
        else if (t < 2.2) {
          const k = Ease.inOutSine((t - 0.7) / 1.5), top = V3.add(s.from, [0, 0.9, 0.35]);
          p = V3.lerp(top, s.to, k); p[1] += Math.sin(k * Math.PI) * 0.5; sc = 1;
        } else { p = [s.to[0], s.to[1] + 0.06 * Math.sin(t * 3), s.to[2]]; sc = t > 5.4 ? Math.max(0, 1 - Ease.inOutCubic((t - 5.4) / 0.6)) : 1; }
        s.n.position = p; s.n.scale = [sc, sc, sc];
        if (t > 6) { fx.remove(s.n); suns.splice(i, 1); }
      }
      for (const n of suns.map((s) => s.n)) {
        const d = V3.sub(camEye, n.position);
        n.rotation = [0, Math.atan2(d[0], d[2]), 0];   // billboard ke kamera
        n.spin.rotation = [0, 0, time * 1.4];
      }
    }

    return {
      root: sf.root, sf, anim,
      update(dt, time, camEye) {
        const pose = anim.update(dt, time);
        applySunflowerPose(sf, pose);
        updateSuns(dt, time, camEye);
      },
      trigger: (n) => anim.trigger(n),
      axisInfo: () => sf.flapAxis,
    };
  },
};
