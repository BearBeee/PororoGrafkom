// =====================================================================
//  poby_story.js — Poby's storyline ("bubble wand")
//
//  (global time t in seconds, loops every 60 s)
//    00–10  Opening      holding a little bubble wand down at his side, breathing
//    10–20  Poby's turn
//      10.0–11.2  raises the wand to his mouth: the SHOULDER lifts the upper arm,
//                 the ELBOW bends the forearm, the WRIST turns the paw, and the
//                 wand rides at the end of the chain ............ HIERARCHY
//      11.2–12.6  a big breath in: his chest + belly swell ...... SCALING
//      12.6–13.9  blows: the chest goes down again while a bubble grows on the ring
//      13.9–14.4  the bubble floats off; his head starts to follow it
//      14.4–16.4  he walks 3 steps after it ...................... TRANSLATION
//      13.9–19.2  his head keeps turning / tilting to watch it .. ROTATION (Y + X)
//      16.6–18.6  it wobbles side to side above him and he leans with it: his
//                 upper body turns about the diagonal axis
//                 n = (1, 0, -1)/√2 through the waist .......... ARBITRARY-AXIS ROTATION
//                 (the bubble itself spins on a tilted axis too)
//      18.6–20.0  it floats down onto his nose and POPS — he flinches, hops, laughs
//    20–45  Loopy & Eddy  steps back into line and watches them (Loopy 20–35, Eddy 30–45)
//    45–60  Showcase      faces the camera; a 4.6 s combo three times: raise the
//                         wand, breathe in, blow a bubble, step after it, follow it
//                         with his head and lean with it
//
//  Matrices: helpers/rig.js (M4.T, M4.S, M4.mul, M4.rotAxis).
//  Prop meshes (wand, bubble): POBY_BUILDERS in helpers/builders.js.
// =====================================================================
import { M4, smoothstep } from "./helpers/rig.js";
import { POBY_BUILDERS as B } from "./helpers/builders.js";

var DEG = Math.PI / 180;

var STORY = {
    LENGTH: 60,
    WALK: 12,                                   // cm he walks after the bubble (3 steps)
    LEAN_AXIS: [1, 0, -1],                      // diagonal axis for leaning with the bubble
    BREATH_MAX: [1.18, 1.05, 1.2],              // chest + belly at the top of the big breath
    BUBBLE_R: 3.3                               // bubble radius (cm)
};

// ---------------------------------------------------------------------
//  helpers
// ---------------------------------------------------------------------
function clamp(x, a, b) { return Math.min(Math.max(x, a), b); }
function clamp01(x) { return clamp(x, 0, 1); }
function ss(a, b, t) { return smoothstep(a, b, t); }
function bump(a, b, c, d, t) { return ss(a, b, t) * (1 - ss(c, d, t)); }
function lerp(a, b, k) { return a + (b - a) * k; }
function lerp3(a, b, k) { return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; }
function add3(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scale3(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
var cross = B.vec.cross, norm = B.vec.normalize;
function keys(K, t) {
    if (t <= K[0][0]) return K[0][1];
    for (var i = 1; i < K.length; i++) if (t <= K[i][0]) return lerp(K[i - 1][1], K[i][1], ss(K[i - 1][0], K[i][0], t));
    return K[K.length - 1][1];
}
// a smooth path through points [[t, [x,y,z]], ...] (Catmull-Rom)
function path(K, t) {
    if (t <= K[0][0]) return K[0][1];
    if (t >= K[K.length - 1][0]) return K[K.length - 1][1];
    var i = 1; while (K[i][0] < t) i++;
    var p0 = K[Math.max(i - 2, 0)][1], p1 = K[i - 1][1], p2 = K[i][1], p3 = K[Math.min(i + 1, K.length - 1)][1];
    var u = (t - K[i - 1][0]) / (K[i][0] - K[i - 1][0]), u2 = u * u, u3 = u2 * u;
    return [0, 1, 2].map(function (k) {
        return 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3);
    });
}

// walking with the feet on the ground
var LEG_LEN = 11.0, LIFT = 10;
function walk(T, z0, moves) {
    var f = { R: z0, L: z0 }, lift = { R: 0, L: 0 }, dir = 1;
    moves.forEach(function (m) {
        if (T >= m[3]) {
            var k = clamp01((T - m[3]) / (m[4] - m[3]));
            f[m[0]] = lerp(m[1], m[2], ss(0, 1, k));
            if (k < 1) { lift[m[0]] = Math.sin(Math.PI * k); dir = m[2] >= m[1] ? 1 : -1; }
        }
    });
    var hz = (f.R + f.L) / 2, tR = Math.atan2(f.R - hz, LEG_LEN), tL = Math.atan2(f.L - hz, LEG_LEN);
    var planted = lift.R > 0 ? tL : tR;
    return { hz: hz, hy: -LEG_LEN * (1 - Math.cos(planted)) + 0.4 * (lift.R + lift.L),
             legR: tR / DEG + dir * LIFT * lift.R, legL: tL / DEG + dir * LIFT * lift.L, sway: 2.5 * (lift.R - lift.L) };
}

// =====================================================================
//  PROPS (cm) — the wand under the right wrist bone (stick along the fingers),
//  and the bubble: drawn LAST and see-through, its matrix set every frame
// =====================================================================
var WAND = { RING_Y: 8.0, ringR: 1.35, stickR: 0.2, STICK: [0.72, 0.52, 0.95], RING: [1.0, 0.55, 0.75] };

export function buildBubbleProps(make, makeGlass, rig, arm, pobyRoot) {
    var bone = rig.get("wristR");
    var D = norm(arm.down), W = [0, 0, 1];
    var grip = [D[0] * 2.3, D[1] * 2.3, D[2] * 2.3];
    var Yp = D, Zp = [-W[0], -W[1], -W[2]], Xp = norm(cross(Yp, Zp));
    var orient = [Xp[0], Xp[1], Xp[2], 0, Yp[0], Yp[1], Yp[2], 0, Zp[0], Zp[1], Zp[2], 0, 0, 0, 0, 1];
    var wand = make(null, "BubbleWand");
    wand.POSITION_MATRIX = M4.mul(M4.T(grip[0], grip[1], grip[2]), orient);
    wand.childs.push(make(B.generateCapsule(WAND.stickR, -1.4, WAND.RING_Y - WAND.ringR, WAND.STICK), "WandStick"));
    wand.childs.push(make(B.generateRing(WAND.ringR, 0.2, [0, WAND.RING_Y, 0], WAND.RING), "WandRing"));
    bone.node.childs.push(wand);

    var bubble = makeGlass(B.generateSoapBubble(), "Bubble");
    bubble.alpha = 0.6;
    bubble.MOVE_MATRIX = M4.S(0, 0, 0);
    pobyRoot.childs.push(bubble);                       // last child -> drawn after the body
    return { wand: wand, bubble: bubble, ringLocal: [0, WAND.RING_Y, 0] };
}

// =====================================================================
//  POSES (degrees)
// =====================================================================
var HOLD = { shoulderR: [5, 0, 6], elbowR: [35, 0, 0], wristR: [0, 0, 0] };
// solved so the ring sits ~3 cm in front of his nose, facing forward
var BLOW = { shoulderR: [26.3, -26.5, 3.4], elbowR: [85.8, 0, 25], wristR: [30.1, -8.6, -1.6] };

// =====================================================================
//  createStory(rig, face, props, opts)
// =====================================================================
export function createStory(rig, face, props, opts) {
    opts = opts || {};
    var S = STORY, TURN = opts.showcaseTurn || 0;      // showcase: degrees to turn and face the camera
    var hipsJ = rig.get("hips").joint, headJ = rig.get("head").joint;

    // where the ring is right now (model space), and which way it faces (away from the face)
    function ringNow() {
        var G = rig.get("wristR").G, Lh = rig.local(rig.get("hips"));
        var M = M4.mul(Lh, M4.mul(G, props.wand.POSITION_MATRIX));
        var p = props.ringLocal, a = [0, 0, 1];
        var c = [M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12] + hipsJ[0],
                 M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13] + hipsJ[1],
                 M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14] + hipsJ[2]];
        var n = norm([M[8], M[9], M[10]]);
        if (n[2] < 0) n = scale3(n, -1);                       // point away from Poby (forward)
        return { c: c, n: n };
    }

    function update(t) {
        var T = ((t % S.LENGTH) + S.LENGTH) % S.LENGTH;
        var P = {}, eyes = 1, lean = 0, breath = 0;
        function get(b) { return P[b] = P[b] || { rot: [0, 0, 0], pos: [0, 0, 0] }; }
        function rot(b, r) { get(b).rot = add3(get(b).rot, r); }
        function pos(b, q) { get(b).pos = add3(get(b).pos, q); }

        // ---------- always: calm breathing, relaxed left arm, tail, idle blinks ----------
        var calm = 0.5 - 0.5 * Math.cos(T * 2 * Math.PI / 3.6);
        pos("hips", [0, 0.1 * calm, 0]);
        rot("shoulderL", [3, 0, 5]); rot("elbowL", [10, 0, 0]);
        rot("tail", [0, 9 * Math.sin(T * 1.3), 0]);
        var bl = (T % 4.3) / 4.3;
        eyes = Math.min(eyes, 1 - 0.9 * bump(0.0, 0.025, 0.03, 0.055, bl));

        // ---------- the wand arm: HOLD <-> BLOW, joint by joint (HIERARCHY) ----------
        //   the shoulder starts first, then the elbow, then the wrist
        var upS = Math.max(ss(10.0, 10.8, T) * (1 - ss(14.4, 15.1, T)), 0);
        var upE = Math.max(ss(10.2, 11.0, T) * (1 - ss(14.5, 15.2, T)), 0);
        var upW = Math.max(ss(10.5, 11.2, T) * (1 - ss(14.6, 15.2, T)), 0);
        // showcase: raise / lower the wand in every 4.6 s cycle
        var SC0 = 45.3, CYC = 4.6, c = -1;
        if (T >= SC0 && T < SC0 + 3 * CYC) c = (T - SC0) % CYC;
        if (c >= 0) {
            var a = ss(0.0, 0.45, c) * (1 - ss(2.25, 2.7, c));
            upS = Math.max(upS, a); upE = Math.max(upE, ss(0.1, 0.5, c) * (1 - ss(2.3, 2.75, c)));
            upW = Math.max(upW, ss(0.2, 0.55, c) * (1 - ss(2.35, 2.8, c)));
        }
        rot("shoulderR", lerp3(HOLD.shoulderR, BLOW.shoulderR, upS));
        rot("elbowR", lerp3(HOLD.elbowR, BLOW.elbowR, upE));
        rot("wristR", lerp3(HOLD.wristR, BLOW.wristR, upW));
        rot("head", [-5 * upS, -6 * upS, 0]);                              // looks at the wand

        // ---------- SCALING: breath in (11.2-12.6), blow out (12.6-13.9) ----------
        breath = keys([[11.2, 0], [12.6, 1], [12.75, 1], [13.9, -0.15], [14.4, 0]], T);
        var blowing = bump(12.6, 12.8, 13.7, 13.95, T);
        if (c >= 0) {
            breath = Math.max(breath, keys([[0.5, 0], [1.3, 0.85], [1.4, 0.85], [2.2, 0]], c));
            blowing = Math.max(blowing, bump(1.35, 1.5, 2.05, 2.2, c));
        }
        rot("head", [7 * Math.max(breath, 0) - 5 * blowing, 0, 0]);       // chin up breathing in, forward blowing
        pos("shoulderR", [0, 0.5 * Math.max(breath, 0), 0]); pos("shoulderL", [0, 0.5 * Math.max(breath, 0), 0]);
        rot("shoulderL", [0, 0, 7 * Math.max(breath, 0)]);
        eyes = Math.min(eyes, 1 - 0.45 * blowing);

        // ---------- the bubble's life: grows on the ring, floats, pops ----------
        // times (story): grow 12.65-13.9, free 13.9-19.25 ; showcase: grow 1.4-2.2, free 2.2-4.4
        var bub = null;                                                    // {grow: 0..1} or {free: position}
        var Z = 0;                                                         // where Poby stands (walk)
        var st = null;
        // TRANSLATION: walk after the bubble (14.4-16.4), back into line (20.3-22.3)
        if (T >= 14.4 && T < 20.3) st = walk(T, 0, [["R", 0, 6, 14.4, 15.05], ["L", 0, 12, 15.05, 15.75], ["R", 6, 12, 15.75, 16.4]]);
        if (T >= 20.3 && T < 45) st = walk(T, S.WALK, [["R", 12, 6, 20.3, 20.95], ["L", 12, 0, 20.95, 21.65], ["R", 6, 0, 21.65, 22.3]]);
        if (c >= 0) {
            if (c >= 2.4 && c < 3.6) st = walk(c, 0, [["R", 0, 4, 2.4, 2.75], ["L", 0, 4, 2.75, 3.1]]);
            else if (c >= 3.6) st = walk(c, 4, [["R", 4, 0, 3.6, 3.95], ["L", 4, 0, 3.95, 4.3]]);
        }
        if (st) {
            pos("hips", [0, st.hy, st.hz]); rot("hips", [0, 0, st.sway]);
            rot("legR", [st.legR, 0, -st.sway]); rot("legL", [st.legL, 0, st.sway]);
            rot("shoulderL", [0.8 * (st.legR - st.legL) / 2, 0, 0]);
        }

        var freePos = null, popK = 0, spin = 0;
        if (T >= 12.65 && T < 13.9) bub = { grow: ss(12.65, 13.85, T) };
        if (T >= 13.9 && T < 19.35) { bub = { free: true }; popK = ss(19.18, 19.35, T); }
        if (c >= 1.4 && c < 2.2) bub = { grow: ss(1.4, 2.15, c) };
        if (c >= 2.2 && c < 4.55) { bub = { free: true }; popK = ss(4.38, 4.55, c); }

        // ---------- face camera in the showcase ----------
        var on = ss(45.0, 45.8, T) * (1 - ss(59.3, 60.0, T));
        rot("hips", [0, on * TURN, 0]);

        // where the free bubble is: it leaves from the ring of the BLOW pose
        if (bub && bub.free) {
            if (T >= 13.9 && T < 19.35) {
                freePos = path(FREE, T);
                spin = (T - 13.9) * 3.0;
            } else {
                var r0 = RELEASE.show;
                var SF = [[2.2, r0], [2.9, [r0[0] + 3, r0[1] + 3.5, r0[2] + 5]], [3.6, [r0[0] + 6, r0[1] + 6.5, r0[2] + 9]],
                          [4.1, [r0[0] + 2, r0[1] + 8, r0[2] + 11]], [4.55, [r0[0] + 5, r0[1] + 9.5, r0[2] + 12]]];
                freePos = path(SF, c);
                spin = (c - 2.2) * 3.0;
            }
        }

        // ---------- ROTATION: the head follows the bubble (Y = turn, X = up/down) ----------
        var track = bump(13.9, 14.3, 19.0, 19.3, T) + (c >= 0 ? bump(2.2, 2.5, 4.3, 4.6, c) : 0);
        if (freePos && track > 0) {
            var hz = st ? st.hz : 0;
            var hp = [headJ[0], headJ[1], headJ[2] + hz];
            var d = [freePos[0] - hp[0], freePos[1] - hp[1], freePos[2] - hp[2]];
            var yaw = clamp(Math.atan2(d[0], d[2]) / DEG, -55, 55), pitch = clamp(Math.atan2(d[1], Math.hypot(d[0], d[2])) / DEG, -30, 50);
            rot("head", [track * pitch * 0.85, track * yaw * 0.9, 0]);
        }

        // ---------- ARBITRARY-AXIS ROTATION: leaning with the wobbling bubble ----------
        //   the upper body turns about n = (1, 0, -1)/√2 through the waist:
        //   + angle -> leans to the front-right (+x, +z), - angle -> back-left
        lean = 15 * bump(16.6, 17.0, 18.4, 18.8, T) * Math.sin(2 * Math.PI * (T - 16.6) / 1.6 + 0.6);
        if (c >= 0) lean += 9 * bump(2.6, 2.9, 4.2, 4.5, c) * Math.sin(2 * Math.PI * (c - 2.6) / 1.9);
        rot("shoulderL", [0, 0, 5 * Math.abs(lean) / 15]);                 // balancing arm

        // ---------- the pop on his nose: flinch, hop, laugh ----------
        var flinch = bump(19.18, 19.25, 19.45, 19.7, T), hop = bump(19.25, 19.4, 19.45, 19.65, T);
        var laugh = bump(19.6, 19.75, 20.2, 20.6, T);
        rot("head", [8 * flinch + 4 * laugh, 0, 6 * laugh * Math.sin(2 * Math.PI * 4 * T)]);
        pos("hips", [0, 0.9 * hop + 0.25 * laugh * Math.abs(Math.sin(2 * Math.PI * 4 * T)), 0]);
        eyes = Math.min(eyes, 1 - 0.9 * flinch, 1 - 0.6 * laugh);
        if (c >= 0) eyes = Math.min(eyes, 1 - 0.85 * bump(4.38, 4.45, 4.5, 4.6, c));

        // ---------- watching Loopy and Eddy ----------
        var watch = bump(22.4, 23.6, 43.8, 44.8, T), who = ss(29.6, 30.8, T);
        rot("head", [watch * lerp(-3, 2, who), watch * lerp(32, 25, who), watch * -4]);
        [27.0, 34.5, 40.0].forEach(function (b) { eyes = Math.min(eyes, 1 - 0.9 * bump(b, b + 0.05, b + 0.1, b + 0.18, T)); });

        // ---------- apply everything ----------
        rig.reset(); rig.pose(P);
        rig.axisRotate("waist", S.LEAN_AXIS, lean);
        rig.scale("breath", breathScale(breath));
        rig.apply();
        face.setEyes(eyes);

        // ---------- place the bubble (model space) ----------
        var B = props.bubble;
        if (!bub) { B.MOVE_MATRIX = M4.S(0, 0, 0); return; }
        var r = S.BUBBLE_R, wob = 0.07 * Math.sin(T * 9.5), M;
        if (bub.grow !== undefined) {
            var ring = ringNow();
            var g = Math.max(bub.grow, 0.02), rr = r * g;
            var cc = add3(ring.c, scale3(ring.n, rr * 0.92));            // grows out of the ring, away from Poby
            M = M4.mul(M4.T(cc[0], cc[1], cc[2]), M4.S(rr * (1 + wob), rr * (1 - wob), rr));
        } else {
            var k = 1 + 0.3 * popK;                                     // pops: swells a little, then gone
            // ARBITRARY rotation of the bubble too: it spins about a tilted axis while wobbling
            M = M4.mul(M4.T(freePos[0], freePos[1], freePos[2]),
                M4.mul(M4.rotAxis([0.45, 1, 0.3], spin), M4.S(r * k * (1 + wob), r * k * (1 - wob), r * k)));
            if (popK >= 0.999) M = M4.S(0, 0, 0);
        }
        B.MOVE_MATRIX = M;
        B.alpha = 0.6 * (1 - 0.85 * popK);
    }
    function breathScale(b) {
        var k = Math.max(b, -0.2);
        return [1 + (S.BREATH_MAX[0] - 1) * k, 1 + (S.BREATH_MAX[1] - 1) * k, 1 + (S.BREATH_MAX[2] - 1) * k];
    }
    function releasePoint(ring) { return add3(ring.c, scale3(ring.n, S.BUBBLE_R * 0.92)); }
    // the release points: ring of the BLOW pose, standing at his place (and turned for the showcase)
    function blowRelease(turn) {
        rig.reset(); rig.pose({ shoulderR: BLOW.shoulderR, elbowR: BLOW.elbowR, wristR: BLOW.wristR, hips: { rot: [0, turn, 0] } });
        rig.apply();
        return releasePoint(ringNow());
    }
    var RELEASE = { story: blowRelease(0), show: blowRelease(TURN) };
    rig.reset(); rig.apply();
    // the bubble's path while free in the story (model space, cm): from the ring,
    // up and around above him, and down ONTO his nose
    var noseFront = [0.2, 36.0, 13.9 + S.WALK + S.BUBBLE_R * 0.9];
    var FREE = [[13.9, RELEASE.story], [14.6, [3, 39.5, 20.5]], [15.6, [6, 42.5, 26]], [16.6, [7, 44, 30]],
                [17.4, [1.5, 44.5, 31.5]], [18.2, [7.5, 43.5, 31]], [18.8, [3, 40.5, 29.5]], [19.2, noseFront]];

    return { update: update };
}
