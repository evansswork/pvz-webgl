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

export function placeCharacter(gl, spec, { pos, yaw = 0, scale = 1, extra = {} }) {
  const fx = new Node("fx");
  const stage = M4.chain(M4.translation(...pos), M4.rotationY(yaw), M4.scaling(scale, scale, scale));
  const toWorld = (p) => M4.transformPoint(stage, p);
  const ch = spec.build({ gl, fx, toWorld, ...(typeof extra === "function" ? extra(toWorld) : extra) });
  const toLocal = M4.invert(stage);

  // penanda sumbu rotasi (tombol X) — sama seperti di viewer
  const axisMat = material([1.0, 0.33, 0.22], { emissive: 0.9, outline: false, shadow: false, xray: true });
  const rod = new Node("axisRod", new Mesh(gl, cylinder(0.018, 1, 10, 1)), axisMat);
  const tip = new Node("axisTip", new Mesh(gl, cone(0.055, 0.16, 12)), axisMat);
  rod.visible = tip.visible = false;
  fx.add(rod, tip);

  return {
    ch, fx, stage, scale,
    group: { roots: [ch.root, fx], stage, scale },
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
