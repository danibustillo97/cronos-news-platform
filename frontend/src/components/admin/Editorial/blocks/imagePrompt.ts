// Image prompt builder: turns the article into a precise prompt for an image
// generator (ChatGPT/DALL·E in Spanish, Midjourney/Leonardo in English).
//
// Editorial rules baked in, on purpose:
//  * No recognisable real people. A fake photo of a real player is a
//    likeness-rights risk and Google News/Discover treat it as misleading.
//    Players appear from behind, in silhouette or out of focus.
//  * No crests, logos, sponsors or text (models also render text badly).
//  * 3:2 (1536×1024): exactly the portal's cover frame; subject centred with
//    side room so 16:9 / 1:1 social crops still work.
//  * The caption discloses it: "Imagen ilustrativa generada con IA".

import { isTextBlock, plainText, type Block } from "./blockModel";

export type ImageModel = "chatgpt" | "midjourney";

export interface ImagePromptInput {
  title: string;
  excerpt: string;
  blocks: Block[];
  tags: string[];
  category: string | null;
  /** Hint from the AI draft for a body image ([IMAGEN n] placeholder). */
  suggestion?: string;
  purpose?: "cover" | "body";
}

export interface ImagePrompt {
  scene: SceneId;
  prompt: string;
  alt: string;
  caption: string;
}

type SceneId = "transfer" | "injury" | "referee" | "trophy" | "match" | "preview" | "data" | "press" | "fans" | "generic";

const SCENES: Record<SceneId, { test: RegExp; es: string; en: string; alt: string }> = {
  transfer: {
    test: /\b(fichaje|ficha|traspaso|firma|refuerzo|renov|contrato|nuevo jugador|cedido|cesion|llega a|presentado)/,
    es: "una camiseta de fútbol nueva sostenida en alto frente a una pared de prensa, flashes de cámaras, contrato y bolígrafo sobre una mesa en primer plano, la persona que la sostiene de espaldas o fuera de foco",
    en: "a brand-new football jersey held up in front of a press backdrop, camera flashes, a contract and pen on a table in the foreground, the person holding it seen from behind or out of focus",
    alt: "Camiseta de fútbol presentada ante la prensa, ilustración de un fichaje",
  },
  injury: {
    test: /\b(lesion|lesionado|parte medico|rotura|ligamento|desgarro|baja por|quirofano|operado|recuperacion)/,
    es: "un futbolista en silueta sentado en el césped sujetándose la rodilla, personal médico acercándose desenfocado, luz de estadio dura y dramática",
    en: "a silhouetted footballer sitting on the pitch holding his knee, out-of-focus medical staff approaching, harsh dramatic stadium light",
    alt: "Futbolista lesionado sobre el césped, imagen ilustrativa",
  },
  referee: {
    test: /\b(var|arbitr|juez|penal|penalti|expulsion|tarjeta roja|polemica|audios)/,
    es: "un árbitro de espaldas mostrando una tarjeta, un monitor de VAR a un lado del campo, jugadores desenfocados rodeándolo, tensión, estadio de noche",
    en: "a referee seen from behind raising a card, a VAR monitor at the side of the pitch, blurred players surrounding him, tension, night stadium",
    alt: "Árbitro mostrando una tarjeta junto al monitor del VAR",
  },
  trophy: {
    test: /\b(campeon|titulo|levanta la copa|trofeo|corona|tricampeon|bicampeon|estrella)/,
    es: "un trofeo dorado levantado en alto por manos de jugadores de espaldas, confeti y fuegos artificiales en el estadio, euforia",
    en: "a golden trophy lifted high by players seen from behind, confetti and fireworks in the stadium, euphoria",
    alt: "Jugadores levantando un trofeo entre confeti",
  },
  match: {
    test: /\b(gana|gano|vence|vencio|golea|goleada|triunfo|victoria|derrota|empate|empato|remonta|clasico|gol de|goles)/,
    es: "la celebración de un gol en un estadio lleno de noche, jugadores de espaldas abrazándose frente a la tribuna, la afición desenfocada al fondo",
    en: "a goal celebration in a packed stadium at night, players seen from behind embracing in front of the stands, fans out of focus in the background",
    alt: "Celebración de un gol en un estadio lleno",
  },
  preview: {
    test: /\b(previa|donde ver|a que hora|horario|canal|alineaciones probables|como ver|en vivo|vs\.?)\b/,
    es: "un estadio vacío minutos antes del partido, balón en el punto central, reflectores encendidos, césped perfecto, atmósfera de expectativa",
    en: "an empty stadium minutes before kick-off, ball on the centre spot, floodlights on, perfect grass, sense of anticipation",
    alt: "Balón en el centro del campo antes del partido",
  },
  data: {
    test: /\b(record|estadistica|datos|racha|goleador|ranking|cifras|historico|promedio|numeros)/,
    es: "una visualización abstracta y elegante sobre un campo de fútbol visto desde arriba, líneas del campo iluminadas, trayectorias de pases en luz neón, sin texto ni números",
    en: "an elegant abstract visualisation over a football pitch seen from above, glowing pitch lines, passing trajectories as neon light trails, no text or numbers",
    alt: "Visualización de datos sobre un campo de fútbol",
  },
  press: {
    test: /\b(tecnico|entrenador|dt|rueda de prensa|declaraciones|dijo|afirmo|aseguro|entrevista)/,
    es: "una sala de rueda de prensa con varios micrófonos sobre la mesa, una silla vacía o una persona de espaldas, focos y fondo desenfocado",
    en: "a press conference room with several microphones on the table, an empty chair or a person seen from behind, spotlights and a blurred backdrop",
    alt: "Micrófonos en una rueda de prensa de fútbol",
  },
  fans: {
    test: /\b(hincha|aficion|barra|tribuna|seguidores)/,
    es: "una tribuna repleta de hinchas con bufandas y banderas, humo de colores, vista desde atrás, emoción",
    en: "a stand packed with fans waving scarves and flags, coloured smoke, viewed from behind, emotion",
    alt: "Hinchas en la tribuna con banderas y bufandas",
  },
  generic: {
    test: /$^/,
    es: "un balón de fútbol sobre el césped de un estadio iluminado de noche, profundidad de campo reducida, ambiente épico",
    en: "a football on the grass of a floodlit stadium at night, shallow depth of field, epic atmosphere",
    alt: "Balón de fútbol en un estadio iluminado",
  },
};
const SCENE_ORDER: SceneId[] = ["transfer", "injury", "referee", "trophy", "match", "preview", "data", "press", "fans"];

// Kit colours only (never crests or sponsors).
const TEAM_COLORS: { names: string[]; es: string; en: string }[] = [
  { names: ["millonarios"], es: "azul y blanco", en: "blue and white" },
  { names: ["atletico nacional", "nacional"], es: "verde y blanco", en: "green and white" },
  { names: ["america de cali"], es: "rojo", en: "red" },
  { names: ["santa fe"], es: "rojo y blanco", en: "red and white" },
  { names: ["junior"], es: "rayas rojas y blancas con detalles azules", en: "red and white stripes with blue details" },
  { names: ["deportivo cali"], es: "verde y blanco", en: "green and white" },
  { names: ["once caldas"], es: "blanco con detalles rojos y negros", en: "white with red and black details" },
  { names: ["medellin", "dim"], es: "rojo y azul", en: "red and blue" },
  { names: ["tolima"], es: "vinotinto y dorado", en: "wine red and gold" },
  { names: ["bucaramanga"], es: "amarillo y verde", en: "yellow and green" },
  { names: ["seleccion colombia", "seleccion colombiana"], es: "amarillo, azul y rojo", en: "yellow, blue and red" },
  { names: ["real madrid"], es: "blanco", en: "all white" },
  { names: ["barcelona", "barca"], es: "azulgrana (azul y granate)", en: "deep blue and garnet" },
  { names: ["atletico de madrid"], es: "rayas rojas y blancas", en: "red and white stripes" },
  { names: ["manchester city"], es: "celeste", en: "sky blue" },
  { names: ["manchester united"], es: "rojo", en: "red" },
  { names: ["liverpool"], es: "rojo", en: "red" },
  { names: ["arsenal"], es: "rojo con mangas blancas", en: "red with white sleeves" },
  { names: ["chelsea"], es: "azul rey", en: "royal blue" },
  { names: ["bayern"], es: "rojo y blanco", en: "red and white" },
  { names: ["dortmund"], es: "amarillo y negro", en: "yellow and black" },
  { names: ["juventus"], es: "rayas blancas y negras", en: "black and white stripes" },
  { names: ["inter de milan", "inter"], es: "rayas negras y azules", en: "black and blue stripes" },
  { names: ["milan"], es: "rayas rojas y negras", en: "red and black stripes" },
  { names: ["boca"], es: "azul y amarillo", en: "blue and gold" },
  { names: ["river plate", "river"], es: "blanco con banda roja diagonal", en: "white with a red diagonal sash" },
  { names: ["estudiantes"], es: "rayas rojas y blancas", en: "red and white stripes" },
  { names: ["seleccion argentina", "argentina"], es: "rayas celestes y blancas", en: "sky-blue and white stripes" },
  { names: ["brasil", "selecao"], es: "amarillo y verde", en: "yellow and green" },
  { names: ["flamengo"], es: "rayas rojas y negras", en: "red and black stripes" },
  { names: ["palmeiras"], es: "verde", en: "green" },
];

function fold(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function detectScene(text: string): SceneId {
  const t = fold(text);
  return SCENE_ORDER.find((id) => SCENES[id].test.test(t)) ?? "generic";
}

export function detectColors(text: string, max = 2): { es: string[]; en: string[] } {
  const t = fold(text);
  // Longest names claim their span first, so "Inter de Milán" is never also "Milan".
  const names = TEAM_COLORS.flatMap((team) => team.names.map((name) => ({ team, name })))
    .sort((a, b) => b.name.length - a.name.length);
  const claimed: [number, number][] = [];
  const firstAt = new Map<(typeof TEAM_COLORS)[number], number>();
  for (const { team, name } of names) {
    const re = new RegExp(`(^|[^a-z0-9])(${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=$|[^a-z0-9])`, "g");
    for (const m of t.matchAll(re)) {
      const start = (m.index ?? 0) + m[1].length;
      const end = start + name.length;
      if (claimed.some(([a, b]) => start < b && end > a)) continue;
      claimed.push([start, end]);
      firstAt.set(team, Math.min(firstAt.get(team) ?? Infinity, start));
    }
  }
  const hits = [...firstAt.entries()].sort((a, b) => a[1] - b[1]).slice(0, max).map(([team]) => team);
  return { es: hits.map((h) => h.es), en: hits.map((h) => h.en) };
}

export function buildImagePrompt(input: ImagePromptInput, model: ImageModel): ImagePrompt {
  const body = input.blocks.filter(isTextBlock).slice(0, 4).map((b) => plainText(b.html)).join(" ");
  // The headline decides the scene; the body only breaks ties.
  const scene = input.suggestion ? detectScene(input.suggestion) : detectScene(input.title) !== "generic" ? detectScene(input.title) : detectScene(`${input.excerpt} ${body}`);
  const colors = detectColors(`${input.title} ${input.tags.join(" ")} ${input.excerpt}`);
  const s = SCENES[scene];
  const purpose = input.purpose ?? "cover";
  const caption = "Imagen ilustrativa generada con IA";

  if (model === "midjourney") {
    const kit = colors.en.length ? `, players wearing ${colors.en.join(" versus ")} kits` : "";
    const brief = input.suggestion ? `, ${input.suggestion}` : "";
    const prompt = `editorial sports photojournalism, ${s.en}${kit}${brief}, shot on a full-frame camera with a 70-200mm lens, dramatic stadium lighting, shallow depth of field, high contrast, rich detail, subject centred with breathing room on both sides, players seen from behind or silhouetted, no identifiable faces --ar 3:2 --style raw --no text, letters, logos, crests, sponsors, watermark, recognizable faces`;
    return { scene, prompt, alt: s.alt, caption };
  }

  const kit = colors.es.length ? `\n- Colores de los equipos: ${colors.es.join(" contra ")} (solo los colores de la ropa, sin escudos).` : "";
  const brief = input.suggestion ? `\n- Lo que pidió la redacción para esta imagen: ${input.suggestion}.` : "";
  const prompt = `Genera una imagen ${purpose === "cover" ? "de portada" : "para el cuerpo"} para una noticia de fútbol de un medio digital.

NOTICIA: ${input.title}${input.excerpt ? `\nCONTEXTO: ${input.excerpt}` : ""}

ESCENA
- ${s.es[0].toUpperCase()}${s.es.slice(1)}.${kit}${brief}

ESTILO
- Fotoperiodismo deportivo realista, como una foto de agencia (AP, Reuters, Getty).
- Cámara full-frame con teleobjetivo 70-200 mm, profundidad de campo reducida, luz de estadio dramática, alto contraste y mucho detalle.

FORMATO
- Horizontal 3:2, 1536×1024 píxeles.
- Sujeto principal centrado con aire a ambos lados (se recortará también a 16:9 y 1:1 para redes).

PROHIBIDO
- Rostros reconocibles o personas reales identificables: jugadores de espaldas, en silueta o desenfocados.
- Escudos, logos, marcas, patrocinadores, banderas con símbolos oficiales.
- Cualquier texto, letra, número o marca de agua.

ENTREGA
- Genera la imagen directamente, sin hacer preguntas ni ofrecer variantes antes.
- Entrégala en 1536×1024 para descargarla con un clic.`;
  return { scene, prompt, alt: s.alt, caption };
}
