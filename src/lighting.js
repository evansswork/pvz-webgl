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

/**
 * Menormalisasi vektor 3D menjadi vektor satuan berpanjang 1 (unit vector).
 *
 * @param {[number, number, number]|number[]} v - Vektor input [x, y, z] yang akan dinormalisasi.
 *        Utk mengganti: vektor arah (misal arah sinar bulan) agar panjang magnitudonya tepat bernilai 1.0.
 * @returns {number[]} Vektor hasil normalisasi [x, y, z].
 */
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };

/* ---- dunia rumah (lihat env/house/houseScene.js: S = 38, TX = 125, TZ = -1404) ---- */
const S = 38, TX = 125, TZ = -1404, YB = 10.535;

/**
 * Mengonversi koordinat ruang lokal rumah [x, y, z] ke koordinat ruang dunia absolut (world space)
 * dengan memperhitungkan faktor skala (S), offset ketinggian tanah (YB), dan translasi dunia (TX, TZ).
 *
 * @param {[number, number, number]|number[]} param0 - Vektor koordinat lokal model rumah [x, y, z].
 *        Utk mengganti: posisi relatif suatu titik (misal lampu teras, jendela) terhadap pivot rumah.
 * @returns {[number, number, number]} Koordinat absolut [worldX, worldY, worldZ] di ruang dunia scene.
 */
const houseToWorld = ([x, y, z]) => [TX - S * z, YB + S * y, TZ + S * x];

export const LAWN_Y = YB + S * 0.1;           // permukaan rumput pekarangan (14.335)
export const TILE = 1.88 * S;                 // lebar satu jalur rumput (71.44)

/**
 * Menghitung koordinat posisi dunia [x, y, z] tepat di tengah petak rumput halaman rumah (grid PvZ).
 *
 * @param {number} lane - Indeks jalur rumput vertikal/baris (0 s/d 9, jalur belang halaman).
 *        Utk mengganti: nomor baris jalur tempat tanaman atau zombie ditempatkan.
 * @param {number} col - Indeks kolom petak rumput (0 = petak paling dekat dengan beranda rumah, bertambah ke arah halaman).
 *        Utk mengganti: jarak kolom petak dari rumah ke arah jalan/kuburan.
 * @returns {[number, number, number]} Koordinat absolut [x, y, z] pusat petak rumput di world space.
 */
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

/**
 * Mengonversi array angka JavaScript menjadi format string deklarasi vektor GLSL `vec3(x, y, z)`.
 *
 * @param {[number, number, number]|number[]} a - Array 3 elemen numerik [x, y, z].
 *        Utk mengganti: nilai komponen RGB atau koordinat xyz yang akan disisipkan ke dalam kode shader GLSL.
 * @returns {string} String representasi GLSL, contoh: "vec3(0.5000, 0.9000, 0.4000)".
 */
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

/**
 * Menghitung pencahayaan hemispherical ambient malam berdasarkan arah orientasi normal permukaan.
 *
 * @param {vec3} n - Vektor normal permukaan bidang pada koordinat dunia.
 *        Utk mengganti: orientasi arah hadap permukaan objek (menghadap langit vs menghadap tanah).
 * @return {vec3} Warna cahaya ambient gabungan antara langit malam dan pantulan tanah.
 */
vec3 nightAmbient(vec3 n) { return mix(N_GND_AMB, N_SKY_AMB, n.y * 0.5 + 0.5); }

/**
 * Menghitung intensitas pencahayaan langsung sinar bulan (directional moon light) dengan diffuse Lambertian.
 *
 * @param {vec3} n - Vektor normal permukaan bidang pada koordinat dunia.
 *        Utk mengganti: sudut kemiringan permukaan terhadap arah datangnya sinar bulan.
 * @return {vec3} Warna dan intensitas cahaya bulan yang diterima permukaan.
 */
vec3 nightMoon(vec3 n) { return N_MOON_COL * max(dot(n, N_MOON_DIR), 0.0); }

/**
 * Menghitung kontribusi akumulasi 4 sumber lampu titik hangat (point lights) dari teras dan jendela rumah
 * menggunakan peredaman kuadratis jarak (quadratic attenuation) dan diffuse Lambertian.
 *
 * @param {vec3} p - Posisi koordinat fragmen/titik permukaan di ruang dunia.
 *        Utk mengganti: letak titik permukaan yang diterangi oleh lampu-lampu rumah.
 * @param {vec3} n - Vektor normal permukaan bidang di titik p.
 *        Utk mengganti: arah hadap permukaan untuk menentukan intensitas pantulan cahaya lampu.
 * @return {vec3} Akumulasi warna cahaya hangat dari seluruh lampu titik yang menjangkau titik p.
 */
vec3 nightLamps(vec3 p, vec3 n) {
  vec3 s = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec3 d = N_LAMP_POS[i] - p; float r = length(d);
    float att = 1.0 / (1.0 + (r * r) / (N_LAMP_RAD[i] * N_LAMP_RAD[i]));
    s += N_LAMP_COL[i] * att * max(dot(n, d / r), 0.0);
  }
  return s;
}

/**
 * Menerapkan kurva tone mapping ACES filmic untuk meredam highlight terang secara mulus
 * dan mempertahankan kepekatan bayangan malam hari.
 *
 * @param {vec3} x - Warna input HDR sebelum tone mapping.
 *        Utk mengganti: nilai intensitas warna linear hasil kalkulasi akumulasi lighting.
 * @return {vec3} Warna LDR ter-tone map yang sudah di-clamp dalam rentang [0.0, 1.0].
 */
vec3 nightTone(vec3 x) {      // ACES filmic: highlight lembut, bayangan tetap pekat
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
`;

/**
 * Menghasilkan objek konfigurasi pencahayaan malam terpadu (`env`) untuk Toon Renderer karakter,
 * menyelaraskan arah sinar bulan, rim lighting, kabut malam, bayangan planar tanah, dan lampu hangat teras.
 *
 * @returns {object} Objek environment shader toon yang berisi arah cahaya, warna langit/tanah, rim light, kabut, dan data 4 point light.
 */
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
