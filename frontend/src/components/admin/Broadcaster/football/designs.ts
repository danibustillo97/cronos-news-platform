import type { DesignStyle, FootballScoreboard, FootballTeamPlayer, GraphicVariant } from "../graphicExport";
import { getCompetition } from "./competitions";

export interface DesignOutput {
  html: string;
  width: number;
  height: number;
}

export const FOOTBALL_VARIANTS: GraphicVariant[] = ["elite", "compact", "editorial", "live", "goal", "lower", "var", "events", "prematch", "lineup-home", "lineup-away", "stats", "multi", "goal-alert"];

/** Other matches shown at once by the "multi" panel (fed by useLiveBoard). */
export interface MultiScore { id: string; league: string; home: string; away: string; homeScore: number | null; awayScore: number | null; status: "live" | "halftime" | "finished" | "scheduled"; detail: string }
let multiScores: MultiScore[] = [];
let multiVersion = 0;
export function setMultiScores(list: MultiScore[]) {
  const next = JSON.stringify(list);
  if (next === JSON.stringify(multiScores)) return;
  multiScores = list;
  multiVersion += 1;
}
export const getMultiVersion = () => multiVersion;

const esc = (value: string | number | undefined): string =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

const isHex = (value: string | undefined): value is string => /^#[0-9a-f]{6}$/i.test(value ?? "");
const safeSrc = (value: string | undefined) => (value && /^data:image\//i.test(value) ? value : "");

function channels(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
function toHex(rgb: number[]): string {
  return `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}
const mix = (hex: string, target: [number, number, number], amount: number) =>
  toHex(channels(hex).map((v, i) => v + (target[i] - v) * amount));
const darken = (hex: string, amount: number) => mix(hex, [0, 0, 0], amount);
const luminance = (hex: string) => {
  const [r, g, b] = channels(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
const onColor = (hex: string) => (luminance(hex) > 0.6 ? "#05070b" : "#ffffff");

const clock = (seconds: number) => {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
};

const PERIOD_LABEL: Record<FootballScoreboard["period"], string> = { PRE: "PREVIA", "1T": "1T", HT: "DESCANSO", "2T": "2T", ET: "PRÓRROGA", PEN: "PENALES", FT: "FINAL" };

function clockLabel(m: FootballScoreboard): string {
  if (m.period === "PRE") return "PREVIA";
  if (m.period === "HT" || m.period === "FT") return PERIOD_LABEL[m.period];
  return `${PERIOD_LABEL[m.period]} ${clock(m.clockSeconds)}${m.addedTime ? ` +${m.addedTime}` : ""}`;
}

interface Palette {
  accent: string;
  accent2: string;
  bg: string;
  home: string;
  away: string;
  homeDark: string;
  awayDark: string;
}

function palette(m: FootballScoreboard): Palette {
  const theme = getCompetition(m.competitionId ?? "custom");
  const accent = isHex(m.accent2) ? m.accent2 : theme.accent;
  const home = isHex(m.homeColor) ? m.homeColor : "#1f3a8a";
  const away = isHex(m.awayColor) ? m.awayColor : "#7f1d1d";
  return {
    accent,
    accent2: theme.accent2,
    bg: theme.bg,
    home: luminance(home) < 0.08 ? mix(home, [255, 255, 255], 0.25) : home,
    away: luminance(away) < 0.08 ? mix(away, [255, 255, 255], 0.25) : away,
    homeDark: darken(home, 0.55),
    awayDark: darken(away, 0.55),
  };
}

const abbr = (name: string, short?: string) => esc((short || name.replace(/[^\p{L}\p{N} ]/gu, "").slice(0, 3)).toUpperCase());

function crest(src: string | undefined, name: string, size: number): string {
  const s = safeSrc(src);
  return s
    ? `<img src="${esc(s)}" alt="" style="width:${size}px;height:${size}px;object-fit:contain;filter:drop-shadow(0 4px 6px rgba(0,0,0,.55))" />`
    : `<div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:rgba(255,255,255,.1);border:2px solid rgba(255,255,255,.35);font:900 ${Math.round(size * 0.32)}px 'Arial Black',Arial,sans-serif;color:#fff;clip-path:polygon(50% 0,94% 16%,84% 76%,50% 100%,16% 76%,6% 16%)">${abbr(name)}</div>`;
}

function cards(yellow: number, red: number): string {
  if (hideCards) return "";
  const pip = (color: string, n: number) => (n > 0 ? `<i style="display:inline-block;width:10px;height:14px;background:${color};border-radius:2px;margin-right:3px"></i>${n > 1 ? `<b style="font:800 12px Arial;margin-right:8px">${n}</b>` : ""}` : "");
  return `${pip("#facc15", yellow)}${pip("#ef4444", red)}`;
}

const FONT_NUM = "font-family:'Arial Black','Segoe UI Black',Impact,Arial,sans-serif";
const FONT_TXT = "font-family:'Segoe UI',Arial,Helvetica,sans-serif";

const NUM = "font-family:Bahnschrift,'Segoe UI Semibold','Segoe UI',Arial,sans-serif;font-variant-numeric:tabular-nums";
const SURFACE = "rgba(8,10,15,.94)";
const HAIR = "rgba(255,255,255,.12)";

function tag(text: string, color: string): string {
  if (hideCompetition) return "";
  return `<span style="font:600 11px 'Segoe UI',Arial;letter-spacing:.22em;text-transform:uppercase;color:${color}">${text}</span>`;
}

const PARTICLES = new Set(["de", "da", "do", "dos", "das", "del", "la", "van", "von", "di", "le"]);
function surname(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return parts[0] ?? "";
  let start = parts.length - 1;
  while (start > 1 && PARTICLES.has(parts[start - 1].toLowerCase())) start -= 1;
  return parts.slice(start).join(" ");
}

function dorsalOf(m: FootballScoreboard, side: "home" | "away", name: string): string {
  const key = name.trim().toLowerCase();
  const found = (m.lineups?.[side] ?? []).find((player) => player.name.trim().toLowerCase() === key);
  return found?.dorsal ? String(found.dorsal) : "";
}

function scorerStrip(m: FootballScoreboard, side: "home" | "away"): string {
  const list = m.scorers?.[side] ?? [];
  if (!list.length) return "";
  const left = side === "home";
  const text = list.slice(-3).map((item) => esc(item)).join("&#160;&#160;·&#160;&#160;");
  return `<div style="position:absolute;${left ? "left:0" : "right:0"};top:122px;height:26px;max-width:330px;padding:0 ${left ? "26px 0 22px" : "22px 0 26px"};display:flex;align-items:center;gap:8px;background:rgba(6,8,12,.92);clip-path:polygon(${left ? "0 0,100% 0,calc(100% - 12px) 100%,0 100%" : "12px 0,100% 0,100% 100%,0 100%"});font:700 12px 'Segoe UI',Arial;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;overflow:hidden"><i style="width:7px;height:7px;border-radius:50%;background:#fff;flex:none"></i>${text}</div>`;
}

function elite(m: FootballScoreboard, p: Palette): DesignOutput {
  const theme = getCompetition(m.competitionId ?? "custom");
  const running = m.period !== "PRE" && m.period !== "HT" && m.period !== "FT";
  const ratio = m.period === "PRE" ? 0 : m.period === "FT" ? 1 : Math.min(1, m.clockSeconds / (m.period === "ET" ? 7200 : 5400));
  const wedge = (side: "home" | "away") => {
    const left = side === "home";
    const color = left ? p.home : p.away;
    const dark = left ? p.homeDark : p.awayDark;
    const cut = left ? "polygon(0 0,100% 0,calc(100% - 40px) 100%,0 100%)" : "polygon(40px 0,100% 0,100% 100%,0 100%)";
    return `<div style="position:absolute;${left ? "left:0" : "right:0"};top:30px;width:400px;height:88px;background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(255,255,255,0) 46%),linear-gradient(${left ? "100deg" : "260deg"},${color} 0%,${dark} 100%);clip-path:${cut}"></div>`;
  };
  const team = (side: "home" | "away") => {
    const left = side === "home";
    const name = left ? m.homeTeam : m.awayTeam;
    const short = left ? m.homeShort : m.awayShort;
    const logo = left ? m.homeLogo : m.awayLogo;
    const ink = onColor(left ? p.home : p.away);
    const cardsHtml = cards(left ? m.homeYellow : m.awayYellow, left ? m.homeRed : m.awayRed);
    return `<div style="position:absolute;${left ? "left:22px" : "right:22px"};top:22px;width:104px;height:104px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.28),rgba(255,255,255,0) 70%);display:grid;place-items:center">${crest(logo, name, 92)}</div>
    <div style="position:absolute;${left ? "left:140px;text-align:left" : "right:140px;text-align:right"};top:40px;width:200px;color:${ink}">
      <div style="${FONT_NUM};font-size:52px;line-height:1;letter-spacing:.02em;text-shadow:0 3px 0 rgba(0,0,0,.25)">${abbr(name, short)}</div>
      <div style="margin-top:5px;font:700 11px 'Segoe UI',Arial;letter-spacing:.2em;text-transform:uppercase;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
      <div style="margin-top:4px;height:14px">${cardsHtml}</div>
    </div>`;
  };
  const html = `<div class="nx" style="width:960px;height:170px;color:#fff;${FONT_TXT}">
  <div style="position:absolute;left:0;top:30px;width:960px;height:88px;background:${SURFACE};box-shadow:0 20px 44px rgba(0,0,0,.55)"></div>
  ${wedge("home")}${wedge("away")}
  <div style="position:absolute;left:0;top:115px;width:960px;height:3px;background:rgba(255,255,255,.14)"></div>
  <div style="position:absolute;left:0;top:115px;width:${Math.round(960 * ratio)}px;height:3px;background:${p.accent}"></div>
  ${team("home")}${team("away")}
  ${scorerStrip(m, "home")}${scorerStrip(m, "away")}
  <div style="position:absolute;left:340px;top:6px;width:280px;height:150px;background:linear-gradient(180deg,#0e131b,#05070b);clip-path:polygon(26px 0,calc(100% - 26px) 0,100% 26px,100% calc(100% - 26px),calc(100% - 26px) 100%,26px 100%,0 calc(100% - 26px),0 26px)"></div>
  <div style="position:absolute;left:340px;top:6px;width:280px;height:150px;background:linear-gradient(135deg,rgba(255,255,255,.1),rgba(255,255,255,0) 40%);clip-path:polygon(26px 0,calc(100% - 26px) 0,100% 26px,100% calc(100% - 26px),calc(100% - 26px) 100%,26px 100%,0 calc(100% - 26px),0 26px)"></div>
  <div style="position:absolute;left:366px;top:6px;width:228px;height:4px;background:${p.accent}"></div>
  <div style="position:absolute;left:366px;top:152px;width:228px;height:4px;background:${p.accent}"></div>
  <div style="position:absolute;left:340px;top:16px;width:280px;height:100px;display:flex;align-items:center;justify-content:center;gap:18px">
    <span style="${FONT_NUM};font-size:92px;line-height:1;min-width:74px;text-align:center;text-shadow:0 4px 0 rgba(0,0,0,.4)">${m.homeScore}</span>
    <span style="width:4px;height:50px;background:${p.accent};transform:skewX(-18deg)"></span>
    <span style="${FONT_NUM};font-size:92px;line-height:1;min-width:74px;text-align:center;text-shadow:0 4px 0 rgba(0,0,0,.4)">${m.awayScore}</span>
  </div>
  <div style="position:absolute;left:376px;top:118px;width:208px;height:30px;display:flex;align-items:center;justify-content:center;gap:10px;background:${p.accent};color:${onColor(p.accent)};clip-path:polygon(14px 0,calc(100% - 14px) 0,100% 100%,0 100%);font:800 15px 'Segoe UI',Arial;letter-spacing:.18em;text-transform:uppercase">
    ${running ? `<i style="width:7px;height:7px;border-radius:50%;background:currentColor"></i>` : ""}<span>${esc(clockLabel(m))}</span>
  </div>
  ${hideCompetition ? "" : `<div style="position:absolute;left:28px;top:8px;font:700 10px 'Segoe UI',Arial;letter-spacing:.28em;text-transform:uppercase;color:rgba(255,255,255,.85)">${esc(m.competition || theme.short)}</div><div style="position:absolute;right:28px;top:8px;font:800 10px 'Segoe UI',Arial;letter-spacing:.32em;color:${p.accent}">NEXUS SCORE</div>`}
</div>`;
  return { html, width: 960, height: 170 };
}
function compact(m: FootballScoreboard, p: Palette): DesignOutput {
  const html = `<div class="nx" style="width:470px;height:48px;display:flex;align-items:center;background:${SURFACE};color:#fff;${FONT_TXT};border-radius:3px;box-shadow:0 8px 22px rgba(0,0,0,.4),inset 0 0 0 1px ${HAIR};overflow:hidden">
  <div style="width:4px;align-self:stretch;background:${p.home}"></div>
  <div style="width:44px;display:grid;place-items:center">${crest(m.homeLogo, m.homeTeam, 30)}</div>
  <div style="width:56px;${NUM};font-size:20px;font-weight:700;letter-spacing:.06em">${abbr(m.homeTeam, m.homeShort)}</div>
  <div style="width:84px;height:100%;display:flex;align-items:center;justify-content:center;gap:10px;background:rgba(255,255,255,.05);${NUM};font-size:26px;font-weight:700"><span>${m.homeScore}</span><span style="width:2px;height:16px;background:${p.accent}"></span><span>${m.awayScore}</span></div>
  <div style="width:56px;text-align:right;${NUM};font-size:20px;font-weight:700;letter-spacing:.06em">${abbr(m.awayTeam, m.awayShort)}</div>
  <div style="width:44px;display:grid;place-items:center">${crest(m.awayLogo, m.awayTeam, 30)}</div>
  <div style="flex:1;text-align:center;white-space:nowrap;font:600 12px 'Segoe UI',Arial;letter-spacing:.14em;color:${p.accent}">${esc(clockLabel(m))}</div>
  <div style="width:4px;align-self:stretch;background:${p.away}"></div>
</div>`;
  return { html, width: 470, height: 48 };
}

function editorial(m: FootballScoreboard, p: Palette): DesignOutput {
  const theme = getCompetition(m.competitionId ?? "custom");
  const row = (name: string, logo: string | undefined, score: number, color: string, yellow: number, red: number) => `
  <div style="height:46px;display:flex;align-items:center;border-top:1px solid ${HAIR}">
    <div style="width:4px;height:26px;background:${color};margin:0 12px 0 16px"></div>
    <div style="width:40px">${crest(logo, name, 30)}</div>
    <div style="flex:1;font:600 19px 'Segoe UI',Arial;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
    <div style="margin-right:12px">${cards(yellow, red)}</div>
    <div style="width:58px;text-align:center;${NUM};font-size:30px;font-weight:700">${score}</div>
  </div>`;
  const html = `<div class="nx" style="width:440px;height:128px;color:#fff;${FONT_TXT};background:${SURFACE};border-radius:3px;box-shadow:0 12px 30px rgba(0,0,0,.45),inset 0 0 0 1px ${HAIR};overflow:hidden">
  <div style="height:34px;display:flex;align-items:center;justify-content:space-between;padding:0 16px">${tag(esc(m.competition || theme.short), p.accent)}<span style="font:600 12px 'Segoe UI',Arial;letter-spacing:.16em;opacity:.8">${esc(clockLabel(m))}</span></div>
  ${row(m.homeTeam, m.homeLogo, m.homeScore, p.home, m.homeYellow, m.homeRed)}
  ${row(m.awayTeam, m.awayLogo, m.awayScore, p.away, m.awayYellow, m.awayRed)}
</div>`;
  return { html, width: 440, height: 128 };
}

function live(m: FootballScoreboard, p: Palette): DesignOutput {
  const theme = getCompetition(m.competitionId ?? "custom");
  const running = m.period !== "PRE" && m.period !== "HT" && m.period !== "FT";
  const html = `<div class="nx" style="width:1100px;height:78px;display:flex;align-items:center;color:#fff;${FONT_TXT};background:${SURFACE};border-radius:3px;box-shadow:0 -6px 30px rgba(0,0,0,.4),inset 0 0 0 1px ${HAIR};overflow:hidden">
  <div style="width:150px;align-self:stretch;display:flex;flex-direction:column;align-items:center;justify-content:center;background:${p.accent};color:${onColor(p.accent)}">
    <span style="font:700 11px 'Segoe UI',Arial;letter-spacing:.24em">${esc(PERIOD_LABEL[m.period])}</span><span style="${NUM};font-size:30px;font-weight:700;line-height:1.1">${running ? clock(m.clockSeconds) : "--:--"}</span>
  </div>
  <div style="flex:1;display:flex;align-items:center;justify-content:flex-end;gap:14px;padding-right:18px"><div style="text-align:right"><div style="font:600 24px 'Segoe UI',Arial;letter-spacing:.06em;text-transform:uppercase;max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.homeTeam)}</div><div>${cards(m.homeYellow, m.homeRed)}</div></div>${crest(m.homeLogo, m.homeTeam, 52)}</div>
  <div style="width:170px;height:100%;display:flex;align-items:center;justify-content:center;gap:14px;background:rgba(255,255,255,.05);${NUM};font-size:46px;font-weight:700"><span>${m.homeScore}</span><span style="width:2px;height:26px;background:${p.accent}"></span><span>${m.awayScore}</span></div>
  <div style="flex:1;display:flex;align-items:center;gap:14px;padding-left:18px">${crest(m.awayLogo, m.awayTeam, 52)}<div><div style="font:600 24px 'Segoe UI',Arial;letter-spacing:.06em;text-transform:uppercase;max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.awayTeam)}</div><div>${cards(m.awayYellow, m.awayRed)}</div></div></div>
  <div style="width:150px;text-align:center;padding-right:10px">${tag(esc(m.competition || theme.short), p.accent)}</div>
</div>`;
  return { html, width: 1100, height: 78 };
}

function goal(m: FootballScoreboard, p: Palette): DesignOutput {
  const h = m.highlight;
  const team = h?.team ?? "home";
  const color = team === "home" ? p.home : p.away;
  const dark = team === "home" ? p.homeDark : p.awayDark;
  const logoSrc = team === "home" ? m.homeLogo : m.awayLogo;
  const teamName = team === "home" ? m.homeTeam : m.awayTeam;
  const player = h?.player && h.player !== teamName ? h.player : "";
  const dorsal = player ? dorsalOf(m, team, player) : "";
  const ink = onColor(color);
  const score = (side: "home" | "away") => {
    const scoring = side === team;
    const value = side === "home" ? m.homeScore : m.awayScore;
    return `<span style="${FONT_NUM};font-size:34px;color:${scoring ? p.accent : "#fff"}">${value}</span>`;
  };
  const html = `<div class="nx" style="width:1100px;height:250px;color:#fff;${FONT_TXT}">
  <div style="position:absolute;left:0;top:0;width:1100px;height:250px;background:${SURFACE};clip-path:polygon(0 0,100% 0,calc(100% - 46px) 100%,0 100%);box-shadow:0 24px 60px rgba(0,0,0,.6)"></div>
  <div style="position:absolute;left:0;top:0;width:430px;height:250px;background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,0) 50%),linear-gradient(120deg,${color},${dark});clip-path:polygon(0 0,100% 0,calc(100% - 70px) 100%,0 100%)"></div>
  <div style="position:absolute;left:372px;top:0;width:22px;height:250px;background:${p.accent};transform:skewX(-16deg);transform-origin:top left"></div>
  <div style="position:absolute;left:40px;top:20px;width:250px;height:250px;border-radius:50%;background:radial-gradient(circle,rgba(255,255,255,.35),rgba(255,255,255,0) 68%)"></div>
  <div style="position:absolute;left:60px;top:44px;width:200px;height:170px;display:grid;place-items:center">${crest(logoSrc, teamName, 168)}</div>
  ${dorsal ? `<div style="position:absolute;right:60px;top:-24px;${FONT_NUM};font-size:300px;line-height:1;color:rgba(255,255,255,.06);font-style:italic">${esc(dorsal)}</div>` : ""}
  <div style="position:absolute;left:470px;top:8px;${FONT_NUM};font-size:112px;line-height:1;font-style:italic;letter-spacing:.04em;color:${p.accent};text-shadow:5px 5px 0 ${dark}">GOL</div>
  <div style="position:absolute;left:470px;top:128px;right:80px;display:flex;align-items:center;gap:16px">
    ${dorsal ? `<div style="flex:none;min-width:54px;height:54px;padding:0 8px;display:grid;place-items:center;background:${p.accent};color:${onColor(p.accent)};${FONT_NUM};font-size:30px;clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)">${esc(dorsal)}</div>` : ""}
    <div style="${NUM};font-size:56px;font-weight:700;line-height:1;text-transform:uppercase;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(player || teamName)}</div>
  </div>
  <div style="position:absolute;left:470px;top:196px;display:flex;align-items:center;gap:14px;font:700 18px 'Segoe UI',Arial;letter-spacing:.16em;text-transform:uppercase">
    <span style="padding:3px 12px;background:rgba(255,255,255,.12);color:${p.accent}">${h ? `${h.minute}'` : ""}</span><span style="opacity:.8">${esc(teamName)}</span>
  </div>
  <div style="position:absolute;right:74px;top:24px;display:flex;align-items:center;gap:14px;padding:6px 18px;background:rgba(0,0,0,.55);border-bottom:3px solid ${p.accent}"><span style="font:700 14px 'Segoe UI',Arial;letter-spacing:.14em">${abbr(m.homeTeam, m.homeShort)}</span>${score("home")}<span style="width:3px;height:20px;background:${p.accent};transform:skewX(-18deg)"></span>${score("away")}<span style="font:700 14px 'Segoe UI',Arial;letter-spacing:.14em">${abbr(m.awayTeam, m.awayShort)}</span></div>
  <div style="position:absolute;left:0;bottom:0;width:430px;height:5px;background:${ink === "#ffffff" ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.4)"}"></div>
</div>`;
  return { html, width: 1100, height: 250 };
}

function lower(p: Palette, title: string, subtitle: string): DesignOutput {
  const html = `<div class="nx" style="width:700px;height:96px;display:flex;align-items:center;color:#fff;${FONT_TXT};background:${SURFACE};border-radius:3px;box-shadow:0 12px 30px rgba(0,0,0,.45),inset 0 0 0 1px ${HAIR};overflow:hidden">
  <div style="width:96px;align-self:stretch;display:grid;place-items:center;background:${p.accent};color:${onColor(p.accent)};${NUM};font-size:44px;font-weight:700">${esc(subtitle.match(/\d+/)?.[0] ?? "")}</div>
  <div style="flex:1;padding:0 26px;min-width:0">
    <div style="${NUM};font-size:32px;font-weight:700;letter-spacing:.03em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</div>
    <div style="margin-top:6px">${tag(esc(subtitle.replace(/^\d+\s*[·|-]?\s*/, "")), p.accent)}</div>
  </div>
</div>`;
  return { html, width: 700, height: 96 };
}

function multi(p: Palette, title: string): DesignOutput {
  const rows = multiScores.slice(0, 7);
  const rowH = 54;
  const height = 64 + Math.max(1, rows.length) * rowH + 12;
  const body = rows.length ? rows.map((m) => {
    const live = m.status === "live" || m.status === "halftime";
    const score = m.homeScore === null ? "vs" : `${m.homeScore}-${m.awayScore}`;
    return `<div style="display:flex;align-items:center;height:${rowH}px;padding:0 20px;border-top:1px solid ${HAIR}">
  <div style="width:150px;font:600 12px 'Segoe UI',Arial;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.league)}</div>
  <div style="flex:1;text-align:right;${NUM};font-size:22px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.home)}</div>
  <div style="width:92px;text-align:center;${NUM};font-size:26px;font-weight:800;color:${live ? "#fff" : "rgba(255,255,255,.75)"}">${esc(score)}</div>
  <div style="flex:1;${NUM};font-size:22px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.away)}</div>
  <div style="width:84px;text-align:right;font:700 14px 'Segoe UI',Arial;color:${live ? "#ff4d4d" : "rgba(255,255,255,.55)"}">${live ? "● " : ""}${esc(m.detail)}</div>
</div>`;
  }).join("") : `<div style="padding:16px 20px;border-top:1px solid ${HAIR};color:rgba(255,255,255,.6);font:500 18px 'Segoe UI',Arial">Sin partidos en vivo ahora</div>`;
  const html = `<div class="nx" style="width:860px;height:${height}px;color:#fff;${FONT_TXT};background:${SURFACE};border-radius:4px;box-shadow:0 14px 36px rgba(0,0,0,.5),inset 0 0 0 1px ${HAIR};overflow:hidden">
  <div style="height:64px;display:flex;align-items:center;gap:12px;padding:0 20px;background:linear-gradient(90deg,${p.accent}33,transparent)">
    <span style="width:10px;height:10px;border-radius:50%;background:#ff3b3b;box-shadow:0 0 12px #ff3b3b"></span>
    <span style="${NUM};font-size:24px;font-weight:800;letter-spacing:.06em;text-transform:uppercase">${esc(title || "Resultados en vivo")}</span>
  </div>${body}
</div>`;
  return { html, width: 860, height };
}

function goalAlert(p: Palette, title: string, subtitle: string): DesignOutput {
  const html = `<div class="nx" style="width:900px;height:120px;display:flex;align-items:stretch;color:#fff;${FONT_TXT};background:${SURFACE};border-radius:4px;box-shadow:0 16px 40px rgba(0,0,0,.55),inset 0 0 0 1px ${p.accent}88;overflow:hidden">
  <div style="width:170px;display:grid;place-items:center;background:${p.accent};color:${onColor(p.accent)};${NUM};font-size:46px;font-weight:900;letter-spacing:.02em">¡GOL!</div>
  <div style="flex:1;padding:16px 26px;min-width:0;display:flex;flex-direction:column;justify-content:center">
    <div style="font:700 13px 'Segoe UI',Arial;letter-spacing:.2em;text-transform:uppercase;color:${p.accent}">En otro partido</div>
    <div style="${NUM};font-size:32px;font-weight:800;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(title)}</div>
    <div style="font:500 18px 'Segoe UI',Arial;color:rgba(255,255,255,.8);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(subtitle)}</div>
  </div>
</div>`;
  return { html, width: 900, height: 120 };
}

function varCheck(m: FootballScoreboard, title: string, subtitle: string): DesignOutput {
  const color = "#4cb3ff";
  const html = `<div class="nx" style="width:560px;height:88px;display:flex;align-items:center;color:#fff;${FONT_TXT};background:${SURFACE};border-radius:3px;box-shadow:0 12px 30px rgba(0,0,0,.45),inset 0 0 0 1px ${color}66;overflow:hidden">
  <div style="width:112px;align-self:stretch;display:grid;place-items:center;background:${color};color:#04121c;${NUM};font-size:44px;font-weight:800;letter-spacing:.04em">VAR</div>
  <div style="flex:1;padding:0 24px;min-width:0">${tag(`${esc(m.competition || "NEXUS")} · revisión`, color)}<div style="${NUM};font-size:26px;font-weight:700;margin-top:8px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(subtitle || title || "REVISIÓN EN CURSO")}</div></div>
</div>`;
  return { html, width: 560, height: 88 };
}

function eventBase(m: FootballScoreboard, p: Palette, accentColor: string, inner: string, width: number, height: number, side: "home" | "away"): string {
  const color = side === "home" ? p.home : p.away;
  const dark = side === "home" ? p.homeDark : p.awayDark;
  const name = side === "home" ? m.homeTeam : m.awayTeam;
  const logo = side === "home" ? m.homeLogo : m.awayLogo;
  return `<div class="nx" style="width:${width}px;height:${height}px;color:#fff;${FONT_TXT}">
  <div style="position:absolute;inset:0;background:${SURFACE};clip-path:polygon(0 0,100% 0,calc(100% - 28px) 100%,0 100%);box-shadow:0 18px 44px rgba(0,0,0,.55)"></div>
  <div style="position:absolute;left:0;top:0;width:210px;height:${height}px;background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,0) 50%),linear-gradient(120deg,${color},${dark});clip-path:polygon(0 0,100% 0,calc(100% - 44px) 100%,0 100%)"></div>
  <div style="position:absolute;left:176px;top:0;width:12px;height:${height}px;background:${accentColor};transform:skewX(-14deg);transform-origin:top left"></div>
  <div style="position:absolute;left:14px;bottom:10px;width:130px;font:700 10px 'Segoe UI',Arial;letter-spacing:.2em;text-transform:uppercase;color:${onColor(color)};opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div>
  <div style="position:absolute;right:46px;top:${Math.round((height - 76) / 2)}px;width:76px;height:76px;display:grid;place-items:center">${crest(logo, name, 66)}</div>
  ${inner}
</div>`;
}

function cardEvent(m: FootballScoreboard, p: Palette): DesignOutput {
  const h = m.highlight as NonNullable<FootballScoreboard["highlight"]>;
  const red = h.kind === "red";
  const tone = red ? "#ef4444" : "#facc15";
  const side = h.team;
  const player = h.player && h.player !== (side === "home" ? m.homeTeam : m.awayTeam) ? h.player : "";
  const dorsal = player ? dorsalOf(m, side, player) : "";
  const total = red ? (side === "home" ? m.homeRed : m.awayRed) : (side === "home" ? m.homeYellow : m.awayYellow);
  const inner = `<div style="position:absolute;left:62px;top:28px;width:64px;height:90px;background:linear-gradient(150deg,${mix(tone, [255, 255, 255], 0.35)},${tone} 55%,${darken(tone, 0.25)});border-radius:7px;transform:rotate(-9deg);box-shadow:0 10px 22px rgba(0,0,0,.5),inset 0 0 0 2px rgba(255,255,255,.35)"></div>
  <div style="position:absolute;left:236px;top:20px;right:150px">
    <div style="display:flex;align-items:center;gap:12px"><span style="font:800 13px 'Segoe UI',Arial;letter-spacing:.26em;text-transform:uppercase;color:${tone}">${red ? "Tarjeta roja" : "Tarjeta amarilla"}</span><span style="font:700 13px 'Segoe UI',Arial;letter-spacing:.1em;padding:2px 10px;background:rgba(255,255,255,.12)">${h.minute}'</span></div>
    <div style="display:flex;align-items:center;gap:14px;margin-top:12px">
      ${dorsal ? `<span style="flex:none;min-width:46px;height:46px;padding:0 6px;display:grid;place-items:center;background:${tone};color:#05070b;${FONT_NUM};font-size:24px;clip-path:polygon(7px 0,100% 0,calc(100% - 7px) 100%,0 100%)">${esc(dorsal)}</span>` : ""}
      <div style="${NUM};font-size:44px;font-weight:700;line-height:1.05;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(player || (side === "home" ? m.homeTeam : m.awayTeam))}</div>
    </div>
    <div style="margin-top:10px;font:600 13px 'Segoe UI',Arial;letter-spacing:.14em;text-transform:uppercase;opacity:.65">${red ? "Rojas" : "Amarillas"} del equipo · ${total}</div>
  </div>
  <div style="position:absolute;left:0;bottom:0;width:100%;height:4px;background:${tone}"></div>`;
  return { html: eventBase(m, p, tone, inner, 780, 150, side), width: 780, height: 150 };
}

function subEvent(m: FootballScoreboard, p: Palette): DesignOutput {
  const h = m.highlight as NonNullable<FootballScoreboard["highlight"]>;
  const side = h.team;
  const inName = h.player;
  const outName = (h.detail ?? "").replace(/^Sale\s+/i, "");
  const row = (kind: "in" | "out", name: string) => {
    const tone = kind === "in" ? "#34d399" : "#f87171";
    const dorsal = name ? dorsalOf(m, side, name) : "";
    return `<div style="height:84px;display:flex;align-items:center;gap:14px">
      <span style="width:34px;color:${tone};font-size:24px;text-align:center">${kind === "in" ? "▲" : "▼"}</span>
      <span style="width:78px;font:800 12px 'Segoe UI',Arial;letter-spacing:.24em;color:${tone}">${kind === "in" ? "ENTRA" : "SALE"}</span>
      ${dorsal ? `<span style="flex:none;min-width:40px;height:40px;padding:0 6px;display:grid;place-items:center;background:${tone};color:#05070b;${FONT_NUM};font-size:22px;clip-path:polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)">${esc(dorsal)}</span>` : ""}
      <span style="${NUM};font-size:${kind === "in" ? 38 : 30}px;font-weight:700;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${kind === "out" ? "opacity:.7" : ""}">${esc(name || "—")}</span>
    </div>`;
  };
  const inner = `<div style="position:absolute;left:34px;top:52px;width:110px;text-align:center;color:#fff"><div style="font-size:50px;line-height:1">⇄</div><div style="margin-top:8px;font:800 12px 'Segoe UI',Arial;letter-spacing:.3em">CAMBIO</div><div style="margin-top:4px;${FONT_NUM};font-size:24px">${h.minute}'</div></div>
  <div style="position:absolute;left:236px;top:6px;right:150px">${row("in", inName)}<div style="height:1px;background:rgba(255,255,255,.14)"></div>${row("out", outName)}</div>
  <div style="position:absolute;left:0;bottom:0;width:100%;height:4px;background:linear-gradient(90deg,#34d399,#f87171)"></div>`;
  return { html: eventBase(m, p, "#34d399", inner, 780, 188, side), width: 780, height: 188 };
}

function voidEvent(m: FootballScoreboard, p: Palette): DesignOutput {
  const h = m.highlight as NonNullable<FootballScoreboard["highlight"]>;
  const side = h.team;
  const tone = "#ef4444";
  const inner = `<div style="position:absolute;left:236px;right:150px;top:0;bottom:0;background:repeating-linear-gradient(135deg,rgba(239,68,68,.12) 0 10px,rgba(239,68,68,0) 10px 20px)"></div>
  <div style="position:absolute;left:236px;top:22px;right:150px">
    <div style="font:800 13px 'Segoe UI',Arial;letter-spacing:.26em;color:${tone}">REVISIÓN · MARCADOR CORREGIDO</div>
    <div style="${FONT_NUM};font-size:42px;line-height:1.05;margin-top:8px;text-transform:uppercase;font-style:italic;white-space:nowrap">GOL ANULADO</div>
    <div style="margin-top:8px;font:600 15px 'Segoe UI',Arial;letter-spacing:.12em;text-transform:uppercase;opacity:.7;text-decoration:line-through">${esc(h.player)} · ${h.minute}'</div>
  </div>
  <div style="position:absolute;left:58px;top:34px;width:84px;height:84px;display:grid;place-items:center;border-radius:50%;border:6px solid ${tone};color:${tone};font:900 52px 'Arial Black',Arial;background:rgba(0,0,0,.35)">✕</div>
  <div style="position:absolute;left:0;bottom:0;width:100%;height:4px;background:${tone}"></div>`;
  return { html: eventBase(m, p, tone, inner, 780, 150, side), width: 780, height: 150 };
}

function events(m: FootballScoreboard, p: Palette): DesignOutput {
  const h = m.highlight;
  if (h?.kind === "yellow" || h?.kind === "red") return cardEvent(m, p);
  if (h?.kind === "sub") return subEvent(m, p);
  if (h?.kind === "void") return voidEvent(m, p);
  const kind = h?.kind ?? "yellow";
  const team = h?.team ?? "home";
  const label = kind === "goal" ? "Gol" : kind === "var" ? "VAR" : "Evento";
  const inner = `<div style="position:absolute;left:236px;top:30px;right:150px"><div style="font:800 13px 'Segoe UI',Arial;letter-spacing:.26em;text-transform:uppercase;color:${p.accent}">${label}${h ? ` · ${h.minute}'` : ""}</div><div style="${NUM};font-size:40px;font-weight:700;margin-top:10px;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(h?.player || "—")}</div></div>`;
  return { html: eventBase(m, p, p.accent, inner, 780, 150, team), width: 780, height: 150 };
}

function formBadges(form: string | undefined): string {
  return (form ?? "").slice(0, 5).split("").map((r) => {
    const color = r === "W" ? "#34d399" : r === "L" ? "#f87171" : "#9ca3af";
    return `<span style="display:inline-block;width:9px;height:9px;margin:0 3px;border-radius:50%;background:${color}"></span>`;
  }).join("");
}

function panelHeader(p: Palette, label: string, right: string): string {
  return `<div style="height:40px;display:flex;align-items:center;justify-content:space-between;padding:0 22px;border-bottom:1px solid ${HAIR}"><span style="display:flex;align-items:center;gap:10px">${tag(label, "#fff")}</span><span style="display:flex;align-items:center;gap:10px"><i style="width:18px;height:2px;background:${p.accent}"></i>${tag(right, p.accent)}</span></div>`;
}

function prematch(m: FootballScoreboard, p: Palette): DesignOutput {
  const theme = getCompetition(m.competitionId ?? "custom");
  const date = m.kickoff ? new Date(m.kickoff) : null;
  const valid = date && !Number.isNaN(date.getTime());
  const day = valid ? date.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" }).toUpperCase() : "POR CONFIRMAR";
  const hour = valid ? date.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "";
  const team = (name: string, logo: string | undefined, form: string | undefined, record: string | undefined, align: "left" | "right") => `
    <div style="flex:1;display:flex;flex-direction:column;align-items:${align === "left" ? "flex-end" : "flex-start"};gap:10px">
      ${crest(logo, name, 120)}
      <div style="${NUM};font-size:30px;font-weight:700;letter-spacing:.05em;text-transform:uppercase">${esc(name)}</div>
      <div style="height:12px">${formBadges(form)}</div>
      <div style="font:500 13px 'Segoe UI',Arial;opacity:.5">${esc(record || "")}</div>
    </div>`;
  const html = `<div class="nx" style="width:980px;height:360px;color:#fff;${FONT_TXT};background:${SURFACE};border-radius:3px;box-shadow:0 18px 44px rgba(0,0,0,.5),inset 0 0 0 1px ${HAIR};overflow:hidden">
  ${panelHeader(p, "Previa", esc(m.competition || theme.short))}
  <div style="height:230px;display:flex;align-items:center;padding:0 60px;gap:40px">
    ${team(m.homeTeam, m.homeLogo, m.homeForm, m.homeRecord, "left")}
    <div style="text-align:center;width:200px"><div style="${NUM};font-size:30px;font-weight:300;letter-spacing:.3em;opacity:.6">VS</div><div style="margin:12px auto 0;width:44px;height:2px;background:${p.accent}"></div></div>
    ${team(m.awayTeam, m.awayLogo, m.awayForm, m.awayRecord, "right")}
  </div>
  <div style="height:90px;border-top:1px solid ${HAIR};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:rgba(255,255,255,.03)">
    <div style="${NUM};font-size:24px;font-weight:600;letter-spacing:.12em">${esc(day)}${hour ? ` · ${esc(hour)}` : ""}</div>
    <div style="font:500 14px 'Segoe UI',Arial;letter-spacing:.14em;text-transform:uppercase;opacity:.6">${esc([m.venue, m.city].filter(Boolean).join(" · ") || "Estadio por confirmar")}</div>
  </div>
</div>`;
  return { html, width: 980, height: 360 };
}

function formationLines(players: FootballTeamPlayer[], formation: string | undefined): number[] {
  const parsed = (formation ?? "").split(/[-–]/).map((n) => Number(n)).filter((n) => n > 0);
  if (parsed.length >= 2 && parsed.reduce((a, b) => a + b, 0) === players.filter((pl) => pl.position !== "POR").length) return parsed;
  const count = (pos: FootballTeamPlayer["position"]) => players.filter((pl) => pl.position === pos).length;
  const derived = [count("DEF"), count("MED"), count("ATA")].filter((n) => n > 0);
  return derived.length ? derived : [players.length ? players.length - 1 : 0];
}

function pitchMarkers(players: FootballTeamPlayer[], formation: string | undefined, color: string, p: Palette): string {
  const keeper = players.filter((pl) => pl.position === "POR").slice(0, 1);
  const rest = players.filter((pl) => !keeper.includes(pl));
  const order = { POR: 0, DEF: 1, MED: 2, ATA: 3 } as const;
  const outfield = [...rest].sort((a, b) => order[a.position] - order[b.position]);
  const lines = formationLines(players, formation);
  const placed: Array<{ player: FootballTeamPlayer; x: number; y: number }> = [];
  keeper.forEach((player) => placed.push({ player, x: 50, y: 91 }));
  let cursor = 0;
  lines.forEach((size, index) => {
    const y = lines.length === 1 ? 46 : 74 - index * (62 / (lines.length - 1));
    for (let j = 0; j < size && cursor < outfield.length; j += 1, cursor += 1) {
      placed.push({ player: outfield[cursor], x: ((j + 1) / (size + 1)) * 84 + 8, y });
    }
  });
  const ink = onColor(color);
  return placed.map(({ player, x, y }) => `<div style="position:absolute;left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;width:110px;margin-left:-55px;margin-top:-26px;display:flex;flex-direction:column;align-items:center">
    <div style="position:relative;width:46px;height:46px;border-radius:50%;background:linear-gradient(160deg,${mix(color, [255, 255, 255], 0.2)},${color});border:3px solid #fff;display:grid;place-items:center;color:${ink};${FONT_NUM};font-size:20px;box-shadow:0 6px 12px rgba(0,0,0,.45)">${player.dorsal || ""}${player.captain ? `<i style="position:absolute;right:-8px;top:-8px;width:18px;height:18px;border-radius:50%;background:${p.accent};color:${onColor(p.accent)};font:900 11px/18px Arial;text-align:center;font-style:normal">C</i>` : ""}</div>
    <div style="margin-top:5px;max-width:110px;padding:2px 8px;background:rgba(5,7,11,.82);font:800 12px 'Segoe UI',Arial;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(surname(player.name))}</div>
  </div>`).join("");
}

function lineup(m: FootballScoreboard, p: Palette, side: "home" | "away"): DesignOutput {
  const all = m.lineups?.[side] ?? [];
  const starters = all.filter((player) => player.starter).slice(0, 11);
  const bench = all.filter((player) => !player.starter).slice(0, 9);
  const color = side === "home" ? p.home : p.away;
  const dark = side === "home" ? p.homeDark : p.awayDark;
  const name = side === "home" ? m.homeTeam : m.awayTeam;
  const logo = side === "home" ? m.homeLogo : m.awayLogo;
  const formation = side === "home" ? m.formationHome : m.formationAway;
  const line = "rgba(255,255,255,.5)";
  const pitch = `<div style="position:relative;height:600px;overflow:hidden;background:repeating-linear-gradient(180deg,#17663a 0 50px,#1b7340 50px 100px)">
    <div style="position:absolute;left:18px;right:18px;top:18px;bottom:18px;border:2px solid ${line}"></div>
    <div style="position:absolute;left:18px;right:18px;top:299px;height:2px;background:${line}"></div>
    <div style="position:absolute;left:215px;top:245px;width:130px;height:130px;border:2px solid ${line};border-radius:50%"></div>
    <div style="position:absolute;left:165px;top:18px;width:230px;height:92px;border:2px solid ${line};border-top:0"></div>
    <div style="position:absolute;left:225px;top:18px;width:110px;height:38px;border:2px solid ${line};border-top:0"></div>
    <div style="position:absolute;left:165px;bottom:18px;width:230px;height:92px;border:2px solid ${line};border-bottom:0"></div>
    <div style="position:absolute;left:225px;bottom:18px;width:110px;height:38px;border:2px solid ${line};border-bottom:0"></div>
    ${starters.length ? pitchMarkers(starters, formation, color, p) : `<div style="position:absolute;inset:0;display:grid;place-items:center;font:700 18px 'Segoe UI',Arial;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.8)">Alineación por confirmar</div>`}
  </div>`;
  const chips = bench.length
    ? bench.map((player) => `<span style="display:inline-flex;align-items:center;gap:6px;margin:0 6px 6px 0;padding:3px 10px;background:rgba(255,255,255,.08);font:700 12px 'Segoe UI',Arial;letter-spacing:.04em;text-transform:uppercase"><b style="color:${p.accent};${NUM}">${player.dorsal || ""}</b>${esc(surname(player.name))}</span>`).join("")
    : `<span style="font:500 12px 'Segoe UI',Arial;opacity:.5">Banco por confirmar</span>`;
  const html = `<div class="nx" style="width:560px;height:772px;color:#fff;${FONT_TXT};background:${SURFACE};box-shadow:0 22px 54px rgba(0,0,0,.55);overflow:hidden">
  <div style="height:88px;display:flex;align-items:center;gap:16px;padding:0 24px;background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,0) 50%),linear-gradient(100deg,${color},${dark});color:${onColor(color)}">
    ${crest(logo, name, 56)}
    <div style="flex:1;min-width:0"><div style="${FONT_NUM};font-size:28px;letter-spacing:.03em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(name)}</div><div style="margin-top:5px;font:700 11px 'Segoe UI',Arial;letter-spacing:.26em;text-transform:uppercase;opacity:.85">Alineación titular</div></div>
    <div style="padding:6px 14px;background:rgba(0,0,0,.45);${FONT_NUM};font-size:22px;letter-spacing:.06em;color:#fff;border-bottom:3px solid ${p.accent}">${esc(formation || "—")}</div>
  </div>
  ${pitch}
  <div style="height:84px;padding:10px 20px 0">${tag("Banco", p.accent)}<div style="margin-top:6px;max-height:52px;overflow:hidden">${chips}</div></div>
</div>`;
  return { html, width: 560, height: 772 };
}

function previewRows(m: FootballScoreboard): Array<{ label: string; home: number; away: number }> {
  const pv = m.preview;
  if (!pv) return [];
  const wins = (list: Array<{ result: string }>) => list.filter((game) => game.result === "W").length;
  const goals = (list: Array<{ score: string; home: boolean; result: string }>) => list.reduce((sum, game) => {
    const [a, b] = game.score.split("-").map((n) => Number(n) || 0);
    return sum + Math.max(a, b) * (game.result === "L" ? 0 : 1) + Math.min(a, b) * (game.result === "L" ? 1 : 0);
  }, 0);
  const rows: Array<{ label: string; home: number; away: number }> = [];
  if (pv.odds) rows.push({ label: "Probabilidad %", home: pv.odds.home, away: pv.odds.away });
  if (pv.lastFive.home.length || pv.lastFive.away.length) {
    rows.push({ label: "Victorias (últ. 5)", home: wins(pv.lastFive.home), away: wins(pv.lastFive.away) });
    rows.push({ label: "Goles a favor (últ. 5)", home: goals(pv.lastFive.home), away: goals(pv.lastFive.away) });
  }
  return rows;
}

function stats(m: FootballScoreboard, p: Palette): DesignOutput {
  const fallback = m.period === "PRE" ? previewRows(m) : [];
  const list = (m.stats?.length ? m.stats : fallback.length ? fallback : [
    { label: "Posesión %", home: m.homePossession ?? 50, away: m.awayPossession ?? 50 },
    { label: "Remates", home: m.homeShots ?? 0, away: m.awayShots ?? 0 },
  ]).slice(0, 8);
  const rows = list.map((item) => {
    const total = item.home + item.away || 1;
    return `<div style="height:54px;padding-top:8px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="${NUM};font-size:24px;font-weight:700">${item.home}</span><span style="font:500 12px 'Segoe UI',Arial;letter-spacing:.2em;text-transform:uppercase;opacity:.6">${esc(item.label)}</span><span style="${NUM};font-size:24px;font-weight:700">${item.away}</span></div>
      <div style="display:flex;gap:4px;margin-top:6px;height:3px"><div style="flex:${item.home / total};background:${p.home};min-width:2px"></div><div style="flex:${item.away / total};background:${p.away};min-width:2px"></div></div></div>`;
  }).join("");
  const height = 96 + list.length * 54 + 14;
  const phase = m.period === "PRE" ? "Previa" : m.period === "FT" ? "Final" : "Estadísticas";
  const html = `<div class="nx" style="width:620px;height:${height}px;color:#fff;${FONT_TXT};background:${SURFACE};border-radius:3px;box-shadow:0 18px 44px rgba(0,0,0,.5),inset 0 0 0 1px ${HAIR};overflow:hidden">
  <div style="height:82px;display:flex;align-items:center;justify-content:space-between;padding:0 26px;border-bottom:1px solid ${HAIR}">${crest(m.homeLogo, m.homeTeam, 48)}<div style="text-align:center">${tag(phase, p.accent)}<div style="${NUM};font-size:34px;font-weight:700;margin-top:3px">${m.homeScore}<span style="margin:0 12px;opacity:.4">–</span>${m.awayScore}</div></div>${crest(m.awayLogo, m.awayTeam, 48)}</div>
  <div style="padding:2px 26px">${rows}</div>
</div>`;
  return { html, width: 620, height };
}

// El render es síncrono: las preferencias del constructor se aplican con banderas de módulo.
let hideCards = false;
let hideCompetition = false;

export function renderFootballDesign(variant: GraphicVariant, source: FootballScoreboard, title = "", subtitle = "", style?: DesignStyle): DesignOutput {
  const match = style
    ? { ...source, homeColor: style.homeColor ?? source.homeColor, awayColor: style.awayColor ?? source.awayColor, accent2: style.accent ?? source.accent2 }
    : source;
  hideCards = style?.showCards === false;
  hideCompetition = style?.showCompetition === false;
  try {
    return renderBase(variant, match, title, subtitle);
  } finally {
    hideCards = false;
    hideCompetition = false;
  }
}

function renderBase(variant: GraphicVariant, match: FootballScoreboard, title: string, subtitle: string): DesignOutput {
  const p = palette(match);
  switch (variant) {
    case "compact": return compact(match, p);
    case "editorial": return editorial(match, p);
    case "live": return live(match, p);
    case "goal": return goal(match, p);
    case "lower": return lower(p, title, subtitle);
    case "var": return varCheck(match, title, subtitle);
    case "events": return events(match, p);
    case "prematch": return prematch(match, p);
    case "lineup-home": return lineup(match, p, "home");
    case "lineup-away": return lineup(match, p, "away");
    case "stats": return stats(match, p);
    case "multi": return multi(p, title);
    case "goal-alert": return goalAlert(p, title, subtitle);
    default: return elite(match, p);
  }
}

export const FOOTBALL_VARIANT_LABEL: Record<string, string> = {
  elite: "Marcador Élite",
  compact: "Marcador Compacto",
  editorial: "Marcador Editorial",
  live: "Barra En Vivo",
  goal: "Gol",
  lower: "Jugador (lower third)",
  var: "VAR",
  events: "Evento (tarjeta/cambio)",
  prematch: "Previa del partido",
  "lineup-home": "Alineación local",
  "lineup-away": "Alineación visitante",
  stats: "Estadísticas",
  multi: "Resultados en vivo (multipantalla)",
  "goal-alert": "Alerta de gol (otros partidos)",
};

export function footballDesignDocument(design: DesignOutput, position: { x: number; y: number }, scale: number): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>NEXUS</title><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:transparent;overflow:hidden}
.stage{position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0}
.slot{position:absolute;left:${(position.x / 100) * 1920}px;top:${(position.y / 100) * 1080}px;transform:scale(${scale});transform-origin:top left;animation:nx-in .45s cubic-bezier(.2,.9,.2,1) both}
.nx{position:relative;overflow:visible}
@keyframes nx-in{from{opacity:0;transform:translateY(-16px) scale(${scale})}to{opacity:1;transform:translateY(0) scale(${scale})}}
@media(prefers-reduced-motion:reduce){.slot{animation:none}}
</style></head><body><div class="stage"><div class="slot">${design.html}</div></div>
<script>(function(){var s=document.querySelector('.stage');function f(){s.style.transform='scale('+innerWidth/1920+')'}f();addEventListener('resize',f)})()</script></body></html>`;
}
