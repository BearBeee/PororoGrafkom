export function createLoopyAnimation(cfg) {
    var A = cfg.A, BODY_Y = cfg.BODY_Y, HEAD_Y = cfg.HEAD_Y, LEG_Y = cfg.LEG_Y,
        eyeMesh = cfg.eyeMesh, winkMesh = cfg.winkMesh;
    var NOSE = cfg.nose || [0, 0.34, 1.46];   // titik pusat kupu-kupu bertengger: sayap belakang menjulur ~0.23 di bawah pusat, jadi cukup tinggi agar tidak menembus hidung
    var LOOP = cfg.loop || 60;
    var WINDOWS = cfg.windows || [[20, 35], [45, LOOP]];
    var CYCLE = 15;                         // satu siklus performa = 15 detik (diulang di showcase)
    var E = CYCLE - 10;                     // geseran fase penutup (kupu-kupu pergi, tepuk tangan selesai)
    var REACH_Z = 1.2;                      // sudut angkat tangan saat menggapai (radian)
    var TILT_AMP = 0.13;                    // miring kepala saat bertepuk (radian, ~7 derajat)
    var BF_AXIS = [1.0, 0.5, 0.8];          // sumbu acak kupu-kupu (arbitrary axis)
    var HEAD_AXIS = [0.15, 0.10, 1.0];      // sumbu miring kepala (arbitrary axis): dekat sumbu Z, jadi tampilannya nyaris sama dengan miring biasa
    var BF_SCALE = 0.8;

    // ---- lintasan lari: angka-8 (Lissajous 1:2), Loopy melalui satu lobe (PATH_FRAC) di lantai, pusatnya = posisi awal Loopy ----
    var RUN_RX = cfg.runRx || 3.0, RUN_RZ = cfg.runRz || 1.3;
    var RUN_S = 2.0, RUN_T = 8.5;           // mulai lari di u = 2.0, lama 8.5 dtk (selesai u = 10.5) -> lari santai di lintasan lebar
    var D = RUN_T - 3.7;                    // geseran waktu fase sesudah lari (hinggap, menghadap kamera, tepuk tangan)
    var RUN_ACC = 1.2, RUN_DEC = 1.6;       // lama percepatan & perlambatan (profil kecepatan trapesium)
    var RUN_CYCLES = 14;                     // jumlah siklus langkah kaki sepanjang lintasan (14 siklus / 8.5 dtk = ~3.3 langkah per detik)
    var PATH_FRAC = 0.5;                    // bagian angka-8 yang dilalui: 0.5 = satu lobe (kembali ke titik tengah). Lebih panjang = lebih cepat
    var SWING_MAX = 0.22;                   // batas ayunan depan-belakang kaki: lebih besar -> kaki keluar dari bawah badan (tidak menempel)
    var FOOT_LIFT = 0.30;                   // kaki ayun naik MENDEKAT ke badan sebanyak ini (tetap menempel di badan)

    var TAU = 2 * Math.PI;
    var clamp01 = function (x) { return Math.max(0, Math.min(1, x)); };
    var clamp = function (x, a, b) { return Math.max(a, Math.min(b, x)); };
    var smooth01 = function (x) { x = clamp01(x); return x * x * (3 - 2 * x); };
    var ramp = function (u, a, b) { return smooth01((u - a) / (b - a)); };   // naik halus 0 -> 1 antara a dan b
    // easing lebih halus (quintic): kecepatan DAN percepatan nol di kedua ujung -> putaran badan tidak tersentak
    var smoother = function (x) { x = clamp01(x); return x * x * x * (x * (x * 6 - 15) + 10); };
    var lerp = function (a, b, k) { return a + (b - a) * k; };
    // pegas teredam untuk squash & stretch (durasi 2 dtk): 0 -> memipih (puncak ~1 di x = 0.25) -> memantul memanjang (~ -0.28 di x = 0.75) -> tenang tepat 0 di x = 2
    var spring = function (x) { return (x <= 0 || x >= 2) ? 0 : 1.8 * Math.exp(-2.5 * x) * Math.sin(TAU * x); };

    // posisi di lantai untuk sudut lintasan a (periodik 2*PI, a = 0 dan 2*PI = titik tengah)
    function track(a) { return [RUN_RX * Math.sin(a), RUN_RZ * Math.sin(2 * a)]; }

    // Tabel panjang busur: lintasan diparameterkan menurut JARAK TEMPUH (bukan sudut), jadi kecepatan Loopy di lantai
    // benar-benar mengikuti profil kecepatan dan langkah kaki bisa dicocokkan persis (tidak meluncur).
    // Tabel dibuat sampai 1.5*PI supaya kupu-kupu (yang terbang sedikit di depan Loopy) bisa melewati ujung lobe.
    var NA = 900, A_MAX = 1.5 * Math.PI, ARC = [0];
    (function () { var p = track(0);
        for (var i = 1; i <= NA; i++) { var q = track(A_MAX * i / NA); ARC.push(ARC[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1])); p = q; } })();
    var LOBE_LEN = ARC[Math.round(NA * TAU * PATH_FRAC / A_MAX)];       // panjang lintasan yang dilalui Loopy
    function arcAngle(s) {                  // s = 0..1 sepanjang lintasan Loopy (boleh > 1 untuk kupu-kupu) -> sudut a
        var target = clamp(s, 0, ARC[NA] / LOBE_LEN) * LOBE_LEN, lo = 0, hi = NA;
        while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (ARC[mid] <= target) lo = mid; else hi = mid; }
        return A_MAX * (lo + (target - ARC[lo]) / Math.max(1e-9, ARC[lo + 1] - ARC[lo])) / NA;
    }
    // Ayunan kaki: tumpu = LURUS dengan kecepatan konstan (sama dengan badan maju -> telapak diam di lantai),
    // ayun = naik halus ke depan. Amplitudo dicocokkan dengan jarak badan per setengah siklus: 2*amp = L / (2*siklus).
    var SWING_AMP = Math.min(SWING_MAX, LOBE_LEN / (4 * RUN_CYCLES));
    function footZ(p) {
        var q = (p - Math.PI / 2) / Math.PI; q -= 2 * Math.floor(q / 2);      // 0..1 = tumpu (kaki bergerak mundur), 1..2 = ayun
        return q < 1 ? SWING_AMP * (1 - 2 * q) : SWING_AMP * (-1 + 2 * smooth01(q - 1));
    }

    // arah hadap (yaw) searah garis singgung lintasan. Tabel di-"unwrap" sekali di awal supaya
    // sudutnya kontinu (tidak loncat 2*PI) walau Loopy berputar sampai membelakangi kamera.
    var HN = 720, HEADING = [];
    (function () {
        var prev = 0;
        for (var i = 0; i <= HN; i++) {
            var a = TAU * i / HN;
            var h = Math.atan2(RUN_RX * Math.cos(a), 2 * RUN_RZ * Math.cos(2 * a));
            if (i > 0) h += TAU * Math.round((prev - h) / TAU);
            HEADING.push(h); prev = h;
        }
    })();
    function heading(s) {                   // s = 0..1 sepanjang lintasan
        var f = clamp01(s) * HN, i = Math.min(HN - 1, Math.floor(f));
        return lerp(HEADING[i], HEADING[i + 1], f - i);
    }

    // kemajuan di lintasan ps(u) 0..1 dengan kecepatan trapesium (mulai pelan, ngebut, melambat berhenti),
    // dan kecepatan ternormalisasi v(u) 0..1 (dipakai sebagai bobot "sedang berlari").
    var RUN_CRUISE = RUN_T - RUN_ACC - RUN_DEC;
    var VMAX = 1 / (RUN_ACC / 2 + RUN_CRUISE + RUN_DEC / 2);
    function progress(u) {
        var s = u - RUN_S;
        if (s <= 0) return 0;
        if (s >= RUN_T) return 1;
        if (s < RUN_ACC) return 0.5 * VMAX * s * s / RUN_ACC;
        if (s < RUN_ACC + RUN_CRUISE) return VMAX * (0.5 * RUN_ACC + (s - RUN_ACC));
        var d = s - RUN_ACC - RUN_CRUISE;
        return VMAX * (0.5 * RUN_ACC + RUN_CRUISE + d - 0.5 * d * d / RUN_DEC);
    }
    function speed(u) {
        var s = u - RUN_S;
        if (s <= 0 || s >= RUN_T) return 0;
        if (s < RUN_ACC) return s / RUN_ACC;
        if (s < RUN_ACC + RUN_CRUISE) return 1;
        return 1 - (s - RUN_ACC - RUN_CRUISE) / RUN_DEC;
    }
    // arah hadap badan: memutar ke arah lari sebelum mulai (u 1.8-2.4), mengikuti lintasan, lalu kembali ke kamera
    // Putaran kembali ke kamera dimulai SAAT Loopy masih melambat (bukan setelah berhenti total) dan berlangsung
    // 1.8 dtk dengan easing quintic, jadi terlihat seperti berbalik badan sambil berhenti, bukan diputar paksa.
    var TURN_S = RUN_S + RUN_T - 0.9, TURN_E = TURN_S + 1.8;
    // Ujung lobe menghadap arah tertentu; menghadap kamera = kelipatan 2*PI terdekat (putaran terpendek).
    var FACE_YAW = TAU * Math.round(heading(PATH_FRAC) / TAU);
    function yawAt(u) {
        var tt = smoother((u - TURN_S) / (TURN_E - TURN_S));
        var h = heading(arcAngle(progress(u)) / TAU) * smoother((u - 1.6) / 1.1);
        return h * (1 - tt) + FACE_YAW * tt;
    }

    // u = waktu dalam siklus (0..10), g = bobot jendela (0 di luar, naik/turun 1 dtk di tepi)
    // Satu jendela = satu siklus penuh; jendela yang lebih panjang dari 10 dtk diregangkan (gerakan sedikit lebih pelan).
    function perfClock(tt) {
        for (var i = 0; i < WINDOWS.length; i++) {
            var s = WINDOWS[i][0], e = WINDOWS[i][1];
            if (tt >= s && tt < e) return { u: (tt - s) * CYCLE / (e - s), g: ramp(tt, s, s + 1) * ramp(e - tt, 0, 1) };
        }
        return { u: 0, g: 0 };
    }

    return function updateAnimation(t) {
        var tt = t % LOOP, pc = perfClock(tt), u = pc.u, g = pc.g;

        // ---------- bobot performa (semua 0 di u = 0 dan u = 10, jadi siklus tersambung mulus) ----------
        var runW   = g * speed(u);                                                  // sedang berlari (0..1)
        var tiltW  = g * Math.max(ramp(u, 0.2, 0.8) * (1 - ramp(u, 1.6, 2.0)),     // miring imut sebelum kupu-kupu
                                  ramp(u, 6.4 + D, 7.0 + D) * (1 - ramp(u, 9.0 + E, 9.7 + E)));    // miring halus saat bertepuk
        var seeW   = g * ramp(u, 1.7, 2.2) * (1 - ramp(u, 5.6 + D, 6.2 + D));              // melihat/menoleh ke kupu-kupu
        var chaseW = g * ramp(u, 2.0, 2.4) * (1 - ramp(u, 5.4 + D, 6.0 + D));              // semangat mengejar (tangan, ekor)
        var lookW  = g * ramp(u, 5.2 + D, 6.2 + D) * (1 - ramp(u, 9.2 + E, 9.9 + E));              // menunduk melihat kupu-kupu di hidung
        var smileW = g * ramp(u, 6.2 + D, 6.8 + D) * (1 - ramp(u, 9.4 + E, 9.9 + E));              // senang (mata "⌒")
        var clapW  = g * ramp(u, 6.4 + D, 7.2 + D) * (1 - ramp(u, 9.0 + E, 9.7 + E));              // bertepuk tangan

        // ================= TRANSLASI + ROTASI: Loopy berlari di lantai =================
        var ps  = progress(u);
        var pos = track(arcAngle(ps));                       // TRANSLASI: posisi (x, z) Loopy di dunia
        var yaw = yawAt(u);                              // ROTASI : arah hadap (sumbu Y) searah lintasan
        var yawRate = (yawAt(u + 0.05) - yawAt(u - 0.05)) / 0.1;
        A.runner.position[0] = pos[0];
        A.runner.position[2] = pos[1];
        A.runner.rotation[1] = yaw;
        var phase = TAU * RUN_CYCLES * ps;               // fase langkah kaki terikat ke JARAK tempuh (kaki tidak "meluncur")
        var cYaw = Math.cos(yaw), sYaw = Math.sin(yaw);

        // ================= KUPU-KUPU: terbang di DUNIA (anak root), berada di depan Loopy =================
        var landW  = ramp(u, 5.2 + D, 6.2 + D);                        // 0 = terbang, 1 = sudah di hidung
        var faceW  = ramp(u, 5.4 + D, 6.2 + D);                        // badan menegak menghadap kamera
        var leaveW = ramp(u, 9.2 + E, 9.9 + E);                        // terbang pergi
        var appearW = ramp(u, 1.6, 2.2);
        var bfOn = g * appearW * (1 - leaveW);                 // 0 = tersembunyi

        // Kupu-kupu terbang menyusuri lintasan yang SAMA, tapi selalu sedikit di depan Loopy (jaraknya mengecil).
        var ahead = 0.30 - 0.15 * ramp(u, 2.0, RUN_S + RUN_T - 0.3);
        var ab = TAU * (ps + ahead);                           // dipakai untuk kibasan & putaran kupu-kupu
        var gp = track(arcAngle(ps + ahead));
        var entry = 1 - ramp(u, 1.6, 2.8);                     // datang dari jauh (kanan-belakang) lalu bergabung ke lintasan
        var bc = [
            gp[0] + 0.40 * Math.sin(7 * ab + 0.5) + 3.5 * entry,
            2.3 + 0.7 * Math.sin(9 * ab + 1.0) + 0.15 * Math.sin(5 * u) + 1.0 * entry,
            gp[1] + 0.30 * Math.cos(5 * ab) - 4.5 * entry
        ];

        // posisi kupu-kupu relatif terhadap Loopy (frame hadap Loopy) -> arah pandang kepala
        var dx = bc[0] - pos[0], dz = bc[2] - pos[1];
        var lx = cYaw * dx - sYaw * dz, lz = sYaw * dx + cYaw * dz, ly = bc[1] - HEAD_Y;
        var look = clamp(Math.atan2(lx, Math.max(lz, 0.2)), -0.9, 0.9);

        // ================= IDLE =================
        var bob = 0.03 * Math.sin(t * 3.0);
        var idleStepL = 0.05 * Math.max(0, Math.sin(t * 1.5));
        var idleStepR = 0.05 * Math.max(0, Math.sin(t * 1.5 + Math.PI));
        var wave = smooth01(2.5 * Math.sin(t / 6.0 * TAU));              // lambaian tangan kanan, siklus 6 dtk
        var w = smooth01((Math.sin(t / 6.0 * TAU) - 0.45) * 5.0);        // wink di tengah lambaian
        var ph = t % 3.2;
        var lid = ph < 0.15 ? Math.sin(ph / 0.15 * Math.PI) : 0.0;       // kedip biasa tiap 3.2 dtk

        // ---------- BADAN: condong, bergoyang squash & stretch tiap langkah (TANPA melompat: kaki tumpu selalu menapak), miring ke tikungan ----------
        var lean = 0.08 * runW;                                           // condong ke depan saat berlari
        // SCALING: badan sedikit memanjang/memipih tiap langkah (volume dijaga: sx = sz = 1/sqrt(sy)); telapak tetap menapak.
        // SCALING: SQUASH & STRETCH seluruh badan (kepala, tangan, kaki ikut karena hierarki) hanya di 2 momen penting,
        // BUKAN tiap langkah (itu yang membuat tampak bergetar): (1) jongkok sebelum lari lalu memanjang saat tancap,
        // (2) memipih saat mengerem berhenti. Volume dijaga: sx = sz = 1/sqrt(sy);
        // kompensasi tinggi badan di bodyY membuat telapak tetap menapak lantai.
        var squash = g * (0.09 * spring(u - (RUN_S - 0.2)) + 0.07 * spring(u - (RUN_S + RUN_T - 0.3)));
        var sy = 1 - squash;
        var sx = 1 / Math.sqrt(sy);
        var bodyY = BODY_Y + bob * (1 - runW) + LEG_Y * (1 - sy);   // telapak tetap menapak saat badan memipih
        A.badan.scale = [sx, sy, sx];
        A.badan.position[0] = 0;
        A.badan.position[1] = bodyY;
        A.badan.position[2] = 0;
        A.badan.rotation[0] = lean;
        A.badan.rotation[1] = 0;
        var roll = -clamp(0.03 * yawRate, -0.06, 0.06) * runW;
        A.badan.rotation[2] = roll;   // miring ke arah tikungan

        // ---------- KAKI: bergantian, SELALU menempel di badan ----------
        // Kaki ayun: naik ke atas MENDEKAT ke badan (FOOT_LIFT) sambil maju; kaki tumpu: tetap menapak di tanah
        // dan bergerak mundur sama cepat dengan badan maju (tidak meluncur, lihat footZ). Badan tidak melompat, jadi kaki tidak
        // pernah terpisah dari badan maupun melayang di udara.
        [[A.kakiL, idleStepL, 0, -1], [A.kakiR, idleStepR, Math.PI, 1]].forEach(function (L) {
            var leg = L[0], p = phase + L[2];
            var lift  = runW * FOOT_LIFT * Math.max(0, Math.cos(p));       // naik hanya saat diayun ke depan (cos > 0)
            var swing = runW * footZ(p);                                    // ayunan depan-belakang (tumpu lurus, ayun halus)
            // ujung kaki hanya miring saat kaki DIANGKAT (cos > 0) dan nol saat menapak: telapak yang menapak selalu rata,
            // karena telapak berputar di sekitar engsel (pusatnya 0.26 di depan engsel) sehingga miring sedikit saja sudah
            // mengangkat/membenamkan telapak dari tanah
            var toe   = -0.30 * lift / FOOT_LIFT;
            var yT = LEG_Y - bob * (1 - runW) + L[1] * (1 - runW) + lift;
            // badan condong (rotasi X) dan miring ke tikungan (rotasi Z) ikut memutar kaki; kaki berada 0.45 di kiri/kanan
            // sumbu badan, jadi miring 0.2 rad saja menaikkan satu kaki ~0.09 dan membenamkan yang lain -> dikompensasi
            // di sini agar telapak tetap menapak tanah
            var lx = L[3] * 0.45;
            leg.position[1] = ((yT - lx * Math.sin(roll)) / Math.cos(roll) + swing * Math.sin(lean)) / Math.cos(lean);
            leg.rotation[2] = -roll;
            leg.position[2] = swing;
            leg.rotation[0] = -lean + toe;
            leg.rotation[1] = L[3] * 0.42 * (1 - 0.75 * runW);               // kaki lebih lurus saat berlari (mengurangi galat kompensasi condong)
        });

        // ---------- ROTASI: kepala ----------
        var yawIdle = 0.30 * Math.sin(t * 0.9);
        var calm = (1 - seeW) * (1 - lookW);
        var headX = 0.04 * Math.sin(t * 1.5) * calm
                  - clamp01(ly * 0.20 + 0.1) * 0.40 * seeW * (1 - lookW)     // mendongak ke kupu-kupu
                  + 0.10 * lookW;                                            // menunduk ke hidung
        var headY = yawIdle * calm * (1 - 0.8 * tiltW) + 0.6 * look * seeW * (1 - lookW);
        var headZ = 0.07 * Math.sin(t * 1.3) * calm * (1 - tiltW);          // goyang halus saat idle (sumbu Z biasa)
        // ROTATE ARBITRARY AXIS pada KEPALA: miring imut / saat bertepuk berputar di sumbu bebas HEAD_AXIS
        // (Node.axisAngle -> Node.rotAxisMatrix, rumus Rodrigues), menggantikan rotasi Z murni yang dulu.
        var headTilt = tiltW * TILT_AMP * Math.sin(TAU * 0.55 * u);
        A.kepala.rotation[0] = headX;
        A.kepala.rotation[1] = headY;
        A.kepala.rotation[2] = headZ;
        A.kepala.axisAngle = { axis: HEAD_AXIS, angle: headTilt };

        // ================= ARBITRARY ROTATE: kupu-kupu (posisi akhir) =================
        // Titik hidung di frame root (maju kinematik: kepala -> badan -> runner), supaya kupu-kupu hinggap
        // tepat di hidung walau Loopy sedang menoleh/menunduk/berputar menghadap kamera.
                var nY = NOSE[1] * Math.cos(headX) - NOSE[2] * Math.sin(headX);
        var nZ = NOSE[1] * Math.sin(headX) + NOSE[2] * Math.cos(headX);
        var nX = nZ * Math.sin(headY) + NOSE[0] * Math.cos(headY);
        nZ = nZ * Math.cos(headY) - NOSE[0] * Math.sin(headY);
        var fX = nX * sx, fY = (HEAD_Y - BODY_Y + nY) * sy, fZ = nZ * sx;
        var fY2 = fY * Math.cos(lean) - fZ * Math.sin(lean) + bodyY;
        var fZ2 = fY * Math.sin(lean) + fZ * Math.cos(lean);
        var nose = [pos[0] + fX * cYaw + fZ2 * sYaw, fY2, pos[1] - fX * sYaw + fZ2 * cYaw];

        var hover = 0.25 * Math.sin(Math.PI * landW);
        var kp = [lerp(bc[0], nose[0], landW), lerp(bc[1], nose[1], landW) + hover, lerp(bc[2], nose[2], landW)];
        kp[0] += 2.5 * leaveW; kp[1] += 3.5 * leaveW; kp[2] -= 3.0 * leaveW;   // terbang pergi
        A.kupu.position = kp;

        // Orientasi: ROTASI SUMBU BEBAS (Node.axisAngle -> Node.rotAxisMatrix, rumus Rodrigues) -> badan & sayap berputar miring;
        // sudut mengecil ke 0 saat mendarat, lalu badan ditegakkan menghadap kamera (rotasi X).
        var sb = u - 1.6;
        var turn = (1 - faceW) * (1.0 * Math.sin(2.1 * sb) + 0.55 * Math.sin(3.7 * sb + 1.3));
        A.kupu.axisAngle = { axis: BF_AXIS, angle: turn + (1 - faceW) * 0.6 * ab };
        A.kupu.rotation = [-Math.PI / 2 * faceW, 0, 0];
        var bs = BF_SCALE * bfOn;
        A.kupu.scale = [bs, bs, bs];
        var flap = (1 - landW) * (0.15 + 0.75 * Math.sin(t * 26.0)) + landW * (0.45 + 0.30 * Math.sin(t * 3.0));
        A.sayapR.rotation[2] =  flap;                          // kepakan sayap (kanan +, kiri -)
        A.sayapL.rotation[2] = -flap;

        // telinga, jambul, ekor (ekor makin semangat saat mengejar)
        A.earL.rotation[2] =  0.10 * Math.sin(t * 4.0);
        A.earR.rotation[2] = -0.10 * Math.sin(t * 4.0 + 1.0);
        A.jambul.rotation[2] = 0.12 * Math.sin(t * 5.0);
        A.ekor.rotation[1] = (0.28 + 0.20 * chaseW) * Math.sin(t * 3.0);

        // ---------- HIERARCHY: lengan (bahu -> lengan -> kuku ikut) ----------
        // Mengejar: kedua tangan terangkat menggapai ke atas (Rz kanan +, kiri -), berdenyut mengikuti langkah.
        // Bertepuk : Rx = lengan maju, Ry = lengan menyilang ke tengah (kanan -, kiri +).
        var reach = REACH_Z + 0.05 * Math.sin(phase);                  // sudut tinggi tangan (dibatasi agar tidak menembus kepala)
        var clap = 0.62 + 0.14 * Math.sin(TAU * 3.0 * u);
        var idleR = wave * (1.05 + 0.28 * Math.sin(t * 9.0)) + (1 - wave) * 0.05 * Math.sin(t * 3.0);
        var idleL = -0.06 * Math.sin(t * 3.0 + 1.0);
        var idleMix = (1 - clapW) * (1 - chaseW);
        A.bahuR.rotation[0] = -0.9 * clapW - 0.3 * chaseW;
        A.bahuR.rotation[1] = -clap * clapW;
        A.bahuR.rotation[2] = idleR * idleMix + reach * chaseW;
        A.bahuL.rotation[0] = -0.9 * clapW - 0.3 * chaseW;
        A.bahuL.rotation[1] =  clap * clapW;
        A.bahuL.rotation[2] = idleL * idleMix - reach * chaseW;

        // ---------- MATA: bola <-> garis "⌒" (DUA MATA) ----------
        // Mulut TIDAK diubah ukurannya; "senyum" ditunjukkan lewat mata "⌒" (sesuai gambar referensi).
        var happy = clapW > 0.5 || smileW > 0.5;
        var winking = (w > 0.6) || happy;
        var squint = happy ? 0 : Math.max(lid, w);
        A.eyeL.scale = [1, 1 - 0.92 * squint, 1];
        A.eyeR.scale = [1, 1 - 0.92 * squint, 1];
        A.eyeL.mesh = winking ? null : eyeMesh;
        A.eyeR.mesh = winking ? null : eyeMesh;
        A.winkL.mesh = winking ? winkMesh : null;
        A.winkR.mesh = winking ? winkMesh : null;
    };
}