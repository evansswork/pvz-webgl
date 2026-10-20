/* =========================================================================
   sun.js — "Sun" PvZ (koin matahari): inti ellipsoid + sinar cone + glow
   ========================================================================= */
import { M4 } from './math.js';
import { mergeGeo, ellipsoid, cone } from './geometry.js';
import { Mesh, Node, material } from './renderer.js';

/* ---------- "Sun" PvZ: inti ellipsoid + sinar cone + glow transparan ---------- */
export function buildSunAssets(gl) {
  const rays = [];
  const ray = cone(0.09, 0.15, 10);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    rays.push([ray, M4.chain(M4.rotationZ(a), M4.translation(0, 0.22, 0), M4.scaling(1, 1, 0.45))]);
  }
  return {
    core: new Mesh(gl, ellipsoid(0.26, 0.26, 0.2, 20, 28)),
    rays: new Mesh(gl, mergeGeo(rays)),
    glow: new Mesh(gl, ellipsoid(0.7, 0.7, 0.7, 20, 28)),
    mCore: material([1.0, 0.85, 0.22], { emissive: 0.55, spec: 0.6, outlineW: 0.012 }),
    mRay: material([1.0, 0.72, 0.12], { emissive: 0.45, spec: 0.2, outlineW: 0.008 }),
    mGlow: material([1.0, 0.86, 0.35], { alpha: 0.55, soft: true, additive: true, outline: false, shadow: false, emissive: 0.6 }),
  };
}

export function makeSun(assets) {
  const n = new Node('sun');
  const spin = new Node('sunSpin');
  spin.add(new Node('sunCore', assets.core, assets.mCore), new Node('sunRays', assets.rays, assets.mRay));
  n.add(spin, new Node('sunGlow', assets.glow, assets.mGlow));
  n.spin = spin;
  return n;
}
