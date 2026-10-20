/* =========================================================================
   animator.js — Pengatur aksi animasi generik (dipakai semua karakter)
   Tiap aksi: { dur, start?(ctx, state), apply(p, pose, ctx, state, world), end?(ctx, state) }
   p = progres 0..1. Banyak aksi boleh berjalan bersamaan (pose dijumlahkan).
   ========================================================================= */
import { V3, M4 } from './math.js';

export class Animator {
  constructor({ actions, idle, makePose, world, state }) {
    this.actions = actions; this.idle = idle; this.makePose = makePose;
    this.world = world; this.state = state; this.active = [];
  }
  trigger(name) {
    const def = this.actions[name]; if (!def) return;
    this.active = this.active.filter((a) => a.name !== name);
    const ctx = {};
    def.start && def.start(ctx, this.state, this.world);
    this.active.push({ name, def, t: 0, ctx });
  }
  isActive(name) { return this.active.some((a) => a.name === name); }
  clear() { this.active = []; }
  update(dt, time) {
    const pose = this.makePose();
    this.idle(pose, time, this.state);
    for (const a of this.active) {
      a.t += dt;
      a.def.apply(Math.min(a.t / a.def.dur, 1), pose, a.ctx, this.state, this.world);
    }
    for (const a of this.active) if (a.t >= a.def.dur && a.def.end) a.def.end(a.ctx, this.state, this.world);
    this.active = this.active.filter((a) => a.t < a.def.dur);
    return pose;
  }
}

/** Rotasi sumbu sembarang agar sumbu lokal +Z sebuah node menghadap `target`.
    Sumbu u = forward × arahKeTarget (ruang dunia), θ = acos(forward · arah),
    lalu u dibawa ke ruang induk dan dipakai M4.rotateArbitraryAxis(P, u, θ).   */
export function aimNodeAt(node, target, weight, maxAngle = 1.05, localFwd = [0, 0, 1]) {
  const pw = node.parent.world;
  const pivot = node.worldPos();
  const fwd = V3.norm(M4.transformDir(node.world, localFwd));
  const dir = V3.norm(V3.sub(target, pivot));
  let axisW = V3.cross(fwd, dir);
  if (V3.len(axisW) < 1e-5 || weight <= 0.001) return null;
  axisW = V3.norm(axisW);
  const angle = Math.min(Math.acos(Math.max(-1, Math.min(1, V3.dot(fwd, dir)))), maxAngle) * weight;
  const axisP = V3.norm(M4.transformDir(M4.invert(pw), axisW));
  node.pre = M4.rotateArbitraryAxis(node.position, axisP, angle);
  node.updateWorld(pw);
  return { pivot, axis: axisW, angle, weight };
}
