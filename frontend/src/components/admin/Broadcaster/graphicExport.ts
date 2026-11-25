export type GraphicKind = "lower-third" | "scoreboard" | "ticker";
export type GraphicVariant = "elite" | "compact" | "editorial" | "live" | "goal" | "lower" | "var" | "events" | "prematch" | "lineup-home" | "lineup-away" | "stats" | "multi" | "goal-alert" | "poll" | "dato";
export type BroadcastMode = "normal" | "football";

export interface FootballTeamPlayer {
  id?: string;
  name: string;
  dorsal: number;
  position: "POR" | "DEF" | "MED" | "ATA";
  starter: boolean;
  captain: boolean;
}

export interface FootballHighlight {
  kind: "goal" | "yellow" | "red" | "sub" | "var" | "void";
  team: "home" | "away";
  player: string;
  minute: number;
  detail?: string;
}

export interface FootballPastGame {
  date: string;
  opponent: string;
  score: string;
  result: "W" | "D" | "L" | "";
  competition: string;
  home: boolean;
}

export interface FootballPreview {
  lastFive: { home: FootballPastGame[]; away: FootballPastGame[] };
  h2h: { summary: string; games: Array<{ date: string; home: string; away: string; score: string }> };
  odds: { provider: string; home: number; draw: number; away: number; overUnder: number } | null;
  leaders: { home: Array<{ name: string; label: string; value: string }>; away: Array<{ name: string; label: string; value: string }> };
  fetchedAt: string;
}

export interface FootballScoreboard {
  preview?: FootballPreview;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  period: "PRE" | "1T" | "HT" | "2T" | "ET" | "PEN" | "FT";
  clockSeconds: number;
  addedTime: number;
  homeYellow: number;
  awayYellow: number;
  homeRed: number;
  awayRed: number;
  accent2?: string;
  competition?: string;
  competitionId?: string;
  homeShort?: string;
  awayShort?: string;
  homeColor?: string;
  awayColor?: string;
  homeForm?: string;
  awayForm?: string;
  homeRecord?: string;
  awayRecord?: string;
  kickoff?: string;
  venue?: string;
  city?: string;
  referee?: string;
  formationHome?: string;
  formationAway?: string;
  lineups?: { home: FootballTeamPlayer[]; away: FootballTeamPlayer[] };
  squads?: { home: FootballTeamPlayer[]; away: FootballTeamPlayer[] };
  stats?: Array<{ label: string; home: number; away: number }>;
  highlight?: FootballHighlight;
  scorers?: { home: string[]; away: string[] };
  homeLogo?: string;
  awayLogo?: string;
  homeShots?: number;
  awayShots?: number;
  homePossession?: number;
  awayPossession?: number;
  homeSubstitutions?: number;
  awaySubstitutions?: number;
  matchStatus?: "scheduled" | "live" | "halftime" | "finished";
  chromaKey?: boolean;
  chromaColor?: string;
}

export interface DesignStyle {
  accent?: string;
  homeColor?: string;
  awayColor?: string;
  showCards?: boolean;
  showCompetition?: boolean;
}

export interface BroadcastGraphic {
  id: string;
  style?: DesignStyle;
  mode?: BroadcastMode;
  name: string;
  kind: GraphicKind;
  title: string;
  subtitle: string;
  accent: string;
  background?: string;
  textColor?: string;
  subtitleColor?: string;
  backgroundImage?: string;
  radius?: number;
  scale?: number;
  alignment?: "left" | "center" | "right";
  variant?: GraphicVariant;
  football?: FootballScoreboard;
  position?: { x: number; y: number };
  leavingAt?: number;
}

function safeColor(value: string | undefined, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value ?? "") ? value as string : fallback;
}

function safeNumber(value: number | undefined, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function formatClock(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character] ?? character);
}

function safeImage(value: string | undefined): string {
  return value && /^(data:image\/|https:\/\/|blob:)/i.test(value) ? value : "";
}

function logo(source: string | undefined, label: string): string {
  return `<span class="logo"><span class="crest">${source ? `<img src="${htmlEscape(source)}" alt="${htmlEscape(label)}">` : `<span class="crest-fallback">${htmlEscape(label.slice(0, 3))}</span>`}</span></span>`;
}

export function exportGraphicHtml(graphic: BroadcastGraphic): string {
  const football = graphic.football;
  const variant = graphic.variant ?? (graphic.kind === "scoreboard" ? "elite" : graphic.kind === "ticker" ? "events" : "lower");
  const accent = safeColor(graphic.accent, "#ef4444");
  const accent2 = safeColor(football?.accent2, "#f5d400");
  const background = safeColor(graphic.background, "#070a0f");
  const textColor = safeColor(graphic.textColor, "#ffffff");
  const subtitleColor = safeColor(graphic.subtitleColor, "#aab4c4");
  const scale = safeNumber(graphic.scale, 1, 0.75, 1.4);
  const position = graphic.position ?? { x: 62, y: 7 };
  const backgroundImage = safeImage(graphic.backgroundImage);
  const home = football ? htmlEscape(football.homeTeam) : "LOCAL";
  const away = football ? htmlEscape(football.awayTeam) : "VISITANTE";
  const content = graphic.kind === "scoreboard" && football
    ? `<aside class="scoreboard ${variant}">
        <div class="brand">NEXUS <b>SPORT</b></div>
        <div class="competition">${htmlEscape(football.competition ?? "PARTIDO EN VIVO")}</div>
        <div class="score-row">
          <div class="team home">${logo(football.homeLogo, home)}<strong>${home}</strong></div>
          <div class="score">${football.homeScore}<span>:</span>${football.awayScore}</div>
          <div class="team away"><strong>${away}</strong>${logo(football.awayLogo, away)}</div>
        </div>
        <div class="match-meta"><span>${football.period} · ${formatClock(football.clockSeconds)}${football.addedTime ? ` <b>+${football.addedTime}</b>` : ""}</span><span class="cards">🟨 ${football.homeYellow} · ${football.awayYellow} &nbsp; 🟥 ${football.homeRed} · ${football.awayRed}</span></div>
      </aside>`
    : graphic.variant === "goal"
      ? `<aside class="event goal"><span class="event-kicker">NEXUS SPORT</span><strong>¡GOL!</strong><span>${htmlEscape(graphic.subtitle || "PARTIDO EN VIVO")}</span></aside>`
      : graphic.variant === "var"
        ? `<aside class="event var"><span class="event-kicker">NEXUS REVIEW</span><strong>VAR</strong><span>${htmlEscape(graphic.subtitle || "REVISIÓN EN CURSO")}</span></aside>`
        : `<aside class="lower${variant === "lower" ? "" : ` ${variant}`}"><i></i><div><strong>${htmlEscape(graphic.title)}</strong><span>${htmlEscape(graphic.subtitle)}</span></div></aside>`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${htmlEscape(graphic.name)}</title>
<style>
:root{--accent:${accent};--accent2:${accent2};--ink:${background};--text:${textColor};--muted:${subtitleColor}}
*{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;background:transparent;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:var(--text)}
aside{position:absolute;isolation:isolate;transform:scale(${scale});transform-origin:top left}
aside:before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none}
.brand{font-size:clamp(8px,.65vw,12px);font-style:italic;font-weight:900;letter-spacing:.08em;color:#fff;text-align:center}.brand b{color:#f5d400}
.scoreboard{left:${position.x}%;top:${position.y}%;width:min(720px,94vw);padding:16px 22px 13px;background:linear-gradient(180deg,#0d131bfa,#05070bf5);border:1px solid #ffffff26;border-top:4px solid var(--accent);clip-path:polygon(0 0,98% 0,100% 20%,100% 100%,0 100%);box-shadow:0 12px 30px #0009;animation:nexus-in .35s ease-out both}
.scoreboard.compact{width:min(520px,90vw);padding:10px 14px;border-top-width:3px}.scoreboard.editorial{background:#101820f5;border-left:7px solid var(--accent);clip-path:none}.scoreboard.live{border-top-color:#35e184}.scoreboard.goal{border-color:#f5d400}.scoreboard .competition{text-align:center;margin:8px 0 11px;color:var(--muted);font-size:clamp(9px,.75vw,13px);font-weight:800;letter-spacing:.16em;text-transform:uppercase}
.score-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:18px}.team{display:flex;align-items:center;gap:11px;min-width:0}.team.away{justify-content:flex-end}.team strong{font-size:clamp(13px,1.35vw,23px);font-weight:900;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.logo{display:contents}.crest{display:grid;place-items:center;width:clamp(38px,4vw,62px);height:clamp(38px,4vw,62px);flex:none}.crest img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 5px #0008)}.crest-fallback{display:grid;place-items:center;width:100%;height:100%;background:#ffffff14;border:1px solid #ffffff26;color:#fff;font-size:clamp(9px,1vw,14px);font-weight:900;clip-path:polygon(50% 0,92% 18%,82% 78%,50% 100%,18% 78%,8% 18%)}
.score{display:flex;align-items:center;gap:12px;padding:4px 16px;background:var(--accent);color:#05070a;font-size:clamp(34px,4vw,68px);font-weight:950;line-height:.9;letter-spacing:-.08em;clip-path:polygon(8% 0,100% 0,92% 100%,0 100%)}.score span{font-size:.52em;opacity:.5}
.match-meta{display:flex;justify-content:center;gap:24px;margin-top:12px;color:var(--muted);font-size:clamp(10px,.8vw,14px);font-weight:700}.match-meta>span:first-child{color:#fff}.match-meta b{color:var(--ink);background:var(--accent);padding:2px 6px;margin-left:4px}.cards{white-space:nowrap}
.event{left:${position.x}%;top:${position.y}%;display:flex;align-items:center;gap:16px;padding:14px 28px;background:#05070bf5;border-left:8px solid var(--accent);border-bottom:2px solid var(--accent);box-shadow:0 10px 30px #000a;animation:nexus-in .25s ease-out both}.event strong{font-size:clamp(34px,5vw,82px);font-style:italic;font-weight:950;color:var(--accent)}.event span{font-weight:800;color:#fff}.event-kicker{color:var(--muted)!important;font-size:clamp(9px,1vw,15px);letter-spacing:.15em}.event.var{--accent:#38a8ff}.event.goal{--accent:#f5d400}
.lower{left:${position.x}%;top:${position.y}%;min-width:42%;display:flex;align-items:stretch;background:#05070bf5;border:1px solid #ffffff24;box-shadow:0 8px 24px #0009}.lower i{width:9px;background:${accent};background:var(--accent);clip-path:polygon(0 0,100% 0,70% 100%,0 100%)}.lower div{padding:13px 22px}.lower strong,.lower span{display:block}.lower strong{font-size:clamp(18px,2.2vw,34px);font-weight:900;letter-spacing:.03em}.lower span{margin-top:5px;color:var(--muted);font-size:clamp(12px,1.2vw,18px)}
.template-image{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none}
@keyframes nexus-in{from{opacity:0;transform:translateY(-8px) scale(${scale})}to{opacity:1;transform:translateY(0) scale(${scale})}}@media(prefers-reduced-motion:reduce){*{animation:none!important}}
</style></head><body>${backgroundImage ? `<img class="template-image" src="${htmlEscape(backgroundImage)}" alt="">` : ""}${content}</body></html>`;
}
