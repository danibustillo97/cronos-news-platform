// Scene backgrounds generated in the browser (1920x1080 PNG), themed per
// competition / show segment. They go into the media library as "fondo".

export type BackgroundTheme = "champions" | "libertadores" | "betplay" | "premier" | "debate" | "jornada" | "entretiempo";

export const BACKGROUND_LABEL: Record<BackgroundTheme, string> = {
  champions: "Champions · noche de estrellas", libertadores: "Libertadores · oro", betplay: "Liga BetPlay", premier: "Premier League",
  debate: "Mesa de debate", jornada: "Jornada en vivo", entretiempo: "Entretiempo · análisis",
};

const THEMES: Record<BackgroundTheme, { from: string; to: string; accent: string; stars?: boolean; label: string }> = {
  champions: { from: "#030820", to: "#123a9c", accent: "#9fc0ff", stars: true, label: "CHAMPIONS LEAGUE" },
  libertadores: { from: "#0a0a0f", to: "#5a4300", accent: "#f5c542", label: "LIBERTADORES" },
  betplay: { from: "#08090d", to: "#3d0a14", accent: "#ffd400", label: "LIGA BETPLAY" },
  premier: { from: "#16052b", to: "#3c0a6b", accent: "#c7ff3d", label: "PREMIER LEAGUE" },
  debate: { from: "#0b0b10", to: "#3a0d24", accent: "#ff5c8a", label: "EL DEBATE" },
  jornada: { from: "#05140c", to: "#0f4a2a", accent: "#34d399", label: "JORNADA EN VIVO" },
  entretiempo: { from: "#0a0d14", to: "#1e293b", accent: "#facc15", label: "ENTRETIEMPO" },
};

function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}

export async function drawBackground(theme: BackgroundTheme): Promise<Blob> {
  const t = THEMES[theme];
  const W = 1920;
  const H = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, t.from);
  g.addColorStop(1, t.to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // soft spotlight
  const r = ctx.createRadialGradient(W * 0.72, H * 0.28, 40, W * 0.72, H * 0.28, 900);
  r.addColorStop(0, `${t.accent}40`);
  r.addColorStop(1, "transparent");
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, W, H);

  // diagonal light stripes
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = t.accent;
  for (let x = -H; x < W; x += 140) {
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + 46, H);
    ctx.lineTo(x + 46 + H, 0);
    ctx.lineTo(x + H, 0);
    ctx.fill();
  }
  ctx.restore();

  if (t.stars) {
    const rnd = seeded(7);
    for (let i = 0; i < 260; i += 1) {
      const size = rnd() * 2.2 + 0.4;
      ctx.globalAlpha = rnd() * 0.8 + 0.2;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(rnd() * W, rnd() * H, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // giant watermark + bottom bar
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = "#ffffff";
  let size = 220;
  ctx.font = `900 ${size}px 'Arial Black', 'Segoe UI Black', Arial, sans-serif`;
  while (ctx.measureText(t.label).width > W - 120 && size > 80) {
    size -= 10;
    ctx.font = `900 ${size}px 'Arial Black', 'Segoe UI Black', Arial, sans-serif`;
  }
  ctx.textBaseline = "bottom";
  ctx.fillText(t.label, 60, H - 70);
  ctx.restore();
  ctx.fillStyle = t.accent;
  ctx.fillRect(0, H - 10, W, 10);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 34px 'Segoe UI', Arial, sans-serif";
  ctx.textBaseline = "top";
  ctx.fillText("⚡ NEXUS", 60, 50);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("canvas"))), "image/png"));
}
