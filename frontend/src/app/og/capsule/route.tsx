// 1080×1920 (9:16) render of ONE capsule slide, for the portal reels, the
// admin preview, TikTok photo carousels and the slideshow video.
// GET /og/capsule?kind=leyenda&title=…&subject=…&year=1990&day=09-05&text=…&image=https://…&i=0&n=4
// Lives outside /api on purpose (/api/* is proxied to FastAPI).
// Keeps text inside TikTok's safe area: nothing important in the bottom
// ~420px (caption/music bar) or the right ~170px (like/comment/share column).

import { ImageResponse } from "next/og";

export const runtime = "edge";

const W = 1080;
const H = 1920;
const KIND = {
  efemeride: { chip: "UN DÍA COMO HOY", accent: "#facc15", bg: "linear-gradient(160deg, #2a2205 0%, #0d0b04 40%, #050505 100%)" },
  sabias_que: { chip: "¿SABÍAS QUE?", accent: "#38bdf8", bg: "linear-gradient(160deg, #06263a 0%, #07121a 42%, #050505 100%)" },
  leyenda: { chip: "LEYENDAS", accent: "#eab308", bg: "linear-gradient(160deg, #3a2a05 0%, #140f04 45%, #050505 100%)" },
  momento: { chip: "MOMENTO HISTÓRICO", accent: "#f97316", bg: "linear-gradient(160deg, #3a1505 0%, #160904 45%, #050505 100%)" },
} as const;

// Inter (OFL) in the three weights the design uses; fetched once per edge instance.
const FONT_BASE = "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin";
let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 400 | 700 | 900; style: "normal" }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all(([400, 700, 900] as const).map(async (weight) => ({
    name: "Inter", weight, style: "normal" as const,
    data: await fetch(`${FONT_BASE}-${weight}-normal.woff`).then((r) => {
      if (!r.ok) throw new Error(`font ${weight}: ${r.status}`);
      return r.arrayBuffer();
    }),
  }))).catch((err) => { fonts = null; throw err; });
  return fonts;
}
const MONTHS = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function safeImage(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const kind = (q.get("kind") ?? "sabias_que") as keyof typeof KIND;
  const style = KIND[kind] ?? KIND.sabias_que;
  const title = clip(q.get("title") ?? "", 90);
  const subject = clip(q.get("subject") ?? "", 60);
  const text = clip(q.get("text") ?? "", 220);
  const year = (q.get("year") ?? "").match(/^\d{4}$/)?.[0] ?? "";
  const day = q.get("day") ?? "";
  const image = safeImage(q.get("image"));
  const i = Math.max(0, Number(q.get("i") ?? 0) || 0);
  const n = Math.min(8, Math.max(1, Number(q.get("n") ?? 1) || 1));
  const cover = i === 0;
  const dayLabel = /^\d{2}-\d{2}$/.test(day) ? `${Number(day.slice(3))} ${MONTHS[Number(day.slice(0, 2)) - 1] ?? ""}` : "";

  const initials = subject.split(/\s+/).filter((w) => /^[A-Za-zÁÉÍÓÚÑ]/.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const glyph = kind === "leyenda" ? initials : kind === "sabias_que" ? "?" : kind === "momento" ? year.slice(2) : dayLabel ? dayLabel.split(" ")[0] : "";

  const textSize = text.length > 150 ? 58 : text.length > 90 ? 66 : 76;

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", position: "relative", background: "#0a0a0a", color: "white", fontFamily: "Inter, sans-serif" }}>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" width={W} height={H} style={{ position: "absolute", top: 0, left: 0, width: W, height: H, objectFit: "cover" }} />
        )}
        <div style={{ position: "absolute", top: 0, left: 0, width: W, height: H, display: "flex", backgroundImage: image
          ? "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 30%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.92) 100%)"
          : style.bg }} />

        {/* decorative glyph when there is no photo */}
        {!image && glyph && (
          <div style={{ position: "absolute", top: 230, right: -40, display: "flex", fontSize: glyph.length > 2 ? 420 : 640, fontWeight: 900, letterSpacing: -30, color: style.accent, opacity: 0.12, lineHeight: 1 }}>{glyph}</div>
        )}

        {/* story progress */}
        <div style={{ position: "absolute", top: 70, left: 60, right: 60, display: "flex", gap: 10 }}>
          {Array.from({ length: n }).map((_, k) => (
            <div key={k} style={{ flex: 1, height: 8, borderRadius: 8, background: k <= i ? "#ffffff" : "rgba(255,255,255,0.3)" }} />
          ))}
        </div>

        {/* brand + chip */}
        <div style={{ position: "absolute", top: 120, left: 60, right: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 40, fontWeight: 900, letterSpacing: -1 }}>
            <span style={{ color: "#facc15", fontSize: 50 }}>⚡</span> NEXUS
          </div>
          <div style={{ display: "flex", padding: "12px 26px", borderRadius: 999, background: style.accent, color: "#0a0a0a", fontSize: 30, fontWeight: 900, letterSpacing: 3 }}>{style.chip}</div>
        </div>

        {/* content: inside the safe area (left 70, right 190, bottom 430) */}
        <div style={{ position: "absolute", left: 70, right: 190, bottom: 430, top: 300, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          {cover ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {kind === "efemeride" && year && (
                <div style={{ display: "flex", flexDirection: "column", marginBottom: 30 }}>
                  {dayLabel && <div style={{ fontSize: 46, fontWeight: 700, color: style.accent, letterSpacing: 4 }}>{dayLabel}</div>}
                  <div style={{ fontSize: 300, fontWeight: 900, lineHeight: 0.9, letterSpacing: -12, color: "white" }}>{year}</div>
                </div>
              )}
              {kind === "leyenda" && subject && (
                <div style={{ display: "flex", flexDirection: "column", marginBottom: 26 }}>
                  <div style={{ width: 120, height: 8, background: style.accent, marginBottom: 26 }} />
                  <div style={{ fontSize: 96, fontWeight: 900, lineHeight: 1, letterSpacing: -3, color: style.accent }}>{subject}</div>
                  {year && <div style={{ fontSize: 40, color: "rgba(255,255,255,0.75)", marginTop: 14 }}>{year}</div>}
                </div>
              )}
              {kind === "momento" && year && <div style={{ display: "flex", fontSize: 54, fontWeight: 900, color: style.accent, marginBottom: 18, letterSpacing: 2 }}>{subject ? `${year} · ${subject}` : year}</div>}
              {kind === "sabias_que" && <div style={{ fontSize: 64, fontWeight: 900, color: style.accent, marginBottom: 20 }}>¿Sabías que…?</div>}
              <div style={{ fontSize: title.length > 60 ? 68 : 80, fontWeight: 900, lineHeight: 1.05, letterSpacing: -2 }}>{title}</div>
              {text && <div style={{ fontSize: 44, lineHeight: 1.3, marginTop: 28, color: "rgba(255,255,255,0.85)" }}>{text}</div>}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ width: 90, height: 8, background: style.accent, marginBottom: 34 }} />
              <div style={{ fontSize: textSize, fontWeight: 700, lineHeight: 1.18, letterSpacing: -1.5 }}>{text}</div>
              {subject && <div style={{ display: "flex", fontSize: 38, marginTop: 30, color: style.accent, fontWeight: 700 }}>{year ? `${subject} · ${year}` : subject}</div>}
            </div>
          )}
        </div>

        {/* footer inside safe area */}
        <div style={{ position: "absolute", left: 70, bottom: 340, display: "flex", fontSize: 32, color: "rgba(255,255,255,0.6)", letterSpacing: 2 }}>
          {`${i + 1}/${n} · nexus fútbol`}
        </div>
      </div>
    ),
    { width: W, height: H, fonts: await loadFonts().catch(() => undefined), headers: { "Cache-Control": "public, max-age=86400, immutable" } },
  );
}
