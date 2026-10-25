import { LIBS } from "./helpers/libs.js";
import { Node } from "./helpers/node.js";
import { buildEnvironment } from "./helpers/environment.js";
import { createEddy } from "./eddy.js";
import { createPoby } from "./poby.js";
import { createLoopy } from "./loopy.js";

// =====================================================================
//  MAIN — satu scene: langit, dunia salju, lalu Poby, Eddy & Loopy
//  berdiri berdampingan di lapangan tengah (skala tinggi asli:
//  Poby 6.80, Eddy 5.25, Loopy 4.17 unit; 1 cm = 0.1545 unit).
//
//  Tiap karakter dibuat oleh file-nya sendiri (eddy.js, poby.js, loopy.js)
//  dengan shader-nya sendiri, jadi tampilannya sama seperti di project
//  masing-masing. main.js hanya menyiapkan WebGL, langit, environment,
//  kamera, kontrol, lalu menaruh & menggambar ketiganya.
//
//  KONTROL: drag mouse / W A S D = putar    scroll = zoom
//           R = reset kamera                SPASI = jeda animasi
// =====================================================================

// tinggi permukaan tanah (sama dengan contoh Eddy: telapak kaki di y = -2.57)
var GROUND_Y = -2.57;

// posisi tiap karakter di lapangan tengah (x -14..14, z -8..8 kosong untuk mereka)
//   pos = [x, z],  turn = putaran badan (radian, + = menghadap ke kanan layar)
var PLACEMENT = {
    Poby:  { pos: [-4.6, -0.4], turn:  0.22 },
    Eddy:  { pos: [ 0.0,  0.4], turn:  0.00 },
    Loopy: { pos: [ 4.2, -0.2], turn: -0.22 }
};

function main() {
    var CANVAS = document.getElementById("mycanvas");
    // Render di resolusi asli layar (devicePixelRatio) supaya tepi karakter tidak bergerigi
    var DPR = Math.min(window.devicePixelRatio || 1, 2);
    CANVAS.width = Math.round(window.innerWidth * DPR); CANVAS.height = Math.round(window.innerHeight * DPR);
    var GL = CANVAS.getContext("webgl", { antialias: true });
    if (!GL) { alert("WebGL tidak tersedia"); return; }

    /* ================= SHADER SCENE (environment) =================
       Sama dengan shader Eddy + kabut: makin jauh makin pudar ke warna langit. */
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
            float fog = smoothstep(150., 900., vDist);
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
    GL.enableVertexAttribArray(0); GL.enableVertexAttribArray(1); GL.enableVertexAttribArray(2);
    var _P = GL.getUniformLocation(PROG, "Pmatrix"), _V = GL.getUniformLocation(PROG, "Vmatrix"),
        _M = GL.getUniformLocation(PROG, "Mmatrix");

    /* ================= LANGIT: gradasi warna (quad layar penuh, program shader kecil sendiri) ================= */
    var bgVS = `attribute vec2 p; attribute vec3 c; varying vec3 vc;
        void main(void) { gl_Position = vec4(p, 0.999, 1.); vc = c; }`;
    var bgFS = `precision mediump float; varying vec3 vc; void main(void) { gl_FragColor = vec4(vc, 1.); }`;
    var BG = GL.createProgram();
    GL.attachShader(BG, compile(bgVS, GL.VERTEX_SHADER)); GL.attachShader(BG, compile(bgFS, GL.FRAGMENT_SHADER));
    GL.bindAttribLocation(BG, 0, "p"); GL.bindAttribLocation(BG, 1, "c");
    GL.linkProgram(BG);
    var BGBUF = GL.createBuffer(); GL.bindBuffer(GL.ARRAY_BUFFER, BGBUF);
    GL.bufferData(GL.ARRAY_BUFFER, new Float32Array([
        -1, -1, 0.90, 0.95, 1.00,    1, -1, 0.90, 0.95, 1.00,     // cakrawala: putih kebiruan
        -1,  1, 0.45, 0.72, 0.94,    1,  1, 0.45, 0.72, 0.94]), GL.STATIC_DRAW);   // atas: biru langit
    function drawSky() {
        GL.disable(GL.DEPTH_TEST); GL.disableVertexAttribArray(2); GL.useProgram(BG);
        GL.bindBuffer(GL.ARRAY_BUFFER, BGBUF);
        GL.vertexAttribPointer(0, 2, GL.FLOAT, false, 20, 0);
        GL.vertexAttribPointer(1, 3, GL.FLOAT, false, 20, 8);
        GL.drawArrays(GL.TRIANGLE_STRIP, 0, 4);
        GL.enableVertexAttribArray(2); GL.enable(GL.DEPTH_TEST);
    }

    /* ================= HELPER (untuk environment) ================= */
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
    var STRIDE = 4 * 9;
    function render(mesh, worldMatrix) {
        GL.uniformMatrix4fv(_M, false, worldMatrix);
        GL.bindBuffer(GL.ARRAY_BUFFER, mesh.vb);
        GL.vertexAttribPointer(0, 3, GL.FLOAT, false, STRIDE, 0);
        GL.vertexAttribPointer(1, 3, GL.FLOAT, false, STRIDE, 12);
        GL.vertexAttribPointer(2, 3, GL.FLOAT, false, STRIDE, 24);
        GL.bindBuffer(GL.ELEMENT_ARRAY_BUFFER, mesh.fb);
        GL.drawElements(GL.TRIANGLES, mesh.n, GL.UNSIGNED_SHORT, 0);
    }

    /* ================= ENVIRONMENT ================= */
    var environment = new Node("Environment", [0, 0, 0]);
    buildEnvironment(part, environment, GROUND_Y);
    window.environment = environment;

    /* ================= KARAKTER ================= */
    // Tiap create...() mengembalikan { name, root, update(t), draw(scene) }; telapak kaki di y = 0.
    var characters = [createPoby(GL), createEddy(GL), createLoopy(GL)];
    characters.forEach(function (c) {
        var p = PLACEMENT[c.name];
        c.place = LIBS.compose([p.pos[0], GROUND_Y, p.pos[1]], [0, p.turn, 0]);   // berdiri di tanah
    });
    window.characters = characters;

    /* ================= KAMERA & KONTROL ================= */
    var PROJ = LIBS.get_projection(40, CANVAS.width / CANVAS.height, 1, 2000);
    var CAM_START = { theta: 0, phi: 0.04, z: 15 };
    var camZ = CAM_START.z;
    var CAM_Y = 0.9;   // kamera sedikit di atas pusat putaran -> karakter di tengah layar
    var THETA = CAM_START.theta, PHI = CAM_START.phi, dX = 0, dY = 0, drag = false, px = 0, py = 0, FRICTION = 0.05;
    var animTime = 0, animPaused = false, lastTick = null;
    var clampPhi = function () { PHI = Math.max(-0.15, Math.min(1.2, PHI)); };   // tidak bisa melihat dari bawah tanah

    function down(x, y) { drag = true; px = x; py = y; }
    function move(x, y) {
        if (!drag) return;
        dX = (x - px) * 2 * Math.PI / CANVAS.clientWidth; dY = (y - py) * 2 * Math.PI / CANVAS.clientHeight;
        THETA += dX; PHI += dY; clampPhi(); px = x; py = y;
    }
    CANVAS.addEventListener("mousedown", function (e) { down(e.pageX, e.pageY); e.preventDefault(); });
    window.addEventListener("mouseup", function () { drag = false; });
    CANVAS.addEventListener("mousemove", function (e) { move(e.pageX, e.pageY); });
    CANVAS.addEventListener("touchstart", function (e) { down(e.touches[0].pageX, e.touches[0].pageY); e.preventDefault(); });
    CANVAS.addEventListener("touchend", function () { drag = false; });
    CANVAS.addEventListener("touchmove", function (e) { move(e.touches[0].pageX, e.touches[0].pageY); e.preventDefault(); });
    CANVAS.addEventListener("wheel", function (e) {
        camZ = Math.min(Math.max(camZ + e.deltaY * 0.01, 6), 40); e.preventDefault();
    }, { passive: false });
    window.addEventListener("keydown", function (e) {
        var speed = 0.08, k = e.key.toLowerCase();
        if (k === "a") THETA -= speed;
        if (k === "d") THETA += speed;
        if (k === "w") PHI -= speed;
        if (k === "s") PHI += speed;
        clampPhi();
        if (e.key === " ") { animPaused = !animPaused; e.preventDefault(); }
        if (k === "r") { THETA = CAM_START.theta; PHI = CAM_START.phi; camZ = CAM_START.z; dX = 0; dY = 0; }
    });
    window.addEventListener("resize", function () {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        CANVAS.width = Math.round(window.innerWidth * DPR); CANVAS.height = Math.round(window.innerHeight * DPR);
        PROJ = LIBS.get_projection(40, CANVAS.width / CANVAS.height, 1, 2000);
    });

    /* ================= RENDER ================= */
    GL.enable(GL.DEPTH_TEST); GL.depthFunc(GL.LEQUAL);
    GL.clearColor(0.68, 0.84, 0.97, 1.0);

    function animate() {
        GL.viewport(0, 0, CANVAS.width, CANVAS.height);
        GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
        if (!drag) { dX *= 1 - FRICTION; dY *= 1 - FRICTION; THETA += dX; PHI += dY; clampPhi(); }

        // waktu animasi (detik); berhenti saat dijeda
        var now = performance.now();
        if (lastTick === null) lastTick = now;
        if (!animPaused) animTime += (now - lastTick) / 1000.0;
        lastTick = now;

        drawSky();

        // Kamera diam di (0, CAM_Y, camZ); seluruh dunia diputar oleh mouse (sama seperti di tiap project)
        var V = LIBS.translate(0, -CAM_Y, -camZ);
        var WORLD = LIBS.multiply(LIBS.rotX(PHI), LIBS.rotY(THETA));

        GL.useProgram(PROG);
        GL.uniformMatrix4fv(_P, false, PROJ);
        GL.uniformMatrix4fv(_V, false, V);
        environment.draw(WORLD, render);

        characters.forEach(function (c) {
            c.update(animTime);
            c.draw({ P: PROJ, V: V, M: LIBS.multiply(WORLD, c.place), camPos: [0, CAM_Y, camZ] });
        });

        requestAnimationFrame(animate);
    }
    animate();
}
window.addEventListener("load", main);
