// NEXUS SPORT Virtual Studio — ONE soft, minimalist 3D set (Three.js, already a dependency).
// Rounded shapes, an infinite cyclorama, floating screens with soft halos and light that the
// operator controls live (presets, colour, key / ambient / rim, glow, floor gloss, haze).
// The configurations OPENING … CLOSING share the same architecture; only the camera, the props
// on stage and the accent change.
//
// Built for the real broadcasting PC (integrated Intel GPU):
// - simple procedural geometry and canvas-generated gradients, nothing downloaded;
// - most of the "light" is baked into gradient textures (cyclorama washes, floor pools, halos),
//   so it costs almost nothing; only a handful of real lights;
// - renders ON DEMAND (static scene = 0 fps) unless the subtle camera drift is on;
// - quality profiles LOW / MEDIUM / HIGH; preserveDrawingBuffer for the compositor;
// - dispose() releases every GPU resource.
// Without WebGL the caller uses the 2D fallback (drawFallback).

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { Quality, Shot, StageId } from "./types";

export const QUALITY: Record<Quality, { w: number; h: number; antialias: boolean; shadows: boolean; maxFps: number }> = {
  LOW: { w: 960, h: 540, antialias: false, shadows: false, maxFps: 24 },
  MEDIUM: { w: 1280, h: 720, antialias: true, shadows: false, maxFps: 30 },
  HIGH: { w: 1920, h: 1080, antialias: true, shadows: true, maxFps: 30 },
};

interface CamPose { pos: [number, number, number]; look: [number, number, number]; fov: number }
export const SHOTS: Record<Shot, CamPose> = {
  WIDE: { pos: [0, 4.6, 17], look: [0, 3.9, -6], fov: 46 },
  HERO: { pos: [0, 3.4, 10.5], look: [0, 3.6, -8], fov: 42 },
  SCREEN: { pos: [0, 4.6, 3.4], look: [0, 4.6, -8], fov: 46 },
  DATA: { pos: [-3.4, 4.3, 5.6], look: [0.9, 4.3, -8], fov: 46 },
  SPLIT: { pos: [0, 4.6, 7.8], look: [0, 4.3, -8], fov: 58 },
  DEBATE: { pos: [6.2, 3.2, 9.4], look: [-1, 2.2, -2.5], fov: 44 },
  CLOSING: { pos: [0, 7.4, 21], look: [0, 3.4, -6], fov: 44 },
};

/** What each configuration of the single set changes. */
export const STAGES: Record<StageId, { shot: Shot; accent: number; desk: boolean; podiums: boolean; dataRings: boolean; noris: boolean }> = {
  OPENING: { shot: "WIDE", accent: 1.25, desk: false, podiums: false, dataRings: false, noris: true },
  NEWSROOM: { shot: "HERO", accent: 0.9, desk: true, podiums: false, dataRings: false, noris: false },
  MATCH_CENTER: { shot: "SCREEN", accent: 1.05, desk: false, podiums: false, dataRings: false, noris: false },
  ANALYSIS: { shot: "DATA", accent: 0.85, desk: true, podiums: false, dataRings: true, noris: false },
  STATS: { shot: "DATA", accent: 1.0, desk: false, podiums: false, dataRings: true, noris: false },
  DEBATE: { shot: "DEBATE", accent: 1.0, desk: false, podiums: true, dataRings: false, noris: true },
  UPCOMING: { shot: "SPLIT", accent: 1.0, desk: false, podiums: false, dataRings: false, noris: false },
  CLOSING: { shot: "CLOSING", accent: 1.2, desk: false, podiums: false, dataRings: false, noris: true },
};

// ---------------------------------------------------------------- lighting (operator controlled)
export interface Lighting {
  preset: string;
  accent: string;        // colour of light strips, halos, rim
  backdropTop: string;   // cyclorama gradient
  backdropBottom: string;
  floor: string;
  exposure: number;      // 0.6 – 1.6
  ambient: number;       // 0 – 1.6  soft fill from everywhere
  key: number;           // 0 – 2    main front light
  rim: number;           // 0 – 2    back / contour light
  glow: number;          // 0 – 1.5  strips, halos, washes
  gloss: number;         // 0 – 1    floor shine and reflection
  haze: number;          // 0 – 1    depth haze
  drift: boolean;        // very slow camera breathing
}

export const LIGHT_PRESETS: Record<string, Omit<Lighting, "preset" | "drift">> = {
  "Nexus noche": { accent: "#f5c518", backdropTop: "#08090c", backdropBottom: "#1c1f26", floor: "#15171c", exposure: 1, ambient: 0.7, key: 1, rim: 1, glow: 0.85, gloss: 0.6, haze: 0.35 },
  "Estudio claro": { accent: "#f5c518", backdropTop: "#b9bec7", backdropBottom: "#eceef2", floor: "#d6d9de", exposure: 0.95, ambient: 1.25, key: 0.8, rim: 0.4, glow: 0.35, gloss: 0.35, haze: 0.2 },
  "Grafito suave": { accent: "#e9e4d4", backdropTop: "#1d2026", backdropBottom: "#3a3e47", floor: "#2a2d33", exposure: 1, ambient: 0.95, key: 0.9, rim: 0.7, glow: 0.5, gloss: 0.45, haze: 0.3 },
  "Atardecer": { accent: "#ff9d42", backdropTop: "#140b08", backdropBottom: "#3b2418", floor: "#20160f", exposure: 1.05, ambient: 0.7, key: 0.95, rim: 1.1, glow: 0.9, gloss: 0.55, haze: 0.4 },
  "Hielo": { accent: "#56c8ff", backdropTop: "#060a12", backdropBottom: "#15223a", floor: "#0f1622", exposure: 1, ambient: 0.75, key: 1, rim: 1.1, glow: 0.9, gloss: 0.65, haze: 0.35 },
  "Champions": { accent: "#9db8ff", backdropTop: "#040822", backdropBottom: "#101c52", floor: "#0b112e", exposure: 1, ambient: 0.75, key: 1, rim: 1.2, glow: 1, gloss: 0.65, haze: 0.4 },
  "Césped": { accent: "#45e08a", backdropTop: "#050f09", backdropBottom: "#123222", floor: "#0c1a12", exposure: 1, ambient: 0.75, key: 1, rim: 1, glow: 0.85, gloss: 0.55, haze: 0.35 },
};
export const DEFAULT_LIGHTING: Lighting = { preset: "Nexus noche", ...LIGHT_PRESETS["Nexus noche"], drift: true };

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rgba = (hex: string, a: number) => { const c = new THREE.Color(hex); return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`; };

export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

/** Rounded rectangle plane with 0..1 UVs (for screens and halos). */
function roundedPlane(w: number, h: number, r: number): THREE.ShapeGeometry {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(s, 10);
  const pos = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) - x) / w, (pos.getY(i) - y) / h);
  uv.needsUpdate = true;
  return g;
}

export class VirtualStudio {
  readonly canvas: HTMLCanvasElement;
  readonly main: HTMLCanvasElement;   // LED wall content (16:9)
  readonly left: HTMLCanvasElement;   // side screens (portrait)
  readonly right: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private tex: { main: THREE.CanvasTexture; left: THREE.CanvasTexture; right: THREE.CanvasTexture };
  private props!: {
    desk: THREE.Group; podiums: THREE.Group; rings: THREE.Group; noris: THREE.Group;
    strips: THREE.MeshBasicMaterial[]; soft: THREE.MeshBasicMaterial[]; halos: THREE.MeshBasicMaterial[]; pools: THREE.MeshBasicMaterial[];
    cyc: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture };
    floor: THREE.MeshStandardMaterial; satin: THREE.MeshStandardMaterial; reflection: THREE.MeshBasicMaterial;
    hemi: THREE.HemisphereLight; key: THREE.DirectionalLight; fill: THREE.DirectionalLight; rims: THREE.SpotLight[]; accentLight: THREE.PointLight;
    fog: THREE.Fog;
  };
  private move: { from: CamPose; to: CamPose; start: number; dur: number } | null = null;
  private pose: CamPose;
  private dirty = true;
  private lastRender = 0;
  private disposables: { dispose(): void }[] = [];
  private light: Lighting;
  stage: StageId = "OPENING";
  readonly quality: Quality;

  constructor(quality: Quality = "MEDIUM", lighting: Lighting = DEFAULT_LIGHTING) {
    this.quality = quality;
    this.light = { ...lighting };
    const q = QUALITY[quality];
    this.canvas = document.createElement("canvas");
    this.canvas.width = q.w; this.canvas.height = q.h;
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: q.antialias, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(q.w, q.h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = q.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const mk = (w: number, h: number) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
    this.main = mk(quality === "LOW" ? 960 : 1280, quality === "LOW" ? 540 : 720);
    this.left = mk(432, 576);
    this.right = mk(432, 576);
    const ct = (c: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; this.disposables.push(t); return t; };
    this.tex = { main: ct(this.main), left: ct(this.left), right: ct(this.right) };

    this.pose = { ...SHOTS.WIDE, pos: [...SHOTS.WIDE.pos], look: [...SHOTS.WIDE.look] };
    this.camera = new THREE.PerspectiveCamera(this.pose.fov, 16 / 9, 0.1, 140);
    this.applyPose(this.pose);
    this.build(q);
    this.setLighting(this.light);
    this.setStage("OPENING", false);
  }

  // ---------------------------------------------------------------- construction
  private mat<T extends THREE.Material>(m: T): T { this.disposables.push(m); return m; }
  private geo<T extends THREE.BufferGeometry>(g: T): T { this.disposables.push(g); return g; }
  private canvasTex(w: number, h: number, paint: (g: CanvasRenderingContext2D) => void, srgb = true) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    paint(c.getContext("2d")!);
    const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; this.disposables.push(t);
    return t;
  }
  /** Soft round blob (white → transparent), tinted by the material colour. */
  private blob(soft = 0.0) {
    return this.canvasTex(256, 256, (g) => {
      const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(soft || 0.25, "rgba(255,255,255,0.55)"); r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r; g.fillRect(0, 0, 256, 256);
    });
  }
  /** Soft rounded-rectangle glow (for halos behind screens). */
  private haloTex() {
    return this.canvasTex(512, 320, (g) => {
      g.filter = "blur(26px)"; g.fillStyle = "#fff";
      g.beginPath(); g.roundRect(70, 70, 372, 180, 40); g.fill();
    });
  }

  private build(q: (typeof QUALITY)[Quality]) {
    const s = this.scene;
    const fog = new THREE.Fog(0x000000, 30, 80);
    s.fog = fog;

    // satin materials (soft, low metalness: elegant instead of shiny chrome)
    const satin = this.mat(new THREE.MeshStandardMaterial({ color: 0x2b2e35, roughness: 0.42, metalness: 0.15 }));
    const pearl = this.mat(new THREE.MeshStandardMaterial({ color: 0xe9eaee, roughness: 0.35, metalness: 0.05 }));
    const bezel = this.mat(new THREE.MeshStandardMaterial({ color: 0x0f1013, roughness: 0.3, metalness: 0.25 }));
    const strips: THREE.MeshBasicMaterial[] = [];
    const soft: THREE.MeshBasicMaterial[] = [];
    const softMat = () => { const m = this.mat(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); soft.push(m); return m; };
    const halos: THREE.MeshBasicMaterial[] = [];
    const pools: THREE.MeshBasicMaterial[] = [];
    const stripMat = () => { const m = this.mat(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); strips.push(m); return m; };
    const blobTex = this.blob();
    const halo = this.haloTex();
    const shadowTex = this.canvasTex(256, 256, (g) => { const r = g.createRadialGradient(128, 128, 10, 128, 128, 128); r.addColorStop(0, "rgba(0,0,0,0.55)"); r.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r; g.fillRect(0, 0, 256, 256); });
    const shadowMat = this.mat(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    const contact = (x: number, z: number, w: number, d: number, parent: THREE.Object3D = s) => {
      const m = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(w, d)), shadowMat); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.015, z); parent.add(m); return m;
    };

    // cyclorama: one seamless curved wall that melts into the floor (gradient + light washes baked in)
    const cycCanvas = document.createElement("canvas"); cycCanvas.width = 1024; cycCanvas.height = 512;
    const cycTex = new THREE.CanvasTexture(cycCanvas); cycTex.colorSpace = THREE.SRGBColorSpace; this.disposables.push(cycTex);
    const cyc = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(26, 26, 22, 96, 1, true, Math.PI * 0.5 - 0.25, Math.PI + 0.5)),
      this.mat(new THREE.MeshBasicMaterial({ map: cycTex, side: THREE.BackSide, fog: true })));
    cyc.position.set(0, 11, 4); s.add(cyc);

    // floor: smooth satin, a soft pool of light under the stage, no grid
    const floorMat = this.mat(new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.4, metalness: 0.1 }));
    const floor = new THREE.Mesh(this.geo(new THREE.CircleGeometry(40, 96)), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = q.shadows; s.add(floor);
    const pool = this.mat(new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); pools.push(pool);
    const poolMesh = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(18, 12)), pool); poolMesh.rotation.x = -Math.PI / 2; poolMesh.position.set(0, 0.01, -2); s.add(poolMesh);

    // LED wall: rounded, floating, thin satin bezel, soft halo and a fading floor reflection
    const ledW = 13.2, ledH = 7.42, ledY = 4.75, ledZ = -8;
    const frame = new THREE.Mesh(this.geo(new RoundedBoxGeometry(ledW + 0.5, ledH + 0.5, 0.28, 5, 0.25)), bezel);
    frame.position.set(0, ledY, ledZ - 0.2); frame.castShadow = q.shadows; s.add(frame);
    const led = new THREE.Mesh(this.geo(roundedPlane(ledW, ledH, 0.22)), this.mat(new THREE.MeshBasicMaterial({ map: this.tex.main, toneMapped: false })));
    led.position.set(0, ledY, ledZ - 0.05); s.add(led);
    const ledHalo = this.mat(new THREE.MeshBasicMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); halos.push(ledHalo);
    const ledHaloMesh = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(ledW * 1.45, ledH * 1.75)), ledHalo); ledHaloMesh.position.set(0, ledY, ledZ - 0.5); s.add(ledHaloMesh);
    const fadeTex = this.canvasTex(8, 256, (g) => { const l = g.createLinearGradient(0, 0, 0, 256); l.addColorStop(0, "#000"); l.addColorStop(1, "#fff"); g.fillStyle = l; g.fillRect(0, 0, 8, 256); }, false);
    const reflection = this.mat(new THREE.MeshBasicMaterial({ map: this.tex.main, alphaMap: fadeTex, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false }));
    const refl = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(ledW, ledH * 0.6)), reflection);
    refl.rotation.x = -Math.PI / 2; refl.rotation.z = Math.PI; refl.scale.x = -1; refl.position.set(0, 0.012, ledZ + ledH * 0.3 + 0.2); s.add(refl);
    // thin light line under the wall
    const under = new THREE.Mesh(this.geo(new RoundedBoxGeometry(ledW - 1, 0.04, 0.04, 2, 0.02)), softMat());
    under.position.set(0, ledY - ledH / 2 - 0.55, ledZ); s.add(under);

    // side screens: floating rounded portraits, angled toward the stage
    const side = (dir: -1 | 1, t: THREE.CanvasTexture) => {
      const grp = new THREE.Group();
      const f = new THREE.Mesh(this.geo(new RoundedBoxGeometry(4.1, 5.35, 0.22, 5, 0.22)), bezel); f.position.z = -0.14; f.castShadow = q.shadows; grp.add(f);
      grp.add(new THREE.Mesh(this.geo(roundedPlane(3.8, 5.05, 0.18)), this.mat(new THREE.MeshBasicMaterial({ map: t, toneMapped: false }))));
      const h = this.mat(new THREE.MeshBasicMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); halos.push(h);
      const hm = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(7, 7.5)), h); hm.position.z = -0.4; grp.add(hm);
      grp.position.set(dir * 10.4, 4.3, -5.4); grp.rotation.y = -dir * 0.5; s.add(grp);
    };
    side(-1, this.tex.left); side(1, this.tex.right);

    // vertical light slats on the cyclorama: rounded capsules, soft glow (the "architecture")
    const slatGeo = this.geo(new RoundedBoxGeometry(0.2, 8, 0.2, 4, 0.1));
    [-16.5, -14.4, 14.4, 16.5].forEach((x, i) => {
      const m = new THREE.Mesh(slatGeo, softMat()); m.position.set(x, 5.2, -9 + (i % 3 === 0 ? 2.2 : 0)); s.add(m);
      const h = this.mat(new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0.5 })); halos.push(h);
      const hm = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(3.2, 11)), h); hm.position.set(x, 5.2, m.position.z - 0.3); s.add(hm);
    });

    // brand sign: clean type on the cyclorama
    const signTex = this.canvasTex(1024, 160, (g) => {
      g.font = "800 112px Inter, Arial, sans-serif"; g.textBaseline = "middle";
      g.textAlign = "right"; g.fillStyle = "#f4f5f7"; g.fillText("NEXUS", 512, 84);
      g.textAlign = "left"; g.fillStyle = "#f5c518"; g.fillText("SPORT", 540, 84);
    });
    const sign = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(5.2, 0.81)), this.mat(new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false })));
    sign.position.set(0, 9.6, -8.6); s.add(sign);


    // central stage: a low rounded disc (lathe profile) that seems to float on a ring of light
    const prof: THREE.Vector2[] = [new THREE.Vector2(0, 0.34)];
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI / 2; prof.push(new THREE.Vector2(3.35 + Math.sin(a) * 0.17, 0.17 + Math.cos(a) * 0.17)); }
    prof.push(new THREE.Vector2(3.3, 0.04), new THREE.Vector2(0, 0.04));
    const disc = new THREE.Mesh(this.geo(new THREE.LatheGeometry(prof, 96)), satin);
    disc.position.set(0, 0, -1.5); disc.receiveShadow = q.shadows; disc.castShadow = q.shadows; s.add(disc);
    const lip = new THREE.Mesh(this.geo(new THREE.TorusGeometry(3.3, 0.018, 8, 160)), softMat());
    lip.rotation.x = Math.PI / 2; lip.position.set(0, 0.06, -1.5); s.add(lip);
    const lipGlow = this.mat(new THREE.MeshBasicMaterial({ map: this.canvasTex(256, 256, (g) => { const r = g.createRadialGradient(128, 128, 88, 128, 128, 128); r.addColorStop(0, "rgba(255,255,255,0)"); r.addColorStop(0.12, "rgba(255,255,255,0.8)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 256, 256); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); pools.push(lipGlow);
    const lipGlowMesh = new THREE.Mesh(this.geo(new THREE.PlaneGeometry(10.2, 10.2)), lipGlow); lipGlowMesh.rotation.x = -Math.PI / 2; lipGlowMesh.position.set(0, 0.02, -1.5); s.add(lipGlowMesh);

    // props per configuration
    const desk = new THREE.Group();
    const deskBody = new THREE.Mesh(this.geo(new RoundedBoxGeometry(5.2, 1.15, 1.25, 6, 0.5)), pearl); deskBody.position.y = 0.575; deskBody.castShadow = q.shadows; desk.add(deskBody);
    const deskTop = new THREE.Mesh(this.geo(new RoundedBoxGeometry(5.6, 0.1, 1.5, 4, 0.05)), satin); deskTop.position.y = 1.2; desk.add(deskTop);
    const deskLine = new THREE.Mesh(this.geo(new RoundedBoxGeometry(4.2, 0.05, 0.05, 2, 0.025)), stripMat()); deskLine.position.set(0, 0.42, 0.63); desk.add(deskLine);
    contact(0, 0.1, 6.5, 2.6, desk);
    desk.position.set(0, 0.34, -0.6); s.add(desk);

    const podiums = new THREE.Group();
    [-2.3, 2.3].forEach((x) => {
      const p = new THREE.Mesh(this.geo(new RoundedBoxGeometry(0.95, 1.45, 0.75, 5, 0.3)), pearl); p.position.set(x, 0.725, 0); p.castShadow = q.shadows; podiums.add(p);
      const l = new THREE.Mesh(this.geo(new RoundedBoxGeometry(0.7, 0.04, 0.04, 2, 0.02)), stripMat()); l.position.set(x, 1.25, 0.39); podiums.add(l);
      contact(x, 0, 1.8, 1.5, podiums);
    });
    podiums.position.set(0, 0.34, -0.8); s.add(podiums);

    const rings = new THREE.Group();
    [1.4, 2.15, 2.9].forEach((r, i) => {
      const rm = this.mat(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 - i * 0.14, toneMapped: false })); strips.push(rm);
      const t = new THREE.Mesh(this.geo(new THREE.TorusGeometry(r, 0.018, 6, 120)), rm); t.rotation.x = Math.PI / 2; t.position.y = 0.6 + i * 0.5; rings.add(t);
    });
    rings.position.set(0, 0, -1.5); s.add(rings);

    // Noris: reserved hologram space (contract only, no 3D character in this phase)
    const noris = new THREE.Group();
    const ped = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.7, 0.8, 0.22, 48)), satin); ped.position.y = 0.11; noris.add(ped);
    const pedLine = new THREE.Mesh(this.geo(new THREE.TorusGeometry(0.72, 0.012, 6, 64)), softMat()); pedLine.rotation.x = Math.PI / 2; pedLine.position.y = 0.22; noris.add(pedLine);
    const holoTex = this.canvasTex(8, 256, (g) => { const l = g.createLinearGradient(0, 0, 0, 256); l.addColorStop(0, "rgba(255,255,255,0)"); l.addColorStop(1, "rgba(255,255,255,0.5)"); g.fillStyle = l; g.fillRect(0, 0, 8, 256); });
    const holo = this.mat(new THREE.MeshBasicMaterial({ map: holoTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false })); halos.push(holo);
    const holoMesh = new THREE.Mesh(this.geo(new THREE.CylinderGeometry(0.62, 0.68, 2.6, 48, 1, true)), holo); holoMesh.position.y = 1.52; noris.add(holoMesh);
    noris.position.set(-5.4, 0, -2.4); s.add(noris);

    // real lights: few and soft
    const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.8); s.add(hemi);
    const key = new THREE.DirectionalLight(0xfff6ea, 1.4); key.position.set(4, 12, 14); key.target.position.set(0, 1, -2); s.add(key); s.add(key.target);
    key.castShadow = q.shadows;
    if (q.shadows) { key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6; Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 }); key.shadow.bias = -0.0005; }
    const fill = new THREE.DirectionalLight(0xe6eeff, 0.5); fill.position.set(-8, 6, 10); s.add(fill);
    const rims = [-1, 1].map((d) => {
      const sp = new THREE.SpotLight(0xffffff, 40, 30, Math.PI / 5, 0.9, 1.6); sp.position.set(d * 6, 9, -7); sp.target.position.set(0, 0.5, -1); s.add(sp); s.add(sp.target); return sp;
    });
    const accentLight = new THREE.PointLight(0xffffff, 5, 14, 1.8); accentLight.position.set(0, 2.6, -4.4); s.add(accentLight);

    this.props = {
      desk, podiums, rings, noris, strips, soft, halos, pools,
      cyc: { canvas: cycCanvas, tex: cycTex },
      floor: floorMat, satin, reflection, hemi, key, fill, rims, accentLight, fog,
    };
  }

  private paintCyclorama() {
    const L = this.light, c = this.props.cyc.canvas, g = c.getContext("2d")!;
    const W = c.width, H = c.height;
    const v = g.createLinearGradient(0, 0, 0, H);
    v.addColorStop(0, L.backdropTop); v.addColorStop(0.72, L.backdropBottom); v.addColorStop(1, L.backdropBottom);
    g.fillStyle = v; g.fillRect(0, 0, W, H);
    // soft light washes (accent) behind the set: two side fans and a centre glow above the LED
    const wash = (x: number, y: number, rx: number, ry: number, a: number) => {
      g.save(); g.translate(x, y); g.scale(rx / ry, 1);
      const r = g.createRadialGradient(0, 0, 0, 0, 0, ry); r.addColorStop(0, rgba(L.accent, a)); r.addColorStop(1, rgba(L.accent, 0));
      g.fillStyle = r; g.beginPath(); g.arc(0, 0, ry, 0, Math.PI * 2); g.fill(); g.restore();
    };
    const k = Math.min(1.5, L.glow);
    wash(W * 0.5, H * 0.62, W * 0.34, H * 0.42, 0.22 * k);
    wash(W * 0.2, H * 0.55, W * 0.14, H * 0.5, 0.14 * k);
    wash(W * 0.8, H * 0.55, W * 0.14, H * 0.5, 0.14 * k);
    this.props.cyc.tex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- control
  getLighting(): Lighting { return { ...this.light }; }

  /** Applies operator lighting live (cheap: colours, intensities and one gradient repaint). */
  setLighting(patch: Partial<Lighting>) {
    this.light = { ...this.light, ...patch };
    const L = this.light, P = this.props, accent = new THREE.Color(L.accent);
    const stageK = STAGES[this.stage]?.accent ?? 1;
    this.renderer.toneMappingExposure = L.exposure;
    P.fog.color.set(L.backdropBottom);
    P.fog.near = 14 + (1 - L.haze) * 16; P.fog.far = P.fog.near + 26 + (1 - L.haze) * 24;
    P.floor.color.set(L.floor);
    P.satin.color.set(L.floor).lerp(new THREE.Color("#1e2026"), 0.55);
    P.floor.emissive.set(L.backdropBottom).multiplyScalar(0.35);
    P.floor.roughness = 0.75 - L.gloss * 0.5;
    P.reflection.opacity = 0.02 + L.gloss * 0.09;
    P.hemi.intensity = L.ambient;
    P.hemi.color.set("#ffffff"); P.hemi.groundColor.set(L.floor);
    P.key.intensity = 1.5 * L.key;
    P.fill.intensity = 0.55 * L.key;
    P.rims.forEach((r) => { r.intensity = 45 * L.rim; r.color.copy(accent).lerp(new THREE.Color("#ffffff"), 0.55); });
    P.accentLight.color.copy(accent); P.accentLight.intensity = 5 * L.glow * stageK;
    const glow = Math.min(1.5, L.glow * stageK);
    P.strips.forEach((m) => { m.color.copy(accent).multiplyScalar(0.35 + glow * 0.5); });
    const pale = accent.clone().lerp(new THREE.Color("#ffffff"), 0.45);
    P.soft.forEach((m) => { m.color.copy(pale).multiplyScalar(0.2 + glow * 0.4); });
    P.halos.forEach((m) => { m.color.copy(accent).multiplyScalar(0.18 * glow); });
    P.pools.forEach((m) => { m.color.copy(accent).multiplyScalar(0.12 * glow); });
    this.paintCyclorama();
    this.dirty = true;
  }

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
    this.setLighting({});
    this.setShot(shot ?? cfg.shot, animate ? 2200 : 0);
    this.dirty = true;
  }

  /** Smooth, purposeful camera move. CRITICAL beats move slower. */
  setShot(shot: Shot, durationMs = 2000) {
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

  /** Renders only if something changed (or the drift is on). Returns true when a new frame was drawn. */
  tick(now = performance.now()): boolean {
    if (this.move) {
      const t = Math.min(1, (now - this.move.start) / this.move.dur), k = ease(t);
      const lerp = (a: number[], b: number[]) => a.map((v, i) => v + (b[i] - v) * k) as [number, number, number];
      this.pose = { pos: lerp(this.move.from.pos, this.move.to.pos), look: lerp(this.move.from.look, this.move.to.look), fov: this.move.from.fov + (this.move.to.fov - this.move.from.fov) * k };
      if (t >= 1) this.move = null;
      this.dirty = true;
    }
    const drift = this.light.drift;
    if (!this.dirty && !drift) return false;
    const maxFps = drift && !this.move ? Math.min(24, QUALITY[this.quality].maxFps) : QUALITY[this.quality].maxFps;
    if (now - this.lastRender < 1000 / maxFps - 1) return false;
    if (drift) {
      // very slow breathing: a few centimetres, periods of ~20–30 s (never distracting)
      const s = now / 1000;
      const p = this.pose;
      this.camera.position.set(p.pos[0] + Math.sin(s * 0.26) * 0.28, p.pos[1] + Math.sin(s * 0.19) * 0.08, p.pos[2] + Math.sin(s * 0.21) * 0.18);
      this.camera.fov = p.fov; this.camera.updateProjectionMatrix();
      this.camera.lookAt(...p.look);
      this.props.rings.rotation.y = s * 0.05;
    } else this.applyPose(this.pose);
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

/** 2D fallback without WebGL: the same identity and screens, soft and flat. */
export function drawFallback(ctx: CanvasRenderingContext2D, main: HTMLCanvasElement, left: HTMLCanvasElement, right: HTMLCanvasElement, light: Lighting = DEFAULT_LIGHTING) {
  const g = ctx.createLinearGradient(0, 0, 0, 1080);
  g.addColorStop(0, light.backdropTop); g.addColorStop(0.7, light.backdropBottom); g.addColorStop(1, light.floor);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
  const r = ctx.createRadialGradient(960, 520, 0, 960, 520, 900);
  r.addColorStop(0, rgba(light.accent, 0.16 * light.glow)); r.addColorStop(1, rgba(light.accent, 0));
  ctx.fillStyle = r; ctx.fillRect(0, 0, 1920, 1080);
  const rr = (x: number, y: number, w: number, h: number, rad: number, img: HTMLCanvasElement) => {
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, rad); ctx.clip(); ctx.drawImage(img, x, y, w, h); ctx.restore();
  };
  ctx.fillStyle = "#0f1013"; ctx.beginPath(); ctx.roundRect(372, 120, 1176, 662, 26); ctx.fill();
  rr(384, 132, 1152, 638, 18, main);
  ctx.fillStyle = light.accent; ctx.beginPath(); ctx.roundRect(470, 812, 980, 5, 3); ctx.fill();
  rr(64, 214, 266, 354, 16, left); rr(1590, 214, 266, 354, 16, right);
}
