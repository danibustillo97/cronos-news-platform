export interface CompetitionTheme {
  id: string;
  espn: string;
  name: string;
  short: string;
  accent: string;
  accent2: string;
  bg: string;
  text: string;
}

// `espn` is the league slug used by the public ESPN soccer API.
export const COMPETITIONS: CompetitionTheme[] = [
  { id: "libertadores", espn: "conmebol.libertadores", name: "CONMEBOL Libertadores", short: "LIBERTADORES", accent: "#f5c542", accent2: "#c8102e", bg: "#0a0f1f", text: "#ffffff" },
  { id: "sudamericana", espn: "conmebol.sudamericana", name: "CONMEBOL Sudamericana", short: "SUDAMERICANA", accent: "#00b3ff", accent2: "#ffd400", bg: "#06141f", text: "#ffffff" },
  { id: "champions", espn: "uefa.champions", name: "UEFA Champions League", short: "CHAMPIONS LEAGUE", accent: "#7aa7ff", accent2: "#ffffff", bg: "#050b24", text: "#ffffff" },
  { id: "europa", espn: "uefa.europa", name: "UEFA Europa League", short: "EUROPA LEAGUE", accent: "#ff7a00", accent2: "#ffffff", bg: "#12080a", text: "#ffffff" },
  { id: "laliga", espn: "esp.1", name: "LaLiga EA Sports", short: "LALIGA", accent: "#ff4b44", accent2: "#ffffff", bg: "#12090a", text: "#ffffff" },
  { id: "premier", espn: "eng.1", name: "Premier League", short: "PREMIER LEAGUE", accent: "#c7ff3d", accent2: "#a100ff", bg: "#2a0a4a", text: "#ffffff" },
  { id: "seriea", espn: "ita.1", name: "Serie A", short: "SERIE A", accent: "#1fd1a5", accent2: "#ffffff", bg: "#06161a", text: "#ffffff" },
  { id: "bundesliga", espn: "ger.1", name: "Bundesliga", short: "BUNDESLIGA", accent: "#ff2a2a", accent2: "#ffffff", bg: "#12090a", text: "#ffffff" },
  { id: "ligue1", espn: "fra.1", name: "Ligue 1", short: "LIGUE 1", accent: "#d8ff3d", accent2: "#ffffff", bg: "#071221", text: "#ffffff" },
  { id: "betplay", espn: "col.1", name: "Liga BetPlay", short: "LIGA BETPLAY", accent: "#ffd400", accent2: "#e4002b", bg: "#0b0d12", text: "#ffffff" },
  { id: "mls", espn: "usa.1", name: "MLS", short: "MLS", accent: "#e6c15a", accent2: "#ffffff", bg: "#0a0d14", text: "#ffffff" },
  { id: "custom", espn: "", name: "Personalizado", short: "AMISTOSO", accent: "#facc15", accent2: "#ffffff", bg: "#0a0c10", text: "#ffffff" },
];

export const getCompetition = (id: string) => COMPETITIONS.find((item) => item.id === id) ?? COMPETITIONS[COMPETITIONS.length - 1];
