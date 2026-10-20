import { OBJEK_GRAVEYARD } from "./data.js";
import { worldAABB } from "./entrance.js";

// =====================================================================
//  TEMBOK RUMAH (mausoleum)
//  4 balok dinding utama + kubus-kubus ornamen fasad (pilaster, cornice,
//  ornamen gable; di data aslinya berjenis "salib" tapi berwarna abu 0.148
//  dan berada di dalam denah rumah). Digambar dengan shader tembok (mode 8).
// =====================================================================
const HOUSE_WALL_NAMES = new Set(["Cube.043", "Cube.174", "Cube.182", "Cube.183"]);
const HOUSE_WALL = (function () {
  const set = new Set();
  OBJEK_GRAVEYARD.forEach((ob, i) => {
    if (HOUSE_WALL_NAMES.has(ob.nama)) {
      set.add(i);
      return;
    }
    if (ob.jenis !== "salib" || Math.abs(ob.warna[0] - 0.148) > 0.004) return;
    const b = worldAABB(ob);
    if (b.max[0] > -30 && b.min[0] < 290 && b.max[2] > -45 && b.min[2] < 420) set.add(i);
  });
  return set;
})();
// setengah ukuran kotak per sumbu lokal dalam satuan dunia (untuk jarak ke tepi)
function wallHalfWorld(ob) {
  if (ob._hw) return ob._hw;
  const m = ob.matrix;
  return (ob._hw = [0, 1, 2].map((a) =>
    Math.max(Math.abs(ob.ukuran_proksi[a]), 0.02) * Math.hypot(m[4 * a], m[4 * a + 1], m[4 * a + 2]),
  ));
}

export { HOUSE_WALL, wallHalfWorld };
