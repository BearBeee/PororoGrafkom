import { Node } from "./helpers/node.js";
import { LOOPY_BUILDERS as B } from "./helpers/builders.js";
import { createLoopyAnimation } from "./loopy-anim.js";

// =====================================================================
//  LOOPY — si berang-berang merah muda
//
//  createLoopy(GL) membuat shader, mesh & hierarki Loopy di context WebGL
//  yang sama dengan scene, lalu mengembalikan:
//     root          : node akar (dasar telapak Loopy di y = 0, tinggi 4.17 unit)
//     update(t)     : animasi (napas, menengok, kedip, wink, melambai, ekor, LARI mengejar kupu-kupu)
//     draw(scene)   : gambar Loopy. scene = { P, V, M, camPos }
// =====================================================================
export function createLoopy(GL) {
    /* ================= SHADER =================
       Vertex shader  : titik -> ruang dunia -> layar, teruskan normal & warna.
       Fragment shader: pencahayaan per piksel (diffuse lembut + specular Blinn-Phong). */
    var vs = `
        attribute vec3 position, color, normal;
        uniform mat4 Pmatrix, Vmatrix, Mmatrix;
        varying vec3 vNormal, vColor, vWorldPosition;
        void main(void) {
            vec4 worldPosition = Mmatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            vNormal = normalize((Mmatrix * vec4(normal, 0.0)).xyz);
            vColor = color;
            gl_Position = Pmatrix * Vmatrix * worldPosition;
        }`;
    var fs = `
        precision mediump float;
        uniform vec3 lightDirection, ambientLight, cameraPos;
        varying vec3 vNormal, vColor, vWorldPosition;
        void main(void) {
            vec3 N = normalize(vNormal);
            vec3 L = normalize(lightDirection);
            float diffuse = max(dot(N, L), 0.0);
            float soft = 0.35 + 0.65 * diffuse;
            vec3 viewDir = normalize(cameraPos - vWorldPosition);
            vec3 halfDir = normalize(L + viewDir);
            float specular = pow(max(dot(N, halfDir), 0.0), 32.0);
            vec3 finalColor = vColor * (ambientLight + vec3(soft)) + vec3(specular * 0.16);
            gl_FragColor = vec4(min(finalColor, vec3(1.0)), 1.0);
        }`;
    function compile(src, type) {
        var s = GL.createShader(type); GL.shaderSource(s, src); GL.compileShader(s);
        if (!GL.getShaderParameter(s, GL.COMPILE_STATUS)) { alert(GL.getShaderInfoLog(s)); return null; }
        return s;
    }
    var VS = compile(vs, GL.VERTEX_SHADER), FS = compile(fs, GL.FRAGMENT_SHADER);
    if (!VS || !FS) return;
    var PROG = GL.createProgram();
    GL.attachShader(PROG, VS); GL.attachShader(PROG, FS);
    GL.bindAttribLocation(PROG, 0, "position"); GL.bindAttribLocation(PROG, 1, "color"); GL.bindAttribLocation(PROG, 2, "normal");
    GL.linkProgram(PROG);
    if (!GL.getProgramParameter(PROG, GL.LINK_STATUS)) { alert(GL.getProgramInfoLog(PROG)); return; }
    var _pos = GL.getAttribLocation(PROG, "position"), _col = GL.getAttribLocation(PROG, "color"),
        _nor = GL.getAttribLocation(PROG, "normal");
    GL.enableVertexAttribArray(_pos); GL.enableVertexAttribArray(_col); GL.enableVertexAttribArray(_nor);
    var _P = GL.getUniformLocation(PROG, "Pmatrix"), _V = GL.getUniformLocation(PROG, "Vmatrix"),
        _M = GL.getUniformLocation(PROG, "Mmatrix");
    var _light = GL.getUniformLocation(PROG, "lightDirection"), _amb = GL.getUniformLocation(PROG, "ambientLight"),
        _cam = GL.getUniformLocation(PROG, "cameraPos");
    GL.useProgram(PROG);
    GL.uniform3f(_light, -0.5, 0.8, 1.0);
    GL.uniform3f(_amb, 0.12, 0.12, 0.12);

    /* ================= PALET ================= */
    var PINK      = [0.97, 0.56, 0.64];
    var INNER_EAR = [0.99, 0.80, 0.85];
    var WHITE     = [0.98, 0.97, 0.95];
    var BLACK     = [0.04, 0.03, 0.05];
    var NOSE_COL  = [0.45, 0.10, 0.38];
    var MOUTH_IN  = [0.28, 0.06, 0.12];   // rongga mulut terbuka (merah tua)
    var ORANGE    = [0.95, 0.50, 0.32];
    var FOOT_COL  = [0.43, 0.22, 0.21];   // telapak kaki coklat tua (berang-berang)
    var TOE_COL   = [0.49, 0.26, 0.24];
    var NAIL_COL  = [0.30, 0.12, 0.15];   // kuku tangan
    var TOE_NAIL_COL = [0.20, 0.08, 0.08];// kuku kaki

    /* ================= HELPER ================= */
    function makeMesh(geo) {
        var vb = GL.createBuffer(); GL.bindBuffer(GL.ARRAY_BUFFER, vb);
        GL.bufferData(GL.ARRAY_BUFFER, new Float32Array(geo.vertices), GL.STATIC_DRAW);
        var fb = GL.createBuffer(); GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, fb);
        GL.bufferData(GL.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.faces), GL.STATIC_DRAW);
        return { vb: vb, fb: fb, n: geo.faces.length };
    }
    // Berbeda dari Eddy: part() menerima MESH yang sudah jadi (bukan geometri), karena beberapa mesh
    // dipakai berulang (mata, kuku, jari) dan animasi menukar mesh mata (bola <-> garis wink).
    function part(parent, name, mesh, pos, rot) {
        var node = new Node(name, pos, rot);
        node.mesh = mesh;
        return parent.add(node);
    }

    /* ================= MESH (1 unit = 100 px pada gambar referensi) ================= */
    // KEPALA: shaped head            rx    ryUp  ryDown  rz
    var headMesh = makeMesh(B.generateShapedHead(1.39, 1.67, 1.17, 1.30, PINK, 80, 56, {
        topStart: 0.5,      // pelebaran atas mulai di 50% tinggi
        topFull: 0.30,      // lebar atas bertambah hingga +30%
        topPower: 1.5,
        cheek: 0.0,         // pipi gaussian dimatikan
        cheekY: -0.4,
        cheekWidth: 0.35,
        bulges: [           // 2 tonjolan = pipi chubby kiri & kanan
            { dir: [-0.62, -0.36, 0.70], amount: 0.045, spread: 0.22 },
            { dir: [ 0.62, -0.36, 0.70], amount: 0.045, spread: 0.22 }
        ]
    }));
    var earMesh      = makeMesh(B.generateEllipsoid(0.195, 0.21, 0.08, PINK, 40, 24));
    var earInnerMesh = makeMesh(B.generateEllipsoid(0.105, 0.12, 0.035, INNER_EAR, 32, 16));
    var eyeMesh      = makeMesh(B.generateEllipsoid(0.125, 0.13, 0.075, BLACK, 32, 16));
    var noseMesh     = makeMesh(B.generateEllipticParaboloid(0.30, 0.255, 0.27, NOSE_COL, 48, 20));
    var mouthMesh    = makeMesh(B.generateEllipsoid(0.25, 0.075, 0.05, MOUTH_IN, 32, 16));
    var teethMesh    = makeMesh(B.generateRoundedBox(0.095, 0.075, 0.04, 4, WHITE, 32, 20));   // 1 gigi seri
    var tuftMesh1    = makeMesh(B.generateEllipsoid(0.04, 0.32, 0.03, ORANGE, 16, 12));     // jambul daun 1
    var tuftMesh2    = makeMesh(B.generateEllipsoid(0.04, 0.20, 0.03, ORANGE, 16, 12));     // jambul daun 2

    // BADAN: pear body (lebar ~83% lebar kepala) + PERUT ellipsoid putih
    var bodyMesh  = makeMesh(B.generatePearBody(1.15, 1.40, 1.02, PINK, 64, 44, 0.12));
    var bellyMesh = makeMesh(B.generateEllipsoid(0.75, 0.95, 0.50, WHITE, 40, 28));

    // LENGAN: swept tube sepanjang Bezier kuadratik, menjuntai ~35 derajat ke bawah-samping.
    //   P0 = pangkal (tertanam di badan atas), P1 = kontrol lengkung ke luar, P2 = ujung tangan (ARM_END)
    var ARM_P0 = [0.45, 1.05, 0.05], ARM_P1 = [1.05, 0.62, 0.20];
    var ARM_END = [1.58, -0.27, 0.35];   // ujung tangan sisi kanan (x positif); kuku tumbuh dari sini
    var ARM_TIP_ANGLE = 2.55;            // arah kuku (rad): miring ke bawah-luar
    function armRadius(t) {
        // sin() naik halus 0.17 -> 0.26, ujung & pangkal dibulatkan (seperempat elips)
        var r = 0.17 + 0.09 * Math.sin(Math.min(t / 0.85, 1.0) * Math.PI / 2);
        if (t > 0.80) { var u = (t - 0.80) / 0.20; r *= Math.sqrt(Math.max(0.0, 1 - u * u)); }
        if (t < 0.12) { var v = (0.12 - t) / 0.12; r *= Math.sqrt(Math.max(0.0, 1 - v * v)); }
        r = Math.max(r, 0.02);
        return { a: r, b: r };
    }
    function armMesh(sign) {
        return makeMesh(B.generateSweptTube(function (t) {
            var p = B.bezier2(ARM_P0, ARM_P1, ARM_END, t);
            return [sign * p[0], p[1], p[2]];
        }, armRadius, PINK, 80, 32, true, true, [0, 0, 1]));
    }
    var armMeshL = armMesh(-1), armMeshR = armMesh(1);
    var nailMesh = makeMesh(B.generateCone(0.03, 0.11, NAIL_COL, 12));              // kuku tangan

    // KAKI: telapak = ellipsoid pipih, jari = ellipsoid kecil, kuku = cone kecil
    var footMesh    = makeMesh(B.generateEllipsoid(0.43, 0.13, 0.53, FOOT_COL, 40, 24));
    var toeMesh     = makeMesh(B.generateEllipsoid(0.098, 0.072, 0.093, TOE_COL, 16, 12));
    var toeNailMesh = makeMesh(B.generateCone(0.03, 0.08, TOE_NAIL_COL, 8));

    // EKOR dayung berang-berang: swept tube Bezier dari bawah-belakang badan, melengkung lalu NAIK ke atas.
    //   P0 = pangkal (tertanam di badan bawah), P1 = kontrol (tarik ke belakang), P2 = ujung atas
    var TAIL_P0 = [0, -1.05, -0.45], TAIL_P1 = [0, -0.10, -1.65], TAIL_P2 = [0, 1.10, -1.55];
    function tailRadius(t) {
        // a = setengah lebar di bidang samping (y-z), b = setengah lebar kiri-kanan (x)
        var w = Math.min(t / 0.7, 1.0); w = w * w * (3 - 2 * w);   // smoothstep
        var a = 0.10 + 0.19 * w, b = 0.12 + 0.20 * w;
        if (t > 0.86) { var u = (t - 0.86) / 0.14, k = Math.sqrt(Math.max(0.0, 1 - u * u)); a *= k; b *= k; }
        if (t < 0.15) { var v = (0.15 - t) / 0.15, k2 = Math.sqrt(Math.max(0.0, 1 - v * v)); a *= k2; b *= k2; }
        return { a: Math.max(a, 0.02), b: Math.max(b, 0.02) };
    }
    // refVec [1,0,0]: penampang tidak terpelintir, sisi lebar ekor menghadap kiri-kanan
    var tailMesh = makeMesh(B.generateSweptTube(function (t) { return B.bezier2(TAIL_P0, TAIL_P1, TAIL_P2, t); },
        tailRadius, PINK, 40, 24, true, true, [1, 0, 0]));

    // MATA WINK: busur "⌒" (swept tube tipis sepanjang parabola), pengganti bola mata kanan saat wink
    var winkMesh = makeMesh(B.generateSweptTube(
        function (t) { var u = 2 * t - 1; return [-0.15 + 0.30 * t, 0.065 * (1 - u * u), 0]; },
        function (t) { var r = 0.014 + 0.016 * Math.sin(Math.PI * t); return { a: r, b: r }; },
        BLACK, 24, 12, true, true, [0, 0, 1]));

    /* ================= HIERARKI LOOPY ================= */
    // Kepala berpusat di HEAD_Y, badan di BODY_Y; badan sengaja menumpuk ke dalam kepala (tidak ada celah leher).
    var HEAD_Y = 1.239, BODY_Y = -1.00;
    var loopy = new Node("badan", [0, BODY_Y, 0]);   // BADAN = AKAR karakter
    loopy.mesh = bodyMesh;

    part(loopy, "perut", bellyMesh, [0, -0.15, 0.74]);

    /* ----- KEPALA (semua posisi relatif ke pusat kepala) ----- */
    var head = part(loopy, "kepala", headMesh, [0, HEAD_Y - BODY_Y, 0]);
    [-1, 1].forEach(function (side) {
        // telinga: ellipsoid luar, bagian dalam sedikit di depan (anak)
        var ear = part(head, side < 0 ? "telinga-kiri" : "telinga-kanan", earMesh, [side * 1.06, 1.27, 0.06]);
        part(ear, "telinga-dalam", earInnerMesh, [0, 0.01, 0.05]);
    });
    part(head, "mata-kiri",  eyeMesh, [-0.47, 0.405, 1.21]);
    part(head, "mata-kanan", eyeMesh, [ 0.47, 0.405, 1.21]);
    part(head, "mata-wink-kiri", null, [-0.47, 0.385, 1.205]);   // garis wink kiri (tersembunyi dulu)
    part(head, "mata-wink",  null,    [ 0.47, 0.385, 1.205]);   // garis wink kanan (tersembunyi dulu)
    part(head, "hidung", noseMesh, [0, -0.08, 1.26]);
    var mouth = part(head, "mulut", mouthMesh, [0, -0.60, 1.165]);
    // gigi anak KEPALA (bukan mulut) supaya ukurannya tidak ikut membesar saat mulut melebar untuk senyum
    part(head, "gigi", teethMesh, [0, -0.60 - 0.065, 1.165 + 0.03]);
    // jambul huruf V: grup di pangkal daun 1; daun 2 digeser relatif
    var tuft = part(head, "jambul", null, [0.09, 1.96, 0]);
    part(tuft, "jambul-daun1", tuftMesh1, [0, 0, 0], [0, 0, -0.22]);
    part(tuft, "jambul-daun2", tuftMesh2, [0.11, -0.16, 0], [0, 0, -0.90]);

    /* ----- LENGAN, KAKI ----- */
    [-1, 1].forEach(function (s) {
        var tag = s < 0 ? "kiri" : "kanan";

        // SENDI BAHU: pivot di titik B(0.2) kurva lengan, sehingga rotasinya memutar lengan seperti sendi.
        // Lengan & kuku digeser -pivot agar tetap di tempat semula saat rot = 0.
        var pivot = [s * 0.687, 0.859, 0.11];
        var shoulder = part(loopy, "bahu-" + tag, null, pivot);
        var arm = part(shoulder, "lengan-" + tag, s < 0 ? armMeshL : armMeshR, [-pivot[0], -pivot[1], -pivot[2]]);
        // 3 kuku di ujung lengan, tersebar tegak lurus arah ujung tangan
        var th = ARM_TIP_ANGLE, dirv = [s * Math.sin(th), Math.cos(th)], perp = [-s * Math.cos(th), Math.sin(th)];
        for (var c = -1; c <= 1; c++) {
            part(arm, "kuku-tangan", nailMesh, [
                s * ARM_END[0] - dirv[0] * 0.05 + perp[0] * c * 0.045,
                ARM_END[1]     - dirv[1] * 0.05 + perp[1] * c * 0.045,
                ARM_END[2]], [0, 0, -s * th]);
        }

        // KAKI (pivot pinggul): telapak + 4 jari (kuku = anak jari)
        var leg = part(loopy, "kaki-" + tag, null, [s * 0.45, -1.34, 0.0], [0, s * 0.42, 0]);
        part(leg, "telapak", footMesh, [0, 0, 0.26]);
        var toeX = [-0.28, -0.093, 0.093, 0.28], toeZ = [0.62, 0.73, 0.73, 0.62];   // jari tengah lebih maju
        for (var t = 0; t < 4; t++) {
            var toe = part(leg, "jari", toeMesh, [toeX[t], -0.005, toeZ[t]]);
            part(toe, "kuku-kaki", toeNailMesh, [0, 0, 0.075], [Math.PI / 2, 0, 0]);   // ujung kuku menghadap +z
        }
    });

    /* ----- EKOR: pivot "pangkal-ekor" di TAIL_P0 (di dalam badan) ----- */
    var tailBase = part(loopy, "pangkal-ekor", null, TAIL_P0.slice());
    part(tailBase, "ekor", tailMesh, [-TAIL_P0[0], -TAIL_P0[1], -TAIL_P0[2]]);

    window.loopy = loopy;

    /* ================= SKALA TINGGI KARAKTER =================
       Target Loopy = 4.17 unit (27 cm; 1 cm = 0.1545 unit, diukur dari Eddy 5.25 unit = 34 cm).
       Tinggi model asli (puncak kepala -> dasar telapak, jambul tidak dihitung):
         atas  = HEAD_Y + ryUp = 1.239 + 1.67 = 2.909
         bawah = BODY_Y + kaki - tebal telapak = -1.00 - 1.34 - 0.13 = -2.47
       Seluruh karakter diskalakan seragam 4.17 / 5.379 (~0.775), lalu diangkat supaya dasar telapak tepat di y = 0. */
    var MODEL_TOP = 2.909, MODEL_BOTTOM = -2.47;
    var CHAR_SCALE = 4.17 / (MODEL_TOP - MODEL_BOTTOM);
    // Node "LoopyRoot": M = T * S  ->  diskalakan dulu, lalu diangkat (dasar telapak -2.47 * skala -> y = 0)
    var root = new Node("LoopyRoot", [0, -MODEL_BOTTOM * CHAR_SCALE, 0], [0, 0, 0], [CHAR_SCALE, CHAR_SCALE, CHAR_SCALE]);
    // Node "lari" (runner) = penggerak seluruh badan Loopy di lantai: TRANSLASI (x,z) + ROTASI arah hadap (sumbu Y).
    // Dipisah dari root agar posisi/skala root yang diatur main.js tidak terganggu.
    var runner = new Node("lari", [0, 0, 0], [0, 0, 0]);
    root.add(runner);
    runner.add(loopy);

    /* ----- KUPU-KUPU (anak ROOT, bukan anak kepala): badan + 2 pasang sayap + 2 antena -----
       Dijadikan anak root supaya terbang sendiri di ruang dunia dan TIDAK ikut bergerak saat Loopy berlari
       (kalau jadi anak kepala, kupu-kupu akan ikut terbawa dan Loopy tidak pernah 'mengejar' apa pun).
       Sumbu lokal: badan memanjang di +z (depan), sayap terbentang di sumbu x, kepakan = rotasi z di pivot sayap.
       Posisi & orientasi (termasuk ARBITRARY AXIS) diatur di loopy-anim.js (koordinat frame root). Mulai tersembunyi (skala 0). */
    var BF_BODY = [0.25, 0.15, 0.10], BF_FORE = [1.00, 0.78, 0.25], BF_HIND = [1.00, 0.52, 0.20];
    var bfBodyMesh = makeMesh(B.generateEllipsoid(0.035, 0.035, 0.17, BF_BODY, 16, 12));
    var bfForeMesh = makeMesh(B.generateEllipsoid(0.30, 0.012, 0.21, BF_FORE, 28, 16));
    var bfHindMesh = makeMesh(B.generateEllipsoid(0.20, 0.012, 0.15, BF_HIND, 24, 14));
    var bfAntMesh  = makeMesh(B.generateCone(0.008, 0.14, BF_BODY, 8));
    var butterfly = part(root, "kupu-kupu", bfBodyMesh, [0, 0, 0]);
    butterfly.scale = [0, 0, 0];
    var bfWings = [-1, 1].map(function (side) {
        var w = part(butterfly, side < 0 ? "sayap-kiri" : "sayap-kanan", null, [side * 0.03, 0, 0.03]);
        part(w, "sayap-depan",    bfForeMesh, [side * 0.28, 0, 0.05]);
        part(w, "sayap-belakang", bfHindMesh, [side * 0.19, 0, -0.14]);
        part(butterfly, "antena", bfAntMesh, [side * 0.02, 0.0, 0.15], [Math.PI / 2 - 0.25, 0, -side * 0.35]);
        return w;
    });

    /* ================= ANIMASI =================
       Karena hierarki, anak ikut bergerak:
         - badan naik-turun (napas) -> semua ikut
         - kepala menengok & miring -> telinga, mata, hidung, mulut, gigi, jambul ikut
         - telinga & jambul bergoyang, mata berkedip tiap 3.2 dtk
         - tangan kanan MELAMBAI tiap 6 dtk (+ wink mata kanan), tangan kiri mengayun pelan
         - ekor menggeleng dari pangkalnya, kaki bergantian terangkat sedikit
       SPASI = jeda / lanjut (diatur di main.js). */
    var A = {
        root: root, runner: runner, badan: loopy, kepala: head, jambul: tuft, ekor: tailBase,
        earL: loopy.find("telinga-kiri"), earR: loopy.find("telinga-kanan"),
        eyeL: loopy.find("mata-kiri"), eyeR: loopy.find("mata-kanan"), winkR: loopy.find("mata-wink"), winkL: loopy.find("mata-wink-kiri"),
        mulut: mouth, hidung: loopy.find("hidung"), kupu: butterfly, sayapL: bfWings[0], sayapR: bfWings[1],
        bahuL: loopy.find("bahu-kiri"), bahuR: loopy.find("bahu-kanan"),
        kakiL: loopy.find("kaki-kiri"), kakiR: loopy.find("kaki-kanan")
    };
    // Logika animasi ada di loopy-anim.js; di sini hanya dirangkai dengan node & mesh Loopy.
    var updateAnimation = createLoopyAnimation({
        A: A, BODY_Y: BODY_Y, HEAD_Y: HEAD_Y, LEG_Y: -1.34, eyeMesh: eyeMesh, winkMesh: winkMesh,
        nose: [0, 0.34, 1.46]      // titik pusat kupu-kupu bertengger di atas hidung (koordinat kepala)
        // opsional: windows: [[20, 35], [45, 60]] (detik, giliran Loopy & showcase), loop: 60,
        //           runRx / runRz: jangkauan lintasan lari (unit model) kiri-kanan / depan-belakang
    });

    root.printTree();

    /* ================= RENDER ================= */
    var STRIDE = 4 * 9;   // pos(3) + color(3) + normal(3)

    function render(mesh, worldMatrix) {
        GL.uniformMatrix4fv(_M, false, worldMatrix);
        GL.bindBuffer(GL.ARRAY_BUFFER, mesh.vb);
        GL.vertexAttribPointer(_pos, 3, GL.FLOAT, false, STRIDE, 0);
        GL.vertexAttribPointer(_col, 3, GL.FLOAT, false, STRIDE, 12);
        GL.vertexAttribPointer(_nor, 3, GL.FLOAT, false, STRIDE, 24);
        GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, mesh.fb);
        GL.drawElements(GL.TRIANGLES, mesh.n, GL.UNSIGNED_SHORT, 0);
    }

    return {
        name: "Loopy",
        root: root,
        update: updateAnimation,
        draw: function (scene) {
            GL.useProgram(PROG);
            GL.uniformMatrix4fv(_P, false, scene.P);
            GL.uniformMatrix4fv(_V, false, scene.V);
            GL.uniform3f(_cam, scene.camPos[0], scene.camPos[1], scene.camPos[2]);
            root.draw(scene.M, render);
        }
    };
}