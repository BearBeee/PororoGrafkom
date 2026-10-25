// Poby uses the COURSE matrix library (POBY_LIBS), imported under the name LIBS
// so the code below is the same as in Poby's own project.
import { POBY_LIBS as LIBS } from "./helpers/libs.js";
import { MyObject } from "./helpers/node.js";
import { POBY_BUILDERS as B } from "./helpers/builders.js";

// =====================================================================
//  POBY MODEL — Poby the polar bear: measurements + hierarchy
//
//  All numbers are centimetres measured from Poby's reference sheet
//  (356 px = 44 cm, so 1 px ≈ 0.124 cm). Ground = y 0, front = +z.
//  The root object scales everything by 6.80 / 44 at the end.
//
//  Shapes used (course topic in brackets):
//   - Torso, head, feet : ring surfaces whose ring sizes follow B-spline
//                         curves through the measured outline   [B-spline + ellipsoid]
//   - Arms              : rings along a 2D B-spline centre line  [B-spline]
//   - Paws              : palm (sized by a B-spline table) + 3 fingers + thumb,
//                         melted together with a soft minimum, skinned with
//                         the ellipsoid's ring grid                [B-spline + ellipsoid grid]
//   - Legs              : elliptic cone (frustum)                 [quadric]
//   - Ears              : one surface of revolution around a B-spline outline [B-spline]
//   - Nose, eyes, pads, tail : ellipsoids                         [quadric]
//   - Mouth             : one B-spline line around the muzzle, drawn as a thin tube
//   - Claws             : B-spline curves drawn with many small balls
//                                                    [B-spline + instanced drawing]
//   - Hierarchy         : MyObject with POSITION/MOVE matrices    [OOP hierarchy]
// =====================================================================

var CM_TO_UNIT = 6.80 / 44;          // 1 cm = 0.1545 units

var COLORS = {
    FUR:   [0.95, 0.96, 0.98],
    EARIN: [0.88, 0.90, 0.93],
    BLACK: [0.06, 0.06, 0.07],
    MOUTH: [0.30, 0.31, 0.34],          // soft dark grey, so the mouth line reads faint
    SHINE: [1.00, 1.00, 1.00]
};

// =====================================================================
//  MEASURED TABLES — each row is one B-spline control point
// =====================================================================

// TORSO, measured every few cm of height:
// [height y, half-width (front view), front edge z, back edge z (side view)]
var TORSO = [
    // below y 16 the legs carry this outline (see LEG), the torso mesh starts at 16
    [9.5, 9.60, 5.45, -5.45], [10.3, 9.76, 5.6, -5.7], [11.0, 9.82, 5.75, -6.2],
    [11.5, 9.83, 5.85, -6.6], [12.2, 9.85, 6.3, -6.95], [13.0, 9.82, 6.8, -7.4], [14.0, 9.80, 7.25, -7.85],
    [15.2, 9.82, 7.66, -8.2], [16.7, 9.84, 7.9, -8.3], [18.0, 9.80, 7.9, -8.3], [19.7, 9.74, 7.8, -8.3],
    // BROAD, BOXY upper body: the sides stay almost straight up to the chest and
    // only turn in at a rounded shoulder corner near the top (a rounded rectangle
    // from the front instead of a pear)
    [21.1, 9.70, 7.5, -8.3], [22.6, 9.68, 7.25, -8.3], [24.1, 9.66, 6.85, -8.3], [25.6, 9.62, 6.3, -8.2],
    // the shoulders slope gently down from the neck, like a person's, instead of a hard corner
    [27.1, 9.5, 5.7, -7.95], [28.5, 9.2, 5.2, -7.65], [30.0, 8.7, 4.75, -7.25], [31.5, 7.8, 4.3, -6.7],
    [32.8, 6.5, 3.7, -6.05], [33.6, 5.1, 2.9, -5.3], [34.1, 3.6, 1.6, -4.0], [34.45, 0.00, -0.5, -0.5]
];
// how square the torso's cross-section is from above (2 = oval). It grows from
// 2 at the hips (so the legs still join exactly) to TORSO_SQUARE at the chest.
var TORSO_SQUARE = 2.15;

// HEAD, measured from the back of the head (z = -5) to the muzzle tip:
// [depth z, top y, bottom y (side view), half-width (top view)]
var HEAD = [
    // back of the head: one smooth ROUNDED CAP from the back point to z = 0. It
    // arrives at z = 0 with the same slope as the head in front of it, so the
    // curve carries straight on (no point, bump, rim or line)
    [-5.00, 36.80, 36.80, 0.00], [-4.96, 37.50, 36.16, 0.68], [-4.88, 38.02, 35.70, 1.18], [-4.75, 38.56, 35.22, 1.70], [-4.55, 39.16, 34.70, 2.27],
    [-4.30, 39.74, 34.21, 2.82], [-3.95, 40.39, 33.67, 3.43], [-3.50, 41.07, 33.14, 4.05], [-2.90, 41.82, 32.60, 4.71], [-2.20, 42.51, 32.14, 5.30],
    [-1.30, 43.17, 31.76, 5.85], [-0.30, 43.70, 31.52, 6.23], [1.0, 43.98, 31.5, 6.37], [2.0, 44.0, 31.5, 6.54],
    [3.0, 43.88, 31.1, 6.62], [4.0, 43.5, 30.1, 6.44], [5.0, 42.9, 29.0, 6.11], [6.0, 42.0, 28.2, 5.61],
    [7.0, 40.8, 27.8, 5.11], [8.0, 38.9, 27.5, 4.72], [9.0, 37.2, 27.45, 4.34], [10.0, 36.1, 27.65, 4.00],
    [11.0, 35.0, 28.2, 3.58], [11.6, 34.4, 28.7, 3.15], [12.1, 33.6, 29.4, 2.60], [12.6, 32.4, 30.4, 1.60]
];

// how "square" the face is (0 = plain ellipse rings, see headN)
var HEAD_SQUARE = 0.45;

// FOOT (right foot, centred at x = 5.5): [height y, half-width, front edge z, back edge z]
var FOOT_X = 5.5;
var FOOT = [
    [0.0, 3.9, 5.0, -4.4], [0.5, 4.25, 5.6, -4.9], [1.5, 4.55, 6.2, -5.55], [2.5, 4.55, 6.45, -5.5],
    [3.5, 4.4, 6.25, -5.45], [4.3, 4.15, 5.4, -5.2], [4.8, 4.05, 4.6, -5.1]
];

// ARM centre line in the front view (right arm; the left one is mirrored): [x, y]
// (starts a little lower and further in than before, so the shoulder stays
// under the body's shoulder line instead of poking above it)
// The arm hangs with one long, soft curve from the shoulder (not a sharp bend,
// and not so much that it reads as an upside-down J).
var ARM_PATH = [6.0, 29.4,  7.9, 28.6,  9.7, 26.9,  11.1, 23.9,  12.0, 20.3,  12.3, 17.2,  12.3, 14.6];   // the arm path from poby-v2
// SHOULDER BACK: the top of the arm moves this far back (cm), so the shoulder sits
// in line with the body instead of hunching forward. It fades out down the arm, so
// the forearm and hand stay where they are.
var ARM_BACK = 0.9;
// ARM LEAN: how far forward (cm) the hand sits, so the arm leans forward from the shoulder
var ARM_LEAN = 0;
var ARM_R = 2.65, ARM_Z = 0.3;            // ARM_R = round wrist radius (the paw starts from it)
// ARM THICKNESS along the arm (s = 0 shoulder .. 1 wrist): [s, half-width, half-depth].
// The upper arm is a thick oval, deeper front-to-back than it is wide (like the
// reference model); it slims down to the round wrist (ARM_R).
var ARM_SIZE = [[0.0, 3.0, 3.4], [0.35, 2.95, 3.3], [0.75, 2.7, 2.85], [1.0, ARM_R, ARM_R]];
// HAND (paw), measured from the reference shots. Paw coordinates, in cm from
// the wrist: d = down along the arm, u = towards the palm side, w = across the
// palm (+ = thumb side).
//   digits: [knuckle [d,u,w], tip [d,u,w], radius at knuckle, radius at tip]
//           3 fingers in a row at the end of the palm + the thumb on the side
//   kFingers / kPalm: how softly the fingers melt into each other / into the palm
//   twist: how far the palm turns backwards; pad / dot: [rx, ry, thickness, sink]
var HAND = {
    // A hand that BELONGS to the arm: about as wide as the forearm, a little
    // flatter at the palm, then 3 short rounded fingers + a thumb (4 digits).
    // The fingers are separate (soft creases between them) and curl slightly
    // towards the palm. The thumb sits on the front side (+w), higher up.
    // (a TALL hand: wrist to fingertip ≈ 5.6 cm, longer than it is wide)
    twist: 0, capStart: 3.4, cap: 0.65, capBack: 1.4,
    digits: [
        [[3.3, -0.6, -1.5], [5.25, -0.05, -1.62], 0.9, 0.76],   // finger 0 (back)
        [[3.3, -0.6, 0.0], [5.55, -0.05, 0.0], 0.93, 0.79],     // finger 1 (middle, longest)
        [[3.3, -0.6, 1.45], [5.2, -0.05, 1.55], 0.9, 0.76],     // finger 2
        [[1.8, -0.05, 1.95], [3.4, 0.5, 2.9], 0.88, 0.78]       // thumb (front side)
    ],
    kFingers: 0.28, kPalm: 1.3,
    wristBlend: 2.0,
    foldSmooth: 120, foldAt: 3.6, foldWidth: 1.6,          // soften the fold across the back of the knuckles
    showPads: true,
    centreUp: 0.6, rings: 110, tidy: 10,
    // palm pad: a ROUNDED RECTANGLE [half width, half length, thickness, sink]
    pad: [1.0, 0.74, 0.12, 0.03], padRound: 2.8, padAt: [2.6, 0.3],   // WIDE: across the palm > along it
    // finger / thumb dots: round dots [rx, ry, thickness, sink], on the palm side of
    // each finger's segment, dotAt of the way from the knuckle to the tip
    dot: [0.28, 0.28, 0.1, 0.03], dotAt: 0.75
};
// PALM sizes (B-spline through these rows, like the torso table):
// [d below the wrist, half thickness (palm side), half width, shift towards the palm side,
//  BACK: how far the back of the hand reaches from the arm's centre line]
// The back of the hand stays as far out as the forearm (ARM_R), so the outer line
// of the arm runs straight on down the back of the hand; it only rounds over
// near the knuckles. The palm side keeps its indent.
// At the wrist it is the round arm (radius ARM_R). Below it gets flatter (the
// palm) but NOT wider than the forearm, so the hand doesn't flare out.
var PALM = [[0, ARM_R, ARM_R, 0, ARM_R], [0.8, 2.45, 2.62, 0, ARM_R], [1.6, 2.05, 2.6, -0.1, ARM_R],
            [2.4, 1.7, 2.5, -0.2, 2.58], [3.2, 1.5, 2.35, -0.25, 2.25], [3.9, 1.4, 2.2, -0.3, 1.75]];

// LEG: one smooth surface from the hip (y 16, where the torso mesh ends) down
// into the top of the foot (y 4.8), where the foot rolls up into it (see ANKLE_BLEND).
// Lower down it is an ELLIPTIC CONE (quadric table) that would reach y 3.2:
// radius = a·v and b·v. Near the hip each ring slowly changes into the
// matching half of the torso cross-section, so leg and body join with no seam.
var LEG = { x: 5.1, z: -0.1, top: 16.0, bottom: 3.2,
            coneTop: 11.0, a: 4.45, b: 5.35, v0: 4.15 / 4.45,   // cone: radii a·v, b·v; v = v0 at y 3.2, v = 1 at y 11
            // belly fold: where the round belly rolls under into the legs.
            // It is lowest in the middle (foldMid) and higher at the hips (foldHip),
            // so seen from the front the bottom of the belly is a "U".
            foldMid: 9.3, foldHip: 11.9, foldWidth: 5.0,   // top of the fold stays where it was (belly unchanged); it reaches further down
            depthFlare: 0,
            // crotch: a round arch (radius archR) whose top is at archTop
            archTop: 10.1, archR: 0.75 };

// Points around each leg ring (the torso uses twice this many, see torsoRingAngles).
// Must be a multiple of 4. Higher = rounder legs/body.
var LEG_STEPS = 96;
// ANKLE: the leg (a cone) ends at the top of the foot (y 4.8). Over the top
// ANKLE_BLEND cm of the foot, each foot ring slowly turns into the leg's ring at
// that height, so foot and leg are one smooth skin (no step / ledge where the
// leg used to stick into the foot).
var ANKLE_BLEND = 2.0;

// JOINTS (pivots) — each moving part rotates around one of these
var PIVOT = {
    torso: [0, 18.0, 0],
    head:  [0, 33.0, 0],
    arm:   [8.6, 29.0, 0.1],        // x mirrored for the left side
    leg:   [5.1, 11.0, -0.1]
};

// =====================================================================
//  helpers
// =====================================================================
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

// place an object: rotate (radians, X then Y then Z), then move
function place(obj, pos, rot) {
    if (rot) {
        if (rot[0]) LIBS.rotateX(obj.POSITION_MATRIX, rot[0]);
        if (rot[1]) LIBS.rotateY(obj.POSITION_MATRIX, rot[1]);
        if (rot[2]) LIBS.rotateZ(obj.POSITION_MATRIX, rot[2]);
    }
    LIBS.translateX(obj.POSITION_MATRIX, pos[0]);
    LIBS.translateY(obj.POSITION_MATRIX, pos[1]);
    LIBS.translateZ(obj.POSITION_MATRIX, pos[2]);
    return obj;
}

// find the ring of a sampled table at key t (linear interpolation between samples)
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


function smooth(s) {                                   // 0..1 with soft start and end ("smoothstep")
    s = Math.min(1, Math.max(0, s));
    return s * s * (3 - 2 * s);
}

// Matching the torso ring to the leg rings.
// A leg ring point at angle t sits at "across" = (1 + cos t) / 2 of the way
// from the leg's inner edge (0) to its outer edge (1). On the torso's right
// half we use the point with the same "across" value: x = W·across, on the
// front (sin t ≥ 0) or back of the oval. Its angle on the torso oval is
// acos(across) (front) or 2π − acos(across) (back).
function acrossOf(t) { return (1 + Math.cos(t)) / 2; }
function halfBodyPoint(t, W, zf, zb) {
    var zc = (zf + zb) / 2, Bz = (zf - zb) / 2, u = acrossOf(t);
    var zz = Bz * Math.sqrt(Math.max(0, 1 - u * u));
    return [W * u, Math.sin(t) >= 0 ? zc + zz : zc - zz];
}
// All torso ring angles: the right half (from the legs' angles) and its mirror on the left
function torsoRingAngles(steps) {
    var q = [];                                              // 0 .. π/2 (right front quarter)
    for (var j = 0; j <= steps / 2; j++) q.push(Math.acos(acrossOf(j / steps * 2 * Math.PI)));
    var out = q.slice();
    for (var j = q.length - 2; j >= 0; j--) out.push(Math.PI - q[j]);      // left front
    for (var j = 1; j < q.length; j++) out.push(Math.PI + q[j]);           // left back
    for (var j = q.length - 2; j >= 0; j--) out.push(2 * Math.PI - q[j]);  // right back
    return out;
}

// EAR outline, [r, z]: r = distance from the ear's centre line, z = forwards.
// Starts in the middle of the back (r 0), rounds over the rim (widest r ≈ 1.75)
// and ends in the middle of the front hollow (r 0). The first two and last
// two points have the same z, so the back and the hollow are smooth in the middle.
var EAR_PROFILE = [[0, -0.8], [0.95, -0.8], [1.65, -0.6], [1.95, -0.05], [1.75, 0.55],
                   [1.2, 0.72], [0.8, 0.22], [0.45, 0.08], [0, 0.08]];
var EAR_CUP_DROP = 0.3;    // the hollow sits a little low -> thicker rim on top (a soft "C")

function buildEar() {
    var cp = [];
    EAR_PROFILE.forEach(function (q) { cp.push(q[0], q[1]); });
    var prof = B.generateBSpline(cp, 48, 3), n = prof.length / 2, rings = [];
    for (var i = 0; i < n; i++) {
        var f = i / (n - 1);
        var drop = -EAR_CUP_DROP * smooth((f - 0.5) / 0.35);           // only the hollow moves down
        rings.push({ c: [0, drop, prof[i * 2 + 1]], u: [1, 0, 0], w: [0, 1, 0], a: prof[i * 2], b: prof[i * 2] });
    }
    var STEP = 48, mesh = B.generateRingSurface(rings, STEP, COLORS.FUR, true);
    // colour: fur on the back and rim, slowly turning to EARIN inside the hollow
    for (var i = 0; i < n; i++) {
        var k = smooth((i / (n - 1) - 0.62) / 0.15);
        for (var j = 0; j <= STEP; j++) {
            var v = (i * (STEP + 1) + j) * 9;
            for (var q = 0; q < 3; q++) mesh.vertices[v + 3 + q] = COLORS.FUR[q] + (COLORS.EARIN[q] - COLORS.FUR[q]) * k;
        }
    }
    return mesh;
}

// The points of a flat pad, as rings [x, y, z]: from above it is a superellipse
// |x/a|^n + |y/b|^n = 1 (n = 2: an ellipse / round dot, n > 2: a ROUNDED
// RECTANGLE, used for the palm pad), with a round profile through its thickness c.
function padRings(a, b, c, n) {
    var rings = [], STACK = 16, STEP = 40;
    for (var i = 0; i <= STACK; i++) {
        var u = i / STACK * Math.PI - Math.PI / 2, ring = [];
        for (var j = 0; j <= STEP; j++) {
            var v = j / STEP * 2 * Math.PI, cv = Math.cos(v), sv = Math.sin(v);
            var k = Math.pow(Math.pow(Math.abs(cv), n) + Math.pow(Math.abs(sv), n), -1 / n);   // ellipse -> rounded rectangle
            ring.push([a * Math.cos(u) * cv * k, b * Math.cos(u) * sv * k, c * Math.sin(u)]);
        }
        rings.push(ring);
    }
    return rings;
}

// =====================================================================
//  BUILD — make(mesh, name) creates a MyObject (see createPoby below)
// =====================================================================
function buildPoby(make) {
    var C = COLORS;

    var poby = make(null, "Poby");

    // ---------------- TORSO ----------------
    var torsoRows = B.bsplineTable(TORSO, 120);
    var torsoRings = torsoRows.filter(function (r) { return r[0] >= LEG.top; }).map(function (r) {
        return { c: [0, r[0], (r[2] + r[3]) / 2], u: [1, 0, 0], w: [0, 0, 1], a: Math.max(r[1], 0), b: Math.max((r[2] - r[3]) / 2, 0) };
    });
    // The torso rings use the same angles as the legs' rings (see legAngle), so
    // the lowest torso ring has exactly the same points as the tops of the legs.
    var torsoAngles = torsoRingAngles(LEG_STEPS);
    var torsoMesh = B.generateRingSurfaceFromPoints(torsoRings.map(function (R) {
        // superellipse ring: n = 2 at the hips, squarer (TORSO_SQUARE) from the belly up
        var n = 2 + (TORSO_SQUARE - 2) * smooth((R.c[1] - 19) / 6);
        return torsoAngles.map(function (phi) {
            var c = Math.cos(phi), sn = Math.sin(phi);
            var x = R.a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
            if (Math.abs(x) < 0.05) x = 0;             // same snap as the legs, so the points match
            return [x, R.c[1], R.c[2] + R.b * Math.sign(sn) * Math.pow(Math.abs(sn), 2 / n)];
        });
    }), C.FUR, true);
    var torso = make(null, "Torso");                       // mesh filled in after the legs exist
    var legMeshes = [], legObjects = [], footMeshes = [], footObjects = [];
    place(torso, PIVOT.torso);
    poby.childs.push(torso);

    // ---------------- HEAD ----------------
    var headRows = B.bsplineTable(HEAD, 100);             // rows: [z, top, bottom, half-width]
    var headRings = headRows.map(function (r) {
        return { c: [0, (r[1] + r[2]) / 2, r[0]], u: [1, 0, 0], w: [0, 1, 0], a: Math.max(r[3], 0), b: Math.max((r[1] - r[2]) / 2, 0) };
    });
    // Each head ring is a SUPERELLIPSE |x/a|^n + |y/b|^n = 1 instead of a plain
    // ellipse (n = 2). A bit more than 2 makes the cheeks and jaw fuller, like the
    // reference's rounded-square face; the back of the head stays round (n = 2).
    function headN(z) { return 2 + HEAD_SQUARE * smooth((z + 3) / 6) - 0.2 * smooth((z - 8) / 4); }
    function se(v, n) { return Math.sign(v) * Math.pow(Math.abs(v), 2 / n); }
    var HEAD_STEPS = 96;
    var head = make(B.shiftMesh(B.generateRingSurfaceFromPoints(headRings.map(function (R) {
        var n = headN(R.c[2]), pts = [];
        for (var j = 0; j <= HEAD_STEPS; j++) {
            var t = j / HEAD_STEPS * 2 * Math.PI;
            var nt = Math.sin(t) > 0 ? 2 + (n - 2) * 0.3 : n;      // the crown stays round, the jaw is fuller
            pts.push([R.a * se(Math.cos(t), nt), R.c[1] + R.b * se(Math.sin(t), nt), R.c[2]]);
        }
        return pts;
    }), C.FUR), PIVOT.head), "Head");
    place(head, sub(PIVOT.head, PIVOT.torso));
    torso.childs.push(head);
    function inHead(p) { return sub(p, PIVOT.head); }

    // x of the head surface at depth z and height y (ellipse:  x = a·sqrt(1 - ((y - yc)/b)²))
    function headX(z, y) {
        var r = lookup(headRows, z), yc = (r[1] + r[2]) / 2, b = (r[1] - r[2]) / 2;
        var n = y > yc ? 2 + (headN(z) - 2) * 0.3 : headN(z);
        return r[3] * Math.pow(Math.max(0, 1 - Math.pow(Math.abs((y - yc) / b), n)), 1 / n);
    }
    // front-most z of the head surface at (x, y): walk backwards from the tip
    function headFrontZ(x, y) {
        for (var z = 12.6; z > -5; z -= 0.01) if (Math.abs(x) <= headX(z, y)) return z;
        return 0;
    }

    // nose
    var nose = make(B.generateEllipsoid(2.5, 2.25, 1.35, 48, 48, C.BLACK), "Nose");
    place(nose, inHead([0, 31.3, 12.3]));
    head.childs.push(nose);

    // ---------------- MOUTH ----------------
    // ONE line from the left cheek, around the underside of the muzzle, to the
    // right cheek (a wide smile). It is a B-spline in "head surface" coordinates
    // (z = depth, t = angle around the head ring: -π/2 = straight down,
    // 0 = right side, -π = left side), so every point lies on the head. The
    // line is drawn as a thin tube with a round dot at each end.
    function headPoint(z, t) {                         // point on the head surface + its outward direction
        var r = lookup(headRows, z), yc = (r[1] + r[2]) / 2, b = (r[1] - r[2]) / 2, n = headN(z);
        var nt = Math.sin(t) > 0 ? 2 + (n - 2) * 0.3 : n;
        var p = [r[3] * se(Math.cos(t), nt), yc + b * se(Math.sin(t), nt), z];
        return { p: p, out: normalize([p[0] / (r[3] || 1), (p[1] - yc) / (b || 1), 0]) };
    }
    function angleOf(z, y) {                           // angle t of the side point (z, y) on the right
        var r = lookup(headRows, z), yc = (r[1] + r[2]) / 2, b = (r[1] - r[2]) / 2, n = headN(z);
        var s = Math.min(1, Math.abs((y - yc) / b));
        return -Math.asin(Math.pow(s, n / 2));
    }
    // right half, from the back of the cheek to the middle under the muzzle
    // (the cheek part is the same curve as before: (z, y) = (6.95, 29.95) .. (8.3, 28.2))
    var MOUTH = [[6.95, angleOf(6.95, 29.95)], [7.3, angleOf(7.3, 29.2)], [7.9, angleOf(7.9, 28.55)],
                 [8.6, angleOf(8.6, 28.05)], [9.2, -1.3], [9.5, -Math.PI / 2]];
    // control points: left cheek (mirror: t -> -π - t) -> middle -> right cheek
    var mouthCP = [];
    for (var k = 0; k < MOUTH.length - 1; k++) mouthCP.push(MOUTH[k][0], -Math.PI - MOUTH[k][1]);
    for (var k = MOUTH.length - 1; k >= 0; k--) mouthCP.push(MOUTH[k][0], MOUTH[k][1]);
    var mouthLine = B.generateBSpline(mouthCP, 200, 3), mouthPts = [];
    var MOUTH_R = 0.075;                                // line thickness (radius, cm)
    for (var i = 0; i < mouthLine.length; i += 2) {
        var hp = headPoint(mouthLine[i], mouthLine[i + 1]);
        mouthPts.push({ p: add(hp.p, mul(hp.out, 0.02)), out: hp.out });  // sits half in the skin
    }
    var mouthRings = mouthPts.map(function (m, i) {
        var a = mouthPts[Math.max(i - 1, 0)].p, b = mouthPts[Math.min(i + 1, mouthPts.length - 1)].p;
        var T = normalize(sub(b, a));
        var N = normalize(sub(m.out, mul(T, dot(m.out, T)))), Bn = cross(T, N), ring = [];
        for (var j = 0; j <= 12; j++) {
            var th = j / 12 * 2 * Math.PI;
            ring.push(add(m.p, mul(N, MOUTH_R * Math.cos(th)), mul(Bn, MOUTH_R * Math.sin(th))));
        }
        return ring;
    });
    var mouth = make(B.shiftMesh(B.generateRingSurfaceFromPoints(mouthRings, C.MOUTH), PIVOT.head), "Mouth");
    var mouthEnds = make(B.generateEllipsoid(MOUTH_R, MOUTH_R, MOUTH_R, 12, 12, C.MOUTH), "MouthEnds");
    mouthEnds.instances.push(inHead(mouthPts[0].p), inHead(mouthPts[mouthPts.length - 1].p));
    mouth.childs.push(mouthEnds);
    head.childs.push(mouth);

    // ---------------- both sides ----------------
    [-1, 1].forEach(function (side) {
        var tag = side < 0 ? "L" : "R";

        // eyes: small black balls on the face, with a white shine
        var ey = 37.6, ex = side * 1.95, ez = headFrontZ(ex, ey) - 0.1;
        var eye = make(B.generateEllipsoid(0.44, 0.44, 0.34, 32, 32, C.BLACK), "Eye" + tag);
        place(eye, inHead([ex, ey, ez]));
        var shine = make(B.generateEllipsoid(0.1, 0.1, 0.06, 16, 16, C.SHINE), "EyeShine" + tag);
        place(shine, [0.13, 0.14, 0.3]);
        eye.childs.push(shine);
        head.childs.push(eye);


        // ears: torus rim + elliptic paraboloid cup, turned slightly outwards
        var ear = make(null, "Ear" + tag);
        place(ear, inHead([side * 6.5, 40.5, 0.3]), [0, side * 0.38, -side * 0.3]);   // on the top corners, turned a little outwards
        // ONE smooth ear: a surface of revolution (rings around the ear's z axis,
        // z = forwards). Its outline is a B-spline (EAR_PROFILE): from the middle
        // of the rounded back, over the soft rim, down into a shallow hollow.
        // Back, rim and hollow are one skin, so there are no seams.
        ear.childs.push(make(buildEar(), "EarShell" + tag));
        head.childs.push(ear);

        // ---------------- ARM ----------------
        var AP = [side * PIVOT.arm[0], PIVOT.arm[1], PIVOT.arm[2]];
        var arm = make(null, "Arm" + tag);                       // shoulder joint
        place(arm, sub(AP, PIVOT.torso));
        torso.childs.push(arm);

        // ARM: rings along the arm's B-spline centre line (front view), from the
        // shoulder down to the wrist.
        var path = B.generateBSpline(ARM_PATH, 60, 3), RING = 64, armRings = [];
        var armSize = B.bsplineTable(ARM_SIZE, 60);           // smooth thickness along the arm
        function ringPoints(c, U, W, a, b) {             // one ring: c + U·a·cos θ + W·b·sin θ
            var pts = [];
            for (var j = 0; j <= RING; j++) {
                var th = j / RING * 2 * Math.PI;
                pts.push(add(c, mul(U, a * Math.cos(th)), mul(W, b * Math.sin(th))));
            }
            return pts;
        }
        var U, W = [0, 0, 1], D, U0, D0;
        for (var i = 0; i < path.length / 2; i++) {
            var p0 = Math.max(i - 1, 0), p1 = Math.min(i + 1, path.length / 2 - 1);
            var tx = path[p1 * 2] - path[p0 * 2], ty = path[p1 * 2 + 1] - path[p0 * 2 + 1], tl = Math.hypot(tx, ty);
            // ring perpendicular to the curve: one axis = 2D normal (ty, -tx), the other = z
            U = [side * ty / tl, -tx / tl, 0];                  // at the wrist this points towards the body (palm side)
            D = [side * tx / tl, ty / tl, 0];                   // direction along the arm (down at the wrist)
            var sz = lookup(armSize, i / (path.length / 2 - 1));
            // top of the arm sits further back; the shift fades out EVENLY down the whole
            // arm, so from the side the arm is one straight line leaning a little forward
            var t = i / (path.length / 2 - 1);
            var back = ARM_BACK * (1 - t) - ARM_LEAN * t;          // ARM_LEAN: how far the hand sits forward
            armRings.push(ringPoints([side * path[i * 2], path[i * 2 + 1], ARM_Z - back], U, W, sz[1], sz[2]));
            if (i === 0) { U0 = U; D0 = D; }
        }

        // ---------------- HAND (paw) ----------------
        // The paw is ONE smooth skin made in 2 steps:
        //  1. SHAPE: simple solids, each with a "distance" function (< 0 inside,
        //     > 0 outside): the palm (rings sized by the PALM table, rounded end),
        //     3 fingers and a thumb (capsules = tubes with round ends).
        //     They are melted together with a SOFT MINIMUM, so the fingers grow
        //     smoothly out of the palm and there are soft creases between them.
        //  2. SKIN: the same grid as the course ellipsoid (rings × points), but each
        //     point is pushed out along its ray from a centre inside the wrist
        //     until it reaches the surface of that shape.
        // The top ring of the skin is exactly the last arm ring, so arm and paw join
        // with no seam.
        var H = HAND, wristC = [side * path[path.length - 2], path[path.length - 1], ARM_Z + ARM_LEAN];
        var tw = H.twist, Uh = add(mul(U, Math.cos(tw)), mul(W, -Math.sin(tw))), Wh = add(mul(U, Math.sin(tw)), mul(W, Math.cos(tw)));
        // paw coordinates -> world: d = down the arm, u = towards the palm side, w = across (thumb side +)
        function P(d, u, w) { return add(wristC, mul(D, d), mul(Uh, u), mul(Wh, w)); }
        var palmRows = B.bsplineTable(PALM, 80);              // smooth palm sizes along d

        function palmDist(d, u, w) {                          // the palm (and the end of the forearm)
            var Ld = H.capStart, r = lookup(palmRows, Math.min(d, Ld)), b = r[2];
            var a = u >= r[3] ? r[1] : r[3] + r[4];          // palm side / back of the hand
            var uu = (u - r[3]) / a, ww = w / b;
            if (d <= Ld) return (Math.hypot(uu, ww) - 1) * Math.min(a, b);
            // rounded end: half an ellipsoid. The back of the hand is fuller, so it
            // rounds off over a longer stretch (capBack) and rolls into the fingers
            var capLen = H.cap + (H.capBack - H.cap) * smooth(-uu);
            var dd = (d - Ld) / capLen;
            return (Math.sqrt(uu * uu + ww * ww + dd * dd) - 1) * Math.min(a, b);   // same scale as above: no jump
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
            // right at the wrist it must be exactly the round arm (radius 2.5), so
            // morph from the arm to the paw over the first wristBlend cm (like the legs)
            var t = smooth(q[0] / H.wristBlend);
            return (Math.hypot(q[1], q[2]) - ARM_R) * (1 - t) + paw * t;
        }
        function local(p) { var r = sub(p, wristC); return [dot(r, D), dot(r, Uh), dot(r, Wh)]; }
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
        function normalAt(p) {                                // surface direction from the shape (finite differences)
            var e = 0.01, q = local(p), f0 = pawDist(q);
            var g = [pawDist([q[0] + e, q[1], q[2]]) - f0, pawDist([q[0], q[1] + e, q[2]]) - f0, pawDist([q[0], q[1], q[2] + e]) - f0];
            return normalize(add(mul(D, g[0]), mul(Uh, g[1]), mul(Wh, g[2])));
        }

        // SKIN: rays from a centre above the wrist, like the ellipsoid's u (down) and v (around)
        var centre = add(wristC, mul(D, -H.centreUp));
        var a0 = Math.atan2(ARM_R, H.centreUp);              // ray angle (from straight down) that meets the wrist ring
        var pawRings = [armRings[armRings.length - 1]];
        for (var i = 1; i <= H.rings; i++) {
            var be = a0 * (1 - i / H.rings), ring = [];     // angle from straight down: a0 (wrist) .. 0 (bottom)
            for (var j = 0; j <= RING; j++) {
                var th = j / RING * 2 * Math.PI;
                var dir = add(mul(D, Math.cos(be)), mul(U, Math.sin(be) * Math.cos(th)), mul(W, Math.sin(be) * Math.sin(th)));
                ring.push(i === H.rings ? hit(centre, D) : hit(centre, dir));
            }
            pawRings.push(ring);
        }
        // TIDY the skin: where rays only graze the surface (the sides of the fingers)
        // the points bunch up. So a few times: move every point halfway to the
        // average of its 4 neighbours, then pull it back onto the surface
        // (step against the surface direction by the distance value).
        function toSurface(p) {
            for (var n = 0; n < 4; n++) {
                var q = local(p), f0 = pawDist(q), e = 0.005;
                var g = [pawDist([q[0] + e, q[1], q[2]]) - f0, pawDist([q[0], q[1] + e, q[2]]) - f0, pawDist([q[0], q[1], q[2] + e]) - f0];
                var gg = (g[0] * g[0] + g[1] * g[1] + g[2] * g[2]) / (e * e) || 1;
                var k = f0 / gg / e;
                p = sub(p, add(mul(D, g[0] * k), mul(Uh, g[1] * k), mul(Wh, g[2] * k)));
            }
            return p;
        }
        for (var it = 0; it < H.tidy; it++) {
            var next = pawRings.map(function (r) { return r.slice(); });
            for (var i = 1; i < pawRings.length - 1; i++) {
                for (var j = 0; j < RING; j++) {
                    var jl = (j + RING - 1) % RING, jr = (j + 1) % RING;
                    var avg = mul(add(pawRings[i - 1][j], pawRings[i + 1][j], pawRings[i][jl], pawRings[i][jr]), 0.25);
                    next[i][j] = toSurface(add(mul(pawRings[i][j], 0.5), mul(avg, 0.5)));
                }
                next[i][RING] = next[i][0];                      // the ring closes on itself
            }
            pawRings = next;
        }
        // SOFTEN THE KNUCKLE FOLD on the back of the hand: the back is wider than the
        // fingers, so the skin tucks in where they meet and shows a line. Relax only
        // the skin there (back side, around the knuckle line) a few times, without
        // pulling it back onto the shape, so the fold becomes a gentle curve. The
        // palm side, the finger tips and the pads are not touched.
        for (var it = 0; it < H.foldSmooth; it++) {
            var lam = it % 2 ? -0.53 : 0.5;                 // Taubin: smooth, then undo the shrink
            var next = pawRings.map(function (r) { return r.slice(); });
            for (var i = 1; i < pawRings.length - 1; i++) {
                for (var j = 0; j < RING; j++) {
                    var p = pawRings[i][j], q = local(p);
                    var wgt = smooth(-q[1] / 0.8) * (1 - smooth(Math.abs(q[0] - H.foldAt) / H.foldWidth));
                    if (wgt <= 0) continue;
                    var jl = (j + RING - 1) % RING, jr = (j + 1) % RING;
                    var avg = mul(add(pawRings[i - 1][j], pawRings[i + 1][j], pawRings[i][jl], pawRings[i][jr]), 0.25);
                    next[i][j] = add(p, mul(sub(avg, p), lam * wgt));
                }
                next[i][RING] = next[i][0];
            }
            pawRings = next;
        }

        var armRaw = B.generateRingSurfaceFromPoints(armRings, C.FUR, side > 0);
        var pawRaw = B.generateRingSurfaceFromPoints(pawRings, C.FUR, side > 0);
        B.shareNormals([armRaw, pawRaw]);                     // no shading line at the wrist

        var armMesh = make(B.shiftMesh(armRaw, AP), "ArmSurface" + tag);
        // shoulder: an ellipsoid the same size as the first arm ring, turned to match it
        var shoulder = make(B.orientMesh(B.generateEllipsoid(ARM_SIZE[0][1], ARM_SIZE[0][1], ARM_SIZE[0][2], 40, 40, C.FUR),
                                         sub([side * path[0], path[1], ARM_Z - ARM_BACK], AP), U0, D0, W), "Shoulder" + tag);
        arm.childs.push(armMesh, shoulder);

        var hand = make(B.shiftMesh(pawRaw, wristC), "Hand" + tag);   // wrist joint + paw skin
        place(hand, sub(wristC, AP));
        arm.childs.push(hand);

        // black pads, laid on the skin like DECALS: every point of the pad is
        // pressed onto the curved hand surface (toSurface) and then lifted along the
        // surface direction by its thickness, so the whole pad hugs the palm / finger
        // and none of it sinks in. size = [half width, half length, thickness, sink]
        function pad(name, from, dir, size, round) {
            var p = hit(from, dir), n = normalAt(p);
            var X = normalize(sub(Wh, mul(n, dot(Wh, n)))), Y = cross(n, X);
            var rings = padRings(size[0], size[1], size[2], round || 2).map(function (ring) {
                return ring.map(function (q) {
                    var sp = toSurface(add(p, mul(X, q[0]), mul(Y, q[1])));
                    return sub(add(sp, mul(normalAt(sp), q[2] - size[3])), wristC);
                });
            });
            hand.childs.push(make(B.generateRingSurfaceFromPoints(rings, C.BLACK), name));
        }
        // big palm pad: in the middle of the palm
        if (H.showPads) pad("PalmPad" + tag, P(H.padAt[0], 0, H.padAt[1]), Uh, H.pad, H.padRound);
        // a round dot on the palm side of every finger (and the thumb), on the
        // finger segment, not the tip: start inside the finger and walk towards the palm side
        if (H.showPads) digits.forEach(function (g, k) {
            var t = H.dotAt, A = P(g.A[0], g.A[1], g.A[2]), Bt = P(g.B[0], g.B[1], g.B[2]);
            var mid = add(A, mul(sub(Bt, A), t)), along = normalize(sub(Bt, A));
            var dir = normalize(sub(Uh, mul(along, dot(Uh, along))));     // palm side, square to the finger
            pad((k === 3 ? "ThumbPad" : "FingerPad" + k) + tag, mid, dir, H.dot);
        });

        // ---------------- LEG ----------------
        var LP = [side * PIVOT.leg[0], PIVOT.leg[1], PIVOT.leg[2]];
        var leg = make(null, "Leg" + tag);                       // hip joint
        place(leg, sub(LP, PIVOT.torso));
        torso.childs.push(leg);

        // rings from the hip down to the foot
        var legRings = [], STEPS = LEG_STEPS, LEG_ROWS = 90;
        var legTop = torsoRings[0].c[1];                  // exactly where the torso mesh starts
        // the leg ends at the top of the foot; the foot's top ring is made equal to it
        var footRows = B.bsplineTable(FOOT, 30), footTopY = footRows[footRows.length - 1][0];
        for (var i = 0; i <= LEG_ROWS; i++) {
            var y = legTop + (footTopY - legTop) * i / LEG_ROWS;
            // elliptic cone (quadric table): radii a·v and b·v at this height
            var v = LEG.v0 + (y - LEG.bottom) / (LEG.coneTop - LEG.bottom) * (1 - LEG.v0);
            var hip = lookup(torsoRows, y);                 // the torso outline at this height
            // round crotch arch: the legs may not come closer than this to the middle
            var yc = LEG.archTop - LEG.archR;
            var gap = y >= LEG.archTop ? 0 : (y > yc ? Math.sqrt(LEG.archR * LEG.archR - (y - yc) * (y - yc)) : LEG.archR);
            // between the legs (x): stay joined above the arch, separate below it
            var sInner = smooth((LEG.archTop - y) / 1.5);
            var ring = [];
            for (var j = 0; j <= STEPS; j++) {
                var t = j / STEPS * 2 * Math.PI, u = acrossOf(t);
                // the belly rolls under into the leg along a "U": low in the middle
                // (foldMid), high at the hips (foldHip)
                var yFold = LEG.foldMid + (LEG.foldHip - LEG.foldMid) * u;
                var s = smooth((yFold + LEG.foldWidth / 2 - y) / LEG.foldWidth);
                var half = halfBodyPoint(t, hip[1], hip[2], hip[3]);
                // the tops of the legs grow forward (front-to-back only) to meet the belly
                var fd = 1 + LEG.depthFlare * smooth((y - LEG.coneTop) / (legTop - LEG.coneTop));
                var cone = [LEG.x + LEG.a * v * Math.cos(t), LEG.z + LEG.b * v * (Math.sin(t) > 0 ? fd : 1) * Math.sin(t)];
                // x: points near the middle (small u) wait for the arch
                var sx = s + (Math.min(s, sInner) - s) * smooth((0.25 - u) / 0.25);
                var x = half[0] + (cone[0] - half[0]) * sx;
                var z = half[1] + (cone[1] - half[1]) * s;
                x = Math.max(x, gap);
                if (x < 0.05) x = 0;           // snap onto the middle line so both legs meet exactly
                ring.push([side * x, y, z]);
            }
            legRings.push(ring);
        }
        // Where the legs are still joined, part of each ring lies on the middle line
        // (x = 0), pressed flat against the other leg: a hidden wall. Drawing it
        // makes thin lines, so leave out every piece whose 4 corners all lie on
        // the middle line. Everything else (including the underside between the
        // legs) is kept, so the body stays closed.
        function onMiddle(p) { return Math.abs(p[0]) < 0.05; }
        legMeshes.push(B.generateRingSurfaceFromPoints(legRings, C.FUR, side < 0, function (i, j) {
            return onMiddle(legRings[i][j]) && onMiddle(legRings[i][j + 1]) &&
                   onMiddle(legRings[i + 1][j]) && onMiddle(legRings[i + 1][j + 1]);
        }));
        var thigh = make(null, "LegSurface" + tag);       // mesh filled in after both legs exist
        legObjects.push([thigh, LP]);
        leg.childs.push(thigh);

        // foot: ring surface; the first ring has size 0 so the sole is flat
        // (footRows was made above, for the ankle)
        var footRings = [{ c: [side * FOOT_X, 0, (footRows[0][2] + footRows[0][3]) / 2], u: [1, 0, 0], w: [0, 0, 1], a: 0, b: 0 }]
            .concat(footRows.map(function (r, k) {
                var y = r[0], ring = { x: FOOT_X, z: (r[2] + r[3]) / 2, a: r[1], b: (r[2] - r[3]) / 2 };
                // ankle: near the top the foot ring turns into the leg's cone ring
                var v = LEG.v0 + (y - LEG.bottom) / (LEG.coneTop - LEG.bottom) * (1 - LEG.v0);
                var cone = { x: LEG.x, z: LEG.z, a: LEG.a * v, b: LEG.b * v };
                var s = k === footRows.length - 1 ? 1 : smooth((y - (footTopY - ANKLE_BLEND)) / ANKLE_BLEND);
                ["x", "z", "a", "b"].forEach(function (q) { ring[q] += (cone[q] - ring[q]) * s; });
                return { c: [side * ring.x, y, ring.z], u: [1, 0, 0], w: [0, 0, 1], a: ring.a, b: ring.b };
            }));
        var footRaw = B.generateRingSurface(footRings, STEPS, C.FUR, true);
        footMeshes.push(footRaw);                          // normals shared with the leg below
        var foot = make(null, "Foot" + tag);
        footObjects.push([foot, LP]);
        leg.childs.push(foot);

        // claws: three short B-spline curves on the front of the foot, drawn with small balls
        [-2.7, 0, 2.7].forEach(function (dx, k) {
            var curve = B.generateBSpline([dx, 2.4, dx + 0.08 * Math.sign(dx), 1.4, dx, 0.5], 24, 2);
            var claw = make(B.generateEllipsoid(0.11, 0.11, 0.11, 12, 12, C.BLACK), "Claw" + tag + k);
            for (var i = 0; i < curve.length; i += 2) {
                var x = curve[i], y = curve[i + 1], r = lookup(footRows, y);
                var zc = (r[2] + r[3]) / 2, b = (r[2] - r[3]) / 2;
                var z = zc + b * Math.sqrt(Math.max(0, 1 - Math.pow(x / r[1], 2)));   // front of the ellipse
                claw.instances.push(sub([side * FOOT_X + x, y, z + 0.02], LP));
            }
            leg.childs.push(claw);
        });

        // sole pad: a flat black ellipsoid just under the flat sole
        function solePad(name, x, z, rx, rz) {
            var pad = make(B.generateEllipsoid(rx, 0.09, rz, 16, 32, C.BLACK), name);
            place(pad, sub([side * FOOT_X + x, 0.07, z], LP));   // pokes 0.02 cm below the sole
            leg.childs.push(pad);
        }
        // one BIG oval pad filling most of the flat sole
        solePad("SolePad" + tag, 0, 0.3, 3.25, 3.9);
    });

    // torso + both legs are one continuous skin: share their normals so the
    // joins don't show, then move each mesh to its joint (pivot)
    B.shareNormals([torsoMesh].concat(legMeshes, footMeshes));
    function setMesh(obj, mesh) { obj.vertex = mesh.vertices; obj.faces = mesh.faces; }
    setMesh(torso, B.shiftMesh(torsoMesh, PIVOT.torso));
    legObjects.forEach(function (o, k) { setMesh(o[0], B.shiftMesh(legMeshes[k], o[1])); });
    footObjects.forEach(function (o, k) { setMesh(o[0], B.shiftMesh(footMeshes[k], o[1])); });

    // ---------------- TAIL ----------------
    var tail = make(B.generateEllipsoid(2.2, 2.2, 2.2, 40, 40, C.FUR), "Tail");
    place(tail, sub([0, 14.8, -7.7], PIVOT.torso));
    torso.childs.push(tail);

    return poby;
}

// =====================================================================
//  MEASURE — the lowest and highest point of the whole model (cm),
//  using the same matrix order as MyObject.render()
// =====================================================================
function measurePoby(root) {
    var min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    (function visit(obj, PARENT) {
        var M = LIBS.multiply(LIBS.multiply(obj.MOVE_MATRIX, obj.POSITION_MATRIX), PARENT);
        var list = obj.instances.length ? obj.instances : [[0, 0, 0]];
        for (var i = 0; i < obj.vertex.length; i += 9) {
            list.forEach(function (o) {
                var x = obj.vertex[i] + o[0], y = obj.vertex[i + 1] + o[1], z = obj.vertex[i + 2] + o[2];
                var p = [M[0]*x + M[4]*y + M[8]*z + M[12], M[1]*x + M[5]*y + M[9]*z + M[13], M[2]*x + M[6]*y + M[10]*z + M[14]];
                for (var k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
            });
        }
        obj.childs.forEach(function (c) { visit(c, M); });
    })(root, LIBS.get_I4());
    return { min: min, max: max, height: max[1] - min[1] };
}


// =====================================================================
//  createPoby(GL) — builds Poby in the scene's WebGL context and returns
//     root          : Poby's MyObject root (soles at y = 0, 6.80 units tall)
//     update(t)     : animation (Poby has none yet -> empty)
//     draw(scene)   : draw Poby. scene = { P, V, M, camPos }
//                     M = the world matrix where Poby stands (from main.js)
// =====================================================================
export function createPoby(GL) {
    /*========================= SHADERS ========================= */
    // Phong shading (pertemuan 6): ambient + diffuse + specular
    var shader_vertex_source = `
        attribute vec3 position;
        attribute vec3 color;
        attribute vec3 normal;
        uniform mat4 Pmatrix, Vmatrix, Mmatrix;
        varying vec3 vColor;
        varying vec3 vNormal;
        varying vec3 vView;

        void main(void) {
            gl_Position = Pmatrix * Vmatrix * Mmatrix * vec4(position, 1.);
            vColor  = color;
            vNormal = vec3(Mmatrix * vec4(normal, 0.));
            vView   = vec3(Vmatrix * Mmatrix * vec4(position, 1.));
        }`;

    var shader_fragment_source = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;             // smooth light / highlights (mediump makes blotches)
        #else
        precision mediump float;
        #endif
        varying vec3 vColor;
        varying vec3 vNormal;
        varying vec3 vView;

        const vec3 source_direction = vec3(0.45, 0.7, 0.8);   // light comes from front-top-right
        const vec3 ambient_light    = vec3(0.45);
        const vec3 diffuse_light    = vec3(0.65);
        const vec3 specular_light   = vec3(0.18);
        const float shininess       = 20.;

        void main(void) {
            vec3 N = normalize(vNormal);
            if (!gl_FrontFacing) N = -N;           // inside of the ear cups
            vec3 L = normalize(source_direction);
            vec3 V = normalize(-vView);            // towards the camera
            vec3 R = reflect(-L, N);               // reflected light

            vec3 I_ambient  = ambient_light * vColor;
            vec3 I_diffuse  = diffuse_light * vColor * max(0., dot(N, L));
            vec3 I_specular = specular_light * pow(max(dot(R, V), 0.), shininess);

            gl_FragColor = vec4(I_ambient + I_diffuse + I_specular, 1.);
        }`;

    var compile_shader = function (source, type, typeString) {
        var shader = GL.createShader(type);
        GL.shaderSource(shader, source);
        GL.compileShader(shader);
        if (!GL.getShaderParameter(shader, GL.COMPILE_STATUS)) {
            alert("ERROR IN " + typeString + " SHADER: " + GL.getShaderInfoLog(shader));
            return false;
        }
        return shader;
    };
    var shader_vertex = compile_shader(shader_vertex_source, GL.VERTEX_SHADER, "VERTEX");
    var shader_fragment = compile_shader(shader_fragment_source, GL.FRAGMENT_SHADER, "FRAGMENT");

    var SHADER_PROGRAM = GL.createProgram();
    GL.attachShader(SHADER_PROGRAM, shader_vertex);
    GL.attachShader(SHADER_PROGRAM, shader_fragment);
    // same attribute slots as Eddy & Loopy (0, 1, 2), because they share one WebGL context
    GL.bindAttribLocation(SHADER_PROGRAM, 0, "position");
    GL.bindAttribLocation(SHADER_PROGRAM, 1, "color");
    GL.bindAttribLocation(SHADER_PROGRAM, 2, "normal");
    GL.linkProgram(SHADER_PROGRAM);

    var _position = GL.getAttribLocation(SHADER_PROGRAM, "position");
    var _color    = GL.getAttribLocation(SHADER_PROGRAM, "color");
    var _normal   = GL.getAttribLocation(SHADER_PROGRAM, "normal");
    GL.enableVertexAttribArray(_position);
    GL.enableVertexAttribArray(_color);
    GL.enableVertexAttribArray(_normal);

    var _Pmatrix = GL.getUniformLocation(SHADER_PROGRAM, "Pmatrix");
    var _Vmatrix = GL.getUniformLocation(SHADER_PROGRAM, "Vmatrix");
    var _Mmatrix = GL.getUniformLocation(SHADER_PROGRAM, "Mmatrix");
    GL.useProgram(SHADER_PROGRAM);

    /*========================= POBY ========================= */
    var make = function (mesh, name) {
        return new MyObject(GL, SHADER_PROGRAM, _position, _color, _normal, _Mmatrix, mesh, name);
    };
    var poby = buildPoby(make);

    // Poby is built in cm with her feet on y = 0. Measure her, then scale
    // cm -> units and lift her so her lowest point (the soles) is exactly y = 0.
    var box = measurePoby(poby);
    LIBS.scaleX(poby.POSITION_MATRIX, CM_TO_UNIT);
    LIBS.scaleY(poby.POSITION_MATRIX, CM_TO_UNIT);
    LIBS.scaleZ(poby.POSITION_MATRIX, CM_TO_UNIT);
    LIBS.translateY(poby.POSITION_MATRIX, -box.min[1] * CM_TO_UNIT);
    console.log(
        "Height: " + box.height.toFixed(2) + " cm × " + CM_TO_UNIT.toFixed(4) + " = " +
        (box.height * CM_TO_UNIT).toFixed(2) + " units");
    window.poby = poby;
    poby.setup();

    return {
        name: "Poby",
        root: poby,
        update: function (t) { },
        draw: function (scene) {
            GL.useProgram(SHADER_PROGRAM);
            GL.uniformMatrix4fv(_Pmatrix, false, scene.P);
            GL.uniformMatrix4fv(_Vmatrix, false, scene.V);
            // MyObject.render: MODEL = MOVE x POSITION x PARENT (course order) = scene.M * POSITION * MOVE
            poby.render(scene.M);
        }
    };
}
