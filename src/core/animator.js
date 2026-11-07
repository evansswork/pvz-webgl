/* =========================================================================
   animator.js — Pengatur aksi animasi generik (dipakai semua karakter)
   Tiap aksi: { dur, apply(p, pose, ctx, world) }
   p = progres 0..1. Banyak aksi boleh berjalan bersamaan (pose dijumlahkan).
   ========================================================================= */

/**
 * Class Animator
 * Mengelola state mesin animasi, transisi antar pose, siklus gerakan diam (idle loop),
 * serta penumpukan aksi dinamis secara bersamaan (action blending/layering).
 */
export class Animator {
  /**
   * Konstruktor untuk menginisialisasi sistem Animator sebuah karakter.
   * @param {Object} config - Objek konfigurasi animasi karakter:
   * @param {Object<string, {dur: number, apply: Function}>} config.actions - Kumpulan definisi aksi terdaftar (misal: 'shoot', 'sway', 'grow', 'look').
   *        Setiap aksi memiliki durasi waktu (`dur` dalam detik) dan fungsi pengubah pose (`apply`).
   *        Mengganti daftar ini akan mengubah aksi apa saja yang bisa dijalankan oleh karakter saat tombol dipicu.
   * @param {Function} config.idle - Fungsi callback pose default saat tidak ada aksi (idle loop).
   *        Fungsi ini menerima parameter `(pose, time)` untuk menghasilkan goyangan tubuh lembut alami.
   *        Mengganti fungsi ini akan mengubah ritme, kecepatan napas, kedipan mata, atau ayunan pasif karakter saat diam.
   * @param {Function} config.makePose - Fungsi pembuat/pembersih struktur objek pose kosong `() => ({ ... })`.
   *        Mengganti fungsi ini akan menentukan properti transformasi apa saja yang tersedia (misal: `headOffset`, `neckYaw`, `eyeScale`, `leafFlap`).
   * @param {Object} [config.world] - Antarmuka interaksi dunia luar/lingkungan (opsional).
   *        Menyediakan fungsi pemicu efek dunia luar saat animasi mencapai frame tertentu (misal: memanggil `firePea()` untuk meluncurkan peluru atau melahirkan partikel koin Sun).
   */
  constructor({ actions, idle, makePose, world }) {
    this.actions = actions;
    this.idle = idle;
    this.makePose = makePose;
    this.world = world;
    this.active = [];
  }

  /**
   * Memicu/mengeksekusi aksi animasi tertentu berdasarkan nama.
   * Jika aksi tersebut sedang berjalan di tengah jalan, aksi akan di-reset dari awal (t = 0).
   * @param {string} name - Nama pengenal aksi yang ingin dipicu (misal: "shoot", "sun", "sway", "look", atau "grow").
   *        Mengganti nilai parameter string ini akan mengubah aksi animasi mana yang akan dimulai dan dijalankan pada frame berikutnya.
   * @returns {void}
   */
  trigger(name) {
    const def = this.actions[name];
    if (!def) return;
    // Hapus aksi aktif yang bernama sama agar di-restart dari detik ke-0
    this.active = this.active.filter((a) => a.name !== name);
    this.active.push({ name, def, t: 0, ctx: {} });
  }

  /**
   * Memperbarui state waktu animasi per frame, menghitung siklus idle, dan mengompilasi semua aksi aktif ke dalam objek pose final.
   * @param {number} dt - Delta time (selisih waktu antar frame dalam satuan detik, misal 0.016s untuk 60 FPS).
   *        Mengganti/memanipulasi nilai `dt` akan mengubah kecepatan jalannya seluruh animasi (misal: mengalikan dengan 0.5 untuk efek slow-motion, atau 2.0 untuk mempercepat).
   * @param {number} time - Total akumulasi waktu aplikasi sejak pertama kali dijalankan (dalam satuan detik).
   *        Mengganti nilai `time` akan menggeser fase osilasi gelombang periodik sinus/cosinus pada animasi diam (idle sway).
   * @returns {Object} Objek pose akhir yang sudah dikalkulasi nilainya, siap dikirim ke fungsi `applyPose(model, pose)` untuk menggerakkan sendi-sendi mesh.
   */
  update(dt, time) {
    // 1. Buat template struktur pose awal bersih
    const pose = this.makePose();

    // 2. Terapkan goyangan siklus pasif (idle base)
    this.idle(pose, time);

    // 3. Terapkan seluruh aksi khusus yang sedang aktif secara bertumpuk (layering)
    for (const a of this.active) {
      a.t += dt;
      // p = faktor progres waktu ternormalisasi dari 0.0 (awal aksi) sampai 1.0 (akhir durasi)
      const p = Math.min(a.t / a.def.dur, 1);
      a.def.apply(p, pose, a.ctx, this.world);
    }

    // 4. Bersihkan aksi yang durasi waktunya sudah habis (t >= def.dur)
    this.active = this.active.filter((a) => a.t < a.def.dur);

    return pose;
  }
}
