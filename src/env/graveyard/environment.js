/**
 * ==============================================================================
 * GRAVEYARD ENVIRONMENT MODULE — LANGIT MALAM & LANDSCAPE RUMPUT
 * ==============================================================================
 * 1. LANGIT MALAM (Night Sky Dome):
 *    - Kubah langit sferis beradius 4800 unit
 *    - Gradien malam biru laut/indigo dari ufuk ke puncak langit
 *    - Bintang-bintang malam berkerlip halus & jalur Bima Sakti
 *    - Piringan bulan perak (Moon) searah sumber cahaya utama kuburan
 *    - Pendar halo cahaya bulan dan awan tipis nokturnal
 *
 * 2. LANDSCAPE RUMPUT LUAR (Outer Grassy Landscape):
 *    - Hamparan perbukitan rumput luas beradius ~4500 unit di sekeliling kuburan
 *    - Bagian tengah rata di ketinggian y = 10.535 menyatu mulus tanpa batas dengan makam
 *    - Perbukitan bergelombang lembut di kejauhan
 *    - Shader rumput hijau alami dengan kabut atmosferik malam di ufuk
 * ==============================================================================
 */

import { m4 } from "../core/transform.js";

export function createEnvironment(gl, U, ID4, getTerrainHeight) {
  // ---------------------------------------------------------------------------
  // 1. BANGUN MESH SKYDOME
  // ---------------------------------------------------------------------------
  const skyRadius = 4800;
  const latBands = 24;
  const lonBands = 36;
  const skyVerts = [];
  const skyIndices = [];

  for (let lat = 0; lat <= latBands; lat++) {
    // Mulai sedikit di bawah ufuk (-15 derajat) hingga zenith (+90 derajat)
    const phi = -Math.PI / 12 + (lat / latBands) * (Math.PI / 2 + Math.PI / 12);
    const cp = Math.cos(phi);
    const sp = Math.sin(phi);

    for (let lon = 0; lon <= lonBands; lon++) {
      const theta = (lon / lonBands) * 2 * Math.PI;
      const ct = Math.cos(theta);
      const st = Math.sin(theta);
      skyVerts.push(skyRadius * cp * ct, skyRadius * sp, skyRadius * cp * st);
    }
  }

  const skyCols = lonBands + 1;
  for (let lat = 0; lat < latBands; lat++) {
    for (let lon = 0; lon < lonBands; lon++) {
      const a = lat * skyCols + lon;
      const b = a + 1;
      const c = (lat + 1) * skyCols + lon;
      const d = c + 1;
      // Menghadap ke dalam (inward-facing): a -> c -> b, b -> c -> d
      skyIndices.push(a, c, b, b, c, d);
    }
  }

  const skyVao = gl.createVertexArray();
  gl.bindVertexArray(skyVao);

  const skyVbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, skyVbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(skyVerts), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

  const skyIbo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, skyIbo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(skyIndices), gl.STATIC_DRAW);

  gl.bindVertexArray(null);

  // ---------------------------------------------------------------------------
  // 2. BANGUN MESH LANDSCAPE RUMPUT LUAR (DENGAN LUBANG UNTUK AREA KUBURAN)
  // ---------------------------------------------------------------------------
  // Batas area kuburan asli (Plane):
  // X dari -537.82 s/d +537.82, Z dari -794.77 s/d +525.93.
  // Pagar kuburan berada di dalam area ini (X sekitar ±500, Z sekitar -765 s/d 482).
  // Mesh landscape rumput luar HANYA dibangun di LUAR area ini dan tidak ada
  // satupun poligon/vertis di DALAM pagar/area makam agar tidak merusak rumput & jalan
  // setapak kuburan yang sudah ada.
  // ---------------------------------------------------------------------------
  const N_rings = 36;
  const N_pts = 144;
  const R_out = 4800;

  // Batas persegi panjang dasar kuburan (Plane)
  const cx = 0;
  const cz = -134.418;
  const rx0 = 537.8171;
  const rz0 = 660.3497;
  // Sedikit overlap (1.5 unit) di bawah tepi Plane agar tidak ada celah/gap
  const rxInner = rx0 - 1.5;
  const rzInner = rz0 - 1.5;

  const landVerts = [];
  const landIndices = [];

  for (let i = 0; i < N_rings; i++) {
    const u = i / (N_rings - 1);
    // Kerapatan ring lebih rapat di dekat batas makam lalu merenggang ke ufuk
    const s = Math.pow(u, 1.4);

    for (let j = 0; j < N_pts; j++) {
      const theta = (j / N_pts) * 2 * Math.PI;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      // Titik potong sinar dari tengah ke persegi panjang batas makam
      const dxInner = rxInner / Math.max(Math.abs(cosT), 1e-5);
      const dzInner = rzInner / Math.max(Math.abs(sinT), 1e-5);
      const dInner = Math.min(dxInner, dzInner);

      const xInner = cx + dInner * cosT;
      const zInner = cz + dInner * sinT;

      // Ketinggian di tepi kuburan dari getTerrainHeight (sedikit diturunkan 0.1 agar Plane di atasnya)
      const yEdge = (getTerrainHeight ? getTerrainHeight(xInner, zInner) : 10.535) - 0.1;

      // Jarak radial ring saat ini dari tepi makam
      const dist = (R_out - dInner) * s;
      const d = dInner + dist;

      const x = cx + d * cosT;
      const z = cz + d * sinT;

      // Interpolasi ketinggian tanah:
      // Di dekat kuburan (dist < 150): menyatu mulus dari ketinggian tepi kuburan ke 10.535
      const t0 = Math.min(1.0, dist / 150.0);
      const w0 = t0 * t0 * (3 - 2 * t0);
      let yBase = (1.0 - w0) * yEdge + w0 * 10.535;

      // Di koridor jalan raya (Z antara -1060 s/d -760):
      // Tanah dasar berada di Y = 10.20 (di bawah badan aspal Y = 11.50 dan trotoar Y = 12.10)
      if (z >= -1060.0 && z <= -760.0) {
        yBase = 10.20;
      } else if (z > -760.0 && z < -735.0) {
        const tr = (-735.0 - z) / 25.0;
        yBase = (1.0 - tr) * yBase + tr * 10.20;
      }

      // Di kejauhan (dist > 180): bergelombang menjadi perbukitan rumput
      const th = Math.min(1.0, Math.max(0.0, (dist - 180.0) / 800.0));
      const wh = th * th * (3 - 2 * th);
      const hills =
        Math.sin(x * 0.0016) * Math.cos(z * 0.0016) * 65.0 +
        Math.sin(x * 0.0035 + 1.2) * Math.sin(z * 0.0035) * 22.0;

      // Koridor bebas bukit yang lapang untuk jalan raya dan pekarangan rumah megah
      // Jalan raya berada di Z [-1000 s/d -788], dengan trotoar & apron di [-1025 s/d -765].
      let roadMask = 1.0;
      const isNearCemetery = Math.abs(x) <= 550.0;
      const zNorthFlat = isNearCemetery ? -750.0 : -660.0;
      const zNorthFade = isNearCemetery ? -730.0 : -500.0;
      const zSouthFlat = -1120.0;
      const zSouthFade = -1300.0;

      if (z >= zSouthFlat && z <= zNorthFlat) {
        roadMask = 0.0;
      } else if (z > zNorthFlat && z < zNorthFade) {
        roadMask = (z - zNorthFlat) / (zNorthFade - zNorthFlat);
      } else if (z < zSouthFlat && z > zSouthFade) {
        roadMask = (zSouthFlat - z) / (zSouthFlat - zSouthFade);
      } else if (z <= zSouthFade || z >= zNorthFade) {
        roadMask = 1.0;
      }
      roadMask = Math.max(0.0, Math.min(1.0, roadMask));

      let houseMask = 1.0;
      if (z <= -1000.0 && z >= -2060.0) {
        const dx = Math.abs(x - 125.0);
        if (dx <= 460.0) {
          houseMask = 0.0;
        } else if (dx < 620.0) {
          houseMask = (dx - 460.0) / 160.0;
        }
      } else if (z < -2060.0 && z > -2240.0) {
        const dx = Math.abs(x - 125.0);
        const zFade = (-2060.0 - z) / 180.0;
        if (dx <= 460.0) {
          houseMask = zFade;
        } else if (dx < 620.0) {
          const xFade = (dx - 460.0) / 160.0;
          houseMask = Math.max(zFade, xFade);
        }
      }
      houseMask = Math.max(0.0, Math.min(1.0, houseMask));

      const flatMask = Math.min(roadMask, houseMask);

      const y = yBase + wh * hills * flatMask;
      landVerts.push(x, y, z);
    }
  }

  for (let i = 0; i < N_rings - 1; i++) {
    for (let j = 0; j < N_pts; j++) {
      const jNext = (j + 1) % N_pts;
      const v00 = i * N_pts + j;
      const v10 = i * N_pts + jNext;
      const v01 = (i + 1) * N_pts + j;
      const v11 = (i + 1) * N_pts + jNext;
      landIndices.push(v00, v01, v10, v10, v01, v11);
    }
  }

  const landVao = gl.createVertexArray();
  gl.bindVertexArray(landVao);

  const landVbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, landVbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(landVerts), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

  const landIbo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, landIbo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(landIndices), gl.STATIC_DRAW);

  gl.bindVertexArray(null);

  // ---------------------------------------------------------------------------
  // 3. FUNGSI RENDER
  // ---------------------------------------------------------------------------
  function renderSky(camEye, VP, exposure) {
    gl.bindVertexArray(skyVao);

    // Kubah langit bergerak mengikuti kamera horizontal agar tidak pernah terpotong
    const skyM = m4.T(camEye[0], 0, camEye[2]);
    gl.uniformMatrix4fv(U.uM, false, skyM);
    gl.uniform3fv(U.uC, [0, 0, 0]);
    gl.uniform3fv(U.uH, [1, 1, 1]);
    gl.uniformMatrix4fv(U.uR, false, ID4);
    gl.uniform1f(U.uA, 1.0);
    gl.uniform1i(U.uTerrain, 10); // 10 = Shader Langit Malam

    // Nonaktifkan penulisan depth buffer agar langit selalu di latar belakang
    gl.depthMask(false);
    gl.drawElements(gl.TRIANGLES, skyIndices.length, gl.UNSIGNED_SHORT, 0);
    gl.depthMask(true);

    gl.uniform1i(U.uTerrain, 0);
    gl.bindVertexArray(null);
  }

  function renderLandscape(camEye, VP, exposure) {
    gl.bindVertexArray(landVao);

    gl.uniformMatrix4fv(U.uM, false, ID4);
    gl.uniform3fv(U.uC, [0, 0, 0]);
    gl.uniform3fv(U.uH, [1, 1, 1]);
    gl.uniformMatrix4fv(U.uR, false, ID4);
    gl.uniform1f(U.uA, 1.0);
    gl.uniform1i(U.uTerrain, 9); // 9 = Shader Landscape Rumput Luar

    gl.drawElements(gl.TRIANGLES, landIndices.length, gl.UNSIGNED_SHORT, 0);

    gl.uniform1i(U.uTerrain, 0);
    gl.bindVertexArray(null);
  }

  return {
    renderSky,
    renderLandscape,
  };
}
