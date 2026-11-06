/* =========================================================================
   zombie/model.js — Model Zombie: pohon tulang (BoneNode) + semua bagian tubuh
   Hierarki:
   root ─ body ─┬─ head ─┬─ jaw, eyeL, eyeR, hair0..9
                ├─ armL_upper ─ armL_lower      (bahu → siku)
                ├─ armR_upper ─ armR_lower
                ├─ legL_upper ─ legL_lower      (pinggul → lutut)
                └─ legR_upper ─ legR_lower
   ========================================================================= */
import { m4, M, segBetween as seg } from "../../core/math.js";
import { pack, grid, normals, zEllipsoid as ellipsoid, frustum, zCylinder as cylinder, zCone as cone, zBox as box, bz, zTube as tube, prism, jacket, ragged } from "../../core/geometry.js";
import { ZombiePart, BoneNode } from "./ZombieNode.js";

/** Bangun model Zombie dan upload ke GPU. Return: { bones, getBone } */
export function buildZombie(gl) {
      function mesh(g) { return g; };
      /* ============ JENIS OBJEK & WARNA ============ */
      const hex = (h) =>
        [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255);

// Registry penyimpanan instance BoneNode berdasarkan nama
const bones = {};
/**
 * getBone: Mengambil atau membuat simpul tulang BoneNode berdasarkan nama.
 * @param {string} name - Nama simpul tulang
 * @returns {BoneNode}
 */
function getBone(name) {
  if (!bones[name]) bones[name] = new BoneNode(name);
  return bones[name];
}

// ============ PENYUSUNAN STRUKTUR POHON TULANG HIERARKIS (SCENE GRAPH) ============
// root -> body -> (head, armL_upper, armR_upper, legL_upper, legR_upper)
getBone("root").children.push(getBone("body"));
getBone("body").children.push(getBone("head"), getBone("armL_upper"), getBone("armR_upper"), getBone("legL_upper"), getBone("legR_upper"));
getBone("head").children.push(getBone("jaw"), getBone("eyeL"), getBone("eyeR"));
for(let i=0; i<10; i++) getBone("head").children.push(getBone("hair"+i));
getBone("armL_upper").children.push(getBone("armL_lower"));
getBone("armR_upper").children.push(getBone("armR_lower"));
getBone("legL_upper").children.push(getBone("legL_lower"));
getBone("legR_upper").children.push(getBone("legR_lower"));

/**
 * add: Mendaftarkan satu komponen bagian tubuh (mesh) ke tulang tertentu dalam hierarki.
 * @param {Object} m - Data geometri {p, n, i}
 * @param {Array<number>} Mx - Matriks posisi & orientasi lokal part
 * @param {string} t - Tipe primitif geometris
 * @param {string} c - Kode warna HEX
 * @param {string} bone - Nama tulang pemilik (default: "body")
 */
function add(m, Mx, t, c, bone) {
  const part = new ZombiePart(gl, m, Mx, hex(c), t);
  getBone(bone || "body").parts.push(part);
}
/* ============ PENYUSUNAN KARAKTER ============ */

      const RC = {
        skin: "#7e9a6a",
        skinD: "#6c8759",
        black: "#15171a",
        nostril: "#4a5e3d",
        coat: "#6b4526",
        shirt: "#d8d4c8",
        tie: "#b3262b",
        pants: "#3f5a8a",
        shoe: "#5a3a1e",
        sole: "#35230f",
        eye: "#efeee6",
        tongue: "#c86a6a",
        tooth: "#eee8d0",
        hair: "#2b2b2b",
        mouthCav: "#8c3131",
        lip: "#7a4038",
      };

      /**
       * pantsTexture: Menghasilkan geometri silinder celana dengan kerutan kain (wrinkled fabric noise).
       * @param {number} r1 - Radius lingkaran bawah
       * @param {number} r2 - Radius lingkaran atas
       * @param {number} nr - Segmen baris vertikal
       * @param {number} nc - Segmen kolom melingkar
       * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
       */
      function pantsTexture(r1, r2, nr = 10, nc = 24) {
        const p = [],
          i = [];
        for (let a = 0; a <= nr; a++) {
          const y = a / nr - 0.5,
            r = r1 + (r2 - r1) * (a / nr);
          for (let b = 0; b <= nc; b++) {
            const th = (2 * Math.PI * b) / nc;
            // Gelombang noise untuk lipatan vertikal & horizontal kain
            const noise =
              Math.sin(th * 10) * Math.cos(y * 20) * 0.004 +
              Math.sin(th * 15 + y * 10) * 0.002;
            p.push((r + noise) * Math.cos(th), y, (r + noise) * Math.sin(th));
          }
        }
        grid(nr, nc, i);
        return pack(p, normals(p, i), i);
      }

      /**
       * curvedEllipsoid: Membangun elipsoid yang ditekuk/dilengkungkan pada sumbu Y dan Z.
       * Digunakan untuk bagian tubuh yang melengkung natural seperti bahu, dagu, dan lekukan paha.
       * @param {number} rx - Radius sumbu X
       * @param {number} ry - Radius sumbu Y
       * @param {number} rz - Radius sumbu Z
       * @param {number} bendY - Faktor kelengkungan sumbu Y
       * @param {number} bendZ - Faktor kelengkungan sumbu Z
       * @param {number} sl - Slices melingkar
       * @param {number} st - Stacks vertikal
       * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
       */
      function curvedEllipsoid(rx, ry, rz, bendY, bendZ, sl = 24, st = 16) {
        const p = [],
          i = [];
        for (let a = 0; a <= st; a++) {
          const ph = (Math.PI * a) / st;
          for (let b = 0; b <= sl; b++) {
            const th = (2 * Math.PI * b) / sl;
            let x = rx * Math.sin(ph) * Math.cos(th);
            let y = ry * Math.cos(ph);
            let z = rz * Math.sin(ph) * Math.sin(th);
            let factor = (x * x) / (rx * rx);
            y += bendY * factor;
            z += bendZ * factor;
            p.push(x, y, z);
          }
        }
        grid(st, sl, i);
        return pack(p, normals(p, i), i);
      }

      /**
       * texturedEllipsoid: Elipsoid dengan gangguan permukaan (noise) untuk efek kerutan kain atau kulit kasar.
       * @param {number} rx - Radius sumbu X
       * @param {number} ry - Radius sumbu Y
       * @param {number} rz - Radius sumbu Z
       * @param {number} sl - Slices
       * @param {number} st - Stacks
       * @param {string} type - Jenis tekstur ("cloth" untuk kain jas, "skin" untuk tengkorak bergelombang)
       * @returns {{p: Float32Array, n: Float32Array, i: Uint16Array}}
       */
      function texturedEllipsoid(rx, ry, rz, sl = 24, st = 16, type = "cloth") {
        const p = [],
          i = [];
        for (let a = 0; a <= st; a++) {
          const ph = (Math.PI * a) / st;
          for (let b = 0; b <= sl; b++) {
            const th = (2 * Math.PI * b) / sl;
            let noise = 0;
            if (type === "cloth")
              noise =
                Math.sin(th * 10) * Math.cos(ph * 15) * 0.004 +
                Math.sin(th * 20 + ph * 8) * 0.002;
            else if (type === "skin") {
              // Deformasi tengkorak yang tidak rata (penyok & asimetris) menggunakan frekuensi rendah
              const skull =
                Math.sin(th * 2) * Math.cos(ph * 3) * 0.012 +
                Math.sin(th * 3 + ph * 2) * 0.008;
              // Kerutan halus/pori-pori
              const micro = Math.cos(th * 15 + ph * 11) * 0.0015;
              // Kalikan dengan sin(ph) agar noise bernilai 0 di titik kutub atas (ubun-ubun)
              // Ini mencegah terjadinya "pusaran / ikatan siomay" akibat pertemuan semua titik th.
              noise = (skull + micro) * Math.sin(ph);
            }
            p.push(
              (rx + noise) * Math.sin(ph) * Math.cos(th),
              (ry + noise) * Math.cos(ph),
              (rz + noise) * Math.sin(ph) * Math.sin(th),
            );
          }
        }
        grid(st, sl, i);
        return pack(p, normals(p, i), i);
      }

      /* ---------- ZOMBIE ---------- */
      (function () {
        for (const s of [-1, 1]) {
          const legX = s * 0.13;
          const upperLegBone = s < 0 ? "legL_upper" : "legR_upper";
          const lowerLegBone = s < 0 ? "legL_lower" : "legR_lower";
          add(
            mesh(ellipsoid(0.1, 0.07, 0.19)),
            m4.T(legX, 0.08, 0.06),
            "ellipsoid",
            RC.shoe,
            lowerLegBone,
          ); // sepatu
          add(
            mesh(box(0.19, 0.035, 0.36)),
            m4.T(legX, 0.022, 0.06),
            "box",
            RC.sole,
            lowerLegBone,
          ); // sol
          add(
            mesh(cylinder(0.05, 16)),
            seg([legX, 0.12, 0.03], [legX, 0.55, 0]),
            "cylinder",
            RC.skin,
            lowerLegBone,
          ); // betis
          add(
            mesh(ellipsoid(0.07, 0.07, 0.07, 18, 12)),
            m4.T(legX, 0.55, 0),
            "ellipsoid",
            RC.skin,
            upperLegBone,
          ); // sendi lutut
          add(
            mesh(ellipsoid(0.115, 0.115, 0.115, 18, 12)),
            m4.T(legX, 0.95, -0.01),
            "ellipsoid",
            RC.pants,
            upperLegBone,
          ); // sendi pinggul
          add(
            mesh(pantsTexture(0.095, 0.115, 10, 24)),
            seg([legX, 0.42, 0], [legX, 0.98, -0.02]),
            "cone",
            RC.pants,
            upperLegBone,
          ); // celana bertekstur
          add(
            mesh(ragged(0.097, 0.09)),
            m4.T(legX, 0.42, 0),
            "tri",
            RC.pants,
            upperLegBone,
          );
          if (s > 0) {
            // potongan celana terpisah jatuh di atas pergelangan kaki kanan
            add(
              mesh(pantsTexture(0.085, 0.075, 6, 20)),
              seg([legX, 0.13, 0.02], [legX, 0.26, 0.01]),
              "cone",
              RC.pants, lowerLegBone,
            );
            add(
              mesh(ragged(0.087, 0.045)),
              m4.T(legX, 0.13, 0.02),
              "tri",
              RC.pants, lowerLegBone,
            );
            add(
              mesh(ragged(0.077, 0.045)),
              M(m4.T(legX, 0.26, 0.01), m4.X(Math.PI)),
              "tri",
              RC.pants, lowerLegBone,
            );
          }
        }

        // pinggul celana
        add(
          mesh(texturedEllipsoid(0.22, 0.14, 0.16, 28, 18)),
          m4.T(0, 0.98, -0.02),
          "ellipsoid",
          RC.pants,
        );

        // sabuk dan gesper
        const beltM = M(m4.T(0, 1.08, 0.02), m4.X(0.1));
        add(
          mesh(ellipsoid(0.24, 0.04, 0.2, 24, 12)),
          beltM,
          "ellipsoid",
          "#2b2520",
        ); // sabuk kulit gelap
        add(
          mesh(box(0.08, 0.06, 0.015)),
          M(m4.T(0, 1.05, 0.22), m4.X(0.1)),
          "box",
          "#4d4d4d",
        ); // gesper emas

        const bodyMatrix = M(m4.T(0, 1.26, 0.1), m4.X(0.55));
        add(
          mesh(ellipsoid(0.24, 0.4, 0.2)),
          bodyMatrix,
          "ellipsoid",
          RC.shirt,
        ); // badan
        add(
          mesh(jacket(0.26, 0.43, 0.22, 0.42, 0.35, 2.5)),
          bodyMatrix,
          "tri",
          RC.coat,
        ); // jas
        // kantong jas
        add(
          mesh(box(0.07, 0.06, 0.01)),
          M(bodyMatrix, m4.T(0.14, -0.17, 0.188), m4.X(-0.05), m4.Y(0.15)),
          "box",
          RC.coat,
        );
        add(
          mesh(box(0.07, 0.06, 0.01)),
          M(bodyMatrix, m4.T(-0.14, -0.17, 0.188), m4.X(-0.05), m4.Y(-0.15)),
          "box",
          RC.coat,
        );

        const lap = mesh(
          prism(
            [
              [0, 0],
              [0.1, 0.04],
              [0.015, -0.3],
            ],
            0.02,
          ),
        );
        add(
          mesh(ellipsoid(0.015, 0.015, 0.01, 10, 8)),
          M(bodyMatrix, m4.T(-0.15, 0.15, 0.18), m4.X(-0.05)),
          "ellipsoid",
          "#111111",
        );
        add(
          mesh(ellipsoid(0.015, 0.015, 0.01, 10, 8)),
          M(bodyMatrix, m4.T(-0.15, 0.07, 0.2), m4.X(-0.05)),
          "ellipsoid",
          "#111111",
        );
        add(
          mesh(ellipsoid(0.015, 0.015, 0.01, 10, 8)),
          M(bodyMatrix, m4.T(-0.15, -0.03, 0.2), m4.X(-0.05)),
          "ellipsoid",
          "#111111",
        );
        // Z dinaikkan ke 0.14 agar tidak tenggelam di dada atas
        add(
          lap,
          M(bodyMatrix, m4.T(0.045, 0.37, 0.14), m4.Y(0.55), m4.X(-0.15)),
          "tri",
          RC.coat,
        ); // kerah kanan
        add(
          lap,
          M(
            bodyMatrix,
            m4.T(-0.045, 0.37, 0.14),
            m4.Y(-0.55),
            m4.X(-0.15),
            m4.S(-1, 1, 1),
          ),
          "tri",
          RC.coat,
        ); // kerah kiri

        // Dasi dinaikkan Z-nya dan dimiringkan lebih tajam (X=-0.35)
        // Ini memastikan garis lurus dasi benar-benar melangkahi perut elips yang cembung (tidak menembus di tengah)
        // 1. Simpul dasi
        add(
          mesh(
            prism(
              [
                [0, 0.02],
                [0.035, 0.01],
                [0.025, -0.04],
                [-0.025, -0.04],
                [-0.035, 0.01],
              ],
              0.024,
            ),
          ),
          M(bodyMatrix, m4.T(0, 0.37, 0.15), m4.X(-0.1)),
          "tri",
          RC.tie,
        );
        // 2. Badan dasi
        add(
          mesh(
            prism(
              [
                [0, 0],
                [0.025, 0],
                [0.06, -0.32],
                [0, -0.42],
                [-0.06, -0.32],
                [-0.025, 0],
              ],
              0.02,
            ),
          ),
          M(bodyMatrix, m4.T(0, 0.35, 0.14), m4.X(-0.35)),
          "tri",
          RC.tie,
        );
        for (let i = 1; i <= 4; i++) {
          const yLocal = -i * 0.07;
          const wHalf = 0.025 + 0.035 * (-yLocal / 0.32);
          add(
            mesh(box(wHalf * 2 * 1.05, 0.008, 0.002)),
            M(
              bodyMatrix,
              m4.T(0, 0.35, 0.14),
              m4.X(-0.35),
              m4.T(0, yLocal, 0.011),
              m4.Z(-0.35),
            ),
            "box",
            "#ffffff",
          );
        }
        add(
          mesh(cylinder(0.07, 16)),
          seg([0, 1.55, 0.28], [0, 1.66, 0.42]),
          "cylinder",
          RC.skinD,
        ); // leher
        add(
          mesh(texturedEllipsoid(0.3, 0.32, 0.29, 36, 24, "skin")),
          m4.T(0, 1.85, 0.5),
          "ellipsoid",
          RC.skin,
          "head",
        ); // kepala (bertekstur)
        add(
          mesh(ellipsoid(0.105, 0.105, 0.09)),
          m4.T(0.13, 1.91, 0.73),
          "ellipsoid",
          RC.eye,
          "eyeR",
        ); // mata besar
        add(
          mesh(ellipsoid(0.08, 0.08, 0.07)),
          m4.T(-0.13, 1.9, 0.73),
          "ellipsoid",
          RC.eye,
          "eyeL",
        ); // mata kecil
        add(
          mesh(ellipsoid(0.026, 0.026, 0.02, 14, 10)),
          m4.T(0.13, 1.91, 0.82),
          "ellipsoid",
          RC.black,
          "eyeR",
        );
        add(
          mesh(ellipsoid(0.022, 0.022, 0.018, 14, 10)),
          m4.T(-0.13, 1.9, 0.795),
          "ellipsoid",
          RC.black,
          "eyeL",
        );
        // --- fungsi pembuat urat tipis ---
        function makeVeins(cx, cy, cz, r, bone, numVeins) {
          const veinM = mesh(cylinder(0.0002, 6));
          for (let i = 0; i < numVeins; i++) {
            // mulai dari belakang mata (z negatif)
            let phi = Math.random() * Math.PI * 2;
            let theta = Math.PI - 0.2; // dekat kutub belakang
            let p1 = [
              cx + r * Math.sin(theta) * Math.cos(phi),
              cy + r * Math.sin(theta) * Math.sin(phi),
              cz + r * Math.cos(theta),
            ];

            // buat 3 ruas per urat agar sedikit berbelok-belok maju ke depan
            for (let j = 0; j < 5; j++) {
              theta -= 0.3 + Math.random() * 0.3; // maju ke depan (theta mengecil)
              phi += (Math.random() - 0.5) * 0.8; // belok kiri/kanan acak
              if (theta < Math.PI / 4.5) break; // jangan sampai nutupi pupil hitam di depan
              let p2 = [
                cx + (r + 0.001) * Math.sin(theta) * Math.cos(phi),
                cy + (r + 0.001) * Math.sin(theta) * Math.sin(phi),
                cz + (r + 0.001) * Math.cos(theta),
              ];
              add(veinM, seg(p1, p2), "cylinder", "#aa1111", bone);
              p1 = p2;
            }
          }
        }
        makeVeins(0.13, 1.91, 0.73, 0.105, "eyeR", 35);
        makeVeins(-0.13, 1.9, 0.73, 0.08, "eyeL", 25);
        // ---------------------------------
        // hidung (lubang hidung oval miring) - posisinya ditarik maju (Z) dan sedikit ditebalkan agar tidak tenggelam oleh tekstur kepala
        add(
          mesh(ellipsoid(0.014, 0.028, 0.006, 12, 8)),
          M(m4.T(0.04, 1.815, 0.789), m4.Z(0.2)),
          "ellipsoid",
          RC.nostril,
          "head",
        );
        add(
          mesh(ellipsoid(0.014, 0.028, 0.006, 12, 8)),
          M(m4.T(-0.04, 1.81, 0.789), m4.Z(-0.9)),
          "ellipsoid",
          RC.nostril,
          "head",
        );
        // --- STRUKTUR RAHANG (MANDIBULA) ---
        // Menggunakan bentuk tabung yang disapu di sepanjang kurva Bezier agar membentuk
        // satu kesatuan rahang huruf-U yang mulus dan bersih, tanpa benjolan-benjolan ellipsoid.
        const jawCurve = [
          [-0.2, 1.72, 0.55], // Titik awal (engsel rahang kiri)
          [-0.15, 1.53, 0.83], // Titik kontrol (lengkung dagu kiri depan)
          [0.15, 1.53, 0.83], // Titik kontrol (lengkung dagu kanan depan)
          [0.2, 1.72, 0.55], // Titik akhir (engsel rahang kanan)
        ];
        // rf (ketebalan) disesuaikan agar proporsional dengan kepala (tidak terlalu tebal)
        add(
          mesh(
            tube(
              (t) => bz(jawCurve, t),
              (t) => 0.035 + 0.015 * Math.sin(t * Math.PI),
              24,
              14,
            ),
          ),
          m4.I(),
          "curve",
          RC.skin,
          "jaw",
        );
        // Isi/otot bawah dagu (submental area) untuk menyambungkan dasar rahang ke leher
        add(
          mesh(ellipsoid(0.16, 0.035, 0.14, 18, 12)),
          M(m4.T(0, 1.64, 0.66), m4.X(0.55)),
          "ellipsoid",
          RC.skinD,
          "jaw",
        );
        // ------------------------------------------
        add(
          mesh(curvedEllipsoid(0.13, 0.015, 0.025, -0.03, -0.04)),
          m4.T(0, 1.745, 0.795),
          "ellipsoid",
          RC.lip,
          "head",
        ); // bibir atas (menonjol keluar dari wajah, warnanya beda dari kulit)
        add(
          mesh(curvedEllipsoid(0.145, 0.018, 0.03, 0.04, -0.06)),
          m4.T(0, 1.66, 0.798),
          "ellipsoid",
          RC.lip,
          "jaw",
        ); // bibir bawah (ikut rahang, lebih tebal dari bibir atas)
        // rongga mulut ditebalkan (rz) dan ditarik masuk (Z dikurangi)
        // agar saling memotong dengan bola kepala/rahang sehingga membentuk kurva lekukan lubang yang menyatu
        add(
          mesh(ellipsoid(0.155, 0.13, 0.11, 32, 18)),
          m4.T(0, 1.688, 0.67),
          "ellipsoid",
          RC.mouthCav,
          "head",
        ); // rongga mulut oval, merah tuaf
        add(
          mesh(ellipsoid(0.075, 0.028, 0.05, 20, 10)),
          m4.T(0, 1.652, 0.67),
          "ellipsoid",
          RC.tongue,
          "jaw",
        ); // lidah ditarik masuk sedikit mengikuti rongga
        // gigi — dibuat tidak rata (snaggletooth): tiap gigi beda ukuran, beda kedalaman, & sedikit miring (rotasi Z),
        // gigi atas menempel ke kepala (diam), gigi bawah menempel ke rahang (ikut buka-tutup)
        const upperTeeth = [
          //{x:-.115,z:.795,w:.032,h:.05, d:.026,r:.18},
          //{x:-.068,z:.815,w:.036,h:.036,d:.028,r:-.06},
          { x: -0.022, z: 0.800, w: 0.034, h: 0.055, d: 0.01, r: 0.08 },
          { x: 0.032, z: 0.80, w: 0.032, h: 0.048, d: 0.024, r: -0.06, cone: true },
          //{x:.075, z:.805,w:.035,h:.048,d:.027,r:.12},
          { x: 0.08, z: 0.78, w: 0.03, h: 0.034, d: 0.02, r: -0.16 },
        ];
        for (const t of upperTeeth)
          add(
            mesh(t.cone ? cone(t.w / 2, t.h, 18, true, t.d / 2) : box(t.w, t.h, t.d)),
            M(m4.T(t.x, 1.726 - t.h / 2, t.z), m4.Z(t.r)),
            t.cone ? "cone" : "box",
            RC.tooth,
            "head",
          );
        const lowerTeeth = [
          //{x:-.125,z:.78, w:.03, h:.038,d:.024,r:-.12},
          { x: -0.078, z: 0.805, w: 0.034, h: 0.055, d: 0.01, r: 0.1 },
          { x: -0.03, z: 0.818, w: 0.03, h: 0.038, d: 0.024, r: -0.05, cone: true },
          //{x:.02,  z:.822,w:.036,h:.05, d:.029,r:.09},
          { x: 0.07, z: 0.802, w: 0.032, h: 0.034, d: 0.01, r: -0.14 },
          { x: 0.115, z: 0.782, w: 0.029, h: 0.044, d: 0.01, r: 0.15 },
        ];
        for (const t of lowerTeeth)
          add(
            mesh(t.cone ? cone(t.w / 2, t.h, 18, false, t.d / 2) : box(t.w, t.h, t.d)),
            M(m4.T(t.x, 1.686 + t.h / 2, t.z), m4.Z(t.r)),
            t.cone ? "cone" : "box",
            RC.tooth,
            "jaw",
          );
        const hairData = [
          // [x, z, dx (arah ujung), dy_extra (panjang)]
          [-0.2, 0.45, 0.1, 0.02],
          [-0.15, 0.47, 0.12, 0.0],
          // [-0.10, 0.42, -0.08,  0.01],
          // [-0.05, 0.49,  0.09, -0.02],
          [0.0, 0.44, -0.1, 0.04],
          // [ 0.05, 0.48,  0.09, -0.01],
          [0.1, 0.41, 0.11, 0.02],
          [0.15, 0.47, -0.09, 0.01],
          // [ 0.20, 0.43,  0.13, -0.03],
          // [ 0.25, 0.46,  0.08,  0.02]
        ];
        {
          let hi = 0;
          for (const [x, z, dx, dy_extra] of hairData) {
            const y =
              1.85 +
              0.32 *
                Math.sqrt(
                  Math.max(0, 1 - (x / 0.3) ** 2 - ((z - 0.5) / 0.29) ** 2),
                );
            const dy = y - 2.15 + dy_extra;

            const HP = [
              [x, y, z],
              [x + 0.02, 2.25 + dy, z - 0.02],
              [x + dx, 2.25 + dy, z - 0.08],
              [x + dx - 0.02, 2.1 + dy, z - 0.15],
            ];
            add(
              mesh(
                tube(
                  (t) => bz(HP, t),
                  (t) => 0.003 - 0.002 * t,
                  18,
                  6,
                ),
              ),
              m4.I(),
              "curve",
              RC.hair,
              "hair" + hi,
            );
            hi++;
          }
        } // rambut (kurva 3D, tiap helai bergoyang beda fase

        // Kerutan dahi (3 garis membentang horizontal bertumpuk, dikembalikan seperti sebelumnya)
        // Ditambahkan rotasi m4.X agar elipsoidnya miring ke belakang, menyatu mulus mengikuti profil kemiringan dahi
        add(
          mesh(ellipsoid(0.11, 0.0001, 0.035, 10, 10)),
          M(m4.T(0, 2.02, 0.72), m4.X(-0.4)),
          "ellipsoid",
          RC.nostril,
          "head",
        );
        add(
          mesh(ellipsoid(0.09, 0.0001, 0.03, 10, 10)),
          M(m4.T(0, 2.06, 0.69), m4.X(-0.6)),
          "ellipsoid",
          RC.nostril,
          "head",
        );

        const shoulderM = mesh(ellipsoid(0.1, 0.11, 0.1, 18, 12));
        for (const s of [-1, 1]) {
          const Sh = [s * 0.26, 1.47, 0.29],
            S = Sh,
            E = [s * 0.32, 1.35, 0.65],
            W = [s * 0.28, 1.3, 0.92];
          const up = s < 0 ? "armL_upper" : "armR_upper",
            lo = s < 0 ? "armL_lower" : "armR_lower";
          add(shoulderM, m4.T(...Sh), "ellipsoid", RC.coat, up); // sendi bahu — sambungan lengan ke badan
          add(
            mesh(frustum(0.088, 0.066, 18, false)),
            seg(S, E),
            "cone",
            RC.coat,
            up,
          ); // lengan jas atas
          add(
            mesh(ellipsoid(0.068, 0.068, 0.068, 16, 12)),
            m4.T(...E),
            "ellipsoid",
            RC.coat,
            lo,
          ); // sendi siku
          add(
            mesh(frustum(0.066, 0.052, 18, false)),
            seg(E, W),
            "cone",
            RC.coat,
            lo,
          ); // lengan jas bawah
          add(
            mesh(ellipsoid(0.072, 0.015, 0.072, 16, 8)),
            M(seg(S, E), m4.T(0, 0.2, 0), m4.X(0.2)),
            "ellipsoid",
            RC.coat,
            up,
          );
          add(
            mesh(ellipsoid(0.074, 0.015, 0.074, 16, 8)),
            M(seg(S, E), m4.T(0, -0.1, 0), m4.X(-0.1)),
            "ellipsoid",
            RC.coat,
            up,
          );
          add(
            mesh(ellipsoid(0.062, 0.015, 0.062, 16, 8)),
            M(seg(E, W), m4.T(0, 0.1, 0), m4.Z(0.15)),
            "ellipsoid",
            RC.coat,
            lo,
          );
          const Wh = [W[0], W[1] + 0.05, W[2]]; // Geser base koordinat tangan ke atas (masuk ke dalam jas)
          add(
            mesh(ellipsoid(0.07, 0.085, 0.045, 18, 12)),
            m4.T(Wh[0], Wh[1] - 0.08, Wh[2] + 0.01),
            "ellipsoid",
            RC.skin, lo, ); // telapak tangan
          const buildFinger = (
            dx,
            dy,
            dz,
            length1,
            length2,
            curveZ,
            curveX,
            isThumb = false,
          ) => {
            // Sekarang cX dan cZ langsung mengontrol arah jari, termasuk jempol!
            const tX1 = curveX;
            const tZ1 = curveZ;
            // Rasio tekukan ruas kedua (jempol sedikit berbeda dari jari lain agar tidak terlalu melengkung ke belakang)
            const tX2 = isThumb ? curveX * 0.7 : curveX * 0.5;
            const tZ2 = isThumb ? curveZ : curveZ - length2 * 0.6;

            const J0 = [Wh[0] + dx, Wh[1] + dy, Wh[2] + dz];
            const J1 = [J0[0] + tX1, J0[1] - length1, J0[2] + tZ1];
            const J2 = [J1[0] + tX2, J1[1] - length2 * 0.8, J1[2] + tZ2],
              r = 0.015;

            add(
              mesh(cylinder(r, 10)),
              seg(J0, J1),
              "cylinder",
              RC.skin,
              lo,
            ); // ruas atas
            add(
              mesh(ellipsoid(r, r, r, 10, 8)),
              m4.T(...J1),
              "ellipsoid",
              RC.skin,
              lo,
            ); // sendi tengah (knuckle)
            add(
              mesh(cylinder(r * 0.85, 10)),
              seg(J1, J2),
              "cylinder",
              RC.skin,
              lo,
            ); // ruas bawah
            add(
              mesh(ellipsoid(r * 0.85, r * 0.85, r * 0.85, 10, 8)),
              m4.T(...J2),
              "ellipsoid",
              RC.skin,
              lo,
            ); // ujung jari

            // Kuku: Posisikan di sisi luar jempol (menjauhi telapak) agar tidak tersembunyi
            const nailM = isThumb
              ? M(
                  m4.T(J2[0] - s * r * 0.75, J2[1] - 0.002, J2[2]),
                  m4.Y(-s * 1.4),
                )
              : M(m4.T(J2[0], J2[1] - 0.003, J2[2] + r * 0.75), m4.X(0.2));
            add(
              mesh(ellipsoid(r * 0.6, r * 0.7, r * 0.15, 12, 8)),
              nailM,
              "ellipsoid",
              "#e8d9c1",
              lo,
            );
          };
          // Jika Anda ingin mengubah arah menunjuknya jempol, silakan ubah dua angka sebelum 'true' di bawah ini:
          // (0 adalah cZ / arah depan-belakang, s*-.035 adalah cX / arah samping)
          buildFinger(
            s * -0.035,
            -0.11,
            0.025,
            0.015,
            0.018,
            0,
            s * -0.035,
            true,
          ); // Jempol (lebih dekat, lebih pendek)
          buildFinger(s * -0.025, -0.13, 0.03, 0.04, 0.035, 0.03, s * 0.005); // Telunjuk
          buildFinger(s * 0.005, -0.135, 0.035, 0.045, 0.04, 0.02, 0); // Tengah
          buildFinger(s * 0.035, -0.125, 0.03, 0.04, 0.035, 0.01, s * -0.005); // Manis
          buildFinger(s * 0.042, -0.11, 0.02, 0.025, 0.02, 0, s * 0.025); // Kelingking (sangat mepet, lebih pendek)
        }
      })();

      /* posisi & arah karakter di panggung */
      
      

      
getBone("root").setup(gl);

  return { bones, getBone };
}
