# NEXUS SPORT — Televisión deportiva digital automatizada
## Propuesta integral: auditoría, flujo de producción, experiencia, arquitectura y fases

Estado: **propuesta para aprobación** (26-nov-2026). No se ha modificado código para esta etapa.
Reglas que rigen todo el plan: no romper funciones existentes, datos reales, atajos ni integraciones; no inventar
estadísticas ni acontecimientos; implementar por fases que se puedan entregar y probar por separado.

---

## 1. Resumen

Hoy NEXUS SPORT BROADCAST ya produce TV: compone Program/Preview, emite (WHIP) y graba, tiene un motor gráfico
con 25+ diseños, sincroniza el partido en vivo con ESPN, detecta goles/tarjetas/cambios, arma un programa automático
de resumen con análisis, y tiene votaciones y comentarios en el portal. **Lo que falta no son botones: es el
"cerebro" que une todo eso alrededor de un evento** — una escaleta por fases (previa → en vivo → post), un motor de
reglas que convierta cada acontecimiento confirmado en contenido, un módulo de audiencia que alimente la emisión y
un presentador (Noris) que intervenga.

La propuesta: separar el sistema en **8 motores** con contratos claros, construir un **bus de eventos** con
**puerta de confirmación**, un **motor de reglas** con tres niveles de autonomía (automático / con aprobación /
manual) y una **escaleta** programable por evento, y rediseñar la sala de control alrededor de ese flujo.

---

## 2. Auditoría de lo que existe (y qué se reutiliza)

| Motor propuesto | Lo que ya existe (archivo) | Estado | Se reutiliza |
|---|---|---|---|
| **Sports Data Engine** | `/api/matches/{league}/{id}` (detalle ESPN: eventos, stats, alineaciones, comentario), `/api/football/fixtures`, `/api/football/recap` (jornada + cuotas), `/api/sports/scoreboard`, `/api/matches/moments`, `/api/matches/insights/player/{id}`, `/api/insights/feed` (antesalas, impacto en tabla, favorito, jugadores clave) | **Sólido** | Todo. Falta normalizar en un solo cliente con caché y estado de frescura. |
| **Match Event Engine** | `football/autoSync.ts` (`planSync`: periodo, reloj, añadido, marcador, tarjetas, eventos nuevos), `useFootballMatch` (modo automático cada 15 s, `highlight`, gol anulado = `void`), `liveBoard.ts` (goles de otros partidos) | **Parcial** | `planSync` es la base. Falta: evento normalizado con id estable, **estado de confirmación**, fin de partido como evento, bus único. |
| **Automation / Rundown Engine** | Reacciones fijas en `BroadcasterView` (gol → tarjeta de gol + dato; tarjeta/cambio → gráfico), `recap.ts` + `AutoShowPanel` (guion automático de resumen) | **Parcial, cableado a mano** | La lógica de cada reacción y el guion del resumen. Falta: reglas declarativas, modos de autonomía, cola de aprobación, escaleta por fases con horario. |
| **Graphics Engine** | `designs.ts` (marcadores por competición, gol, multi, cinta, alineaciones, stats, previa, votación, cambio, tarjeta, línea de tiempo, duelo, resultado de debate, resumen, publicidad), `raster.ts`, caché del compositor, `placement.ts` (no tapa cámaras), `setGraphicData` | **Sólido** | Todo. Falta: catálogo con metadatos (qué datos pide cada gráfico) para que las reglas lo usen. |
| **Audience Engagement Engine** | Backend: `polls.py` (público: listar/ver/votar; admin: crear/editar/cerrar), `social.py` (reacciones y comentarios por objetivo), votaciones automáticas "¿Quién gana?" en `insights.py`; Studio: `DataDeck` lanza debates, `pollBoard.ts` refresca la votación al aire | **Parcial** | Votaciones, debates y comentarios. Falta: **preguntas de la audiencia** con moderación, cola "a pantalla", comparativas votables, resultados como gráfico (ya existe `poll-result`). |
| **Virtual Presenter Engine** | `presenterLayer.ts` (capa en el compositor, Program/Preview), Three.js + R3F + drei instalados, **TTS** en `/api/tts` (edge-tts, voces y velocidad) | **Base lista, sin modelo** | Capa y TTS. **Bloqueado**: no existe `noris.glb` (solo imagen de referencia y boceto de Blender). |
| **Broadcast / Streaming Engine** | `compositor.ts`, transiciones (corte/fundido/barrido/negro), `audioMixer.ts` (bus de programa, SFX, música), `live/whip.ts` (Emitir), grabación, invitados por enlace (WebRTC), radio | **Sólido** | Todo. |
| **Production Control Interface** | `BroadcasterView.tsx` (~3.000 líneas), `FootballStage` (Directo/Preparar, PVW/PGM, TAKE, biblioteca, panel contextual), sistema de diseño `--nx-*` | **Funcional pero monolítico** | Componentes y atajos. Se divide por zonas a medida que los motores salen del componente. |

**Hallazgo principal de arquitectura:** casi toda la lógica de negocio (reacciones, buses, datos, gráficos) vive
dentro de `BroadcasterView.tsx`. Para que cada motor evolucione por separado hay que **extraer** esa lógica a
módulos puros con interfaces, sin reescribir la UI de golpe.

---

## 3. Flujo completo de producción de un evento

```
T-60'            T-15'         T-0 (pitazo)                    FT (final)             FT+30'
 │ PREVIA ─────────────────────┤ EN VIVO ────────────────────────┤ POSTPARTIDO ─────────┤
 │ apertura · cuenta regresiva │ marcador+reloj · eventos        │ resultado definitivo │
 │ equipos · forma · H2H       │ gol/tarjeta/cambio confirmados  │ resumen estadístico  │
 │ alineaciones (≈T-60)        │ stats cada X min · comparativas │ figura del partido   │
 │ formaciones · pronóstico    │ encuestas · preguntas · datos   │ impacto en la tabla  │
 │ encuesta "¿quién gana?"     │ entretiempo (segmento propio)   │ encuesta final       │
 │ Noris presenta              │ Noris interviene en momentos    │ debate · redes       │
```

- **Fase actual del programa** se decide sola con el estado real del partido (`pre` / `in` / `post` de ESPN) y la
  hora programada; el realizador puede adelantar o retrasar.
- **Escaleta (rundown)**: lista de segmentos con hora relativa al pitazo (p. ej. *T-15 Alineaciones*,
  *HT Entretiempo*, *FT+2 Resumen*). Cada segmento = escena + gráficos + (opcional) guion de Noris + duración.
- Los acontecimientos en vivo **interrumpen** la escaleta según prioridad (un gol pasa por delante de un dato
  curioso) y luego se vuelve al segmento.

---

## 4. Experiencia: la sala de control alrededor del flujo

```
┌ BARRA DE PRODUCCIÓN ─ NEXUS SPORT · PREVIA ▸ EN VIVO ▸ POST · reloj del show · partido 1-0 72' · ● AL AIRE · REC ┐
├ ESCALETA ────────────┬──────────── PREVIEW ─────────────┬──────────── PROGRAM ────────────┬ MONITOR DE EVENTOS ─┤
│ ▸ T-15 Alineaciones  │                                  │                                 │ 72' ⚽ GOL Díaz       │
│ ● 72' En vivo        │            (verde)               │             (rojo)              │   ✔ confirmado       │
│   HT Entretiempo     │                                  │                                 │ ─ AUTOMATIZACIÓN ─── │
│   FT Resumen         ├─ Corte · Fundido · Barrido ─ [ TAKE ] ─────────────────────────────┤ ▢ Tarjeta de gol  ▶ │
│ BIBLIOTECA (escenas, │ Números 1–9 (partidos) · gráficos del partido                      │ ▢ Stats goleador  ✔✖│
│ estudios, gráficos)  │                                                                    │ ▢ Encuesta        ✔✖│
├──────────────────────┴────────────────────────────────────────────────────────────────────┴──────────────────────┤
│ CONSOLA: audio (mic, invitados, música, SFX) · AUDIENCIA (votación en curso 62%·38%, preguntas 4) · NORIS (estado) │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Izquierda = qué viene** (escaleta + biblioteca). **Centro = qué se ve** (PVW/PGM). **Derecha = qué pasó y qué
  propone la automatización** (monitor de eventos + cola con ✔ aprobar / ✖ descartar / ▶ al aire). **Abajo = qué
  se oye y quién participa** (audio, audiencia, Noris).
- Se conserva todo lo construido: sistema de diseño `--nx-*`, Directo/Preparar, TAKE, teclas 1–9 / 0 / letras,
  F1–F5, Espacio/Enter, Supr, tocar para ocultar.
- En celular: Program arriba, pestañas abajo (*Escaleta · Eventos · Gráficos · Audiencia · Audio*); la cola de
  aprobación es la pestaña con aviso.

---

## 5. Motor de automatización (Event → Rule → Content → Graphic → Scene → Emisión)

### 5.1 Evento normalizado y puerta de confirmación
```ts
interface MatchEvent {
  id: string;                 // estable: fuente + id del evento (ESPN keyEvent / play id)
  matchId: string; league: string;
  type: "kickoff" | "goal" | "own-goal" | "penalty-goal" | "goal-disallowed" | "yellow" | "red" | "sub"
      | "half-time" | "second-half" | "full-time" | "var" | "lineups-published";
  minute: string; team?: "home" | "away"; player?: Ref; assist?: Ref; playerOut?: Ref;
  score?: { home: number; away: number };
  source: "espn"; observedAt: number;
  status: "observed" | "confirmed" | "retracted";
}
```
- **Nunca se emite lo no confirmado.** Un evento pasa a `confirmed` cuando: aparece en **dos lecturas seguidas** de
  la fuente (≥ 15 s), el marcador de la fuente es coherente con él y no hay texto de revisión VAR pendiente.
  Si desaparece o llega "goal disallowed", pasa a `retracted` y se retiran sus gráficos (ya existe el caso "gol
  anulado").
- En **automatización completa** solo actúan eventos `confirmed`. En **con aprobación** se pueden *preparar* en
  Preview desde `observed`, pero el TAKE exige `confirmed` (el botón muestra el estado).

### 5.2 Reglas declarativas
```ts
interface Rule {
  id: string; on: MatchEvent["type"][]; when?: (e, ctx) => boolean;   // p. ej. solo partido principal
  mode: "auto" | "approval" | "manual";                               // por regla, configurable
  priority: number;                                                   // gol 100, tarjeta roja 90, dato 20…
  actions: Action[];
}
type Action =
  | { do: "update-scoreboard" } | { do: "log-timeline" }
  | { do: "graphic"; variant: GraphicVariant; data: DataQuery; seconds?: number }
  | { do: "fetch"; query: DataQuery }                 // stats del goleador, tabla…
  | { do: "poll"; template: PollTemplate }            // encuesta relacionada
  | { do: "presenter"; script: ScriptTemplate }       // intervención de Noris
  | { do: "scene"; scene: SceneId } | { do: "sfx"; name: string };
```
Ejemplo — **gol confirmado** (todas las piezas ya existen; la regla solo las ordena):
1. `update-scoreboard`, `log-timeline` → `planSync` + línea de tiempo.
2. `graphic goal-pro` con escudo, autor, minuto, asistencia → `setGoalCard`.
3. `fetch player-insight(scorer)` → `/api/matches/insights/player/{id}` → dato en la tarjeta.
4. `graphic duel(scorer, rival destacado)` en **aprobación** (no tapa el gol).
5. `poll` "¿Quién gana ahora?" en **aprobación**.
6. `presenter` guion "gol" para Noris (cuando exista el modelo).

### 5.3 Cola, prioridad y seguridad
- **Cola de contenido** (derecha): cada acción en modo aprobación aparece como tarjeta con origen, datos y
  caducidad (un "stats del goleador" caduca a los 3 min). ✔ la manda a Preview o directo según Directo/Preparar.
- **Prioridad y espacio**: una regla de mayor prioridad desplaza a otra en curso; el `settle` actual garantiza que
  nada tape la cámara ni otro gráfico.
- **Freno de mano**: modo global *Manual* detiene toda automatización al instante; "Ocultar todo" sigue siendo pánico.
- **Trazabilidad**: cada gráfico emitido guarda qué evento/regla/dato lo produjo (registro exportable).

### 5.4 Escaleta (Rundown Engine)
```ts
interface Segment { id; title; at: { phase: "pre" | "live" | "post"; offsetMin?: number; on?: MatchEvent["type"] };
  scene: SceneId; graphics: GraphicCue[]; presenter?: ScriptTemplate; durationSec?: number; mode: Rule["mode"] }
```
- Plantillas por fase: **Previa** (apertura, cuenta regresiva, equipos, alineaciones al publicarse, formaciones,
  historial/H2H, pronóstico de mercado, encuesta), **En vivo** (marcador fijo, stats cada 15', entretiempo con
  resumen del primer tiempo), **Post** (resultado, resumen estadístico, figura, impacto en la tabla, encuesta final,
  debate, piezas para redes). El programa automático actual (`recap`) se convierte en la plantilla de *Post* y
  *Jornada*.
- **Figura del partido**: solo con datos reales (goles, asistencias, y estadísticas individuales cuando la fuente
  las publique) o por **votación de la audiencia**; si no hay datos suficientes, se ofrece la votación en vez de
  inventar una calificación.

---

## 6. Motor de audiencia

| Tipo | Hoy | Propuesta |
|---|---|---|
| Encuesta / votación | `polls.py` + gráfico en vivo + `poll-result` | Plantillas ligadas a eventos (gol, roja, entretiempo, final), cierre automático, resultado como gráfico. |
| Debate | `DataDeck` → votación tipo debate | Igual, con fase (previa/post) y argumento de cada opción. |
| **Preguntas de la audiencia** | — | Nuevo: preguntas desde el portal (reutiliza `social.py` comentarios con `target_type="broadcast"`), **moderación** (aprobar/ocultar), cola "a pantalla", gráfico de pregunta. |
| Comentarios | `social.py` | Selección de comentarios destacados como cintillo o tarjeta. |
| Comparativas votables | — | "¿Quién fue mejor?" entre dos jugadores con su `duel` real al lado. |

Todo contenido de audiencia pasa por moderación antes de salir al aire (nunca texto de usuarios sin revisar en
automático completo).

---

## 7. Noris — presentador virtual (arquitectura; implementación bloqueada por el modelo)

```ts
interface PresenterEngine {
  load(url: string): Promise<void>;                       // noris.glb (useGLTF)
  setState(s: "idle" | "walk" | "run" | "talk" | "gesture", opts?): void;   // AnimationMixer, transiciones
  say(script: string, voice?: string): Promise<void>;     // /api/tts → audio al bus de programa + visemas
  place(rect, bus: "program" | "preview" | "both"): void; // presenterLayer.ts
}
```
- Render R3F fuera de pantalla con alfa → `setPresenterLayer` → el compositor lo dibuja en la emisión.
- Guiones contextuales generados por plantillas con datos reales (mismas frases calculadas de `recap.ts`), nunca
  datos inventados; intervenciones disparadas por reglas (`do: "presenter"`).
- Sincronización labial: la voz sale de `/api/tts` (edge-tts); los visemas se aproximan por energía del audio o
  por marcas de palabras si el proveedor las entrega; requiere *morph targets* en el GLB.
- **Requisito para empezar**: `noris.glb` con esqueleto, clips *idle/walk/run* y, para expresiones y labios,
  *blendshapes* (visemas ARKit o similares).

---

## 8. Arquitectura de módulos (para que cada motor evolucione solo)

```
frontend/src/broadcast/
  data/        sportsData.ts      cliente único (detalle, fixtures, insights, recap) con caché y frescura
  events/      matchEvents.ts     normaliza + puerta de confirmación + bus (subscribe/publish)   ← autoSync.ts
  automation/  rules.ts · engine.ts · queue.ts · rundown.ts · templates/(pre|live|post).ts        ← reacciones de BroadcasterView, recap.ts
  graphics/    designs.ts · catalog.ts (qué datos pide cada gráfico) · placement.ts             ← football/*
  audience/    polls.ts · questions.ts · moderation.ts
  presenter/   presenterLayer.ts · engine.ts (R3F/GLB) · scripts.ts
  output/      compositor.ts · audioMixer.ts · whip.ts · recorder
  control/     componentes de la sala (Barra, Escaleta, PVW/PGM, MonitorEventos, Cola, Consola)
backend: polls.py · social.py (+ preguntas) · matches.py · insights.py — sin cambios de contrato existentes.
```
- Los motores se comunican por **eventos y comandos tipados** (`MatchEvent`, `Cue`, `Command`), no llamándose
  por dentro. La UI solo envía comandos y muestra estado.
- La migración es **por extracción**: se mueve una pieza, se deja el componente usando el nuevo módulo, se prueba;
  `BroadcasterView` adelgaza en cada fase sin "gran reescritura".

---

## 9. Fases de implementación (cada una entregable y verificable)

| Fase | Entrega | Criterio de aceptación |
|---|---|---|
| **A. Eventos y datos** | `events/` (evento normalizado, puerta de confirmación, fin de partido, gol anulado) y `data/` (cliente único); `useFootballMatch` usa el bus. | Pruebas con partidos reales grabados: ningún evento sale sin confirmar; un gol anulado se retracta; mismo comportamiento visible que hoy. |
| **B. Motor de reglas + cola** | `automation/` con las reacciones actuales convertidas en reglas; modos auto/aprobación/manual por regla; **monitor de eventos** y **cola** en la sala. | Gol/tarjeta/cambio reproducidos desde reglas; en "aprobación" nada sale sin ✔; freno de mano global. |
| **C. Escaleta por fases** | `rundown.ts`, plantillas Previa / En vivo / Post, programación por hora del partido, segmento de entretiempo y postpartido; el programa automático actual pasa a ser plantilla. | Un partido real recorrido de T-15 a FT+10 en simulación con su escaleta; interrupción por gol y regreso al segmento. |
| **D. Audiencia** | Preguntas con moderación, plantillas de encuesta por evento, comentarios destacados, comparativa votable; todo como gráficos. | Pregunta enviada desde el portal → moderada → al aire; encuesta disparada por regla y su resultado como gráfico. |
| **E. Noris** *(requiere `noris.glb`)* | `presenter/engine.ts` (GLB, estados, cámara, luces, sombras), voz con `/api/tts`, guiones por plantilla, intervenciones por regla. | Noris idle/walk en un estudio, presenta una alineación con voz; sin modelo no hay sustituto. |
| **F. Sala de control final + rendimiento** | Layout de la sección 4 (escritorio y celular), extracción final de `BroadcasterView`, presupuesto de cuadros, prueba de una emisión completa. | Programa completo de un partido real producido con intervención humana mínima; 30 fps en Program. |

Orden recomendado: **A → B → C → D**, con **E** en cuanto exista el modelo y **F** al cierre (la UI se va
ajustando en cada fase, no al final de golpe).

---

## 10. Decisiones que necesito de ti

1. **Autonomía por defecto**: ¿gol, tarjetas y cambios en *automático* y todo lo demás (duelos, encuestas,
   Noris) en *aprobación*? (recomendado)
2. **Latencia de la fuente**: ESPN se actualiza con retraso (≈15–60 s) y la confirmación añade una lectura más.
   ¿Aceptamos ese retraso a cambio de no emitir nunca un gol que luego se anule?
3. **Preguntas de la audiencia**: ¿solo desde el portal NEXUS (con cuenta) o también desde el chat de Kick/TikTok?
   (lo segundo necesita integrar sus APIs de chat).
4. **Noris**: ¿quién produce el `noris.glb` (con esqueleto, clips y visemas) y para cuándo?
