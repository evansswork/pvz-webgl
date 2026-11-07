/* =========================================================================
   cast.js — Menempatkan karakter ke environment
   -------------------------------------------------------------------------
   Tiap karakter tetap dibangun & dianimasikan di ruangnya sendiri (satuan
   asli, tanah = y 0). Matriks STAGE membawanya ke dunia environment:
       stage = T(posisi petak rumput) · Ry(arah hadap) · S(skala)
   Jadi satu karakter tetap berupa scene graph hierarkis:
       world = stage · root · body · … · daun
   ========================================================================= */

import { M4 } from "./core/math.js";
import { Node, Mesh, material } from "./core/renderer.js";
import { cylinder, cone } from "./core/geometry.js";

/**
 * Menempatkan dan mengintegrasikan karakter ke dalam environment dunia 3D.
 * Fungsi ini membangun scene graph karakter pada koordinat lokalnya, lalu membungkusnya
 * dengan matriks transformasi `stage` (translasi, rotasi Y/yaw, dan skala seragam),
 * serta menyiapkan node efek/indikator sumbu rotasi (axis gizmo).
 *
 * @param {WebGLRenderingContext|WebGL2RenderingContext} gl - Konteks WebGL aktif tempat buffer mesh karakter dan gizmo dibuat
 * @param {object} spec - Definisi spesifikasi karakter (misal Peashooter, Sunflower, Chomper) yang memiliki metode factory `build({ gl, fx, toWorld, ... })`
 * @param {object} options - Opsi penempatan karakter di dunia:
 * @param {[number, number, number]} options.pos - Posisi target karakter `[x, y, z]` di ruang dunia (mengubah letak koordinat karakter di atas grid/tanah)
 * @param {number} [options.yaw=0] - Sudut hadap/rotasi karakter terhadap sumbu Y dalam radian (mengubah arah hadap karakter, misal memutar ke kiri atau ke kanan)
 * @param {number} [options.scale=1] - Faktor skala ukuran seragam karakter (mengubah perbesaran atau pengecilan fisik karakter secara proporsional)
 * @param {object|function(function([number, number, number]): [number, number, number]): object} [options.extra={}] - Parameter/konfigurasi tambahan spesifik untuk karakter tertentu (contoh: target aim, state zombie, fungsi mapping ruang dunia)
 * @returns {{ ch: object, fx: Node, stage: number[], scale: number, group: { roots: Node[], stage: number[], scale: number }, update: function(number, number, [number, number, number], boolean): void }} Objek controller instance karakter yang berisi referensi scene graph dan metode `update`
 */
export function placeCharacter(gl, spec, { pos, yaw = 0, scale = 1, extra = {} }) {
  const fx = new Node("fx");
  const stage = M4.chain(M4.translation(...pos), M4.rotationY(yaw), M4.scaling(scale, scale, scale));
  const toWorld = (p) => M4.transformPoint(stage, p);
  const ch = spec.build({ gl, fx, toWorld, ...(typeof extra === "function" ? extra(toWorld) : extra) });
  const toLocal = M4.invert(stage);

  // penanda sumbu rotasi (tombol X)
  const axisMat = material([1.0, 0.33, 0.22], { emissive: 0.9, outline: false, shadow: false, xray: true });
  const rod = new Node("axisRod", new Mesh(gl, cylinder(0.018, 1, 10, 1)), axisMat);
  const tip = new Node("axisTip", new Mesh(gl, cone(0.055, 0.16, 12)), axisMat);
  rod.visible = tip.visible = false;
  fx.add(rod, tip);

  return {
    ch, fx, stage, scale,
    group: { roots: [ch.root, fx], stage, scale },
    /**
     * Memperbarui animasi internal karakter dan orientasi visual indikator sumbu rotasi (axis gizmo) per-frame.
     * @param {number} dt - Delta waktu sejak frame terakhir dalam detik (mengatur laju animasi internal karakter)
     * @param {number} time - Waktu total aplikasi yang berjalan dalam detik (digunakan untuk fase gelombang siklus idle/goyang karakter)
     * @param {[number, number, number]} camEyeWorld - Posisi kamera pengamat di ruang dunia (dikonversi ke ruang lokal karakter untuk kalkulasi billboard/arah hadap mata)
     * @param {boolean} showAxis - Menentukan apakah indikator batang dan panah sumbu rotasi (axis gizmo) ditampilkan di layar (diaktifkan saat menekan tombol X)
     */
    update(dt, time, camEyeWorld, showAxis) {
      ch.update(dt, time, M4.transformPoint(toLocal, camEyeWorld));
      const ax = showAxis && ch.axisInfo && ch.axisInfo();
      rod.visible = tip.visible = !!ax;
      if (ax) {
        const L = 2.0 * Math.min(1, ax.weight * 1.5), align = M4.alignY(ax.axis);
        rod.pre = M4.chain(M4.translation(...ax.pivot), align, M4.translation(0, -L / 2, 0), M4.scaling(1, L, 1));
        tip.pre = M4.chain(M4.translation(...ax.pivot), align, M4.translation(0, L / 2, 0));
      }
      fx.updateWorld();
    },
  };
}
