// Turns a capsule's 9:16 slide images (rendered by /og/capsule, same origin so
// the canvas is never tainted) into a vertical slideshow video, entirely in the
// browser: canvas + MediaRecorder, crossfade + slow zoom (Ken Burns).
// MP4 (H.264) when the browser can record it (Chrome 126+, Safari), else WebM —
// TikTok accepts both.

import type { CapsuleSlide, CapsuleKind } from "./capsulePrompt";

export interface CapsuleRender {
  kind: CapsuleKind;
  title: string;
  subject: string;
  year: number | null;
  day: string;
  slides: CapsuleSlide[];
}

export function slideImageUrl(c: CapsuleRender, index: number, version = ""): string {
  const slide = c.slides[index];
  const params = new URLSearchParams({ kind: c.kind, title: c.title, i: String(index), n: String(c.slides.length) });
  if (c.subject) params.set("subject", c.subject);
  if (c.year) params.set("year", String(c.year));
  if (c.day) params.set("day", c.day);
  if (slide?.text && (index > 0 || slide.text !== c.title)) params.set("text", slide.text);
  if (slide?.image) params.set("image", slide.image);
  if (version) params.set("v", version);
  return `/og/capsule?${params.toString()}`;
}

/** Seconds a slide stays on screen: enough to read it (≈ 15 chars/s), 3–7 s. */
export function slideSeconds(text: string): number {
  return Math.min(7, Math.max(3, Math.round((text.length / 15 + 1.2) * 10) / 10));
}

function pickMime(): { mime: string; ext: "mp4" | "webm" } {
  const candidates: [string, "mp4" | "webm"][] = [
    ["video/mp4;codecs=avc1.42E01F", "mp4"], ["video/mp4", "mp4"],
    ["video/webm;codecs=vp9", "webm"], ["video/webm;codecs=vp8", "webm"], ["video/webm", "webm"],
  ];
  for (const [mime, ext] of candidates) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  throw new Error("Este navegador no puede grabar video. Usa Chrome o Edge.");
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo dibujar una diapositiva"));
    img.src = url;
  });
}

export async function renderCapsuleVideo(c: CapsuleRender, onProgress?: (p: number) => void): Promise<{ blob: Blob; ext: "mp4" | "webm" }> {
  const W = 1080;
  const H = 1920;
  const FPS = 30;
  const FADE = 0.5;
  const { mime, ext } = pickMime();
  const images = await Promise.all(c.slides.map((_, i) => loadImage(slideImageUrl(c, i))));
  const durations = c.slides.map((s, i) => slideSeconds(i === 0 ? `${c.title} ${s.text}` : s.text));
  const total = durations.reduce((a, b) => a + b, 0);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

  const draw = (img: HTMLImageElement, alpha: number, progress: number) => {
    const zoom = 1 + 0.04 * progress; // slow push-in
    const w = W * zoom;
    const h = H * zoom;
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    ctx.globalAlpha = 1;
  };

  recorder.start(250);
  const started = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = (performance.now() - started) / 1000;
      if (t >= total) { resolve(); return; }
      let acc = 0;
      let index = 0;
      while (index < durations.length - 1 && t >= acc + durations[index]) { acc += durations[index]; index += 1; }
      const local = t - acc;
      ctx.fillStyle = "#050505";
      ctx.fillRect(0, 0, W, H);
      draw(images[index], 1, local / durations[index]);
      const remaining = durations[index] - local;
      if (index < images.length - 1 && remaining < FADE) draw(images[index + 1], 1 - remaining / FADE, 0);
      onProgress?.(t / total);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  recorder.stop();
  await done;
  stream.getTracks().forEach((track) => track.stop());
  onProgress?.(1);
  return { blob: new Blob(chunks, { type: mime.split(";")[0] }), ext };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function slugify(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "capsula";
}
