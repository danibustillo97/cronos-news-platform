# NEXUS SPORT AI Broadcast: Virtual Studio, editorial engine y director

La pestaña **▶ Programa automático** del broadcaster (una sola; reemplaza a la antigua de
diapositivas y a «★ Programa IA») genera y emite un programa deportivo completo a partir de datos
reales: escenario 3D, escaleta editorial, narración, cámaras, gráficos, música y audiencia.

**Emitir programa** hace todo con un botón: recopila los datos (si no hay edición), arma la
escaleta, pone el estudio en Program, sale del modo «Preparar» para que el operador vea lo que está
al aire, y arranca. Con el narrador local habla; sin él, va con subtítulos.

## Arquitectura (sin segundo motor)

```
data.ts ──► editorial.ts ──► Edition (segmentos → beats) ──► director.ts ──► renderer.ts
(fuentes reales) (selección,                (AUTO/SEMI/MANUAL,        (Virtual Studio 3D
                  narrativa,                 sincroniza voz,           o fallback 2D
                  duraciones)                cámara, pantallas,        + overlay)
                                             rótulos, música)               │
controller.ts: estado fuera de React (no se corta al cambiar de pestaña)    ▼
ShowPanel.tsx: centro de dirección y editor         compositor.setLiveSource → fondo vivo de
                                                    Program → /broadcast/output (sin cambios)
```

- **El estudio entra a Program como fuente viva** (`setLiveSource`): el compositor copia su último
  cuadro en cada tick, sin capturar ni codificar. Preview/Program, TAKE, los demás gráficos (marcador,
  alertas de gol, cinta) y `/broadcast/output` funcionan igual.
- **La narración es opcional por diseño.** Si el servicio local de voz responde, el director usa la
  voz. Si no, muestra subtítulos con la duración estimada de lectura. El motor visual no depende de
  ningún proveedor (ver `NARRATOR.md`).

## Virtual Studio (`show/studio3d.ts`)

Un solo estudio en Three.js (dependencia ya instalada, sin modelos ni texturas descargadas):

- **Arquitectura:** pantalla LED principal 16:9 con marco metálico y reflejo en el piso, dos torres
  laterales en ángulo, escenario central con aro iluminado y suelo de grafito con retícula y
  perspectiva.
- **Elementos fijos:** pilares con franjas amarillas, paneles de fondo, estructura de techo, letrero
  NEXUS SPORT y un espacio reservado para Noris (marco holográfico, sin personaje 3D).
- **Iluminación:** ambiente, hemisférica, focos y luz de contorno amarilla. Los conos de luz solo
  aparecen en MEDIUM y HIGH, y las sombras solo en HIGH.
- **Ocho configuraciones del mismo set**, que cambian la cámara, los elementos en escena y la luz de
  acento:

| Configuración | Cámara | Escena |
|---|---|---|
| OPENING | WIDE | aro intenso, espacio Noris |
| NEWSROOM | HERO | mesa de noticias |
| MATCH CENTER | SCREEN | pantalla protagonista |
| ANALYSIS | DATA | mesa + anillos de datos |
| STATS (Data Arena) | DATA | anillos de datos |
| DEBATE | DEBATE | dos atriles, espacio Noris |
| UPCOMING | SPLIT | pantalla + torres |
| CLOSING | CLOSING | plano general alejándose |

- **Cámaras:** WIDE, HERO, SCREEN, DATA, SPLIT, DEBATE y CLOSING, con movimientos suaves
  (*ease-in-out*). No hay movimiento constante: la cámara se mueve solo cuando cambia la historia, y
  más despacio en los momentos CRITICAL.
- **Rendimiento:** renderiza bajo demanda (0 cuadros por segundo con la escena quieta) y tiene tres
  perfiles:
  - LOW: 960×540 a 24 fps;
  - MEDIUM: 1280×720 a 30 fps;
  - HIGH: 1920×1080 con sombras.

  `dispose()` libera la GPU.
- **Fallback 2D** (`drawFallback`) si el navegador no tiene WebGL.

### Estudio suave (v2) e iluminación en vivo

- **Diseño minimalista y redondeado:**
  - ciclorama curvo infinito que se funde con el piso;
  - pantallas flotantes de esquinas redondeadas, con halo suave;
  - tarima de borde redondeado que parece flotar sobre un anillo de luz;
  - mesa y atriles de líneas redondeadas en blanco perla;
  - lamas de luz verticales y sombras de contacto suaves.

  La mayor parte de la luz va «horneada» en gradientes, así que es barata en GPU integrada.
- **Panel «Escenario e iluminación»** (se aplica en vivo y se guarda en el PC):
  - presets: Nexus noche, Estudio claro, Grafito suave, Atardecer, Hielo, Champions y Césped;
  - color de luz, fondo arriba y abajo, piso;
  - exposición, luz principal, relleno, contraluz, brillo de luces, piso brillante y profundidad;
  - cámara con respiración suave (deriva lenta de unos centímetros, a 24 cuadros por segundo como
    máximo; se apaga para volver a renderizar solo bajo demanda);
  - botón «Ver escenario» para recorrer las ocho configuraciones.

## Gráficos (`show/screens.ts`)

Diseñados como superficies del set (LED y torres), con la identidad NEXUS: grafito, amarillo, blanco
y gris metálico. Tipos de contenido:

- título;
- titulares;
- resultado (escudos, marcador y goleadores, revelados en orden);
- estadísticas comparadas (una barra por frase del narrador);
- noticia con fuente y fecha, y la marca «SIN CONFIRMAR» cuando aplica;
- tabla (de su grupo si es fase de grupos);
- agenda en hora de Colombia;
- votación (solo votos reales; si no hay, se dice que no está abierta);
- números del periodo;
- cierre.

Overlay al aire: mosca NEXUS SPORT, reloj, segmento, rótulo inferior con fuente y subtítulos.

## Motor editorial y narrativo (`show/editorial.ts`)

**Modalidades:** Resumen de ayer, Actualidad de hoy, Balance semanal (siete días) y Próximos días.
Se pueden combinar.

**Selección:** la relevancia combina:
- el peso de la competición para la audiencia colombiana;
- los goles y la goleada;
- la sorpresa (el ganador pagaba al menos 2,6 en las cuotas previas que conserva ESPN);
- el clásico, la expulsión y el impacto en la tabla;
- la antigüedad.

Con eso se asigna la prioridad (CRITICAL, HIGH, MEDIUM o LOW). Los partidos en vivo confirmados son
siempre CRITICAL. Cada ítem lleva su fuente, fecha, vigencia (`validUntil`) y estado de
verificación.

**Reglas de veracidad:**
- solo cuenta como en vivo lo que el proveedor marca como LIVE, HT o BREAK;
- los partidos con hora ya pasada y las noticias fuera del periodo no salen;
- los rumores (redacción condicional) se dicen como «según…» y se marcan PROVISIONAL;
- nunca se pronostica un marcador;
- cada ítem sale en un solo segmento.

**Escaleta** (base de 30 minutos; se escala para 15, 45 y 60):

| Segmento | Mín / recomendado / máx (30 min) | Contenido |
|---|---|---|
| Apertura | 1:00 / 1:50 / 2:30 | Fecha y temas de la edición, presentados uno por uno |
| Actualidad | 1:30 / 4:40 / 6:00 | Noticias publicadas, con fuente |
| Match Center | 2:00 / 5:00 / 7:00 | Primero en vivo, luego resultados por relevancia (marcador → goles → contexto → consecuencia) |
| Análisis | 1:30 / 3:20 / 5:00 | El partido de la edición a fondo: estadísticas una por una e interpretación |
| Debate | 1:00 / 3:20 / 5:00 | Votación real del portal o la pregunta sin votos inventados |
| Data Arena | 1:30 / 3:40 / 5:00 | Números del periodo y tabla |
| Próximos días | 1:30 / 4:20 / 5:20 | Agenda en hora de Colombia con contexto de tabla, sin pronósticos |
| Cierre | 0:45 / 2:00 / 3:00 | Resumen, próximo partido y despedida |

**La duración la decide el contenido.** Si un segmento no llega al mínimo, se anota y no se
rellena; si la edición queda corta, se avisa.

**Narrativa:** cada historia es una secuencia de *beats*. Un resultado, por ejemplo, va así:
entrada → marcador → goles → dato de sorpresa → expulsión → (análisis: estadísticas una por una e
interpretación) → consecuencia en la tabla. Cada frase sale de un dato real. `speakable()` adapta
solo lo que dice la voz («37'» → 37, «9.º» → noveno, «4-1» → 4 a 1).

## Director audiovisual (`show/director.ts`)

- **Orden de cada beat:** primero los visuales (escenario → cámara → pantalla → rótulo → efecto),
  luego la voz; el siguiente beat empieza cuando la voz termina, más la pausa.
- **Precarga:** genera las dos frases siguientes mientras suena la actual.
- **Audio:** la música baja sola mientras habla el narrador (*ducking*). Los beats CRITICAL llevan un
  efecto de impacto.
- **Sin voz:** muestra subtítulos con la duración de lectura. Si una línea de voz falla o se
  demora, el programa sigue.
- **Modos:**
  - AUTO: corre toda la edición;
  - SEMI-AUTO: se detiene antes de cada segmento no aprobado;
  - MANUAL: se detiene al final de cada segmento.
- **Controles:** Play, Pausa, Reanudar, Stop, Anterior, Siguiente, Repetir, Saltar bloque, Cortar voz,
  Aprobar e Ir a un segmento.

## Centro de dirección y editor (`show/ShowPanel.tsx`)

- **Configuración:** modalidades, competiciones, duración y calidad 3D.
- **Vista previa en vivo** del estudio (el mismo canvas que va al aire) y botón «Poner en Program».
- **Estado:** escena actual y siguiente, transcurrido, restante estimado, narración actual y
  siguiente, voz o subtítulos, cuadros del estudio, fuentes consultadas y avisos.
- **Escaleta editable:**
  - aprobar, bloquear (un segmento bloqueado no se edita), omitir y reordenar;
  - cambiar el escenario;
  - ajustar la duración, recortando bloques reales sin inventar nada;
  - editar el texto de cada frase;
  - ver fuentes y motivos de selección.
- **Persistencia:**
  - guardar y cargar ediciones (las últimas 10) y exportarlas a JSON;
  - recuperar la edición y el segmento después de recargar la página.

## Pruebas

- `show/show.test.ts` (11 pruebas):
  - solo lo confirmado en vivo cuenta como en vivo;
  - periodos de cada modalidad;
  - rumores atribuidos;
  - noticias y partidos vencidos excluidos;
  - hora de Colombia y contexto de tabla;
  - sin ítems repetidos ni `undefined`;
  - estadísticas reveladas una por una;
  - debate sin votos inventados;
  - duraciones escaladas y sin relleno;
  - clásicos y sorpresas;
  - el director aplica los visuales antes de la voz, espera la aprobación en SEMI y en MANUAL, y
    usa subtítulos sin voz.
- `engine/narration.test.ts`: incluye `speakable`.
- **Navegador real (Chromium con la GPU Intel UHD 630 por D3D11)** en `/broadcast/studio-lab`:
  - ocho configuraciones del estudio capturadas;
  - edición real del 27-nov, con 12 partidos de ayer (Europa League), 2 votaciones reales,
    tablas y agenda;
  - corrida completa con la voz Kokoro `em_alex`, sincronizada;
  - memoria estable entre 94 y 101 MB.

`/broadcast/studio-lab` es un laboratorio que **solo existe en desarrollo** (404 en producción).
Corre el motor real sin el panel admin, para pruebas automáticas.

## Limitaciones actuales

- **Contenido:** la edición dura lo que dan los datos verificados. El 27-nov no hay noticias
  vigentes (la última es del 25), así que una edición de «ayer + hoy» dura unos 6 minutos y no se
  rellena.
- **Debate:** si no hay votación abierta, el director la abre desde Audiencia (función existente);
  el motor no la crea solo.
- **Narrativa por plantillas:** no hay un modelo de lenguaje, por decisión de veracidad y porque no
  hay claves de modelos.
- **Noris:** solo el espacio reservado y los contratos.
- **Sin probar con login:** la integración con Program y `/broadcast/output` desde el panel admin no
  se probó en un navegador automatizado, porque el panel requiere login. El canal de salida sí se
  probó antes (`BROADCAST_OUTPUT.md`) y el compositor recibe el estudio como una fuente más.
- **Voz:** la elección es provisional (`em_alex`); se cambia en la pestaña Narrador IA.
