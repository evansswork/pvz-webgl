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
   * Konstruktor ZombiePart
   * @param {WebGLRenderingContext} gl - Konteks WebGL
   * @param {Object} geometry - Data geometri { p: posisi vertex, n: normal, i: indeks segitiga }
   * @param {Array<number>} localMatrix - Matriks transformasi lokal relatif terhadap tulang induk
   * @param {Array<number>} color - Warna dasar RGB ter-normalisasi [0.0 - 1.0]
   * @param {string} type - Jenis primitif/kategori mesh (ellipsoid, cylinder, box, curve, tri)
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
   * setup: Mengalokasikan dan mengunggah data posisi, normal, dan indeks ke GPU buffer.
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
   * render: Menggambar mesh part dengan memperhitungkan transformasi induk dan material.
   * @param {WebGLRenderingContext} gl - Konteks WebGL
   * @param {Array<number>} parentWorldWrap - Matriks dunia dari tulang induk (Hierarchical Matrix)
   * @param {Object} shaderData - Lokasi atribut & uniform shader aktif
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
   * Konstruktor BoneNode
   * @param {string} name - Nama pengenal tulang (contoh: "head", "armL_upper", "legR_lower")
   */
  constructor(name) {
    this.name = name; 
    this.animMatrix = m4.I(); // Matriks transformasi animasi saat ini (default: matriks identitas)
    this.children = [];       // Daftar BoneNode anak yang mewarisi gerakan tulang ini
    this.parts = [];          // Kumpulan ZombiePart (mesh geometri) yang menempel langsung pada tulang ini
  }

  /**
   * setup: Menginisialisasi buffer WebGL untuk semua parts dan tulang anak secara rekursif.
   * @param {WebGLRenderingContext} gl - Konteks WebGL
   */
  setup(gl) { 
    this.parts.forEach(p => p.setup()); 
    this.children.forEach(c => c.setup(gl)); 
  }

  /**
   * render: Menerapkan transformasi hierarkis lalu menggambar parts dan seluruh anak secara rekursif.
   * @param {WebGLRenderingContext} gl - Konteks WebGL
   * @param {Array<number>} parentWrap - Matriks dunia dari tulang induk di atasnya
   * @param {Object} shaderData - Informasi lokasi uniform dan atribut shader
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
