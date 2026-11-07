import { M, m4, tr, inv } from "../../core/math.js";

/**
 * ==============================================================================
 * CLASS: ZombiePart
 * ==============================================================================
 * Merepresentasikan satu bagian mesh individual pada tubuh zombie (misal: satu bola mata,
 * satu kancing, gigi, segmen jas robek, dasi, dsb).
 * Mengelola WebGL buffer (posisi, normal, indeks) dan rendering transformasinya.
 * ==============================================================================
 */
export class ZombiePart {
  /**
   * Konstruktor ZombiePart.
   * @param {WebGLRenderingContext} gl - Konteks rendering WebGL aktif. Menghubungkan pembuatan buffer GPU ke canvas yang bersangkutan.
   * @param {Object} geometry - Data geometri pembentuk bentuk 3D:
   *        - `geometry.p`: Float32Array koordinat posisi vertex $[x, y, z]$. Mengubah bentuk fisik dan lekukan bagian tubuh.
   *        - `geometry.n`: Float32Array vektor normal permukaan vertex $[nx, ny, nz]$. Mengubah orientasi pantulan cahaya dan efek shading.
   *        - `geometry.i`: Uint16Array indeks segitiga pembentuk poligon. Mengubah topologi susunan muka (faces).
   * @param {Array<number>|Float32Array} localMatrix - Matriks transformasi lokal relatif terhadap tulang induk penempelnya.
   *        Mengubah posisi offset (translasi), kemiringan sudut (rotasi), atau proporsi ukuran (skala) bagian tubuh ini terhadap sendi tulangnya.
   * @param {Array<number>} color - Vektor warna dasar RGB ternormalisasi `[r, g, b]` dalam rentang [0.0 - 1.0].
   *        Mengubah warna visual material bagian tubuh (misal: warna kulit hijau zombie, jas cokelat, atau dasi merah).
   * @param {string} type - Label pengenal jenis primitif/kategori mesh (contoh: "ellipsoid", "cylinder", "box", "curve", "tri").
   *        Digunakan untuk pengkategorian debugging visual atau pengelompokan jenis bentuk.
   */
  constructor(gl, geometry, localMatrix, color, type) {
    this.gl = gl;
    this.geometry = geometry;
    this.localMatrix = localMatrix;
    this.color = color;
    this.type = type;
    this.pBuffer = null; 
    this.nBuffer = null; 
    this.iBuffer = null; 
    this.count = 0;
  }

  /**
   * Mengalokasikan dan mengunggah data posisi, normal, dan indeks segitiga geometri ke memori GPU (VBO & IBO).
   * Fungsi ini tidak menerima parameter karena memanfaatkan properti `this.gl` dan `this.geometry` yang diinisialisasi saat instansiasi.
   * @returns {void}
   */
  setup() {
    const gl = this.gl;
    // Buffer posisi vertex
    this.pBuffer = gl.createBuffer(); 
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pBuffer); 
    gl.bufferData(gl.ARRAY_BUFFER, this.geometry.p, gl.STATIC_DRAW);

    // Buffer normal vektor (untuk pencahayaan/lighting)
    this.nBuffer = gl.createBuffer(); 
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nBuffer); 
    gl.bufferData(gl.ARRAY_BUFFER, this.geometry.n, gl.STATIC_DRAW);

    // Buffer indeks elemen segitiga
    this.iBuffer = gl.createBuffer(); 
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iBuffer); 
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.geometry.i, gl.STATIC_DRAW);

    this.count = this.geometry.i.length;
  }

  /**
   * Menggambar mesh part ke layar dengan memperhitungkan transformasi hierarkis induk dan pengiriman seragam shader.
   * @param {WebGLRenderingContext} gl - Konteks WebGL aktif tempat instruksi draw call (`gl.drawElements`) dieksekusi.
   * @param {Array<number>|Float32Array} parentWorldWrap - Matriks dunia akumulasi dari tulang induk (Hierarchical Matrix).
   *        Mengubah posisi, rotasi, dan skala keseluruhan bagian tubuh ini di dunia 3D mengikuti gerakan tulang induknya.
   * @param {Object} shaderData - Objek pemetaan lokasi atribut dan uniform shader aktif:
   *        - `shaderData.uM`: Lokasi uniform WebGLUniformLocation untuk Model World Matrix ($W$).
   *        - `shaderData.uNm`: Lokasi uniform untuk Normal Matrix ($\text{transpose}(\text{inverse}(W))$).
   *        - `shaderData.uC`: Lokasi uniform untuk Color RGB ($uC$).
   *        - `shaderData.aP`: Lokasi atribut vertex shader posisi ($aP$).
   *        - `shaderData.aN`: Lokasi atribut vertex shader normal ($aN$).
   *        Mengganti objek ini memungkinkan part dirender menggunakan shader alternatif (misal shadow map shader atau debug flat shader).
   * @returns {void}
   */
  render(gl, parentWorldWrap, shaderData) {
    // 1. Transformasi Hierarkis: W = parentWorldWrap * localMatrix
    const W = M(parentWorldWrap, this.localMatrix);
    gl.uniformMatrix4fv(shaderData.uM, false, new Float32Array(W));

    // 2. Matriks Normal: transpose(inverse(W)) agar vektor normal tidak terdistorsi oleh non-uniform scale
    gl.uniformMatrix4fv(shaderData.uNm, false, new Float32Array(tr(inv(W))));

    // 3. Uniform warna material
    gl.uniform3fv(shaderData.uC, this.color);

    // 4. Binding atribut posisi vertex
    gl.bindBuffer(gl.ARRAY_BUFFER, this.pBuffer); 
    gl.vertexAttribPointer(shaderData.aP, 3, gl.FLOAT, false, 0, 0); 
    gl.enableVertexAttribArray(shaderData.aP);

    // 5. Binding atribut normal vektor
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nBuffer); 
    gl.vertexAttribPointer(shaderData.aN, 3, gl.FLOAT, false, 0, 0); 
    gl.enableVertexAttribArray(shaderData.aN); 

    // 6. Eksekusi draw call elemen segitiga
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.iBuffer); 
    gl.drawElements(gl.TRIANGLES, this.count, gl.UNSIGNED_SHORT, 0);
  }
}

/**
 * ==============================================================================
 * CLASS: BoneNode
 * ==============================================================================
 * Merepresentasikan simpul tulang/sendi dalam struktur hierarki kerangka (Scene Graph).
 * Mengatur hubungan parent-child dan mewariskan transformasi matriks ke seluruh anak
 * serta bagian tubuh (parts) yang menempel padanya.
 * ==============================================================================
 */
export class BoneNode {
  /**
   * Konstruktor BoneNode.
   * @param {string} name - Nama string pengenal unik tulang/sendi (contoh: "root", "body", "head", "jaw", "armL_upper", "legR_lower").
   *        Mengubah string ini akan mengubah kunci akses pemanggilan tulang saat pose animasi diterapkan lewat `getBone(name)`.
   */
  constructor(name) {
    this.name = name; 
    this.animMatrix = m4.I(); // Matriks transformasi animasi saat ini (default: matriks identitas)
    this.children = [];       // Daftar BoneNode anak yang mewarisi gerakan tulang ini
    this.parts = [];          // Kumpulan ZombiePart (mesh geometri) yang menempel langsung pada tulang ini
  }

  /**
   * Menginisialisasi GPU buffer untuk seluruh parts pada tulang ini serta meneruskan inisialisasi ke seluruh tulang anak secara rekursif.
   * @param {WebGLRenderingContext} gl - Konteks WebGL aktif yang digunakan untuk mengalokasikan memori GPU di seluruh rantai hierarki sendi.
   * @returns {void}
   */
  setup(gl) { 
    this.parts.forEach(p => p.setup()); 
    this.children.forEach(c => c.setup(gl)); 
  }

  /**
   * Menerapkan akumulasi transformasi hierarki kerangka, lalu merender seluruh bagian tubuh (parts) dan meneruskan ke anak-anaknya secara rekursif.
   * @param {WebGLRenderingContext} gl - Konteks WebGL aktif tempat geometri digambar.
   * @param {Array<number>|Float32Array} parentWrap - Matriks transformasi dunia dari tulang induk di tingkat atasnya.
   *        Mengubah matriks ini akan memindahkan/memutar seluruh sub-pohon kerangka di bawah tulang ini secara serentak (misal rotasi badan akan membawa kepala dan tangan).
   * @param {Object} shaderData - Pemetaan lokasi uniform dan atribut WebGL shader yang aktif (uM, uNm, uC, aP, aN).
   *        Mengubah parameter ini mengalihkan target pipeline shader yang digunakan untuk menggambar seluruh rantai tulang kerangka ini.
   * @returns {void}
   */
  render(gl, parentWrap, shaderData) {
    // Akumulasi transformasi: currentWrap = parentWrap * animMatrix tulang ini
    let currentWrap = M(parentWrap, this.animMatrix);

    // Render seluruh mesh yang menempel pada tulang ini
    this.parts.forEach(p => p.render(gl, currentWrap, shaderData));

    // Teruskan matriks transformasi ini ke seluruh tulang anak secara rekursif
    this.children.forEach(c => c.render(gl, currentWrap, shaderData));
  }
}
