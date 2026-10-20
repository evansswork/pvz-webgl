/* =========================================================================
   lighting.js — Satu sumber pencahayaan malam untuk seluruh scene
   -------------------------------------------------------------------------
   Konsep: "malam PvZ" — cahaya bulan biru-perak dari langit (arah bulannya
   sama dengan bulan di skydome kuburan), ditambah cahaya hangat dari rumah:
   lampu teras di bawah kanopi dan cahaya kamar yang keluar dari jendela.
   Tanaman berdiri di halaman depan rumah, jadi mereka tersorot hangat dari
   belakang-samping dan diberi rim light dingin dari bulan.

   Data di sini dipakai oleh:
   • shader rumah & jalan raya (lewat potongan GLSL `NIGHT_GLSL`)
   • renderer toon karakter (lewat `toonNightEnv()`)
   Tidak ada objek/geometri baru — hanya cahaya.
   ========================================================================= */

const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

/* ---- dunia rumah (lihat env/house/houseScene.js: S = 38, TX = 125, TZ = -1404) ---- */
const S = 38, TX = 125, TZ = -1404, YB = 10.535;
const houseToWorld = ([x, y, z]) => [TX - S * z, YB + S * y, TZ + S * x];

export const LAWN_Y = YB + S * 0.1;           // permukaan rumput pekarangan (14.335)
export const TILE = 1.88 * S;                 // lebar satu jalur rumput (71.44)
/** Pusat petak rumput: lane 0..9 (jalur belang), col 0 = paling dekat rumah */
export function lawnTile(lane, col) {
  const z0 = -9.6 + lane * 1.88;
  return [TX - S * (z0 + 0.94), LAWN_Y, TZ + S * (-4.2 + 0.94 + col * 1.88)];
}

export const NIGHT = {
  moonDir: norm([0.5, 0.9, 0.4]),             // = arah bulan di langit kuburan
  moonCol: [0.20, 0.26, 0.44],
  skyAmb: [0.036, 0.052, 0.105],              // ambient dari langit (permukaan menghadap atas)
  groundAmb: [0.018, 0.022, 0.030],           // pantulan tanah (permukaan menghadap bawah)
  fogCol: [0.024, 0.038, 0.068],
  fogDen: 0.00035,
  exposure: 1.4,
  windowGlow: [1.0, 0.70, 0.36],
  lamps: [
    // lampu teras (di bawah kanopi, depan pintu)
    { pos: houseToWorld([-5.3, 4.2, 0]), col: [1.0, 0.60, 0.28].map((c) => c * 0.8), rad: 150 },
    // cahaya kamar dari jendela bawah kiri & kanan
    { pos: houseToWorld([-4.7, 3.0, -5.8]), col: [1.0, 0.64, 0.32].map((c) => c * 0.45), rad: 150 },
    { pos: houseToWorld([-4.7, 3.0, 5.8]), col: [1.0, 0.64, 0.32].map((c) => c * 0.45), rad: 150 },
    // pendar lembut jendela lantai atas
    { pos: houseToWorld([-3.5, 8.0, 0]), col: [1.0, 0.70, 0.42].map((c) => c * 0.22), rad: 300 },
  ],
};

const v3 = (a) => `vec3(${a.map((x) => x.toFixed(4)).join(', ')})`;

/** Potongan GLSL (ES 3.00) bersama: ambient langit, bulan, lampu hangat, tone mapping */
export const NIGHT_GLSL = `
const vec3 N_MOON_DIR = ${v3(NIGHT.moonDir)};
const vec3 N_MOON_COL = ${v3(NIGHT.moonCol)};
const vec3 N_SKY_AMB = ${v3(NIGHT.skyAmb)};
const vec3 N_GND_AMB = ${v3(NIGHT.groundAmb)};
const vec3 N_FOG_COL = ${v3(NIGHT.fogCol)};
const vec3 N_WIN_GLOW = ${v3(NIGHT.windowGlow)};
const vec3 N_LAMP_POS[4] = vec3[4](${NIGHT.lamps.map((l) => v3(l.pos)).join(', ')});
const vec3 N_LAMP_COL[4] = vec3[4](${NIGHT.lamps.map((l) => v3(l.col)).join(', ')});
const float N_LAMP_RAD[4] = float[4](${NIGHT.lamps.map((l) => l.rad.toFixed(1)).join(', ')});

vec3 nightAmbient(vec3 n) { return mix(N_GND_AMB, N_SKY_AMB, n.y * 0.5 + 0.5); }
vec3 nightMoon(vec3 n) { return N_MOON_COL * max(dot(n, N_MOON_DIR), 0.0); }
// cahaya hangat rumah: lambert + redaman 1 / (1 + d²/r²)
vec3 nightLamps(vec3 p, vec3 n) {
  vec3 s = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec3 d = N_LAMP_POS[i] - p; float r = length(d);
    float att = 1.0 / (1.0 + (r * r) / (N_LAMP_RAD[i] * N_LAMP_RAD[i]));
    s += N_LAMP_COL[i] * att * max(dot(n, d / r), 0.0);
  }
  return s;
}
vec3 nightTone(vec3 x) {      // ACES filmic: highlight lembut, bayangan tetap pekat
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
`;

/** Pengaturan renderer toon (karakter) agar menyatu dengan malam environment */
export function toonNightEnv() {
  return {
    lightDir: NIGHT.moonDir,
    sunCol: [0.74, 0.76, 0.92],                 // bulan untuk karakter: sedikit lebih netral agar warna asli terbaca
    skyCol: [0.30, 0.35, 0.52],
    groundCol: [0.10, 0.13, 0.10],
    fillDir: [0, 0.3, -1], fill: 0.0,
    rimCol: [0.35, 0.45, 0.75],
    outline: [0.02, 0.025, 0.02],
    fogDen: NIGHT.fogDen, fogCol: NIGHT.fogCol,
    tone: 1, exposure: 1.6,                      // karakter: eksposur sendiri agar warna kartun tidak pudar
    groundY: LAWN_Y, shadowA: 0.42,
    lamps: NIGHT.lamps.map((l) => ({ ...l, col: l.col.map((c) => c * 0.55) })),
  };
}
