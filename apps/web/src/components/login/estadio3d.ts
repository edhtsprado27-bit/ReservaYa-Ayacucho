// Estadio nocturno 3D + futbolista animado del login (diseño "ReservaYa Login 3D").
// Se carga solo en /login (import dinámico), así no pesa en el resto de la web.
//
// El diseño original usaba three.js r128. Con three.js actual, estas líneas
// mantienen el mismo aspecto: sin gestión de color y luces multiplicadas por PI.

import * as THREE from "three";

export type Estadio = {
  reiniciar: () => void; // repite la animación del futbolista
  recalcular: () => void; // vuelve a medir la tarjeta (cuando cambia de tamaño)
  destruir: () => void;
};

type Opciones = {
  bg: HTMLCanvasElement;
  fg: HTMLCanvasElement;
  tarjeta: HTMLElement;
  gol: HTMLElement;
  claseArrastre: string;
  claseGol: string;
};

type Pose = Record<
  | "x" | "y" | "ry" | "rz" | "spX" | "spZ" | "hdX" | "hdY" | "sLx" | "sLz" | "sRx" | "sRz"
  | "eLx" | "eLy" | "eRx" | "eRy" | "hLx" | "hLz" | "hRx" | "hRz" | "kL" | "kR" | "fL" | "fR",
  number
>;

type Vuelo = { from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; h: number; goal: boolean; bounce: number };

const PI = Math.PI;

export function crearEstadio(o: Opciones): Estadio {
  THREE.ColorManagement.enabled = false;

  const { bg: bgCanvas, fg: fgCanvas, tarjeta: card, gol: goalEl } = o;
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const sm = (x: number) => {
    x = clamp(x, 0, 1);
    return x * x * (3 - 2 * x);
  };
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const raiz = getComputedStyle(document.documentElement);
  const fuenteTitulo = raiz.getPropertyValue("--fuente-titulo").trim() || "'Barlow Condensed', 'Arial Narrow', sans-serif";

  const desechables: { dispose: () => void }[] = [];
  const quitar: (() => void)[] = [];
  const on = <K extends keyof WindowEventMap>(t: Window, ev: K, fn: (e: WindowEventMap[K]) => void) => {
    t.addEventListener(ev, fn);
    quitar.push(() => t.removeEventListener(ev, fn));
  };
  const onC = <K extends keyof HTMLElementEventMap>(t: HTMLElement, ev: K, fn: (e: HTMLElementEventMap[K]) => void) => {
    t.addEventListener(ev, fn);
    quitar.push(() => t.removeEventListener(ev, fn));
  };

  function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d")!, w, h);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    desechables.push(t);
    return t;
  }

  /* =====================================================================
     1. ESTADIO 3D (fondo interactivo)
     ===================================================================== */
  const bgR = new THREE.WebGLRenderer({ canvas: bgCanvas, antialias: true, alpha: true });
  bgR.outputColorSpace = THREE.LinearSRGBColorSpace;
  bgR.setPixelRatio(DPR);
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070b14, 60, 140);
  const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 400);

  scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x1a2b1a, 0.6 * PI));
  const sun = new THREE.DirectionalLight(0xfff4dc, 0.85 * PI);
  sun.position.set(12, 30, 14);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.15 * PI));

  const L = 40, W = 26;
  const pitchTex = canvasTex(2048, 1332, (g, w, h) => {
    const u = w / L;
    for (let i = 0; i < 16; i++) {
      g.fillStyle = i % 2 ? "#2a7a3b" : "#24803a";
      g.fillRect((i * w) / 16, 0, w / 16 + 1, h);
    }
    g.strokeStyle = "rgba(255,255,255,.92)";
    g.lineWidth = 7;
    const m = 1.2 * u;
    g.strokeRect(m, m, w - 2 * m, h - 2 * m);
    g.beginPath(); g.moveTo(w / 2, m); g.lineTo(w / 2, h - m); g.stroke();
    g.beginPath(); g.arc(w / 2, h / 2, 3.6 * u, 0, PI * 2); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(w / 2, h / 2, 9, 0, PI * 2); g.fill();
    const boxD = 6.4 * u, boxW = 15 * u, sixD = 2.2 * u, sixW = 7 * u;
    [m, w - m].forEach((x, k) => {
      const d = k ? -1 : 1;
      g.strokeRect(Math.min(x, x + d * boxD), h / 2 - boxW / 2, boxD, boxW);
      g.strokeRect(Math.min(x, x + d * sixD), h / 2 - sixW / 2, sixD, sixW);
      g.beginPath(); g.arc(x + d * 4.3 * u, h / 2, 8, 0, PI * 2); g.fill();
      g.beginPath();
      g.arc(x + d * 4.3 * u, h / 2, 3.6 * u, d > 0 ? -0.9 : PI - 0.9, d > 0 ? 0.9 : PI + 0.9);
      g.stroke();
    });
    g.globalAlpha = 0.16; g.fillStyle = "#fff"; g.font = `800 140px ${fuenteTitulo}`; g.textAlign = "center";
    g.fillText("RESERVAYA", w * 0.25, h / 2 + 50); g.fillText("AYACUCHO", w * 0.75, h / 2 + 50);
  });
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(L + 2.4, W + 2.4), new THREE.MeshStandardMaterial({ map: pitchTex, roughness: 0.85 }));
  pitch.rotation.x = -PI / 2;
  scene.add(pitch);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ color: 0x163522, roughness: 1 }));
  apron.rotation.x = -PI / 2; apron.position.y = -0.02;
  scene.add(apron);

  // Paneles LED animados
  const ledTex = canvasTex(1024, 64, (g, w, h) => {
    g.fillStyle = "#0b1324"; g.fillRect(0, 0, w, h);
    g.font = `800 42px ${fuenteTitulo}`; g.textBaseline = "middle";
    let x = 10;
    const parts: [string, string][] = [["RESERVAYA", "#ff7a1f"], [" · RESERVA TU CANCHA DEPORTIVA · ", "#ffffff"], ["AYACUCHO", "#ff7a1f"], [" · ", "#ffffff"]];
    while (x < w) parts.forEach(([t, c]) => { g.fillStyle = c; g.fillText(t, x, h / 2 + 2); x += g.measureText(t).width; });
  });
  ledTex.wrapS = THREE.RepeatWrapping;
  const ledMats: THREE.Texture[] = [];
  function ledBoard(len: number, x: number, z: number, ry: number) {
    const t = ledTex.clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.x = len / 18;
    desechables.push(t);
    const mat = new THREE.MeshBasicMaterial({ map: t }); ledMats.push(t);
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, 0.75, 0.15), mat); b.position.set(x, 0.38, z); b.rotation.y = ry; scene.add(b);
  }
  ledBoard(L + 6, 0, -(W / 2 + 2.2), 0); ledBoard(L + 6, 0, W / 2 + 2.2, PI);
  ledBoard(W + 2, -(L / 2 + 2.6), 0, PI / 2); ledBoard(W + 2, L / 2 + 2.6, 0, -PI / 2);

  // Tribunas con público
  const crowdTex = canvasTex(512, 128, (g, w, h) => {
    g.fillStyle = "#0d121d"; g.fillRect(0, 0, w, h);
    const cols = ["#8e1a24", "#b9bcc4", "#a8521c", "#2a4a86", "#9c8a3a", "#6b4a35", "#4a5262", "#3a4150"];
    for (let r = 0; r < 8; r++) { g.fillStyle = "rgba(255,255,255,.04)"; g.fillRect(0, r * 16 + 13, w, 2); }
    for (let i = 0; i < 1400; i++) {
      g.globalAlpha = 0.55 + Math.random() * 0.35; g.fillStyle = cols[(Math.random() * cols.length) | 0];
      g.beginPath(); g.arc(Math.random() * w, ((Math.random() * 8) | 0) * 16 + 7 + Math.random() * 4, 1.3 + Math.random() * 1.1, 0, PI * 2); g.fill();
    }
    g.globalAlpha = 1;
  });
  crowdTex.wrapS = crowdTex.wrapT = THREE.RepeatWrapping;
  const flashPos: number[] = [];
  function stand(len: number, cx: number, cz: number, ry: number) {
    for (let i = 0; i < 4; i++) {
      const t = crowdTex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(len / 8, 0.5);
      desechables.push(t);
      const box = new THREE.Mesh(new THREE.BoxGeometry(len - i * 0.5, 1.6 + i * 1.6, 2.8), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
      const g = new THREE.Group(); g.rotation.y = ry; g.position.set(cx, 0, cz);
      box.position.set(0, (1.6 + i * 1.6) / 2, i * 2.8); g.add(box); scene.add(g);
      for (let k = 0; k < 70; k++) {
        const p = new THREE.Vector3((Math.random() - 0.5) * (len - 2), 1.7 + i * 1.6 + 0.05, i * 2.8 + (Math.random() - 0.5) * 2.4);
        p.applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(new THREE.Vector3(cx, 0, cz)); flashPos.push(p.x, p.y, p.z);
      }
    }
  }
  stand(L + 10, 0, -(W / 2 + 5), PI); stand(L + 10, 0, W / 2 + 5, 0);
  stand(W + 6, -(L / 2 + 6), 0, -PI / 2); stand(W + 6, L / 2 + 6, 0, PI / 2);
  const flashGeo = new THREE.BufferGeometry();
  flashGeo.setAttribute("position", new THREE.Float32BufferAttribute(flashPos, 3));
  const flashCol = new Float32Array(flashPos.length);
  flashGeo.setAttribute("color", new THREE.BufferAttribute(flashCol, 3));
  scene.add(new THREE.Points(flashGeo, new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));

  // Arcos
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const GOAL_HW = 2.4, GOAL_H = 2.0, GOAL_D = 1.4;
  const nets: THREE.Mesh[] = [];
  [-1, 1].forEach((s) => {
    const g = new THREE.Group(); g.position.x = s * (L / 2); scene.add(g);
    const post = new THREE.CylinderGeometry(0.09, 0.09, GOAL_H, 12);
    [-GOAL_HW, GOAL_HW].forEach((z) => { const p = new THREE.Mesh(post, white); p.position.set(0, GOAL_H / 2, z); g.add(p); });
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, GOAL_HW * 2, 12), white); bar.rotation.x = PI / 2; bar.position.y = GOAL_H; g.add(bar);
    const net = new THREE.Mesh(new THREE.BoxGeometry(GOAL_D, GOAL_H, GOAL_HW * 2, 4, 6, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.45 }));
    net.position.set((s * GOAL_D) / 2, GOAL_H / 2, 0); g.add(net); nets.push(net);
  });

  // Torres de iluminación
  const glowTex = canvasTex(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, "rgba(255,250,230,1)"); r.addColorStop(0.25, "rgba(255,240,200,.55)"); r.addColorStop(1, "rgba(255,240,200,0)");
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  const lampTex = canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = "#1b1f28"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 6; x++) { g.fillStyle = "#fffbe8"; g.beginPath(); g.arc(12 + x * 21, 12 + y * 20, 8, 0, PI * 2); g.fill(); }
  });
  const center = new THREE.Vector3(0, 0, 0);
  ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).forEach(([sx, sz]) => {
    const base = new THREE.Vector3(sx * (L / 2 + 9), 0, sz * (W / 2 + 9));
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 18, 10), new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.6, metalness: 0.4 }));
    pole.position.copy(base).setY(9); scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.2, 0.4), new THREE.MeshBasicMaterial({ map: lampTex }));
    head.position.copy(base).setY(18.6); head.lookAt(center.x, 0, center.z); head.rotateX(0.5); scene.add(head);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    glow.position.copy(head.position); glow.scale.set(14, 14, 1); scene.add(glow);
    const target = new THREE.Vector3(sx * -4, 0, sz * -2);
    const dir = new THREE.Vector3().subVectors(head.position, target); const len = dir.length();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(10, len, 32, 1, true), new THREE.MeshBasicMaterial({ color: 0xfff3d1, transparent: true, opacity: 0.055, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    cone.position.copy(target).add(head.position).multiplyScalar(0.5);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); scene.add(cone);
  });

  // Estrellas
  const starPos: number[] = [];
  for (let i = 0; i < 600; i++) {
    const a = Math.random() * PI * 2, e = 0.15 + Math.random() * 1.2, r = 150;
    starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xc9d6ff, size: 0.6, fog: false })));

  // Balón
  const ballTex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = "#fafafa"; g.fillRect(0, 0, w, h); g.fillStyle = "#151515";
    for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) {
      const cx = x * 44 + (y % 2) * 22 + 10, cy = y * 34 + 10;
      g.beginPath();
      for (let k = 0; k < 5; k++) { const a = (k / 5) * PI * 2 - PI / 2; g.lineTo(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11); }
      g.fill();
    }
  });
  const BALL_R = 0.42;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 32, 20), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.4 }));
  ball.position.set(0, BALL_R, 0); scene.add(ball);
  const ballShadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
  const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(BALL_R * 1.1, 24), ballShadowMat);
  ballShadow.rotation.x = -PI / 2; ballShadow.position.y = 0.01; scene.add(ballShadow);

  /* ---- Física simple del balón ---- */
  let flight: Vuelo | null = null, flashBoost = 0, goals = 0;
  const timers: number[] = [];
  function kickTo(tx: number, tz: number) {
    const from = ball.position.clone(); from.y = BALL_R;
    let goal = false;
    if (Math.abs(tx) > L / 2 - 2.5 && Math.abs(tz) < GOAL_HW + 0.6) { goal = true; tx = Math.sign(tx) * (L / 2 + GOAL_D * 0.6); tz = clamp(tz, -GOAL_HW + 0.5, GOAL_HW - 0.5); }
    tx = clamp(tx, -L / 2 - 1.2, L / 2 + 1.2); tz = clamp(tz, -W / 2 + 0.5, W / 2 - 0.5);
    const d = Math.hypot(tx - from.x, tz - from.z);
    flight = { from, to: new THREE.Vector3(tx, BALL_R, tz), t: 0, dur: 0.45 + d * 0.035, h: goal ? Math.min(1.4, d * 0.12) : Math.min(5, 0.6 + d * 0.22), goal, bounce: 0 };
  }
  function scoreGoal(side: number) {
    goals++; flashBoost = 1.6;
    goalEl.textContent = goals > 1 ? "¡GOOOL! ×" + goals : "¡GOOOL!";
    goalEl.classList.add(o.claseGol);
    timers.push(window.setTimeout(() => goalEl.classList.remove(o.claseGol), 1600));
    nets[side > 0 ? 1 : 0].userData.shake = 1;
    timers.push(window.setTimeout(() => { flight = { from: ball.position.clone(), to: new THREE.Vector3(0, BALL_R, 0), t: 0, dur: 1.2, h: 0.2, goal: false, bounce: 9 }; }, 1400));
  }
  function stepBall(dt: number) {
    if (!flight) return;
    flight.t += dt / flight.dur; const t = Math.min(1, flight.t);
    const p = new THREE.Vector3().lerpVectors(flight.from, flight.to, t);
    p.y = BALL_R + 4 * flight.h * t * (1 - t);
    const moved = p.distanceTo(ball.position);
    const axis = new THREE.Vector3(flight.to.z - flight.from.z, 0, -(flight.to.x - flight.from.x)).normalize();
    if (axis.lengthSq() > 0) ball.rotateOnWorldAxis(axis, moved / BALL_R);
    ball.position.copy(p);
    if (t >= 1) {
      const f = flight; flight = null;
      if (f.goal) { scoreGoal(Math.sign(f.to.x)); return; }
      if (f.bounce < 2 && f.h > 0.4) {
        const dir = new THREE.Vector3().subVectors(f.to, f.from).setY(0).multiplyScalar(0.18);
        const next: Vuelo = { from: f.to.clone(), to: f.to.clone().add(dir), t: 0, dur: f.dur * 0.45, h: f.h * 0.3, goal: false, bounce: f.bounce + 1 };
        next.to.x = clamp(next.to.x, -L / 2 - 1.2, L / 2 + 1.2); next.to.z = clamp(next.to.z, -W / 2 + 0.5, W / 2 - 0.5);
        flight = next;
      }
    }
  }

  /* ---- Cámara: giro automático + arrastre + parallax ---- */
  let yawDrag = 0, pitchDrag = 0, parX = 0, parY = 0, tParX = 0, tParY = 0;
  let down: { x: number; y: number; moved: number } | null = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  onC(bgCanvas, "pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, moved: 0 }; bgCanvas.setPointerCapture(e.pointerId); });
  onC(bgCanvas, "pointermove", (e) => {
    tParX = e.clientX / innerWidth - 0.5; tParY = e.clientY / innerHeight - 0.5;
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y; down.moved += Math.abs(dx) + Math.abs(dy);
    if (down.moved > 6) bgCanvas.classList.add(o.claseArrastre);
    yawDrag -= dx * 0.005; pitchDrag = clamp(pitchDrag + dy * 0.02, -5, 8);
    down.x = e.clientX; down.y = e.clientY;
  });
  onC(bgCanvas, "pointerup", (e) => {
    bgCanvas.classList.remove(o.claseArrastre);
    const wasClick = down && down.moved < 8; down = null;
    if (!wasClick) return;
    if (hitPlayer(e.clientX, e.clientY)) { restart(); return; }
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    if (ray.intersectObject(ball).length) { const s = Math.random() < 0.5 ? -1 : 1; kickTo((s * L) / 2, (Math.random() - 0.5) * 3); return; }
    const hit = new THREE.Vector3(); if (ray.ray.intersectPlane(ground, hit)) kickTo(hit.x, hit.z);
  });

  /* =====================================================================
     2. FUTBOLISTA 3D (capa superior, cámara ortográfica en píxeles)
     ===================================================================== */
  const fgR = new THREE.WebGLRenderer({ canvas: fgCanvas, antialias: true, alpha: true });
  fgR.outputColorSpace = THREE.LinearSRGBColorSpace;
  fgR.setPixelRatio(DPR);
  const fscene = new THREE.Scene();
  const ocam = new THREE.OrthographicCamera(0, 1, 1, 0, -5000, 5000);
  fscene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a48, 0.8 * PI));
  const key = new THREE.DirectionalLight(0xffffff, 0.75 * PI); key.position.set(0.6, 1, 1.2); fscene.add(key);
  const rim = new THREE.DirectionalLight(0xffd9b0, 0.35 * PI); rim.position.set(-1, 0.6, -0.8); fscene.add(rim);

  const M = (c: number, r = 0.55, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const skin = M(0x9a5b34, 0.5), dark = M(0x151515, 0.6), hair = M(0x1a120c, 0.8), red = M(0xd91023, 0.5), sockW = M(0xf2f2ee, 0.6), lens = M(0x070707, 0.15, 0.4);
  const jerseyTex = canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = "#f6f6f2"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#d91023"; g.beginPath(); g.moveTo(w * 0.36, 0); g.lineTo(w * 0.47, 0); g.lineTo(w * 0.66, h); g.lineTo(w * 0.55, h); g.fill();
    g.fillRect(0, h - 10, w, 10);
  });
  const jersey = new THREE.MeshStandardMaterial({ map: jerseyTex, roughness: 0.6 });
  function limb(r1: number, r2: number, len: number, mat: THREE.Material, seg = 16) {
    const g = new THREE.CylinderGeometry(r1, r2, len, seg); g.translate(0, -len / 2, 0); return new THREE.Mesh(g, mat);
  }
  function at<T extends THREE.Object3D>(obj: T, x: number, y: number, z: number): T { obj.position.set(x, y, z); return obj; }

  const player = new THREE.Group(); player.rotation.order = "ZYX"; fscene.add(player);
  const hips = at(new THREE.Group(), 0, 1.42, 0); player.add(hips);
  hips.add(at(limb(0.37, 0.41, 0.42, dark), 0, 0.14, 0));
  const spine = at(new THREE.Group(), 0, 0.05, 0); hips.add(spine);
  const torsoGeo = new THREE.CylinderGeometry(0.45, 0.37, 0.95, 28); torsoGeo.translate(0, 0.475, 0); torsoGeo.rotateY(PI);
  spine.add(new THREE.Mesh(torsoGeo, jersey));
  const dome = at(new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 12, 0, PI * 2, 0, PI / 2), jersey), 0, 0.95, 0); dome.scale.set(1, 0.3, 1); spine.add(dome);
  spine.add(at(limb(0.11, 0.12, 0.22, skin), 0, 1.17, 0));
  const collar = at(new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 8, 20), red), 0, 1.0, 0); collar.rotation.x = PI / 2; spine.add(collar);

  const head = at(new THREE.Group(), 0, 1.12, 0); spine.add(head);
  const skull = at(new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 24), skin), 0, 0.42, 0); skull.scale.set(1, 1.08, 1); head.add(skull);
  const hairCap = at(new THREE.Mesh(new THREE.SphereGeometry(0.415, 32, 16, 0, PI * 2, 0, PI * 0.42), hair), 0, 0.46, -0.03); hairCap.rotation.x = -0.35; head.add(hairCap);
  [-1, 1].forEach((s) => head.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), skin), s * 0.39, 0.42, -0.02)));
  const nose = at(new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 12), skin), 0, 0.37, 0.4); nose.scale.set(1, 1.1, 1.3); head.add(nose);
  [-1, 1].forEach((s) => {
    head.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.05), lens), s * 0.15, 0.48, 0.37));
    head.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.34), lens), s * 0.27, 0.5, 0.2));
    const brow = at(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.035, 0.04), hair), s * 0.15, 0.585, 0.37); brow.rotation.z = -s * 0.12; head.add(brow);
  });
  head.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.03), lens), 0, 0.5, 0.39));
  head.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 10, 20, PI), hair), 0, 0.25, 0.37));
  const smile = at(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 16, PI), M(0x4a2412)), 0, 0.2, 0.385); smile.rotation.z = PI; head.add(smile);

  function makeArm(s: number) {
    const sh = at(new THREE.Group(), s * 0.5, 0.82, 0); spine.add(sh);
    sh.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), jersey), 0, 0, 0));
    sh.add(limb(0.15, 0.13, 0.27, jersey)); sh.add(at(limb(0.137, 0.137, 0.045, red), 0, -0.25, 0));
    sh.add(limb(0.095, 0.09, 0.45, skin));
    const el = at(new THREE.Group(), 0, -0.44, 0); el.rotation.order = "YXZ"; sh.add(el);
    el.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), skin));
    el.add(limb(0.088, 0.075, 0.4, skin));
    const hand = at(new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 12), skin), 0, -0.46, 0.01); hand.scale.set(0.95, 1.15, 0.85); el.add(hand);
    return { sh, el };
  }
  function makeLeg(s: number) {
    const hp = at(new THREE.Group(), s * 0.18, -0.12, 0); hips.add(hp);
    hp.add(limb(0.2, 0.19, 0.34, dark)); hp.add(limb(0.14, 0.115, 0.66, skin));
    const kn = at(new THREE.Group(), 0, -0.66, 0); hp.add(kn);
    kn.add(new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 10), skin));
    kn.add(limb(0.115, 0.085, 0.64, skin));
    kn.add(at(limb(0.122, 0.095, 0.46, sockW), 0, -0.18, 0)); kn.add(at(limb(0.124, 0.12, 0.05, red), 0, -0.24, 0));
    const an = at(new THREE.Group(), 0, -0.64, 0); kn.add(an);
    an.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.14, 0.4), dark), 0, -0.04, 0.1));
    an.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.42), sockW), 0, -0.115, 0.1));
    return { hp, kn, an };
  }
  const armL = makeArm(1), armR = makeArm(-1), legL = makeLeg(1), legR = makeLeg(-1);
  const blobMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
  const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 32), blobMat);
  blob.renderOrder = -1; fscene.add(blob);

  /* ---- Poses ---- */
  const KEYS = ["y", "ry", "rz", "spX", "spZ", "hdX", "hdY", "sLx", "sLz", "sRx", "sRz", "eLx", "eLy", "eRx", "eRy", "hLx", "hLz", "hRx", "hRz", "kL", "kR", "fL", "fR"] as const;
  const rest = (): Pose => ({ x: 0, y: 0, ry: PI / 2, rz: 0, spX: 0, spZ: 0, hdX: 0, hdY: 0, sLx: 0, sLz: 0.08, sRx: 0, sRz: -0.08, eLx: -0.15, eLy: 0, eRx: -0.15, eRy: 0, hLx: 0, hLz: 0, hRx: 0, hRz: 0, kL: 0, kR: 0, fL: 0, fR: 0 });
  const STRIDE = 1.74;
  function walkPose(dist: number, amp = 1) {
    const P = rest(), f = (2 * PI * dist) / STRIDE, s = Math.sin(f), c = Math.cos(f);
    P.hLx = -0.48 * amp * s; P.hRx = 0.48 * amp * s;
    P.kL = 0.08 + 1.05 * amp * Math.max(0, c) ** 2; P.kR = 0.08 + 1.05 * amp * Math.max(0, -c) ** 2;
    P.fL = 0.35 * Math.max(0, -s) * amp - 0.2 * Math.max(0, s) * amp; P.fR = 0.35 * Math.max(0, s) * amp - 0.2 * Math.max(0, -s) * amp;
    P.sLx = 0.5 * amp * s; P.sRx = -0.5 * amp * s; P.eLx = P.eRx = -0.45;
    P.y = 0.045 * Math.cos(2 * f) - 0.02; P.spX = 0.08; P.hdX = -0.04;
    return P;
  }
  function pullPose(dist: number) {
    const P = walkPose(dist, 0.75);
    P.spX = -0.32; P.hdX = 0.22; P.sLx = P.sRx = -1.42; P.eLx = P.eRx = -0.12; P.sLz = 0.05; P.sRz = -0.05;
    return P;
  }
  function jumpPose(u: number) {
    const P = rest(); let cr: number, air: number;
    if (u < 0.25) { cr = sm(u / 0.25); air = 0; }
    else if (u < 0.8) { cr = 1 - 0.6 * sm((u - 0.25) / 0.15); air = Math.sin((PI * (u - 0.25)) / 0.55); }
    else { cr = 0.7 * (1 - sm((u - 0.8) / 0.2)); air = 0; }
    P.y = air * 1.15 - cr * 0.3;
    P.kL = P.kR = cr * 1.1 + air * 0.9; P.hLx = P.hRx = -(cr * 0.55 + air * 0.7); P.fL = P.fR = cr * -0.2;
    P.spX = cr * 0.35; P.sLx = P.sRx = 0.7 * cr * (u < 0.3 ? 1 : 0) - 2.9 * air; P.sLz = 0.2; P.sRz = -0.2; P.eLx = P.eRx = -0.25;
    P.ry = lerp(PI / 2, 0.85, sm(u * 1.4)); P.hdY = lerp(0, -0.4, sm(u));
    return P;
  }
  function pointPose(t: number) {
    const P = rest(), w = Math.sin(t * 9);
    P.ry = 0.85; P.sLx = -1.5 + 0.12 * w; P.sRx = -1.42 + 0.12 * w; P.sLz = 0.18; P.sRz = -0.12; P.eLx = P.eRx = -0.08;
    P.hdY = -0.55; P.hdX = 0.04; P.spX = -0.04; P.hLz = 0.06; P.hRz = -0.06; P.y = 0.025 * Math.abs(w);
    return P;
  }
  function leanPose(t: number) {
    const P = rest();
    P.ry = 0.5; P.rz = -0.13;
    P.sRx = -0.42; P.sRz = -0.14; P.eRx = -1.75; P.eRy = 1.2;
    P.sLx = -0.3; P.sLz = 0.14; P.eLx = -1.7; P.eLy = -1.2;
    P.hLx = -0.14; P.hLz = -0.13; P.hRz = 0.05; P.kL = 0.08;
    P.hdY = -0.42 + 0.12 * Math.sin(t * 0.7); P.hdX = 0.05;
    P.y = 0.012 * Math.sin(t * 2.1); P.spX = 0.02 + 0.01 * Math.sin(t * 2.1);
    return P;
  }
  function blendPose(a: Pose, b: Pose, k: number) { const out = { ...b }; KEYS.forEach((kk) => { out[kk] = lerp(a[kk], b[kk], k); }); return out; }

  /* ---- Coreografía según el tamaño de pantalla ---- */
  type Fase = { id: string; dur: number; blend: number; start: number };
  type Plan = { r: DOMRect; S: number; groundY: number; contact: number; D: number; startX: number; xWalkEnd: number; xPullEnd: number; xJump: number; leanX: number; narrow: boolean; phases: Fase[] };
  let plan: Plan | null = null, startT = 0, lastPhase = -1, snap: Pose | null = null, lastPose = rest();
  function measure() {
    const prev = card.style.transform; card.style.transform = "none";
    const r = card.getBoundingClientRect(); card.style.transform = prev; return r;
  }
  function buildPlan() {
    const r = measure(), vw = innerWidth;
    const narrow = vw < 860 || r.left < 200;
    const S = narrow ? clamp((r.top - 18) / 3.5, 26, 48) : clamp((r.height * 0.8) / 3.42, 60, 118);
    const groundY = narrow ? r.top + 4 : r.bottom + 14;
    const contact = 1.05 * S;
    const D = narrow ? 0 : Math.max(0, vw - 170 - r.left);
    const startX = -1.6 * S;
    const xWalkEnd = narrow ? r.left + 1.9 * S : r.left + D - contact;
    const xPullEnd = narrow ? xWalkEnd : r.left - contact;
    const xJump = narrow ? r.left + 1.2 * S : xPullEnd - 0.35 * S;
    const leanX = narrow ? r.left + 0.9 * S : r.left - 0.74 * S;
    const walkDur = Math.max(1.1, (xWalkEnd - startX) / (3.7 * S));
    const pullDur = D > 0 ? 1.5 : 0;
    const toLeanDur = Math.abs(leanX - xJump) / (2.6 * S) + 0.35;
    const phases = [
      { id: "walk", dur: walkDur, blend: 0, start: 0 },
      { id: "pull", dur: pullDur, blend: 0.22, start: 0 },
      { id: "jump", dur: 0.9, blend: 0.15, start: 0 },
      { id: "point", dur: 1.6, blend: 0.25, start: 0 },
      { id: "toLean", dur: toLeanDur, blend: 0.3, start: 0 },
      { id: "lean", dur: Infinity, blend: 0.8, start: 0 },
    ].filter((p) => p.dur > 0);
    let acc = 0.25; phases.forEach((p) => { p.start = acc; acc += p.dur; });
    plan = { r, S, groundY, contact, D, startX, xWalkEnd, xPullEnd, xJump, leanX, narrow, phases };
  }

  function poseAt(t: number) {
    const p = plan!; let ph = p.phases[0], i = 0;
    for (let k = 0; k < p.phases.length; k++) if (t >= p.phases[k].start) { ph = p.phases[k]; i = k; }
    const tt = Math.max(0, t - ph.start); let P: Pose, x: number, off = 0;
    const walked = (p.xWalkEnd - p.startX) / p.S;
    switch (ph.id) {
      case "walk": { const u = clamp(tt / ph.dur, 0, 1); x = lerp(p.startX, p.xWalkEnd, u); P = walkPose((x - p.startX) / p.S); off = p.D; break; }
      case "pull": { const u = sm(tt / ph.dur); off = p.D * (1 - u); x = p.r.left + off - p.contact; P = pullPose(walked + (x - p.xWalkEnd) / p.S); break; }
      case "jump": { const u = clamp(tt / ph.dur, 0, 1); x = lerp(p.xPullEnd, p.xJump, sm(u)); P = jumpPose(u); break; }
      case "point": { x = p.xJump; P = pointPose(tt); break; }
      case "toLean": { const u = clamp(tt / ph.dur, 0, 1); x = lerp(p.xJump, p.leanX, u); P = walkPose((x - p.xJump) / p.S, 0.8); P.ry = lerp(0.85, 0.5, u); P.hdY = -0.3; break; }
      default: { x = p.leanX; P = leanPose(tt); if (p.narrow) P.rz = 0; }
    }
    if (i !== lastPhase) { snap = lastPose; lastPhase = i; }
    if (ph.blend > 0 && snap && tt < ph.blend) P = blendPose(snap, P, sm(tt / ph.blend));
    P.x = x; lastPose = P;
    return { P, off };
  }

  function applyPose(P: Pose) {
    const S = plan!.S, gy = innerHeight - plan!.groundY;
    player.scale.setScalar(S);
    player.position.set(P.x, gy + P.y * S, 0);
    player.rotation.set(0, P.ry, P.rz);
    spine.rotation.set(P.spX, 0, P.spZ);
    head.rotation.set(P.hdX, P.hdY, 0);
    armL.sh.rotation.set(P.sLx, 0, P.sLz); armR.sh.rotation.set(P.sRx, 0, P.sRz);
    armL.el.rotation.set(P.eLx, P.eLy, 0); armR.el.rotation.set(P.eRx, P.eRy, 0);
    legL.hp.rotation.set(P.hLx, 0, P.hLz); legR.hp.rotation.set(P.hRx, 0, P.hRz);
    legL.kn.rotation.x = P.kL; legR.kn.rotation.x = P.kR; legL.an.rotation.x = P.fL; legR.an.rotation.x = P.fR;
    const lift = clamp(P.y, 0, 1.2);
    blob.position.set(P.x, gy + 0.02 * S, -2 * S);
    blob.scale.set(0.85 * S * (1 - lift * 0.4), 0.13 * S * (1 - lift * 0.4), 1);
    blobMat.opacity = 0.3 * (1 - lift * 0.5);
  }

  function hitPlayer(cx: number, cy: number) {
    if (!plan) return false; const S = plan.S, x = lastPose.x;
    return cx > x - 0.9 * S && cx < x + 0.9 * S && cy < plan.groundY && cy > plan.groundY - 3.6 * S;
  }
  function restart() { buildPlan(); lastPhase = -1; snap = null; startT = performance.now() / 1000; }

  /* ---- Tamaño ---- */
  function resize() {
    const w = innerWidth, h = innerHeight;
    bgR.setSize(w, h, false); fgR.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    ocam.left = 0; ocam.right = w; ocam.top = h; ocam.bottom = 0; ocam.updateProjectionMatrix();
    const done = plan && performance.now() / 1000 - startT > plan.phases[plan.phases.length - 1].start;
    buildPlan(); if (done) startT = performance.now() / 1000 - plan!.phases[plan!.phases.length - 1].start - 1;
  }
  on(window, "resize", resize);

  /* ---- Bucle ---- */
  let prev = performance.now() / 1000, clock = 0, raf = 0, vivo = true;
  function frame() {
    if (!vivo) return;
    const now = performance.now() / 1000, dt = Math.min(0.05, now - prev); prev = now; clock += dt;
    parX += (tParX - parX) * 0.05; parY += (tParY - parY) * 0.05;
    const narrowCam = innerWidth / innerHeight < 0.9;
    const yaw = 0.35 + (reduceMotion ? 0 : Math.sin(clock * 0.07) * 0.3) + yawDrag + parX * 0.25;
    const R = narrowCam ? 60 : 46, hgt = 19 + pitchDrag + parY * 3;
    cam.position.set(Math.sin(yaw) * R, hgt, Math.cos(yaw) * R); cam.lookAt(0, -1.5, 0);
    if (!reduceMotion) ledMats.forEach((t) => { t.offset.x = (t.offset.x + dt * 0.06) % 1; });
    flashBoost = Math.max(0, flashBoost - dt * 0.8);
    const rate = 0.004 + flashBoost * 0.08;
    for (let i = 0; i < flashCol.length; i += 3) { const v = Math.random() < rate ? 1 : flashCol[i] * 0.82; flashCol[i] = flashCol[i + 1] = flashCol[i + 2] = v; }
    flashGeo.attributes.color.needsUpdate = true;
    stepBall(dt);
    ballShadow.position.set(ball.position.x, 0.01, ball.position.z);
    ballShadowMat.opacity = 0.35 / (1 + (ball.position.y - BALL_R) * 0.6);
    nets.forEach((n) => { const s = (n.userData.shake as number) || 0; if (s > 0) { n.userData.shake = Math.max(0, s - dt * 1.2); n.scale.x = 1 + Math.sin(clock * 40) * 0.12 * s; } });
    bgR.render(scene, cam);
    if (plan) {
      const t = reduceMotion ? 1e4 : now - startT;
      const { P, off } = poseAt(t);
      card.style.transform = off > 0.5 ? "translateX(" + off.toFixed(1) + "px)" : "";
      applyPose(P);
      fgR.render(fscene, ocam);
    }
    raf = requestAnimationFrame(frame);
  }

  resize();
  restart();
  raf = requestAnimationFrame(frame);

  return {
    reiniciar: restart,
    recalcular: resize,
    destruir() {
      vivo = false;
      cancelAnimationFrame(raf);
      timers.forEach((t) => clearTimeout(t));
      quitar.forEach((f) => f());
      card.style.transform = "";
      [scene, fscene].forEach((sc) =>
        sc.traverse((obj) => {
          const m = obj as THREE.Mesh;
          m.geometry?.dispose();
          const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
          mats.forEach((mat) => mat.dispose());
        }),
      );
      desechables.forEach((d) => d.dispose());
      bgR.dispose();
      fgR.dispose();
    },
  };
}
