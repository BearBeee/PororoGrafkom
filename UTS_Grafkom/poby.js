// Poby uses the COURSE matrix library (POBY_LIBS), imported under the name LIBS
// so the code below is the same as in Poby's own project.
import { POBY_LIBS as LIBS } from "./helpers/libs.js";
import { MyObject } from "./helpers/node.js";
import { POBY_BUILDERS as B } from "./helpers/builders.js";
import { Rig, SkinnedMesh, smoothstep, bakeMesh, M4 } from "./helpers/rig.js";
import { buildBubbleProps, createStory } from "./poby_story.js";

// =====================================================================
//  POBY MODEL — Poby the polar bear: measurements + hierarchy + rig
//
//  This file holds Poby's MEASUREMENTS (tables in cm) and builds the
//  HIERARCHY from them. The shapes themselves are made by POBY_BUILDERS
//  in helpers/builders.js (pobyBody, pobyHead, pobyArm, pobyPaw, ...),
//  the skeleton + skin by helpers/rig.js.
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
//   - Pads              : rounded rectangles / dots laid on the paw like decals
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
// SIDE SHAPE (from the reference side shots): NO BELLY in front — the front runs
// almost straight down from the chest to the shorts. Instead the BACK is like a
// "backwards belly": ONE long smooth curve that swells out from behind the neck,
// is fullest around the top of the shorts (y ~14, a chubby -12.6 cm) and then curves back in through
// the shorts down to the cuffs (the legs carry on that curve, see LEG.backFlare).
var TORSO = [
    // below y 16 the legs carry this outline (see LEG), the torso mesh starts at 16
    // (the two lowest rows only guide the back of the shorts, see LEG.backFoldTop)
    [5.5, 9.30, 5.10, -7.6], [7.5, 9.45, 5.30, -8.6],
    [9.5, 9.60, 5.45, -9.9], [10.3, 9.76, 5.55, -10.55], [11.0, 9.82, 5.7, -10.85],
    [11.5, 9.83, 5.8, -11.05], [12.2, 9.85, 6.0, -11.2], [13.0, 9.82, 6.25, -11.35], [14.0, 9.80, 6.5, -11.4],
    [15.2, 9.82, 6.75, -11.35], [16.7, 9.84, 6.9, -11.25], [18.0, 9.80, 6.9, -11.1], [19.7, 9.74, 6.8, -10.85],
    // BROAD, BOXY upper body: the sides stay almost straight up to the chest and
    // only turn in at a rounded shoulder corner near the top (a rounded rectangle
    // from the front instead of a pear). A soft, rounded chest in front (less
    // forward than the belly); the back keeps
    // curving in evenly up to the neck (no dip above the bottom).
    [21.1, 9.70, 6.6, -10.55], [22.6, 9.68, 6.4, -10.15], [24.1, 9.66, 6.15, -9.65], [25.6, 9.62, 5.85, -9.1],
    // the shoulders slope gently down from the neck, like a person's, instead of a hard corner
    [27.1, 9.5, 5.45, -8.5], [28.5, 9.2, 5.0, -7.85], [30.0, 8.7, 4.6, -7.2], [31.5, 7.8, 4.2, -6.55],
    [32.8, 6.5, 3.7, -6.0], [33.6, 5.1, 2.9, -5.3], [34.1, 3.6, 1.6, -4.0], [34.45, 0.00, -0.5, -0.5]
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
    // the heel reaches further back, under the round back of the body (as in the
    // reference side shots the bottom only overhangs the heel by ~3 cm)
    [0.0, 3.9, 5.0, -6.1], [0.5, 4.25, 5.6, -6.75], [1.5, 4.55, 6.2, -7.4], [2.5, 4.55, 6.45, -7.5],
    [3.5, 4.4, 6.25, -7.5], [4.3, 4.15, 5.4, -7.45], [4.8, 4.05, 4.6, -7.45]
];

// ARM centre line in the front view (right arm; the left one is mirrored): [x, y]
// It starts under the body's shoulder line and hangs with one long, soft curve
// (not a sharp bend, and not so much that it reads as an upside-down J).
var ARM_PATH = [6.0, 29.4,  7.9, 28.6,  9.7, 26.9,  11.1, 23.9,  12.0, 20.3,  12.3, 17.2,  12.3, 14.6];
// SHOULDER BACK: the top of the arm moves this far back (cm), so the shoulder sits
// in line with the body instead of hunching forward. It fades out down the arm, so
// the forearm and hand stay where they are.
var ARM_BACK = 0.9;
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
//   pad / dot: [half width, half length, thickness, sink]
var HAND = {
    // A hand that BELONGS to the arm: about as wide as the forearm, a little
    // flatter at the palm, then 3 short rounded fingers + a thumb (4 digits).
    // The fingers are separate (soft creases between them) and curl slightly
    // towards the palm. The thumb sits on the front side (+w), higher up.
    // (a TALL hand: wrist to fingertip ≈ 5.6 cm, longer than it is wide)
    capStart: 3.4, cap: 0.65, capBack: 1.4,
    digits: [
        [[3.3, -0.6, -1.5], [5.25, -0.05, -1.62], 0.9, 0.76],   // finger 0 (back)
        [[3.3, -0.6, 0.0], [5.55, -0.05, 0.0], 0.93, 0.79],     // finger 1 (middle, longest)
        [[3.3, -0.6, 1.45], [5.2, -0.05, 1.55], 0.9, 0.76],     // finger 2
        [[1.8, -0.05, 1.95], [3.4, 0.5, 2.9], 0.88, 0.78]       // thumb (front side)
    ],
    kFingers: 0.28, kPalm: 1.3,
    wristBlend: 2.0,
    foldSmooth: 120, foldAt: 3.6, foldWidth: 1.6,          // soften the fold across the back of the knuckles
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
            // front fold: where the front of the body turns into the legs. Poby has
            // no belly, so it is almost level (foldMid in the middle, foldHip at the
            // hips) and long (foldWidth), so the front runs straight down into the
            // legs. (A high "U" fold at the hips made two lumps on the thighs.)
            foldMid: 10.0, foldHip: 10.6, foldWidth: 7.0,
            // BACK of the legs (the shorts): the back of each leg ring is this many
            // times deeper than the front, so the round back curves on gently down
            // to the cuffs: backFoot at the top of the foot, backFlare at coneTop
            backFoot: 1.46, backFlare: 1.62,
            // ...and SQUARER there (superellipse exponent of the back half), so the
            // back corners of the shorts stay full like the body above them (no pinch)
            backSquare: 2.5,
            // the BACK of the body tucks under into the legs here: the round bottom
            // is whole above backFoldTop, then rolls in over backFoldLen cm onto the
            // straighter backs of the legs, leaving a clear soft crease between the
            // bottom and the legs (seen from behind and from the side)
            backFoldTop: 9.9, backFoldLen: 2.3,
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

// HEAD TILT (degrees) — turns the whole head (with eyes, ears, nose, mouth)
// around the neck joint (PIVOT.head). The head shape itself is drawn with the
// muzzle sloping ~30 degrees down; in the reference the snout points almost
// straight forward, so the head is tipped up. Bigger = nose higher, 0 = original.
var HEAD_TILT = 20;

// BODY CROSS-SECTION: the body's oval is split into a FRONT half and a BACK half
// around a point BODY_BACK_SHARE of the way from the back to the front, so the
// deep round back doesn't thin out the front corners. Higher up (the chest) the
// front gets a bigger share (CHEST_BACK_SHARE), so the chest is a round curve.
var BODY_BACK_SHARE = 0.63, CHEST_BACK_SHARE = 0.50;

// EAR outline, [r, z]: r = distance from the ear's centre line, z = forwards.
// Starts in the middle of the back (r 0), rounds over the rim (widest r ≈ 1.75)
// and ends in the middle of the front hollow (r 0).
var EAR_PROFILE = [[0, -0.8], [0.95, -0.8], [1.65, -0.6], [1.95, -0.05], [1.75, 0.55],
                   [1.2, 0.72], [0.8, 0.22], [0.45, 0.08], [0, 0.08]];
var EAR_CUP_DROP = 0.3;    // the hollow sits a little low -> thicker rim on top (a soft "C")
// how far the ears tip forward (radians): + = opening faces more downward, 0 = straight
var EAR_DROOP = 0.8;

// MOUTH (right half, mirrored for the left): points on the cheek [depth z, height y],
// from the back of the cheek towards the middle under the muzzle (a wide smile)
var MOUTH = [[6.95, 29.95], [7.3, 29.2], [7.9, 28.55], [8.6, 28.05]];
var MOUTH_R = 0.075;                       // line thickness (radius, cm)

// =====================================================================
//  helpers
// =====================================================================
var sub = B.vec.sub, add = B.vec.add, mul = B.vec.mul, dot = B.vec.dot, normalize = B.vec.normalize, dist = B.vec.dist;

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
function setMesh(obj, mesh) { obj.vertex = mesh.vertices; obj.faces = mesh.faces; }

// =====================================================================
//  BUILD — make(mesh, name) creates a MyObject (see createPoby below)
// =====================================================================
function buildPoby(make) {
    var C = COLORS;
    var poby = make(null, "Poby");
    poby.rigInfo = { arms: {}, legW: {} };

    // ---------------- TORSO + LEGS + FEET (one continuous skin) ----------------
    var body = B.pobyBody({ torso: TORSO, torsoSquare: TORSO_SQUARE, backShare: BODY_BACK_SHARE, chestBackShare: CHEST_BACK_SHARE,
                            leg: LEG, legSteps: LEG_STEPS, foot: FOOT, footX: FOOT_X, ankleBlend: ANKLE_BLEND });
    poby.rigInfo.legTop = body.legTop;
    var torsoMesh = body.torsoMesh(C.FUR);
    var torso = make(null, "Torso");                       // mesh set at the end, after the legs
    place(torso, PIVOT.torso);
    poby.childs.push(torso);
    var legMeshes = [], legObjects = [], footMeshes = [], footObjects = [];

    // ---------------- HEAD ----------------
    var headShape = B.pobyHead(HEAD, HEAD_SQUARE, 96, C.FUR);
    var head = make(B.shiftMesh(headShape.mesh, PIVOT.head), "Head");
    place(head, sub(PIVOT.head, PIVOT.torso), [-HEAD_TILT * Math.PI / 180, 0, 0]);   // tip the head up (see HEAD_TILT)
    torso.childs.push(head);
    function inHead(p) { return sub(p, PIVOT.head); }

    // nose
    var nose = make(B.generateEllipsoid(2.5, 2.25, 1.35, 48, 48, C.BLACK), "Nose");
    place(nose, inHead([0, 31.3, 12.3]));
    head.childs.push(nose);

    // ---------------- MOUTH ----------------
    // ONE line from the left cheek, around the underside of the muzzle, to the
    // right cheek. Control points in "head surface" coordinates [z, angle around
    // the head ring] (-π/2 = straight down, 0 = right side, -π = left side), so
    // every point lies on the head. Drawn as a thin tube with a dot at each end.
    var right = MOUTH.map(function (m) { return [m[0], headShape.angleOf(m[0], m[1])]; })
                     .concat([[9.2, -1.3], [9.5, -Math.PI / 2]]);
    var mouthCP = [];
    for (var k = 0; k < right.length - 1; k++) mouthCP.push(right[k][0], -Math.PI - right[k][1]);   // left cheek (mirror)
    for (var k = right.length - 1; k >= 0; k--) mouthCP.push(right[k][0], right[k][1]);            // middle -> right cheek
    var mouthLine = B.generateHeadLine(headShape, mouthCP, MOUTH_R, C.MOUTH);
    var mouth = make(B.shiftMesh(mouthLine.mesh, PIVOT.head), "Mouth");
    var mouthEnds = make(B.generateEllipsoid(MOUTH_R, MOUTH_R, MOUTH_R, 12, 12, C.MOUTH), "MouthEnds");
    mouthEnds.instances.push(inHead(mouthLine.ends[0]), inHead(mouthLine.ends[1]));
    mouth.childs.push(mouthEnds);
    head.childs.push(mouth);

    // ---------------- both sides ----------------
    [-1, 1].forEach(function (side) {
        var tag = side < 0 ? "L" : "R";

        // eyes: small black balls on the face, with a white shine
        var ey = 37.6, ex = side * 1.95, ez = headShape.frontZ(ex, ey) - 0.1;
        var eye = make(B.generateEllipsoid(0.44, 0.44, 0.34, 32, 32, C.BLACK), "Eye" + tag);
        place(eye, inHead([ex, ey, ez]));
        var shine = make(B.generateEllipsoid(0.1, 0.1, 0.06, 16, 16, C.SHINE), "EyeShine" + tag);
        place(shine, [0.13, 0.14, 0.3]);
        eye.childs.push(shine);
        head.childs.push(eye);

        // ears: on the top corners, turned a little outwards, and tipped forward
        // (EAR_DROOP) so the opening faces slightly DOWN, like the reference
        var ear = make(null, "Ear" + tag);
        place(ear, inHead([side * 6.5, 40.5, 0.3]), [EAR_DROOP, side * 0.38, -side * 0.3]);
        ear.childs.push(make(B.generatePobyEar(EAR_PROFILE, EAR_CUP_DROP, C.FUR, C.EARIN), "EarShell" + tag));
        head.childs.push(ear);

        // ---------------- ARM (shoulder joint) ----------------
        var AP = [side * PIVOT.arm[0], PIVOT.arm[1], PIVOT.arm[2]];
        var arm = make(null, "Arm" + tag);
        place(arm, sub(AP, PIVOT.torso));
        torso.childs.push(arm);
        var RING = 64, armShape = B.pobyArm(ARM_PATH, ARM_SIZE, side, ARM_Z, ARM_BACK, RING);
        var wristC = armShape.wrist;

        // ---------------- HAND (paw) ----------------
        var paw = B.pobyPaw({ hand: HAND, palm: PALM, armR: ARM_R, wrist: wristC, U: armShape.U, W: armShape.W, D: armShape.D,
                              top: armShape.rings[armShape.rings.length - 1], RING: RING });
        var armRaw = B.generateRingSurfaceFromPoints(armShape.rings, C.FUR, side > 0);
        var pawRaw = B.generateRingSurfaceFromPoints(paw.rings, C.FUR, side > 0);
        B.shareNormals([armRaw, pawRaw]);                     // no shading line at the wrist

        var armMesh = make(B.shiftMesh(armRaw, AP), "ArmSurface" + tag);
        // shoulder: an ellipsoid the same size as the first arm ring, turned to match it
        var shoulder = make(B.orientMesh(B.generateEllipsoid(ARM_SIZE[0][1], ARM_SIZE[0][1], ARM_SIZE[0][2], 40, 40, C.FUR),
                                         sub(armShape.shoulder, AP), armShape.U0, armShape.D0, armShape.W), "Shoulder" + tag);
        arm.childs.push(armMesh, shoulder);

        var hand = make(B.shiftMesh(pawRaw, wristC), "Hand" + tag);   // wrist joint + paw skin
        place(hand, sub(wristC, AP));
        arm.childs.push(hand);
        // remember the arm's joints + centre line for the rig (see rigPoby)
        poby.rigInfo.arms[tag] = { side: side, centres: armShape.centres, down: armShape.D, wrist: wristC, shoulder: armShape.shoulder };

        // black pads, laid on the paw like decals: a big palm pad in the middle of
        // the palm and a round dot on the palm side of every finger and the thumb
        var Up = armShape.U;
        hand.childs.push(make(paw.pad(paw.P(HAND.padAt[0], 0, HAND.padAt[1]), Up, HAND.pad, HAND.padRound, wristC, C.BLACK), "PalmPad" + tag));
        paw.digits.forEach(function (g, k) {
            var A = paw.P(g.A[0], g.A[1], g.A[2]), Bt = paw.P(g.B[0], g.B[1], g.B[2]);
            var mid = add(A, mul(sub(Bt, A), HAND.dotAt)), along = normalize(sub(Bt, A));
            var dir = normalize(sub(Up, mul(along, dot(Up, along))));     // palm side, square to the finger
            hand.childs.push(make(paw.pad(mid, dir, HAND.dot, 2, wristC, C.BLACK), (k === 3 ? "ThumbPad" : "FingerPad" + k) + tag));
        });

        // ---------------- LEG (hip joint) + FOOT ----------------
        var LP = [side * PIVOT.leg[0], PIVOT.leg[1], PIVOT.leg[2]];
        var leg = make(null, "Leg" + tag);
        place(leg, sub(LP, PIVOT.torso));
        torso.childs.push(leg);

        var legShape = body.leg(side, C.FUR);
        poby.rigInfo.legW[tag] = legShape.weights;            // rig weight of every leg point
        legMeshes.push(legShape.mesh);
        var thigh = make(null, "LegSurface" + tag);           // mesh set at the end, after both legs
        legObjects.push([thigh, LP]);
        leg.childs.push(thigh);

        footMeshes.push(body.foot(side, C.FUR));
        var foot = make(null, "Foot" + tag);
        footObjects.push([foot, LP]);
        leg.childs.push(foot);

        // claws: three short B-spline curves on the front of the foot, drawn with small balls
        [-2.7, 0, 2.7].forEach(function (dx, k) {
            var curve = B.generateBSpline([dx, 2.4, dx + 0.08 * Math.sign(dx), 1.4, dx, 0.5], 24, 2);
            var claw = make(B.generateEllipsoid(0.11, 0.11, 0.11, 12, 12, C.BLACK), "Claw" + tag + k);
            for (var i = 0; i < curve.length; i += 2) {
                var x = curve[i], y = curve[i + 1], r = B.lookup(body.footRows, y);
                var zc = (r[2] + r[3]) / 2, b = (r[2] - r[3]) / 2;
                var z = zc + b * Math.sqrt(Math.max(0, 1 - Math.pow(x / r[1], 2)));   // front of the ellipse
                claw.instances.push(sub([side * FOOT_X + x, y, z + 0.02], LP));
            }
            leg.childs.push(claw);
        });

        // sole pad: one big flat black oval just under the flat sole
        var sole = make(B.generateEllipsoid(3.25, 0.09, 4.6, 16, 32, C.BLACK), "SolePad" + tag);
        place(sole, sub([side * FOOT_X, 0.07, -0.55], LP));   // pokes 0.02 cm below the sole
        leg.childs.push(sole);
    });

    // torso + both legs + feet are one continuous skin: share their normals so the
    // joins don't show, then move each mesh to its joint (pivot)
    B.shareNormals([torsoMesh].concat(legMeshes, footMeshes));
    setMesh(torso, B.shiftMesh(torsoMesh, PIVOT.torso));
    legObjects.forEach(function (o, k) { setMesh(o[0], B.shiftMesh(legMeshes[k], o[1])); });
    footObjects.forEach(function (o, k) { setMesh(o[0], B.shiftMesh(footMeshes[k], o[1])); });

    // ---------------- TAIL ----------------
    var tail = make(B.generateEllipsoid(2.2, 2.2, 2.2, 40, 40, C.FUR), "Tail");
    place(tail, sub([0, 14.8, -11.0], PIVOT.torso));    // on the round back
    torso.childs.push(tail);

    return poby;
}

// =====================================================================
//  RIG — the skeleton behind Poby (nothing of it is drawn)
//
//      hips ─┬─ head
//            ├─ tail
//            ├─ shoulderR ─ elbowR ─ wristR       (same for the L side)
//            └─ legR                              (same for the L side)
//
//  After buildPoby, every mesh is moved from the build hierarchy onto the
//  skeleton:
//   - rigid parts hang under one bone (head + face, ears, shoulder balls,
//     paw pads, claws, sole pads, tail, torso)
//   - each ARM (arm + paw) and each LEG (leg + foot) becomes ONE skinned mesh:
//       arm : shoulder ─(soft elbow)─ forearm ─(soft wrist)─ paw
//       leg : the top of the leg blends into the hips, so swinging a leg
//             bends the skin at the hip instead of cracking open
//  The shoulder bone turns around the centre of the shoulder ball, so the arm
//  always comes out of the ball (a ball-and-socket joint): no gap at any angle.
// =====================================================================
// where along the arm the elbow sits (0 = shoulder, 1 = wrist) and how soft the joints are (cm)
var RIG_ELBOW_AT = 0.47, RIG_ELBOW_SOFT = 2.4, RIG_WRIST_SOFT = 1.8;
// legs: a leg point moves with the leg as much as it is "leg-shaped" (0 = still
// body, 1 = leg). Below RIG_LEG_START it stays with the hips, so the round bottom
// and belly stay put and the bend happens in the crease where the leg begins.
var RIG_LEG_START = 0.2;
var TAIL_ROOT = [0, 14.8, -9.5];
// the WAIST joint (the upper body bends / sways here) and the BREATH joint
// (the chest + belly scale around it), in cm
var WAIST_JOINT = [0, 18.5, -1.5], BREATH_JOINT = [0, 23.5, -1.5];

function rigPoby(poby, make, makeSkin) {
    var info = poby.rigInfo, rig = new Rig(make);

    // ---------------- bones ----------------
    var hips = rig.addBone("hips", null, PIVOT.torso);
    // waist: the upper body (torso top, head, arms) turns around here; legs and tail stay on the hips
    rig.addBone("waist", "hips", WAIST_JOINT);
    // breath: scales the chest + belly only (big breath in / out), around the middle of the belly
    rig.addBone("breath", "waist", BREATH_JOINT);
    rig.addBone("head", "waist", PIVOT.head);
    rig.addBone("tail", "hips", TAIL_ROOT);
    ["R", "L"].forEach(function (tag) {
        var a = info.arms[tag], m = a.side, C = a.centres;
        // elbow: RIG_ELBOW_AT of the way along the arm's centre line
        var len = [0];
        for (var i = 1; i < C.length; i++) len.push(len[i - 1] + dist(C[i], C[i - 1]));
        a.len = len; a.sElbow = len[len.length - 1] * RIG_ELBOW_AT; a.sWrist = len[len.length - 1];
        var k = 1; while (len[k] < a.sElbow) k++;
        var f = (a.sElbow - len[k - 1]) / (len[k] - len[k - 1]);
        a.elbow = add(C[k - 1], mul(sub(C[k], C[k - 1]), f));
        rig.addBone("shoulder" + tag, "waist", a.shoulder, m);
        rig.addBone("elbow" + tag, "shoulder" + tag, a.elbow, m);
        rig.addBone("wrist" + tag, "elbow" + tag, a.wrist, m);
        rig.addBone("leg" + tag, "hips", [m * PIVOT.leg[0], PIVOT.leg[1], PIVOT.leg[2]], m);
    });
    // ---------------- sort every mesh onto the skeleton ----------------
    var armParts = { R: [], L: [] }, legParts = { R: [], L: [] }, torsoParts = [];
    var all = [];
    (function visit(obj, PARENT, path) {
        var M = LIBS.multiply(LIBS.multiply(obj.MOVE_MATRIX, obj.POSITION_MATRIX), PARENT);
        if (obj.faces.length) all.push({ obj: obj, M: M, path: path.concat(obj.name) });
        obj.childs.forEach(function (c) { visit(c, M, path.concat(obj.name)); });
    })(poby, LIBS.get_I4(), []);
    poby.childs = [hips.node];                         // the skeleton replaces the build hierarchy

    all.forEach(function (it) {
        var n = it.obj.name, path = it.path;
        var has = function (re) { for (var i = 0; i < path.length; i++) { var m = re.exec(path[i]); if (m) return m; } return null; };
        var m;
        if ((m = /^(ArmSurface|Hand)([RL])$/.exec(n))) armParts[m[2]].push(it);
        else if ((m = /^(LegSurface|Foot)([RL])$/.exec(n))) legParts[m[2]].push(it);
        else if ((m = has(/^Hand([RL])$/)))     rig.attachRigid("wrist" + m[1], it.obj, it.M);      // paw pads
        else if ((m = /^Shoulder([RL])$/.exec(n))) rig.attachRigid("shoulder" + m[1], it.obj, it.M);
        else if ((m = has(/^Leg([RL])$/)))      rig.attachRigid("leg" + m[1], it.obj, it.M);        // claws, sole pad
        else if (has(/^Head$/))                 rig.attachRigid("head", it.obj, it.M);              // head, face, ears
        else if (n === "Tail")                  rig.attachRigid("tail", it.obj, it.M);
        else if (n === "Torso")                 torsoParts.push(it);                                  // skinned below
        else                                    rig.attachRigid("hips", it.obj, it.M);              // torso
    });

    // join several baked meshes into one
    function joinMeshes(parts) {
        var v = [], f = [];
        parts.forEach(function (it) {
            var base = v.length / 9, baked = bakeMesh(it.obj.vertex, it.M).vertices;
            for (var i = 0; i < baked.length; i++) v.push(baked[i]);
            for (var i = 0; i < it.obj.faces.length; i++) f.push(it.obj.faces[i] + base);
        });
        return { vertices: v, faces: f };
    }

    ["R", "L"].forEach(function (tag) {
        // ---------------- ARM SKIN: shoulder / forearm / paw weights ----------------
        var a = info.arms[tag], mesh = joinMeshes(armParts[tag]);
        var line = a.centres.concat([add(a.wrist, mul(a.down, 30))]);       // centre line, carried on through the paw
        var lens = a.len.concat([a.len[a.len.length - 1] + 30]);
        var up = rig.get("shoulder" + tag).index, fore = rig.get("elbow" + tag).index, hand = rig.get("wrist" + tag).index;
        var inf = [];
        for (var i = 0; i < mesh.vertices.length; i += 9) {
            var p = [mesh.vertices[i], mesh.vertices[i+1], mesh.vertices[i+2]];
            var s = alongLine(p, line, lens);                                 // how far down the arm this point is (cm)
            var fe = smoothstep(a.sElbow - RIG_ELBOW_SOFT, a.sElbow + RIG_ELBOW_SOFT, s);
            var fw = smoothstep(a.sWrist - RIG_WRIST_SOFT, a.sWrist + 0.2, s);
            inf.push([[up, 1 - fe], [fore, fe * (1 - fw)], [hand, fe * fw]]);
        }
        rig.addSkin(makeSkin(mesh, "ArmSkin" + tag, inf));

        // ---------------- LEG SKIN: hips -> leg ----------------
        var lm = joinMeshes(legParts[tag]), legB = rig.get("leg" + tag).index, linf = [];
        for (var i = 0; i < lm.vertices.length; i += 9) {
            var x = lm.vertices[i], y = lm.vertices[i+1], z = lm.vertices[i+2];
            // weight = how "leg-shaped" the point is (recorded while building the leg);
            // feet are all leg. RIG_LEG_START pushes the movement a little lower so
            // the start of the bend sits in the crease under the bottom.
            var f = info.legW[tag][B.rigKey(x, y, z)];
            var w = (f === undefined) ? (y <= info.legTop - 0.01 ? 1 : 0) : smoothstep(RIG_LEG_START, 1, f);
            if (Math.abs(x) < 0.05) w = 0;                // points on the middle line stay with the hips
            linf.push([[0, 1 - w], [legB, w]]);
        }
        rig.addSkin(makeSkin(lm, "LegSkin" + tag, linf));
    });

    // ---------------- TORSO SKIN: hips (bottom) -> waist (upper body) + breath (chest/belly) ----------------
    // the bottom of the torso stays with the hips (so it meets the legs exactly);
    // from the waist up it follows the waist; the chest + belly also follow the
    // breath bone, fading out towards the neck and the hips, so scaling it swells
    // the middle of the body smoothly
    if (torsoParts.length) {
        var tm = joinMeshes(torsoParts), wB = rig.get("waist").index, bB = rig.get("breath").index, tinf = [];
        for (var i = 0; i < tm.vertices.length; i += 9) {
            var y = tm.vertices[i + 1];
            var up = smoothstep(16.5, 21.5, y);
            var br = up * smoothstep(17.0, 21.0, y) * (1 - smoothstep(27.0, 31.5, y));
            tinf.push([[0, 1 - up], [wB, up - br], [bB, br]]);
        }
        rig.addSkin(makeSkin(tm, "TorsoSkin", tinf));
    }

    rig.apply();
    return rig;
}

// distance along a poly-line (with cumulative lengths) of the point closest to p
function alongLine(p, line, lens) {
    var best = Infinity, s = 0;
    for (var i = 0; i < line.length - 1; i++) {
        var a = line[i], d = sub(line[i + 1], a), L2 = dot(d, d) || 1e-9;
        var t = Math.min(Math.max(dot(sub(p, a), d) / L2, 0), 1);
        var q = add(a, mul(d, t)), e = dist(p, q);
        if (e < best) { best = e; s = lens[i] + (lens[i + 1] - lens[i]) * t; }
    }
    return s;
}

// =====================================================================
//  FACE — the eyes can close (they are squashed flat around their own
//  centre: T(c) · S(1, k, 1) · T(-c)); k = 1 open, ~0.1 shut
// =====================================================================
function makeFace(rig) {
    var head = rig.get("head").node, eyes = [];
    ["L", "R"].forEach(function (tag) {
        var eye = head.childs.filter(function (c) { return c.name === "Eye" + tag; })[0];
        var shine = head.childs.filter(function (c) { return c.name === "EyeShine" + tag; })[0];
        if (!eye) return;
        var c = [0, 0, 0], n = eye.vertex.length / 9;
        for (var i = 0; i < eye.vertex.length; i += 9) { c[0] += eye.vertex[i] / n; c[1] += eye.vertex[i + 1] / n; c[2] += eye.vertex[i + 2] / n; }
        eyes.push({ objs: [eye].concat(shine ? [shine] : []), c: c });
    });
    return {
        setEyes: function (k) {
            k = Math.max(k, 0.06);
            eyes.forEach(function (e) {
                var M = M4.mul(M4.T(e.c[0], e.c[1], e.c[2]), M4.mul(M4.S(1, k, 1), M4.T(-e.c[0], -e.c[1], -e.c[2])));
                e.objs.forEach(function (o) { o.MOVE_MATRIX = M; });
            });
        }
    };
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
//     update(t)     : the bubble-wand storyline at time t (poby_story.js)
//     draw(scene)   : draw Poby. scene = { P, V, M, camPos }
//                     M = the world matrix where Poby stands (from main.js)
// =====================================================================
// opts.showcaseTurn: degrees to turn Poby in the 45-60 s showcase so he faces the
//   camera (in the combined scene: -PLACEMENT.Poby.turn in degrees, e.g. -12.6)
export function createPoby(GL, opts) {
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
        uniform float uAlpha;                  // 1 = solid (everything), < 1 = see-through (the soap bubble)

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

            if (uAlpha > 0.999) {
                gl_FragColor = vec4(I_ambient + I_diffuse + I_specular, 1.);
            } else {
                // SOAP BUBBLE: almost clear in the middle, rainbow-tinted and brighter at
                // the rim (where we look through more film), with a strong highlight
                float rim = pow(1. - abs(dot(N, V)), 2.);
                float hi  = pow(max(dot(R, V), 0.), 40.);
                vec3 film = mix(vec3(1.), vColor, 0.75) * (0.75 + 0.35 * rim);
                gl_FragColor = vec4(film + vec3(hi * 1.2), clamp(uAlpha * (0.12 + 0.95 * rim) + hi * 0.9, 0., 1.));
            }
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
    var _alpha   = GL.getUniformLocation(SHADER_PROGRAM, "uAlpha");
    GL.useProgram(SHADER_PROGRAM);
    GL.uniform1f(_alpha, 1.0);

    /*========================= POBY ========================= */
    var make = function (mesh, name) {
        return new MyObject(GL, SHADER_PROGRAM, _position, _color, _normal, _Mmatrix, mesh, name);
    };
    // a see-through object (the soap bubble): blended, does not hide what is behind it
    var makeGlass = function (mesh, name) {
        var o = make(mesh, name);
        o.alpha = 0.4;
        o.render = function (PARENT_MATRIX) {
            var M = LIBS.multiply(LIBS.multiply(this.MOVE_MATRIX, this.POSITION_MATRIX), PARENT_MATRIX);
            if (M[0] === 0 && M[5] === 0 && M[10] === 0) return;           // scaled to nothing = hidden
            GL.useProgram(SHADER_PROGRAM);
            GL.enable(GL.BLEND); GL.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA); GL.depthMask(false);
            GL.uniform1f(_alpha, this.alpha);
            this.draw(M);
            GL.uniform1f(_alpha, 1.0); GL.depthMask(true); GL.disable(GL.BLEND);
        };
        return o;
    };
    var makeSkin = function (mesh, name, influences) {
        return new SkinnedMesh(GL, SHADER_PROGRAM, _position, _color, _normal, _Mmatrix, mesh, name, influences);
    };
    var poby = buildPoby(make);
    var rig = rigPoby(poby, make, makeSkin);           // skeleton + skinned arms/legs (see RIG above)

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
    var face = makeFace(rig);
    // the bubble wand (right paw) + the soap bubble
    var bubbles = buildBubbleProps(make, makeGlass, rig, poby.rigInfo.arms.R, poby);
    // the storyline: bubble wand (poby_story.js)
    var story = createStory(rig, face, bubbles, opts);
    poby.setup();

    return {
        name: "Poby",
        root: poby,
        // THE STORYLINE: t = global time in seconds (loops every 60 s), see poby_story.js
        update: function (t) { story.update(t); },
        draw: function (scene) {
            rig.apply();                                   // pose the skeleton + bend the skin (only if something changed)
            GL.useProgram(SHADER_PROGRAM);
            GL.uniformMatrix4fv(_Pmatrix, false, scene.P);
            GL.uniformMatrix4fv(_Vmatrix, false, scene.V);
            GL.uniform1f(_alpha, 1.0);
            // MyObject.render: MODEL = MOVE x POSITION x PARENT (course order) = scene.M * POSITION * MOVE
            poby.render(scene.M);
        }
    };
}
