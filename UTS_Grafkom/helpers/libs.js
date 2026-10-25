// =====================================================================
//  libs.js — matrix libraries for Eddy, Poby and Loopy
//
//   LIBS       column-major 4x4 matrices (used by Eddy, Loopy, the scene
//              and the environment). Loopy's version = Eddy's + scale().
//   POBY_LIBS  the course matrix library (used by Poby / MyObject).
//              Kept separate on purpose: its multiply(a, b) multiplies in
//              the opposite order to LIBS.multiply, so they can't be merged.
// =====================================================================

// #####################################################################
//  LIBS (Eddy + Loopy + scene)
// #####################################################################
// Matriks 4x4 column-major (WebGL murni, tanpa library)
export var LIBS = {
    degToRad: function (a) { return a * Math.PI / 180; },

    // Proyeksi perspektif standar
    get_projection: function (fov, aspect, near, far) {
        var f = 1 / Math.tan(LIBS.degToRad(fov) / 2);
        return [f / aspect, 0, 0, 0,
                0, f, 0, 0,
                0, 0, (far + near) / (near - far), -1,
                0, 0, 2 * far * near / (near - far), 0];
    },
    get_I4: function () { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; },

    // out = a * b
    multiply: function (a, b) {
        var o = new Array(16);
        for (var c = 0; c < 4; c++)
            for (var r = 0; r < 4; r++) {
                var s = 0;
                for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
                o[c * 4 + r] = s;
            }
        return o;
    },
    translate: function (x, y, z) { var m = LIBS.get_I4(); m[12] = x; m[13] = y; m[14] = z; return m; },
    scale: function (x, y, z) { return [x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]; },
    rotX: function (a) { var c = Math.cos(a), s = Math.sin(a); return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]; },
    rotY: function (a) { var c = Math.cos(a), s = Math.sin(a); return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]; },
    rotZ: function (a) { var c = Math.cos(a), s = Math.sin(a); return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]; },

    // M = T * Rz * Ry * Rx * S   (pos=[x,y,z], rot=[rx,ry,rz] radian, scale=[sx,sy,sz] opsional)
    // (artinya: di-scale dulu, lalu diputar X, Y, Z, terakhir digeser)
    compose: function (pos, rot, scale) {
        rot = rot || [0, 0, 0];
        var R = LIBS.multiply(LIBS.rotZ(rot[2]), LIBS.multiply(LIBS.rotY(rot[1]), LIBS.rotX(rot[0])));
        var M = LIBS.multiply(LIBS.translate(pos[0], pos[1], pos[2]), R);
        if (scale) M = LIBS.multiply(M, LIBS.scale(scale[0], scale[1], scale[2]));
        return M;
    }
};

// #####################################################################
//  POBY_LIBS (Poby)
// #####################################################################
// libs.js — the matrix library from the course (pertemuan 6), unchanged except
// that a duplicated copy of multiply() at the end was removed.
export var POBY_LIBS = {
    degToRad: function (angle) {
        return (angle * Math.PI / 180);
    },


    get_projection: function (angle, a, zMin, zMax) {
        var tan = Math.tan(POBY_LIBS.degToRad(0.5 * angle)),
            A = -(zMax + zMin) / (zMax - zMin),
            B = (-2 * zMax * zMin) / (zMax - zMin);


        return [
            0.5 / tan, 0, 0, 0,
            0, 0.5 * a / tan, 0, 0,
            0, 0, A, -1,
            0, 0, B, 0
        ];
    },

    get_json: function (url, func) {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.open("GET", url, true);
        xmlHttp.onreadystatechange = function () {
            if (xmlHttp.readyState === 4 && xmlHttp.status === 200) {
                func(JSON.parse(xmlHttp.responseText));
            }
        };
        xmlHttp.send();
    },


    get_I4: function () {
        return [1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1];
    },


    set_I4: function (m) {
        m[0] = 1, m[1] = 0, m[2] = 0, m[3] = 0,
            m[4] = 0, m[5] = 1, m[6] = 0, m[7] = 0,
            m[8] = 0, m[9] = 0, m[10] = 1, m[11] = 0,
            m[12] = 0, m[13] = 0, m[14] = 0, m[15] = 1;
    },


    rotateX: function (m, angle) {
        var c = Math.cos(angle);
        var s = Math.sin(angle);
        var mv1 = m[1], mv5 = m[5], mv9 = m[9];
        m[1] = m[1] * c - m[2] * s;
        m[5] = m[5] * c - m[6] * s;
        m[9] = m[9] * c - m[10] * s;


        m[2] = m[2] * c + mv1 * s;
        m[6] = m[6] * c + mv5 * s;
        m[10] = m[10] * c + mv9 * s;
    },


    rotateY: function (m, angle) {
        var c = Math.cos(angle);
        var s = Math.sin(angle);
        var mv0 = m[0], mv4 = m[4], mv8 = m[8];
        m[0] = c * m[0] + s * m[2];
        m[4] = c * m[4] + s * m[6];
        m[8] = c * m[8] + s * m[10];


        m[2] = c * m[2] - s * mv0;
        m[6] = c * m[6] - s * mv4;
        m[10] = c * m[10] - s * mv8;
    },


    rotateZ: function (m, angle) {
        var c = Math.cos(angle);
        var s = Math.sin(angle);
        var mv0 = m[0], mv4 = m[4], mv8 = m[8];
        m[0] = c * m[0] - s * m[1];
        m[4] = c * m[4] - s * m[5];
        m[8] = c * m[8] - s * m[9];


        m[1] = c * m[1] + s * mv0;
        m[5] = c * m[5] + s * mv4;
        m[9] = c * m[9] + s * mv8;
    },


    translateZ: function (m, t) {
        m[14] += t;
    },
    translateX: function (m, t) {
        m[12] += t;
    },
    translateY: function (m, t) {
        m[13] += t;
    },


    set_position: function (m, x, y, z) {
        m[12] = x, m[13] = y, m[14] = z;
    },

    multiply: function (m1, m2) {
        var rm = this.get_I4();
        var N = 4;
        for (var i = 0; i < N; i++) {
            for (var j = 0; j < N; j++) {
                rm[i * N + j] = 0;
                for (var k = 0; k < N; k++) {
                    rm[i * N + j] += m1[i * N + k] * m2[k * N + j];
                }
            }
        }
        return rm;
    },
    scaleX: function (m, t) {
        m[0] *= t;
    },
    scaleY: function (m, t) {
        m[5] *= t;
    },
    scaleZ: function (m, t) {
        m[10] *= t;
    }
};
