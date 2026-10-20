/**
 * ==============================================================================
 * WALL & FENCE REPAIR MODULE (GRAVEYARD)
 * ==============================================================================
 * Merapikan dinding dan pagar bagian belakang kuburan (Z ~ 482):
 * 1. Menghilangkan seluruh bongkahan puing dinding putih runtuh & jeruji besi jatuh
 *    di sudut barat laut belakang (NW, X: [-500, -250], Z: [380, 520]).
 * 2. Melengkapi pilar di X = -250 yang sebelumnya patah/hilang bagian atasnya
 *    (menambahkan kepala pilar, pelat atas, dan mahkota/capstone).
 * 3. Memasang kembali segmen dinding putih (lower & upper wall) dan pagar besi rapi
 *    pada bentang X: [-500, -250] sehingga pagar belakang menjadi utuh dan rapi
 *    seperti dinding samping.
 * ==============================================================================
 */

export function isWoodFence(ob) {
  return Boolean(
    ob.warna &&
    Math.abs(ob.warna[0] - 0.199) < 0.01 &&
    Math.abs(ob.warna[1] - 0.082) < 0.01
  );
}

export function isMainGate(ob) {
  // Pagar gerbang utama kuburan di depan jalan raya (Z ~ -768, X: [20, 235])
  return Boolean(
    ob.posisi &&
    ob.posisi[2] < -760 &&
    ob.posisi[2] > -775 &&
    ob.posisi[0] > 10 &&
    ob.posisi[0] < 245
  );
}

export function isBrokenBackWallPart(ob) {
  // Pagar kayu bekas belakang rumah (balok kayu yang berantakan/terpotong)
  if (isWoodFence(ob)) return true;

  // Pagar silinder yang bengkok/jatuh di tanah di area NW
  if (
    ob.jenis === "silinder" &&
    !ob.nama.includes("restored") &&
    ob.posisi[0] > -490 &&
    ob.posisi[0] < -250 &&
    ob.posisi[2] > 380
  ) {
    return true;
  }
  // Ujung runcing (finial cone) yang jatuh di tanah
  if (ob.nama === "Cone.042" || ob.nama === "Cone.043") return true;
  // Batang horizontal pagar yang jatuh di tanah
  if (ob.nama === "Cube.059") return true;
  // Bongkahan dinding putih yang berserakan/hancur
  if (
    ob.nama === "Cube.058" ||
    ob.nama === "Cube.110" ||
    ob.nama === "Cube.111" ||
    ob.nama === "Cube.115"
  ) {
    return true;
  }
  if (ob.nama && ob.nama.startsWith("Cube.")) {
    const num = parseInt(ob.nama.slice(5), 10);
    if (num >= 762 && num <= 838) return true;
  }
  return false;
}

function cloneTranslated(source, newName, dx, dy, dz) {
  const m = [...source.matrix];
  m[12] += dx;
  m[13] += dy;
  m[14] += dz;
  return {
    nama: newName,
    jenis: source.jenis,
    posisi: [
      source.posisi[0] + dx,
      source.posisi[1] + dy,
      source.posisi[2] + dz,
    ],
    warna: [...source.warna],
    pusat: [...source.pusat],
    ukuran: [...source.ukuran],
    ukuran_proksi: [...source.ukuran_proksi],
    matrix: m,
  };
}

export function createRestoredWallObjects(objects) {
  const result = [];

  // 1. Lengkapi pilar di X = -250 (posisi pilar di X ~ -249.9, Z ~ 482.47)
  // Kloning ornamen atas dari pilar tengah (Cube.051, Cube.049, Cube.050 di X = 1.522, Z = 481.548)
  const pDx = -249.88 - 1.522;
  const pDz = 482.47 - 481.548;
  const c51 = objects.find((o) => o.nama === "Cube.051"); // Kepala pilar (salib)
  const c49 = objects.find((o) => o.nama === "Cube.049"); // Pelat atas pilar (salib)
  const c50 = objects.find((o) => o.nama === "Cube.050"); // Mahkota / capstone (balok)
  if (c51) result.push(cloneTranslated(c51, "Cube.112_capital", pDx, 0, pDz));
  if (c49) result.push(cloneTranslated(c49, "Cube.112_slab", pDx, 0, pDz));
  if (c50) result.push(cloneTranslated(c50, "Cube.112_cap", pDx, 0, pDz));

  // 2. Rekonstruksi segmen dinding & pagar utuh di bentang NW (X: [-500, -250])
  // Berdasarkan segmen bentang Section 2 (X: [-250, 0]) yang digeser ke kiri sebesar wDx = -249.536
  const wDx = -249.536;

  // Dinding putih bawah & atas
  const lw10 = objects.find((o) => o.nama === "lower wall.010");
  const uw10 = objects.find((o) => o.nama === "upper wall .010");
  if (lw10) result.push(cloneTranslated(lw10, "lower wall.018", wDx, 0, 0));
  if (uw10) result.push(cloneTranslated(uw10, "upper wall .018", wDx, 0, 0));

  // Rel horizontal pagar besi
  const rail = objects.find((o) => o.nama === "Cube.114");
  if (rail) result.push(cloneTranslated(rail, "Cube.114_restored", wDx, 0, 0));

  // Ujung runcing (cones) pagar
  ["Cone.044", "Cone.045", "Cone.046"].forEach((name, idx) => {
    const cone = objects.find((o) => o.nama === name);
    if (cone) result.push(cloneTranslated(cone, `Cone.restored_${idx}`, wDx, 0, 0));
  });

  // Jeruji vertikal pagar (cylinders)
  const cylNames = [
    "Cylinder.200",
    "Cylinder.201",
    "Cylinder.209",
    "Cylinder.210",
    "Cylinder.211",
    "Cylinder.212",
    "Cylinder.213",
    "Cylinder.214",
    "Cylinder.215",
    "Cylinder.216",
    "Cylinder.217",
    "Cylinder.218",
    "Cylinder.219",
    "Cylinder.220",
    "Cylinder.221",
    "Cylinder.222",
    "Cylinder.223",
    "Cylinder.224",
  ];
  cylNames.forEach((name, idx) => {
    const cyl = objects.find((o) => o.nama === name);
    if (cyl) result.push(cloneTranslated(cyl, `Cylinder.restored_${idx}`, wDx, 0, 0));
  });

  return result;
}

export function applyWallRepair(objects) {
  const restored = createRestoredWallObjects(objects);
  objects.push(...restored);
  return restored;
}
