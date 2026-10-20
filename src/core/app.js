/* =========================================================================
   app.js — Kerangka aplikasi bersama: loop, kamera orbit, kontrol, HUD,
   mode Trailer (storyline). Tiap karakter cukup memberi `spec`:
     spec.build(ctx) → { root, update(dt,time,camEye), trigger, isActive, reset, focusX, axisInfo }
     spec.keys       → peta tombol → nama aksi
     spec.story      → { length, events, cams, captions }
     spec.cam        → posisi kamera awal { yaw, pitch, dist, ty }
   ========================================================================= */
import { M4, seg, Ease } from './math.js';
import { cylinder, cone } from './geometry.js';
import { Mesh, Node, material, Renderer } from './renderer.js';
import { buildEnvironment } from './lawn.js';

export function createApp(spec) {
  const canvas = document.getElementById('gl');
  let R;
  try { R = new Renderer(canvas); } catch (e) { const er = document.getElementById('err'); er.textContent = e.message; er.hidden = false; return; }
  const gl = R.gl;
  if (spec.env) Object.assign(R.env, spec.env);
  const env = buildEnvironment(gl);
  const fx = new Node('fx');
  const ui = { axis: true, hidden: false };

  /* ---------------------------- penanda sumbu ---------------------------- */
  const axisMat = material([1.0, 0.33, 0.22], { emissive: 0.9, outline: false, shadow: false, xray: true });
  const axisRod = new Node('axisRod', new Mesh(gl, cylinder(0.018, 1, 10, 1)), axisMat);
  const axisTip = new Node('axisTip', new Mesh(gl, cone(0.055, 0.16, 12)), axisMat);
  axisRod.visible = axisTip.visible = false;
  fx.add(axisRod, axisTip);

  /* --------------------------------- kamera -------------------------------- */
  const c0 = Object.assign({ yaw: 0.35, pitch: 0.16, dist: 5.2, ty: 1.2, tx: 0 }, spec.cam);
  const cam = { cur: { ...c0 }, goal: { ...c0 }, view: null, proj: null, eye: [0, 0, 0], horizon: 0.5 };
  function updateCamera(aspect, dt) {
    const k = 1 - Math.exp(-dt * 6);
    for (const key in cam.cur) cam.cur[key] += (cam.goal[key] - cam.cur[key]) * k;
    const c = cam.cur, target = [c.tx, c.ty, 0];
    const dist = c.dist * Math.max(1, 0.85 / aspect);   // layar potret → kamera mundur
    cam.eye = [target[0] + dist * Math.cos(c.pitch) * Math.sin(c.yaw), target[1] + dist * Math.sin(c.pitch), target[2] + dist * Math.cos(c.pitch) * Math.cos(c.yaw)];
    cam.eye[1] = Math.max(0.15, cam.eye[1]);
    const fov = 0.72;
    cam.view = M4.lookAt(cam.eye, target, [0, 1, 0]);
    cam.proj = M4.perspective(fov, aspect, 0.05, 200);
    const pitch = Math.atan2(target[1] - cam.eye[1], Math.hypot(target[0] - cam.eye[0], target[2] - cam.eye[2]));
    cam.horizon = 0.5 - Math.tan(pitch) / (2 * Math.tan(fov / 2));
  }

  const ch = spec.build({ gl, R, fx, cam });

  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); stopStory(); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    cam.goal.yaw -= (e.clientX - drag.x) * 0.008;
    cam.goal.pitch = Math.max(-0.05, Math.min(1.25, cam.goal.pitch + (e.clientY - drag.y) * 0.006));
    drag = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', () => (drag = null));
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.goal.dist = Math.max(2.2, Math.min(16, cam.goal.dist * Math.exp(e.deltaY * 0.001))); }, { passive: false });

  /* ------------------------------ UI & kontrol ------------------------------ */
  const $ = (s) => document.querySelector(s);
  const hud = $('#hud'), caption = $('#caption');
  function setStudio(on) { R.env.studio = on; env.visible = !on; document.body.classList.toggle('studio', on); }
  function toggle(name) {
    if (name === 'bg') return setStudio(!R.env.studio);
    if (name === 'axis') { ui.axis = !ui.axis; $('[data-act="axis"]').classList.toggle('on', ui.axis); return; }
    if (name === 'hide') { ui.hidden = !ui.hidden; hud.classList.toggle('hidden', ui.hidden); return; }
    if (name === 'trailer') return story.running ? stopStory() : startStory();
    if (name === 'reset') { cam.goal = { ...c0, tx: ch.focusX() }; return; }
    stopStory();
    ch.trigger(name);
  }
  document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => toggle(b.dataset.act)));
  const keys = Object.assign({ t: 'trailer', b: 'bg', x: 'axis', h: 'hide', r: 'reset' }, spec.keys);
  window.addEventListener('keydown', (e) => { const a = keys[e.key.toLowerCase()]; if (a) toggle(a); });

  /* ----------------------- TRAILER: storyline otomatis ----------------------- */
  const STORY = spec.story;
  const story = { running: false, t: 0, fired: 0 };
  function startStory() {
    ch.reset();
    story.running = true; story.t = 0; story.fired = 0;
    document.body.classList.add('cinema');
    $('[data-act="trailer"]').classList.add('on');
  }
  function stopStory() {
    if (!story.running) return;
    story.running = false;
    document.body.classList.remove('cinema');
    caption.classList.remove('show');
    $('[data-act="trailer"]').classList.remove('on');
  }
  function updateStory(dt) {
    if (!story.running) return;
    story.t += dt;
    const t = story.t;
    while (story.fired < STORY.events.length && t >= STORY.events[story.fired][0]) ch.trigger(STORY.events[story.fired++][1]);
    const C = STORY.cams;
    let i = 0; while (i < C.length - 2 && t > C[i + 1][0]) i++;
    const [t0, a] = C[i], [t1, b] = C[i + 1], k = Ease.inOutSine(seg(t, t0, t1));
    for (const key of ['yaw', 'pitch', 'dist', 'ty']) cam.goal[key] = a[key] + (b[key] - a[key]) * k;
    cam.goal.tx = ch.focusX() * (spec.follow ?? 0.6) + (a.tx || 0) + ((b.tx || 0) - (a.tx || 0)) * k;
    const cap = STORY.captions.find(([s, e]) => t >= s && t <= e);
    if (cap) {
      if (caption.dataset.k !== String(cap[0])) { caption.innerHTML = cap[2]; caption.dataset.k = cap[0]; }
      caption.classList.add('show'); caption.classList.toggle('title', cap[2].startsWith('<b>'));
    } else caption.classList.remove('show');
    if (t >= STORY.length) stopStory();
  }

  function updateAxis() {
    const ax = ch.axisInfo && ch.axisInfo();
    const show = !!ax && ui.axis;
    axisRod.visible = axisTip.visible = show;
    if (!show) return;
    const L = 2.0 * Math.min(1, ax.weight * 1.5), align = M4.alignY(ax.axis);
    axisRod.pre = M4.chain(M4.translation(...ax.pivot), align, M4.translation(0, -L / 2, 0), M4.scaling(1, L, 1));
    axisTip.pre = M4.chain(M4.translation(...ax.pivot), align, M4.translation(0, L / 2, 0));
  }

  /* -------------------------------- loop --------------------------------- */
  const actBtns = [...document.querySelectorAll('[data-anim]')];
  let last = performance.now(), time = 0;
  function step(dt, aspect) {
    time += dt;
    updateStory(dt);
    if (!story.running && !drag) cam.goal.tx += (ch.focusX() * (spec.follow ?? 0.5) - cam.goal.tx) * Math.min(1, dt * 2);
    updateCamera(aspect, dt);
    ch.update(dt, time, cam.eye);
    updateAxis();
    fx.updateWorld();
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const aspect = R.resize();
    step(dt, aspect);
    env.updateWorld();
    R.render([env, ch.root, fx], cam);
    for (const b of actBtns) b.classList.toggle('on', ch.isActive(b.dataset.anim));
    requestAnimationFrame(frame);
  }
  if (spec.onStart) spec.onStart(ch);
  requestAnimationFrame(frame);

  // akses dari console untuk debug / screenshot
  window.APP = {
    ch, cam, R, story, setStudio, startStory,
    advance(sec) { for (let t = 0; t < sec; t += 0.05) step(0.05, 1.6); },
  };
  return window.APP;
}
