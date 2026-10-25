import { LIBS } from "./helpers/libs.js";
import { Node } from "./helpers/node.js";
import { EDDY_BUILDERS as B } from "./helpers/builders.js";

// =====================================================================
//  EDDY — si rubah oranye
//
//  createEddy(GL) membuat shader, mesh & hierarki Eddy di context WebGL
//  yang sama dengan scene, lalu mengembalikan:
//     root          : node akar (telapak kaki Eddy di y = 0)
//     update(t)     : animasi (Eddy belum punya animasi -> kosong)
//     draw(scene)   : gambar Eddy. scene = { P, V, M, camPos }
//                     M = matriks dunia tempat Eddy berdiri (dari main.js)
// =====================================================================
export function createEddy(GL) {
    /* ================= SHADER ================= */
    var vs = `
        attribute vec3 position, color, normal;
        uniform mat4 Pmatrix, Vmatrix, Mmatrix;
        varying vec3 vColor, vNormal;
        varying float vDist;
        void main(void) {
            gl_Position = Pmatrix * Vmatrix * Mmatrix * vec4(position, 1.);
            vNormal = (Vmatrix * Mmatrix * vec4(normal, 0.)).xyz;
            vColor = color;
            vDist = length((Vmatrix * Mmatrix * vec4(position, 1.)).xyz);   // jarak ke kamera, untuk kabut
        }`;
    var fs = `
        precision mediump float;
        varying vec3 vColor, vNormal;
        varying float vDist;
        void main(void) {
            vec3 N = normalize(vNormal);
            if (!gl_FrontFacing) N = -N;
            vec3 L = normalize(vec3(0.45, 0.7, 0.8));
            float diff = max(dot(N, L), 0.);
            vec3 H = normalize(L + vec3(0., 0., 1.));
            float spec = pow(max(dot(N, H), 0.), 40.) * 0.18;
            float rim = pow(1. - max(N.z, 0.), 3.) * 0.12;
            float hemi = 0.5 + 0.5 * N.y;
            vec3 amb = mix(vec3(0.42, 0.38, 0.34), vec3(0.62, 0.66, 0.72), hemi) * 0.75;
            vec3 col = vColor * (amb + 0.62 * diff) + vec3(spec + rim);
            float fog = smoothstep(150., 900., vDist);                       // makin jauh makin pudar ke warna langit
            gl_FragColor = vec4(mix(col, vec3(0.68, 0.84, 0.97), fog), 1.);
        }`;
    function compile(src, type) {
        var s = GL.createShader(type); GL.shaderSource(s, src); GL.compileShader(s);
        if (!GL.getShaderParameter(s, GL.COMPILE_STATUS)) alert(GL.getShaderInfoLog(s));
        return s;
    }
    var PROG = GL.createProgram();
    GL.attachShader(PROG, compile(vs, GL.VERTEX_SHADER));
    GL.attachShader(PROG, compile(fs, GL.FRAGMENT_SHADER));
    GL.bindAttribLocation(PROG, 0, "position"); GL.bindAttribLocation(PROG, 1, "color"); GL.bindAttribLocation(PROG, 2, "normal");
    GL.linkProgram(PROG);
    var _pos = GL.getAttribLocation(PROG, "position"), _col = GL.getAttribLocation(PROG, "color"),
        _nor = GL.getAttribLocation(PROG, "normal");
    GL.enableVertexAttribArray(_pos); GL.enableVertexAttribArray(_col); GL.enableVertexAttribArray(_nor);
    var _P = GL.getUniformLocation(PROG, "Pmatrix"), _V = GL.getUniformLocation(PROG, "Vmatrix"),
        _M = GL.getUniformLocation(PROG, "Mmatrix");
    GL.useProgram(PROG);

    /* ================= PALET ================= */
    var ORANGE = [0.93, 0.58, 0.14];
    var WHITE = [0.97, 0.96, 0.93], BLACK = [0.07, 0.06, 0.06];
    var rad = LIBS.degToRad;

    /* ================= HELPER ================= */
    function makeMesh(geo) {
        var vb = GL.createBuffer(); GL.bindBuffer(GL.ARRAY_BUFFER, vb);
        GL.bufferData(GL.ARRAY_BUFFER, new Float32Array(geo.vertices), GL.STATIC_DRAW);
        var fb = GL.createBuffer(); GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, fb);
        GL.bufferData(GL.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.faces), GL.STATIC_DRAW);
        return { vb: vb, fb: fb, n: geo.faces.length };
    }
    function part(parent, name, geo, pos, rot) {
        var node = new Node(name, pos, rot);
        if (geo) node.mesh = makeMesh(geo);
        return parent.add(node);
    }
    function surfZ(r, x, y, off) {
        var q = 1 - Math.pow(x / r[0], 2) - Math.pow(y / r[1], 2);
        return r[2] * Math.sqrt(Math.max(q, 0)) + off;
    }
    var thin = function (t) { return 0.02 * Math.pow(Math.sin(Math.PI * t), 0.5) + 0.003; };
    var blk = function () { return BLACK; };

    /* ================= HIERARKI EDDY ================= */
    // Resolusi mesh dinaikkan (stack/step lebih rapat) supaya siluet & pantulan cahaya Eddy mulus, tidak bersegi.
    /* PROPORSI (mengikuti referensi, tinggi total ~5 unit, telapak tetap menapak tanah di y = -2.57):
         kepala + telinga ~ 60% tinggi  |  badan ~ 26% (kecil & mungil)  |  kaki + telapak ~ 14% (pendek)
         lebar kepala ~ 2x lebar badan -> Eddy terlihat pendek & imut (chibi). */
    var eddy = new Node("Eddy", [0, -0.9, 0]);

    // Badan: kecil, BUKAN oval sempurna (mengikuti sketsa referensi): bawah bulat penuh, sisi hampir lurus,
    // dan tetap LEBAR ke arah leher (sedikit melebar menyambut kepala), tanpa leher.
    var BA = 0.60, BB = 0.72, BC = 0.52;
    var bsmooth = function (e0, e1, x) { var k = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return k * k * (3 - 2 * k); };
    // Perut putih: mengikuti aturan yang sama (bawah membulat, atas lebih lebar ke arah dada), menempel rata di badan
    var BELLY_CY = -0.04, BELLY_H = 0.50, BELLY_W = 0.40;
    var bellyMask = function (x, y) {
        var yn = (y - BELLY_CY) / BELLY_H;
        if (yn <= -1 || yn >= 1) return 0;
        var half = BELLY_W * Math.pow(1 - yn * yn, 0.5 - 0.14 * bsmooth(0, 0.7, yn)) * (1 + 0.06 * yn);
        return bsmooth(1.0, 0.90, Math.abs(x) / half);
    };
    var body = part(eddy, "Body", B.generateEddyBody(BA, BB, BC, 192, 192,
        function (x, y, z) {
            var k = z > 0 ? bellyMask(x, y) : 0;
            return [ORANGE[0] + (WHITE[0] - ORANGE[0]) * k, ORANGE[1] + (WHITE[1] - ORANGE[1]) * k,
                    ORANGE[2] + (WHITE[2] - ORANGE[2]) * k];
        },
        function (x, y) {   // perut sedikit membusung ke depan (lembut, menyatu)
            return 0.05 * Math.exp(-Math.pow(x / 0.32, 2) - Math.pow((y + 0.10) / 0.42, 2));
        }), [0, -0.23, 0]);

    /* ----- KEPALA & ORNAMEN WAJAH (Segitiga lembut / bakpao: sempit di atas, lebar di pipi bawah) ----- */
    // K = skala seluruh kepala (wajah & telinga ikut). Kepala dibuat lebih besar & jauh lebih lebar dari badan.
    var K = 1.15;
    var HA = 1.04 * K, HB = 0.78 * K, HC = 0.76 * K;   // lebar > tinggi, tidak terlalu dalam (depan-belakang)
    var head = part(body, "Head", B.generateHead(HA, HB, HC, 96, 96, ORANGE), [0, 1.47, 0]);

    /* ----- WAJAH NETRAL (mengikuti referensi) -----
       - Moncong putih lebih SEMPIT & lebih RENDAH: dari bawah mata sampai dagu (bukan oval lebar di tengah wajah).
       - Di bawah hidung ada 2 bantalan bibir tembam yang membentuk lekuk "w" (tanpa garis hitam).
       - Mulut sedikit terbuka (merah gelap) di antara bantalan bibir & dagu putih kecil.
       - Hidung hitam BESAR (~separuh lebar moncong) di puncak moncong.
       - Mata: titik hitam oval kecil, berjarak lebar, sedikit di atas moncong. */
    var INK = [0.07, 0.07, 0.08];
    var MY = -0.40 * K;                                   // pusat moncong (lebih rendah)
    var MR = [0.40 * K, 0.34 * K, 0.30 * K];              // lebih sempit dari sebelumnya (0.48)
    // Moncong = SATU permukaan: bantalan bibir, dagu & lekuk mulut dipahat langsung (menyatu mulus, tanpa "bola" terpisah)
    var gauss = function (x, y, cx, cy, rx, ry) { return Math.exp(-Math.pow((x - cx) / rx, 2) - Math.pow((y - cy) / ry, 2)); };
    var mouthY = function (x) { return -0.205 * K + 0.022 * K * Math.cos(Math.PI * x / (0.12 * K)); };   // garis "w"
    var muzzleOffset = function (x, y) {
        var d = 0;
        d += 0.080 * K * gauss(x, y, -0.12 * K, -0.11 * K, 0.15 * K, 0.115 * K);   // bantalan bibir kiri
        d += 0.080 * K * gauss(x, y,  0.12 * K, -0.11 * K, 0.15 * K, 0.115 * K);   // bantalan bibir kanan
        d += 0.020 * K * gauss(x, y, 0, -0.27 * K, 0.16 * K, 0.07 * K);           // dagu kecil
        // lekuk dangkal tempat garis mulut berada (memudar di kedua ujung)
        var win = Math.max(0, 1 - Math.pow(x / (0.26 * K), 4));
        d -= 0.024 * K * win * Math.exp(-Math.pow((y - mouthY(x)) / (0.020 * K), 2));
        return d;
    };
    var muzzle = part(head, "Muzzle", B.generateMuzzle(MR[0], MR[1], MR[2], muzzleOffset, 128, 128, WHITE),
        [0, MY, B.headSurfaceZ(HA, HB, HC, 0, MY) - 0.13 * K]);
    var faceZ = function (x, y) { return B.muzzleSurfaceZ(MR[0], MR[1], MR[2], muzzleOffset, x, y) + 0.005; };

    // MULUT TERTUTUP (netral): garis tipis coklat gelap di dasar lekuk "w"
    var LINE = [0.16, 0.09, 0.07];                                          // coklat gelap (lebih natural dari hitam pekat)
    var lineR = function (t) { return 0.010 * K * Math.pow(Math.sin(Math.PI * t), 0.35) + 0.002; };   // ujung meruncing
    var lineC = function () { return LINE; };
    var mouthPts = [];
    for (var i = 0; i <= 24; i++) {
        var mx = (-0.22 + 0.44 * i / 24) * K, my = mouthY(mx);
        mouthPts.push([mx, my, faceZ(mx, my)]);
    }
    part(muzzle, "Mouth", B.generateTube(mouthPts, 64, 3, 10, lineR, lineC));

    // Philtrum: garis pendek & samar dari bawah hidung ke tengah "w"
    var phPts = [];
    for (var i = 0; i <= 6; i++) {
        var py = (-0.07 - 0.11 * i / 6) * K;
        phPts.push([0, py, faceZ(0, py)]);
    }
    part(muzzle, "Philtrum", B.generateTube(phPts, 16, 2, 8,
        function (t) { return 0.007 * K * Math.pow(Math.sin(Math.PI * t), 0.4) + 0.0015; }, lineC));

    // Hidung: hitam, besar & lebar, di puncak moncong, sedikit menonjol ke depan
    part(muzzle, "Nose", B.generateEllipsoid(0.23 * K, 0.14 * K, 0.15 * K, 48, 48, INK),
        [0, 0.08 * K, surfZ(MR, 0, 0.08 * K, -0.05 * K)], [rad(-12), 0, 0]);

    [-1, 1].forEach(function (side) {
        var tag = side < 0 ? "L" : "R";

        // Mata NETRAL: titik hitam oval kecil (sedikit lebih tinggi dari lebarnya), menghadap normal permukaan kepala
        var ex = side * 0.50 * K, ey = -0.02 * K, ez = B.headSurfaceZ(HA, HB, HC, ex, ey);
        var nx = ex / (HA * HA), ny = ey / (HB * HB), nz = ez / (HC * HC);
        part(head, "Eye" + tag, B.generateEllipsoid(0.075 * K, 0.098 * K, 0.035 * K, 32, 32, INK),
            [ex, ey, ez - 0.012 * K], [-Math.atan2(ny, Math.hypot(nx, nz)), Math.atan2(nx, nz), 0]);

        // TELINGA: lebar & membulat (tidak lancip), tegak ke atas (hanya sedikit condong ke luar) seperti referensi.
        // Tumbuh dari sudut atas kepala; tepi luarnya menyambung garis pipi -> siluet kepala+telinga seperti rubah.
        // Pangkal telinga diperpanjang masuk ke kepala & bagian yang keluar dari kepala ditekuk halus ke permukaan kepala,
        // sehingga dari samping telinga terlihat TUMBUH dari kepala (tidak ada bibir/tepi telinga yang menggantung).
        var earPos = [side * 0.40 * K, 0.22 * K, -0.10 * K], earRot = [rad(-4), side * rad(8), -side * rad(15)];
        var EM = LIBS.compose(earPos, earRot);
        var toHead = function (p) {
            return [EM[0] * p[0] + EM[4] * p[1] + EM[8] * p[2] + EM[12],
                    EM[1] * p[0] + EM[5] * p[1] + EM[9] * p[2] + EM[13],
                    EM[2] * p[0] + EM[6] * p[1] + EM[10] * p[2] + EM[14]];
        };
        var toEar = function (q) {   // invers transformasi kaku: R^T (q - t)
            var d = [q[0] - EM[12], q[1] - EM[13], q[2] - EM[14]];
            return [EM[0] * d[0] + EM[1] * d[1] + EM[2] * d[2],
                    EM[4] * d[0] + EM[5] * d[1] + EM[6] * d[2],
                    EM[8] * d[0] + EM[9] * d[1] + EM[10] * d[2]];
        };
        var insideHead = function (q) { return Math.abs(q[2]) < B.headSurfaceZ(HA, HB, HC, q[0], q[1]) - 0.01; };
        var earConform = function (p, u) {
            if (u > 0.15) return p;
            var q = toHead(p);
            if (insideHead(q)) return p;
            var lo = 0, hi = 1;                                   // cari titik permukaan kepala di garis pusat -> q
            for (var it = 0; it < 18; it++) {
                var mid = (lo + hi) / 2;
                if (insideHead([q[0] * mid, q[1] * mid, q[2] * mid])) lo = mid; else hi = mid;
            }
            var wgt = u <= 0 ? 1 : 1 - (u / 0.15) * (u / 0.15) * (3 - 2 * u / 0.15);
            var t = 1 + (lo * 0.985 - 1) * wgt;                    // makin ke pangkal makin menempel ke kepala
            return toEar([q[0] * t, q[1] * t, q[2] * t]);
        };
        var ear = part(head, "Ear" + tag, null, earPos, earRot);
        part(ear, "EarShell" + tag, B.generateEarShell(0.72 * K, 0.21 * K, 1.70 * K, -0.35, 96, 96, ORANGE, earConform));

        // Bagian Dalam Telinga (Putih): lebih kecil supaya tepi oranye yang tebal terlihat di sekelilingnya
        part(ear, "EarInner" + tag, B.generateEllipticParaboloid(0.49 * K, 0.145 * K, 1.30 * K, 56, 56, WHITE, true),
            [0, 0.20 * K, 0.075 * K]);
    });

    /* ----- LENGAN & KAKI ----- */
    var smooth = function (e0, e1, x) { var k = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return k * k * (3 - 2 * k); };
    [-1, 1].forEach(function (side) {
        var tag = side < 0 ? "L" : "R";

        // Lengan = SATU permukaan kapsul halus dari dalam badan sampai pergelangan (tanpa sambungan/tepi tajam).
        // Lengan SEHAT & BERISI (tidak kurus, tidak tembam): ~0.15 di lengan atas, meramping halus ke ~0.11 di pergelangan.
        // Bahu berada di puncak badan (tepat di bawah kepala) seperti referensi. Pangkal lengan dimulai DI DALAM badan
        // dan MELEBAR (flare) di titik keluarnya -> lengan tumbuh dari badan dengan lereng bahu yang landai & halus,
        // bukan tongkat yang ditancapkan.
        // Lengan atas MENEMPEL mengikuti garis sisi badan mulai dari leher (garis luar bahu = lanjutan siluet badan),
        // baru lengan bawah sedikit menjauh dari badan. Node Arm tidak diputar: arah lengan diatur lewat titik kontrol.
        var arm = part(body, "Arm" + tag, null, [side * 0.40, 0.45, 0.0]);
        part(arm, "ArmMesh" + tag, B.generateLimb(
            [[-side * 0.14, 0.06, -0.02], [side * 0.06, -0.02, 0.0], [side * 0.18, -0.20, 0.01],
             [side * 0.26, -0.42, 0.03], [side * 0.33, -0.63, 0.04]],
            64, 3, 40, 12,
            function (t) {
                return 0.150 + 0.050 * (1 - smooth(0.0, 0.30, t))   // pangkal bahu sedikit melebar (di dalam badan)
                             - 0.040 * smooth(0.35, 0.95, t);        // lengan atas berisi -> pergelangan
            }, ORANGE));

        /* ---------- TANGAN: kecil & tembam, 4 jari (3 jari + ibu jari), lingkaran putih di telapak ---------- */
        // Node "Hand" = pivot pergelangan (bisa dianimasikan sendiri). Sumbu lokal tangan:
        //   -y = arah jari, z = lebar telapak (ibu jari di +z / depan), telapak menghadap ke arah badan (inw).
        // Telapak (dan lingkaran putihnya) menghadap ke SISI BADAN, bukan ke depan/luar.
        var inw = -side;
        var hand = part(arm, "Hand" + tag, null, [side * 0.34, -0.65, 0.04], [0, 0, side * rad(15)]);

        // HS = skala tangan (ubah satu angka ini untuk memperbesar/memperkecil seluruh tangan)
        var HS = 1.3;   // tangan mitten sedikit lebih besar dari pergelangan (seperti referensi)

        // Telapak: ellipsoid pipih & tembam. Lingkaran putih = warna per-vertex di sisi telapak (menempel rata).
        part(hand, "Palm" + tag, B.generateEllipsoidColored(0.095 * HS, 0.13 * HS, 0.135 * HS, 72, 72, function (xn, yn, zn) {
            var d = Math.hypot((yn + 0.08) / 0.52, zn / 0.52);              // jarak dari pusat lingkaran
            var k = smooth(0.2, 0.4, xn * inw) * smooth(1.0, 0.86, d);          // hanya di sisi telapak
            return [ORANGE[0] + (WHITE[0] - ORANGE[0]) * k, ORANGE[1] + (WHITE[1] - ORANGE[1]) * k,
                    ORANGE[2] + (WHITE[2] - ORANGE[2]) * k];
        }), [0, -0.10 * HS, 0]);

        // 3 jari pendek & gemuk di ujung telapak, sedikit mengembang (fan) & menekuk ke arah telapak.
        // Jari tengah paling panjang.
        [[-0.078, 0.88, 0.052], [0.0, 1.0, 0.056], [0.078, 0.90, 0.053]].forEach(function (fd, i) {
            var z = fd[0] * HS, L = fd[1], r = fd[2] * HS;
            part(hand, "Finger" + tag + i, B.generateLimb(
                [[0, -0.15 * HS, z * 0.95], [inw * 0.01 * HS, (-0.15 - 0.06 * L) * HS, z * 1.12],
                 [inw * 0.032 * HS, (-0.15 - 0.105 * L) * HS, z * 1.28]],
                20, 2, 28, 10,
                function (t) { return r * (1 - 0.12 * t); }, ORANGE));
        });

        // Ibu jari: keluar dari sisi depan telapak, mengarah ke depan-bawah dan sedikit ke arah telapak
        part(hand, "Thumb" + tag, B.generateLimb(
            [[inw * 0.01 * HS, -0.06 * HS, 0.10 * HS], [inw * 0.03 * HS, -0.10 * HS, 0.155 * HS],
             [inw * 0.05 * HS, -0.145 * HS, 0.175 * HS]],
            20, 2, 28, 10,
            function (t) { return 0.056 * HS * (1 - 0.12 * t); }, ORANGE));

        // Kaki (pivot pinggul)
        // KAKI + TELAPAK = SATU permukaan (loft): betis bulat pendek mengembang halus ke depan menjadi telapak paw,
        // tanpa sambungan/pergelangan yang terpisah. Jari putih membulat di depan, tumit oranye, alas rata di tanah.
        var leg = part(body, "Leg" + tag, null, [side * 0.31, -0.40, 0]);
        part(leg, "LegPaw" + tag, B.generateLegPaw({
            top: 0.05, bottom: -1.04,            // alas tetap di y = -2.57 (tanah)
            legR: 0.18, legR2: 0.205,            // betis gempal, membesar ke bawah menyambut telapak
            pawH: 0.30, pawMid: 0.40, sole: 0.86, // tinggi telapak, ketinggian bagian terlebar, & lebar alas (relatif)
            pawRx: 0.24, pawRz: 0.33, pawCz: 0.13,// lebar, panjang & seberapa jauh telapak maju ke depan
            edge: 0.05, blend: 2.6,                 // kelengkungan tepi alas & kehalusan pertemuan kaki-telapak
            toes: 3, spread: 0.70 * Math.PI,      // 3 jari di busur depan
            toeAmp: 0.17, toeMid: 0.60, toeHalf: 0.48,   // seberapa bulat menonjol jari & di ketinggian mana
            whiteFront: 0.55, whiteArch: 0.20     // batas tudung putih di ujung depan (0 = tengah, 1 = ujung) & gelombang per jari
        }, 200, 160, function (toe, pad) {
            var k = Math.max(toe, pad);
            return [ORANGE[0] + (WHITE[0] - ORANGE[0]) * k, ORANGE[1] + (WHITE[1] - ORANGE[1]) * k,
                    ORANGE[2] + (WHITE[2] - ORANGE[2]) * k];
        }));
    });


    /* ----- EKOR ----- */
    var tailCP = [[0, -0.60, -0.30], [0, -0.85, -0.95], [0.05, -0.60, -1.50], [0.18, -0.05, -1.85], [0.28, 0.50, -1.78]];
    part(body, "Tail", B.generateTube(tailCP, 96, 3, 48,
        function (t) {
            var r = 0.17 + 0.36 * Math.sin(Math.PI * Math.pow(t, 0.8));
            if (t > 0.9) r *= Math.sqrt(Math.max(1 - Math.pow((t - 0.9) / 0.1, 2), 0));
            return r;
        },
        function (t) {
            var k = smooth(0.62, 0.74, t);   // gradasi oranye -> putih yang lembut di ujung ekor
            return [ORANGE[0] + (WHITE[0] - ORANGE[0]) * k, ORANGE[1] + (WHITE[1] - ORANGE[1]) * k,
                    ORANGE[2] + (WHITE[2] - ORANGE[2]) * k];
        }));

    // Model Eddy aslinya berdiri dengan telapak di y = -2.57.
    // Node "EddyRoot" mengangkatnya 2.57 supaya telapak tepat di y = 0 (main.js yang menaruhnya di tanah).
    var root = new Node("EddyRoot", [0, 2.57, 0]);
    root.add(eddy);

    eddy.printTree();
    window.eddy = eddy;

    /* ================= RENDER ================= */
    var STRIDE = 4 * 9;
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
        name: "Eddy",
        root: root,
        update: function (t) { },
        draw: function (scene) {
            GL.useProgram(PROG);
            GL.uniformMatrix4fv(_P, false, scene.P);
            GL.uniformMatrix4fv(_V, false, scene.V);
            root.draw(scene.M, render);
        }
    };
}
