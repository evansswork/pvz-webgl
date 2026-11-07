/* =========================================================================
   zombie/animation.js — Animasi Zombie (dihitung tiap frame)
     TRANSLATE + SCALING : napas (badan naik-turun + membesar), langkah jalan
     ROTATE              : kepala menoleh, lengan & kaki berayun
     ARBITRARY AXIS      : rahang menganga miring (sumbu 3D dislokasi rahang)
     SCALING             : mata berkedip (tinggi mata di-scale)
     HIERARCHICAL        : bahu → siku, pinggul → lutut, kepala → rahang/mata/rambut
   ========================================================================= */
import { m4, M, axisRot } from "../../core/math.js";

/**
 * Membuat dan mengembalikan fungsi animator zombie (`animWraps`).
 * Menginisialisasi nilai seed acak per sesi sehingga setiap kemunculan zombie memiliki
 * variasi fase kedipan, twitching, dan goyangan kepala yang sedikit unik.
 * @returns {Function} Fungsi `animWraps(T, walkTime, isWalking)` untuk menghitung pose matriks kerangka per frame.
 */
export function makeZombieAnimator() {
  // SEED acak tiap kali halaman dibuka, supaya fase animasi (goyang, kedip, twitch) selalu sedikit berbeda
  const SEED = Math.random() * 1000;

  /**
   * pivotRot: Melakukan transformasi rotasi objek terhadap titik tumpu tertentu (pivot point) di ruang 3D.
   * Formula grafkom klasik: Translasi(+pivot) * Rotasi * Translasi(-pivot)
   * @param {Array<number>} p - Koordinat titik tumpu engsel sendi [px, py, pz].
   *        Mengubah posisi letak poros engsel rotasi di ruang 3D (misal: sendi bahu, siku, pinggul, atau rahang).
   * @param {Array<number>|Float32Array} Rm - Matriks rotasi murni (misal: m4.X, m4.Y, m4.Z, atau axisRot).
   *        Mengubah sudut putaran dan orientasi rotasi yang akan diterapkan pada titik tumpu tersebut.
   * @returns {Float32Array} Matriks transformasi gabungan 4x4.
   */
  function pivotRot(p, Rm) {
    return M(m4.T(p[0], p[1], p[2]), Rm, m4.T(-p[0], -p[1], -p[2]));
  }

  /**
   * Fungsi hash deterministik 1D pseudo-random menghasilkan angka acak [0.0, 1.0).
   * @param {number} n - Angka benih/input numerik (misal: indeks siklus waktu atau seed).
   *        Mengubah nilai n akan menghasilkan angka acak baru yang konsisten untuk seed yang sama.
   * @returns {number} Angka float acak antara 0.0 sampai 1.0.
   */
  function hash1(n) {
    const s = Math.sin(n) * 43758.5453;
    return s - Math.floor(s);
  }

  /**
   * Menghasilkan kurva amplop sentakan singkat dan acak (twitch envelope).
   * Digunakan untuk menyimulasikan twitching/kejang otot zombie pada kepala atau lengan.
   * @param {number} t - Waktu berjalan aplikasi dalam satuan detik. Mengatur laju progres waktu siklus saat ini.
   * @param {number} period - Jeda interval pengulangan sentakan dalam satuan detik (misal: tiap 4.4 detik).
   *        Mengubah nilai period akan memperjarang atau mempercepat frekuensi terjadinya kejang otot.
   * @param {number} seedOff - Nilai offset benih pengacak fase.
   *        Mengubah seedOff membuat waktu sentakan antara lengan kiri, kanan, dan kepala tidak terjadi bersamaan.
   * @returns {number} Nilai intensitas sentakan kurva sinusoidal (0.0 jika sedang tidak sentak, hingga ~1.0 saat puncak sentakan).
   */
  function twitchEnv(t, period, seedOff) {
    const st = t + seedOff,
      cyc = Math.floor(st / period),
      localT = st - cyc * period,
      dur = 0.16;
    const rnd = hash1(cyc * 13.71 + seedOff * 3.13);
    if (localT > dur) return 0;
    return Math.sin((Math.PI * localT) / dur) * (0.35 + 0.65 * rnd);
  }

  /**
   * Menghasilkan kurva amplop kedipan mata (skala tinggi vertikal kelopak mata).
   * @param {number} t - Waktu berjalan animasi dalam satuan detik.
   * @param {number} seedOff - Offset pengacak siklus kedip.
   *        Mengubah nilai ini membedakan ritme kedip mata zombie dari karakter lainnya.
   * @returns {number} Faktor skala vertikal mata: 1.0 saat mata terbuka penuh, dan turun hingga 0.08 saat mata menutup/berkedip.
   */
  function blinkEnv(t, seedOff) {
    const period = 3.1,
      st = t + seedOff,
      cyc = Math.floor(st / period),
      localT = st - cyc * period,
      dur = 0.14;
    const willBlink = hash1(cyc * 5.21 + seedOff) > 0.55;
    if (!willBlink || localT > dur) return 1;
    return 1 - Math.sin((Math.PI * localT) / dur) * 0.92;
  }

  /**
   * animWraps: Menghitung pose matriks animasi seluruh sendi kerangka berdasarkan waktu dan kondisi.
   * Mengatur animasi idle (napas, goyangan), jalan kaki (walk), dan kedipan mata.
   * @param {number} T - Total akumulasi waktu animasi zombie dalam detik.
   *        Mengubah nilai ini mengatur kecepatan siklus pernapasan dada, goyangan badan idle, tolehan kepala, dan rambut.
   * @param {number} [walkTime=0] - Waktu siklus langkah berjalan dalam detik.
   *        Mengubah nilai ini mengatur tempo dan frekuensi hentakan ayunan langkah kaki dan lengan saat berjalan.
   * @param {boolean} [isWalking=false] - Status boolean apakah zombie sedang bergerak melangkah.
   *        Jika `true`: mengaktifkan blend langkah kaki penuh, ayunan lengan agresif, dan hentakan badan naik-turun (walkBob).
   *        Jika `false`: zombie masuk ke pose berdiri mengancam/idle dengan ayunan lembut pasif.
   * @returns {Object} Kumpulan matriks pembungkus pose untuk tiap sendi tubuh zombie.
   */
  function animWraps(T, walkTime = 0, isWalking = false) {
    // (1) TRANSLATE + (3) SCALING — napas zombie: ritme asimetris
    const breathe = Math.sin(T * 1.6) + 0.4 * Math.sin(T * 3.7 + 1);
    const bob = breathe * 0.025;
    const pulse = 1 + breathe * 0.014;

    // goyang badan (sway) + membungkuk
    const waistPivot = [0, 1.02, 0.15];
    const swayAngle = Math.sin(T * 0.5 + SEED * 2) * 0.05;
    const hunch = 0.05 + Math.sin(T * 0.5 + SEED * 2) * 0.018;
    const postureWrap = pivotRot(
      waistPivot,
      M(m4.X(hunch), m4.Z(swayAngle))
    );

    // Langkah bobbing saat berjalan
    const walkBob = isWalking ? Math.abs(Math.sin(walkTime * 4.2)) * 0.06 : 0;
    const idleWrap = M(
      m4.T(0, bob + walkBob, Math.sin(T * 0.8) * 0.02),
      postureWrap,
      m4.S(pulse, pulse, pulse)
    );

    // (2) ROTATE — kepala menoleh kiri-kanan + tilt
    const headPivot = [0, 1.72, 0.42];
    const headStep = Math.floor(T * 1.7) / 1.7;
    const headAngle = Math.sin(T * 0.8) * 0.35;
    const headTilt = Math.sin(headStep * 0.9 + SEED * 5) * 0.05 +
        twitchEnv(T, 4.4, SEED * 11) * 0.16;

    const headWrap = pivotRot(
      headPivot,
      M(m4.Y(headAngle), m4.Z(headTilt))
    );

    // (4) ARBITRARY AXIS: rotasi rahang menganga dengan sumbu engsel 3D miring
    // Menggambarkan rahang zombie yang agak terkilir / dislokasi asimetris khas zombie saat menganga
    const jawPivot = [0, 1.72, 0.55]; // titik tumpu engsel rahang di persendian tengkorak
    const jawBase = 0.12; // mulut sedikit terbuka saat diam agar gigi & rongga mulut terlihat rapi
    const jawSwing = ((1 - Math.cos(T * 2.2)) / 2) * 0.45;
    const jawAngle = jawBase + jawSwing;
    const jawAxis = [0.93, 0.22, -0.28]; // Sumbu engsel sembarang 3D (Arbitrary Axis)
    const jawWrap = pivotRot(jawPivot, axisRot(jawAxis, jawAngle));

    /**
     * Menghitung matriks transformasi sendi bahu dan siku lengan (Hierarchical Chain).
     * @param {number} s - Arah sisi tubuh (-1 untuk lengan kiri, +1 untuk lengan kanan).
     *        Mengubah parameter ini membalik letak koordinat tumpu X dan membedakan fase ayunan kiri vs kanan.
     * @param {Object} o - Parameter karakteristik ayunan lengan:
     * @param {number} o.freq - Frekuensi osilasi ayunan bahu. Mengubah cepat-lambatnya gerakan ayun.
     * @param {number} o.phase - Pergeseran fase sudut awal. Mengubah keselarasan waktu ayunan.
     * @param {number} o.amp - Amplitudo sudut ayunan bahu saat diam. Mengubah luas jangkauan ayun tangan.
     * @param {number} o.elAmp - Amplitudo sudut tekukan siku. Mengubah lentur tekukan siku.
     * @param {number} o.loose - Sudut default kelenturan siku saat rileks.
     * @param {number} o.twPeriod - Periode jeda waktu sentakan/twitch lengan.
     * @param {number} o.twSeed - Nilai benih pengacak twitching lengan.
     * @param {number} o.twAmp - Amplitudo sudut kekuatan sentakan twitch.
     * @returns {{shWrap: Float32Array, elWrap: Float32Array}} Pasangan matriks rotasi bahu (`shWrap`) dan siku (`elWrap`).
     */
    function armWrap(s, o) {
      const shPivot = [s * 0.26, 1.47, 0.29];
      let shAngle = Math.sin(T * o.freq + o.phase) * o.amp;
      shAngle += twitchEnv(T, o.twPeriod, o.twSeed) * o.twAmp;

      // Ayunan langkah saat berjalan
      if (isWalking) {
        const walkArmAngle = Math.sin(walkTime * 4.2 + (s < 0 ? Math.PI : 0)) * 0.55;
        shAngle = shAngle * 0.3 + walkArmAngle;
      }

      const shWrap = pivotRot(shPivot, m4.X(shAngle));
      const elPivot = [s * 0.32, 1.35, 0.65];
      let elAngle = o.loose + Math.sin(T * o.freq + o.phase + 1) * o.elAmp;

      if (isWalking) {
        elAngle += 0.2 + Math.max(0, Math.sin(walkTime * 4.2 + (s < 0 ? Math.PI : 0))) * 0.35;
      }

      const elWrap = pivotRot(elPivot, m4.X(elAngle));
      return { shWrap, elWrap };
    }

    const armL = armWrap(-1, {
      freq: 1.35,
      phase: 0,
      amp: 0.5,
      elAmp: 0.25,
      loose: 0.32,
      twPeriod: 5.2,
      twSeed: SEED * 7 + 10,
      twAmp: 0.4,
    });
    const armR = armWrap(1, {
      freq: 1.05,
      phase: Math.PI * 0.6,
      amp: 0.3,
      elAmp: 0.16,
      loose: 0.14,
      twPeriod: 3.7,
      twSeed: SEED * 17 + 90,
      twAmp: 0.22,
    });

    /**
     * Menghitung matriks transformasi hierarki sendi pinggul dan lutut kaki (Hierarchical Leg Chain).
     * @param {number} s - Arah sisi tubuh (-1 untuk kaki kiri, +1 untuk kaki kanan).
     *        Mengubah koordinat tumpu X pada pinggul dan lutut.
     * @param {number} phase - Beda fase langkah kaki (biasanya 0 untuk kaki kiri, $\pi$ untuk kaki kanan agar melangkah bergantian).
     *        Mengubah keteraturan ritme ayunan langkah kaki depan-belakang.
     * @param {number} hipBase - Sudut kemiringan dasar sendi pinggul saat diam (default offset).
     * @param {number} kneeBase - Sudut tekukan dasar sendi lutut saat diam.
     * @returns {{hipWrap: Float32Array, kneeWrap: Float32Array}} Pasangan matriks rotasi pinggul (`hipWrap`) dan lutut (`kneeWrap`).
     */
    function legWrap(s, phase, hipBase, kneeBase) {
      const hipPivot = [s * 0.13, 0.95, -0.01];
      let hipAngle =
        hipBase + Math.sin(T * 1.35 + phase) * 0.055;

      const kneePivot = [s * 0.13, 0.55, 0];
      let kneeAngle =
        kneeBase + Math.sin(T * 1.35 + phase) * 0.03;

      // Langkah berjalan penuh
      if (isWalking) {
        const walkLegPhase = walkTime * 4.2 + (s < 0 ? 0 : Math.PI);
        const walkHip = Math.sin(walkLegPhase) * 0.65;
        const walkKnee = Math.max(0, -Math.sin(walkLegPhase)) * 0.85 + 0.1;
        hipAngle = hipAngle * 0.15 + walkHip;
        kneeAngle = kneeAngle * 0.15 + walkKnee;
      }

      const hipWrap = pivotRot(hipPivot, m4.X(hipAngle));
      const kneeWrap = pivotRot(kneePivot, m4.X(kneeAngle));
      return { hipWrap, kneeWrap };
    }

    const legL = legWrap(-1, 0, -0.35, 0.45);
    const legR = legWrap(1, Math.PI, 0.1, 0.15);

    /**
     * Menghitung matriks rotasi goyangan helai rambut di atas kepala zombie.
     * @param {number} idx - Indeks helai rambut (0 sampai 9).
     *        Mengubah indeks ini memberikan beda fase osilasi antar helai agar rambut tampak berkibar secara organik/tidak kaku.
     * @returns {Float32Array} Matriks rotasi tumpu helai rambut.
     */
    function hairWrap(idx) {
      const pivot = [0, 2.2, 0.4];
      return pivotRot(
        pivot,
        m4.Z(Math.sin(T * 2.1 + idx * 2.1 + SEED * 4) * 0.05)
      );
    }
    const hair = Array.from({ length: 10 }, (_, i) => hairWrap(i));
    const blink = blinkEnv(T, SEED * 13);

    return {
      idleWrap,
      headWrap,
      jawWrap,
      armL,
      armR,
      legL,
      legR,
      hair,
      blink,
    };
  }

  return animWraps;
}

/**
 * Menerapkan kumpulan matriks pose hasil kalkulasi animasi ke pohon tulang kerangka `BoneNode` zombie.
 * @param {Function} getBone - Fungsi pencari simpul tulang berdasarkan nama: `getBone(name: string) => BoneNode`.
 *        Mengubah pemetaan nama tulang di fungsi ini menghubungkan matriks pose ke bagian tubuh yang berbeda pada kerangka.
 * @param {Object} A - Objek pose pembungkus matriks hasil kembalian dari fungsi `animWraps`:
 *        - `A.idleWrap`: Matriks translasi, bungkukan punggung, dan skala denyut napas badan.
 *        - `A.headWrap`: Matriks tolehan hadap (yaw) dan kemiringan (tilt) kepala zombie.
 *        - `A.jawWrap`: Matriks rotasi engsel sumbu sembarang (arbitrary axis) rahang menganga asimetris.
 *        - `A.hair`: Array matriks goyangan 10 helai rambut.
 *        - `A.blink`: Skalar tinggi kelopak mata untuk efek kedip pipih.
 *        - `A.armL`, `A.armR`: Matriks bahu (`shWrap`) dan siku (`elWrap`) lengan kiri dan kanan.
 *        - `A.legL`, `A.legR`: Matriks pinggul (`hipWrap`) dan lutut (`kneeWrap`) kaki kiri dan kanan.
 * @returns {void}
 */
export function applyZombiePose(getBone, A) {
  getBone("body").animMatrix = A.idleWrap;
  getBone("head").animMatrix = A.headWrap;
  getBone("jaw").animMatrix = A.jawWrap;
  for (let i = 0; i < 10; i++) getBone("hair" + i).animMatrix = A.hair[i];
  getBone("eyeL").animMatrix = M(m4.T(0, 1.9, 0), m4.S(1, A.blink, 1), m4.T(0, -1.9, 0));
  getBone("eyeR").animMatrix = M(m4.T(0, 1.91, 0), m4.S(1, A.blink, 1), m4.T(0, -1.91, 0));
  getBone("armL_upper").animMatrix = A.armL.shWrap;
  getBone("armL_lower").animMatrix = A.armL.elWrap;
  getBone("armR_upper").animMatrix = A.armR.shWrap;
  getBone("armR_lower").animMatrix = A.armR.elWrap;
  getBone("legL_upper").animMatrix = A.legL.hipWrap;
  getBone("legL_lower").animMatrix = A.legL.kneeWrap;
  getBone("legR_upper").animMatrix = A.legR.hipWrap;
  getBone("legR_lower").animMatrix = A.legR.kneeWrap;
}
