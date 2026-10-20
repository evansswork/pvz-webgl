// ---------- shader ----------
const vs = `#version 300 es
layout(location=0) in vec3 aP;
uniform mat4 uVP, uM, uR;
uniform vec3 uC, uH;
out vec3 vP;
out vec3 vL;
void main() {
vL = aP; // koordinat lokal kotak (-1..1), dipakai shader tembok utk jarak ke tepi
// uR: transformasi lokal tambahan per-bagian (identitas utk objek biasa)
vec3 p = (uR * vec4(aP * uH, 1.0)).xyz + uC;
vP = (uM * vec4(p, 1.0)).xyz;
gl_Position = uVP * vec4(vP, 1.0);
}`;

const fs = `#version 300 es
precision highp float;
in vec3 vP;
uniform vec3 uCol, uCam;
uniform float uEx, uA;
uniform int uMode;
uniform int uTerrain; // 1 = sedang menggambar tanah kuburan
uniform sampler2D uSplat; // peta tanah: R = jarak ke benda, G = jarak ke jalan setapak
uniform vec2 uTerrMin, uTerrSize;

float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0)), d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.0; a *= 0.5; }
  return s / 0.9375;
}
// Warna tanah kuburan: rumput gelap, tanah lembap keabu-abuan, tanah terinjak dekat jalan & makam
vec3 terrainAlbedo(vec3 p, vec3 n) {
  vec2 uv = (p.xz - uTerrMin) / uTerrSize;
  vec2 near = texture(uSplat, uv).rg;               // 0 = dekat, 1 = jauh
  float broad = fbm(p.xz * 0.010);                  // pola besar
  float clump = fbm(p.xz * 0.045 + 11.0);           // rumpun rumput
  float fine = vnoise(p.xz * 0.8);                  // bintik halus
  float grain = vnoise(p.xz * 3.1 + 3.0);           // butiran kerikil

  // Rumput & rumput layu (rumput layu muncul di tepi bercak tanah)
  vec3 grass = mix(vec3(0.012, 0.028, 0.009), vec3(0.030, 0.040, 0.012), clump);
  vec3 deadGrass = vec3(0.022, 0.024, 0.013);

  // Tanah: cokelat tua KEABU-ABUAN (bukan oranye). Makin dekat benda makin lembap = makin gelap.
  vec3 soilDry = vec3(0.026, 0.020, 0.016);
  vec3 soilWet = vec3(0.011, 0.009, 0.008);
  float wet = clamp(fbm(p.xz * 0.07 + 23.0) * 1.4 + (1.0 - near.r) * 0.5 - 0.15, 0.0, 1.0);
  vec3 soil = mix(soilDry, soilWet, wet) * (0.8 + 0.4 * fine);

  // Seberapa "terinjak": dekat jalan setapak & benda, ditambah bercak acak
  float worn = (1.0 - near.g) * 0.9 + (1.0 - near.r) * 0.45
             + (broad - 0.5) * 0.9 + (clump - 0.5) * 0.35;
  float dirt = smoothstep(0.42, 0.62, worn);        // 0 = rumput, 1 = tanah
  float rim = smoothstep(0.32, 0.42, worn) * (1.0 - dirt); // pinggiran peralihan

  vec3 c = mix(grass, deadGrass, rim);
  c = mix(c, soil, dirt);
  c *= 0.8 + 0.4 * vnoise(p.xz * 2.7);              // variasi terang-gelap kecil

  // Kerikil kecil di atas tanah, serpihan daun kering di atas rumput
  c = mix(c, vec3(0.050, 0.048, 0.045) * (0.6 + 0.8 * fine), step(0.86, grain) * dirt * 0.7);
  float leaf = step(0.93, vnoise(p.xz * 2.3 + 5.0));
  c = mix(c, vec3(0.034, 0.026, 0.015), leaf * 0.5 * (1.0 - dirt));

  // Bayangan kontak: tanah paling gelap tepat di kaki makam / benda
  c *= mix(0.55, 1.0, smoothstep(0.0, 0.2, near.r));

  return c * (0.75 + 0.25 * n.y);                   // lereng sedikit lebih gelap
}
// Warna gundukan makam: tanah gembur lembap, gumpalan kering, kerikil, rumput liar di kaki
vec3 moundAlbedo(vec3 p, vec3 n) {
  float h = p.y - 10.535;                            // tinggi di atas tanah dasar
  float fine = vnoise(p.xz * 1.1);
  float clod = fbm(p.xz * 0.35 + 9.0);
  float grain = vnoise(p.xz * 3.4 + 1.0);
  vec3 soilDark = vec3(0.013, 0.0105, 0.009);        // tanah lembap
  vec3 soilDry = vec3(0.030, 0.024, 0.019);          // gumpalan kering
  vec3 c = mix(soilDark, soilDry, smoothstep(0.35, 0.75, clod)) * (0.75 + 0.5 * fine);
  c *= 0.85 + 0.3 * step(0.6, vnoise(p.xz * 1.9 + 4.0));          // gumpalan kecil
  c = mix(c, vec3(0.050, 0.048, 0.045) * (0.6 + 0.8 * fine), step(0.88, grain) * 0.7); // kerikil
  float fringe = 1.0 - smoothstep(0.3, 2.2, h);      // makin rendah makin berumput
  float tuft = smoothstep(0.35, 0.7, fbm(p.xz * 0.25 + 31.0) + fringe * 0.45 - 0.2);
  vec3 grass = mix(vec3(0.012, 0.028, 0.009), vec3(0.030, 0.040, 0.012), fbm(p.xz * 0.1));
  c = mix(c, grass, tuft * fringe);
  return c * (0.7 + 0.3 * n.y);
}
// Noise 3D murah: dipakai agar pola batu tidak tergantung arah hadap permukaan
float n3(vec3 p, float sc) { return vnoise(p.xz * sc + vec2(p.y * sc * 0.77, p.y * sc * 0.31)); }

// Warna batu nisan: batu abu-abu, bercak gelap, noda hujan vertikal, lumut di bawah, lumut kerak pucat
vec3 stoneAlbedo(vec3 p, vec3 n, vec3 base, float mossBias) { // mossBias < 0 = lumut lebih jarang
  float h = p.y - 10.535;                            // tinggi di atas tanah
  float grain = n3(p, 1.7);                          // butiran halus
  float blot = fbm(p.xz * 0.22 + vec2(p.y * 0.18, 0.0)); // bercak lebar
  float streak = vnoise(vec2((p.x + p.z) * 0.7, p.y * 0.045)); // noda hujan memanjang ke bawah
  vec3 c = base * (0.82 + 0.36 * grain);
  c *= 1.0 - 0.25 * smoothstep(0.55, 0.85, blot);
  c *= 1.0 - 0.28 * smoothstep(0.45, 0.8, streak) * smoothstep(0.0, 40.0, h);
  // lumut: tebal dekat tanah, bercak di atasnya, lebih suka permukaan menghadap atas
  float moss = smoothstep(0.45, 0.7, fbm(p.xz * 0.35 + p.y * 0.25 + 5.0) + (1.0 - smoothstep(0.0, 18.0, h)) * 0.55 - 0.15 + mossBias);
  vec3 mossC = mix(vec3(0.010, 0.024, 0.008), vec3(0.020, 0.034, 0.010), grain);
  c = mix(c, mossC, moss * 0.8 * (0.5 + 0.5 * n.y));
  // lumut kerak pucat (bintik)
  float lichen = step(0.82, n3(p, 0.9) * 0.6 + n3(p + 9.0, 2.3) * 0.4);
  c = mix(c, vec3(0.10, 0.105, 0.085) * (0.7 + 0.5 * grain), lichen * 0.35);
  return c * (0.8 + 0.2 * n.y);
}
uniform vec4 uDoor; // x = tengah pintu, y = tinggi awal lengkung, z = tepi kiri daun pintu, w = lebar satu papan

// Kayu pintu: papan vertikal, serat memanjang, simpul, makin gelap & lembap ke bawah
vec3 woodAlbedo(vec3 p, vec3 n) {
  float plankW = uDoor.w;
  float u = (p.x - uDoor.z) / plankW;
  float id = floor(u), f = fract(u);
  float tint = hash21(vec2(id, 7.0));
  vec3 woodA = vec3(0.028, 0.020, 0.015), woodB = vec3(0.052, 0.038, 0.027);
  vec3 c = mix(woodA, woodB, tint * 0.8 + 0.2 * vnoise(p.xy * 0.2));
  float grain = vnoise(vec2(p.x * 2.6 + id * 3.7, p.y * 0.14));   // serat memanjang
  float fine = vnoise(vec2(p.x * 9.0 + id * 5.0, p.y * 0.5));     // serat halus
  c *= (0.65 + 0.55 * grain) * (0.85 + 0.3 * fine);
  float knot = smoothstep(0.78, 0.95, vnoise(vec2(p.x * 0.35 + id * 4.1, p.y * 0.09)));
  c *= 1.0 - 0.45 * knot;                                         // simpul kayu
  float edge = min(f, 1.0 - f) * plankW;
  c *= mix(0.25, 1.0, smoothstep(0.2, 1.2, edge));                // alur antar papan gelap
  c *= mix(0.6, 1.05, clamp((p.y - 54.5) / 175.0, 0.0, 1.0));    // bawah lebih gelap / lembap
  return c * (0.85 + 0.15 * n.y);
}

// Besi tua: hitam kebiruan dengan bercak karat
vec3 ironAlbedo(vec3 p, vec3 n) {
  float rust = smoothstep(0.55, 0.8, fbm(p.xy * 0.35 + 3.0));
  vec3 c = mix(vec3(0.011, 0.011, 0.013), vec3(0.040, 0.024, 0.016), rust * 0.7);
  c *= 0.7 + 0.6 * vnoise(p.xy * 2.2);
  return c * (0.8 + 0.2 * n.y);
}

// Batu bingkai pintu: batu lapuk + sambungan batu busur (melingkar di lengkung, mendatar di tiang)
vec3 frameStone(vec3 p, vec3 n) {
  vec3 c = stoneAlbedo(p, n, vec3(0.115, 0.115, 0.125), -0.25);
  vec2 q = p.xy - vec2(uDoor.x, uDoor.y);
  float d;
  if (q.y > 0.0) {
    float r = length(q), a = atan(q.y, q.x), st = 3.14159 / 13.0, fa = fract(a / st);
    d = min(fa, 1.0 - fa) * st * r;                                 // jarak ke sambungan melingkar
  } else {
    float fy = fract(p.y / 26.0);
    d = min(fy, 1.0 - fy) * 26.0;                                   // jarak ke sambungan mendatar
  }
  return c * (1.0 - 0.55 * (1.0 - smoothstep(0.25, 0.65, d)));
}

// =====================================================================
//  TEMBOK RUMAH (mausoleum): plester tua + bata terkelupas
//  Satuan dunia model ~ 1 cm (pintu setinggi ~190), jadi ukuran bata
//  (22 x 7,6) dan tebal plester (~2) dibuat dalam skala itu.
//  Semua pola memakai koordinat DUNIA -> kubus-kubus fasad menyambung
//  mulus seperti satu tembok, tanpa tekstur gambar (murni prosedural).
// =====================================================================
in vec3 vL;          // koordinat lokal kotak (-1..1)
uniform vec3 uHW;    // setengah ukuran kotak per sumbu lokal, satuan dunia

// Proyeksi 2D menurut sisi yang menghadap: dinding tegak -> (mendatar, tinggi)
vec2 wallUV(vec3 p, vec3 n) {
  vec3 a = abs(n);
  if (a.x > a.z && a.x > a.y) return vec2(p.z, p.y);
  if (a.z > a.y) return vec2(p.x, p.y);
  return vec2(p.x, p.z);
}
// Jarak (satuan dunia) fragmen ke tepi terdekat pada sisi kotak yang sedang digambar
float boxEdgeDist() {
  vec3 a = abs(vL);
  vec3 w = (1.0 - a) * uHW;
  if (a.x >= a.y && a.x >= a.z) return min(w.y, w.z);
  if (a.y >= a.z) return min(w.x, w.z);
  return min(w.x, w.y);
}
// Bump mapping tanpa tangent (Mikkelsen): h dalam satuan dunia, hasilnya normal baru
vec3 bumpNormal(vec3 p, vec3 n, float h, float amp) {
  vec3 dpx = dFdx(p), dpy = dFdy(p);
  float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);
  float det = dot(dpx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  vec3 tilt = amp * grad / max(abs(det), 1e-8);   // kemiringan permukaan
  float tl = length(tilt);
  if (tl > 0.9) tilt *= 0.9 / tl;                  // batasi ~42 derajat agar tepi tidak hitam
  return normalize(n - tilt);
}

// fp = ukuran piksel di dunia (untuk meredam detail halus yang berkedip dari jauh)
vec3 wallAlbedo(vec3 p, vec3 n, float fp, out float H) {
  vec2 q = wallUV(p, n);
  float gh = max(p.y - 10.535, 0.0);                       // tinggi dari tanah
  float vm = 1.0 - smoothstep(0.6, 0.9, abs(n.y));         // 1 = bidang tegak, 0 = datar
  float e = boxEdgeDist();

  // ---- plester dasar: kapur keabu-abuan, bercak lebar + butir pasir ----
  float big = fbm(q * 0.012 + 3.0);
  float mid = fbm(q * 0.06 + 17.0);
  float grit = vnoise(q * 1.7) * 0.6 + vnoise(q * 4.3 + 8.0) * 0.4;
  float gf = 1.0 / (1.0 + 1.5 * fp);                       // detail halus hilang dari jauh
  vec3 col = mix(vec3(0.135, 0.131, 0.122), vec3(0.178, 0.170, 0.153), big);
  col *= (0.84 + 0.30 * mid) * (1.0 + 0.12 * (grit - 0.5) * gf);

  // ---- noda hujan memanjang ke bawah (makin pekat ke atas, kehijauan) ----
  float st = vnoise(vec2(q.x * 0.20, q.y * 0.009)) * 0.55 + vnoise(vec2(q.x * 0.85 + 5.0, q.y * 0.018)) * 0.45;
  float streak = smoothstep(0.50, 0.78, st) * vm * (0.30 + 0.70 * smoothstep(15.0, 150.0, gh));
  col = mix(col, col * vec3(0.55, 0.60, 0.52), streak * 0.75);

  // ---- lembap naik dari tanah + garam putih tepat di atas garis lembap ----
  float dampLine = 30.0 + 34.0 * fbm(vec2(q.x * 0.03, 1.7)) + 8.0 * vnoise(vec2(q.x * 0.4, 2.0));
  float damp = (1.0 - smoothstep(dampLine - 14.0, dampLine + 8.0, gh)) * vm;
  col *= 1.0 - 0.42 * damp;
  float salt = (1.0 - clamp(abs(gh - (dampLine + 12.0)) / 12.0, 0.0, 1.0)) * smoothstep(0.50, 0.72, mid) * vm;
  col = mix(col, vec3(0.30, 0.295, 0.27) * (0.8 + 0.4 * grit), salt * 0.30);

  // ---- lumut: tebal di kaki tembok, bercak ke atas; permukaan datar (atas) lebih berlumut ----
  float mossN = fbm(q * 0.09 + vec2(0.0, 40.0));
  float low = 1.0 - smoothstep(0.0, 75.0, gh);
  float moss = smoothstep(0.50, 0.72, mossN + low * 0.55 * vm + (1.0 - vm) * 0.28 - 0.20);
  vec3 mossC = mix(vec3(0.010, 0.024, 0.008), vec3(0.021, 0.036, 0.010), grit);
  col = mix(col, mossC, moss * 0.85);
  float lichen = smoothstep(0.80, 0.86, fbm(q * 0.16 + 9.0)) * (1.0 - low * 0.5);
  col = mix(col, vec3(0.115, 0.120, 0.095) * (0.8 + 0.4 * mid), lichen * 0.40);

  float lost = 0.0;   // plester utuh (tanpa bata)
  float rim = 0.0;

  // ---- retakan rambut: garis kontur noise yang dibelokkan ----
  vec2 qw = q + (vec2(fbm(q * 0.05 + 4.0), fbm(q * 0.05 + 9.0)) - 0.5) * 18.0;
  float cn = fbm(qw * 0.022 + 77.0);
  float crack = (1.0 - smoothstep(0.0, 0.010 + 0.004 * fp, abs(cn - 0.5)))
              * smoothstep(0.46, 0.60, fbm(q * 0.012 + 31.0)) * vm;
  float pit = step(0.975, vnoise(q * 0.9 + 3.0)) * vm * gf;   // pori / lubang kecil

  // ---- gabung ----
  col *= 1.0 - 0.62 * crack * (1.0 - lost);
  col *= 1.0 - 0.30 * rim;
  col *= 1.0 - 0.35 * pit;
  col *= 1.0 - 0.30 * (1.0 - smoothstep(0.0, 1.6, e)) * (1.0 - lost);   // nat antar bagian
  col *= mix(0.50, 1.0, smoothstep(0.0, 45.0, gh));          // bayangan kontak di kaki tembok

  float hPl = (grit - 0.5) * 0.10 * gf + (mid - 0.5) * 1.0 - 0.9 * crack - 0.5 * pit + 0.35 * rim;
  H = hPl;
  return col;
}
// =====================================================================
//  LANGIT MALAM & LANDSCAPE RUMPUT LUAR
// =====================================================================
vec3 nightSkyColor(vec3 p, vec3 cam) {
  vec3 d = normalize(p - cam);
  float h = clamp(d.y, -0.05, 1.0);

  // 1. Gradien langit malam (horizon ke puncak langit)
  vec3 zenithCol = vec3(0.003, 0.006, 0.016);   // Biru-hitam gelap di puncak
  vec3 midSkyCol = vec3(0.010, 0.018, 0.042);   // Biru malam / indigo
  vec3 horizonCol = vec3(0.024, 0.038, 0.068);  // Kabut biru laut malam di ufuk

  float midFactor = smoothstep(0.0, 0.35, h);
  float topFactor = smoothstep(0.2, 0.95, h);
  vec3 sky = mix(horizonCol, midSkyCol, midFactor);
  sky = mix(sky, zenithCol, topFactor);

  // 2. Bulan (The Moon) - searah cahaya utama kuburan: vec3(0.5, 0.9, 0.4)
  vec3 moonDir = normalize(vec3(0.5, 0.9, 0.4));
  float moonDot = dot(d, moonDir);

  // Piringan bulan (sharp moon disc)
  float moonRadius = 0.9982;
  if (moonDot > moonRadius) {
    float crater = fbm(d.xy * 80.0 + d.z * 50.0);
    vec3 moonBase = vec3(0.92, 0.96, 1.0); // Perak bercahaya
    vec3 moonDark = vec3(0.70, 0.76, 0.85); // Kawah gelap
    vec3 moonColor = mix(moonBase, moonDark, crater * 0.45);
    sky = moonColor * 1.6;
  }

  // Pendar cahaya bulan (Moon halo / glow)
  float haloNear = pow(max(moonDot, 0.0), 32.0) * 0.45;
  float haloWide = pow(max(moonDot, 0.0), 6.0) * 0.18;
  vec3 haloColor = vec3(0.35, 0.45, 0.65);
  sky += haloColor * (haloNear + haloWide);

  // 3. Bintang-bintang malam (Stars)
  if (h > 0.02) {
    vec2 starUV = vec2(atan(d.z, d.x) * 35.0, asin(clamp(d.y, -1.0, 1.0)) * 70.0);
    vec2 id = floor(starUV);
    float rnd = hash21(id);

    if (rnd > 0.88) {
      vec2 center = id + vec2(hash21(id + 1.2), hash21(id + 3.7));
      float distToStar = length(starUV - center);
      float starBrightness = smoothstep(0.35, 0.0, distToStar);
      float twinkle = 0.7 + 0.3 * sin(rnd * 60.0 + uEx * 2.0);
      float starSize = hash21(id + 9.1);
      vec3 starColor = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.95, 0.8), starSize);
      sky += starColor * starBrightness * twinkle * (0.4 + 0.6 * starSize) * smoothstep(0.02, 0.15, h);
    }

    // Jalur galaksi / Bima Sakti halus
    float galaxyBand = smoothstep(0.65, 0.0, abs(d.x * 0.6 + d.z * 0.8 - 0.2));
    float galaxyDust = fbm(d.xz * 10.0 + d.y * 6.0) * galaxyBand;
    sky += vec3(0.015, 0.022, 0.038) * galaxyDust * smoothstep(0.1, 0.4, h);
  }

  // 4. Awan tipis malam (Night clouds)
  if (h > 0.03) {
    vec2 cloudUV = d.xz / (d.y + 0.12) * 1.5;
    float cloudNoise = fbm(cloudUV * 0.8 + vec2(1.2, 0.7));
    float cloudDensity = smoothstep(0.48, 0.72, cloudNoise) * 0.20;
    vec3 cloudColor = mix(vec3(0.018, 0.025, 0.045), vec3(0.06, 0.08, 0.13), haloNear);
    sky = mix(sky, cloudColor, cloudDensity * smoothstep(0.03, 0.25, h));
  }

  return sky;
}

vec3 outerLandscapeAlbedo(vec3 p, vec3 n) {
  float broad = fbm(p.xz * 0.0035);
  float clump = fbm(p.xz * 0.025 + 7.0);
  float fine = vnoise(p.xz * 0.4);

  // Rumput malam bernuansa hijau alami
  vec3 grassDark = vec3(0.010, 0.025, 0.008);
  vec3 grassLight = vec3(0.022, 0.042, 0.015);
  vec3 meadow = vec3(0.016, 0.032, 0.012);

  vec3 col = mix(grassDark, grassLight, clump);
  col = mix(col, meadow, broad * 0.5);
  col *= 0.85 + 0.3 * fine;

  return col * (0.75 + 0.25 * n.y);
}

out vec4 fC;
void main() {
// 10. Langit malam (Night sky dome)
if (uTerrain == 10) {
  vec3 sky = nightSkyColor(vP, uCam);
  fC = vec4(sky * uEx, 1.0);
  return;
}

vec3 dx = dFdx(vP);
vec3 dy = dFdy(vP);
vec3 n = normalize(cross(dx, dy));

vec3 v = normalize(uCam - vP);
if (dot(n, v) < 0.0) n = -n;
vec3 n0 = n;

// Tembok rumah: warna + tinggi permukaan prosedural, lalu normal digeser (bump).
// Cahaya utama scene datang dari belakang fasad, jadi relief diberi "cahaya relief"
// lemah dari depan-atas-samping tiap sisi (rata-rata nol, hanya memperjelas tekstur).
vec3 wallCol = vec3(0.0);
float relief = 0.0;
if (uMode == 0 && uTerrain == 8) {
float fp = 0.5 * (length(dx) + length(dy));          // satuan dunia per piksel
float wh;
wallCol = wallAlbedo(vP, n, fp, wh);
float amp = smoothstep(0.0, 1.4, boxEdgeDist()) / (1.0 + 0.9 * fp);
n = bumpNormal(vP, n, wh, amp);
vec3 T = cross(vec3(0.0, 1.0, 0.0), n0);
T = dot(T, T) > 1e-4 ? normalize(T) : vec3(1.0, 0.0, 0.0);
vec3 Lf = normalize(n0 * 0.8 + vec3(0.0, 0.5, 0.0) + T * 0.5);
relief = clamp(dot(n - n0, Lf) * 0.9, -0.22, 0.22) / (1.0 + 0.8 * fp);
}

vec3 L = normalize(vec3(0.5, 0.9, 0.4));
float d = max(dot(n, L), 0.0);

float h = n.y * 0.5 + 0.5;
vec3 amb = mix(vec3(0.4, 0.45, 0.55), vec3(0.8, 0.9, 1.0), h);

vec3 l = amb * 0.8 + vec3(1.0, 0.95, 0.85) * d * 0.6;
l = max(l + relief * vec3(1.0, 0.97, 0.9), vec3(0.02));

if (uMode == 0) {
vec3 albedo = uCol;
  if (uTerrain == 1) albedo = terrainAlbedo(vP, n); // tanah kuburan
  else if (uTerrain == 2) albedo = moundAlbedo(vP, n); // gundukan makam
  else if (uTerrain == 3) albedo = stoneAlbedo(vP, n, uCol, 0.0); // batu nisan
  else if (uTerrain == 4) albedo = stoneAlbedo(vP, n, uCol, -0.3); // pelat & peti makam (datar)
  else if (uTerrain == 5) albedo = woodAlbedo(vP, n); // daun pintu kayu
  else if (uTerrain == 6) albedo = ironAlbedo(vP, n); // besi pintu
  else if (uTerrain == 7) albedo = frameStone(vP, n); // bingkai batu pintu
  else if (uTerrain == 8) albedo = wallCol; // tembok rumah (plester tua + bata)
  else if (uTerrain == 9) {
    // Landscape rumput di sekitar kuburan
    vec3 grass = outerLandscapeAlbedo(vP, n);
    float distCam = length(vP.xz - uCam.xz);
    float fog = smoothstep(1000.0, 4600.0, distCam);
    vec3 fogCol = vec3(0.024, 0.038, 0.068);
    vec3 litGrass = pow(grass, vec3(0.45)) * l * uEx;
    fC = vec4(mix(litGrass, fogCol * uEx, fog), uA);
    return;
  }
  // grading malam (src/lighting.js): sedikit dingin seperti cahaya bulan + tone mapping ACES
  vec3 gc = pow(albedo, vec3(0.45)) * l * vec3(0.86, 0.93, 1.06) * uEx;
  gc = clamp((gc * (2.51 * gc + 0.03)) / (gc * (2.43 * gc + 0.59) + 0.14), 0.0, 1.0);
  fC = vec4(gc, uA);
} else {
float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
fC = vec4(uCol * l * uEx + vec3(rim * 0.3), uA);
}
}`;

export { vs, fs };
