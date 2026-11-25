"""CONTENT CATALOG -- what kinds of content the platform can be set up for.

A newsroom (or a single creator) picks ONE mode at first-run setup:

  football  Fútbol: only football; competitions, teams, transfer market, stats.
  all       Todo: general news across every category.

Each mode ships with verified sources (RSS feeds checked live on
2026-11-23: all returned fresh items with full article text). Competitions
carry the keywords used to score relevance and the ESPN league code the
live-data blocks will use. Everything here is data, not logic -- adding a
competition or a source never touches the scraper.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Competition:
    id: str
    name: str
    group: str
    keywords: tuple[str, ...]
    espn_league: str | None = None


@dataclass(frozen=True)
class Focus:
    id: str
    name: str
    description: str
    keywords: tuple[str, ...]


@dataclass(frozen=True)
class CatalogSource:
    id: str
    name: str
    url: str
    modes: tuple[str, ...]
    # Competitions this outlet mostly covers. "general" = covers many; always
    # included when its mode is active (relevance scoring does the filtering).
    covers: tuple[str, ...] = ("general",)
    language: str = "es"


@dataclass(frozen=True)
class Mode:
    id: str
    name: str
    description: str
    available: bool = True


MODES: tuple[Mode, ...] = (
    Mode("football", "Fútbol", "Solo fútbol: ligas, selecciones, mercado de fichajes y estadísticas."),
    Mode("all", "Todo", "Noticias generales de todas las categorías."),
)

COMPETITIONS: tuple[Competition, ...] = (
    Competition("colombia", "Liga BetPlay y Selección Colombia", "Colombia", (
        "liga betplay", "betplay", "liga colombiana", "fútbol colombiano", "dimayor", "copa betplay",
        "selección colombia", "selección colombiana", "néstor lorenzo", "millonarios", "atlético nacional",
        "américa de cali", "junior de barranquilla", "independiente santa fe", "deportivo cali", "once caldas",
        "independiente medellín", "dim", "deportes tolima", "atlético bucaramanga", "deportivo pereira",
        "luis díaz", "james rodríguez", "jhon durán", "richard ríos", "colombianos en el exterior",
    ), "col.1"),
    Competition("laliga", "LaLiga", "Europa", (
        "laliga", "liga española", "laliga ea sports", "real madrid", "fc barcelona", "barcelona", "barça", "atlético de madrid",
        "athletic club", "real sociedad", "villarreal", "real betis", "sevilla fc", "mbappé", "vinícius", "lamine yamal",
    ), "esp.1"),
    Competition("premier", "Premier League", "Europa", (
        "premier league", "manchester city", "manchester united", "liverpool", "arsenal", "chelsea",
        "tottenham", "newcastle", "aston villa", "haaland", "salah", "guardiola",
    ), "eng.1"),
    Competition("seriea", "Serie A", "Europa", (
        "serie a", "inter de milán", "inter milan", "ac milan", "juventus", "napoli", "as roma", "lazio", "atalanta",
    ), "ita.1"),
    Competition("bundesliga", "Bundesliga", "Europa", (
        "bundesliga", "bayern múnich", "bayern", "borussia dortmund", "dortmund", "bayer leverkusen", "leipzig",
    ), "ger.1"),
    Competition("champions", "Champions League", "Europa", (
        "champions league", "liga de campeones", "champions",
    ), "uefa.champions"),
    Competition("libertadores", "Copa Libertadores", "Sudamérica", (
        "copa libertadores", "libertadores", "conmebol",
    ), "conmebol.libertadores"),
    Competition("sudamericana", "Copa Sudamericana", "Sudamérica", (
        "copa sudamericana", "sudamericana",
    ), "conmebol.sudamericana"),
    Competition("eliminatorias", "Eliminatorias y Mundial", "Sudamérica", (
        "eliminatorias", "eliminatorias sudamericanas", "mundial 2026", "copa del mundo", "copa mundial de la fifa",
    ), "fifa.worldq.conmebol"),
    Competition("argentina", "Fútbol argentino", "Sudamérica", (
        "liga profesional argentina", "torneo clausura", "fútbol argentino", "boca juniors", "river plate",
        "racing club", "independiente de avellaneda", "san lorenzo de almagro", "estudiantes de la plata",
        "selección argentina", "scaloni", "messi",
    ), "arg.1"),
    Competition("brasil", "Fútbol brasileño", "Sudamérica", (
        "brasileirão", "brasileirao", "flamengo", "palmeiras", "corinthians", "são paulo", "fluminense",
        "botafogo", "seleção", "selección brasileña",
    ), "bra.1"),
)

FOCUSES: tuple[Focus, ...] = (
    Focus("market", "Mercado de fichajes", "Fichajes, rumores, renovaciones y salidas.", (
        "fichaje", "fichajes", "ficha", "traspaso", "cesión", "renovación", "renueva", "contrato", "cláusula",
        "oferta", "rumor", "mercado de pases", "mercado de fichajes", "refuerzo", "transferencia", "firma con",
        "nuevo jugador", "agente libre", "venta", "precio",
    )),
    Focus("stats", "Estadísticas y datos", "Récords, rachas, números y análisis con datos.", (
        "estadística", "estadísticas", "datos", "récord", "racha", "goleador", "goleadores", "asistencias",
        "xg", "porcentaje", "ranking", "invicto", "histórico", "números", "promedio", "tabla de posiciones",
    )),
    Focus("results", "Resultados y partidos", "Previas, crónicas, resultados y alineaciones.", (
        "resultado", "goles", "empate", "victoria", "derrota", "alineación", "alineaciones", "previa",
        "crónica", "minuto a minuto", "en vivo", "fecha", "jornada", "clásico", "final",
    )),
    Focus("injuries", "Lesiones y bajas", "Partes médicos, sanciones y convocatorias.", (
        "lesión", "lesionado", "baja", "bajas", "parte médico", "sanción", "suspendido", "convocatoria", "convocados",
    )),
)

SOURCES: tuple[CatalogSource, ...] = (
    # Colombia
    CatalogSource("as-colombia", "AS Colombia", "https://feeds.as.com/mrss-s/pages/as/site/colombia.as.com/portada/",
                  ("football", "all"), ("colombia", "general")),
    CatalogSource("eltiempo-futcol", "El Tiempo · Fútbol colombiano", "https://www.eltiempo.com/rss/deportes_futbol-colombiano.xml",
                  ("football", "all"), ("colombia",)),
    CatalogSource("eltiempo-deportes", "El Tiempo · Deportes", "https://www.eltiempo.com/rss/deportes.xml",
                  ("football", "all"), ("colombia", "general")),
    CatalogSource("elcolombiano-deportes", "El Colombiano · Deportes", "https://www.elcolombiano.com/rss/deportes.xml",
                  ("football", "all"), ("colombia", "general")),
    CatalogSource("eluniversal-deportes", "El Universal · Deportes",
                  "https://www.eluniversal.com.co/arc/outboundfeeds/rss/category/deportes/?outputType=xml",
                  ("football", "all"), ("colombia", "general")),
    CatalogSource("semana-deportes", "Semana · Deportes", "https://www.semana.com/arc/outboundfeeds/rss/category/deportes/?outputType=xml",
                  ("football", "all"), ("colombia", "general")),
    # Europa
    CatalogSource("as-primera", "AS · LaLiga", "https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/subsection/primera/",
                  ("football", "all"), ("laliga",)),
    CatalogSource("as-internacional", "AS · Internacional",
                  "https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/subsection/internacional/",
                  ("football", "all"), ("premier", "seriea", "bundesliga", "champions")),
    CatalogSource("md-futbol", "Mundo Deportivo · Fútbol", "https://www.mundodeportivo.com/rss/futbol",
                  ("football", "all"), ("laliga", "champions", "general")),
    CatalogSource("md-premier", "Mundo Deportivo · Premier", "https://www.mundodeportivo.com/rss/futbol/premier-league",
                  ("football",), ("premier",)),
    CatalogSource("md-champions", "Mundo Deportivo · Champions", "https://www.mundodeportivo.com/rss/futbol/champions-league",
                  ("football",), ("champions",)),
    CatalogSource("md-fichajes", "Mundo Deportivo · Fichajes", "https://www.mundodeportivo.com/rss/futbol/fichajes",
                  ("football",), ("market",)),
    # Verificadas en vivo el 2026-11-25 (ítems de la última hora, texto completo salvo ESPN).
    CatalogSource("infobae-colombia-deportes", "Infobae Colombia · Deportes",
                  "https://www.infobae.com/arc/outboundfeeds/rss/category/colombia/deportes/",
                  ("football", "all"), ("colombia", "eliminatorias")),
    CatalogSource("pulzo-deportes", "Pulzo · Deportes", "https://www.pulzo.com/rss/deportes",
                  ("football", "all"), ("colombia",)),
    CatalogSource("marca-portada", "Marca · Portada", "https://e00-marca.uecdn.es/rss/portada.xml",
                  ("football", "all"), ("general",)),
    CatalogSource("elpais-deportes", "El País · Deportes",
                  "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/deportes/portada",
                  ("football", "all"), ("general",)),
    CatalogSource("20minutos-deportes", "20minutos · Deportes", "https://www.20minutos.es/rss/deportes/",
                  ("football", "all"), ("laliga", "general")),
    CatalogSource("espn-deportes", "ESPN · Fútbol", "https://www.espn.com/espn/rss/soccer/news",
                  ("football",), ("general",)),
    CatalogSource("depor-pe", "Depor (Perú)", "https://depor.com/arcio/rss/",
                  ("football",), ("general", "libertadores")),
    CatalogSource("elcomercio-pe-deportes", "El Comercio (Perú) · Deporte Total",
                  "https://elcomercio.pe/arcio/rss/category/deporte-total/", ("football", "all"), ("general",)),
    CatalogSource("latercera-deportes", "La Tercera (Chile) · El Deportivo",
                  "https://www.latercera.com/arc/outboundfeeds/rss/category/el-deportivo/?outputType=xml",
                  ("football", "all"), ("general", "libertadores")),
    # Sudamérica
    CatalogSource("ole", "Olé · Últimas", "https://www.ole.com.ar/rss/ultimas-noticias/",
                  ("football", "all"), ("argentina", "libertadores", "sudamericana")),
    CatalogSource("ole-internacional", "Olé · Internacional", "https://www.ole.com.ar/rss/futbol-internacional/",
                  ("football",), ("general",)),
    CatalogSource("lanacion-deportes", "La Nación (AR) · Deportes",
                  "https://www.lanacion.com.ar/arc/outboundfeeds/rss/category/deportes/?outputType=xml",
                  ("football", "all"), ("argentina", "eliminatorias")),
    CatalogSource("ge-futebol", "ge · Futebol (portugués)", "https://ge.globo.com/rss/ge/futebol/",
                  ("football",), ("brasil",), language="pt"),
    # Internacional
    CatalogSource("infobae-deportes", "Infobae · Deportes", "https://www.infobae.com/arc/outboundfeeds/rss/category/deportes/",
                  ("football", "all"), ("general",)),
    CatalogSource("bbcmundo-deportes", "BBC Mundo · Deportes", "https://feeds.bbci.co.uk/mundo/temas/deporte/rss.xml",
                  ("football", "all"), ("general",)),
    CatalogSource("bbcmundo", "BBC Mundo · Portada", "https://feeds.bbci.co.uk/mundo/rss.xml", ("all",), ("general",)),
)

# Signals that a text is about football at all (mode "football" drops the rest).
FOOTBALL_SIGNALS: tuple[str, ...] = (
    "fútbol", "futbol", "futebol", "gol", "goles", "golazo", "partido", "liga", "club", "entrenador", "técnico",
    "delantero", "defensa", "mediocampista", "volante", "portero", "arquero", "selección", "mundial", "copa",
    "clásico", "estadio", "penal", "árbitro", "var", "fichaje", "dt ",
)
# Other sports that general sports feeds mix in; dropped in football mode
# unless the text also carries a football signal stronger than these.
OTHER_SPORTS: tuple[str, ...] = (
    "tenis", "atp", "wta", "nba", "baloncesto", "básquet", "fórmula 1", "f1", "motogp", "ciclismo", "tour de francia",
    "béisbol", "mlb", "nfl", "ufc", "boxeo", "golf", "pga", "voleibol", "atletismo", "natación", "rugby", "hockey",
)


def competition(competition_id: str) -> Competition | None:
    return next((c for c in COMPETITIONS if c.id == competition_id), None)


def focus(focus_id: str) -> Focus | None:
    return next((f for f in FOCUSES if f.id == focus_id), None)
