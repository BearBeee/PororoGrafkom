import { LIBS } from "./helpers/libs.js";
import { Node } from "./helpers/node.js";
import { buildEnvironment, updateEnvironment } from "./helpers/environment.js";
import { createEddy } from "./eddy.js";
import { createPoby } from "./poby.js";
import { createLoopy } from "./loopy.js";

// =====================================================================
//  MAIN — satu scene: langit, taman piknik, lalu Poby, Eddy & Loopy
//  berdiri berdampingan di taman piknik (skala tinggi asli:
//  Poby 6.80, Eddy 5.25, Loopy 4.17 unit; 1 cm = 0.1545 unit).
//
//  Tiap karakter dibuat oleh file-nya sendiri (eddy.js, poby.js, loopy.js)
//  dengan shader-nya sendiri, jadi tampilannya sama seperti di project
//  masing-masing. main.js hanya menyiapkan WebGL, langit, environment,
//  kamera, kontrol, lalu menaruh & menggambar ketiganya.
//
//  KAMERA ORBIT (awal): drag mouse / W A S D = putar    scroll = zoom
//  KAMERA GHOST (tombol G): terbang bebas untuk merekam dari sudut mana saja
//           W A S D = maju / kiri / mundur / kanan   Q / E = turun / naik
//           drag mouse = melihat sekeliling          Shift = cepat, Alt = pelan
//           scroll = atur kecepatan terbang          G = kembali ke orbit
//           R = reset kamera                SPASI = jeda animasi
//           0 / Home = replay dari awal     panah kiri/kanan = mundur/maju 1 detik
//           H = sembunyikan / tampilkan bar kontrol (untuk merekam video)
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
            gl_FragColor = vec4(mix(col, vec3(0.80, 0.90, 0.98), fog), 1.);
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
        -1, -1, 0.86, 0.93, 1.00,    1, -1, 0.86, 0.93, 1.00,     // cakrawala: putih kebiruan
        -1,  1, 0.33, 0.62, 0.93,    1,  1, 0.33, 0.62, 0.93]), GL.STATIC_DRAW);   // atas: biru langit
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
    // Poby: animasi bubble wand. Digambar TERAKHIR karena gelembung sabunnya transparan.
    var poby = createPoby(GL, { showcaseTurn: -12.6 });
    var characters = [createEddy(GL), createLoopy(GL), poby];
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
    var skyTime = 0;   // jam awan: terus berjalan (tidak ikut diulang), supaya awan tidak meloncat saat storyline kembali ke 0
    var clampPhi = function () { PHI = Math.max(-0.15, Math.min(1.2, PHI)); };   // tidak bisa melihat dari bawah tanah

    function down(x, y) { drag = true; px = x; py = y; }
    function move(x, y) {
        if (!drag) return;
        var mx = (x - px) * 2 * Math.PI / CANVAS.clientWidth, my = (y - py) * 2 * Math.PI / CANVAS.clientHeight;
        px = x; py = y;
        if (ghost) {                                     // ghost: drag = melihat sekeliling
            G.yawT += mx * 0.6; G.pitchT = Math.max(-1.5, Math.min(1.5, G.pitchT + my * 0.6));
            return;
        }
        dX = mx; dY = my; THETA += dX; PHI += dY; clampPhi();
    }
    CANVAS.addEventListener("mousedown", function (e) { down(e.pageX, e.pageY); e.preventDefault(); });
    window.addEventListener("mouseup", function () { drag = false; });
    CANVAS.addEventListener("mousemove", function (e) { move(e.pageX, e.pageY); });
    CANVAS.addEventListener("touchstart", function (e) { down(e.touches[0].pageX, e.touches[0].pageY); e.preventDefault(); });
    CANVAS.addEventListener("touchend", function () { drag = false; });
    CANVAS.addEventListener("touchmove", function (e) { move(e.touches[0].pageX, e.touches[0].pageY); e.preventDefault(); });
    CANVAS.addEventListener("wheel", function (e) {
        e.preventDefault();
        if (ghost) {                                     // ghost: scroll = kecepatan terbang
            var i = GHOST_SPEEDS.indexOf(G.speed) + (e.deltaY < 0 ? 1 : -1);
            G.speed = GHOST_SPEEDS[Math.max(0, Math.min(GHOST_SPEEDS.length - 1, i))];
            updateCamLabel();
            return;
        }
        camZ = Math.min(Math.max(camZ + e.deltaY * 0.01, 6), 40);
    }, { passive: false });

    /* ================= KAMERA GHOST (terbang bebas) =================
       Kamera punya posisi sendiri (pos) dan arah pandang (yaw = kiri/kanan, pitch = atas/bawah).
       View matrix = Rx(pitch) · Ry(yaw) · T(-pos); dunia TIDAK diputar (WORLD = identitas).
       Gerakan dibuat halus (posisi & arah pandang mengejar targetnya), supaya enak untuk direkam. */
    var ghost = false;
    var G = { pos: [0, 0, 0], yaw: 0, pitch: 0, vel: [0, 0, 0], yawT: 0, pitchT: 0, speed: 6 };
    var keys = {};                                       // tombol yang sedang ditekan
    var GHOST_SPEEDS = [1.5, 3, 6, 12, 24];              // unit / detik (scroll untuk ganti)
    // posisi kamera orbit saat ini, dalam koordinat dunia: (Rx(PHI)·Ry(THETA))^T · (0, CAM_Y, camZ)
    function orbitCameraPos() {
        var R = LIBS.multiply(LIBS.rotX(PHI), LIBS.rotY(THETA)), c = [0, CAM_Y, camZ];
        return [0, 1, 2].map(function (i) { return R[i * 4] * c[0] + R[i * 4 + 1] * c[1] + R[i * 4 + 2] * c[2]; });
    }
    // arah sumbu kamera (kanan / depan) di dunia, dari yaw & pitch
    function ghostAxes() {
        var R = LIBS.multiply(LIBS.rotX(G.pitch), LIBS.rotY(G.yaw));
        var col = function (v) { return [0, 1, 2].map(function (i) { return R[i * 4] * v[0] + R[i * 4 + 1] * v[1] + R[i * 4 + 2] * v[2]; }); };
        return { right: col([1, 0, 0]), fwd: col([0, 0, -1]) };
    }
    function setGhost(on) {
        ghost = on;
        if (on) {                                        // mulai dari sudut orbit saat ini (tidak meloncat)
            G.pos = orbitCameraPos(); G.yaw = G.yawT = THETA; G.pitch = G.pitchT = PHI; G.vel = [0, 0, 0];
        } else resetCamera();
        updateCamLabel();
    }
    function updateGhost(dt) {
        // arah pandang mengejar target (halus)
        var k = 1 - Math.pow(0.0005, dt);
        G.yaw += (G.yawT - G.yaw) * k; G.pitch += (G.pitchT - G.pitch) * k;
        // kecepatan dari tombol (WASD + Q/E), lalu dihaluskan
        var ax = ghostAxes(), mv = [0, 0, 0];
        var f = (keys.w ? 1 : 0) - (keys.s ? 1 : 0), r = (keys.d ? 1 : 0) - (keys.a ? 1 : 0), u = (keys.e ? 1 : 0) - (keys.q ? 1 : 0);
        for (var i = 0; i < 3; i++) mv[i] = ax.fwd[i] * f + ax.right[i] * r + (i === 1 ? u : 0);
        var len = Math.hypot(mv[0], mv[1], mv[2]) || 1, sp = G.speed * (keys.shift ? 3 : 1) * (keys.alt ? 0.3 : 1);
        var kv = 1 - Math.pow(0.002, dt);
        for (var i = 0; i < 3; i++) {
            G.vel[i] += (mv[i] / len * sp - G.vel[i]) * kv;
            G.pos[i] += G.vel[i] * dt;
        }
        G.pos[1] = Math.max(G.pos[1], GROUND_Y + 0.25);  // tidak tembus ke bawah tanah
    }
    function updateCamLabel() {
        ui.ghost.textContent = ghost ? "👻 Ghost (G)" : "🎥 Orbit (G)";
        ui.ghost.classList.toggle("on", ghost);
        ui.keys.textContent = ghost
            ? "WASD fly · Q/E down/up · drag look · Shift fast · Alt slow · scroll speed (" + G.speed + ") · G orbit · R reset · H hide"
            : "Space pause · ←/→ 1 s · 0 replay · drag/WASD orbit · G ghost camera · R camera · H hide";
    }
    function resetCamera() {
        THETA = CAM_START.theta; PHI = CAM_START.phi; camZ = CAM_START.z; dX = 0; dY = 0;
        if (ghost) { G.pos = orbitCameraPos(); G.yaw = G.yawT = THETA; G.pitch = G.pitchT = PHI; G.vel = [0, 0, 0]; }
    }

    /* ================= BAR KONTROL (index.html #bar) =================
       Replay, Pause/Play, waktu, slider lompat ke detik tertentu, bagian cerita,
       reset kamera, dan H untuk menyembunyikan bar (supaya tidak ikut terekam). */
    var LOOP = 60;                                       // panjang storyline (detik), sama dengan semua karakter
    var PHASES = [[0, "Opening"], [10, "Poby's turn"], [20, "Loopy's turn"], [30, "Loopy & Eddy"], [35, "Eddy's turn"], [45, "Showcase"]];
    var ui = {
        bar: document.getElementById("bar"), play: document.getElementById("btnPlay"),
        time: document.getElementById("time"), seek: document.getElementById("seek"),
        phase: document.getElementById("phase"), toast: document.getElementById("toast"),
        ghost: document.getElementById("btnGhost"), keys: document.getElementById("keys")
    };
    var seeking = false, toastTimer = null;
    function setTime(t) { animTime = Math.max(0, Math.min(LOOP - 0.001, t)); }
    function togglePause() { animPaused = !animPaused; }
    function replay() { animTime = 0; animPaused = false; }
    function toggleBar() {
        var hide = !ui.bar.classList.contains("hidden");
        ui.bar.classList.toggle("hidden", hide);
        clearTimeout(toastTimer);
        ui.toast.classList.toggle("show", hide);                       // kasih tahu cara memunculkan lagi,
        if (hide) toastTimer = setTimeout(function () { ui.toast.classList.remove("show"); }, 1500);   // lalu hilang
    }
    function updateBar() {
        var t = animTime % LOOP, name = PHASES[0][1];
        PHASES.forEach(function (p) { if (t >= p[0]) name = p[1]; });
        ui.time.textContent = (t < 10 ? "0" : "") + t.toFixed(1) + " / " + LOOP + " s";
        if (!seeking) ui.seek.value = t;
        ui.phase.textContent = name;
        ui.play.textContent = animPaused ? "▶ Play" : "⏸ Pause";
    }
    function onClick(id, fn) {
        document.getElementById(id).addEventListener("click", function (e) { fn(); e.currentTarget.blur(); });
    }
    onClick("btnRestart", replay);
    onClick("btnPlay", togglePause);
    onClick("btnCam", resetCamera);
    onClick("btnHide", toggleBar);
    onClick("btnGhost", function () { setGhost(!ghost); });
    updateCamLabel();
    ui.seek.addEventListener("input", function () { seeking = true; setTime(+ui.seek.value); });
    ui.seek.addEventListener("change", function () { seeking = false; ui.seek.blur(); });

    window.addEventListener("keydown", function (e) {
        var speed = 0.08, k = e.key.toLowerCase();
        keys[k] = true; keys.shift = e.shiftKey; keys.alt = e.altKey;
        if (e.key === "Alt") e.preventDefault();         // Alt tidak membuka menu browser
        if (!ghost) {                                    // orbit: W A S D memutar dunia
            if (k === "a") THETA -= speed;
            if (k === "d") THETA += speed;
            if (k === "w") PHI -= speed;
            if (k === "s") PHI += speed;
            clampPhi();
        }
        if (k === "g") setGhost(!ghost);
        if (e.key === " ") { togglePause(); e.preventDefault(); }
        if (k === "r") resetCamera();
        if (k === "h") toggleBar();
        if (k === "0" || e.key === "Home") replay();
        if (e.key === "ArrowLeft")  { setTime(animTime % LOOP - 1); e.preventDefault(); }
        if (e.key === "ArrowRight") { setTime(animTime % LOOP + 1); e.preventDefault(); }
    });
    window.addEventListener("keyup", function (e) { keys[e.key.toLowerCase()] = false; keys.shift = e.shiftKey; keys.alt = e.altKey; });
    window.addEventListener("blur", function () { keys = {}; });   // jendela kehilangan fokus: lepas semua tombol
    window.addEventListener("resize", function () {
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        CANVAS.width = Math.round(window.innerWidth * DPR); CANVAS.height = Math.round(window.innerHeight * DPR);
        PROJ = LIBS.get_projection(40, CANVAS.width / CANVAS.height, 1, 2000);
    });

    /* ================= RENDER ================= */
    GL.enable(GL.DEPTH_TEST); GL.depthFunc(GL.LEQUAL);
    GL.clearColor(0.80, 0.90, 0.98, 1.0);

    function animate() {
        GL.viewport(0, 0, CANVAS.width, CANVAS.height);
        GL.clear(GL.COLOR_BUFFER_BIT | GL.DEPTH_BUFFER_BIT);
        if (!drag && !ghost) { dX *= 1 - FRICTION; dY *= 1 - FRICTION; THETA += dX; PHI += dY; clampPhi(); }

        // waktu animasi (detik); berhenti saat dijeda
        var now = performance.now();
        if (lastTick === null) lastTick = now;
        var dt = Math.min((now - lastTick) / 1000.0, 0.1);   // maks 0.1 s: kalau tab sempat tertahan, animasi tidak meloncat
        if (ghost) updateGhost(dt);                          // kamera ghost tetap bisa terbang walau animasi dijeda
        if (!animPaused) { animTime += dt; skyTime += dt; }
        lastTick = now;
        animTime %= LOOP;                         // storyline berulang tiap 60 detik
        updateBar();

        drawSky();

        // ORBIT: kamera diam di (0, CAM_Y, camZ); seluruh dunia diputar oleh mouse (sama seperti di tiap project)
        // GHOST: dunia diam; kamera ada di G.pos dan menghadap ke arah yaw / pitch
        var V, WORLD, camPos;
        if (ghost) {
            V = LIBS.multiply(LIBS.multiply(LIBS.rotX(G.pitch), LIBS.rotY(G.yaw)), LIBS.translate(-G.pos[0], -G.pos[1], -G.pos[2]));
            WORLD = LIBS.get_I4(); camPos = G.pos;
        } else {
            V = LIBS.translate(0, -CAM_Y, -camZ);
            WORLD = LIBS.multiply(LIBS.rotX(PHI), LIBS.rotY(THETA)); camPos = [0, CAM_Y, camZ];
        }

        GL.useProgram(PROG);
        GL.uniformMatrix4fv(_P, false, PROJ);
        GL.uniformMatrix4fv(_V, false, V);
        updateEnvironment(skyTime);            // awan bergerak pelan
        environment.draw(WORLD, render);

        characters.forEach(function (c) {
            c.update(animTime);
            c.draw({ P: PROJ, V: V, M: LIBS.multiply(WORLD, c.place), camPos: camPos });
        });

        requestAnimationFrame(animate);
    }
    animate();
}
window.addEventListener("load", main);
