import { LIBS } from "./libs.js";

/* =====================================================================
   environment.js — TAMAN PIKNIK (picnic park), seperti referensi Pororo
   "A Camping Adventure": rumput hijau cerah, pohon-pohon rindang berdaun
   lebat, jalan tanah, semak, bunga-bunga kecil, langit biru dengan awan,
   dan gunung biru kehijauan di kejauhan. Di tengah ada TIKAR PIKNIK
   kotak-kotak merah-putih dengan keranjang, piring, roti lapis, buah dan
   minuman.

   SKALA (sama seperti sebelumnya): 1 cm = 0.1545 unit.
     Eddy 34 cm = 5.25 unit, Poby 44 cm = 6.80 unit, Loopy 27 cm = 4.17 unit.
     "E" = 1 tinggi Eddy. Pohon ±4-5 E (≈ 22-27 unit), awan & gunung jauh.

   TATA LETAK (kamera awal melihat ke -Z, karakter berdiri di z ≈ 0):
     karakter          x -6..6,  z ≈ 0          (dibiarkan kosong)
     tikar piknik      x -7..7,  z -2.4..-8.6   (tepat di belakang karakter,
                                                 Poby animasi 2 mulai di tepinya)
     jalan tanah       melengkung kiri-kanan di z ≈ -17
     pohon             mengelilingi lapangan, paling rapat di belakang
     gunung & awan     jauh di belakang (awan bergerak pelan: updateEnvironment)

   buildEnvironment(part, root, G) — sama seperti versi lama.
   updateEnvironment(t)            — BARU: awan bergeser pelan (t = detik).
   ===================================================================== */
export var WORLD_SCALE = { UNIT_PER_CM: 0.1545, EDDY: 5.25, POBY: 6.8, LOOPY: 4.17 };

// ---------------------------------------------------------------------
//  small mesh toolkit — every mesh = { vertices: [x,y,z, r,g,b, nx,ny,nz, ...], faces }
// ---------------------------------------------------------------------
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
function mixc(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
function tint(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
function clamp01(x) { return Math.min(Math.max(x, 0), 1); }
function sstep(a, b, x) { var t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); }

// smooth normals from positions (shared positions get the same normal)
function finish(pos, col, faces) {
    var nr = pos.map(function () { return [0, 0, 0]; }), key = {}, keys = pos.map(function (p) {
        return Math.round(p[0] * 500) + "," + Math.round(p[1] * 500) + "," + Math.round(p[2] * 500);
    });
    for (var f = 0; f < faces.length; f += 3) {
        var a = pos[faces[f]], b = pos[faces[f + 1]], c = pos[faces[f + 2]];
        var fn = cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]);
        [faces[f], faces[f + 1], faces[f + 2]].forEach(function (i) {
            var k = keys[i]; if (!key[k]) key[k] = [0, 0, 0];
            key[k][0] += fn[0]; key[k][1] += fn[1]; key[k][2] += fn[2];
        });
    }
    var v = [];
    pos.forEach(function (p, i) { var q = norm(key[keys[i]] || [0, 1, 0]); v.push(p[0], p[1], p[2], col[i][0], col[i][1], col[i][2], q[0], q[1], q[2]); });
    return { vertices: v, faces: faces };
}
function gridFaces(rows, cols, faces, off) {
    for (var i = 0; i < rows; i++) for (var j = 0; j < cols; j++) {
        var p = off + i * (cols + 1) + j, q = p + cols + 1;
        faces.push(p, p + 1, q + 1, p, q + 1, q);
    }
}
// ellipsoid; colorFn(xn, yn, zn) or a fixed colour; lumps = gentle bumpiness (leafy canopies)
function ellipsoid(a, b, c, st, se, color, lumps) {
    var pos = [], col = [], faces = [];
    for (var i = 0; i <= st; i++) for (var j = 0; j <= se; j++) {
        var u = i / st * Math.PI - Math.PI / 2, w = j / se * 2 * Math.PI;
        var xn = Math.cos(u) * Math.cos(w), yn = Math.sin(u), zn = Math.cos(u) * Math.sin(w);
        var k = 1;
        if (lumps) k = 1 + lumps * (Math.sin(5 * xn + 2 * zn) * Math.sin(4 * yn + 1) + 0.6 * Math.sin(9 * zn + 3 * yn) * Math.sin(7 * xn));
        if (j === se) { pos.push(pos[pos.length - se].slice()); col.push(col[col.length - se]); continue; }   // close the seam exactly
        pos.push([a * xn * k, b * yn * k, c * zn * k]);
        col.push(typeof color === "function" ? color(xn, yn, zn) : color);
    }
    gridFaces(st, se, faces, 0);
    return finish(pos, col, faces);
}
// tapered cylinder along +Y from 0 to h, with caps; colorFn(t) t = 0 bottom .. 1 top
function cylinder(r0, r1, h, seg, color, noCaps) {
    var pos = [], col = [], faces = [], ST = 4;
    for (var i = 0; i <= ST; i++) for (var j = 0; j <= seg; j++) {
        var t = i / ST, r = r0 + (r1 - r0) * t, a = j / seg * 2 * Math.PI;
        pos.push([r * Math.cos(a), h * t, r * Math.sin(a)]); col.push(typeof color === "function" ? color(t, a) : color);
    }
    gridFaces(ST, seg, faces, 0);
    if (!noCaps) [[0, r0, 0], [h, r1, 1]].forEach(function (cp) {
        var c0 = pos.length, cc = typeof color === "function" ? color(cp[2], 0) : color;
        pos.push([0, cp[0], 0]); col.push(cc);
        for (var j = 0; j <= seg; j++) { var a = j / seg * 2 * Math.PI; pos.push([cp[1] * Math.cos(a), cp[0], cp[1] * Math.sin(a)]); col.push(cc); }
        for (var j = 0; j < seg; j++) { if (cp[2]) faces.push(c0, c0 + 2 + j, c0 + 1 + j); else faces.push(c0, c0 + 1 + j, c0 + 2 + j); }
    });
    return finish(pos, col, faces);
}
// box (full sizes), flat-ish shading through its own corners
function box(w, h, d, color) {
    var pos = [], col = [], faces = [], x = w / 2, y = h / 2, z = d / 2;
    var F = [[[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]],
             [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]], [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]],
             [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]]];
    var v = [];
    F.forEach(function (q) {
        var o = v.length / 9, n = norm(cross([q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]], [q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2]]));
        q.forEach(function (p) { v.push(p[0], p[1], p[2], color[0], color[1], color[2], n[0], n[1], n[2]); });
        faces.push(o, o + 1, o + 2, o, o + 2, o + 3);
    });
    return { vertices: v, faces: faces };
}
// torus in the XY plane (axis Z); arc = how much of the ring (2π = full)
function torus(R, r, color, arc) {
    var pos = [], col = [], faces = [], SU = 32, SV = 10; arc = arc || 2 * Math.PI;
    for (var i = 0; i <= SU; i++) for (var j = 0; j <= SV; j++) {
        var u = i / SU * arc, v = j / SV * 2 * Math.PI, k = R + r * Math.cos(v);
        pos.push([k * Math.cos(u), k * Math.sin(u), r * Math.sin(v)]); col.push(color);
    }
    gridFaces(SU, SV, faces, 0);
    return finish(pos, col, faces);
}
// cone along +Y (base radius r at y = 0, tip at y = h); colorFn(t)
function cone(r, h, seg, colorFn) {
    var pos = [], col = [], faces = [];
    for (var i = 0; i <= 1; i++) for (var j = 0; j <= seg; j++) {
        var a = j / seg * 2 * Math.PI, rr = i ? 0.0001 : r;
        pos.push([rr * Math.cos(a), i * h, rr * Math.sin(a)]); col.push(colorFn(i));
    }
    gridFaces(1, seg, faces, 0);
    return finish(pos, col, faces);
}
// combine many pieces into ONE mesh: items = [[geo, pos, rot, scale], ...]  (fewer draw calls)
function merge(items) {
    var v = [], f = [];
    items.forEach(function (it) {
        var M = LIBS.compose(it[1] || [0, 0, 0], it[2] || [0, 0, 0], it[3]), g = it[0], base = v.length / 9;
        for (var i = 0; i < g.vertices.length; i += 9) {
            var x = g.vertices[i], y = g.vertices[i + 1], z = g.vertices[i + 2], a = g.vertices[i + 6], b = g.vertices[i + 7], c = g.vertices[i + 8];
            var n = norm([M[0] * a + M[4] * b + M[8] * c, M[1] * a + M[5] * b + M[9] * c, M[2] * a + M[6] * b + M[10] * c]);
            v.push(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14],
                   g.vertices[i + 3], g.vertices[i + 4], g.vertices[i + 5], n[0], n[1], n[2]);
        }
        for (var k = 0; k < g.faces.length; k++) f.push(g.faces[k] + base);
    });
    if (v.length / 9 > 65535) console.warn("environment merge: more than 65535 vertices");
    return { vertices: v, faces: f };
}
// split a long list of items into several merged meshes (each < 65535 vertices)
function mergeChunks(items) {
    var out = [], cur = [], n = 0;
    items.forEach(function (it) {
        var k = it[0].vertices.length / 9;
        if (n + k > 60000 && cur.length) { out.push(merge(cur)); cur = []; n = 0; }
        cur.push(it); n += k;
    });
    if (cur.length) out.push(merge(cur));
    return out;
}
// deterministic random numbers (the park looks the same every time)
function rng(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// clouds are moved by updateEnvironment(t)
var CLOUDS = [];

// =====================================================================
export function buildEnvironment(part, root, G) {
    var R = rng(20261108), rad = function (d) { return d * Math.PI / 180; };
    var id = 0, nm = function (s) { return s + "_" + (id++); };

    // ---------- colours (from the reference) ----------
    var GRASS = [0.38, 0.72, 0.18], GRASS_L = [0.55, 0.83, 0.26], GRASS_D = [0.24, 0.55, 0.13];
    var DIRT = [0.80, 0.67, 0.47], DIRT_D = [0.70, 0.56, 0.38];
    var LEAF = [0.22, 0.55, 0.14], LEAF_L = [0.45, 0.75, 0.22], LEAF_D = [0.12, 0.36, 0.09];
    var BARK = [0.42, 0.28, 0.17], BARK_D = [0.30, 0.19, 0.11];
    var BUSH = [0.16, 0.42, 0.12], BUSH_L = [0.30, 0.58, 0.18];
    var HILL = [0.40, 0.58, 0.55], HILL_D = [0.30, 0.47, 0.47];

    /* ---------- GROUND: a huge, almost flat ellipsoid of grass with soft patches ---------- */
    var GA = 700, GB = 40, GC = 700;
    function groundY(x, z) { return G - GB + GB * Math.sqrt(Math.max(1 - Math.pow(x / GA, 2) - Math.pow(z / GC, 2), 0)); }
    function grassColour(x, z) {
        var n = Math.sin(x * 0.11 + 1.3) * Math.sin(z * 0.09 + 0.4) + 0.6 * Math.sin(x * 0.27 - z * 0.21) + 0.35 * Math.sin(x * 0.6 + z * 0.5);
        var k = 0.5 + 0.28 * n;
        return k > 0.5 ? mixc(GRASS, GRASS_L, (k - 0.5) * 1.6) : mixc(GRASS_D, GRASS, k * 2);
    }
    part(root, "Ground", ellipsoid(GA, GB, GC, 140, 140, function (xn, yn, zn) {
        return yn > 0.5 ? grassColour(xn * GA, zn * GC) : GRASS_D;
    }), [0, G - GB, 0]);

    /* ---------- DIRT PATH: a winding ribbon behind the picnic ---------- */
    function pathZ(x) { return -17 + 3.2 * Math.sin(x / 21) + 1.5 * Math.sin(x / 9 + 1); }
    (function () {
        var pos = [], col = [], faces = [], N = 260, ACROSS = [-1.25, -0.85, -0.55, 0, 0.55, 0.85, 1.25];
        for (var i = 0; i <= N; i++) {
            var x = -130 + 260 * i / N, z = pathZ(x), dz = (pathZ(x + 0.5) - pathZ(x - 0.5)), t = norm([-dz, 0, 1]);
            var w = 2.6 + 0.5 * Math.sin(x / 7);                       // half width varies a little
            ACROSS.forEach(function (s) {
                var px = x + t[0] * w * s, pz = z + t[2] * w * s, edge = sstep(0.6, 1.25, Math.abs(s));
                var c = mixc(mixc(DIRT, DIRT_D, 0.5 + 0.5 * Math.sin(px * 1.3 + pz * 0.7)), grassColour(px, pz), edge);
                pos.push([px, groundY(px, pz) + 0.04 - 0.03 * edge, pz]); col.push(c);
            });
        }
        gridFaces(N, ACROSS.length - 1, faces, 0);
        part(root, "DirtPath", finish(pos, col, faces), [0, 0, 0]);
    })();

    /* ---------- TREES: big broadleaf trees with lumpy, leafy canopies ---------- */
    function leafColour(seed) {
        return function (xn, yn, zn) {
            var spot = 0.5 + 0.5 * Math.sin(13 * xn + seed) * Math.sin(11 * yn + 2 * seed) * Math.sin(9 * zn + seed * 3);
            var light = clamp01(0.5 + 0.55 * yn + 0.2 * xn);           // light from the top
            var c = mixc(LEAF_D, LEAF, sstep(0, 0.55, light));
            c = mixc(c, LEAF_L, sstep(0.55, 1, light) * 0.8);
            return tint(c, 0.86 + 0.24 * spot);
        };
    }
    function tree(x, z, s, detail) {
        var y = groundY(x, z), items = [], H = 9.5 * s, lean = (R() - 0.5) * 0.12;
        var barkFn = function (t, a) { return tint(mixc(BARK_D, BARK, 0.5 + 0.5 * Math.sin(a * 7 + t * 9)), 0.92 + 0.12 * t); };
        // trunk with a flared base and 2-3 branches
        items.push([cylinder(1.05 * s, 0.62 * s, H, 14, barkFn), [0, 0, 0], [0, 0, lean]]);
        items.push([cone(1.9 * s, 2.2 * s, 14, function () { return BARK_D; }), [0, -0.05, 0]]);
        var nb = 2 + Math.floor(R() * 2);
        for (var b = 0; b < nb; b++) {
            var ang = b / nb * 2 * Math.PI + R(), tilt = rad(35 + R() * 20);
            items.push([cylinder(0.45 * s, 0.25 * s, 5.2 * s, 10, barkFn), [Math.sin(lean) * -H * 0.6, H * (0.62 + 0.1 * R()), 0], [tilt * Math.cos(ang), ang, tilt * Math.sin(ang)]]);
        }
        // canopy: 7-10 overlapping lumpy blobs
        var nBlob = detail ? 7 + Math.floor(R() * 4) : 5, cy = H + 3.0 * s;
        for (var k = 0; k < nBlob; k++) {
            var a = R() * 2 * Math.PI, rr = (k === 0 ? 0 : 3.2 + 2.6 * R()) * s;
            var r0 = (4.2 + 1.8 * R()) * s;
            var st = detail ? 18 : 12, se = detail ? 24 : 16;
            items.push([ellipsoid(r0, r0 * (0.78 + 0.15 * R()), r0, st, se, leafColour(R() * 10), 0.06),
                        [Math.cos(a) * rr - Math.sin(lean) * H, cy + (R() - 0.3) * 3.2 * s + (k === 0 ? 1.5 * s : 0), Math.sin(a) * rr]]);
        }
        part(root, nm("Tree"), merge(items), [x, y - 0.2, z], [0, R() * 6.28, 0]);
    }
    var TREES = [
        // behind the picnic (closest, biggest)
        [-30, -38, 1.1], [-6, -46, 1.2], [18, -40, 1.15], [38, -33, 1.1], [-44, -40, 1.25], [50, -42, 1.2],
        [-14, -58, 1.3], [24, -60, 1.35], [-34, -66, 1.2], [4, -72, 1.4], [44, -70, 1.25], [-62, -58, 1.3], [68, -55, 1.3],
        // sides
        [-48, -12, 1.15], [-60, 10, 1.25], [52, -10, 1.15], [64, 12, 1.2], [-80, -20, 1.3], [84, -24, 1.3],
        // in front, out to the sides (seen when the camera turns)
        [-46, 42, 1.2], [44, 46, 1.25], [-14, 70, 1.3], [20, 76, 1.3], [-70, 62, 1.25], [72, 60, 1.3]
    ];
    TREES.forEach(function (t) { tree(t[0], t[1], t[2], true); });
    // a far ring of simpler trees, so the park feels like a forest edge all around
    for (var i = 0; i < 26; i++) {
        var a = i / 26 * 2 * Math.PI + R() * 0.15, d = 105 + R() * 35;
        tree(Math.sin(a) * d, -Math.cos(a) * d, 1.3 + R() * 0.4, false);
    }

    /* ---------- BUSHES: round, dark-green clumps ---------- */
    var bushItems = [];
    function bush(x, z, s) {
        var y = groundY(x, z), n = 3 + Math.floor(R() * 3);
        for (var k = 0; k < n; k++) {
            var a = R() * 6.28, d = (k ? 1.2 + R() * 1.2 : 0) * s, r = (1.4 + R() * 0.8) * s;
            bushItems.push([ellipsoid(r, r * 0.8, r, 12, 16, function (xn, yn, zn) {
                return tint(mixc(BUSH, BUSH_L, clamp01(0.4 + 0.6 * yn)), 0.88 + 0.2 * (0.5 + 0.5 * Math.sin(17 * xn) * Math.sin(13 * zn)));
            }, 0.08), [x + Math.cos(a) * d, y + r * 0.45, z + Math.sin(a) * d]]);
        }
    }
    [[-18, -12, 1.2], [-11, -22, 1.0], [9, -21, 1.1], [19, -12, 1.3], [-30, -20, 1.4], [30, -21, 1.2], [-22, 8, 1.0],
     [23, 9, 1.1], [-38, -2, 1.3], [40, 0, 1.2], [0, -26, 1.0], [-52, -28, 1.4], [55, -32, 1.3], [-32, 26, 1.2], [34, 28, 1.3]]
        .forEach(function (b) { bush(b[0], b[1], b[2]); });
    mergeChunks(bushItems).forEach(function (m) { part(root, nm("Bushes"), m, [0, 0, 0]); });

    /* ---------- FLOWERS: little white / pink / yellow clusters ---------- */
    var flowerItems = [], PETAL = [[1, 1, 1], [1, 0.72, 0.84], [1, 0.95, 0.55], [0.85, 0.75, 1]];
    function flower(x, z, s, c) {
        var y = groundY(x, z) + 0.08 * s;
        for (var p = 0; p < 5; p++) {
            var a = p / 5 * 2 * Math.PI;
            flowerItems.push([ellipsoid(0.16 * s, 0.035 * s, 0.09 * s, 5, 8, c), [x + Math.cos(a) * 0.13 * s, y + 0.25 * s, z + Math.sin(a) * 0.13 * s], [0, -a, 0]]);
        }
        flowerItems.push([ellipsoid(0.07 * s, 0.05 * s, 0.07 * s, 5, 8, [1, 0.8, 0.2]), [x, y + 0.27 * s, z]]);
        flowerItems.push([cylinder(0.025 * s, 0.02 * s, 0.25 * s, 4, GRASS_D, true), [x, y, z]]);
    }
    function patch(cx, cz, n, spread) {
        var c = PETAL[Math.floor(R() * PETAL.length)];
        for (var i = 0; i < n; i++) flower(cx + (R() - 0.5) * spread, cz + (R() - 0.5) * spread * 0.6, 1.4 + R() * 0.8, R() < 0.25 ? PETAL[Math.floor(R() * 4)] : c);
    }
    [[-12, -12], [-3, -12.5], [7, -12], [15, -6], [-16, -4], [-9, 6], [10, 7], [-24, -14], [26, -16],
     [-6, -21], [12, -22], [-20, 14], [18, 15], [-34, -9], [36, -8], [3, 12], [-28, 4], [28, 3]]
        .forEach(function (p) { patch(p[0], p[1], 7 + Math.floor(R() * 5), 3.5); });
    mergeChunks(flowerItems).forEach(function (m) { part(root, nm("Flowers"), m, [0, 0, 0]); });

    /* ---------- GRASS TUFTS: small blade clumps near the picnic ---------- */
    var tuftItems = [], blade = cone(0.12, 1, 3, function (t) { return t ? GRASS_L : GRASS_D; });
    for (var i = 0; i < 520; i++) {
        var a = R() * 6.28, d = 6 + Math.pow(R(), 0.7) * 48, x = Math.sin(a) * d, z = -Math.cos(a) * d * 0.9 - 3;
        if (Math.abs(z - pathZ(x)) < 3.2) continue;                              // not on the path
        if (Math.abs(x) < 8 && z > -9.5 && z < 3) continue;                     // not on the mat / where the characters stand
        var y = groundY(x, z), h = 0.7 + R() * 0.7;
        for (var b = 0; b < 5; b++) tuftItems.push([blade, [x + (R() - 0.5) * 0.5, y, z + (R() - 0.5) * 0.5], [(R() - 0.5) * 0.7, R() * 6.28, (R() - 0.5) * 0.7], [1, h, 1]]);
    }
    mergeChunks(tuftItems).forEach(function (m) { part(root, nm("GrassTufts"), m, [0, 0, 0]); });

    /* ---------- HILLS & MOUNTAINS far away (soft blue-green, the fog lightens them) ---------- */
    [[-260, -420, 150, 70, 1.0], [-40, -500, 190, 95, 0.95], [210, -430, 160, 80, 1.05], [420, -480, 170, 85, 1.0],
     [-460, -440, 160, 75, 0.95], [60, -380, 110, 45, 1.1], [-150, -350, 120, 40, 1.08]]
        .forEach(function (m) {
            part(root, nm("Mountain"), ellipsoid(m[2], m[3], m[2] * 0.6, 24, 40, function (xn, yn, zn) {
                return tint(mixc(HILL_D, HILL, clamp01(0.4 + 0.6 * yn)), m[4] * (0.92 + 0.1 * Math.sin(7 * xn + 3 * zn)));
            }, 0.04), [m[0], groundY(m[0], m[1]) - m[3] * 0.25, m[1]]);
        });

    /* ---------- CLOUDS (fluffy; they drift slowly, see updateEnvironment) ---------- */
    CLOUDS.length = 0;
    [[-150, 85, -330, 1.0], [60, 100, -380, 1.25], [230, 80, -340, 0.9], [-330, 95, -360, 1.1], [-20, 120, -460, 1.4],
     [380, 110, -420, 1.15], [150, 70, -260, 0.75], [-240, 70, -270, 0.8]].forEach(function (c, i) {
        var s = c[3], items = [];
        [[0, 0, 0, 26, 12], [-20, -2, 2, 18, 9], [21, -3, 1, 19, 9], [-8, 7, -1, 16, 10], [10, 6, 0, 15, 9], [-30, -5, 0, 11, 6]]
            .forEach(function (p) {
                items.push([ellipsoid(p[3] * s, p[4] * s, p[3] * 0.6 * s, 12, 20, function (xn, yn) {
                    return mixc([0.86, 0.90, 0.97], [1.06, 1.08, 1.12], clamp01(0.45 + 0.6 * yn));
                }), [p[0] * s, p[1] * s, p[2] * s]]);
            });
        var node = part(root, nm("Cloud"), merge(items), [c[0], c[1], c[2]]);
        CLOUDS.push({ node: node, x0: c[0], speed: 1.2 + 0.5 * (i % 3) });
    });

    /* =================================================================
       PICNIC: checkered mat + basket, plates, sandwiches, fruit, drinks
       ================================================================= */
    var MAT = { cx: 0, cz: -5.5, w: 14, d: 6.2, n: 14, m: 6 };
    var RED = [0.86, 0.20, 0.20], CREAM = [0.98, 0.95, 0.88];
    (function () {
        // one mesh: every square its own colour; a soft wave in the cloth; slightly lifted above the grass
        var pos = [], col = [], faces = [], SUB = 3, NX = MAT.n * SUB, NZ = MAT.m * SUB;
        for (var i = 0; i <= NX; i++) for (var j = 0; j <= NZ; j++) {
            var u = i / NX, v = j / NZ, x = MAT.cx - MAT.w / 2 + MAT.w * u, z = MAT.cz - MAT.d / 2 + MAT.d * v;
            var y = groundY(x, z) + 0.05 + 0.04 * Math.sin(u * 9 + 1) * Math.sin(v * 7);
            pos.push([x, y, z]); col.push(CREAM);
        }
        for (var i = 0; i < NX; i++) for (var j = 0; j < NZ; j++) {
            var cx = Math.floor(i / SUB), cz = Math.floor(j / SUB);
            var c = (cx + cz) % 2 ? RED : CREAM;
            var o = pos.length;                                   // own vertices per cell -> crisp squares
            [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].forEach(function (q) { pos.push(pos[q[0] * (NZ + 1) + q[1]].slice()); col.push(c); });
            faces.push(o, o + 2, o + 1, o, o + 3, o + 2);
        }
        var mesh = finish(pos, col, faces);
        part(root, "PicnicMat", mesh, [0, 0, 0]);
    })();
    var MY = groundY(MAT.cx, MAT.cz) + 0.1;                       // top of the mat

    var picnic = [];
    // wicker basket with a lid and a handle
    (function () {
        var bx = 2.6, bz = -6.9, WICKER = [0.80, 0.58, 0.32], WICKER_D = [0.62, 0.42, 0.22];
        var body = cylinder(1.25, 1.4, 1.5, 4, function (t, a) { return mixc(WICKER, WICKER_D, 0.5 + 0.5 * Math.sin(t * 22)); });
        picnic.push([body, [bx, MY, bz], [0, rad(45), 0], [1.25, 1, 0.85]]);
        picnic.push([box(3.3, 0.18, 2.3, WICKER_D), [bx, MY + 1.58, bz], [0, rad(8), 0]]);
        picnic.push([torus(1.1, 0.1, WICKER_D, Math.PI), [bx, MY + 1.65, bz], [0, rad(8), 0]]);
        picnic.push([box(3.3, 0.06, 0.5, RED), [bx, MY + 1.7, bz + 0.25], [rad(-6), rad(8), 0]]);     // napkin peeking out
    })();
    function plate(x, z) { picnic.push([cylinder(0.95, 1.05, 0.12, 24, [0.97, 0.97, 0.99]), [x, MY, z]]); return MY + 0.12; }
    // sandwiches (triangles of bread with lettuce)
    (function () {
        var top = plate(-2.4, -4.4);
        [[0, 0], [0.45, 0.25]].forEach(function (o, k) {
            var tri = [];
            [[0.98, 0.85, 0.60], [0.40, 0.75, 0.25], [0.98, 0.85, 0.60]].forEach(function (c, l) {
                tri.push([cylinder(0.7, 0.7, 0.13, 3, c), [0, l * 0.13, 0]]);
            });
            picnic.push([merge(tri), [-2.4 + o[0], top + k * 0.05, -4.4 + o[1]], [0, rad(30 + k * 50), 0]]);
        });
    })();
    // fruit bowl: apples + oranges
    (function () {
        var top = plate(-0.2, -6.8);
        [[-0.35, 0, [0.86, 0.15, 0.15]], [0.35, 0.1, [0.92, 0.55, 0.12]], [0, -0.4, [0.86, 0.15, 0.15]], [0.05, 0.35, [0.55, 0.78, 0.2]]]
            .forEach(function (f) {
                picnic.push([ellipsoid(0.38, 0.34, 0.38, 10, 14, f[2]), [-0.2 + f[0], top + 0.3, -6.8 + f[1]]]);
                picnic.push([cylinder(0.03, 0.025, 0.2, 4, [0.35, 0.22, 0.1], true), [-0.2 + f[0], top + 0.6, -6.8 + f[1]]]);
            });
    })();
    // cups and a juice bottle
    [[-4.6, -6.6, [0.35, 0.6, 0.95]], [-3.9, -7.3, [1.0, 0.8, 0.25]], [4.9, -4.6, [0.95, 0.45, 0.6]]].forEach(function (c) {
        picnic.push([cylinder(0.32, 0.4, 0.75, 16, c[2]), [c[0], MY, c[1]]]);
        picnic.push([cylinder(0.3, 0.3, 0.02, 16, [0.95, 0.6, 0.2]), [c[0], MY + 0.7, c[1]]]);
    });
    picnic.push([cylinder(0.45, 0.45, 1.6, 18, [0.35, 0.75, 0.45]), [-5.6, MY, -5.1]]);
    picnic.push([cylinder(0.45, 0.2, 0.45, 18, [0.35, 0.75, 0.45]), [-5.6, MY + 1.6, -5.1]]);
    picnic.push([cylinder(0.2, 0.2, 0.25, 12, [0.95, 0.95, 0.95]), [-5.6, MY + 2.05, -5.1]]);
    picnic.push([box(1.0, 0.7, 0.04, [0.95, 0.85, 0.35]), [-5.6, MY + 0.8, -4.64]]);          // label
    // folded napkins
    picnic.push([box(1.1, 0.06, 1.1, [0.55, 0.8, 0.95]), [1.3, MY + 0.03, -3.6], [0, rad(20), 0]]);
    picnic.push([box(1.1, 0.06, 1.1, [1.0, 0.85, 0.6]), [-1.2, MY + 0.03, -7.6], [0, rad(-15), 0]]);
    part(root, "PicnicItems", merge(picnic), [0, 0, 0]);
}

// ---------------------------------------------------------------------
//  updateEnvironment(t): the clouds drift slowly to the right and wrap around
// ---------------------------------------------------------------------
export function updateEnvironment(t) {
    CLOUDS.forEach(function (c) {
        var x = c.x0 + c.speed * t;
        x = ((x + 600) % 1200 + 1200) % 1200 - 600;
        c.node.position[0] = x;
    });
}
