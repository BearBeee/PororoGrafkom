// =====================================================================
//  rig.js — skeleton + skinning for Poby ("behind the scenes" rigging)
//
//  IDEA
//   - A SKELETON of bones. Every bone is an empty MyObject (no mesh, so it is
//     never drawn) placed at a joint, in the normal course hierarchy:
//         bone.POSITION_MATRIX = translate(joint - parent joint)   (fixed)
//         bone.MOVE_MATRIX     = translate(pos) x rotate(rot)       (animation)
//   - RIGID parts (head, eyes, ears, pads, claws, shoulder balls) are ordinary
//     MyObjects hung under their bone, so they simply follow it.
//   - SKINNED parts (arm + paw, leg + foot) are ONE continuous mesh each. Every
//     vertex has weights for 1-3 bones; each frame the vertex is moved by the
//     weighted mix of those bones' matrices (linear blend skinning), so the
//     skin bends smoothly at the elbow, wrist and hip, with no seams.
//
//  All matrices here are plain column-major 4x4 arrays in the usual maths
//  order (the same arrays WebGL and MyObject use).
// =====================================================================
import { MyObject } from "./node.js";

// ---------------- small matrix helpers (maths order: mul(A, B) = A·B) ----------------
export var M4 = {
    I: function () { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; },
    mul: function (a, b) {
        var o = new Array(16);
        for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++)
            o[c*4 + r] = a[r] * b[c*4] + a[4 + r] * b[c*4 + 1] + a[8 + r] * b[c*4 + 2] + a[12 + r] * b[c*4 + 3];
        return o;
    },
    T: function (x, y, z) { return [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]; },
    Rx: function (a) { var c = Math.cos(a), s = Math.sin(a); return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]; },
    Ry: function (a) { var c = Math.cos(a), s = Math.sin(a); return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]; },
    Rz: function (a) { var c = Math.cos(a), s = Math.sin(a); return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]; },
    S: function (x, y, z) { return [x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]; },

    // ROTATION ABOUT AN ARBITRARY AXIS (unit vector n = [x, y, z], angle a, through
    // the origin) — the Rodrigues formula:
    //   R = cos a · I  +  (1 - cos a) · n nᵀ  +  sin a · [n]×
    rotAxis: function (n, a) {
        var l = Math.hypot(n[0], n[1], n[2]) || 1, x = n[0] / l, y = n[1] / l, z = n[2] / l;
        var c = Math.cos(a), s = Math.sin(a), t = 1 - c;
        return [t*x*x + c,   t*x*y + s*z, t*x*z - s*y, 0,
                t*x*y - s*z, t*y*y + c,   t*y*z + s*x, 0,
                t*x*z + s*y, t*y*z - s*x, t*z*z + c,   0,
                0, 0, 0, 1];
    },
    // ...about an axis through point p:  T(p) · R(n, a) · T(-p)
    rotAbout: function (p, n, a) {
        return M4.mul(M4.T(p[0], p[1], p[2]), M4.mul(M4.rotAxis(n, a), M4.T(-p[0], -p[1], -p[2])));
    }
};
var DEG = Math.PI / 180;

export function smoothstep(a, b, x) {
    var t = Math.min(Math.max((x - a) / (b - a), 0), 1);
    return t * t * (3 - 2 * t);
}

// Bake a matrix into a mesh: positions -> M·p - offset, normals -> rotate by M.
// instances (list of [x,y,z] offsets drawn before the matrix) are rotated too.
export function bakeMesh(vertices, M, offset, instances) {
    var out = new Array(vertices.length), o = offset || [0, 0, 0];
    for (var i = 0; i < vertices.length; i += 9) {
        var x = vertices[i], y = vertices[i+1], z = vertices[i+2];
        var a = vertices[i+6], b = vertices[i+7], c = vertices[i+8];
        out[i]   = M[0]*x + M[4]*y + M[8]*z + M[12] - o[0];
        out[i+1] = M[1]*x + M[5]*y + M[9]*z + M[13] - o[1];
        out[i+2] = M[2]*x + M[6]*y + M[10]*z + M[14] - o[2];
        out[i+3] = vertices[i+3]; out[i+4] = vertices[i+4]; out[i+5] = vertices[i+5];
        var nx = M[0]*a + M[4]*b + M[8]*c, ny = M[1]*a + M[5]*b + M[9]*c, nz = M[2]*a + M[6]*b + M[10]*c;
        var l = Math.hypot(nx, ny, nz) || 1;
        out[i+6] = nx / l; out[i+7] = ny / l; out[i+8] = nz / l;
    }
    var inst = (instances || []).map(function (p) {
        return [M[0]*p[0] + M[4]*p[1] + M[8]*p[2], M[1]*p[0] + M[5]*p[1] + M[9]*p[2], M[2]*p[0] + M[6]*p[1] + M[10]*p[2]];
    });
    return { vertices: out, instances: inst };
}

// =====================================================================
//  SkinnedMesh — a MyObject whose vertices are recomputed from the bones
//  influences[i] = [[boneIndex, weight], ...]  (weights add up to 1)
// =====================================================================
export class SkinnedMesh extends MyObject {
    constructor(GL, SHADER_PROGRAM, _position, _color, _normal, _Mmatrix, mesh, name, influences) {
        super(GL, SHADER_PROGRAM, _position, _color, _normal, _Mmatrix, mesh, name);
        var n = mesh.vertices.length / 9;
        this.rest = new Float32Array(mesh.vertices);         // rest pose (never changes)
        this.data = new Float32Array(mesh.vertices);         // posed vertices sent to the GPU
        this.bones = new Int16Array(n * 3).fill(-1);
        this.weights = new Float32Array(n * 3);
        for (var i = 0; i < n; i++) {
            var inf = influences[i].filter(function (b) { return b[1] > 1e-4; })
                                   .sort(function (p, q) { return q[1] - p[1]; }).slice(0, 3);
            var sum = inf.reduce(function (s, b) { return s + b[1]; }, 0) || 1;
            inf.forEach(function (b, k) { this.bones[i*3 + k] = b[0]; this.weights[i*3 + k] = b[1] / sum; }, this);
        }
    }

    setup() {
        this.OBJECT_VERTEX = this.GL.createBuffer();
        this.GL.bindBuffer(this.GL.ARRAY_BUFFER, this.OBJECT_VERTEX);
        this.GL.bufferData(this.GL.ARRAY_BUFFER, this.data, this.GL.DYNAMIC_DRAW);
        this.OBJECT_FACES = this.GL.createBuffer();
        this.GL.bindBuffer(this.GL.ELEMENT_ARRAY_BUFFER, this.OBJECT_FACES);
        this.GL.bufferData(this.GL.ELEMENT_ARRAY_BUFFER, new Uint16Array(this.faces), this.GL.STATIC_DRAW);
        this.childs.forEach(child => child.setup());
    }

    // S[b] = skin matrix of bone b (moves a rest-pose point to its posed place)
    deform(S) {
        var r = this.rest, d = this.data, n = r.length / 9, m = new Float32Array(12);
        for (var i = 0; i < n; i++) {
            m.fill(0);
            for (var k = 0; k < 3; k++) {
                var b = this.bones[i*3 + k];
                if (b < 0) break;
                var w = this.weights[i*3 + k], s = S[b];
                m[0] += w*s[0]; m[1] += w*s[1]; m[2]  += w*s[2];
                m[3] += w*s[4]; m[4] += w*s[5]; m[5]  += w*s[6];
                m[6] += w*s[8]; m[7] += w*s[9]; m[8]  += w*s[10];
                m[9] += w*s[12]; m[10] += w*s[13]; m[11] += w*s[14];
            }
            var j = i * 9, x = r[j], y = r[j+1], z = r[j+2], a = r[j+6], bb = r[j+7], c = r[j+8];
            d[j]   = m[0]*x + m[3]*y + m[6]*z + m[9];
            d[j+1] = m[1]*x + m[4]*y + m[7]*z + m[10];
            d[j+2] = m[2]*x + m[5]*y + m[8]*z + m[11];
            var nx = m[0]*a + m[3]*bb + m[6]*c, ny = m[1]*a + m[4]*bb + m[7]*c, nz = m[2]*a + m[5]*bb + m[8]*c;
            var l = Math.hypot(nx, ny, nz) || 1;
            d[j+6] = nx / l; d[j+7] = ny / l; d[j+8] = nz / l;
        }
        if (this.OBJECT_VERTEX) {
            this.GL.bindBuffer(this.GL.ARRAY_BUFFER, this.OBJECT_VERTEX);
            this.GL.bufferSubData(this.GL.ARRAY_BUFFER, 0, d);
        }
        this.vertex = d;
    }
}

// =====================================================================
//  Rig — the skeleton
//
//  rot = [x, y, z] in DEGREES, applied in the order twist (y), then
//  swing (x), then side (z):  R = Rz(z) · Rx(-x) · Ry(y)
//    +x : swing the bone's tip FORWARD (arm/leg forward, elbow bends
//         forward, head lifts the chin)
//    +y : twist around the up axis (head turns towards +x, Poby's R side)
//    +z : tip out to the SIDE, away from the body (arm raise, leg spread)
//  Left-side bones are mirrored (y and z flipped), so the same numbers give
//  the same movement on both sides.
//  pos = extra translation in cm (mostly for "hips": bob / sway the body).
//  scale = [sx, sy, sz] around the bone's joint (e.g. the "breath" bone)
//  axis  = { n: [x, y, z], angle: degrees } — a rotation about an ARBITRARY
//          axis n through the bone's joint (e.g. the "waist" bone)
//  The bone's local matrix is
//      L = T(pos) · Rz · Rx · Ry · R(n, angle) · S(scale)
//  and, because a child bone sits at its joint, the hierarchy makes every
//  rotation / scaling happen AROUND that joint:  T(joint) · L · T(-joint).
// =====================================================================
export class Rig {
    constructor(make) {
        this.make = make;            // make(null, name) -> empty MyObject
        this.bones = [];
        this.byName = {};
        this.skins = [];
        this.dirty = true;
    }

    // joint = rest position of the joint in model space (cm). mirror = -1 for left bones
    addBone(name, parentName, joint, mirror) {
        var parent = parentName ? this.byName[parentName] : null;
        var node = this.make(null, "Bone_" + name);
        var off = parent ? [joint[0] - parent.joint[0], joint[1] - parent.joint[1], joint[2] - parent.joint[2]] : joint;
        node.POSITION_MATRIX = M4.T(off[0], off[1], off[2]);
        node.MOVE_MATRIX = M4.I();
        var bone = { name: name, index: this.bones.length, parent: parent, joint: joint.slice(),
                     mirror: mirror || 1, rot: [0, 0, 0], pos: [0, 0, 0], scl: [1, 1, 1], axis: null, node: node };
        if (parent) parent.node.childs.push(node);
        this.bones.push(bone);
        this.byName[name] = bone;
        return bone;
    }

    // hang a rigid MyObject on a bone. restM = its model-space matrix in the rest pose
    attachRigid(boneName, obj, restM) {
        var bone = this.byName[boneName];
        var baked = bakeMesh(obj.vertex, restM, bone.joint, obj.instances);
        obj.vertex = baked.vertices;
        obj.instances = baked.instances;
        obj.POSITION_MATRIX = M4.I();
        obj.MOVE_MATRIX = M4.I();
        obj.childs = [];
        bone.node.childs.push(obj);
    }

    // add a SkinnedMesh whose vertices are in model space; it hangs under the root bone
    addSkin(skin) {
        var root = this.bones[0], j = root.joint, r = skin.rest;
        for (var i = 0; i < r.length; i += 9) { r[i] -= j[0]; r[i+1] -= j[1]; r[i+2] -= j[2]; }
        skin.vertex = Array.from(r);
        skin.data.set(r);
        root.node.childs.push(skin);
        this.skins.push(skin);
    }

    // ---------------- animation API ----------------
    set(name, rot)      { this.byName[name].rot = rot.slice(); this.dirty = true; return this; }
    move(name, pos)     { this.byName[name].pos = pos.slice(); this.dirty = true; return this; }
    scale(name, s)      { this.byName[name].scl = s.slice(); this.dirty = true; return this; }
    axisRotate(name, n, deg) { this.byName[name].axis = { n: n.slice(), angle: deg }; this.dirty = true; return this; }
    get(name)           { return this.byName[name]; }
    get names()         { return this.bones.map(function (b) { return b.name; }); }
    // pose({ elbowR: [40, 0, 0], hips: { rot: [0, 10, 0], pos: [0, 0.5, 0] } })
    pose(p) {
        for (var k in p) {
            if (!this.byName[k]) { console.warn("rig: no bone " + k); continue; }
            if (Array.isArray(p[k])) this.set(k, p[k]);
            else {
                if (p[k].rot) this.set(k, p[k].rot);
                if (p[k].pos) this.move(k, p[k].pos);
                if (p[k].scale) this.scale(k, p[k].scale);
                if (p[k].axis) this.axisRotate(k, p[k].axis.n, p[k].axis.angle);
            }
        }
        return this;
    }
    reset() { this.bones.forEach(function (b) { b.rot = [0, 0, 0]; b.pos = [0, 0, 0]; b.scl = [1, 1, 1]; b.axis = null; }); this.dirty = true; return this; }

    local(b) {
        var m = b.mirror;
        var R = M4.mul(M4.Rz(m * b.rot[2] * DEG), M4.mul(M4.Rx(-b.rot[0] * DEG), M4.Ry(m * b.rot[1] * DEG)));
        if (b.axis && b.axis.angle) R = M4.mul(R, M4.rotAxis(b.axis.n, b.axis.angle * DEG));
        var sc = b.scl;
        if (sc[0] !== 1 || sc[1] !== 1 || sc[2] !== 1) R = M4.mul(R, M4.S(sc[0], sc[1], sc[2]));
        return M4.mul(M4.T(b.pos[0], b.pos[1], b.pos[2]), R);
    }

    // update bone matrices + deform the skins (only when something changed)
    apply() {
        if (!this.dirty) return;
        var root = this.bones[0], G = [], S = [];
        this.bones.forEach(function (b) {
            var L = this.local(b);
            b.node.MOVE_MATRIX = L;
            if (b === root) { G[b.index] = M4.I(); S[b.index] = M4.I(); return; }
            var p = b.parent, j = b.joint, pj = p.joint;
            // G = bone matrix in the root bone's frame; S = G · translate(-rest joint)
            G[b.index] = M4.mul(G[p.index], M4.mul(M4.T(j[0] - pj[0], j[1] - pj[1], j[2] - pj[2]), L));
            S[b.index] = M4.mul(G[b.index], M4.T(-(j[0] - root.joint[0]), -(j[1] - root.joint[1]), -(j[2] - root.joint[2])));
        }, this);
        this.skins.forEach(function (s) { s.deform(S); });
        // keep each bone's posed matrix (in the root bone's frame) for props / checks
        this.bones.forEach(function (b) { b.G = G[b.index]; });
        this.dirty = false;
    }
}
