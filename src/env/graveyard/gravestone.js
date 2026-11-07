import { OBJEK_GRAVEYARD } from "./data.js";
import { UM } from "../../core/geometry.js";

// =====================================================================
//  BATU NISAN, ALAS & PELAT MAKAM (versi sederhana)
// =====================================================================
//  Semua batu nisan dan balok makam di depan nisan dibuat sebagai
//  KOTAK BIASA (balok 6 sisi = 12 segitiga) dengan warna polos.
// =====================================================================
const GROUND_Y = 10.535; // tinggi tanah dasar

// Daftar objek batu nisan dan alas makam (Cube.001 s/d Cube.018)
const GRAVESTONE_NAMES = new Set([
  "Cube.001",
  "Cube.002",
  "Cube.003",
  "Cube.004",
  "Cube.005",
  "Cube.006",
  "Cube.007",
  "Cube.008",
  "Cube.009",
  "Cube.010",
  "Cube.011",
  "Cube.012",
  "Cube.013",
  "Cube.014",
  "Cube.015",
  "Cube.016",
  "Cube.017",
  "Cube.018"
]);

// Daftar objek balok/pelat di atas kuburan (Cube.019 s/d Cube.032)
const GRAVESLAB_STYLE = {
  "Cube.019": "rim",
  "Cube.020": "rim",
  "Cube.021": "rim",
  "Cube.022": "cover",
  "Cube.023": "cover",
  "Cube.024": "rim",
  "Cube.025": "cover",
  "Cube.026": "rim",
  "Cube.027": "rim",
  "Cube.028": "cover",
  "Cube.029": "rim",
  "Cube.030": "rim",
  "Cube.031": "rim",
  "Cube.032": "rim",
};

// ---- Kotak biasa: 6 sisi × 2 segitiga ----
/**
 * Menghasilkan daftar titik koordinat segitiga (12 segitiga / 36 titik) untuk balok 6 sisi
 * berdasarkan batas koordinat minimum dan maksimum pada masing-masing sumbu (AABB).
 *
 * @param {number} x0 - Batas koordinat minimum pada sumbu X (sisi kiri balok).
 *        Utk mengganti: posisi batas horizontal kiri dari balok batu nisan/pelat makam.
 * @param {number} x1 - Batas koordinat maksimum pada sumbu X (sisi kanan balok).
 *        Utk mengganti: posisi batas horizontal kanan dari balok batu nisan/pelat makam.
 * @param {number} y0 - Batas koordinat minimum pada sumbu Y (sisi belakang balok).
 *        Utk mengganti: posisi batas kedalaman belakang dari balok batu nisan/pelat makam.
 * @param {number} y1 - Batas koordinat maksimum pada sumbu Y (sisi depan balok).
 *        Utk mengganti: posisi batas kedalaman depan dari balok batu nisan/pelat makam.
 * @param {number} z0 - Batas koordinat minimum pada sumbu Z (sisi bawah/dasar balok).
 *        Utk mengganti: posisi batas dasar vertikal balok (misal dipanjangkan menancap ke bawah tanah).
 * @param {number} z1 - Batas koordinat maksimum pada sumbu Z (sisi atas/puncak balok).
 *        Utk mengganti: posisi batas elevasi puncak atas balok batu nisan/pelat makam.
 * @returns {Array<[number, number, number]>} Array berisi titik-titik vertex [x, y, z] pembentuk segitiga balok.
 */
function boxTriangles(x0, x1, y0, y1, z0, z1) {
  const P = (x, y, z) => [x, y, z];
  const tri = [];
  const quad = (a, b, c, d) => tri.push(a, b, c, a, c, d);
  quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)); // atas
  quad(P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0)); // bawah
  quad(P(x0, y1, z0), P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0)); // depan
  quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1)); // belakang
  quad(P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1)); // kanan
  quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0)); // kiri
  return tri;
}

// ---- Bangun mesh kotak satu batu nisan / pelat makam (ternormalisasi ke [-1, 1]) ----
/**
 * Membangun array buffer vertex posisi untuk geometri balok batu nisan atau pelat kuburan,
 * dengan opsi perpanjangan dasar balok agar menancap ke dalam permukaan tanah (tidak melayang),
 * lalu menormalisasikan koordinat vertex-nya ke ruang lokal [-1, 1].
 *
 * @param {{ nama: string, matrix: number[], pusat: number[], ukuran_proksi: number[] }} ob - Objek data deskripsi batu nisan/pelat dari file data.js.
 *        - `ob.matrix`: matriks transformasi orientasi & skala dunia. Utk mengganti rotasi, skala, dan posisi dasar objek di scene.
 *        - `ob.pusat`: offset titik tengah geometri lokal [x, y, z]. Utk mengganti titik pivot balok.
 *        - `ob.ukuran_proksi`: dimensi radius/setengah ukuran balok per sumbu. Utk mengganti proporsi panjang, lebar, dan tinggi balok nisan.
 * @param {boolean} [plantToGround=true] - Menentukan apakah dasar bawah balok dipanjangkan menancap ke tanah dasar (GROUND_Y).
 *        Utk mengganti: perilaku dasar balok (true = nisan/rim diperpanjang menembus tanah agar tidak melayang di lereng bergelombang; false = pelat penutup/cover tetap dengan ketebalan aslinya).
 * @returns {Float32Array} Array flat vertex buffer [x, y, z, ...] ternormalisasi yang siap digabungkan ke buffer gabungan GPU (UM).
 */
function buildBoxMesh(ob, plantToGround = true) {
  const m = ob.matrix;
  const hs = [0, 1, 2].map((a) =>
    Math.max(Math.abs(ob.ukuran_proksi[a]) * Math.hypot(m[a * 4], m[a * 4 + 1], m[a * 4 + 2]), 0.01),
  );
  const centerY = m[1] * ob.pusat[0] + m[5] * ob.pusat[1] + m[9] * ob.pusat[2] + m[13];
  const ext = plantToGround ? Math.min(6, Math.max(0, centerY - hs[2] - (GROUND_Y - 1.5))) : 0;
  const flipZ = m[9] < 0 ? -1 : 1;

  let z0 = -hs[2] - ext,
    z1 = hs[2];
  if (flipZ < 0) [z0, z1] = [-z1, -z0];
  const tri = boxTriangles(-hs[0], hs[0], -hs[1], hs[1], z0, z1);

  const out = new Float32Array(tri.length * 3);
  tri.forEach((p, j) => {
    for (let a = 0; a < 3; a++) out[j * 3 + a] = p[a] / hs[a];
  });
  return out;
}

// Daftarkan mesh tiap batu nisan & pelat makam -> GRAVESTONE_RANGE[indeks objek]
const GRAVESTONE_RANGE = new Map();
/**
 * Fungsi IIFE (Immediately Invoked Function Expression) untuk mengumpulkan seluruh geometri batu nisan
 * dan pelat makam dari OBJEK_GRAVEYARD, mengonversinya menjadi mesh kotak balok,
 * lalu menggabungkannya ke dalam Unified Mesh (UM) buffer GPU sekaligus memetakan range indeksnya ke GRAVESTONE_RANGE.
 */
(function addGravestonesAndSlabs() {
  const meshes = [];
  OBJEK_GRAVEYARD.forEach((ob, i) => {
    if (GRAVESTONE_NAMES.has(ob.nama)) {
      meshes.push([i, buildBoxMesh(ob, true)]);
    } else if (GRAVESLAB_STYLE[ob.nama]) {
      meshes.push([i, buildBoxMesh(ob, GRAVESLAB_STYLE[ob.nama] === "rim")]);
    }
  });
  const total = meshes.reduce((sum, [, m]) => sum + m.length, 0);
  const merged = new Float32Array(UM.arr.length + total);
  merged.set(UM.arr);
  let offset = UM.arr.length;
  for (const [i, m] of meshes) {
    merged.set(m, offset);
    UM.ranges.push([offset / 3, m.length / 3]);
    GRAVESTONE_RANGE.set(i, UM.ranges.length - 1);
    offset += m.length;
  }
  UM.arr = merged;
})();

export { GROUND_Y, GRAVESTONE_RANGE };
