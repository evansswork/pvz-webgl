/* =========================================================================
   drone.js — Kamera drone free-fly untuk merekam video
   -------------------------------------------------------------------------
   Diturunkan dari kamera Free Fly environment (WASD, Space/E, Q/C, Shift,
   drag mouse, scroll), ditambah:
   • gerak & arah pandang diredam (inersia) → rekaman halus seperti drone
   • Z ditahan → mode pelan untuk close-up karakter
   • P  → autopilot: drone mengorbit tanaman pelan (tekan lagi untuk berhenti)
   • V  → pindah sudut pandang preset (tanaman, panorama, rumah, kuburan)
   ========================================================================= */

import { look } from "./env/core/transform.js";

const lerp = (a, b, k) => a + (b - a) * k;

export class DroneCamera {
  constructor(canvas, { focus = [130, 40, -1490] } = {}) {
    this.canvas = canvas;
    this.fov = 0.85;
    this.focus = focus;                       // titik yang diorbit autopilot

    this.presets = [
      { pos: [100, 300, -870], yaw: Math.PI, pitch: -0.40 },           // halaman: zombie di depan, tanaman & rumah di belakang
      { pos: [950, 480, -900], yaw: -1.57, pitch: -0.28 },            // panorama (preset asli)
      { pos: [125, 140, -880], yaw: Math.PI, pitch: -0.12 },          // dari jalan ke rumah
      { pos: [125, 55, -920], yaw: 0.0, pitch: -0.06 },               // dari jalan ke kuburan
    ];
    this.preset = 0;
    const p0 = this.presets[0];
    this.pos = [...p0.pos];
    this.yaw = p0.yaw; this.pitch = p0.pitch;            // arah pandang aktual (diredam)
    this.goalYaw = p0.yaw; this.goalPitch = p0.pitch;    // arah pandang tujuan (dari mouse)
    this.vel = [0, 0, 0];

    this.baseSpeed = 200.0;
    this.sprintSpeed = 620.0;
    this.slowFactor = 0.3;

    this.auto = null;                         // state autopilot
    this.keys = {};
    this.isDragging = false;
    this.eye = [...this.pos];
    this.up = [0, 1, 0];
    this.bindEvents();
  }

  teleport(i) {
    const p = this.presets[i % this.presets.length];
    this.preset = i % this.presets.length;
    this.pos = [...p.pos]; this.vel = [0, 0, 0];
    this.yaw = this.goalYaw = p.yaw; this.pitch = this.goalPitch = p.pitch;
    this.auto = null;
  }

  toggleAutopilot() {
    if (this.auto) { this.auto = null; return; }
    const dx = this.pos[0] - this.focus[0], dz = this.pos[2] - this.focus[2];
    this.auto = {
      ang: Math.atan2(dx, dz),
      rad: Math.max(150, Math.min(420, Math.hypot(dx, dz))),
      h: Math.max(45, Math.min(220, this.pos[1] - this.focus[1])),
      blend: 0,
    };
  }

  bindEvents() {
    const cv = this.canvas;
    cv.addEventListener("contextmenu", (e) => e.preventDefault());
    cv.addEventListener("pointerdown", (e) => {
      cv.setPointerCapture(e.pointerId);
      this.isDragging = true; this.prevX = e.clientX; this.prevY = e.clientY;
    });
    cv.addEventListener("pointermove", (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.prevX, dy = e.clientY - this.prevY;
      this.prevX = e.clientX; this.prevY = e.clientY;
      this.goalYaw -= dx * 0.0042;
      this.goalPitch = Math.max(-1.52, Math.min(1.52, this.goalPitch - dy * 0.0042));
      this.auto = null;
    });
    const stop = () => (this.isDragging = false);
    cv.addEventListener("pointerup", stop);
    cv.addEventListener("pointercancel", stop);
    cv.addEventListener("wheel", (e) => {
      e.preventDefault();
      const f = this.forward(), imp = e.deltaY < 0 ? 260 : -260;   // dorongan maju/mundur (diredam)
      for (let i = 0; i < 3; i++) this.vel[i] += f[i] * imp;
    }, { passive: false });
    window.addEventListener("keydown", (e) => {
      this.keys[e.code] = true;
      if (e.code === "KeyP") this.toggleAutopilot();
      if (e.code === "KeyV") this.teleport(this.preset + 1);
    });
    window.addEventListener("keyup", (e) => (this.keys[e.code] = false));
    window.addEventListener("blur", () => (this.keys = {}));
  }

  forward() {
    return [Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch)];
  }

  update(dt = 0.016) {
    const K = this.keys;
    const manual = ["KeyW", "KeyS", "KeyA", "KeyD", "KeyE", "KeyQ", "KeyC", "Space",
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].some((k) => K[k]);
    if (manual) this.auto = null;

    // ---- arah pandang diredam (mouse terasa seperti gimbal drone)
    const kl = 1 - Math.exp(-dt * 7);
    this.yaw = lerp(this.yaw, this.goalYaw, kl);
    this.pitch = lerp(this.pitch, this.goalPitch, kl);

    if (this.auto) {
      // ---- AUTOPILOT: orbit pelan mengelilingi tanaman sambil sedikit naik-turun
      const A = this.auto;
      A.blend = Math.min(1, A.blend + dt * 0.5);
      A.ang += dt * 0.12 * A.blend;
      const t = performance.now() / 1000;
      const goal = [
        this.focus[0] + Math.sin(A.ang) * A.rad,
        this.focus[1] + A.h + Math.sin(t * 0.35) * 14,
        this.focus[2] + Math.cos(A.ang) * A.rad,
      ];
      const k = 1 - Math.exp(-dt * 1.6 * A.blend);
      for (let i = 0; i < 3; i++) this.pos[i] = lerp(this.pos[i], goal[i], k);
      const d = [this.focus[0] - this.pos[0], this.focus[1] - this.pos[1], this.focus[2] - this.pos[2]];
      this.goalYaw = Math.atan2(d[0], d[2]);
      this.goalPitch = Math.atan2(d[1], Math.hypot(d[0], d[2]));
      // jaga yaw kontinu (tanpa lompatan 2π)
      while (this.goalYaw - this.yaw > Math.PI) this.goalYaw -= Math.PI * 2;
      while (this.goalYaw - this.yaw < -Math.PI) this.goalYaw += Math.PI * 2;
      this.vel = [0, 0, 0];
    } else {
      // ---- FREE FLY dengan inersia
      const sprint = K.ShiftLeft || K.ShiftRight, slow = K.KeyZ;
      const speed = (sprint ? this.sprintSpeed : this.baseSpeed) * (slow ? this.slowFactor : 1);
      const f = this.forward(), r = [Math.cos(this.yaw), 0, -Math.sin(this.yaw)];
      const want = [0, 0, 0];
      const add = (v, s) => { for (let i = 0; i < 3; i++) want[i] += v[i] * s; };
      if (K.KeyW || K.ArrowUp) add(f, 1);
      if (K.KeyS || K.ArrowDown) add(f, -1);
      if (K.KeyA || K.ArrowLeft) add(r, -1);
      if (K.KeyD || K.ArrowRight) add(r, 1);
      if (K.KeyE || K.Space) want[1] += 1;
      if (K.KeyQ || K.KeyC) want[1] -= 1;
      const kv = 1 - Math.exp(-dt * (manual ? 4.5 : 2.6));
      for (let i = 0; i < 3; i++) {
        this.vel[i] = lerp(this.vel[i], want[i] * speed, kv);
        this.pos[i] += this.vel[i] * dt;
      }
    }

    this.pos[1] = Math.max(18.0, this.pos[1]);       // jangan menembus tanah
    const f = this.forward();
    this.eye = [...this.pos];
    this.target = [this.pos[0] + f[0] * 100, this.pos[1] + f[1] * 100, this.pos[2] + f[2] * 100];
    return look(this.eye, this.target, this.up);
  }

  getEye() { return this.eye; }
}
