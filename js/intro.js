/*
 * PRANA cinematic intro
 * ---------------------
 * Layers (back → front):  plate (photo/video)  →  veil  →  WebGL bracelet  →  glint  →  bloom  →  wordmark
 *
 * The bracelet is a procedural 3D object lit by an image-based environment, so its stones
 * genuinely reflect light as it turns. GSAP drives a single master timeline; every tween
 * writes into the proxy object `S`, and `apply()` turns that state into camera-space
 * position / rotation / scale each frame.
 *
 *   prepare()  loads Three.js + the plate and builds the scene (can fail → site shows without intro)
 *   play()     runs the film; resolves when the homepage is fully revealed
 *
 * Debug helpers:  ?debug          pauses at t=0 and exposes window.__pranaIntro.seek(seconds)
 *                 ?calibrate      lets you click the wrist position on your own photo
 */
import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const CALIBRATE = params.has('calibrate');

const CAM = { fov: 28, z: 12 };

export async function prepare() {
  const gsap = window.gsap;
  if (!gsap) throw new Error('GSAP not loaded');

  const [THREE, { RoomEnvironment }] = await Promise.all([
    import('three'),
    import('three/addons/environments/RoomEnvironment.js')
  ]);

  const root = $('intro');
  const plateEl = $('introPlate');
  const veil = $('introVeil');
  const canvas = $('introCanvas');
  const glint = $('introGlint');
  const bloom = $('introBloom');
  const brand = $('introBrand');
  const skipBtn = $('introSkip');
  const calBox = $('introCal');

  /* ---------- plate (image or video) ---------- */
  const plate = await loadPlate(plateEl, CONFIG.plate.src);

  /* ---------- renderer / scene ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, innerWidth < 700 ? 1.75 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.95;

  const camera = new THREE.PerspectiveCamera(CAM.fov, 1, 0.1, 100);
  camera.position.set(0, 0, CAM.z);

  const key = new THREE.DirectionalLight(0xfff0d4, 1.7);
  key.position.set(-3, 4, 6);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.12));
  // travelling light: the "catch the light" moment
  const sweep = new THREE.PointLight(0xfff3dc, 0, 0, 2);
  sweep.position.set(-5, 1.5, 3.2);
  scene.add(sweep);

  /* ---------- bracelet ---------- */
  const { rig, ringRadius, materials } = buildBracelet(THREE, CONFIG.bracelet);
  scene.add(rig);

  /* ---------- gold dust ---------- */
  const dust = buildDust(THREE);
  scene.add(dust.points);

  /* ---------- layout (re-run on resize) ---------- */
  const L = {
    p0: new THREE.Vector3(), p1: new THREE.Vector3(), p2: new THREE.Vector3(), c: new THREE.Vector3(),
    dir: new THREE.Vector3(), s0: 1, s1: 1, centerR: 1, dw: 1, dh: 1, ox: 0, oy: 0, viewH: 1, viewW: 1, px2w: 1
  };
  const qA = new THREE.Quaternion();
  const qB = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.22, 0.32, 0.05));

  function layout() {
    const vw = innerWidth, vh = innerHeight;
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    camera.updateProjectionMatrix();

    L.viewH = 2 * Math.tan(THREE.MathUtils.degToRad(CAM.fov / 2)) * CAM.z;
    L.viewW = L.viewH * camera.aspect;
    L.px2w = L.viewH / vh;

    // reproduce object-fit: cover so image coordinates map to screen pixels exactly
    const s = Math.max(vw / plate.w, vh / plate.h);
    L.dw = plate.w * s; L.dh = plate.h * s;
    const [fx, fy] = String(CONFIG.plate.focus).split(/\s+/).map((v) => parseFloat(v) / 100);
    L.ox = (vw - L.dw) * (isNaN(fx) ? 0.5 : fx);
    L.oy = (vh - L.dh) * (isNaN(fy) ? 0.5 : fy);

    const ax = L.ox + CONFIG.plate.wrist.x * L.dw;
    const ay = L.oy + CONFIG.plate.wrist.y * L.dh;
    plateEl.style.transformOrigin = `${ax}px ${ay}px`; // push-in pivots on the wrist, so the bracelet never drifts off it

    L.p0.set((ax - vw / 2) * L.px2w, -(ay - vh / 2) * L.px2w, 0);
    const a = THREE.MathUtils.degToRad(CONFIG.plate.slideAngle);
    L.dir.set(Math.cos(a), -Math.sin(a), 0); // screen is y-down, world is y-up
    L.p1.copy(L.p0).addScaledVector(L.dir, CONFIG.plate.slideDistance * L.dh * L.px2w);
    L.p2.set(0, L.viewH * 0.03, 0.5);
    L.c.copy(L.p1).lerp(L.p2, 0.5).add(new THREE.Vector3(0, L.viewH * 0.1, 0.8));

    L.s0 = (CONFIG.plate.wristSize * L.dh * 0.5 * L.px2w) / ringRadius;
    L.centerR = 0.27 * Math.min(L.viewH, L.viewW);
    L.s1 = L.centerR / ringRadius;

    // wrist pose: ring axis runs along the arm, seen slightly obliquely
    const n = new THREE.Vector3(L.dir.x, L.dir.y, 0.42).normalize();
    qA.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  }

  /* ---------- state proxy + frame application ---------- */
  const S = { kb: 1, fade: 0, u1: 0, u2: 0, k: 0, grow: 0, spin: 0, wob: 0, pop: 1, dust: 0, sweep: 0 };
  const _q = new THREE.Quaternion(), _qs = new THREE.Quaternion(), _p = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
  const AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0);

  function apply() {
    // position: slide along the arm, then curve into the centre
    if (S.u2 <= 0) {
      _p.copy(L.p0).addScaledVector(L.dir, (CONFIG.plate.slideDistance * L.dh * L.px2w) * S.u1);
    } else {
      const u = S.u2, v = 1 - u;
      _a.copy(L.p1).multiplyScalar(v * v);
      _b.copy(L.c).multiplyScalar(2 * v * u);
      _p.copy(_a).add(_b).addScaledVector(L.p2, u * u);
    }
    rig.position.copy(_p);

    rig.scale.setScalar(THREE.MathUtils.lerp(L.s0 * S.kb, L.s1, S.grow) * S.pop);

    _q.copy(qA).slerp(qB, S.k);
    _qs.setFromAxisAngle(AY, S.spin);
    _q.premultiply(_qs);
    _qs.setFromAxisAngle(AX, S.wob);
    _q.premultiply(_qs);
    rig.quaternion.copy(_q);

    for (const m of materials) m.opacity = S.fade;
    dust.material.opacity = S.dust;
    sweep.intensity = S.sweep;
    sweep.position.x = -5 + 10 * (S.spin / (Math.PI * 2));
    plateEl.style.transform = `scale(${S.kb})`;
  }

  /* ---------- render loop (only while intro is alive) ---------- */
  let alive = true;
  const tick = (_t, dtMs) => {
    if (!alive) return;
    dust.step(Math.min(dtMs, 50) / 1000);
    renderer.render(scene, camera);
  };
  gsap.ticker.add(tick);

  layout();
  apply();
  let resizeRaf = 0;
  const onResize = () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(() => { layout(); apply(); }); };
  addEventListener('resize', onResize);

  /* ---------- teardown ---------- */
  function destroy() {
    if (!alive) return;
    alive = false;
    gsap.ticker.remove(tick);
    removeEventListener('resize', onResize);
    rig.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    materials.forEach((m) => m.dispose());
    dust.dispose();
    envTex.dispose();
    pmrem.dispose();
    renderer.dispose();
    try { renderer.forceContextLoss(); } catch (e) {}
    if (plate.el.tagName === 'VIDEO') plate.el.pause();
  }

  /* ---------- the film ---------- */
  function play(onReveal) {
    return new Promise((resolve) => {
      let revealed = false, finished = false;
      const reveal = () => { if (!revealed) { revealed = true; try { onReveal && onReveal(); } catch (e) { console.error(e); } } };
      const finish = () => {
        if (finished) return;
        finished = true;
        reveal();
        tl.kill();
        gsap.killTweensOf([root, plateEl, veil, glint, bloom, brand, S]);
        destroy();
        resolve();
      };

      if (plate.el.tagName === 'VIDEO') { plate.el.play().catch(() => {}); }
      gsap.set(brand, { y: 18 });
      gsap.set(glint, { scale: 0.2, rotate: 0 });

      const tl = gsap.timeline({ paused: true, onUpdate: apply, onComplete: finish });
      const K = CONFIG.plate.kenBurns;

      tl
        // 0 — arrive: ivory dissolves into the close-up; bracelet resting on the wrist
        .to(plateEl, { opacity: 1, duration: 1.1, ease: 'power1.out' }, 0)
        .to(S, { kb: K, duration: 7.2, ease: 'power1.inOut' }, 0)
        .to(S, { fade: 1, duration: 0.8, ease: 'power1.out' }, 0.3)
        // 1 — it slides off the wrist
        .to(S, { u1: 1, k: 0.3, duration: 1.5, ease: 'power2.inOut' }, 1.15)
        // 2 — it lifts away from the hand and floats to the centre, turning to face us
        .to(S, { u2: 1, k: 1, grow: 1, duration: 1.8, ease: 'power3.inOut' }, 2.55)
        .to(veil, { opacity: 1, duration: 1.7, ease: 'power1.inOut' }, 2.65)
        .to(brand, { opacity: 1, y: 0, duration: 1.3, ease: 'power2.out' }, 3.7)
        // 3 — a full slow rotation; a light sweeps across the stones
        .to(S, { spin: Math.PI * 2, duration: 3.0, ease: 'power1.inOut' }, 3.3)
        .to(S, { wob: 0.2, duration: 1.5, ease: 'sine.inOut' }, 3.3)
        .to(S, { wob: 0.04, duration: 1.5, ease: 'sine.inOut' }, 4.8)
        .to(S, { sweep: 34, duration: 0.7, ease: 'power1.out' }, 3.3)
        .to(S, { sweep: 0, duration: 0.9, ease: 'power1.in' }, 5.6)
        // 4 — it catches the light
        .add(() => placeGlint(), 4.85)
        .to(glint, { opacity: 1, scale: 1.1, rotate: 45, duration: 0.45, ease: 'power2.out' }, 4.85)
        .to(glint, { opacity: 0, scale: 0.5, rotate: 90, duration: 0.7, ease: 'power2.in' }, 5.3)
        // 5 — and dissolves into gold dust as the homepage is revealed
        .to(bloom, { opacity: 0.95, duration: 0.5, ease: 'power2.out' }, 5.95)
        .add(() => dust.burst(rig.position, L.centerR), 6.0)
        .to(S, { dust: 1, duration: 0.25 }, 6.0)
        .to(S, { dust: 0, duration: 1.3, ease: 'power1.in' }, 6.35)
        .to(S, { fade: 0, pop: 1.12, duration: 1.0, ease: 'power2.in' }, 6.0)
        .to(bloom, { opacity: 0, duration: 0.9, ease: 'power1.out' }, 6.4)
        .add(reveal, 6.25)
        .to(root, { opacity: 0, scale: 1.03, filter: 'blur(10px)', duration: 1.1, ease: 'power2.inOut' }, 6.25);
      tl.duration(); // materialise

      function placeGlint() {
        // project a point on the upper-right of the ring into screen space
        _a.set(ringRadius * 0.72, ringRadius * 0.7, 0).applyQuaternion(rig.quaternion).multiplyScalar(rig.scale.x).add(rig.position);
        _a.project(camera);
        gsap.set(glint, { x: (_a.x * 0.5 + 0.5) * innerWidth, y: (-_a.y * 0.5 + 0.5) * innerHeight });
      }

      function skip() {
        if (finished) return;
        tl.pause();
        reveal();
        gsap.to(root, { opacity: 0, duration: 0.55, ease: 'power1.out', onComplete: finish });
      }
      skipBtn.addEventListener('click', skip);
      addEventListener('keydown', (e) => { if (e.key === 'Escape') skip(); });

      if (CALIBRATE) { calibrate(); return; }

      if (DEBUG) {
        window.__pranaIntro = { tl, S, seek: (t) => { tl.pause(t); apply(); renderer.render(scene, camera); }, duration: tl.duration() };
        tl.pause(0);
        return;
      }
      tl.play(0);
    });
  }

  /* ---------- calibration mode ---------- */
  function calibrate() {
    gsap.set(plateEl, { opacity: 1 });
    gsap.set(root, { opacity: 1 });
    S.fade = 1; S.kb = 1; S.u1 = 0; S.u2 = 0; S.k = 0; S.grow = 0;
    skipBtn.hidden = true;
    calBox.hidden = false;
    const P = CONFIG.plate;
    const show = () => {
      calBox.textContent =
        'CALIBRATE  —  click: wrist · wheel: size · ←/→: angle · ↑/↓: distance · space: preview\n\n' +
        'wrist: { x: ' + P.wrist.x.toFixed(3) + ', y: ' + P.wrist.y.toFixed(3) + ' },\n' +
        'wristSize: ' + P.wristSize.toFixed(3) + ',\n' +
        'slideAngle: ' + Math.round(P.slideAngle) + ',\n' +
        'slideDistance: ' + P.slideDistance.toFixed(3) + ',';
    };
    const refresh = () => { layout(); apply(); show(); };
    root.addEventListener('click', (e) => {
      if (e.target === skipBtn) return;
      P.wrist.x = Math.min(1, Math.max(0, (e.clientX - L.ox) / L.dw));
      P.wrist.y = Math.min(1, Math.max(0, (e.clientY - L.oy) / L.dh));
      refresh();
    });
    root.addEventListener('wheel', (e) => { e.preventDefault(); P.wristSize = Math.min(0.8, Math.max(0.04, P.wristSize * (e.deltaY > 0 ? 0.95 : 1.05))); refresh(); }, { passive: false });
    addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') P.slideAngle -= 5;
      else if (e.key === 'ArrowRight') P.slideAngle += 5;
      else if (e.key === 'ArrowUp') P.slideDistance = Math.min(0.6, P.slideDistance + 0.01);
      else if (e.key === 'ArrowDown') P.slideDistance = Math.max(0.02, P.slideDistance - 0.01);
      else if (e.key === ' ') { e.preventDefault(); gsap.fromTo(S, { u1: 0 }, { u1: 1, duration: 1.2, ease: 'power2.inOut', yoyo: true, repeat: 1, onUpdate: apply }); return; }
      else return;
      e.preventDefault();
      refresh();
    });
    show();
  }

  return { play, destroy };
}

/* =========================================================
   helpers
   ========================================================= */
function loadPlate(host, src) {
  const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(src);
  return new Promise((resolve, reject) => {
    const el = document.createElement(isVideo ? 'video' : 'img');
    if (isVideo) {
      el.muted = true; el.loop = true; el.playsInline = true; el.preload = 'auto';
      el.setAttribute('playsinline', ''); el.setAttribute('muted', '');
      el.addEventListener('loadeddata', () => resolve({ el, w: el.videoWidth, h: el.videoHeight }), { once: true });
    } else {
      el.alt = ''; el.decoding = 'async';
      el.addEventListener('load', () => resolve({ el, w: el.naturalWidth, h: el.naturalHeight }), { once: true });
    }
    el.addEventListener('error', () => reject(new Error('Intro plate failed to load: ' + src)), { once: true });
    host.appendChild(el);
    el.src = src;
  });
}

function buildBracelet(THREE, cfg) {
  const C = cfg.colors;
  const physical = (color, extra) => new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, transparent: true }, extra));
  const mats = {
    jade: physical(C.jade, { sheen: 0.4, sheenColor: new THREE.Color(0xcfe6d3), sheenRoughness: 0.5 }),
    forest: physical(C.forest, { roughness: 0.2 }),
    moon: physical(C.moon, { roughness: 0.1, iridescence: 0.85, iridescenceIOR: 1.28, iridescenceThicknessRange: [120, 420] }),
    gold: new THREE.MeshStandardMaterial({ color: C.gold, metalness: 1, roughness: 0.2, transparent: true }),
    thread: new THREE.MeshStandardMaterial({ color: C.thread, roughness: 0.9, metalness: 0, transparent: true })
  };

  const base = cfg.beadRadius;
  const RONDELLE = 0.45; // gold spacers: flat discs, thickness along the strand
  const items = cfg.pattern.map(([m, size]) => {
    const r = base * size * (m === 'gold' ? 0.85 : 1);
    return { m, r, width: m === 'gold' ? 2 * r * RONDELLE : 2 * r };
  });
  const total = items.reduce((s, i) => s + i.width, 0);
  const R = total / (Math.PI * 2);

  const ring = new THREE.Group();
  let acc = 0;
  for (const it of items) {
    const theta = ((acc + it.width / 2) / total) * Math.PI * 2;
    acc += it.width;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(it.r, 56, 36), mats[it.m]);
    mesh.position.set(Math.cos(theta) * R, Math.sin(theta) * R, 0);
    if (it.m === 'gold') {
      // squash local x, then turn local x to point along the strand (tangent = theta + 90°)
      mesh.scale.set(RONDELLE, 1, 1);
      mesh.rotation.z = theta + Math.PI / 2;
    }
    ring.add(mesh);
  }

  const thread = new THREE.Mesh(new THREE.TorusGeometry(R, base * 0.07, 10, 180), mats.thread);
  ring.add(thread);

  const rig = new THREE.Group();
  rig.add(ring);
  return { rig, ringRadius: R + base, materials: Object.values(mats) };
}

function buildDust(THREE) {
  const N = 170;
  const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,244,214,1)'); grad.addColorStop(0.35, 'rgba(255,222,150,.55)'); grad.addColorStop(1, 'rgba(255,222,150,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.PointsMaterial({ map, size: 0.11, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  let live = false;

  return {
    points, material,
    burst(center, radius) {
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2, r = radius * (0.85 + Math.random() * 0.3);
        pos[i * 3] = center.x + Math.cos(a) * r;
        pos[i * 3 + 1] = center.y + Math.sin(a) * r;
        pos[i * 3 + 2] = center.z + (Math.random() - 0.5) * 0.4;
        const sp = 0.25 + Math.random() * 0.9;
        vel[i * 3] = Math.cos(a) * sp * 0.4 + (Math.random() - 0.5) * 0.3;
        vel[i * 3 + 1] = Math.sin(a) * sp * 0.4 + 0.25 + Math.random() * 0.5;
        vel[i * 3 + 2] = (Math.random() - 0.3) * 0.5;
      }
      geo.attributes.position.needsUpdate = true;
      live = true;
    },
    step(dt) {
      if (!live) return;
      const damp = Math.pow(0.55, dt * 3);
      for (let i = 0; i < N; i++) {
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        vel[i * 3] *= damp; vel[i * 3 + 1] *= damp; vel[i * 3 + 2] *= damp;
      }
      geo.attributes.position.needsUpdate = true;
    },
    dispose() { geo.dispose(); material.dispose(); map.dispose(); }
  };
}
