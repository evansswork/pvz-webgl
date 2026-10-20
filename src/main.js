/* =========================================================================
   main.js — Scene utama: Kuburan ↔ Jalan Raya ↔ Rumah & Pekarangan
   + Sunflower & Peashooter berjaga di halaman rumah, Zombie keluar dari kuburan,
     menyeberang jalan raya, lalu berjalan di halaman menuju rumah.
   -------------------------------------------------------------------------
   Layar bersih untuk perekaman video drone (hanya judul di pojok kiri atas).

   Kamera drone : W A S D gerak · Space/E naik · Q/C turun · Shift cepat
                  Z (tahan) pelan · drag mouse arah pandang · scroll dorong
                  P autopilot orbit · V ganti sudut preset
   Sunflower    : 1 Keluarkan Sun (translate) · 2 Goyang kepala (rotate)
                  otomatis: daun bergerak (arbitrary axis), mata berkedip (scaling)
   Peashooter   : 3 Tembak (translate) · 4 Menoleh kiri-kanan (rotate)
                  otomatis: daun kepala mengepak (arbitrary axis), mata melotot & kedip (scaling)
   Zombie       : J mulai ulang perjalanan dari kuburan
   Lainnya      : X tampilkan sumbu arbitrary axis
   ========================================================================= */

import { cv, gl } from "./env/graveyard/webgl.js";
import { createGraveyardScene } from "./env/graveyard/graveyardScene.js";
import { createHouseScene } from "./env/house/houseScene.js";
import { createHighwayScene } from "./env/road/highwayScene.js";
import { persp, mul, m4, M } from "./env/core/transform.js";
import { DroneCamera } from "./drone.js";
import { Renderer } from "./core/renderer.js";
import { NIGHT, TILE, LAWN_Y, lawnTile, toonNightEnv } from "./lighting.js";
import { placeCharacter } from "./cast.js";
import sunflowerSpec from "./characters/sunflower/index.js";
import peashooterSpec from "./characters/peashooter/index.js";
import { createZombieScene } from "./characters/zombie/zombieScene.js";   // zombie teman (tidak diubah)

/* ---------------- 1. Environment (tidak diubah) ---------------- */
const graveyard = createGraveyardScene();
const highway = createHighwayScene(gl);
const house = createHouseScene(gl);

/* ---------------- 2. Karakter di halaman rumah ----------------
   Satu petak rumput = 71.44 satuan dunia. Lompatan Hop karakter = 2 satuan
   lokal, jadi skala = TILE / 2 → satu Hop tepat pindah satu jalur rumput.   */
const SCALE = TILE / 2;
const toon = new Renderer(gl);
Object.assign(toon.env, toonNightEnv());

// Tanaman diberi jarak: Sunflower di sisi kiri halaman, Peashooter di sisi kanan.
const sunflower = placeCharacter(gl, sunflowerSpec, {
  pos: lawnTile(7, 0),          // jalur 7 (kiri pintu), petak pertama dekat rumah
  yaw: 0,                       // menghadap +Z (ke jalan raya / arah zombie datang)
  scale: SCALE,
});
const peashooter = placeCharacter(gl, peashooterSpec, {
  pos: lawnTile(3, 1),          // jalur 3 (kanan pintu), petak kedua
  yaw: -Math.PI / 2,            // depan lokal Peashooter (+X) → +Z dunia
  scale: SCALE,
  // kacang pecah saat mengenai badan zombie
  extra: (toWorld) => ({ peaHit: (p) => zombieHit(toWorld(p)) }),
});
const cast = [sunflower, peashooter];

/* ---------------- Zombie: menyerang dari kuburan ----------------
   Model, shader & animasi milik teman (src/characters/zombie, TIDAK diubah).
   Di sini hanya dihitung matriks dunianya, sama seperti ZombieController teman:
       world = T(x, y, z) · Ry(yaw) · S(skala)
   Zombie muncul berdiri di jalan setapak kuburan, keluar lewat gerbang,
   menyeberang jalan raya, masuk halaman, lalu berjalan di jalur Peashooter
   menuju rumah dan berhenti di depan tanaman.                                   */
const ZOMBIE_SCALE = 55;
const ZOMBIE_SPEED = 55 * (ZOMBIE_SCALE / 75);     // = kecepatan jalan teman (55 di skala 75)
const zombie = createZombieScene(gl);
const LANE3 = lawnTile(3, 0)[0];
const ZOMBIE_PATH = [
  [125, -600],                  // muncul di jalan setapak kuburan
  [125, -1050],                 // lewat gerbang, menyeberang jalan, masuk halaman
  [LANE3, -1140],               // belok ke jalur Peashooter
  [LANE3, lawnTile(3, 3)[2]],   // berhenti 2 petak di depan Peashooter
];
const zb = { x: 0, z: 0, y: 0, yaw: Math.PI, leg: 0, walkTime: 0, walking: false, delay: 0 };
function zombieReset() {
  zb.x = ZOMBIE_PATH[0][0]; zb.z = ZOMBIE_PATH[0][1]; zb.yaw = Math.PI;
  zb.leg = 1; zb.walkTime = 0; zb.walking = false; zb.delay = 1.5;   // diam sebentar, lalu jalan
  zb.y = groundAt(zb.x, zb.z);
}
// ketinggian permukaan: tanah kuburan → apron → trotoar → aspal → trotoar → rumput halaman
function groundAt(x, z) {
  if (z > -765) return graveyard.getTerrainHeight(x, z);
  if (z > -788) return 11.85;
  if (z > -812) return 12.1;
  if (z > -976) return 11.5;
  if (z > -1024) return 12.1;
  return LAWN_Y;
}
function updateZombie(dt) {
  if (zb.delay > 0) { zb.delay -= dt; zb.walking = false; }
  else if (zb.leg < ZOMBIE_PATH.length) {
    const [tx, tz] = ZOMBIE_PATH[zb.leg];
    const dx = tx - zb.x, dz = tz - zb.z, dist = Math.hypot(dx, dz);
    // ROTATE: belok halus ke titik berikutnya (2.2 rad/s, sama seperti controller teman)
    let d = Math.atan2(dx, dz) - zb.yaw;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    zb.yaw += Math.sign(d) * Math.min(Math.abs(d), dt * 2.2);
    // TRANSLATE: maju searah hadap
    const step = Math.min(dist, ZOMBIE_SPEED * dt);
    zb.x += Math.sin(zb.yaw) * step; zb.z += Math.cos(zb.yaw) * step;
    if (dist < 4) zb.leg++;
    zb.walking = true; zb.walkTime += dt;
  } else {
    zb.walking = false;                                  // sampai: berdiri mengancam di depan tanaman
    let d = Math.PI - zb.yaw;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    zb.yaw += Math.sign(d) * Math.min(Math.abs(d), dt * 2.2);
  }
  zb.y += (groundAt(zb.x, zb.z) - zb.y) * Math.min(1, dt * 10);   // naik-turun trotoar dengan halus
}
const zombieWorld = () => M(m4.T(zb.x, zb.y, zb.z), m4.Y(zb.yaw), m4.S(ZOMBIE_SCALE, ZOMBIE_SCALE, ZOMBIE_SCALE));
// kacang mengenai zombie kalau masuk silinder badan (radius ~0.45, tinggi ~2.2 satuan lokal)
function zombieHit(p) {
  return Math.hypot(p[0] - zb.x, p[2] - zb.z) < 0.45 * ZOMBIE_SCALE && p[1] > zb.y && p[1] < zb.y + 2.2 * ZOMBIE_SCALE;
}
zombieReset();

/* ---------------- 3. Kamera drone ---------------- */
const focus = [
  (sunflower.stage[12] + peashooter.stage[12]) / 2, 40,
  (sunflower.stage[14] + peashooter.stage[14]) / 2 + 120,
];
const camera = new DroneCamera(cv, { focus });

/* ---------------- 4. Kontrol animasi (tanpa UI di layar) ---------------- */
// Yang dipencet hanya TRANSLATE & ROTATE. Arbitrary axis & scaling jalan otomatis (kebiasaan).
const KEYMAP = {
  Digit1: [sunflower, "sun"],     // Sunflower translate: keluarkan Sun
  Digit2: [sunflower, "sway"],    // Sunflower rotate   : kepala goyang kiri-kanan
  Digit3: [peashooter, "shoot"],  // Peashooter translate: tembak kacang
  Digit4: [peashooter, "look"],   // Peashooter rotate   : menoleh kiri-kanan
};
let showAxis = false;
window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const m = KEYMAP[e.code];
  if (m) m[0].ch.trigger(m[1]);
  else if (e.code === "KeyX") showAxis = !showAxis;
  else if (e.code === "KeyJ") zombieReset();
});

/* ---------------- 5. Loop render ---------------- */
let last = performance.now(), time = 0;
function render(dt) {
  time += dt;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(cv.clientWidth * dpr), h = Math.floor(cv.clientHeight * dpr);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  gl.viewport(0, 0, w, h);

  const V = camera.update(dt);
  const P = persp(camera.fov, w / h, 1.0, 10000.0);
  const VP = mul(P, V);
  const eye = camera.getEye();

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(0.005, 0.008, 0.016, 1.0);
  gl.clearStencil(0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

  const opts = { mode: 0, exposure: NIGHT.exposure };
  graveyard.render(VP, eye, { ...opts, sel: -1 });
  highway.render(VP, eye, opts);
  house.render(VP, eye, opts);

  // karakter (toon + outline + bayangan bulan di rumput)
  gl.bindVertexArray(null);
  for (const c of cast) c.update(dt, time, eye, showAxis);
  toon.drawScene(cast.map((c) => c.group), { view: V, proj: P, eye });

  // zombie (renderer milik teman)
  updateZombie(dt);
  zombie.update(dt, { animOn: true, isWalking: zb.walking, walkTime: zb.walkTime, riseProgress: 1.0, real: true });
  zombie.render(P, V, zombieWorld(), eye);
}

// ?still → tanpa loop otomatis (dipakai untuk screenshot laporan lewat SCENE.step)
const STILL = new URLSearchParams(location.search).has("still");
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  render(dt);
  requestAnimationFrame(frame);
}
if (!STILL) requestAnimationFrame(frame);

// akses dari console (debug / screenshot laporan)
window.SCENE = {
  camera, sunflower, peashooter, zombie, zb, zombieReset, toon, gl,
  step(sec = 0, fps = 30) { const n = Math.max(1, Math.round(sec * fps)); for (let i = 0; i < n; i++) render(sec / n); },
};
