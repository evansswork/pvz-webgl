/* =========================================================================
   lawn.js — Halaman rumput studio untuk viewer karakter (petak + rumput cone)
   ========================================================================= */
import { M4 } from './math.js';
import { mergeGeo, ellipsoid, cone, plane } from './geometry.js';
import { Mesh, Node, material } from './renderer.js';

export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function buildEnvironment(gl) {
  const root = new Node('environment');
  const tile = 2.0, cols = 9, rows = 5;
  const light = [], dark = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const m = M4.translation((c - (cols - 1) / 2) * tile, 0, (r - (rows - 1) / 2) * tile);
    ((r + c) % 2 ? dark : light).push([plane(tile, tile), m]);
  }
  const mk = (list, col) => { const n = new Node('lawn', new Mesh(gl, mergeGeo(list)), material(col, { spec: 0, outline: false, shadow: false, ground: true })); root.add(n); return n; };
  mk(light, [0.43, 0.69, 0.25]);
  mk(dark, [0.35, 0.59, 0.19]);

  // tanah di luar petak + jalur tanah depan
  const outer = new Node('outer', new Mesh(gl, plane(140, 140)), material([0.33, 0.55, 0.20], { spec: 0, outline: false, shadow: false, ground: true }));
  outer.position = [0, -0.012, 0];
  root.add(outer);
  const path = new Node('path', new Mesh(gl, plane(cols * tile + 2, 1.2)), material([0.62, 0.47, 0.30], { spec: 0, outline: false, shadow: false, ground: true }));
  path.position = [0, -0.006, rows * tile / 2 + 0.75];
  root.add(path);

  // rumpun rumput: kumpulan CONE tipis (quadric)
  const rand = rng(7), tufts = [];
  const blade = cone(0.022, 1, 6);
  for (let k = 0; k < 140; k++) {
    const x = (rand() - 0.5) * cols * tile, z = (rand() - 0.5) * rows * tile;
    if (Math.hypot(x, z) < 1.5) continue;
    const n = 4 + Math.floor(rand() * 3);
    for (let b = 0; b < n; b++) {
      const a = (b / n) * Math.PI * 2 + rand();
      const h = 0.13 + rand() * 0.14;
      tufts.push([blade, M4.chain(M4.translation(x + Math.cos(a) * 0.04, 0, z + Math.sin(a) * 0.04), M4.rotationY(a), M4.rotationZ(0.25 + rand() * 0.3), M4.scaling(1, h, 1))]);
    }
  }
  const grass = new Node('grass', new Mesh(gl, mergeGeo(tufts)), material([0.29, 0.52, 0.16], { spec: 0.1, outline: false, shadow: false }));
  root.add(grass);

  // bunga kecil liar sebagai aksen warna
  const flowers = [];
  const dot = ellipsoid(0.05, 0.035, 0.05, 8, 12);
  for (let k = 0; k < 26; k++) {
    const x = (rand() - 0.5) * cols * tile, z = (rand() - 0.5) * rows * tile;
    if (Math.hypot(x, z) < 1.8) continue;
    flowers.push([dot, M4.translation(x, 0.06, z)]);
  }
  root.add(new Node('flowers', new Mesh(gl, mergeGeo(flowers)), material([1.0, 0.97, 0.88], { spec: 0.2, outline: false, shadow: false })));
  return root;
}
