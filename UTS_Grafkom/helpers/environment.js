import { EDDY_BUILDERS as B } from "./builders.js";

/* =====================================================================
   SKALA DUNIA (acuan: tinggi boneka resmi Pororo & kawan-kawan)
     Eddy  34 cm  = 5.25 unit  (terukur dari model, termasuk telinga)
     Poby  44 cm  = 6.80 unit  (target tinggi model Poby)
     Loopy 27 cm  = 4.17 unit  (target tinggi model Loopy)
   => 1 cm = 0.1545 unit.  "E" = 1 tinggi Eddy = 5.25 unit.
   Properti dibuat dalam kelipatan E supaya terasa realistis:
     pohon 5-7 E, igloo ~5 E lebar dengan pintu lebih tinggi dari Poby, gunung puluhan E.
   Lapangan tengah (x -14..14, z -8..8) dikosongkan untuk ketiga karakter.
   ===================================================================== */
export var WORLD_SCALE = { UNIT_PER_CM: 0.1545, EDDY: 5.25, POBY: 6.8, LOOPY: 4.17 };

// G = tinggi permukaan tanah (telapak kaki Eddy = -2.57)
export function buildEnvironment(part, root, G) {
    var GROUND = [1.0, 1.05, 1.12], SNOW = [1.12, 1.16, 1.22], SNOW2 = [0.86, 0.92, 0.99], ICE = [0.66, 0.86, 0.96];
    var GREEN = [0.10, 0.40, 0.27], BROWN = [0.38, 0.25, 0.15], ROCK = [0.50, 0.60, 0.78];
    var id = 0, nm = function (s) { return s + (id++); }, rad = function (d) { return d * Math.PI / 180; };

    /* ---------- TANAH: ellipsoid raksasa, di sekitar karakter hampir rata ---------- */
    var GA = 700, GB = 40, GC = 700;
    function groundY(x, z) {
        return G - GB + GB * Math.sqrt(Math.max(1 - Math.pow(x / GA, 2) - Math.pow(z / GC, 2), 0));
    }
    part(root, "Ground", B.generateEllipsoid(GA, GB, GC, 96, 96, GROUND), [0, G - GB, 0]);

    /* ---------- GUNUNG BERSALJU (kerucut raksasa, 15-30 E, jauh di belakang) ---------- */
    var mountain = function (t) {
        var k = Math.min(Math.max((t - 0.5) / 0.15, 0), 1);
        return [ROCK[0] + (1 - ROCK[0]) * k, ROCK[1] + (1 - ROCK[1]) * k, ROCK[2] + (1 - ROCK[2]) * k];
    };
    [[-190, -420, 135, 100], [35, -490, 170, 130], [240, -410, 115, 88],
     [-390, -470, 140, 105], [430, -520, 140, 105], [-60, -600, 110, 95]
    ].forEach(function (m) {
        part(root, nm("Mountain"), B.generateCone(m[3], m[2], 48, 12, mountain), [m[0], groundY(m[0], m[1]) - 2, m[1]]);
    });

    /* ---------- AWAN ---------- */
    [[-130, 75, -320], [150, 95, -360], [10, 110, -420]].forEach(function (c) {
        var cl = part(root, nm("Cloud"), null, c);
        part(cl, nm("Puff"), B.generateEllipsoid(26, 8, 11, 24, 24, [1, 1, 1]), [0, 0, 0]);
        part(cl, nm("Puff"), B.generateEllipsoid(16, 9, 10, 24, 24, [1, 1, 1]), [-14, 3.5, 1]);
        part(cl, nm("Puff"), B.generateEllipsoid(18, 7, 10, 24, 24, [1, 1, 1]), [15, 2.5, 1]);
    });

    /* ---------- POHON CEMARA (5-7 E): 3 kerucut bertumpuk, puncak tertutup salju ---------- */
    var pineColor = function (t) {
        var k = Math.min(Math.max((t - 0.2) / 0.35, 0), 1); k = k * k * (3 - 2 * k);
        return [GREEN[0] + (SNOW[0] - GREEN[0]) * k, GREEN[1] + (SNOW[1] - GREEN[1]) * k, GREEN[2] + (SNOW[2] - GREEN[2]) * k];
    };
    function pine(x, z, s) {                       // tinggi pohon = 3.95 * s
        var g = part(root, nm("Pine"), null, [x, groundY(x, z) - 0.3, z]);
        part(g, nm("Trunk"), B.generateCylinder(0.22 * s, 0.18 * s, 1.0 * s, 12, BROWN), [0, 0.5 * s, 0]);
        [[1.7, 2.0, 0.7], [1.35, 1.8, 1.55], [0.95, 1.6, 2.35]].forEach(function (t) {
            part(g, nm("Tier"), B.generateCone(t[0] * s, t[1] * s, 32, 6, pineColor), [0, t[2] * s, 0]);
        });
    }
    [   // lapisan dekat (menjulang di samping lapangan)
        [-36, -38, 6.4], [-56, -60, 7.0], [28, -64, 6.8], [74, -46, 7.0], [60, -74, 6.4],
        [-96, -36, 7.0], [-118, -70, 8.0], [104, -30, 6.8], [128, -66, 8.0],
        // barisan belakang
        [-150, -100, 8.4], [-118, -108, 7.5], [-84, -104, 9.0], [-34, -100, 7.8], [-8, -114, 8.4],
        [ 6, -96, 7.2], [ 40, -112, 9.0], [ 88, -108, 8.0], [ 150, -100, 8.4], [ 176, -90, 7.4]
    ].forEach(function (p) { pine(p[0], p[1], p[2]); });

    /* ---------- IGLOO BESAR: lebar ~5 E, pintu 7.4 unit > tinggi Poby (6.8) ---------- */
    var ig = part(root, "Igloo", null, [46, groundY(46, -42), -42], [0, rad(-22), 0]);
    part(ig, "IglooDome", B.generateEllipsoid(14, 12, 14, 48, 48, SNOW2), [0, 0, 0]);
    part(ig, "IglooTunnel", B.generateEllipsoid(6.5, 8.5, 6.5, 36, 36, SNOW2), [0, 0, 12.5]);
    part(ig, "IglooDoor", B.generateEllipsoid(4.0, 7.4, 1.8, 28, 28, [0.12, 0.16, 0.30]), [0, 0.4, 18.4]);

    /* ---------- DANAU BEKU ---------- */
    part(root, "PondRim", B.generateEllipsoid(27, 0.7, 17.5, 48, 48, SNOW), [-74, groundY(-74, -28), -28]);
    part(root, "Pond", B.generateEllipsoid(24, 0.8, 15, 48, 48, ICE), [-74, groundY(-74, -28) + 0.35, -28]);

    /* ---------- MANUSIA SALJU: 1.4 E (tinggi ~7.5 unit), skala k = 2.8 ---------- */
    var k = 2.8, sx = -22, sz = -14;
    var sm = part(root, "Snowman", null, [sx, groundY(sx, sz), sz], [0, rad(28), 0]);
    part(sm, "SnowmanBottom", B.generateEllipsoid(0.78 * k, 0.72 * k, 0.78 * k, 32, 32, SNOW), [0, 0.6 * k, 0]);
    part(sm, "SnowmanMiddle", B.generateEllipsoid(0.56 * k, 0.52 * k, 0.56 * k, 28, 28, SNOW), [0, 1.55 * k, 0]);
    var sh = part(sm, "SnowmanHead", B.generateEllipsoid(0.42 * k, 0.40 * k, 0.42 * k, 28, 28, SNOW), [0, 2.28 * k, 0]);
    part(sh, "SnowmanScarf", B.generateCylinder(0.34 * k, 0.34 * k, 0.14 * k, 24, [0.82, 0.16, 0.16]), [0, -0.38 * k, 0]);
    part(sh, "SnowmanNose", B.generateCone(0.07 * k, 0.34 * k, 12, 3, function () { return [0.95, 0.45, 0.08]; }),
        [0, -0.02 * k, 0.38 * k], [rad(90), 0, 0]);
    [-1, 1].forEach(function (s) {
        part(sh, nm("SnowmanEye"), B.generateEllipsoid(0.05 * k, 0.05 * k, 0.04 * k, 10, 10, [0.06, 0.06, 0.06]), [s * 0.15 * k, 0.12 * k, 0.37 * k]);
    });
    [0, 1].forEach(function (i) {
        part(sm, nm("SnowmanButton"), B.generateEllipsoid(0.05 * k, 0.05 * k, 0.04 * k, 10, 10, [0.06, 0.06, 0.06]), [0, (1.7 - i * 0.28) * k, 0.54 * k]);
    });

    /* ---------- GUNDUKAN & BOLA SALJU DI TEPI LAPANGAN ---------- */
    [[-30, -8, 8, 3.2, 5.5], [32, -10, 7, 2.8, 5], [16, -26, 6, 2.4, 4.5]].forEach(function (m) {
        part(root, nm("Mound"), B.generateEllipsoid(m[2], m[3], m[4], 28, 28, SNOW), [m[0], groundY(m[0], m[1]) - 0.5, m[1]]);
    });
    [[-18, -6, 1.7], [-15, -3, 1.0], [20, -4, 1.9], [17, 0, 1.0]].forEach(function (b) {
        part(root, nm("Snowball"), B.generateEllipsoid(b[2], b[2], b[2], 16, 16, SNOW), [b[0], groundY(b[0], b[1]) + b[2] * 0.6, b[1]]);
    });
}
