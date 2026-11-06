/* =========================================================================
   zombie/animation.js — Animasi Zombie (dihitung tiap frame)
     TRANSLATE + SCALING : napas (badan naik-turun + membesar), langkah jalan
     ROTATE              : kepala menoleh, rahang, lengan & kaki berayun
     SCALING             : mata berkedip (tinggi mata di-scale)
     HIERARCHICAL        : bahu → siku, pinggul → lutut, kepala → rahang/mata/rambut
   ========================================================================= */
import { m4, M, axisRot } from "../../core/math.js";

/** Buat fungsi pose. Dipanggil SETELAH model dibangun (urutan Math.random tetap sama). */
export function makeZombieAnimator() {
      // SEED acak tiap kali halaman dibuka, supaya fase animasi (goyang, kedip, twitch) selalu sedikit berbeda
      const SEED = Math.random() * 1000;

      /**
       * pivotRot: Melakukan rotasi objek terhadap titik tumpu tertentu (pivot point) di ruang 3D.
       * Formula: Translasi(+pivot) * Rotasi * Translasi(-pivot)
       * @param {Array<number>} p - Titik tumpu engsel sendi [px, py, pz]
       * @param {Array<number>} Rm - Matriks rotasi yang ingin diterapkan
       * @returns {Array<number>} Matriks transformasi gabungan
       */
      function pivotRot(p, Rm) {
        return M(m4.T(p[0], p[1], p[2]), Rm, m4.T(-p[0], -p[1], -p[2]));
      }

      // hash1: pseudo-random [0,1) dari sebuah angka — dipakai supaya twitch/kedip tidak terasa berulang identik
      function hash1(n) {
        const s = Math.sin(n) * 43758.5453;
        return s - Math.floor(s);
      }

      // amplop sentakan singkat & acak setiap `period` detik (dipakai utk twitch kepala/lengan)
      function twitchEnv(t, period, seedOff) {
        const st = t + seedOff,
          cyc = Math.floor(st / period),
          localT = st - cyc * period,
          dur = 0.16;
        const rnd = hash1(cyc * 13.71 + seedOff * 3.13);
        if (localT > dur) return 0;
        return Math.sin((Math.PI * localT) / dur) * (0.35 + 0.65 * rnd);
      }

      // amplop kedip mata: acak apakah berkedip di siklus ini, lalu tutup-buka cepat
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
   * @param {number} T - Waktu berjalan animasi (detik)
   * @param {number} walkTime - Waktu siklus langkah berjalan
   * @param {boolean} isWalking - Status apakah zombie sedang melangkah
   * @returns {Object} Kumpulan matriks pembungkus pose untuk tiap sendi
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

    // (4) ROTASI RAHANG — engsel rahang (mandibular pivot) tepat di pertemuan pangkal rahang & kepala [0, 1.72, 0.55]
    const jawPivot = [0, 1.72, 0.55]; // titik tumpu engsel rahang sesuai titik awal/akhir jawCurve
    const jawBase = 0.12; // mulut sedikit terbuka saat diam agar gigi & rongga mulut terlihat rapi
    const jawSwing = ((1 - Math.cos(T * 2.2)) / 2) * 0.45;
    const jawAngle = jawBase + jawSwing;
    const jawAxis = [1, 0, 0]; // sumbu engsel horizontal rapi (seperti mekanisme pvz-webgl)
    const jawWrap = pivotRot(jawPivot, axisRot(jawAxis, jawAngle));

    // (5) HIERARCHICAL TRANSFORMATION — lengan berayun (bahu -> siku)
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

    // Kaki: pinggul dan lutut terpisah
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

/** Tulis pose ke tulang-tulang Zombie */
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
