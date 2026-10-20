/* =========================================================================
   peashooter/index.js — Spesifikasi karakter Peashooter (dipakai viewer & scene utama)
   ========================================================================= */
import { V3, M4, Ease, seg } from '../../core/math.js';
import { Node } from '../../core/renderer.js';
import { Animator } from '../../core/animator.js';
import { buildPeashooter, buildPeaAssets } from './model.js';
import { PS_ACTIONS, psIdle, psMakePose, applyPeashooterPose } from './animation.js';

export default {
  hud: {
    title: 'Peashooter',
    desc: 'Kurva Bézier, ellipsoid, cylinder, cone dan torus, dirender dengan WebGL murni.',
    accent: ['#a6e04f', '#5fae35'],
    regrow: ['grow', 'Tumbuh ulang'],
    dock: [['shoot', 'Tembak', 'Translate'], ['look', 'Menoleh', 'Rotate']],
    auto: 'Otomatis: daun kepala mengepak (arbitrary axis) · mata melotot lalu berkedip (scaling)',
  },
  cam: { yaw: 0.62, pitch: 0.14, dist: 4.8, ty: 1.05 },
  keys: { '1': 'shoot', '2': 'look', g: 'grow' },

  build({ gl, fx, peaHit = null }) {   // peaHit(posLokal) → true kalau kacang mengenai sesuatu (scene utama: zombie)
    const ps = buildPeashooter(gl);
    const A = buildPeaAssets(gl);
    const peas = [], splats = [];

    /** Translate peluru tiap frame: posisi += kecepatan · dt */
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
    const anim = new Animator({ actions: PS_ACTIONS, idle: psIdle, makePose: psMakePose, world, state: {} });

    function updateFx(dt, camEye) {
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
      update(dt, time, camEye) {
        const pose = anim.update(dt, time);
        applyPeashooterPose(ps, pose);
        updateFx(dt, camEye);
      },
      trigger: (n) => anim.trigger(n),
      isActive: (n) => anim.isActive(n),
      reset() { anim.clear(); },
      focusX: () => 0,
      axisInfo: () => ps.flapAxis,
    };
  },
  onStart: (ch) => ch.trigger('grow'),

  story: {
    length: 20,
    events: [[0.3, 'grow'], [5.0, 'look'], [9.2, 'shoot'], [11.0, 'shoot'], [12.8, 'shoot']],
    cams: [
      [0, { yaw: 0.9, pitch: 0.02, dist: 3.0, ty: 0.7 }],
      [3.0, { yaw: -0.6, pitch: 0.3, dist: 3.0, ty: 1.2 }],     // daun kepala & mata
      [4.8, { yaw: 0.45, pitch: 0.12, dist: 4.6, ty: 1.1 }],
      [8.8, { yaw: -0.2, pitch: 0.08, dist: 6.0, ty: 1.1, tx: 1.8 }],
      [14.5, { yaw: 0.55, pitch: 0.12, dist: 5.6, ty: 1.2 }],
      [17.0, { yaw: 0.55, pitch: 0.1, dist: 6.0, ty: 1.5 }],
      [20, { yaw: 0.45, pitch: 0.1, dist: 5.8, ty: 1.5 }],
    ],
    captions: [
      [0.4, 4.6, 'Penjaga halaman sudah bangun…'],
      [5.0, 8.6, 'Mengawasi setiap sudut.'],
      [9.2, 14.0, 'Tembak!'],
      [17.0, 20, '<b>PEASHOOTER</b><span>Plants vs. Zombies</span>'],
    ],
  },
};
