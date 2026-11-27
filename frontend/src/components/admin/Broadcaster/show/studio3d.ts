// NEXUS SPORT Virtual Studio — ONE 3D set (Three.js, already a dependency) whose
// composition changes with the content: OPENING, NEWSROOM, MATCH CENTER, ANALYSIS,
// STATS, DEBATE, UPCOMING, CLOSING share the same architecture, materials and light;
// only the camera, the props on stage, the accent light and the screens change.
//
// Built for the real broadcasting PC (integrated Intel GPU):
// - simple reusable geometry (boxes, planes, cylinders), no models, no textures to download;
// - render ON DEMAND: a frame is drawn only while the camera moves or a screen changed,
//   a static scene costs nothing;
// - quality profiles LOW / MEDIUM / HIGH (internal resolution, antialias, light cones, shadows);
// - preserveDrawingBuffer so the compositor can copy the last frame at any time;
// - dispose() releases every GPU resource (long sessions don't accumulate memory).
// Without WebGL the caller uses the 2D fallback (drawFallback).

import * as THREE from "three";
import type { Quality, Shot, StageId } from "./types";

export const QUALITY: Record<Quality, { w: number; h: number; antialias: boolean; cones: boolean; shadows: boolean; maxFps: number }> = {
  LOW: { w: 960, h: 540, antialias: false, cones: false, shadows: false, maxFps: 24 },
  MEDIUM: { w: 1280, h: 720, antialias: true, cones: true, shadows: false, maxFps: 30 },
  HIGH: { w: 1920, h: 1080, antialias: true, cones: true, shadows: true, maxFps: 30 },
};

interface CamPose { pos: [number, number, number]; look: [number, number, number]; fov: number }
export const SHOTS: Record<Shot, CamPose> = {
  WIDE: { pos: [0, 5.4, 16], look: [0, 3.6, -6], fov: 50 },
  HERO: { pos: [0, 3.2, 9.5], look: [0, 3.4, -8], fov: 44 },
  SCREEN: { pos: [0, 4.7, 2.6], look: [0, 4.7, -8], fov: 46 },
  DATA: { pos: [-3.2, 4.6, 4.6], look: [0.8, 4.6, -8], fov: 46 },
  SPLIT: { pos: [0, 4.9, 6.6], look: [0, 4.4, -8], fov: 60 },
  DEBATE: { pos: [6.4, 3.4, 8.6], look: [-1.2, 2.2, -2.5], fov: 46 },
  CLOSING: { pos: [0, 8.2, 20], look: [0, 3.2, -6], fov: 46 },
};

/** What each configuration of the single set changes. */
export const STAGES: Record<StageId, { shot: Shot; accent: number; desk: boolean; podiums: boolean; dataRings: boolean; noris: boolean }> = {
  OPENING: { shot: "WIDE", accent: 1.4, desk: false, podiums: false, dataRings: false, noris: true },
  NEWSROOM: { shot: "HERO", accent: 0.9, desk: true, podiums: false, dataRings: false, noris: false },
  MATCH_CENTER: { shot: "SCREEN", accent: 1.1, desk: false, podiums: false, dataRings: false, noris: false },
  ANALYSIS: { shot: "DATA", accent: 0.8, desk: true, podiums: false, dataRings: true, noris: false },
  STATS: { shot: "DATA", accent: 1.0, desk: false, podiums: false, dataRings: true, noris: false },
  DEBATE: { shot: "DEBATE", accent: 1.0, desk: false, podiums: true, dataRings: false, noris: true },
  UPCOMING: { shot: "SPLIT", accent: 1.0, desk: false, podiums: false, dataRings: false, noris: false },
  CLOSING: { shot: "CLOSING", accent: 1.3, desk: false, podiums: false, dataRings: false, noris: true },
};

const YELLOW = 0xf5c518;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

export class VirtualStudio {
  readonly canvas: HTMLCanvasElement;
  readonly main: HTMLCanvasElement;   // LED wall content (16:9)
  readonly left: HTMLCanvasElement;   // side towers (portrait)
  readonly right: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private tex: { main: THREE.CanvasTexture; left: THREE.CanvasTexture; right: THREE.CanvasTexture };
  private props: { desk: THREE.Group; podiums: THREE.Group; rings: THREE.Group; noris: THREE.Group; accent: THREE.MeshBasicMaterial[]; accentLight: THREE.PointLight };
  private move: { from: CamPose; to: CamPose; start: number; dur: number } | null = null;
  private pose: CamPose;
  private dirty = true;
  private lastRender = 0;
  private disposables: { dispose(): void }[] = [];
  stage: StageId = "OPENING";
  readonly quality: Quality;

  constructor(quality: Quality = "MEDIUM") {
    this.quality = quality;
    const q = QUALITY[quality];
    this.canvas = document.createElement("canvas");
    this.canvas.width = q.w; this.canvas.height = q.h;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: q.antialias, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(q.w, q.h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = q.shadows;

    const mk = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    this.main = mk(quality === "LOW" ? 960 : 1280, quality === "LOW" ? 540 : 720);
    this.left = mk(432, 576);
    this.right = mk(432, 576);
    const ct = (c: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; this.disposables.push(t); return t; };
    this.tex = { main: ct(this.main), left: ct(this.left), right: ct(this.right) };

    this.pose = { ...SHOTS.WIDE, pos: [...SHOTS.WIDE.pos], look: [...SHOTS.WIDE.look] };
    this.camera = new THREE.PerspectiveCamera(this.pose.fov, 16 / 9, 0.1, 120);
    this.applyPose(this.pose);
    this.props = this.build(q);
    this.setStage("OPENING", false);
  }

  // ---------------------------------------------------------------- construction
  private mat<T extends THREE.Material>(m: T): T { this.disposables.push(m); return m; }
  private geo<T extends THREE.BufferGeometry>(g: T): T { this.disposables.push(g); return g; }

  private build(q: (typeof QUALITY)[Quality]) {
    const s = this.scene;
    s.background = new THREE.Color(0x07080a);
    s.fog = new THREE.Fog(0x07080a, 24, 60);

    const graphite = this.mat(new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.55, metalness: 0.35 }));
    const metal = this.mat(new THREE.MeshStandardMaterial({ color: 0x5d636d, roughness: 0.35, metalness: 0.8 }));
    const dark = this.mat(new THREE.MeshStandardMaterial({ color: 0x0d0e11, roughness: 0.8, metalness: 0.1 }));
    const yellow = this.mat(new THREE.MeshBasicMaterial({ color: YELLOW }));
    const accent: THREE.MeshBasicMaterial[] = [yellow];
    const box = this.geo(new THREE.BoxGeometry(1, 1, 1));
    const put = (m: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, parent: THREE.Object3D = s, ry = 0) => {
      const mesh = new THREE.Mesh(box, m); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.rotation.y = ry; parent.add(mesh); return mesh;
    };

    // floor: glossy graphite with an engraved grid (procedural canvas texture, no download)
    const gridC = document.createElement("canvas"); gridC.width = gridC.height = 512;
    const g = gridC.getContext("2d")!;
    g.fillStyle = "#1a1c21"; g.fillRect(0, 0, 512, 512);
    g.strokeStyle = "rgba(255,255,255,0.075)"; g.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
    const gridTex = new THREE.CanvasTexture(gridC); gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping; gridTex.repeat.set(14, 10); gridTex.colorSpace = THREE.SRGBColorSpace; gridTex.anisotropy = 8;
    this.disposables.push(gridTex);
    const floor = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(70, 50)), this.mat(new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.38, metalness: 0.4 })));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = q.shadows; s.add(floor);

    // LED wall: bezel + emissive screen + fake reflection on the floor
    const ledW = 13.6, ledH = 7.65, ledY = 4.7, ledZ = -8;
    put(metal, 0, ledY, ledZ - 0.25, ledW + 0.6, ledH + 0.6, 0.3);
    const led = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(ledW, ledH)), this.mat(new THREE.MeshBasicMaterial({ map: this.tex.main, toneMapped: false })));
    led.position.set(0, ledY, ledZ - 0.08); s.add(led);
    const refl = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(ledW, ledH)), this.mat(new THREE.MeshBasicMaterial({ map: this.tex.main, transparent: true, opacity: 0.11, toneMapped: false, depthWrite: false })));
    refl.rotation.x = -Math.PI / 2; refl.scale.y = -0.55; refl.position.set(0, 0.012, ledZ + 2.1); s.add(refl);
    put(yellow, 0, ledY - ledH / 2 - 0.42, ledZ - 0.05, ledW + 0.6, 0.06, 0.06);

    // side towers (portrait screens), angled toward the stage
    const tower = (side: -1 | 1, t: THREE.CanvasTexture) => {
      const grp = new THREE.Group();
      put(metal, 0, 0, -0.12, 4.5, 6.3, 0.22, grp);
      const scr = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(4.2, 5.6)), this.mat(new THREE.MeshBasicMaterial({ map: t, toneMapped: false })));
      scr.position.z = 0.01; grp.add(scr);
      put(yellow, 0, -3.35, 0, 4.5, 0.05, 0.05, grp);
      grp.position.set(side * 10.6, 4.1, -5.6); grp.rotation.y = -side * 0.52; s.add(grp);
    };
    tower(-1, this.tex.left); tower(1, this.tex.right);

    // architecture: back wall panels, pillars with light strips, ceiling truss
    for (let i = -6; i <= 6; i++) if (Math.abs(i) > 3) put(dark, i * 2.15, 6, -9.4, 2.05, 12, 0.3);
    put(dark, 0, 10.4, -9.4, 14, 3.4, 0.3);
    [-15, -12.4, 12.4, 15].forEach((x, i) => {
      put(graphite, x, 5, -3 - i % 2 * 3, 0.7, 10, 0.7);
      accent.push(this.mat(new THREE.MeshBasicMaterial({ color: YELLOW })));
      put(accent[accent.length - 1], x + (x < 0 ? 0.36 : -0.36), 5, -3 - i % 2 * 3, 0.04, 9.4, 0.12);
    });
    for (let z = -8; z <= 6; z += 3.5) put(metal, 0, 11.2, z, 34, 0.18, 0.18);
    put(metal, -8, 11.2, -1, 0.18, 0.18, 18); put(metal, 8, 11.2, -1, 0.18, 0.18, 18);

    // brand sign above the wall (procedural)
    const signC = document.createElement("canvas"); signC.width = 1024; signC.height = 160;
    const sg = signC.getContext("2d")!;
    sg.font = "900 120px Inter, Arial, sans-serif"; sg.textBaseline = "middle"; sg.textAlign = "right";
    sg.fillStyle = "#f4f5f7"; sg.fillText("NEXUS", 520, 84); sg.textAlign = "left"; sg.fillStyle = "#f5c518"; sg.fillText("SPORT", 548, 84);
    const signTex = new THREE.CanvasTexture(signC); signTex.colorSpace = THREE.SRGBColorSpace; this.disposables.push(signTex);
    const sign = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(6.4, 1)), this.mat(new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false })));
    sign.position.set(0, 9.55, -9.2); s.add(sign);

    // central stage: platform + luminous edge
    const stage = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(3.4, 3.6, 0.32, 56)), graphite);
    stage.position.set(0, 0.16, -1.5); stage.receiveShadow = q.shadows; s.add(stage);
    const edgeMat = this.mat(new THREE.MeshBasicMaterial({ color: YELLOW })); accent.push(edgeMat);
    const edge = new THREE.Mesh(this.geo(new THREE.TorusGeometry(3.52, 0.035, 8, 96)), edgeMat);
    edge.rotation.x = Math.PI / 2; edge.position.set(0, 0.33, -1.5); s.add(edge);

    // props per configuration (same set, different composition)
    const desk = new THREE.Group();
    put(graphite, 0, 0.95, 0, 5.2, 1.2, 1.1, desk); put(metal, 0, 1.58, 0, 5.5, 0.06, 1.3, desk);
    const deskStrip = this.mat(new THREE.MeshBasicMaterial({ color: YELLOW })); accent.push(deskStrip);
    put(deskStrip, 0, 0.95, 0.56, 4.6, 0.05, 0.02, desk);
    desk.position.set(0, 0.32, -0.6); s.add(desk);

    const podiums = new THREE.Group();
    [-2.2, 2.2].forEach((x) => { put(graphite, x, 0.9, 0, 0.9, 1.5, 0.7, podiums); const pm = this.mat(new THREE.MeshBasicMaterial({ color: YELLOW })); accent.push(pm); put(pm, x, 1.66, 0.36, 0.9, 0.04, 0.02, podiums); });
    podiums.position.set(0, 0.32, -0.8); s.add(podiums);

    const rings = new THREE.Group();
    [1.2, 2.0, 2.8].forEach((r, i) => {
      const rm = this.mat(new THREE.MeshBasicMaterial({ color: YELLOW, transparent: true, opacity: 0.5 - i * 0.12 })); accent.push(rm);
      const ring = new THREE.Mesh(this.geo(new THREE.RingGeometry(r, r + 0.03, 72)), rm); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.34 + i * 0.002; rings.add(ring);
    });
    rings.position.set(0, 0, -1.5); s.add(rings);

    // Noris: reserved hologram frame (contract only: no 3D character in this phase)
    const noris = new THREE.Group();
    put(metal, 0, 0.12, 0, 1.4, 0.24, 1.4, noris);
    const holo = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(1.6, 2.6)), this.mat(new THREE.MeshBasicMaterial({ color: 0xf5c518, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false })));
    holo.position.y = 1.6; noris.add(holo);
    noris.position.set(-5.2, 0, -2.6); s.add(noris);

    // light: ambient + hemisphere + key spots + yellow accent near the stage
    s.add(new THREE.AmbientLight(0xffffff, 0.5));
    s.add(new THREE.HemisphereLight(0xdfe6ff, 0x0b0b0b, 0.35));
    [-7, 7].forEach((x) => {
      const spot = new THREE.SpotLight(0xfff3dd, 60, 40, Math.PI / 6, 0.5, 1.4);
      spot.position.set(x, 11, 6); spot.target.position.set(0, 0, -2); s.add(spot); s.add(spot.target);
      spot.castShadow = q.shadows; if (q.shadows) spot.shadow.mapSize.set(1024, 1024);
    });
    const accentLight = new THREE.PointLight(YELLOW, 6, 12, 1.8); accentLight.position.set(0, 3.2, -4.2); s.add(accentLight); // behind the stage: rim light, no hotspot near the lens
    if (q.cones) {
      const coneMat = this.mat(new THREE.MeshBasicMaterial({ color: 0xfff1cc, transparent: true, opacity: 0.018, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      const coneGeo = this.geo(new THREE.ConeGeometry(1.9, 10.8, 32, 1, true));
      [-7, -2.5, 2.5, 7].forEach((x) => { const cone = new THREE.Mesh(coneGeo, coneMat); cone.position.set(x, 5.6, -3.2); s.add(cone); });
    }
    return { desk, podiums, rings, noris, accent, accentLight };
  }

  // ---------------------------------------------------------------- control
  private applyPose(p: CamPose) {
    this.camera.position.set(...p.pos);
    this.camera.fov = p.fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(...p.look);
  }

  /** Changes the composition of the set; the camera travels to the configuration's shot unless told otherwise. */
  setStage(stage: StageId, animate = true, shot?: Shot) {
    this.stage = stage;
    const cfg = STAGES[stage];
    this.props.desk.visible = cfg.desk;
    this.props.podiums.visible = cfg.podiums;
    this.props.rings.visible = cfg.dataRings;
    this.props.noris.visible = cfg.noris;
    this.props.accentLight.intensity = 4 * cfg.accent;
    this.props.accent.forEach((m) => m.color.setHex(YELLOW).multiplyScalar(Math.min(1, 0.55 + cfg.accent * 0.35)));
    this.setShot(shot ?? cfg.shot, animate ? 1800 : 0);
    this.dirty = true;
  }

  /** Smooth, purposeful camera move (no constant motion). CRITICAL beats move slower. */
  setShot(shot: Shot, durationMs = 1600) {
    const to = SHOTS[shot];
    if (durationMs <= 0) { this.move = null; this.pose = { pos: [...to.pos], look: [...to.look], fov: to.fov }; this.applyPose(this.pose); this.dirty = true; return; }
    this.move = { from: { pos: [...this.pose.pos], look: [...this.pose.look], fov: this.pose.fov }, to, start: performance.now(), dur: durationMs };
  }

  /** Screens were redrawn by the caller: upload them on the next frame. */
  touch(which: "main" | "left" | "right" | "all" = "all") {
    if (which === "all" || which === "main") this.tex.main.needsUpdate = true;
    if (which === "all" || which === "left") this.tex.left.needsUpdate = true;
    if (which === "all" || which === "right") this.tex.right.needsUpdate = true;
    this.dirty = true;
  }

  get moving() { return this.move !== null; }

  /** Renders only if something changed. Returns true when a new frame was drawn. */
  tick(now = performance.now()): boolean {
    if (this.move) {
      const t = Math.min(1, (now - this.move.start) / this.move.dur), k = ease(t);
      const lerp = (a: number[], b: number[]) => a.map((v, i) => v + (b[i] - v) * k) as [number, number, number];
      this.pose = { pos: lerp(this.move.from.pos, this.move.to.pos), look: lerp(this.move.from.look, this.move.to.look), fov: this.move.from.fov + (this.move.to.fov - this.move.from.fov) * k };
      this.applyPose(this.pose);
      if (t >= 1) this.move = null;
      this.dirty = true;
    }
    if (!this.dirty) return false;
    if (now - this.lastRender < 1000 / QUALITY[this.quality].maxFps - 1) return false;
    this.renderer.render(this.scene, this.camera);
    this.lastRender = now;
    this.dirty = this.move !== null;
    return true;
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.disposables = [];
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

/** 2D fallback without WebGL: the same identity and screens, flat but professional. */
export function drawFallback(ctx: CanvasRenderingContext2D, main: HTMLCanvasElement, left: HTMLCanvasElement, right: HTMLCanvasElement) {
  const g = ctx.createLinearGradient(0, 0, 0, 1080);
  g.addColorStop(0, "#0b0c0f"); g.addColorStop(0.62, "#111318"); g.addColorStop(1, "#060607");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
  // floor perspective lines
  ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 2;
  for (let i = -10; i <= 10; i++) { ctx.beginPath(); ctx.moveTo(960 + i * 40, 760); ctx.lineTo(960 + i * 260, 1080); ctx.stroke(); }
  for (let y = 780; y < 1080; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1920, y); ctx.stroke(); }
  ctx.fillStyle = "#3b3f47"; ctx.fillRect(370, 118, 1180, 664);
  ctx.drawImage(main, 380, 128, 1160, 652);
  ctx.fillStyle = "#f5c518"; ctx.fillRect(370, 800, 1180, 5);
  ctx.globalAlpha = 0.95;
  ctx.drawImage(left, 60, 210, 270, 360); ctx.drawImage(right, 1590, 210, 270, 360);
  ctx.globalAlpha = 1;
}
