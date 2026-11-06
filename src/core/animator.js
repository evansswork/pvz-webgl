/* =========================================================================
   animator.js — Pengatur aksi animasi generik (dipakai semua karakter)
   Tiap aksi: { dur, apply(p, pose, ctx, world) }
   p = progres 0..1. Banyak aksi boleh berjalan bersamaan (pose dijumlahkan).
   ========================================================================= */
export class Animator {
  constructor({ actions, idle, makePose, world }) {
    this.actions = actions; this.idle = idle; this.makePose = makePose;
    this.world = world; this.active = [];
  }
  trigger(name) {
    const def = this.actions[name]; if (!def) return;
    this.active = this.active.filter((a) => a.name !== name);
    this.active.push({ name, def, t: 0, ctx: {} });
  }
  update(dt, time) {
    const pose = this.makePose();
    this.idle(pose, time);
    for (const a of this.active) {
      a.t += dt;
      a.def.apply(Math.min(a.t / a.def.dur, 1), pose, a.ctx, this.world);
    }
    this.active = this.active.filter((a) => a.t < a.def.dur);
    return pose;
  }
}
