import type { Slide as RecapSlide, RecapMatch } from "./recap";
import type { BookingCard, Duel, PollResult, SubCard, Timeline } from "./eventGraphics";
import type { DesignStyle, FootballScoreboard, FootballTeamPlayer, GraphicVariant } from "../graphicExport";
import { COMPETITIONS, getCompetition } from "./competitions";

export interface DesignOutput {
  html: string;
  width: number;
  height: number;
}

export const FOOTBALL_VARIANTS: GraphicVariant[] = ["elite", "compact", "editorial", "live", "goal", "lower", "var", "events", "prematch", "lineup-home", "lineup-away", "stats", "multi", "goal-alert", "poll", "dato", "pro", "goal-pro", "cinta", "recap", "ad", "sub", "card", "timeline", "duel", "poll-result"];

/** Other matches shown at once by the "multi" panel (fed by useLiveBoard). */
export interface MultiScore {
  id: string; league: string; leagueSlug?: string; home: string; away: string; homeShort?: string; awayShort?: string;
  homeLogo?: string; awayLogo?: string; homeScore: number | null; awayScore: number | null;
  status: "live" | "halftime" | "finished" | "scheduled"; detail: string;
  /** Something just happened here (shown for ~60 s). */
  flash?: { kind: "goal" | "red"; text: string; side: "home" | "away" | null } | null;
}
let multiScores: MultiScore[] = [];
let multiVersion = 0;
export function setMultiScores(list: MultiScore[]) {
  const next = JSON.stringify(list);
  if (next === JSON.stringify(multiScores)) return;
  multiScores = list;
  multiVersion += 1;
}
export const getMultiVersion = () => multiVersion;

/** Poll shown on air (one at a time), refreshed while viewers vote on the portal. */
export interface PollBoard { kind: "poll" | "debate"; question: string; options: { label: string; votes: number }[]; total: number }
let pollBoard: PollBoard | null = null;
/** The goal shown by "goal-pro" (main match or any other match). */
export interface GoalCard { teamName: string; teamLogo?: string; teamColor?: string; scorer: string; minute: string; assist?: string; score: string; competition?: string; fact?: string }
let goalCard: GoalCard | null = null;
export function setGoalCard(card: GoalCard | null) {
  goalCard = card;
  multiVersion += 1;
}

/** Automatic show: the slide on screen + crests as data URLs (keyed by the remote URL). */
let recapSlide: RecapSlide | null = null;
let recapLogos: Record<string, string> = {};
let recapStep = "";
export function setRecapSlide(slide: RecapSlide | null, logos: Record<string, string> = recapLogos, step = "") {
  recapSlide = slide;
  recapLogos = logos;
  recapStep = step;
  multiVersion += 1;
}

/** Advertising box shown next to the show (image as data URL). */
let adImage: { src: string; name: string } | null = null;
export function setAdImage(ad: { src: string; name: string } | null) { adImage = ad; multiVersion += 1; }
/** Own messages for the ticker ("Síguenos en…", promos). */
let cintaExtra: string[] = [];
export function setCintaExtra(lines: string[]) {
  const next = lines.map((l) => l.trim()).filter(Boolean).slice(0, 10);
  if (JSON.stringify(next) === JSON.stringify(cintaExtra)) return;
  cintaExtra = next;
  multiVersion += 1;
}

/** Running data bar ("cinta"): pages rotate (advanceCinta) through scores and facts. */
let cintaPage = 0;
let cintaFacts: string[] = [];
export function advanceCinta() { cintaPage += 1; multiVersion += 1; }
export function setCintaFacts(facts: string[]) {
  const next = facts.filter(Boolean).slice(0, 8);
  if (JSON.stringify(next) === JSON.stringify(cintaFacts)) return;
  cintaFacts = next;
  multiVersion += 1;
}

/** Data of the Phase 3 graphics, keyed by the graphic's title ("gfx:…"), so Preview and Program can differ. */
const graphicData = new Map<string, unknown>();
export function setGraphicData(key: string, data: unknown) {
  graphicData.set(key, data);
  if (graphicData.size > 60) graphicData.delete(graphicData.keys().next().value as string);
  multiVersion += 1;
}
export const getPollBoard = () => pollBoard;

export function setPollBoard(board: PollBoard | null) {
  const next = JSON.stringify(board);
  if (next === JSON.stringify(pollBoard)) return;
  pollBoard = board;
  multiVersion += 1;
}

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

const UCL_STARS = "radial-gradient(circle at 12% 30%,rgba(255,255,255,.55) 0 1.5px,transparent 2px),radial-gradient(circle at 34% 70%,rgba(255,255,255,.35) 0 1px,transparent 1.5px),radial-gradient(circle at 62% 25%,rgba(255,255,255,.45) 0 1.5px,transparent 2px),radial-gradient(circle at 86% 65%,rgba(255,255,255,.35) 0 1px,transparent 1.5px)";

function multiTheme(rows: MultiScore[]): { name: string; bg: string; accent: string; text: string } {
  const slugs = new Set(rows.map((r) => r.leagueSlug).filter(Boolean));
  if (slugs.size === 1) {
    const theme = COMPETITIONS.find((c) => c.espn === [...slugs][0]);
    if (theme?.id === "champions") return { name: "UEFA CHAMPIONS LEAGUE", bg: `${UCL_STARS},linear-gradient(100deg,#040a22 0%,#0b1f63 55%,#132f8f 100%)`, accent: "#9fc0ff", text: "#e8eeff" };
    if (theme) return { name: theme.name.toUpperCase(), bg: `linear-gradient(100deg,${theme.bg} 0%,${theme.accent}33 100%)`, accent: theme.accent, text: "#ffffff" };
  }
  return { name: "NEXUS · JORNADA", bg: "linear-gradient(100deg,#0b0d12 0%,#facc1526 100%)", accent: "#facc15", text: "#ffffff" };
}

function multiCrest(src: string | undefined, label: string, size: number): string {
  return src
    ? `<img src="${esc(src)}" alt="" style="width:${size}px;height:${size}px;object-fit:contain;filter:drop-shadow(0 3px 5px rgba(0,0,0,.6))" />`
    : `<span style="width:${size}px;height:${size}px;border-radius:50%;display:inline-grid;place-items:center;background:rgba(255,255,255,.12);${NUM};font-size:${Math.round(size * 0.36)}px;font-weight:800">${esc(label.slice(0, 2).toUpperCase())}</span>`;
}

function statusPill(m: MultiScore, big: boolean): string {
  const live = m.status === "live" || m.status === "halftime";
  const color = live ? "#ff3b3b" : "rgba(255,255,255,.18)";
  return `<span style="display:inline-flex;align-items:center;gap:6px;padding:${big ? "5px 12px" : "3px 9px"};border-radius:999px;background:${live ? "rgba(255,59,59,.16)" : "rgba(255,255,255,.08)"};box-shadow:inset 0 0 0 1px ${color};font:800 ${big ? 16 : 13}px 'Segoe UI',Arial;color:${live ? "#ff6b6b" : "rgba(255,255,255,.7)"}">${live ? `<i style="width:8px;height:8px;border-radius:50%;background:#ff3b3b;display:inline-block"></i>` : ""}${esc(m.detail)}</span>`;
}

function flashStrip(m: MultiScore, accent: string, big: boolean): string {
  if (!m.flash) return "";
  const bg = m.flash.kind === "red" ? "#e11d2e" : accent;
  return `<div style="display:flex;align-items:center;gap:10px;padding:${big ? "8px 18px" : "5px 12px"};background:${bg};color:${onColor(bg)};${NUM};font-size:${big ? 20 : 15}px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.flash.kind === "red" ? "🟥 ROJA" : "⚽ GOL"} · ${esc(m.flash.text)}</div>`;
}

function multi(_p: Palette, title: string): DesignOutput {
  const rows = multiScores.slice(0, 10);
  const theme = multiTheme(rows);
  const mixed = new Set(rows.map((r) => r.leagueSlug)).size > 1;
  const header = `<div style="height:70px;display:flex;align-items:center;gap:14px;padding:0 26px;background:${theme.bg};border-bottom:2px solid ${theme.accent}">
    <span style="width:12px;height:12px;border-radius:50%;background:#ff3b3b;box-shadow:0 0 14px #ff3b3b"></span>
    <span style="${NUM};font-size:26px;font-weight:800;letter-spacing:.08em;color:${theme.text}">${esc(title && title !== "Resultados en vivo" ? title.toUpperCase() : theme.name)}</span>
    <span style="margin-left:auto;font:700 14px 'Segoe UI',Arial;letter-spacing:.2em;color:${theme.accent}">EN VIVO</span>
  </div>`;
  if (!rows.length) {
    const html = `<div class="nx" style="width:900px;color:#fff;${FONT_TXT};background:${SURFACE};border-radius:6px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.55)">${header}<div style="padding:22px 26px;font:500 20px 'Segoe UI',Arial;color:rgba(255,255,255,.7)">Sin partidos en vivo ahora · elígelos en «Partidos de hoy» (botón Multi)</div></div>`;
    return { html, width: 900, height: 140 };
  }
  if (rows.length <= 2) {
    const tile = (m: MultiScore) => {
      const glow = m.flash ? `box-shadow:0 0 0 3px ${m.flash.kind === "red" ? "#e11d2e" : theme.accent},0 0 36px ${m.flash.kind === "red" ? "#e11d2e" : theme.accent}88;` : `box-shadow:inset 0 0 0 1px ${HAIR};`;
      const side = (name: string, logo: string | undefined, scored: boolean, align: "left" | "right") => `<div style="flex:1;display:flex;align-items:center;gap:16px;${align === "right" ? "flex-direction:row-reverse;text-align:right" : ""}">
        ${multiCrest(logo, name, 70)}<span style="${NUM};font-size:32px;font-weight:800;line-height:1.05;${scored ? `color:${theme.accent}` : ""}">${esc(name)}</span></div>`;
      return `<div style="border-radius:6px;overflow:hidden;background:rgba(255,255,255,.04);${glow}">
        <div style="display:flex;align-items:center;gap:20px;padding:20px 26px">
          ${side(m.home, m.homeLogo, m.flash?.side === "home", "left")}
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px;min-width:200px">
            <span style="${NUM};font-size:64px;font-weight:900;line-height:1;letter-spacing:.02em">${m.homeScore === null ? "vs" : `${m.homeScore}<span style="opacity:.4;margin:0 12px">-</span>${m.awayScore}`}</span>
            ${statusPill(m, true)}
          </div>
          ${side(m.away, m.awayLogo, m.flash?.side === "away", "right")}
        </div>
        ${mixed ? `<div style="padding:0 26px 12px;font:600 13px 'Segoe UI',Arial;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.5)">${esc(m.league)}</div>` : ""}
        ${flashStrip(m, theme.accent, true)}
      </div>`;
    };
    const height = 70 + rows.length * 150 + (rows.length + 1) * 16 + (rows.some((r) => r.flash) ? 40 : 0) + (mixed ? rows.length * 24 : 0);
    const html = `<div class="nx" style="width:1240px;color:#fff;${FONT_TXT};background:${SURFACE};border-radius:8px;overflow:hidden;box-shadow:0 18px 46px rgba(0,0,0,.6),inset 0 0 0 1px ${HAIR}">${header}
      <div style="display:flex;flex-direction:column;gap:16px;padding:16px">${rows.map(tile).join("")}</div></div>`;
    return { html, width: 1240, height };
  }
  const tile = (m: MultiScore) => {
    const accent = m.flash?.kind === "red" ? "#e11d2e" : theme.accent;
    const glow = m.flash ? `box-shadow:0 0 0 2px ${accent},0 0 26px ${accent}77;background:${accent}14;` : `box-shadow:inset 0 0 0 1px ${HAIR};background:rgba(255,255,255,.035);`;
    const name = (full: string, short?: string) => esc((short || full).slice(0, 14));
    return `<div style="border-radius:6px;overflow:hidden;${glow}">
      <div style="display:flex;align-items:center;gap:10px;height:84px;padding:0 14px">
        ${multiCrest(m.homeLogo, m.home, 40)}
        <span style="flex:1;${NUM};font-size:22px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${m.flash?.side === "home" ? `color:${accent}` : ""}">${name(m.home, m.homeShort)}</span>
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:104px">
          <span style="${NUM};font-size:36px;font-weight:900;line-height:1">${m.homeScore === null ? "vs" : `${m.homeScore}-${m.awayScore}`}</span>
          ${statusPill(m, false)}
        </div>
        <span style="flex:1;text-align:right;${NUM};font-size:22px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${m.flash?.side === "away" ? `color:${accent}` : ""}">${name(m.away, m.awayShort)}</span>
        ${multiCrest(m.awayLogo, m.away, 40)}
      </div>
      ${mixed ? `<div style="padding:0 14px 8px;font:600 11px 'Segoe UI',Arial;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.45)">${esc(m.league)}</div>` : ""}
      ${flashStrip(m, theme.accent, false)}
    </div>`;
  };
  const lines = Math.ceil(rows.length / 2);
  const tileH = 84 + (mixed ? 24 : 0);
  const flashLines = Array.from({ length: lines }, (_, i) => rows.slice(i * 2, i * 2 + 2).some((r) => r.flash)).filter(Boolean).length;
  const height = 70 + 16 + lines * tileH + (lines - 1) * 12 + 16 + flashLines * 30;
  const html = `<div class="nx" style="width:1240px;color:#fff;${FONT_TXT};background:${SURFACE};border-radius:8px;overflow:hidden;box-shadow:0 18px 46px rgba(0,0,0,.6),inset 0 0 0 1px ${HAIR}">${header}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px">${rows.map(tile).join("")}</div></div>`;
  return { html, width: 1240, height };
}

function pollDesign(p: Palette, footer: string): DesignOutput {
  const board = pollBoard;
  if (!board) {
    return { html: `<div class="nx" style="width:760px;height:90px;display:grid;place-items:center;color:#fff;${FONT_TXT};background:${SURFACE};border-radius:6px">Elige una encuesta en Análisis</div>`, width: 760, height: 90 };
  }
  const pct = (v: number) => (board.total ? Math.round((v / board.total) * 100) : 0);
  const head = `<div style="padding:18px 26px 6px">
    <div style="display:flex;align-items:center;gap:10px;font:800 13px 'Segoe UI',Arial;letter-spacing:.22em;color:${p.accent}"><i style="width:9px;height:9px;border-radius:50%;background:#ff3b3b;display:inline-block"></i>${board.kind === "debate" ? "DEBATE EN VIVO" : "VOTA EN VIVO"}</div>
    <div style="${NUM};font-size:34px;font-weight:800;line-height:1.12;margin-top:8px">${esc(board.question)}</div>
  </div>`;
  const foot = `<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 26px 16px;font:600 16px 'Segoe UI',Arial;color:rgba(255,255,255,.7)"><span>${board.total.toLocaleString("es")} votos</span><span style="color:${p.accent};font-weight:800">${esc(footer || "Vota en nuestro portal")}</span></div>`;
  if (board.kind === "debate" && board.options.length === 2) {
    const [a, b] = board.options;
    const pa = pct(a.votes);
    const body = `<div style="padding:10px 26px 4px">
      <div style="display:flex;justify-content:space-between;${NUM};font-size:26px;font-weight:800"><span style="color:#5bb6ff">${esc(a.label)}</span><span style="color:#ff6b7d">${esc(b.label)}</span></div>
      <div style="display:flex;height:26px;margin-top:10px;border-radius:999px;overflow:hidden;background:#ff6b7d"><div style="width:${pa}%;background:#5bb6ff"></div></div>
      <div style="display:flex;justify-content:space-between;margin-top:8px;${NUM};font-size:44px;font-weight:900"><span>${pa}%</span><span>${100 - pa}%</span></div>
    </div>`;
    const html = `<div class="nx" style="width:920px;color:#fff;${FONT_TXT};background:${SURFACE};border-radius:8px;overflow:hidden;box-shadow:0 18px 44px rgba(0,0,0,.6),inset 0 0 0 1px ${HAIR}">${head}${body}${foot}</div>`;
    return { html, width: 920, height: 330 };
  }
  const leader = Math.max(...board.options.map((o) => o.votes));
  const rows = board.options.slice(0, 5).map((o) => {
    const v = pct(o.votes);
    const lead = board.total > 0 && o.votes === leader;
    return `<div style="position:relative;margin:8px 26px;height:54px;border-radius:6px;overflow:hidden;background:rgba(255,255,255,.06)">
      <div style="position:absolute;inset:0;width:${v}%;background:${lead ? p.accent : "rgba(255,255,255,.18)"};opacity:${lead ? 0.9 : 1}"></div>
      <div style="position:relative;display:flex;justify-content:space-between;align-items:center;height:100%;padding:0 18px;${NUM};font-size:24px;font-weight:800;color:${lead ? onColor(p.accent) : "#fff"}"><span>${esc(o.label)}</span><span>${v}%</span></div>
    </div>`;
  }).join("");
  const height = 120 + Math.min(5, board.options.length) * 62 + 56;
  const html = `<div class="nx" style="width:860px;color:#fff;${FONT_TXT};background:${SURFACE};border-radius:8px;overflow:hidden;box-shadow:0 18px 44px rgba(0,0,0,.6),inset 0 0 0 1px ${HAIR}">${head}${rows}${foot}</div>`;
  return { html, width: 860, height };
}

function proClock(m: FootballScoreboard): string {
  if (m.period === "PRE") return "PREVIA";
  if (m.period === "HT") return "ENTRETIEMPO";
  if (m.period === "FT") return "FINAL";
  if (m.period === "PEN") return "PENALES";
  const min = Math.floor(m.clockSeconds / 60);
  const sec = String(m.clockSeconds % 60).padStart(2, "0");
  return `${String(min).padStart(2, "0")}:${sec}`;
}

function proBoard(m: FootballScoreboard, p: Palette): DesignOutput {
  const ucl = m.competitionId === "champions";
  const bg = ucl ? `${UCL_STARS},linear-gradient(100deg,#040a22,#0d2370)` : `linear-gradient(100deg,${SURFACE},rgba(20,24,32,.96))`;
  const accent = ucl ? "#c9d6ff" : p.accent;
  const side = (name: string, short: string | undefined, logo: string | undefined, color: string, align: "l" | "r") => `
    <div style="display:flex;align-items:center;gap:12px;${align === "r" ? "flex-direction:row-reverse" : ""};padding:0 16px;height:100%;background:linear-gradient(${align === "l" ? "90deg" : "270deg"},${color}55,transparent)">
      ${logo ? `<img src="${esc(logo)}" alt="" style="width:46px;height:46px;object-fit:contain;filter:drop-shadow(0 3px 5px rgba(0,0,0,.6))" />` : `<span style="width:12px;height:42px;background:${color};border-radius:2px"></span>`}
      <span style="${NUM};font-size:30px;font-weight:800;letter-spacing:.04em">${abbr(name, short)}</span>
    </div>`;
  const cardsFor = (y: number, r: number) => cards(y, r);
  const html = `<div class="nx" style="width:640px;color:#fff;${FONT_TXT};filter:drop-shadow(0 14px 30px rgba(0,0,0,.55))">
  <div style="display:flex;align-items:center;height:28px;padding:0 14px;background:${ucl ? "#0b1a55" : "rgba(0,0,0,.75)"};border-radius:8px 8px 0 0;border:1px solid ${accent}55;border-bottom:none;width:fit-content;gap:10px">
    <span style="font:800 12px 'Segoe UI',Arial;letter-spacing:.22em;color:${accent}">${esc((m.competition || "NEXUS").toUpperCase())}</span>
  </div>
  <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;height:72px;background:${bg};border:1px solid ${accent}44;border-radius:0 10px 10px 10px;overflow:hidden">
    ${side(m.homeTeam, m.homeShort, m.homeLogo, isHex(m.homeColor) ? m.homeColor! : "#1f3a8a", "l")}
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 18px;height:100%;background:${ucl ? "#ffffff" : p.accent};color:${ucl ? "#0b1a55" : onColor(p.accent)}">
      <span style="${NUM};font-size:40px;font-weight:900;line-height:1;letter-spacing:.04em">${m.homeScore}<span style="opacity:.5;margin:0 8px">-</span>${m.awayScore}</span>
    </div>
    ${side(m.awayTeam, m.awayShort, m.awayLogo, isHex(m.awayColor) ? m.awayColor! : "#7f1d1d", "r")}
  </div>
  <div style="display:flex;align-items:center;gap:10px;margin-top:6px">
    <span style="display:inline-flex;align-items:center;gap:7px;padding:4px 12px;border-radius:999px;background:${m.period === "FT" ? "rgba(255,255,255,.15)" : "#e11d2e"};${NUM};font-size:17px;font-weight:800;letter-spacing:.06em">${m.period !== "FT" && m.period !== "PRE" && m.period !== "HT" ? `<i style="width:8px;height:8px;border-radius:50%;background:#fff;display:inline-block"></i>` : ""}${proClock(m)}${m.addedTime ? ` <span style="color:#ffd84d">+${m.addedTime}</span>` : ""}</span>
    <span style="display:inline-flex;align-items:center">${cardsFor(m.homeYellow, m.homeRed)}</span>
    <span style="margin-left:auto;display:inline-flex;align-items:center">${cardsFor(m.awayYellow, m.awayRed)}</span>
  </div>
</div>`;
  return { html, width: 640, height: 150 };
}

function goalPro(p: Palette): DesignOutput {
  const g = goalCard;
  if (!g) {
    return { html: `<div class="nx" style="width:1180px;height:196px;display:grid;place-items:center;color:rgba(255,255,255,.7);${FONT_TXT};font-size:28px;background:${SURFACE};border-radius:10px;box-shadow:inset 0 0 0 2px ${p.accent}">Sale solo cuando hay un gol</div>`, width: 1180, height: 196 };
  }
  const color = isHex(g.teamColor) ? g.teamColor! : p.accent;
  const html = `<div class="nx" style="width:1180px;color:#fff;${FONT_TXT};filter:drop-shadow(0 18px 40px rgba(0,0,0,.6))">
  <div style="display:flex;align-items:stretch;height:190px;border-radius:10px;overflow:hidden;background:${SURFACE};box-shadow:inset 0 0 0 2px ${p.accent}">
    <div style="width:210px;display:grid;place-items:center;background:linear-gradient(135deg,${color},${color}55)">
      ${g.teamLogo ? `<img src="${esc(g.teamLogo)}" alt="" style="width:150px;height:150px;object-fit:contain;filter:drop-shadow(0 6px 10px rgba(0,0,0,.6))" />` : `<span style="${NUM};font-size:64px;font-weight:900">${esc(g.teamName.slice(0, 3).toUpperCase())}</span>`}
    </div>
    <div style="flex:1;min-width:0;padding:20px 28px;display:flex;flex-direction:column;justify-content:center">
      <div style="display:flex;align-items:center;gap:14px">
        <span style="${NUM};font-size:58px;font-weight:900;letter-spacing:.04em;color:${p.accent};line-height:1">¡GOOOL!</span>
        <span style="font:800 15px 'Segoe UI',Arial;letter-spacing:.2em;text-transform:uppercase;color:rgba(255,255,255,.7)">${esc(g.teamName)}${g.competition ? ` · ${esc(g.competition)}` : ""}</span>
      </div>
      <div style="${NUM};font-size:44px;font-weight:800;margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(g.scorer || g.teamName)}</div>
      <div style="font:600 19px 'Segoe UI',Arial;color:rgba(255,255,255,.8);margin-top:4px">Min ${esc(g.minute)}${g.assist ? ` · ${esc(g.assist)}` : ""}</div>
    </div>
    <div style="width:190px;display:grid;place-items:center;background:${p.accent};color:${onColor(p.accent)}">
      <span style="${NUM};font-size:66px;font-weight:900;letter-spacing:.02em">${esc(g.score)}</span>
    </div>
  </div>
  ${g.fact ? `<div style="margin-top:8px;padding:12px 22px;border-radius:8px;background:${SURFACE};box-shadow:inset 4px 0 0 ${p.accent};font:600 21px 'Segoe UI',Arial;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📊 ${esc(g.fact)}</div>` : ""}
</div>`;
  return { html, width: 1180, height: g.fact ? 262 : 196 };
}

const RECAP_ACCENT: Record<string, string> = { "uefa.champions": "#9cc0ff", "col.1": "#ffd400", "conmebol.libertadores": "#f5c542", "conmebol.sudamericana": "#4fc3f7", "uefa.europa": "#ff8a00" };

// ---------------------------------------------------------------- Phase 3 graphics
const crestImg = (src: string | undefined, label: string, size: number) => multiCrest(safeSrc(src) || undefined, label, size);
const teamTint = (c: string | undefined, fallback: string) => (isHex(c) && luminance(c!) > 0.08 ? c! : fallback);
const empty = (w: number, h: number, text: string) => ({ html: `<div class="nx" style="width:${w}px;height:${h}px;display:grid;place-items:center;color:rgba(255,255,255,.7);${FONT_TXT};font-size:24px;background:${SURFACE};border-radius:10px">${esc(text)}</div>`, width: w, height: h });

function subCard(d: SubCard | undefined, p: Palette): DesignOutput {
  const W = 1000; const H = 172;
  if (!d) return empty(W, H, "Cambio: sin datos del partido");
  const tint = teamTint(d.team.color, p.accent);
  const row = (dir: "in" | "out", name: string) => `<div style="display:flex;align-items:center;gap:14px">
      <span style="width:30px;height:30px;border-radius:6px;display:grid;place-items:center;background:${dir === "in" ? "#16a34a" : "#dc2626"};font:900 18px 'Segoe UI',Arial">${dir === "in" ? "▲" : "▼"}</span>
      <span style="font:800 13px 'Segoe UI',Arial;letter-spacing:.2em;color:rgba(255,255,255,.6);width:64px">${dir === "in" ? "ENTRA" : "SALE"}</span>
      <span style="${NUM};font-size:${dir === "in" ? 36 : 28}px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${dir === "out" ? "color:rgba(255,255,255,.75)" : ""}">${esc(name)}</span></div>`;
  const html = `<div class="nx" style="width:${W}px;height:${H}px;display:flex;color:#fff;${FONT_TXT};border-radius:10px;overflow:hidden;background:${SURFACE};box-shadow:0 18px 40px rgba(0,0,0,.55),inset 0 0 0 2px ${p.accent}55">
    <div style="width:170px;flex-shrink:0;display:grid;place-items:center;background:linear-gradient(135deg,${tint},${tint}55)">${crestImg(d.team.logo, d.team.short, 120)}</div>
    <div style="flex:1;min-width:0;padding:16px 26px;display:flex;flex-direction:column;justify-content:center;gap:8px">
      <div style="display:flex;align-items:center;gap:12px;font:800 15px 'Segoe UI',Arial;letter-spacing:.24em;color:${p.accent}">CAMBIO · ${esc(d.team.name.toUpperCase())}${d.injury ? `<span style="padding:2px 8px;border-radius:4px;background:#dc2626;color:#fff;letter-spacing:.12em">POR LESIÓN</span>` : ""}</div>
      ${row("in", d.playerIn)}
      ${d.playerOut ? row("out", d.playerOut) : ""}
    </div>
    <div style="width:130px;flex-shrink:0;display:grid;place-items:center;background:${p.accent};color:${onColor(p.accent)};${NUM};font-size:46px;font-weight:900">${esc(d.minute)}</div>
  </div>`;
  return { html, width: W, height: H };
}

function bookingCard(d: BookingCard | undefined, p: Palette): DesignOutput {
  const W = 920; const H = 150;
  if (!d) return empty(W, H, "Tarjeta: sin datos del partido");
  const color = d.color === "red" ? "#e11d2e" : "#facc15";
  const html = `<div class="nx" style="width:${W}px;height:${H}px;display:flex;align-items:stretch;color:#fff;${FONT_TXT};border-radius:10px;overflow:hidden;background:${SURFACE};box-shadow:0 18px 40px rgba(0,0,0,.55),inset 0 0 0 2px ${color}88">
    <div style="width:150px;flex-shrink:0;display:grid;place-items:center;background:rgba(255,255,255,.04)">
      <div style="width:62px;height:88px;border-radius:7px;background:${color};transform:rotate(-12deg);box-shadow:0 10px 24px ${color}66,inset 0 -8px 0 rgba(0,0,0,.12)"></div>
    </div>
    <div style="flex:1;min-width:0;padding:18px 24px;display:flex;flex-direction:column;justify-content:center;gap:6px">
      <div style="font:800 15px 'Segoe UI',Arial;letter-spacing:.24em;color:${color}">TARJETA ${d.color === "red" ? "ROJA" : "AMARILLA"}</div>
      <div style="${NUM};font-size:42px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(d.player)}</div>
      <div style="display:flex;align-items:center;gap:10px;font:600 19px 'Segoe UI',Arial;color:rgba(255,255,255,.8)">${crestImg(d.team.logo, d.team.short, 28)} ${esc(d.team.name)}</div>
    </div>
    <div style="width:120px;flex-shrink:0;display:grid;place-items:center;background:${color};color:${onColor(color)};${NUM};font-size:42px;font-weight:900">${esc(d.minute)}</div>
  </div>`;
  return { html, width: W, height: H };
}

function timelineBar(d: Timeline | undefined, p: Palette): DesignOutput {
  const W = 1600; const H = 250;
  if (!d) return empty(W, H, "Línea de tiempo: sin datos del partido");
  const L = 60; const R = W - 60; const axisY = 160;
  const x = (min: number) => L + ((R - L) * Math.min(min, d.end)) / d.end;
  const icon = (t: Timeline["events"][number]["type"]) => t === "goal" ? `<span style="font-size:22px">⚽</span>`
    : t === "sub" ? `<span style="font:900 16px 'Segoe UI',Arial;color:#4ade80">⇄</span>`
    : `<span style="display:inline-block;width:13px;height:18px;border-radius:2px;background:${t === "red" ? "#e11d2e" : "#facc15"}"></span>`;
  const ticks = [0, 15, 30, 45, 60, 75, 90].filter((m) => m <= d.end).map((m) => `<div style="position:absolute;left:${x(m)}px;top:${axisY - 6}px;width:2px;height:12px;background:rgba(255,255,255,.35)"></div>
    <div style="position:absolute;left:${x(m) - 20}px;width:40px;top:${axisY + 10}px;text-align:center;font:700 13px 'Segoe UI',Arial;color:rgba(255,255,255,.5)">${m === 45 ? "ET" : `${m}'`}</div>`).join("");
  // events stacked when they share the minute
  const used = new Map<string, number>();
  const marks = d.events.filter((e) => e.type !== "sub" || d.events.length < 26).map((e) => {
    const key = `${e.team}:${Math.round(e.minute / 3)}`;
    const n = used.get(key) ?? 0;
    used.set(key, n + 1);
    const top = e.team === "home" ? axisY - 44 - n * 30 : axisY + 34 + n * 30;
    const big = e.type === "goal";
    return `<div style="position:absolute;left:${x(e.minute) - 15}px;top:${top}px;width:30px;height:28px;display:grid;place-items:center" title="${esc(e.player)}">${icon(e.type)}</div>
      ${big ? `<div style="position:absolute;left:${x(e.minute) - 70}px;width:140px;top:${e.team === "home" ? top - 22 : top + 28}px;text-align:center;font:700 13px 'Segoe UI',Arial;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.player.split(" ").slice(-1)[0])} ${esc(e.label)}</div>` : ""}`;
  }).join("");
  const html = `<div class="nx" style="width:${W}px;height:${H}px;position:relative;color:#fff;${FONT_TXT};border-radius:12px;overflow:hidden;background:${SURFACE};box-shadow:0 18px 40px rgba(0,0,0,.55),inset 0 0 0 2px ${p.accent}44">
    <div style="position:absolute;left:0;right:0;top:0;height:52px;display:flex;align-items:center;gap:14px;padding:0 22px;border-bottom:1px solid ${HAIR}">
      ${crestImg(d.home.logo, d.home.short, 32)}<span style="${NUM};font-size:24px;font-weight:800">${esc(d.home.name)}</span>
      <span style="${NUM};font-size:28px;font-weight:900;padding:0 12px;background:${p.accent};color:${onColor(p.accent)};border-radius:6px">${esc(d.score)}</span>
      <span style="${NUM};font-size:24px;font-weight:800">${esc(d.away.name)}</span>${crestImg(d.away.logo, d.away.short, 32)}
      <span style="margin-left:auto;font:800 14px 'Segoe UI',Arial;letter-spacing:.2em;color:${p.accent}">LÍNEA DE TIEMPO · ${esc(d.status)}</span>
    </div>
    <div style="position:absolute;left:${L}px;width:${R - L}px;top:${axisY - 2}px;height:4px;border-radius:2px;background:linear-gradient(90deg,${teamTint(d.home.color, p.accent)},${teamTint(d.away.color, "#e5e7eb")})"></div>
    <div style="position:absolute;left:14px;top:${axisY - 40}px;font:800 12px 'Segoe UI',Arial;color:rgba(255,255,255,.55)">${esc(d.home.short)}</div>
    <div style="position:absolute;left:14px;top:${axisY + 26}px;font:800 12px 'Segoe UI',Arial;color:rgba(255,255,255,.55)">${esc(d.away.short)}</div>
    ${ticks}${marks}
  </div>`;
  return { html, width: W, height: H };
}

function duelBoard(d: Duel | undefined, p: Palette): DesignOutput {
  const W = 1320;
  if (!d) return empty(W, 640, "Duelo: elige dos jugadores");
  const H = 58 + 26 + Math.max(330, Math.min(7, d.rows.length) * 64) + 50;
  const head = (pl: Duel["a"], align: "left" | "right") => `<div style="display:flex;flex-direction:column;align-items:center;gap:10px;width:300px">
      <div style="width:190px;height:190px;border-radius:50%;overflow:hidden;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 3px ${p.accent}">${pl.image && safeSrc(pl.image) ? `<img src="${esc(pl.image)}" alt="" style="width:100%;height:100%;object-fit:cover;object-position:top" />` : `<div style="height:100%;display:grid;place-items:center;${NUM};font-size:64px;font-weight:900">${esc(pl.name.split(" ").map((w) => w[0]).join("").slice(0, 2))}</div>`}</div>
      <div style="${NUM};font-size:32px;font-weight:900;text-align:center;line-height:1.05">${esc(pl.name)}</div>
      <div style="font:600 18px 'Segoe UI',Arial;color:rgba(255,255,255,.7);text-align:${align === "left" ? "center" : "center"}">${esc([pl.team, pl.position].filter(Boolean).join(" · "))}</div>
    </div>`;
  const rows = d.rows.slice(0, 7).map((r) => {
    const total = r.a + r.b || 1;
    const better = r.a === r.b ? "none" : r.a > r.b ? "a" : "b";
    return `<div style="display:grid;grid-template-columns:90px 1fr 90px;align-items:center;gap:14px">
      <span style="${NUM};font-size:32px;font-weight:900;text-align:right;color:${better === "a" ? p.accent : "#fff"}">${r.a}${r.suffix ?? ""}</span>
      <div><div style="font:800 14px 'Segoe UI',Arial;letter-spacing:.2em;text-transform:uppercase;text-align:center;color:rgba(255,255,255,.6);margin-bottom:5px">${esc(r.label)}</div>
        <div style="display:flex;height:12px;border-radius:6px;overflow:hidden;background:rgba(255,255,255,.08)"><div style="width:${(r.a / total) * 100}%;background:${better === "b" ? "rgba(255,255,255,.35)" : p.accent}"></div><div style="flex:1;background:${better === "a" ? "rgba(255,255,255,.35)" : "#e5e7eb"}"></div></div></div>
      <span style="${NUM};font-size:32px;font-weight:900;color:${better === "b" ? p.accent : "#fff"}">${r.b}${r.suffix ?? ""}</span>
    </div>`;
  }).join("");
  const note = [d.a.competition, d.b.competition].filter(Boolean);
  const html = `<div class="nx" style="width:${W}px;height:${H}px;color:#fff;${FONT_TXT};border-radius:14px;overflow:hidden;background:linear-gradient(160deg,rgba(10,12,18,.97),rgba(4,5,8,.97));box-shadow:0 26px 70px rgba(0,0,0,.6),inset 0 0 0 2px ${p.accent}55">
    <div style="height:58px;display:flex;align-items:center;justify-content:center;gap:12px;border-bottom:2px solid ${p.accent};font:900 20px 'Segoe UI',Arial;letter-spacing:.3em">⚔ DUELO</div>
    <div style="display:flex;align-items:flex-start;gap:20px;padding:26px 30px 0">
      ${head(d.a, "left")}
      <div style="flex:1;display:flex;flex-direction:column;gap:12px;padding-top:6px">${rows || `<div style="text-align:center;opacity:.6">Sin estadísticas comparables</div>`}</div>
      ${head(d.b, "right")}
    </div>
    ${note.length ? `<div style="padding:14px 30px 0;font:600 14px 'Segoe UI',Arial;color:rgba(255,255,255,.45);text-align:center">Temporada: ${esc([...new Set(note)].join(" / "))} · datos ESPN</div>` : ""}
  </div>`;
  return { html, width: W, height: H };
}

function pollResultBoard(d: PollResult | undefined, p: Palette): DesignOutput {
  const W = 1100;
  if (!d) return empty(W, 200, "Resultado: lanza una votación primero");
  const H = 190 + d.options.length * 74;
  const rows = d.options.map((o) => `<div style="position:relative;height:60px;border-radius:10px;overflow:hidden;background:rgba(255,255,255,.06);${o.winner ? `box-shadow:inset 0 0 0 2px ${p.accent}` : ""}">
      <div style="position:absolute;inset:0;width:${o.pct}%;background:${o.winner ? p.accent : "rgba(255,255,255,.18)"}"></div>
      <div style="position:relative;height:100%;display:flex;align-items:center;gap:14px;padding:0 20px;color:${o.winner ? onColor(p.accent) : "#fff"}">
        ${o.winner ? `<span style="font-size:24px">🏆</span>` : ""}<span style="flex:1;${NUM};font-size:26px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${!o.winner ? "" : ""}">${esc(o.label)}</span>
        <span style="${NUM};font-size:32px;font-weight:900">${o.pct}%</span>
      </div></div>`).join("");
  const html = `<div class="nx" style="width:${W}px;height:${H}px;color:#fff;${FONT_TXT};border-radius:14px;overflow:hidden;background:${SURFACE};box-shadow:0 22px 60px rgba(0,0,0,.6),inset 0 0 0 2px ${p.accent}55">
    <div style="padding:22px 30px 10px">
      <div style="font:800 15px 'Segoe UI',Arial;letter-spacing:.26em;color:${p.accent}">RESULTADO ${d.kind === "debate" ? "DEL DEBATE" : "DE LA VOTACIÓN"}</div>
      <div style="${NUM};font-size:38px;font-weight:900;margin-top:6px;line-height:1.1">${esc(d.question)}</div>
    </div>
    <div style="padding:8px 30px;display:flex;flex-direction:column;gap:14px">${rows}</div>
    <div style="padding:6px 30px;font:600 16px 'Segoe UI',Arial;color:rgba(255,255,255,.6)">${d.total.toLocaleString("es-CO")} ${d.total === 1 ? "voto" : "votos"} de la comunidad NEXUS</div>
  </div>`;
  return { html, width: W, height: H };
}

function adBox(): DesignOutput {
  const W = 400;
  const H = 560;
  const inner = adImage
    ? `<img src="${esc(adImage.src)}" alt="" style="width:${W}px;height:${H - 34}px;object-fit:cover;display:block" />`
    : `<div style="height:${H - 34}px;display:grid;place-items:center;text-align:center;padding:24px;${NUM};font-size:30px;font-weight:900;color:rgba(255,255,255,.85)">TU MARCA<br/>AQUÍ<div style="font:600 18px 'Segoe UI',Arial;color:rgba(255,255,255,.55);margin-top:10px">Espacio publicitario</div></div>`;
  return { html: `<div class="nx" style="width:${W}px;height:${H}px;border-radius:14px;overflow:hidden;background:${SURFACE};box-shadow:0 20px 50px rgba(0,0,0,.6),inset 0 0 0 2px rgba(255,255,255,.18)">
    <div style="height:34px;display:flex;align-items:center;justify-content:center;font:800 14px 'Segoe UI',Arial;letter-spacing:.3em;color:rgba(255,255,255,.7);background:rgba(255,255,255,.06)">PUBLICIDAD</div>${inner}</div>`, width: W, height: H };
}

function recap(): DesignOutput {
  const W = 1380;
  const H = 770;
  const s = recapSlide;
  if (!s) return { html: `<div class="nx" style="width:${W}px;height:${H}px;display:grid;place-items:center;color:rgba(255,255,255,.7);${FONT_TXT};font-size:30px;background:${SURFACE};border-radius:16px">Programa automático: elige la jornada y pulsa ▶</div>`, width: W, height: H };
  const accent = RECAP_ACCENT[s.league ?? ""] ?? "#facc15";
  const logo = (url?: string) => (url ? recapLogos[url] : undefined);
  const crest = (t: RecapMatch["home"], size: number) => multiCrest(logo(t.logo), t.short || t.name, size);
  const title = (text: string) => `<div style="font:900 22px 'Segoe UI',Arial;letter-spacing:.28em;text-transform:uppercase;color:${accent}">${esc(text)}</div>`;
  const header = `<div style="height:64px;display:flex;align-items:center;gap:16px;padding:0 34px;border-bottom:2px solid ${accent};background:linear-gradient(90deg,${accent}22,transparent)">
    <span style="${NUM};font-size:24px;font-weight:900;letter-spacing:.1em">⚡ NEXUS</span>
    <span style="font:800 18px 'Segoe UI',Arial;letter-spacing:.22em;color:rgba(255,255,255,.75)">RESUMEN DE LA JORNADA</span>
    <span style="margin-left:auto;font:800 18px 'Segoe UI',Arial;letter-spacing:.12em;color:${accent}">${esc(s.leagueName ?? "")}</span>
    ${recapStep ? `<span style="font:700 15px 'Segoe UI',Arial;color:rgba(255,255,255,.5)">${esc(recapStep)}</span>` : ""}
  </div>`;
  const row = (m: RecapMatch, big = false) => `<div style="display:flex;align-items:center;gap:14px;padding:${big ? 14 : 9}px 22px;border-radius:10px;background:rgba(255,255,255,.05)">
      ${crest(m.home, big ? 46 : 34)}<span style="flex:1;text-align:right;${NUM};font-size:${big ? 28 : 22}px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.home.name)}</span>
      <span style="min-width:${big ? 120 : 96}px;text-align:center;${NUM};font-size:${big ? 36 : 28}px;font-weight:900;background:${accent};color:${onColor(accent)};border-radius:8px;padding:2px 10px">${m.home.score}-${m.away.score}</span>
      <span style="flex:1;${NUM};font-size:${big ? 28 : 22}px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.away.name)}</span>${crest(m.away, big ? 46 : 34)}
    </div>`;
  let body = "";
  const m = s.match;
  if (s.kind === "intro" || s.kind === "outro") {
    const list = (s.matches ?? []).slice(0, 6);
    body = `<div style="padding:34px 60px;display:flex;flex-direction:column;gap:16px">
      ${title(s.kind === "intro" ? "Bienvenidos" : "Cierre")}
      <div style="${NUM};font-size:64px;font-weight:900;line-height:1">${esc(s.title ?? "")}</div>
      ${(s.lines ?? []).map((l) => `<div style="font:600 26px 'Segoe UI',Arial;color:rgba(255,255,255,.85)">${esc(l)}</div>`).join("")}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">${list.map((x) => row(x)).join("")}</div>
    </div>`;
  } else if (s.kind === "league") {
    const list = (s.matches ?? []).slice(0, 8);
    body = `<div style="padding:30px 60px;display:flex;flex-direction:column;gap:12px">
      ${title("Ahora")}
      <div style="${NUM};font-size:70px;font-weight:900;line-height:1;color:#fff;text-shadow:0 0 30px ${accent}88">${esc(s.leagueName ?? "")}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">${list.map((x) => row(x)).join("")}</div>
    </div>`;
  } else if (m && s.kind === "result") {
    const side = (t: RecapMatch["home"], goals: RecapMatch["goals"]["home"]) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:14px">
        ${crest(t, 190)}
        <div style="${NUM};font-size:46px;font-weight:900;text-align:center;line-height:1.05">${esc(t.name)}</div>
        <div style="font:600 21px 'Segoe UI',Arial;color:rgba(255,255,255,.8);text-align:center;min-height:30px">${goals.map((g) => `⚽ ${esc(g.player.split(" ").slice(-1)[0])} ${esc(g.minute)}${g.kind === "penalty" ? " (p)" : g.kind === "own" ? " (e.c.)" : ""}`).join("&#160;&#160; ")}</div>
      </div>`;
    body = `<div style="padding:30px 50px 0;display:flex;flex-direction:column;align-items:center">
      ${title("Final")}
      <div style="display:flex;align-items:center;width:100%;margin-top:18px">
        ${side(m.home, m.goals.home)}
        <div style="${NUM};font-size:150px;font-weight:900;line-height:1;padding:0 30px;color:#fff;text-shadow:0 0 40px ${accent}">${m.home.score}<span style="color:${accent}">-</span>${m.away.score}</div>
        ${side(m.away, m.goals.away)}
      </div>
      <div style="margin-top:26px;padding:14px 30px;border-radius:12px;background:${accent};color:${onColor(accent)};${NUM};font-size:34px;font-weight:900;text-align:center">${esc(m.headline)}</div>
    </div>`;
  } else if (m && s.kind === "stats") {
    const visible = (c: string | undefined, fallback: string) => (c && luminance(c) > 0.12 ? c : fallback);
    const hc = visible(m.home.color, accent);
    const ac = visible(m.away.color === m.home.color ? undefined : m.away.color, "#e5e7eb");
    const bars = m.stats.slice(0, 6).map((st) => {
      const total = st.home + st.away || 1;
      const hp = Math.round((st.home / total) * 100);
      return `<div style="display:grid;grid-template-columns:90px 1fr 90px;align-items:center;gap:18px">
        <span style="${NUM};font-size:34px;font-weight:900;text-align:right">${st.home}${st.percent ? "%" : ""}</span>
        <div><div style="font:800 17px 'Segoe UI',Arial;letter-spacing:.2em;text-transform:uppercase;text-align:center;color:rgba(255,255,255,.7);margin-bottom:6px">${esc(st.label)}</div>
          <div style="display:flex;height:14px;border-radius:7px;overflow:hidden;background:rgba(255,255,255,.1)"><div style="width:${hp}%;background:${hc}"></div><div style="flex:1;background:${ac}"></div></div></div>
        <span style="${NUM};font-size:34px;font-weight:900">${st.away}${st.percent ? "%" : ""}</span>
      </div>`;
    }).join("");
    body = `<div style="padding:24px 60px;display:flex;flex-direction:column;gap:16px">
      ${row(m, true)}
      ${title("Estadísticas")}
      <div style="display:flex;flex-direction:column;gap:16px">${bars}</div>
    </div>`;
  } else if (m && (s.kind === "analysis" || s.kind === "impact")) {
    const lines = (s.lines ?? []).map((l) => `<div style="display:flex;gap:16px;align-items:flex-start;font:600 30px/1.3 'Segoe UI',Arial"><span style="color:${accent};font-weight:900">▸</span><span>${esc(l)}</span></div>`).join("");
    const table = s.kind === "impact" && m.table.length ? (() => {
      const ids = new Set([m.home.id, m.away.id]);
      const idx = m.table.map((r, i) => (ids.has(r.teamId) ? i : -1)).filter((i) => i >= 0);
      const pick = new Set<number>([0, 1, 2]);
      idx.forEach((i) => { pick.add(i - 1); pick.add(i); pick.add(i + 1); });
      const rows = [...pick].filter((i) => i >= 0 && i < m.table.length).sort((a, b) => a - b).slice(0, 9).map((i) => m.table[i]);
      return `<div style="width:470px;flex-shrink:0;border-radius:12px;overflow:hidden;background:rgba(255,255,255,.04)">
        <div style="padding:10px 18px;font:800 16px 'Segoe UI',Arial;letter-spacing:.2em;color:${accent};text-transform:uppercase">${esc(m.tableName ?? `Tabla · ${s.leagueName ?? ""}`)}</div>
        ${rows.map((r) => `<div style="display:grid;grid-template-columns:44px 1fr 60px 60px;align-items:center;padding:7px 18px;${ids.has(r.teamId) ? `background:${accent};color:${onColor(accent)};font-weight:900;` : "border-top:1px solid rgba(255,255,255,.06);"}${NUM};font-size:22px">
          <span>${r.pos}</span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.team)}</span><span style="text-align:right;opacity:.7">${r.played}</span><span style="text-align:right;font-weight:900">${r.points}</span></div>`).join("")}
      </div>`;
    })() : "";
    body = `<div style="padding:24px 50px;display:flex;flex-direction:column;gap:18px">
      ${row(m, true)}
      ${title(s.kind === "analysis" ? "Análisis" : "Así queda la tabla")}
      <div style="display:flex;gap:34px;align-items:flex-start"><div style="flex:1;display:flex;flex-direction:column;gap:18px">${lines}</div>${table}</div>
    </div>`;
  }
  if (s.kind === "numbers" && s.numbers) {
    const n = s.numbers;
    const tile = (label: string, value: string) => `<div style="flex:1;padding:16px 20px;border-radius:12px;background:rgba(255,255,255,.05);box-shadow:inset 0 -3px 0 ${accent}">
      <div style="${NUM};font-size:58px;font-weight:900;line-height:1">${esc(value)}</div><div style="font:800 15px 'Segoe UI',Arial;letter-spacing:.2em;color:rgba(255,255,255,.6);text-transform:uppercase;margin-top:6px">${esc(label)}</div></div>`;
    const total = Math.max(1, n.homeWins + n.draws + n.awayWins);
    const seg = (v: number, color: string, label: string) => (v ? `<div style="width:${(v / total) * 100}%;background:${color};display:flex;align-items:center;justify-content:center;${NUM};font-size:22px;font-weight:900;color:${onColor(color)}">${v} ${label}</div>` : "");
    const maxGoals = Math.max(1, ...n.byLeague.map((l) => l.goals));
    const bars = n.byLeague.map((l) => `<div style="display:grid;grid-template-columns:190px 1fr 60px;align-items:center;gap:12px">
      <span style="font:700 19px 'Segoe UI',Arial;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(l.name)}</span>
      <div style="height:24px;border-radius:6px;background:rgba(255,255,255,.06);overflow:hidden"><div style="height:100%;width:${(l.goals / maxGoals) * 100}%;background:linear-gradient(90deg,${accent},${accent}88)"></div></div>
      <span style="${NUM};font-size:24px;font-weight:900;text-align:right">${l.goals}</span></div>`).join("");
    const scorers = n.scorers.map((p, i) => `<div style="display:flex;align-items:center;gap:12px;padding:8px 14px;border-radius:8px;background:${i === 0 ? accent : "rgba(255,255,255,.05)"};color:${i === 0 ? onColor(accent) : "#fff"}">
      <span style="${NUM};font-size:26px;font-weight:900;width:34px">${p.goals}</span><span style="flex:1;min-width:0"><b style="font:800 20px 'Segoe UI',Arial">${esc(p.player)}</b><br/><span style="font:600 15px 'Segoe UI',Arial;opacity:.7">${esc(p.team)}</span></span>⚽</div>`).join("");
    body = `<div style="padding:24px 44px;display:grid;grid-template-columns:1fr 400px;gap:30px">
      <div style="display:flex;flex-direction:column;gap:18px">
        ${title("La jornada en números")}
        <div style="display:flex;gap:14px">${tile("partidos", String(n.matches))}${tile("goles", String(n.goals))}${tile("goles por partido", (n.goals / Math.max(1, n.matches)).toFixed(1))}</div>
        <div><div style="font:800 15px 'Segoe UI',Arial;letter-spacing:.2em;color:rgba(255,255,255,.6);margin-bottom:8px">¿QUIÉN GANÓ MÁS?</div>
          <div style="display:flex;height:46px;border-radius:10px;overflow:hidden">${seg(n.homeWins, accent, "local")}${seg(n.draws, "#6b7280", "empate")}${seg(n.awayWins, "#e5e7eb", "visita")}</div></div>
        <div style="display:flex;flex-direction:column;gap:10px"><div style="font:800 15px 'Segoe UI',Arial;letter-spacing:.2em;color:rgba(255,255,255,.6)">GOLES POR LIGA</div>${bars}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">${title("Goleadores")}${scorers || `<div style="opacity:.6;font:600 20px 'Segoe UI',Arial">Sin goles registrados</div>`}</div>
    </div>`;
  } else if (s.kind === "parlays" && s.parlays) {
    const money = (v: number) => `$${Math.round(v).toLocaleString("es-CO")}`;
    const card = (pl: NonNullable<RecapSlide["parlays"]>[number], hot: boolean) => `<div style="flex:1;border-radius:14px;overflow:hidden;background:rgba(255,255,255,.05);box-shadow:inset 0 0 0 2px ${hot ? "#ff3b3b" : accent}">
      <div style="padding:12px 20px;display:flex;align-items:center;gap:10px;background:${hot ? "#ff3b3b" : accent};color:${onColor(hot ? "#ff3b3b" : accent)};${NUM};font-size:28px;font-weight:900">${hot ? "💣" : "✅"} ${esc(pl.name.toUpperCase())}<span style="margin-left:auto">x${pl.odds.toFixed(2)}</span></div>
      <div style="padding:14px 20px;display:flex;flex-direction:column;gap:10px">${pl.picks.map((p) => `<div style="display:flex;align-items:center;gap:12px">
        <span style="color:#22c55e;font-size:24px">✔</span><span style="flex:1;min-width:0"><b style="font:800 21px 'Segoe UI',Arial">${esc(p.pick)}</b><br/><span style="font:600 16px 'Segoe UI',Arial;opacity:.65">${esc(p.match)}</span></span>
        <span style="${NUM};font-size:26px;font-weight:900">${p.odds.toFixed(2)}</span></div>`).join("")}</div>
      <div style="margin:0 20px 16px;padding:12px 16px;border-radius:10px;background:rgba(0,0,0,.35);font:700 21px 'Segoe UI',Arial">Con $10.000 pagaba <b style="${NUM};font-size:30px;color:${hot ? "#ff6b6b" : accent}">${money(10000 * pl.odds)}</b></div>
    </div>`;
    const top = (s.picks ?? []).slice(0, 4).map((p) => `<span style="padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.07);font:700 17px 'Segoe UI',Arial">${esc(p.pick)} · <b style="color:${accent}">${p.odds.toFixed(2)}</b></span>`).join("");
    body = `<div style="padding:22px 44px;display:flex;flex-direction:column;gap:16px">
      ${title("Los parleys ganadores de la jornada")}
      <div style="display:flex;gap:22px">${s.parlays.map((pl) => card(pl, pl.name === "Parley bomba")).join("")}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span style="font:800 15px 'Segoe UI',Arial;letter-spacing:.2em;color:rgba(255,255,255,.6)">LOS QUE MÁS PAGARON:</span>${top}</div>
      <div style="font:600 14px 'Segoe UI',Arial;color:rgba(255,255,255,.45)">Cuotas de referencia previas al partido (${esc(s.parlays[0]?.picks[0] ? "DraftKings vía ESPN" : "")}). +18 · Juega con responsabilidad.</div>
    </div>`;
  }
  const html = `<div class="nx" style="width:${W}px;height:${H}px;color:#fff;${FONT_TXT};background:linear-gradient(160deg,rgba(10,12,18,.985),rgba(4,5,8,.985));border-radius:16px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 0 0 2px ${accent}55">${header}${body}</div>`;
  return { html, width: W, height: H };
}

function cinta(p: Palette): DesignOutput {
  const per = 4;
  const scorePages = Math.ceil(multiScores.length / per);
  const facts = [...cintaExtra, ...cintaFacts];
  const pages = scorePages + facts.length;
  const page = pages ? cintaPage % pages : 0;
  const item = (m: MultiScore) => {
    const live = m.status === "live" || m.status === "halftime";
    const score = m.homeScore === null ? `<span style="font:700 20px 'Segoe UI',Arial;color:rgba(255,255,255,.7)">${esc(m.detail)}</span>`
      : `<span style="${NUM};font-size:30px;font-weight:900;padding:0 10px">${m.homeScore}-${m.awayScore}</span>`;
    return `<div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:10px;border-left:1px solid rgba(255,255,255,.12);padding:0 14px">
      ${multiCrest(m.homeLogo, m.home, 34)}<span style="${NUM};font-size:22px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px">${esc(m.homeShort || m.home)}</span>
      ${score}
      <span style="${NUM};font-size:22px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px">${esc(m.awayShort || m.away)}</span>${multiCrest(m.awayLogo, m.away, 34)}
      ${m.homeScore !== null ? `<span style="font:800 15px 'Segoe UI',Arial;color:${live ? "#ff6b6b" : "rgba(255,255,255,.6)"}">${esc(m.detail)}</span>` : ""}
    </div>`;
  };
  let body: string;
  let label = "EN VIVO";
  if (!pages) body = `<div style="flex:1;padding:0 24px;font:600 22px 'Segoe UI',Arial;color:rgba(255,255,255,.75)">NEXUS · Fútbol en vivo</div>`;
  else if (page < scorePages) body = multiScores.slice(page * per, page * per + per).map(item).join("");
  else {
    const i = page - scorePages;
    const own = i < cintaExtra.length;
    label = own ? "NEXUS" : "DATO";
    body = `<div style="flex:1;min-width:0;padding:0 24px;font:600 24px 'Segoe UI',Arial;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${own ? "📣" : "📊"} ${esc(facts[i])}</div>`;
  }
  const html = `<div class="nx" style="width:1920px;height:64px;display:flex;align-items:center;color:#fff;${FONT_TXT};background:${SURFACE};box-shadow:0 -2px 0 ${p.accent}">
    <div style="height:64px;width:210px;flex-shrink:0;display:flex;align-items:center;justify-content:center;gap:10px;background:${p.accent};color:${onColor(p.accent)};${NUM};font-size:24px;font-weight:900;letter-spacing:.12em">${label === "EN VIVO" ? `<i style="width:10px;height:10px;border-radius:50%;background:#ff3b3b;display:inline-block"></i>` : ""}${label}</div>
    <div style="flex:1;min-width:0;height:64px;display:flex;align-items:center">${body}</div>
    <div style="width:150px;flex-shrink:0;text-align:center;${NUM};font-size:22px;font-weight:900;letter-spacing:.06em;color:${p.accent}">⚡ NEXUS</div>
  </div>`;
  return { html, width: 1920, height: 64 };
}

function datoCard(p: Palette, title: string, subtitle: string): DesignOutput {
  const html = `<div class="nx" style="width:980px;color:#fff;${FONT_TXT};background:${SURFACE};border-radius:8px;overflow:hidden;box-shadow:0 18px 44px rgba(0,0,0,.6),inset 0 0 0 1px ${HAIR}">
  <div style="display:flex;align-items:stretch">
    <div style="width:14px;background:${p.accent}"></div>
    <div style="flex:1;padding:22px 30px">
      <div style="font:800 14px 'Segoe UI',Arial;letter-spacing:.24em;text-transform:uppercase;color:${p.accent}">${esc(title || "Dato NEXUS")}</div>
      <div style="${NUM};font-size:36px;font-weight:800;line-height:1.18;margin-top:10px">${esc(subtitle)}</div>
    </div>
  </div>
</div>`;
  const lines = Math.max(1, Math.ceil((subtitle || "").length / 46));
  return { html, width: 980, height: 70 + lines * 44 + 26 };
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
    case "poll": return pollDesign(p, title);
    case "dato": return datoCard(p, title, subtitle);
    case "pro": return proBoard(match, p);
    case "goal-pro": return goalPro(p);
    case "cinta": return cinta(p);
    case "recap": return recap();
    case "ad": return adBox();
    case "sub": return subCard(graphicData.get(title) as SubCard | undefined, p);
    case "card": return bookingCard(graphicData.get(title) as BookingCard | undefined, p);
    case "timeline": return timelineBar(graphicData.get(title) as Timeline | undefined, p);
    case "duel": return duelBoard(graphicData.get(title) as Duel | undefined, p);
    case "poll-result": return pollResultBoard(graphicData.get(title) as PollResult | undefined, p);
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
  poll: "Votación en vivo (encuesta / debate)",
  dato: "Dato grande",
  pro: "Marcador Pro (por competición)",
  "goal-pro": "Gol (tarjeta completa)",
  cinta: "Cinta de datos (abajo)",
  recap: "Programa automático (resumen)",
  ad: "Publicidad (imagen)",
  sub: "Cambio",
  card: "Tarjeta",
  timeline: "Línea de tiempo",
  duel: "Duelo de jugadores",
  "poll-result": "Resultado del debate",
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
