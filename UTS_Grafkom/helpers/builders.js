// =====================================================================
//  builders.js — geometry generators for Eddy, Poby and Loopy
//
//  Every generator returns { vertices, faces } with 9 numbers per vertex
//  (x, y, z, r, g, b, nx, ny, nz).
//
//  The same names exist in more than one character with DIFFERENT
//  parameters (e.g. generateEllipsoid), so each character's builders are
//  grouped under their own name:
//
//    import { EDDY_BUILDERS as B }  from "./helpers/builders.js";
//    import { POBY_BUILDERS as B }  from "./helpers/builders.js";
//    import { LOOPY_BUILDERS as B } from "./helpers/builders.js";
//
//  Each character file keeps its measurements + hierarchy; the shapes are
//  made here (e.g. Eddy: generateHead / generateLegPaw, Poby: pobyBody /
//  pobyHead / pobyArm / pobyPaw, plus the bubble-wand props).
//  The old snow environment (environment_snow.js) uses EDDY_BUILDERS.
// =====================================================================

// #####################################################################
//  EDDY_BUILDERS
// #####################################################################
export const EDDY_BUILDERS = (function () {
    // ============ UTIL: hitung normal halus + interleave (pos, color, normal) ============
    function finish(v6, faces) {
        var n = v6.length / 6, acc = {}, keys = new Array(n);
        for (var i = 0; i < n; i++) {
            keys[i] = Math.round(v6[i*6]*1000) + "," + Math.round(v6[i*6+1]*1000) + "," + Math.round(v6[i*6+2]*1000);
            if (!acc[keys[i]]) acc[keys[i]] = [0, 0, 0];
        }
        for (var f = 0; f < faces.length; f += 3) {
            var a = faces[f], b = faces[f+1], c = faces[f+2];
            var ux = v6[b*6]-v6[a*6], uy = v6[b*6+1]-v6[a*6+1], uz = v6[b*6+2]-v6[a*6+2];
            var wx = v6[c*6]-v6[a*6], wy = v6[c*6+1]-v6[a*6+1], wz = v6[c*6+2]-v6[a*6+2];
            var nx = uy*wz-uz*wy, ny = uz*wx-ux*wz, nz = ux*wy-uy*wx;
            [a, b, c].forEach(function (id) { var s = acc[keys[id]]; s[0]+=nx; s[1]+=ny; s[2]+=nz; });
        }
        var out = [];
        for (var i = 0; i < n; i++) {
            var s = acc[keys[i]], l = Math.hypot(s[0], s[1], s[2]) || 1;
            out.push(v6[i*6], v6[i*6+1], v6[i*6+2], v6[i*6+3], v6[i*6+4], v6[i*6+5], s[0]/l, s[1]/l, s[2]/l);
        }
        return { vertices: out, faces: faces };
    }

    function grid(stack, step, faces) {
        for (var i = 0; i < stack; i++)
            for (var j = 0; j < step; j++) {
                var p = i * (step + 1) + j, q = p + step + 1;
                faces.push(p, p + 1, q + 1, p, q + 1, q);
            }
    }

    // ============ 1. ELLIPSOID ============
    function generateEllipsoid(a, b, c, stack, step, color) {
        var v = [], f = [];
        for (var i = 0; i <= stack; i++) {
            var u = (i / stack) * Math.PI - Math.PI / 2;
            for (var j = 0; j <= step; j++) {
                var w = (j / step) * 2 * Math.PI;
                v.push(a*Math.cos(w)*Math.cos(u), b*Math.sin(u), c*Math.sin(w)*Math.cos(u), color[0], color[1], color[2]);
            }
        }
        grid(stack, step, f);
        return finish(v, f);
    }

    // ============ 2. ELLIPTIC PARABOLOID  (x^2/a^2 + z^2/b^2 = y/h) ============
    // a,b = jari-jari alas; puncak di y=height (flip=true) atau di y=0 (flip=false)
    function generateEllipticParaboloid(a, b, height, stack, step, color, flip) {
        var v = [], f = [];
        for (var i = 0; i <= stack; i++) {
            var u = i / stack;
            var r = Math.sqrt(flip ? 1 - u : u);
            for (var j = 0; j <= step; j++) {
                var w = (j / step) * 2 * Math.PI;
                v.push(a*r*Math.cos(w), height*u, b*r*Math.sin(w), color[0], color[1], color[2]);
            }
        }
        grid(stack, step, f);
        return finish(v, f);
    }

    // ============ 3. HYPERBOLOID 2 SHEET  (y^2/b^2 - x^2/a^2 - z^2/c^2 = 1) ============
    // Satu lembar (u>=1). Puncak di y=0, melebar ke bawah (flip=true) atau ke atas.
    function generateHyperboloid2Sheet(a, b, c, H, stack, step, color, flip) {
        var v = [], f = [];
        for (var i = 0; i <= stack; i++) {
            var u = 1 + (i / stack) * H, s = Math.sqrt(u*u - 1);
            for (var j = 0; j <= step; j++) {
                var w = (j / step) * 2 * Math.PI;
                var y = b * (u - 1) * (flip ? -1 : 1);
                v.push(a*s*Math.cos(w), y, c*s*Math.sin(w), color[0], color[1], color[2]);
            }
        }
        grid(stack, step, f);
        return finish(v, f);
    }

    // ============ 4. CYLINDER (bisa meruncing) ============
    function generateCylinder(rBottom, rTop, height, sectors, color) {
        var v = [], f = [];
        for (var i = 0; i <= sectors; i++) {
            var w = 2 * Math.PI * i / sectors, cs = Math.cos(w), sn = Math.sin(w);
            v.push(rBottom*cs, -height/2, rBottom*sn, color[0], color[1], color[2]);
            v.push(rTop*cs,     height/2, rTop*sn,    color[0], color[1], color[2]);
        }
        for (var i = 0; i < sectors; i++) {
            var b0 = 2*i, t0 = 2*i+1, b1 = 2*i+2, t1 = 2*i+3;
            f.push(b0, b1, t0, t0, b1, t1);
        }
        return finish(v, f);
    }

    // ============ 5. B-SPLINE 3D (clamped, Cox-de Boor) ============
    function generateBSpline3D(cp, m, degree) {
        var n = cp.length, K = [];
        for (var i = 0; i < n + degree + 1; i++)
            K.push(i < degree + 1 ? 0 : (i >= n ? n - degree : i - degree));
        function N(i, j, t) {
            if (j === 0) {
                var a = K[i], b = K[i+1];
                if (a === b) return 0;
                if (t >= a && t < b) return 1;
                return (t === K[n] && b === K[n]) ? 1 : 0;
            }
            var d1 = K[i+j] - K[i], d2 = K[i+j+1] - K[i+1], r = 0;
            if (d1 > 0) r += (t - K[i]) / d1 * N(i, j-1, t);
            if (d2 > 0) r += (K[i+j+1] - t) / d2 * N(i+1, j-1, t);
            return r;
        }
        var pts = [];
        for (var s = 0; s < m; s++) {
            var u = K[degree] + (s / (m - 1)) * (K[n] - K[degree]), p = [0, 0, 0];
            for (var k = 0; k < n; k++) {
                var w = N(k, degree, u);
                p[0] += cp[k][0]*w; p[1] += cp[k][1]*w; p[2] += cp[k][2]*w;
            }
            pts.push(p);
        }
        return pts;
    }

    // ============ 6. SWEEP LINGKARAN SEPANJANG B-SPLINE (ekor, mata, mulut) ============
    // radiusFn(t) & colorFn(t), t = 0..1 sepanjang kurva
    function generateTube(cp, m, degree, slices, radiusFn, colorFn) {
        var P = generateBSpline3D(cp, m, degree), v = [], f = [], Nv = null;
        var norm = function (a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
        var cross = function (a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; };
        for (var i = 0; i < P.length; i++) {
            var p0 = P[Math.max(i-1, 0)], p1 = P[Math.min(i+1, P.length-1)];
            var T = norm([p1[0]-p0[0], p1[1]-p0[1], p1[2]-p0[2]]);
            if (!Nv) {
                var ax = [Math.abs(T[0]), Math.abs(T[1]), Math.abs(T[2])];
                var ref = ax[0] <= ax[1] && ax[0] <= ax[2] ? [1,0,0] : (ax[1] <= ax[2] ? [0,1,0] : [0,0,1]);
                Nv = ref;
            }
            var d = Nv[0]*T[0] + Nv[1]*T[1] + Nv[2]*T[2];
            Nv = norm([Nv[0]-T[0]*d, Nv[1]-T[1]*d, Nv[2]-T[2]*d]);   // parallel transport
            var B = cross(T, Nv), t = i / (P.length - 1), r = radiusFn(t), col = colorFn(t);
            for (var j = 0; j <= slices; j++) {
                var w = 2 * Math.PI * j / slices, c = Math.cos(w), s = Math.sin(w);
                v.push(P[i][0] + r*(c*Nv[0]+s*B[0]), P[i][1] + r*(c*Nv[1]+s*B[1]), P[i][2] + r*(c*Nv[2]+s*B[2]),
                       col[0], col[1], col[2]);
            }
        }
        grid(P.length - 1, slices, f);
        return finish(v, f);
    }
    // ============ 7. KEPALA EDDY: Permukaan mulus membulat (tanpa sudut tajam) ============
    var HEAD_PT = 1.0;   // Dahi/puncak kepala membulat halus (kubah)
    var HEAD_PB = 0.75;  // < 1 : rahang/dagu sedikit lebih rata (tidak terlalu tembam)

    // Lebar kepala per ketinggian (yn = -1 dagu ... 1 puncak): SEGITIGA LEMBUT ala rubah
    //   puncak lebih sempit (~0.80) -> melebar halus ke bawah -> paling lebar di pipi bawah (~1.08), pipi tidak tembam.
    function headWidth(yn) {
        return 1.0 - 0.12 * yn
                   + 0.04 * Math.exp(-Math.pow((yn + 0.4) / 0.5, 2))
                   - 0.08 * Math.pow(Math.max(yn, 0), 2);
    }

    function generateHead(a, b, c, stack, step, color) {
        var v = [], f = [];
        for (var i = 0; i <= stack; i++) {
            var u = (i / stack) * Math.PI - Math.PI / 2, s = Math.sin(u), cu = Math.cos(u);
            var yn = s >= 0 ? Math.pow(s, HEAD_PT) : -Math.pow(-s, HEAD_PB);
            var ws = headWidth(yn);
            for (var j = 0; j <= step; j++) {
                var w = (j / step) * 2 * Math.PI;
                v.push(a * ws * cu * Math.cos(w), b * yn, c * cu * Math.sin(w), color[0], color[1], color[2]);
            }
        }
        grid(stack, step, f);
        return finish(v, f);
    }

    // Menghitung koordinat Z permukaan depan kepala untuk penempelan mata
    function headSurfaceZ(a, b, c, x, y) {
        var yn = Math.max(-1, Math.min(1, y / b));
        var s = yn >= 0 ? Math.pow(yn, 1 / HEAD_PT) : -Math.pow(-yn, 1 / HEAD_PB);
        var cu = Math.sqrt(Math.max(1 - s * s, 0)), ws = headWidth(yn);
        var denom = a * ws * cu;
        if (denom <= 0.00001) return 0.0;
        var q = 1 - Math.pow(x / denom, 2);
        return c * cu * Math.sqrt(Math.max(q, 0));
    }
    // ============ 8. CONE / KERUCUT (quadric: elliptic cone) -> pohon cemara, gunung, hidung salju ============
    // Alas di y=0 (jari-jari rBottom), puncak di y=height. colorFn(t): t=0 alas ... t=1 puncak
    function generateCone(rBottom, height, sectors, stacks, colorFn) {
        var v = [], f = [];
        for (var i = 0; i <= stacks; i++) {
            var t = i / stacks, r = rBottom * (1 - t), col = colorFn(t);
            for (var j = 0; j <= sectors; j++) {
                var w = (j / sectors) * 2 * Math.PI;
                v.push(r * Math.cos(w), height * t, r * Math.sin(w), col[0], col[1], col[2]);
            }
        }
        grid(stacks, sectors, f);
        return finish(v, f);
    }
    // ============ 9. LIMB / KAPSUL HALUS (khusus Eddy: lengan menyatu tanpa sambungan) ============
    // Satu permukaan kontinu: tutup setengah bola di pangkal -> badan mengikuti kurva B-spline -> tutup setengah bola di ujung.
    // radiusFn(t), t = 0..1 sepanjang badan kurva. Tidak ada tepi terbuka, jadi tidak ada garis/sudut tajam.
    function generateLimb(cp, m, degree, slices, capRings, radiusFn, color) {
        var P = generateBSpline3D(cp, m, degree);
        var norm = function (a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; };
        var cross = function (a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; };
        var sub = function (a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; };

        // panjang busur kumulatif -> parameter t merata sepanjang kurva (ketebalan tidak "melompat")
        var S = [0];
        for (var i = 1; i < P.length; i++) S.push(S[i-1] + Math.hypot(P[i][0]-P[i-1][0], P[i][1]-P[i-1][1], P[i][2]-P[i-1][2]));
        var L = S[S.length - 1] || 1;
        var T = P.map(function (p, i) {
            return norm(sub(P[Math.min(i+1, P.length-1)], P[Math.max(i-1, 0)]));
        });

        // daftar cincin: {c: pusat, t: tangen, r: jari-jari}
        var rings = [];
        var r0 = radiusFn(0), r1 = radiusFn(1);
        for (var k = 0; k <= capRings; k++) {                     // tutup pangkal (dari kutub ke ekuator)
            var a = (k / capRings) * Math.PI / 2;
            var off = -Math.cos(a) * r0;
            rings.push({ c: [P[0][0] + T[0][0]*off, P[0][1] + T[0][1]*off, P[0][2] + T[0][2]*off], t: T[0], r: Math.sin(a) * r0 });
        }
        for (var i = 1; i < P.length - 1; i++) rings.push({ c: P[i], t: T[i], r: radiusFn(S[i] / L) });
        var e = P.length - 1;
        for (var k = capRings; k >= 0; k--) {                     // tutup ujung (dari ekuator ke kutub)
            var a = (k / capRings) * Math.PI / 2;
            var off = Math.cos(a) * r1;
            rings.push({ c: [P[e][0] + T[e][0]*off, P[e][1] + T[e][1]*off, P[e][2] + T[e][2]*off], t: T[e], r: Math.sin(a) * r1 });
        }

        var v = [], f = [], Nv = null;
        for (var i = 0; i < rings.length; i++) {
            var R = rings[i], Tg = R.t;
            if (!Nv) {
                var ax = [Math.abs(Tg[0]), Math.abs(Tg[1]), Math.abs(Tg[2])];
                Nv = ax[0] <= ax[1] && ax[0] <= ax[2] ? [1,0,0] : (ax[1] <= ax[2] ? [0,1,0] : [0,0,1]);
            }
            var d = Nv[0]*Tg[0] + Nv[1]*Tg[1] + Nv[2]*Tg[2];
            Nv = norm([Nv[0]-Tg[0]*d, Nv[1]-Tg[1]*d, Nv[2]-Tg[2]*d]);   // parallel transport
            var Bn = cross(Tg, Nv);
            for (var j = 0; j <= slices; j++) {
                var w = 2 * Math.PI * j / slices, c = Math.cos(w), s = Math.sin(w);
                v.push(R.c[0] + R.r*(c*Nv[0]+s*Bn[0]), R.c[1] + R.r*(c*Nv[1]+s*Bn[1]), R.c[2] + R.r*(c*Nv[2]+s*Bn[2]),
                       color[0], color[1], color[2]);
            }
        }
        grid(rings.length - 1, slices, f);
        return finish(v, f);
    }

    // ============ 9. TELAPAK KAKI EDDY: satu permukaan mulus dengan jari menyatu (khusus Eddy) ============
    // Ellipsoid modifikasi: alas dipipihkan (menapak tanah), lalu bagian depan-bawah "dipahat" menjadi beberapa
    // tonjolan jari membulat yang dipisah lekukan lembut. Jari BUKAN objek terpisah -> kaki terlihat satu kesatuan.
    //   a, b, c   : setengah lebar (x), tinggi (y), panjang (z)
    //   toes      : jumlah jari (tonjolan) di depan
    //   colorFn(toeMask, xn, yn, zn): toeMask 0..1 = seberapa "area jari" titik tsb (untuk pewarnaan putih di depan)
    function generatePaw(a, b, c, toes, stack, step, colorFn) {
        var FLAT = 0.35;                         // < 1 : alas makin rata
        var SPREAD = 0.78 * Math.PI;             // lebar busur depan yang ditempati jari (radian)
        var period = SPREAD / toes;              // jarak sudut antar jari
        var ss = function (e0, e1, x) { var k = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return k * k * (3 - 2 * k); };
        var v = [], f = [];
        for (var i = 0; i <= stack; i++) {
            var u = (i / stack) * Math.PI - Math.PI / 2, s = Math.sin(u), cu = Math.cos(u);
            var yn = s >= 0 ? s : -Math.pow(-s, FLAT);
            for (var j = 0; j <= step; j++) {
                var w = (j / step) * 2 * Math.PI;
                var phi = Math.atan2(Math.cos(w), Math.sin(w));          // sudut dari arah depan (+z), -pi..pi
                var aphi = Math.abs(phi);
                // posisi relatif di dalam deretan jari: lobe = 1 di tengah jari, 0 di lekukan antar jari
                var tpos = (phi + SPREAD / 2) / period;                    // 0..toes di dalam busur
                var lobe = Math.pow(0.5 - 0.5 * Math.cos(2 * Math.PI * tpos), 0.5);
                var front = ss(SPREAD / 2 + 0.25, SPREAD / 2 - 0.10, aphi); // hanya di busur depan
                var low = ss(0.62, 0.12, yn);                               // hanya bagian bawah (jari), memudar ke atas
                var m = front * low;
                // jari menggembung ke depan & ke samping, lekukan antar jari sedikit masuk
                var bulge = 1 + m * (0.14 + 0.15 * (lobe - 0.7));
                var xn = cu * Math.cos(w), zn = cu * Math.sin(w);
                // batas atas area putih melengkung di tiap jari (seperti tutup jari pada referensi)
                var top = 0.40 + 0.10 * lobe;
                var edge = SPREAD / 2 + 0.05 + 0.35 * (0.3 - yn);                // batas samping miring: makin bawah makin ke belakang
                var mask = ss(edge + 0.10, edge - 0.10, aphi) * ss(top + 0.06, top - 0.05, yn);
                var col = colorFn(mask, xn, yn, zn);
                v.push(a * xn * bulge, b * yn, c * zn * bulge, col[0], col[1], col[2]);
            }
        }
        grid(stack, step, f);
        return finish(v, f);
    }

    // ============ 10. ELLIPSOID BERWARNA PER-VERTEX (khusus Eddy: telapak tangan dengan lingkaran putih) ============
    // Sama seperti generateEllipsoid, tapi warna tiap vertex ditentukan colorFn(xn, yn, zn) (koordinat satuan -1..1),
    // sehingga pola (mis. lingkaran putih di telapak) menempel rata di permukaan tanpa objek tambahan yang melayang.
    function generateEllipsoidColored(a, b, c, stack, step, colorFn) {
        var v = [], f = [];
        for (var i = 0; i <= stack; i++) {
            var u = (i / stack) * Math.PI - Math.PI / 2;
            for (var j = 0; j <= step; j++) {
                var w = (j / step) * 2 * Math.PI;
                var xn = Math.cos(w) * Math.cos(u), yn = Math.sin(u), zn = Math.sin(w) * Math.cos(u);
                var col = colorFn(xn, yn, zn);
                v.push(a * xn, b * yn, c * zn, col[0], col[1], col[2]);
            }
        }
        grid(stack, step, f);
        return finish(v, f);
    }

    // ============ 11. BADAN EDDY: ellipsoid modifikasi berbentuk buah pir (khusus Eddy) ============
    // Sempit di bahu (tepat di bawah kepala), makin penuh ke perut & pantat. pear = seberapa kuat efek pir.
    function generatePearBody(a, b, c, pear, stack, step, color) {
        var v = [], f = [];
        for (var i = 0; i <= stack; i++) {
            var u = (i / stack) * Math.PI - Math.PI / 2, s = Math.sin(u), cu = Math.cos(u);
            var wf = 1 - pear * s;                       // atas (s=1) mengecil, bawah (s=-1) membesar
            for (var j = 0; j <= step; j++) {
                var w = (j / step) * 2 * Math.PI;
                v.push(a * wf * cu * Math.cos(w), b * s, c * wf * cu * Math.sin(w), color[0], color[1], color[2]);
            }
        }
        grid(stack, step, f);
        return finish(v, f);
    }

    // ============ 12. MONCONG EDDY: SATU permukaan mulus (khusus Eddy) ============
    // Ellipsoid yang sisi depannya "dipahat": bantalan bibir, dagu, dan lekuk garis mulut dibuat sebagai
    // tonjolan/cekungan halus pada permukaan yang sama -> tidak ada sambungan antar bola, semuanya menyatu.
    //   offsetFn(x, y) -> seberapa jauh permukaan depan didorong maju (+) / masuk (-) pada titik (x, y)
    function muzzleFront(zn) { var k = Math.min(Math.max(zn / 0.45, 0), 1); return k * k * (3 - 2 * k); }
    function generateMuzzle(a, b, c, offsetFn, stack, step, color) {
        var v = [], f = [];
        for (var i = 0; i <= stack; i++) {
            var u = (i / stack) * Math.PI - Math.PI / 2;
            for (var j = 0; j <= step; j++) {
                var w = (j / step) * 2 * Math.PI;
                var xn = Math.cos(w) * Math.cos(u), yn = Math.sin(u), zn = Math.sin(w) * Math.cos(u);
                var x = a * xn, y = b * yn, z = c * zn + muzzleFront(zn) * offsetFn(x, y);
                v.push(x, y, z, color[0], color[1], color[2]);
            }
        }
        grid(stack, step, f);
        return finish(v, f);
    }
    // Z permukaan depan moncong pada (x, y) -> untuk menempelkan garis mulut tepat di kulit
    function muzzleSurfaceZ(a, b, c, offsetFn, x, y) {
        var q = 1 - Math.pow(x / a, 2) - Math.pow(y / b, 2);
        if (q <= 0) return 0;
        var zn = Math.sqrt(q);
        return c * zn + muzzleFront(zn) * offsetFn(x, y);
    }

    // ============ 13. BADAN EDDY: oval yang MELEBAR ke arah leher (bukan oval sempurna) (khusus Eddy) ============
    // Profil lebar (yn = -1 bawah ... 1 atas):
    //   bawah bulat penuh, paling lebar sedikit di bawah tengah, lalu sisi badan hampir lurus & tetap lebar sampai leher
    //   (tidak mengerucut seperti ujung telur). Puncaknya menutup di dalam kepala.
    function eddyBodyProfile(yn) {
        var k = Math.min(Math.max(yn / 0.6, 0), 1); k = k * k * (3 - 2 * k);
        var e = 0.5 - 0.3 * k;                                   // < 0.5 di bagian atas -> sisi atas tidak cepat menutup
        return Math.pow(Math.max(1 - yn * yn, 0), e) * (1 - 0.2 * yn);
    }
    // colorFn(x, y, z) & offsetFn(x, y) bekerja di koordinat lokal badan: warna per-vertex (perut putih menempel rata)
    // dan tonjolan halus di sisi depan (perut sedikit membusung) -> satu permukaan, tanpa objek perut terpisah.
    function generateEddyBody(a, b, c, stack, step, colorFn, offsetFn) {
        var v = [], f = [];
        for (var i = 0; i <= stack; i++) {
            var u = (i / stack) * Math.PI - Math.PI / 2, yn = Math.sin(u), g = eddyBodyProfile(yn);
            for (var j = 0; j <= step; j++) {
                var w = (j / step) * 2 * Math.PI, cw = Math.cos(w), sw = Math.sin(w);
                var x = a * g * cw, y = b * yn, z = c * g * sw;
                if (sw > 0) z += offsetFn(x, y) * sw * sw;      // hanya sisi depan, memudar ke samping
                var col = colorFn(x, y, z);
                v.push(x, y, z, col[0], col[1], col[2]);
            }
        }
        grid(stack, step, f);
        return finish(v, f);
    }

    // ============ 14. KAKI + TELAPAK EDDY: SATU permukaan loft (khusus Eddy) ============
    // Kaki lurus turun lalu bertemu telapak berbentuk KUBAH RENDAH (setengah ellipsoid pipih) -> seperti paw rubah,
    // bukan corong/tumit yang meninggi. Pertemuan kaki & kubah dihaluskan dengan "soft-max" (fillet kecil) sehingga
    // tetap satu permukaan tanpa sambungan. Jari = tonjolan bulat lembut di depan-bawah (tidak menjorok keluar).
    //   o: { top, bottom, legR, legR2, pawH, pawMid, sole, pawRx, pawRz, pawCz, edge, blend,
    //        toes, spread, toeAmp, toeMid, toeHalf, whiteFront, whiteArch }
    //   colorFn(toeMask, padMask) -> warna per-vertex
    function generateLegPaw(o, rings, slices, colorFn) {
        var ss = function (e0, e1, x) { var k = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1); return k * k * (3 - 2 * k); };
        var softmax = function (a, b, p) { return Math.pow(Math.pow(a, p) + Math.pow(b, p), 1 / p); };
        var period = o.spread / o.toes;
        var v = [], f = [];
        for (var i = 0; i <= rings; i++) {
            var t = i / rings;
            var y = o.top + (o.bottom - o.top) * (1 - Math.pow(1 - t, 1.8));   // lebih rapat di telapak
            var legR = o.legR + (o.legR2 - o.legR) * ss(o.top, o.bottom + o.pawH, y);
            // kubah telapak: setengah ellipsoid di atas alas
            var h = (y - o.bottom) / o.pawH;                                     // 0 = alas, 1 = puncak kubah
            // Telapak "bakpao" kartun: paling lebar sedikit DI ATAS tanah (o.pawMid), lalu menekuk masuk ke alas
            // (alas lebih kecil dari lebar maksimum) -> bulat menggembung, bukan cakram/tapal kuda yang lebar di bawah.
            var hc = h >= o.pawMid ? (h - o.pawMid) / (1 - o.pawMid) : (h - o.pawMid) / o.pawMid;
            var dome = h < 1 ? (hc >= 0 ? Math.sqrt(Math.max(1 - hc * hc, 0))
                                        : Math.sqrt(Math.max(1 - hc * hc * (1 - o.sole * o.sole), 0))) : 0;
            var px = o.pawRx * dome, pz = o.pawRz * dome;
            var rx = softmax(legR, px, o.blend), rz = softmax(legR, pz, o.blend);
            var wgt = Math.pow(px, o.blend) / (Math.pow(legR, o.blend) + Math.pow(px, o.blend) + 1e-12);
            var cz = o.pawCz * wgt;
            // tepi alas membulat -> alas rata menapak tanah
            var d = Math.min(Math.max((o.bottom + o.edge - y) / o.edge, 0), 1);
            var sc = Math.pow(1 - Math.pow(d, 4), 0.25);
            for (var j = 0; j <= slices; j++) {
                var w = (j / slices) * 2 * Math.PI, cw = Math.cos(w), sw = Math.sin(w);
                var phi = Math.atan2(cw, sw), aphi = Math.abs(phi);              // sudut dari arah depan (+z)
                var tpos = (phi + o.spread / 2) / period;
                var frac = tpos - Math.floor(tpos);
                // tiap jari = tonjolan BULAT: melengkung ke samping (arch) DAN ke atas (vt) -> seperti bola kecil, bukan kolom
                var arch = Math.sqrt(Math.max(0, 1 - Math.pow(2 * frac - 1, 2)));
                var inRow = (tpos > 0 && tpos < o.toes) ? 1 : 0;
                var front = ss(o.spread / 2 + 0.15, o.spread / 2 - 0.15, aphi);
                var vt = Math.sqrt(Math.max(0, 1 - Math.pow((h - o.toeMid) / o.toeHalf, 2)));
                var bump = inRow * front * arch * vt * wgt;
                var bulge = 1 + o.toeAmp * bump;
                var x = rx * cw * sc * bulge, z = cz + rz * sw * sc * bulge;
                // putih: area jari dengan puncak melengkung (arch) di tiap jari, menyatu di bagian bawah
                // putih = "tudung" di UJUNG DEPAN telapak (mengikuti referensi), batasnya sedikit bergelombang per jari
                var edgeF = o.whiteFront - o.whiteArch * (arch - 0.5) * inRow;
                var toeMask = ss(edgeF - 0.04, edgeF + 0.04, sw) * ss(0.3, 0.7, wgt);
                // bantalan putih bulat di tengah alas (alas sendiri tetap oranye)
                var padMask = (d > 0.6) ? ss(1.0, 0.85, Math.hypot(x / (0.55 * o.pawRx), (z - cz + 0.03) / (0.50 * o.pawRz))) : 0;
                var col = colorFn(toeMask, padMask);
                v.push(x, y, z, col[0], col[1], col[2]);
            }
        }
        grid(rings, slices, f);
        return finish(v, f);
    }

    // ============ 15. TELINGA EDDY: paraboloid yang PANGKALNYA MENYATU ke kepala (khusus Eddy) ============
    // Sama seperti elliptic paraboloid (flip), tapi diperpanjang ke bawah (u < 0) masuk ke dalam kepala. Bagian pangkal yang
    // berada di luar kepala "ditekuk" halus ke permukaan kepala lewat conform(p, u) -> tidak ada tepi/bibir telinga yang
    // menggantung di luar kepala saat dilihat dari samping.
    function generateEarShell(a, b, height, u0, stack, step, color, conform) {
        var v = [], f = [];
        for (var i = 0; i <= stack; i++) {
            var u = u0 + (1 - u0) * (i / stack);
            var r = Math.sqrt(1 - u);
            for (var j = 0; j <= step; j++) {
                var w = (j / step) * 2 * Math.PI;
                var p = conform([a * r * Math.cos(w), height * u, b * r * Math.sin(w)], u);
                v.push(p[0], p[1], p[2], color[0], color[1], color[2]);
            }
        }
        grid(stack, step, f);
        return finish(v, f);
    }

    return {
        generateEllipsoid,
        generateEllipticParaboloid,
        generateHyperboloid2Sheet,
        generateCylinder,
        generateBSpline3D,
        generateTube,
        generateHead,
        headSurfaceZ,
        generateCone,
        generateLimb,
        generatePaw,
        generateEllipsoidColored,
        generatePearBody,
        generateMuzzle,
        muzzleSurfaceZ,
        eddyBodyProfile,
        generateEddyBody,
        generateLegPaw,
        generateEarShell
    };
})();

// #####################################################################
//  POBY_BUILDERS
// #####################################################################
export const POBY_BUILDERS = (function () {
    // =====================================================================
    //  builders.js — geometry generators
    //
    //  Every generator returns { vertices, faces }.
    //  vertices per point: x, y, z,  r, g, b,  nx, ny, nz   (9 numbers)
    //
    //  Course material used here:
    //   - generateBSpline   : exactly the B-spline from "Curve2D"
    //   - generateEllipsoid : the ellipsoid from pertemuan 4 (stack / step)
    //   - elliptic paraboloid & elliptic cone : the quadric table, pertemuan 4
    //   - normals for Phong shading (pertemuan 6)
    // =====================================================================

    // ---------------------------------------------------------------------
    // 1. B-SPLINE (Curve2D) — unchanged from the course
    //    controlPoint = [x0, y0, x1, y1, ...], m = number of points to make
    // ---------------------------------------------------------------------
    function generateBSpline(controlPoint, m, degree) {
        var curves = [];
        var knotVector = [];
        var n = controlPoint.length / 2;

        for (var i = 0; i < n + degree + 1; i++) {
            if (i < degree + 1) knotVector.push(0);
            else if (i >= n) knotVector.push(n - degree);
            else knotVector.push(i - degree);
        }

        var basisFunc = function (i, j, t) {
            if (j == 0) {
                if (t >= knotVector[n] && i === n - 1) return 1;
                return (knotVector[i] <= t && t < knotVector[i + 1]) ? 1 : 0;
            }
            var den1 = knotVector[i + j] - knotVector[i];
            var den2 = knotVector[i + j + 1] - knotVector[i + 1];
            var term1 = 0, term2 = 0;
            if (den1 != 0 && !isNaN(den1)) term1 = ((t - knotVector[i]) / den1) * basisFunc(i, j - 1, t);
            if (den2 != 0 && !isNaN(den2)) term2 = ((knotVector[i + j + 1] - t) / den2) * basisFunc(i + 1, j - 1, t);
            return term1 + term2;
        };

        for (var t = 0; t < m; t++) {
            var x = 0, y = 0;
            var u = (t / (m - 1) * (knotVector[n] - knotVector[degree])) + knotVector[degree];
            for (var key = 0; key < n; key++) {
                var C = basisFunc(key, degree, u);
                x += (controlPoint[key * 2] * C);
                y += (controlPoint[key * 2 + 1] * C);
            }
            curves.push(x);
            curves.push(y);
        }
        return curves;
    }

    // Run several B-splines over one table of control points.
    // table rows = [t, value1, value2, ...]. Column 0 is the same for every
    // curve, so sample i of every curve belongs to the same t.
    // Returns rows [t, value1, value2, ...] with m samples.
    function bsplineTable(table, m) {
        var out = [];
        for (var i = 0; i < m; i++) out.push([]);
        for (var col = 1; col < table[0].length; col++) {
            var cp = [];
            table.forEach(function (row) { cp.push(row[0], row[col]); });
            var curve = generateBSpline(cp, m, 3);
            for (var i = 0; i < m; i++) {
                if (col === 1) out[i].push(curve[i * 2]);       // t
                out[i].push(curve[i * 2 + 1]);                   // value
            }
        }
        return out;
    }

    // ---------------------------------------------------------------------
    // 2. NORMALS (needed for Phong shading)
    //    Each triangle's normal = cross product of two of its edges.
    //    A vertex's normal = average of the normals of the triangles around it
    //    (points at the same position share the average, so seams stay smooth).
    // ---------------------------------------------------------------------
    function withNormals(v6, faces) {
        var n = v6.length / 6, sum = {}, key = [];
        for (var i = 0; i < n; i++) {
            key[i] = Math.round(v6[i*6]*1000) + "," + Math.round(v6[i*6+1]*1000) + "," + Math.round(v6[i*6+2]*1000);
            if (!sum[key[i]]) sum[key[i]] = [0, 0, 0];
        }
        for (var f = 0; f < faces.length; f += 3) {
            var a = faces[f], b = faces[f+1], c = faces[f+2];
            var e1 = [v6[b*6]-v6[a*6], v6[b*6+1]-v6[a*6+1], v6[b*6+2]-v6[a*6+2]];
            var e2 = [v6[c*6]-v6[a*6], v6[c*6+1]-v6[a*6+1], v6[c*6+2]-v6[a*6+2]];
            var cr = [e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]];
            [a, b, c].forEach(function (id) { var s = sum[key[id]]; s[0] += cr[0]; s[1] += cr[1]; s[2] += cr[2]; });
        }
        var out = [];
        for (var i = 0; i < n; i++) {
            var s = sum[key[i]], l = Math.hypot(s[0], s[1], s[2]) || 1;
            out.push(v6[i*6], v6[i*6+1], v6[i*6+2], v6[i*6+3], v6[i*6+4], v6[i*6+5], s[0]/l, s[1]/l, s[2]/l);
        }
        return { vertices: out, faces: faces };
    }

    // grid of quads -> two triangles each (same as the course ellipsoid)
    function gridFaces(rows, cols, flip) {
        var faces = [];
        for (var i = 0; i < rows; i++)
            for (var j = 0; j < cols; j++) {
                var first = i * (cols + 1) + j, second = first + 1, third = first + (cols + 1), fourth = third + 1;
                if (flip) faces.push(first, fourth, second, first, third, fourth);
                else      faces.push(first, second, fourth, first, fourth, third);
            }
        return faces;
    }

    // ---------------------------------------------------------------------
    // 3. ELLIPSOID (pertemuan 4)
    //    x = a cos(v) cos(u),  y = b sin(u),  z = c sin(v) cos(u)
    // ---------------------------------------------------------------------
    function generateEllipsoid(a, b, c, stack, step, color) {
        var v6 = [];
        for (var i = 0; i <= stack; i++) {
            var u = i / stack * Math.PI - (Math.PI / 2);
            for (var j = 0; j <= step; j++) {
                var v = j / step * 2 * Math.PI - Math.PI;
                v6.push(a * Math.cos(v) * Math.cos(u), b * Math.sin(u), c * Math.sin(v) * Math.cos(u),
                        color[0], color[1], color[2]);
            }
        }
        return withNormals(v6, gridFaces(stack, step, true));
    }

    // ---------------------------------------------------------------------
    // 4. ELLIPTIC PARABOLOID (quadric table, pertemuan 4)
    //    x = a v cos(u),  y = b v sin(u),  z = c v²     v from 0 to 1
    //    A cup: the tip is at the origin and it opens towards +z.
    // ---------------------------------------------------------------------
    function generateEllipticParaboloid(a, b, c, stack, step, color) {
        var v6 = [];
        for (var i = 0; i <= stack; i++) {
            var v = i / stack;
            for (var j = 0; j <= step; j++) {
                var u = j / step * 2 * Math.PI - Math.PI;
                v6.push(a * v * Math.cos(u), b * v * Math.sin(u), c * v * v, color[0], color[1], color[2]);
            }
        }
        return withNormals(v6, gridFaces(stack, step));
    }

    // ---------------------------------------------------------------------
    // 5. ELLIPTIC CONE (quadric table, pertemuan 4)
    //    x = a v cos(u),  y = b v sin(u),  z = c v
    //    Only the slice v0 ≤ v ≤ 1 is made (a "frustum": a cone with its tip
    //    cut off), so the radius shrinks from a×b at v = 1 to v0·a × v0·b.
    //    It is shifted so the wide end sits at z = 0 and the narrow end at z = -length.
    // ---------------------------------------------------------------------
    function generateEllipticCone(a, b, v0, length, stack, step, color) {
        var c = length / (1 - v0), v6 = [];
        for (var i = 0; i <= stack; i++) {
            var v = 1 - (i / stack) * (1 - v0);
            for (var j = 0; j <= step; j++) {
                var u = j / step * 2 * Math.PI - Math.PI;
                v6.push(a * v * Math.cos(u), b * v * Math.sin(u), c * v - c, color[0], color[1], color[2]);
            }
        }
        return withNormals(v6, gridFaces(stack, step, true));
    }

    // ---------------------------------------------------------------------
    // 6. TORUS (extra, easy): a small circle (radius r) swept around a big
    //    circle (radius R).  x = (R + r cos v) cos u,  y = (R + r cos v) sin u,  z = r sin v
    // ---------------------------------------------------------------------
    function generateTorus(R, r, stack, step, color) {
        var v6 = [];
        for (var i = 0; i <= stack; i++) {
            var u = i / stack * 2 * Math.PI;
            for (var j = 0; j <= step; j++) {
                var v = j / step * 2 * Math.PI;
                v6.push((R + r * Math.cos(v)) * Math.cos(u), (R + r * Math.cos(v)) * Math.sin(u), r * Math.sin(v),
                        color[0], color[1], color[2]);
            }
        }
        return withNormals(v6, gridFaces(stack, step, true));
    }

    // ---------------------------------------------------------------------
    // 7. RING SURFACE — "an ellipsoid whose rings follow B-spline curves"
    //    The course ellipsoid is a stack of elliptical rings whose size comes
    //    from cos(u). Here every ring's size comes from a B-spline curve
    //    measured from the reference drawing instead.
    //    ring = { c: centre [x,y,z], u: axis 1, w: axis 2, a: radius on u, b: radius on w }
    //    point = c + u·a·cos(t) + w·b·sin(t)
    // ---------------------------------------------------------------------
    function generateRingSurface(rings, step, color, flip) {
        var v6 = [];
        rings.forEach(function (R) {
            for (var j = 0; j <= step; j++) {
                var t = j / step * 2 * Math.PI, ca = R.a * Math.cos(t), sb = R.b * Math.sin(t);
                v6.push(R.c[0] + R.u[0]*ca + R.w[0]*sb,
                        R.c[1] + R.u[1]*ca + R.w[1]*sb,
                        R.c[2] + R.u[2]*ca + R.w[2]*sb, color[0], color[1], color[2]);
            }
        });
        return withNormals(v6, gridFaces(rings.length - 1, step, flip));
    }

    // Move a mesh so that point o becomes its origin (its joint / pivot)
    function shiftMesh(mesh, o) {
        var v = mesh.vertices.slice();
        for (var i = 0; i < v.length; i += 9) { v[i] -= o[0]; v[i+1] -= o[1]; v[i+2] -= o[2]; }
        return { vertices: v, faces: mesh.faces };
    }

    // ---------------------------------------------------------------------
    // 8. RING SURFACE FROM POINTS — like generateRingSurface, but every ring
    //    is simply a list of points (all rings have the same number of points).
    //    Used for the legs, whose rings change shape from "half of the body"
    //    at the hip to an ellipse lower down.
    // ---------------------------------------------------------------------
    // skip (optional): skip(i, j) = true leaves out the quad between rings i, i+1
    // and points j, j+1 (used for the hidden wall where the two legs touch).
    function generateRingSurfaceFromPoints(rings, color, flip, skip) {
        var v6 = [], step = rings[0].length - 1;
        rings.forEach(function (ring) {
            ring.forEach(function (p) { v6.push(p[0], p[1], p[2], color[0], color[1], color[2]); });
        });
        var faces = gridFaces(rings.length - 1, step, flip);
        if (skip) {
            var kept = [];
            for (var q = 0; q < faces.length; q += 6) {          // 6 indices = one quad
                var quad = q / 6, i = Math.floor(quad / step), j = quad % step;
                if (!skip(i, j)) kept.push.apply(kept, faces.slice(q, q + 6));
            }
            faces = kept;
        }
        return withNormals(v6, faces);
    }

    // Make several meshes share their normals where they touch: the normals of
    // all their triangles are averaged together by position, so the join between
    // two meshes (e.g. torso and legs) has no visible shading line.
    function shareNormals(meshes) {
        var sum = {}, key = function (v, i) {
            return Math.round(v[i]*1000) + "," + Math.round(v[i+1]*1000) + "," + Math.round(v[i+2]*1000);
        };
        meshes.forEach(function (m) {
            var v = m.vertices, f = m.faces;
            for (var k = 0; k < f.length; k += 3) {
                var a = f[k]*9, b = f[k+1]*9, c = f[k+2]*9;
                var e1 = [v[b]-v[a], v[b+1]-v[a+1], v[b+2]-v[a+2]], e2 = [v[c]-v[a], v[c+1]-v[a+1], v[c+2]-v[a+2]];
                var cr = [e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]];
                [a, b, c].forEach(function (i) {
                    var s = sum[key(v, i)] || (sum[key(v, i)] = [0, 0, 0]);
                    s[0] += cr[0]; s[1] += cr[1]; s[2] += cr[2];
                });
            }
        });
        meshes.forEach(function (m) {
            var v = m.vertices;
            for (var i = 0; i < v.length; i += 9) {
                var s = sum[key(v, i)];
                if (!s) continue;                                  // point not used by any triangle
                var l = Math.hypot(s[0], s[1], s[2]) || 1;
                v[i+6] = s[0]/l; v[i+7] = s[1]/l; v[i+8] = s[2]/l;
            }
        });
    }

    // Turn and move a mesh: every point p = (x, y, z) goes to o + X·x + Y·y + Z·z
    // (X, Y, Z = the new directions of the mesh's x, y and z axes — the columns
    // of a rotation matrix). Used to lay pads flat on a curved palm.
    // If X, Y, Z are a mirror image (determinant < 0) the triangles are turned
    // around so their front side still faces outwards.
    function orientMesh(mesh, o, X, Y, Z) {
        var v = mesh.vertices.slice(), f = mesh.faces.slice();
        for (var i = 0; i < v.length; i += 9) {
            var x = v[i], y = v[i+1], z = v[i+2], nx = v[i+6], ny = v[i+7], nz = v[i+8];
            for (var k = 0; k < 3; k++) {
                v[i+k]   = o[k] + X[k]*x + Y[k]*y + Z[k]*z;
                v[i+6+k] = X[k]*nx + Y[k]*ny + Z[k]*nz;
            }
        }
        var det = X[0]*(Y[1]*Z[2]-Y[2]*Z[1]) - X[1]*(Y[0]*Z[2]-Y[2]*Z[0]) + X[2]*(Y[0]*Z[1]-Y[1]*Z[0]);
        if (det < 0) for (var k = 0; k < f.length; k += 3) { var t = f[k+1]; f[k+1] = f[k+2]; f[k+2] = t; }
        return { vertices: v, faces: f };
    }


    // =====================================================================
    // 3. POBY'S OWN SHAPES
    //    The measurements (tables in cm) stay in poby.js; these functions
    //    turn them into meshes, the same way EDDY_BUILDERS makes Eddy's
    //    head / body / legs from the numbers in eddy.js.
    // =====================================================================

    // ---------- small vector + table helpers ----------
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function add(a, b, c, d) {                              // sum of 2 to 4 vectors
        var r = [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
        if (c) r = [r[0] + c[0], r[1] + c[1], r[2] + c[2]];
        if (d) r = [r[0] + d[0], r[1] + d[1], r[2] + d[2]];
        return r;
    }
    function mul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function normalize(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
    function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
    function smooth(s) {                                    // 0..1 with soft start and end ("smoothstep")
        s = Math.min(1, Math.max(0, s));
        return s * s * (3 - 2 * s);
    }
    // the row of a sampled table at key t (linear interpolation between samples)
    function lookup(rows, t) {
        if (t <= rows[0][0]) return rows[0];
        for (var i = 1; i < rows.length; i++) {
            if (rows[i][0] >= t) {
                var a = rows[i - 1], b = rows[i], s = (t - a[0]) / ((b[0] - a[0]) || 1);
                return a.map(function (v, k) { return v + (b[k] - v) * s; });
            }
        }
        return rows[rows.length - 1];
    }
    function superellipse(v, n) { return Math.sign(v) * Math.pow(Math.abs(v), 2 / n); }
    // key of a point (used to remember the rig weight of every leg point)
    function rigKey(x, y, z) { return Math.round(x * 100) + "," + Math.round(y * 100) + "," + Math.round(z * 100); }

    // ---------------------------------------------------------------------
    // 3a. BODY: torso + legs + feet, one continuous skin
    //   spec = { torso, torsoSquare, backShare, chestBackShare,
    //            leg, legSteps, foot, footX, ankleBlend }   (see poby.js)
    // ---------------------------------------------------------------------
    // A leg ring point at angle t sits at "across" = (1 + cos t) / 2 of the way
    // from the leg's inner edge (0) to its outer edge (1). On the torso's right
    // half we use the point with the same "across" value, so leg and torso rings
    // have exactly the same points where they meet.
    function acrossOf(t) { return (1 + Math.cos(t)) / 2; }
    function pobyBody(spec) {
        var LEG = spec.leg, FOOT = spec.foot;

        // BODY CROSS-SECTION: the oval is split into a FRONT half and a BACK half
        // around z0 (backShare of the way from the back to the front). The back is
        // much deeper than the front ("backwards belly"), so with two halves the
        // front keeps full, boxy corners and only the back carries the big round
        // back. Higher up (the chest) the front gets a bigger share (chestBackShare).
        function bodyHalves(zf, zb, y) {
            var share = spec.backShare + (spec.chestBackShare - spec.backShare) * smooth(((y || 0) - 17) / 6);
            var z0 = zb + (zf - zb) * share;
            return { z0: z0, front: zf - z0, back: z0 - zb };
        }
        function halfBodyPoint(t, W, zf, zb, y) {
            var h = bodyHalves(zf, zb, y), u = acrossOf(t);
            var k = Math.sqrt(Math.max(0, 1 - u * u));
            return [W * u, Math.sin(t) >= 0 ? h.z0 + h.front * k : h.z0 - h.back * k];
        }
        // all torso ring angles: the right half (from the legs' angles) and its mirror on the left
        function torsoRingAngles(steps) {
            var q = [];                                              // 0 .. π/2 (right front quarter)
            for (var j = 0; j <= steps / 2; j++) q.push(Math.acos(acrossOf(j / steps * 2 * Math.PI)));
            var out = q.slice();
            for (var j = q.length - 2; j >= 0; j--) out.push(Math.PI - q[j]);      // left front
            for (var j = 1; j < q.length; j++) out.push(Math.PI + q[j]);           // left back
            for (var j = q.length - 2; j >= 0; j--) out.push(2 * Math.PI - q[j]);  // right back
            return out;
        }
        // back of the shorts at height y (v = the cone's size factor there): the
        // ring's centre z and front-to-back radius b, so the front stays at
        // LEG.z + LEG.b·v and the back reaches back by backFoot .. backFlare
        function legBack(y, v) {
            var footTop = FOOT[FOOT.length - 1][0];
            var k = LEG.backFoot + (LEG.backFlare - LEG.backFoot) * smooth((y - footTop) / (LEG.coneTop - footTop));
            var bv = LEG.b * v;
            return { z: LEG.z - bv * (k - 1) / 2, b: bv * (1 + k) / 2 };
        }
        // elliptic cone (quadric table): size factor v at height y
        function coneV(y) { return LEG.v0 + (y - LEG.bottom) / (LEG.coneTop - LEG.bottom) * (1 - LEG.v0); }

        var torsoRows = bsplineTable(spec.torso, 120);
        var torsoRings = torsoRows.filter(function (r) { return r[0] >= LEG.top; }).map(function (r) {
            var h = bodyHalves(r[2], r[3], r[0]);
            return { c: [0, r[0], h.z0], a: Math.max(r[1], 0), bf: Math.max(h.front, 0), bb: Math.max(h.back, 0) };
        });
        var legTop = torsoRings[0].c[1];                     // exactly where the torso mesh starts
        var footRows = bsplineTable(FOOT, 30), footTopY = footRows[footRows.length - 1][0];

        // TORSO: superellipse rings, n = 2 at the hips (so the legs join exactly),
        // squarer (torsoSquare) from the belly up; the front half stays a plain oval
        function torsoMesh(color) {
            var angles = torsoRingAngles(spec.legSteps);
            return generateRingSurfaceFromPoints(torsoRings.map(function (R) {
                var n = 2 + (spec.torsoSquare - 2) * smooth((R.c[1] - 19) / 6);
                return angles.map(function (phi) {
                    var c = Math.cos(phi), sn = Math.sin(phi);
                    var x = R.a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
                    if (Math.abs(x) < 0.05) x = 0;             // same snap as the legs, so the points match
                    var nz = sn >= 0 ? 2 : n;
                    return [x, R.c[1], R.c[2] + (sn >= 0 ? R.bf : R.bb) * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / nz)];
                });
            }), color, true);
        }

        // LEG: rings from the hip (legTop) down to the top of the foot. Near the hip
        // each ring is the matching half of the torso cross-section; lower down it
        // turns into the elliptic cone. Returns the mesh and the RIG WEIGHT of every
        // point (how "leg-shaped" it is: 0 = still body, 1 = leg).
        function leg(side, color) {
            var STEPS = spec.legSteps, ROWS = 90, rings = [], weights = {};
            for (var i = 0; i <= ROWS; i++) {
                var y = legTop + (footTopY - legTop) * i / ROWS, v = coneV(y);
                var hip = lookup(torsoRows, y);                 // the torso outline at this height
                // round crotch arch: the legs may not come closer than this to the middle
                var yc = LEG.archTop - LEG.archR;
                var gap = y >= LEG.archTop ? 0 : (y > yc ? Math.sqrt(LEG.archR * LEG.archR - (y - yc) * (y - yc)) : LEG.archR);
                var sInner = smooth((LEG.archTop - y) / 1.5);   // between the legs: joined above the arch, apart below
                var ring = [];
                for (var j = 0; j <= STEPS; j++) {
                    var t = j / STEPS * 2 * Math.PI, u = acrossOf(t);
                    // the front rolls under into the leg along a "U": foldMid in the middle, foldHip at the hips
                    var yFold = LEG.foldMid + (LEG.foldHip - LEG.foldMid) * u;
                    var s = smooth((yFold + LEG.foldWidth / 2 - y) / LEG.foldWidth);
                    var half = halfBodyPoint(t, hip[1], hip[2], hip[3], y);
                    // back of the shorts: the centre moves back, the front stays put
                    var lb = legBack(y, v), sn = Math.sin(t);
                    if (sn < 0) {                                   // back half: squarer towards the top
                        var nb = 2 + (LEG.backSquare - 2) * smooth((y - footTopY) / (LEG.coneTop - footTopY));
                        sn = -Math.pow(-sn, 2 / nb);
                    }
                    var cone = [LEG.x + LEG.a * v * Math.cos(t), lb.z + lb.b * sn];
                    // back half: the long, slow fold under the bottom (backFoldTop), eased in around the sides
                    var sBack = smooth((LEG.backFoldTop - y) / LEG.backFoldLen);
                    s = s + (sBack - s) * smooth(-Math.sin(t) / 0.6);
                    // x: points near the middle (small u) wait for the arch
                    var sx = s + (Math.min(s, sInner) - s) * smooth((0.25 - u) / 0.25);
                    var x = half[0] + (cone[0] - half[0]) * sx;
                    // back middle: the round bottom stays whole until just above the split,
                    // then sinks in slowly over 4 cm (a soft valley, no slit)
                    var sInnerZ = smooth((LEG.archTop + 0.8 - y) / 4.0);
                    var sz = s + (Math.min(s, sInnerZ) - s) * smooth((0.3 - u) / 0.3) * smooth(-Math.sin(t) / 0.6);
                    var z = half[1] + (cone[1] - half[1]) * sz;
                    x = Math.max(x, gap);
                    if (x < 0.05) x = 0;           // snap onto the middle line so both legs meet exactly
                    ring.push([side * x, y, z]);
                    weights[rigKey(side * x, y, z)] = Math.min(sx, sz);
                }
                rings.push(ring);
            }
            // where the legs are still joined, part of each ring lies flat on the middle
            // line (a hidden wall): leave out every piece whose 4 corners lie there
            function onMiddle(p) { return Math.abs(p[0]) < 0.05; }
            var mesh = generateRingSurfaceFromPoints(rings, color, side < 0, function (i, j) {
                return onMiddle(rings[i][j]) && onMiddle(rings[i][j + 1]) &&
                       onMiddle(rings[i + 1][j]) && onMiddle(rings[i + 1][j + 1]);
            });
            return { mesh: mesh, weights: weights };
        }

        // FOOT: ring surface; the first ring has size 0 so the sole is flat. Over the
        // top ankleBlend cm each ring turns into the leg's cone ring (no ankle ledge).
        function foot(side, color) {
            var rings = [{ c: [side * spec.footX, 0, (footRows[0][2] + footRows[0][3]) / 2], u: [1, 0, 0], w: [0, 0, 1], a: 0, b: 0 }]
                .concat(footRows.map(function (r, k) {
                    var y = r[0], ring = { x: spec.footX, z: (r[2] + r[3]) / 2, a: r[1], b: (r[2] - r[3]) / 2 };
                    var v = coneV(y), lb = legBack(y, v), cone = { x: LEG.x, z: lb.z, a: LEG.a * v, b: lb.b };
                    var s = k === footRows.length - 1 ? 1 : smooth((y - (footTopY - spec.ankleBlend)) / spec.ankleBlend);
                    ["x", "z", "a", "b"].forEach(function (q) { ring[q] += (cone[q] - ring[q]) * s; });
                    return { c: [side * ring.x, y, ring.z], u: [1, 0, 0], w: [0, 0, 1], a: ring.a, b: ring.b };
                }));
            return generateRingSurface(rings, spec.legSteps, color, true);
        }

        return { torsoRows: torsoRows, footRows: footRows, legTop: legTop, torsoMesh: torsoMesh, leg: leg, foot: foot };
    }

    // ---------------------------------------------------------------------
    // 3b. HEAD: superellipse rings |x/a|^n + |y/b|^n = 1 through the HEAD table
    //   rows [z, top y, bottom y, half-width]; square = how square the face is.
    //   Returns the mesh + ways to find points ON the head (for eyes / mouth).
    // ---------------------------------------------------------------------
    function pobyHead(table, square, steps, color) {
        var rows = bsplineTable(table, 100);
        // n grows from 2 (round back) to 2 + square (fuller cheeks and jaw)
        function headN(z) { return 2 + square * smooth((z + 3) / 6) - 0.2 * smooth((z - 8) / 4); }
        function ringN(n, upper) { return upper ? 2 + (n - 2) * 0.3 : n; }   // the crown stays rounder than the jaw
        var mesh = generateRingSurfaceFromPoints(rows.map(function (r) {
            var yc = (r[1] + r[2]) / 2, a = Math.max(r[3], 0), b = Math.max((r[1] - r[2]) / 2, 0), n = headN(r[0]), pts = [];
            for (var j = 0; j <= steps; j++) {
                var t = j / steps * 2 * Math.PI, nt = ringN(n, Math.sin(t) > 0);
                pts.push([a * superellipse(Math.cos(t), nt), yc + b * superellipse(Math.sin(t), nt), r[0]]);
            }
            return pts;
        }), color);
        // x of the head surface at depth z and height y
        function x(z, y) {
            var r = lookup(rows, z), yc = (r[1] + r[2]) / 2, b = (r[1] - r[2]) / 2;
            var n = ringN(headN(z), y > yc);
            return r[3] * Math.pow(Math.max(0, 1 - Math.pow(Math.abs((y - yc) / b), n)), 1 / n);
        }
        // front-most z of the head surface at (x, y): walk backwards from the tip
        function frontZ(px, y) {
            for (var z = 12.6; z > -5; z -= 0.01) if (Math.abs(px) <= x(z, y)) return z;
            return 0;
        }
        // point on the head at depth z, angle t around the ring (+ its outward direction)
        function point(z, t) {
            var r = lookup(rows, z), yc = (r[1] + r[2]) / 2, b = (r[1] - r[2]) / 2, nt = ringN(headN(z), Math.sin(t) > 0);
            var p = [r[3] * superellipse(Math.cos(t), nt), yc + b * superellipse(Math.sin(t), nt), z];
            return { p: p, out: normalize([p[0] / (r[3] || 1), (p[1] - yc) / (b || 1), 0]) };
        }
        // angle t of the side point (z, y) on the right
        function angleOf(z, y) {
            var r = lookup(rows, z), yc = (r[1] + r[2]) / 2, b = (r[1] - r[2]) / 2, n = headN(z);
            var s = Math.min(1, Math.abs((y - yc) / b));
            return -Math.asin(Math.pow(s, n / 2));
        }
        return { mesh: mesh, x: x, frontZ: frontZ, point: point, angleOf: angleOf };
    }

    // a LINE ON THE HEAD (the mouth): a B-spline through [z, angle] control points,
    // every point put on the head surface, drawn as a thin tube of radius r.
    // Returns the mesh + the two end points (for the round dots at the ends).
    function generateHeadLine(head, cp, r, color) {
        var line = generateBSpline(cp, 200, 3), pts = [];
        for (var i = 0; i < line.length; i += 2) {
            var hp = head.point(line[i], line[i + 1]);
            pts.push({ p: add(hp.p, mul(hp.out, 0.02)), out: hp.out });   // sits half in the skin
        }
        var rings = pts.map(function (m, i) {
            var a = pts[Math.max(i - 1, 0)].p, b = pts[Math.min(i + 1, pts.length - 1)].p;
            var T = normalize(sub(b, a));
            var N = normalize(sub(m.out, mul(T, dot(m.out, T)))), Bn = cross(T, N), ring = [];
            for (var j = 0; j <= 12; j++) {
                var th = j / 12 * 2 * Math.PI;
                ring.push(add(m.p, mul(N, r * Math.cos(th)), mul(Bn, r * Math.sin(th))));
            }
            return ring;
        });
        return { mesh: generateRingSurfaceFromPoints(rings, color), ends: [pts[0].p, pts[pts.length - 1].p] };
    }

    // ---------------------------------------------------------------------
    // 3c. EAR: one surface of revolution around a B-spline outline [r, z]
    //   (back -> rim -> hollow). The hollow sits cupDrop lower (thicker rim on
    //   top) and its colour turns from fur to inner.
    // ---------------------------------------------------------------------
    function generatePobyEar(profile, cupDrop, fur, inner) {
        var cp = [];
        profile.forEach(function (q) { cp.push(q[0], q[1]); });
        var prof = generateBSpline(cp, 48, 3), n = prof.length / 2, rings = [];
        for (var i = 0; i < n; i++) {
            var drop = -cupDrop * smooth((i / (n - 1) - 0.5) / 0.35);       // only the hollow moves down
            rings.push({ c: [0, drop, prof[i * 2 + 1]], u: [1, 0, 0], w: [0, 1, 0], a: prof[i * 2], b: prof[i * 2] });
        }
        var STEP = 48, mesh = generateRingSurface(rings, STEP, fur, true);
        for (var i = 0; i < n; i++) {
            var k = smooth((i / (n - 1) - 0.62) / 0.15);
            for (var j = 0; j <= STEP; j++) {
                var v = (i * (STEP + 1) + j) * 9;
                for (var q = 0; q < 3; q++) mesh.vertices[v + 3 + q] = fur[q] + (inner[q] - fur[q]) * k;
            }
        }
        return mesh;
    }

    // ---------------------------------------------------------------------
    // 3d. ARM: rings along a 2D B-spline centre line (front view), shoulder -> wrist
    //   path = [x0, y0, x1, y1, ...] (right arm), size = [s, half-width, half-depth]
    //   back = how far back the shoulder sits (fades out to 0 at the wrist)
    //   Returns the rings, the centre line, and the arm's directions.
    // ---------------------------------------------------------------------
    function pobyArm(path2d, size, side, z, back, RING) {
        var path = generateBSpline(path2d, 60, 3), sizes = bsplineTable(size, 60), N = path.length / 2;
        var W = [0, 0, 1], out = { rings: [], centres: [], W: W };
        for (var i = 0; i < N; i++) {
            var p0 = Math.max(i - 1, 0), p1 = Math.min(i + 1, N - 1);
            var tx = path[p1 * 2] - path[p0 * 2], ty = path[p1 * 2 + 1] - path[p0 * 2 + 1], tl = Math.hypot(tx, ty);
            // ring square to the curve: U = 2D normal (towards the body at the wrist), D = along the arm
            var U = [side * ty / tl, -tx / tl, 0], D = [side * tx / tl, ty / tl, 0];
            var t = i / (N - 1), sz = lookup(sizes, t);
            var c = [side * path[i * 2], path[i * 2 + 1], z - back * (1 - t)], ring = [];
            for (var j = 0; j <= RING; j++) {
                var th = j / RING * 2 * Math.PI;
                ring.push(add(c, mul(U, sz[1] * Math.cos(th)), mul(W, sz[2] * Math.sin(th))));
            }
            out.rings.push(ring); out.centres.push(c);
            if (i === 0) { out.U0 = U; out.D0 = D; out.shoulder = c; }
            out.U = U; out.D = D;
        }
        out.wrist = [side * path[path.length - 2], path[path.length - 1], z];
        return out;
    }

    // ---------------------------------------------------------------------
    // 3e. PAW: ONE smooth skin in 2 steps
    //   1. SHAPE: the palm (rings sized by the palm table, rounded end), 3 fingers
    //      and a thumb (capsules), each a "distance" function (< 0 inside), melted
    //      together with a SOFT MINIMUM so the fingers grow out of the palm.
    //   2. SKIN: the ellipsoid's grid (rings × points), each point pushed out along
    //      its ray from a centre inside the wrist until it reaches that shape, then
    //      tidied (relaxed) so the points spread evenly.
    //   The top ring is exactly the arm's last ring, so arm and paw join with no seam.
    //   spec = { hand, palm, armR, wrist, U, W, D, top (last arm ring), RING }
    //   Paw coordinates: d = down the arm, u = towards the palm side, w = across.
    // ---------------------------------------------------------------------
    function pobyPaw(spec) {
        var H = spec.hand, wristC = spec.wrist, U = spec.U, W = spec.W, D = spec.D, RING = spec.RING;
        function P(d, u, w) { return add(wristC, mul(D, d), mul(U, u), mul(W, w)); }
        var palmRows = bsplineTable(spec.palm, 80);
        function palmDist(d, u, w) {                          // the palm (and the end of the forearm)
            var Ld = H.capStart, r = lookup(palmRows, Math.min(d, Ld)), b = r[2];
            var a = u >= r[3] ? r[1] : r[3] + r[4];          // palm side / back of the hand
            var uu = (u - r[3]) / a, ww = w / b;
            if (d <= Ld) return (Math.hypot(uu, ww) - 1) * Math.min(a, b);
            // rounded end: half an ellipsoid, longer (capBack) on the fuller back of the hand
            var capLen = H.cap + (H.capBack - H.cap) * smooth(-uu);
            var dd = (d - Ld) / capLen;
            return (Math.sqrt(uu * uu + ww * ww + dd * dd) - 1) * Math.min(a, b);
        }
        function capsuleDist(q, f) {                          // tube from knuckle A to tip B, radius rA -> rB
            var A = f.A, BA = [f.B[0] - A[0], f.B[1] - A[1], f.B[2] - A[2]], PA = [q[0] - A[0], q[1] - A[1], q[2] - A[2]];
            var h = Math.min(1, Math.max(0, dot(PA, BA) / dot(BA, BA)));
            return Math.hypot(PA[0] - BA[0] * h, PA[1] - BA[1] * h, PA[2] - BA[2] * h) - (f.rA + (f.rB - f.rA) * h);
        }
        function smin(a, b, k) {                              // soft minimum: like min, but rounded where they meet
            var h = Math.max(k - Math.abs(a - b), 0) / k;
            return Math.min(a, b) - h * h * k / 4;
        }
        var digits = H.digits.map(function (f) { return { A: f[0], B: f[1], rA: f[2], rB: f[3] }; });
        function pawDist(q) {                                 // q = [d, u, w]
            var f = 1e9;
            digits.forEach(function (g) { f = smin(f, capsuleDist(q, g), H.kFingers); });
            var paw = smin(palmDist(q[0], q[1], q[2]), f, H.kPalm);
            // right at the wrist it is exactly the round arm; morph into the paw over wristBlend cm
            var t = smooth(q[0] / H.wristBlend);
            return (Math.hypot(q[1], q[2]) - spec.armR) * (1 - t) + paw * t;
        }
        function local(p) { var r = sub(p, wristC); return [dot(r, D), dot(r, U), dot(r, W)]; }
        // walk from 'from' (inside) along 'dir' until the shape ends; return that point
        function hit(from, dir) {
            var t = 0, step = 0.05;
            while (t < 12 && pawDist(local(add(from, mul(dir, t + step)))) < 0) t += step;
            var lo = t, hi = t + step;                        // then halve the interval a few times
            for (var i = 0; i < 20; i++) {
                var mid = (lo + hi) / 2;
                if (pawDist(local(add(from, mul(dir, mid)))) < 0) lo = mid; else hi = mid;
            }
            return add(from, mul(dir, lo));
        }
        function gradient(q, e) {
            var f0 = pawDist(q);
            return { f0: f0, g: [pawDist([q[0] + e, q[1], q[2]]) - f0, pawDist([q[0], q[1] + e, q[2]]) - f0, pawDist([q[0], q[1], q[2] + e]) - f0] };
        }
        function normalAt(p) {                                // surface direction (finite differences)
            var g = gradient(local(p), 0.01).g;
            return normalize(add(mul(D, g[0]), mul(U, g[1]), mul(W, g[2])));
        }
        function toSurface(p) {                               // pull a point onto the surface
            for (var n = 0; n < 4; n++) {
                var e = 0.005, G = gradient(local(p), e), g = G.g;
                var gg = (g[0] * g[0] + g[1] * g[1] + g[2] * g[2]) / (e * e) || 1;
                var k = G.f0 / gg / e;
                p = sub(p, add(mul(D, g[0] * k), mul(U, g[1] * k), mul(W, g[2] * k)));
            }
            return p;
        }

        // SKIN: rays from a centre above the wrist, like the ellipsoid's u (down) and v (around)
        var centre = add(wristC, mul(D, -H.centreUp));
        var a0 = Math.atan2(spec.armR, H.centreUp);           // ray angle (from straight down) that meets the wrist ring
        var rings = [spec.top];
        for (var i = 1; i <= H.rings; i++) {
            var be = a0 * (1 - i / H.rings), ring = [];
            for (var j = 0; j <= RING; j++) {
                var th = j / RING * 2 * Math.PI;
                var dir = add(mul(D, Math.cos(be)), mul(U, Math.sin(be) * Math.cos(th)), mul(W, Math.sin(be) * Math.sin(th)));
                ring.push(i === H.rings ? hit(centre, D) : hit(centre, dir));
            }
            rings.push(ring);
        }
        // relax the skin: weight(p) = how much a point may move, keep = pull back onto the surface
        function relax(times, lambda, weight, keep) {
            for (var it = 0; it < times; it++) {
                var lam = typeof lambda === "function" ? lambda(it) : lambda;
                var next = rings.map(function (r) { return r.slice(); });
                for (var i = 1; i < rings.length - 1; i++) {
                    for (var j = 0; j < RING; j++) {
                        var p = rings[i][j], wgt = weight ? weight(p) : 1;
                        if (wgt <= 0) continue;
                        var jl = (j + RING - 1) % RING, jr = (j + 1) % RING;
                        var avg = mul(add(rings[i - 1][j], rings[i + 1][j], rings[i][jl], rings[i][jr]), 0.25);
                        next[i][j] = keep ? toSurface(add(mul(p, 1 - lam), mul(avg, lam)))   // halfway to the average, back onto the surface
                                          : add(p, mul(sub(avg, p), lam * wgt));
                    }
                    next[i][RING] = next[i][0];                  // the ring closes on itself
                }
                rings = next;
            }
        }
        // TIDY: where rays only graze the surface (sides of the fingers) points bunch up
        relax(H.tidy, 0.5, null, true);
        // SOFTEN THE KNUCKLE FOLD on the back of the hand (Taubin: smooth, then undo the shrink)
        relax(H.foldSmooth, function (it) { return it % 2 ? -0.53 : 0.5; }, function (p) {
            var q = local(p);
            return smooth(-q[1] / 0.8) * (1 - smooth(Math.abs(q[0] - H.foldAt) / H.foldWidth));
        }, false);

        // a flat pad laid on the skin like a DECAL: every point is pressed onto the
        // curved surface, then lifted by its thickness. size = [half w, half l, thickness, sink];
        // round = 2 for a round dot, > 2 for a rounded rectangle. origin = the mesh's origin.
        function pad(from, dir, size, round, origin, color) {
            var p = hit(from, dir), n = normalAt(p);
            var X = normalize(sub(W, mul(n, dot(W, n)))), Y = cross(n, X);
            var STACK = 16, STEP = 40, rings = [];
            for (var i = 0; i <= STACK; i++) {
                var u = i / STACK * Math.PI - Math.PI / 2, ring = [];
                for (var j = 0; j <= STEP; j++) {
                    var v = j / STEP * 2 * Math.PI, cv = Math.cos(v), sv = Math.sin(v);
                    var k = Math.pow(Math.pow(Math.abs(cv), round) + Math.pow(Math.abs(sv), round), -1 / round);
                    var q = [size[0] * Math.cos(u) * cv * k, size[1] * Math.cos(u) * sv * k, size[2] * Math.sin(u)];
                    var sp = toSurface(add(p, mul(X, q[0]), mul(Y, q[1])));
                    ring.push(sub(add(sp, mul(normalAt(sp), q[2] - size[3])), origin));
                }
                rings.push(ring);
            }
            return generateRingSurfaceFromPoints(rings, color);
        }
        return { rings: rings, digits: digits, P: P, pad: pad };
    }

    // ---------------------------------------------------------------------
    // 3f. PROPS for the bubble-wand story (poby_story.js)
    // ---------------------------------------------------------------------
    function propMesh(pos, col, faces) {                 // normals = sum of the face normals around a point
        var nr = pos.map(function () { return [0, 0, 0]; });
        for (var f = 0; f < faces.length; f += 3) {
            var a = pos[faces[f]], b = pos[faces[f + 1]], c = pos[faces[f + 2]];
            var fn = cross(sub(b, a), sub(c, a));
            [faces[f], faces[f + 1], faces[f + 2]].forEach(function (i) { nr[i][0] += fn[0]; nr[i][1] += fn[1]; nr[i][2] += fn[2]; });
        }
        var v = [];
        pos.forEach(function (p, i) { var q = normalize(nr[i]); v.push(p[0], p[1], p[2], col[i][0], col[i][1], col[i][2], q[0], q[1], q[2]); });
        return { vertices: v, faces: faces };
    }
    function propGrid(rows, cols, faces) {
        for (var i = 0; i < rows; i++) for (var j = 0; j < cols; j++) {
            var p = i * (cols + 1) + j, q = p + cols + 1;
            faces.push(p, q, p + 1, p + 1, q, q + 1);
        }
    }
    // a stick along +Y from y0 to y1 with round ends (the wand)
    function generateCapsule(r, y0, y1, color) {
        var pos = [], col = [], faces = [], SEG = 14, ST = 10;
        for (var i = 0; i <= ST + 2; i++) {
            var y, rr;
            if (i === 0) { y = y0 - r * 0.6; rr = 0.0001; } else if (i === ST + 2) { y = y1 + r * 0.6; rr = 0.0001; }
            else { y = y0 + (y1 - y0) * (i - 1) / ST; rr = r; }
            for (var j = 0; j <= SEG; j++) { var a = j / SEG * 2 * Math.PI; pos.push([rr * Math.cos(a), y, rr * Math.sin(a)]); col.push(color); }
        }
        propGrid(ST + 2, SEG, faces);
        return propMesh(pos, col, faces);
    }
    // a ring in the XY plane (axis +Z) around centre c (the wand's loop)
    function generateRing(R, r, c, color) {
        var pos = [], col = [], faces = [], SU = 40, SV = 12;
        for (var i = 0; i <= SU; i++) for (var j = 0; j <= SV; j++) {
            var u = i / SU * 2 * Math.PI, v = j / SV * 2 * Math.PI, k = R + r * Math.cos(v);
            pos.push([c[0] + k * Math.cos(u), c[1] + k * Math.sin(u), c[2] + r * Math.sin(v)]); col.push(color);
        }
        propGrid(SU, SV, faces);
        return propMesh(pos, col, faces);
    }
    // the soap bubble: a unit sphere with soft rainbow colours (soap film)
    function generateSoapBubble() {
        var pos = [], col = [], faces = [], ST = 20, SE = 32;
        for (var i = 0; i <= ST; i++) for (var j = 0; j <= SE; j++) {
            var u = i / ST * Math.PI - Math.PI / 2, w = j / SE * 2 * Math.PI;
            var p = [Math.cos(u) * Math.cos(w), Math.sin(u), Math.cos(u) * Math.sin(w)];
            var h = 2.2 * p[1] + 1.3 * p[0] + 0.7 * p[2];
            pos.push(p); col.push([0.78 + 0.22 * Math.sin(h), 0.80 + 0.20 * Math.sin(h + 2.1), 0.86 + 0.14 * Math.sin(h + 4.2)]);
        }
        propGrid(ST, SE, faces);
        return propMesh(pos, col, faces);
    }

    return {
        // course shapes + ring surfaces
        generateBSpline,
        bsplineTable,
        generateEllipsoid,
        generateEllipticParaboloid,
        generateEllipticCone,
        generateTorus,
        generateRingSurface,
        shiftMesh,
        generateRingSurfaceFromPoints,
        shareNormals,
        orientMesh,
        // Poby's own shapes
        pobyBody,
        pobyHead,
        generateHeadLine,
        generatePobyEar,
        pobyArm,
        pobyPaw,
        // props (bubble wand story)
        generateCapsule,
        generateRing,
        generateSoapBubble,
        // helpers
        vec: { sub: sub, add: add, mul: mul, dot: dot, cross: cross, normalize: normalize, dist: dist },
        lookup,
        rigKey
    };
})();

// #####################################################################
//  LOOPY_BUILDERS
// #####################################################################
export const LOOPY_BUILDERS = (function () {
    // ============ UTIL ============
    // Setiap builder mengembalikan { vertices, faces } (belum dikirim ke GPU; makeMesh di main yang melakukannya).
    // Setiap vertex berisi 9 angka (interleave): posisi (x,y,z) + warna (r,g,b) + normal (nx,ny,nz).
    // Normal dihitung per-primitif (analitik atau numerik) supaya box & kerucut tetap bersudut tegas.
    function addVertex(v, p, n, c) {
        v.push(p[0], p[1], p[2], c[0], c[1], c[2], n[0], n[1], n[2]);
    }

    // Indeks segitiga untuk grid titik (rows+1) x (cols+1); tiap kotak grid = 2 segitiga.
    function grid(rows, cols, faces, offset) {
        offset = offset || 0;
        for (var r = 0; r < rows; r++)
            for (var c = 0; c < cols; c++) {
                var a = offset + r * (cols + 1) + c, b = a + cols + 1;
                faces.push(a, b, a + 1, b, b + 1, a + 1);
            }
    }

    function cross(a, b) {
        return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    }

    // Grid parametrik (phi 0..PI, theta 0..2PI) dengan normal NUMERIK:
    // 2 vektor singgung (turunan terhadap theta & phi) -> cross product = normal permukaan.
    function parametricSurface(surface, color, segments, rings, e, eps) {
        var v = [], f = [];
        for (var y = 0; y <= rings; y++) {
            var phi = Math.PI * (y / rings);
            for (var x = 0; x <= segments; x++) {
                var theta = 2.0 * Math.PI * (x / segments);
                var p = surface(phi, theta);
                var t1 = surface(phi, theta + e), t0 = surface(phi, theta - e);
                var f1 = surface(phi + e, theta), f0 = surface(phi - e, theta);
                var n = cross([t1[0] - t0[0], t1[1] - t0[1], t1[2] - t0[2]],
                              [f1[0] - f0[0], f1[1] - f0[1], f1[2] - f0[2]]);
                var nl = Math.hypot(n[0], n[1], n[2]);
                if (nl < eps) { n = [0, (p[1] >= 0 ? 1 : -1), 0]; nl = 1; }      // di kutub: normal vertikal
                if (n[0] * p[0] + n[1] * p[1] + n[2] * p[2] < 0) n = [-n[0], -n[1], -n[2]];   // hadap keluar
                addVertex(v, p, [n[0] / nl, n[1] / nl, n[2] / nl], color);
            }
        }
        grid(rings, segments, f);
        return { vertices: v, faces: f };
    }

    // ============ 1. ELLIPSOID ============
    //   x = rx sin(phi) cos(theta),  y = ry cos(phi),  z = rz sin(phi) sin(theta)
    // Normal = gradien (x/rx^2, y/ry^2, z/rz^2), dinormalkan.
    // Dipakai: telinga luar/dalam, mata, mulut, jambul, perut, telapak kaki, jari kaki.
    function generateEllipsoid(rx, ry, rz, color, segments, rings) {
        var v = [], f = [];
        for (var y = 0; y <= rings; y++) {
            var phi = Math.PI * (y / rings), sp = Math.sin(phi), cp = Math.cos(phi);
            for (var x = 0; x <= segments; x++) {
                var theta = 2.0 * Math.PI * (x / segments), st = Math.sin(theta), ct = Math.cos(theta);
                var px = rx * sp * ct, py = ry * cp, pz = rz * sp * st;
                var nx = px / (rx * rx), ny = py / (ry * ry), nz = pz / (rz * rz);
                var nl = Math.hypot(nx, ny, nz) || 1;
                addVertex(v, [px, py, pz], [nx / nl, ny / nl, nz / nl], color);
            }
        }
        grid(rings, segments, f);
        return { vertices: v, faces: f };
    }

    // ============ 2. BOX  (*** TIDAK DIPAKAI SAAT INI: gigi kini memakai rounded box ***) ============
    // hx, hy, hz = SETENGAH panjang sisi. 6 sisi terpisah (24 vertex) -> tiap sisi punya normal datar sendiri.
    function generateBox(hx, hy, hz, color) {
        var v = [], f = [];
        var sides = [
            { n: [ 1, 0, 0], v: [[ hx,-hy,-hz],[ hx, hy,-hz],[ hx, hy, hz],[ hx,-hy, hz]] }, // +X
            { n: [-1, 0, 0], v: [[-hx,-hy, hz],[-hx, hy, hz],[-hx, hy,-hz],[-hx,-hy,-hz]] }, // -X
            { n: [ 0, 1, 0], v: [[-hx, hy,-hz],[-hx, hy, hz],[ hx, hy, hz],[ hx, hy,-hz]] }, // +Y
            { n: [ 0,-1, 0], v: [[-hx,-hy, hz],[-hx,-hy,-hz],[ hx,-hy,-hz],[ hx,-hy, hz]] }, // -Y
            { n: [ 0, 0, 1], v: [[-hx,-hy, hz],[ hx,-hy, hz],[ hx, hy, hz],[-hx, hy, hz]] }, // +Z
            { n: [ 0, 0,-1], v: [[ hx,-hy,-hz],[-hx,-hy,-hz],[-hx, hy,-hz],[ hx, hy,-hz]] }  // -Z
        ];
        for (var s = 0; s < sides.length; s++) {
            var base = v.length / 9;
            for (var i = 0; i < 4; i++) addVertex(v, sides[s].v[i], sides[s].n, color);
            f.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
        return { vertices: v, faces: f };
    }

    // ============ 3. ROUNDED BOX (SUPERELLIPSOID) ============
    // Seperti ellipsoid, tapi sin/cos dipangkatkan 2/n. n = 2 -> ellipsoid; n besar -> makin kotak.
    // Dipakai: GIGI SERI. Normal numerik.
    function generateRoundedBox(rx, ry, rz, n, color, segments, rings) {
        var pw = 2.0 / n;
        function sp(x) { return (x < 0 ? -1 : 1) * Math.pow(Math.abs(x), pw); }
        return parametricSurface(function (phi, theta) {
            var s = Math.sin(phi);
            return [rx * sp(s) * sp(Math.cos(theta)), ry * sp(Math.cos(phi)), rz * sp(s) * sp(Math.sin(theta))];
        }, color, segments, rings, 0.002, 1e-12);
    }

    // ============ 4. PEAR BODY (BADAN) ============
    // Ellipsoid berbentuk buah pir: lebar (x,z) dikali f = 1 + widen * (-cos(phi)).
    //   phi = 0 (atas) -> 1 - widen (sempit),  phi = PI (bawah) -> 1 + widen (lebar). Normal numerik.
    function generatePearBody(rx, ry, rz, color, segments, rings, widen) {
        return parametricSurface(function (phi, theta) {
            var f = 1.0 + widen * (-Math.cos(phi));
            return [rx * f * Math.sin(phi) * Math.cos(theta), ry * Math.cos(phi), rz * f * Math.sin(phi) * Math.sin(theta)];
        }, color, segments, rings, 0.001, 1e-9);
    }

    // ============ 5. SHAPED HEAD (KEPALA LOOPY) ============
    // DUA SETENGAH ELLIPSOID disambung di garis terlebar (y = 0): kubah atas ryUp, dagu bawah ryDown.
    // Deformasi:
    //  a) widthFactor(dy): melebarkan bagian atas (topStart, topFull, topPower) + suku pipi gaussian (cheek).
    //  b) bulges: tonjolan Gaussian  k += amount * exp(-(1 - dot) / spread)  (dipakai = pipi chubby).
    // Normal numerik.
    function generateShapedHead(rx, ryUp, ryDown, rz, color, segments, rings, shape) {
        function widthFactor(dy) {
            var t = Math.max(0.0, (dy - shape.topStart) / (1.0 - shape.topStart));
            var k = (dy - shape.cheekY) / shape.cheekWidth;
            return 1.0 + shape.topFull * Math.pow(t, shape.topPower) + shape.cheek * Math.exp(-k * k);
        }
        var bulges = (shape.bulges || []).map(function (b) {
            var d = b.dir, dl = Math.hypot(d[0], d[1], d[2]) || 1;
            return { dir: [d[0] / dl, d[1] / dl, d[2] / dl], amount: b.amount, spread: b.spread };
        });
        return parametricSurface(function (phi, theta) {
            var dy = Math.cos(phi), dx = Math.sin(phi) * Math.cos(theta), dz = Math.sin(phi) * Math.sin(theta);
            var rho = Math.sin(phi) * widthFactor(dy), k = 1.0;
            for (var i = 0; i < bulges.length; i++) {
                var b = bulges[i], dot = dx * b.dir[0] + dy * b.dir[1] + dz * b.dir[2];
                k += b.amount * Math.exp(-(1.0 - dot) / b.spread);
            }
            var ry = (dy >= 0.0) ? ryUp : ryDown;
            return [rx * rho * Math.cos(theta) * k, ry * dy * k, rz * rho * Math.sin(theta) * k];
        }, color, segments, rings, 0.001, 1e-9);
    }

    // ============ 6. ELLIPTIC PARABOLOID (HIDUNG) ============
    // Puncak menghadap +z:  x = rx r cos(t),  y = ry r sin(t),  z = depth (1 - r^2),  r = 0..1
    // Normal dari gradien: (2 depth x / rx^2, 2 depth y / ry^2, 1).
    function generateEllipticParaboloid(rx, ry, depth, color, segments, rings) {
        var v = [], f = [];
        for (var r = 0; r <= rings; r++) {
            var radius = r / rings;
            for (var s = 0; s <= segments; s++) {
                var theta = 2 * Math.PI * s / segments;
                var x = rx * radius * Math.cos(theta), y = ry * radius * Math.sin(theta), z = depth * (1.0 - radius * radius);
                var nx = 2 * depth * x / (rx * rx), ny = 2 * depth * y / (ry * ry), nz = 1.0;
                var nl = Math.hypot(nx, ny, nz) || 1;
                addVertex(v, [x, y, z], [nx / nl, ny / nl, nz / nl], color);
            }
        }
        grid(rings, segments, f);
        return { vertices: v, faces: f };
    }

    // ============ 7. HYPERBOLOID 2 SHEET  (*** TIDAK DIPAKAI SAAT INI ***) ============
    //   y^2/c^2 - x^2/a^2 - z^2/b^2 = 1  ->  x = a sinh(u) cos(t),  y = c cosh(u),  z = b sinh(u) sin(t)
    // Tabung yang melebar di satu ujung; sisi bawah (y = 0) ditutup kipas segitiga.
    function generateHyperboloidTwoSheets(a, b, c, uMin, uMax, color, segments, rings) {
        var v = [], f = [], chMin = Math.cosh(uMin);
        for (var r = 0; r <= rings; r++) {
            var u = uMin + (uMax - uMin) * (r / rings), sh = Math.sinh(u), ch = Math.cosh(u);
            for (var s = 0; s <= segments; s++) {
                var theta = 2 * Math.PI * s / segments;
                var x = a * sh * Math.cos(theta), y = c * (ch - chMin), z = b * sh * Math.sin(theta);
                var nx = x / (a * a), ny = -ch / c, nz = z / (b * b);
                var nl = Math.hypot(nx, ny, nz) || 1;
                addVertex(v, [x, y, z], [nx / nl, ny / nl, nz / nl], color);
            }
        }
        grid(rings, segments, f);
        var center = v.length / 9;
        addVertex(v, [0, 0, 0], [0, -1, 0], color);
        for (var s2 = 0; s2 <= segments; s2++) {
            var th = 2 * Math.PI * s2 / segments;
            addVertex(v, [a * Math.sinh(uMin) * Math.cos(th), 0, b * Math.sinh(uMin) * Math.sin(th)], [0, -1, 0], color);
        }
        for (var s3 = 0; s3 < segments; s3++) f.push(center, center + 1 + s3 + 1, center + 1 + s3);
        return { vertices: v, faces: f };
    }

    // ============ 8. CYLINDER (sumbu Y)  (*** TIDAK DIPAKAI SAAT INI ***) ============
    // Radius atas & bawah boleh beda (kerucut terpotong). Dinding samping + 2 tutup lingkaran.
    function generateCylinder(radiusTop, radiusBottom, height, color, segments) {
        var v = [], f = [], half = height / 2, slope = (radiusBottom - radiusTop) / height;
        for (var r = 0; r <= 1; r++) {
            var y = half - r * height, rad = radiusTop + r * (radiusBottom - radiusTop);
            for (var s = 0; s <= segments; s++) {
                var theta = 2 * Math.PI * s / segments, ct = Math.cos(theta), st = Math.sin(theta);
                var nl = Math.hypot(ct, slope, st) || 1;
                addVertex(v, [rad * ct, y, rad * st], [ct / nl, slope / nl, st / nl], color);
            }
        }
        grid(1, segments, f);
        function cap(y, rad, ny, flip) {
            var center = v.length / 9;
            addVertex(v, [0, y, 0], [0, ny, 0], color);
            var ring0 = v.length / 9;
            for (var s = 0; s <= segments; s++) {
                var theta = 2 * Math.PI * s / segments;
                addVertex(v, [rad * Math.cos(theta), y, rad * Math.sin(theta)], [0, ny, 0], color);
            }
            for (var s3 = 0; s3 < segments; s3++) {
                if (flip) f.push(center, ring0 + s3 + 1, ring0 + s3);
                else      f.push(center, ring0 + s3, ring0 + s3 + 1);
            }
        }
        cap(half, radiusTop, 1, false);
        cap(-half, radiusBottom, -1, true);
        return { vertices: v, faces: f };
    }

    // ============ 9. CONE / KERUCUT (kuku tangan & kaki) ============
    // Alas di y = 0, puncak di y = height. Per-segmen segitiga (bukan grid) supaya puncak punya normal rapi.
    // Alas ditutup kipas segitiga.
    function generateCone(radius, height, color, segments) {
        var v = [], f = [], slopeN = radius / height;
        var unit = function (a) { var l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
        for (var s = 0; s < segments; s++) {
            var t0 = 2 * Math.PI * s / segments, t1 = 2 * Math.PI * (s + 1) / segments, tm = (t0 + t1) / 2;
            var base = v.length / 9;
            addVertex(v, [radius * Math.cos(t0), 0, radius * Math.sin(t0)], unit([Math.cos(t0), slopeN, Math.sin(t0)]), color);
            addVertex(v, [radius * Math.cos(t1), 0, radius * Math.sin(t1)], unit([Math.cos(t1), slopeN, Math.sin(t1)]), color);
            addVertex(v, [0, height, 0],                                    unit([Math.cos(tm), slopeN, Math.sin(tm)]), color);
            f.push(base, base + 1, base + 2);
        }
        var center = v.length / 9;
        addVertex(v, [0, 0, 0], [0, -1, 0], color);
        var ring0 = v.length / 9;
        for (var s2 = 0; s2 <= segments; s2++) {
            var th = 2 * Math.PI * s2 / segments;
            addVertex(v, [radius * Math.cos(th), 0, radius * Math.sin(th)], [0, -1, 0], color);
        }
        for (var s3 = 0; s3 < segments; s3++) f.push(center, ring0 + s3 + 1, ring0 + s3);
        return { vertices: v, faces: f };
    }

    // ============ 10. SWEPT TUBE (lengan, ekor, mata wink) ============
    //  1. Ambil titik di sepanjang kurva pathFn(t), t = 0..1.
    //  2. Di tiap titik: tangent (selisih titik sekitar t), lalu normal & binormal tegak lurus kurva.
    //  3. Penampang ELIPS: a sepanjang binormal, b sepanjang normal; radialFn(t) -> { a, b }.
    //  4. Sambung antar cincin, tutup kedua ujung (capStart / capEnd).
    // refVec = vektor acuan tetap supaya penampang tidak terpelintir
    // (default sumbu Y, pindah ke X bila tangent hampir vertikal).
    function generateSweptTube(pathFn, radialFn, color, lengthSegs, radialSegs, capStart, capEnd, refVec) {
        var v = [], f = [], e = 0.0015, rings = [];
        for (var i = 0; i <= lengthSegs; i++) {
            var t = i / lengthSegs, p = pathFn(t);
            var t1 = pathFn(Math.min(1, t + e)), t0 = pathFn(Math.max(0, t - e));
            var tan = [t1[0] - t0[0], t1[1] - t0[1], t1[2] - t0[2]];
            var tl = Math.hypot(tan[0], tan[1], tan[2]) || 1;
            tan = [tan[0] / tl, tan[1] / tl, tan[2] / tl];
            var ref = refVec || [0, 1, 0];
            if (!refVec && Math.abs(tan[1]) > 0.95) ref = [1, 0, 0];
            var dot = tan[0] * ref[0] + tan[1] * ref[1] + tan[2] * ref[2];
            var nor = [ref[0] - tan[0] * dot, ref[1] - tan[1] * dot, ref[2] - tan[2] * dot];
            var nl = Math.hypot(nor[0], nor[1], nor[2]) || 1;
            nor = [nor[0] / nl, nor[1] / nl, nor[2] / nl];
            rings.push({ p: p, n: nor, b: cross(tan, nor), r: radialFn(t), tan: tan });
        }
        for (var ri = 0; ri < rings.length; ri++) {
            var R = rings[ri], ra = R.r.a, rb = R.r.b;
            for (var s = 0; s <= radialSegs; s++) {
                var theta = 2 * Math.PI * s / radialSegs, ct = Math.cos(theta), st = Math.sin(theta);
                var ox = ra * ct, oy = rb * st;
                var x = R.p[0] + ox * R.b[0] + oy * R.n[0];
                var y = R.p[1] + ox * R.b[1] + oy * R.n[1];
                var z = R.p[2] + ox * R.b[2] + oy * R.n[2];
                var ia = ct / (ra || 1e-6), ib = st / (rb || 1e-6);        // normal elips di bidang penampang
                var nx = ia * R.b[0] + ib * R.n[0], ny = ia * R.b[1] + ib * R.n[1], nz = ia * R.b[2] + ib * R.n[2];
                var nl2 = Math.hypot(nx, ny, nz) || 1;
                addVertex(v, [x, y, z], [nx / nl2, ny / nl2, nz / nl2], color);
            }
        }
        grid(rings.length - 1, radialSegs, f);
        function capRing(ringIndex, flip) {
            var R = rings[ringIndex], base = ringIndex * (radialSegs + 1), center = v.length / 9, tn = R.tan;
            addVertex(v, R.p, flip ? [-tn[0], -tn[1], -tn[2]] : tn, color);
            for (var s3 = 0; s3 < radialSegs; s3++) {
                if (flip) f.push(center, base + s3 + 1, base + s3);
                else      f.push(center, base + s3, base + s3 + 1);
            }
        }
        if (capStart) capRing(0, true);
        if (capEnd)   capRing(rings.length - 1, false);
        return { vertices: v, faces: f };
    }

    // Kurva BEZIER KUADRATIK:  B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
    function bezier2(P0, P1, P2, t) {
        var u = 1 - t;
        return [u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0],
                u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1],
                u * u * P0[2] + 2 * u * t * P1[2] + t * t * P2[2]];
    }

    return {
        generateEllipsoid,
        generateBox,
        generateRoundedBox,
        generatePearBody,
        generateShapedHead,
        generateEllipticParaboloid,
        generateHyperboloidTwoSheets,
        generateCylinder,
        generateCone,
        generateSweptTube,
        bezier2
    };
})();
