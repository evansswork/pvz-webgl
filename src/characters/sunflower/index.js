/* =========================================================================
   sunflower/index.js — Spesifikasi karakter Sunflower (dipakai viewer & scene utama)
   ========================================================================= */
import { V3, Ease } from '../../core/math.js';
import { Animator } from '../../core/animator.js';
import { buildSunAssets, makeSun } from '../../core/sun.js';
import { buildSunflower } from './model.js';
import { SF_ACTIONS, sfIdle, sfMakePose, applySunflowerPose } from './animation.js';

export default {
  hud: {
    title: 'Sunflower',
    desc: 'Kurva Bézier, ellipsoid, cylinder dan elliptic paraboloid, dirender dengan WebGL murni.',
    accent: ['#ffd23f', '#f2a516'],
    regrow: ['grow', 'Tumbuh ulang'],
    dock: [['sun', 'Keluarkan Sun', 'Translate'], ['sway', 'Goyang Kepala', 'Rotate']],
    auto: 'Otomatis: daun bergerak (arbitrary axis) · mata berkedip (scaling)',
  },
  cam: { yaw: 0.35, pitch: 0.16, dist: 5.2, ty: 1.2 },
  keys: { '1': 'sun', '2': 'sway', g: 'grow' },

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
    const anim = new Animator({ actions: SF_ACTIONS, idle: sfIdle, makePose: sfMakePose, world, state: {} });

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
      isActive: (n) => anim.isActive(n),
      reset() { anim.clear(); },
      focusX: () => 0,
      axisInfo: () => sf.flapAxis,
    };
  },
  onStart: (ch) => ch.trigger('grow'),

  story: {
    length: 20,
    events: [[0.3, 'grow'], [5.0, 'sun'], [9.5, 'sway'], [14.0, 'sun']],
    cams: [
      [0, { yaw: 0.6, pitch: 0.02, dist: 3.0, ty: 0.75 }],
      [3.0, { yaw: 0.9, pitch: 0.35, dist: 3.4, ty: 0.4 }],     // daun bergerak & kedip
      [4.8, { yaw: 0.2, pitch: 0.12, dist: 4.6, ty: 1.3 }],
      [9.2, { yaw: -0.3, pitch: 0.08, dist: 3.4, ty: 1.45 }],
      [13.6, { yaw: 0.3, pitch: 0.1, dist: 5.0, ty: 1.3 }],
      [17.0, { yaw: 0.0, pitch: 0.1, dist: 5.6, ty: 1.85 }],
      [20, { yaw: 0.12, pitch: 0.1, dist: 5.4, ty: 1.85 }],
    ],
    captions: [
      [0.4, 4.6, 'Di halaman depan, sebuah benih tumbuh…'],
      [5.0, 9.0, 'Dan menghasilkan sun untuk bertahan!'],
      [9.6, 13.0, 'Ceria. Siap jaga halaman.'],
      [17.0, 20, '<b>SUNFLOWER</b><span>Plants vs. Zombies</span>'],
    ],
  },
};
