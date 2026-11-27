# NEXUS SPORT AI Broadcast: auditoría (Fase 0) y plan

Fecha: 27-nov-2026. Rama: `feature/social-media-studio-v2`.

## 1. Lo que existe y funciona

| Área | Dónde | Estado verificado |
|---|---|---|
| Stack | Next.js 15, React 19, TS, Tailwind, vitest · FastAPI + pytest · Supabase | Funciona; 384 + 521 pruebas en verde |
| Autenticación admin | `middleware.ts` (cookie `cronos_access_token`, roles admin/editor) | Funciona; el broadcaster vive en `/admin` |
| Datos deportivos | ESPN público: `/api/football/fixtures`, `/api/sports/{scoreboard,day,standings}`, `/api/matches/{l}/{id}`, resúmenes ESPN en `football/recap.ts` | Funciona, con día de Colombia y estados reales (`engine/matchStatus.ts`) |
| Motor de partidos en vivo | `engine/useMatchCenter.ts`, `matchSelection.ts`, `sportsEvents.ts` | Funciona: confirmación de eventos, retracciones, multipartido |
| Motor de escenas | `compositor.ts` (Program/Preview en canvas 1920×1080), `football/designs.ts` (gráficos HTML rasterizados), `placement.ts`, `graphicsCatalog.ts` (capas y prioridades) | Funciona |
| Escenarios virtuales | `football/virtualSets.ts`: siete sets 2D dibujados en canvas como imagen fija (LED, pilares, piso) | Funciona; planos, sin profundidad ni cámara |
| Automatización | `engine/automation.ts` (reglas auto/aprobación/manual, cola, reintentos) | Funciona |
| Escaleta | `engine/rundown.ts` (Matchday Rundown pre/en vivo/post) | Funciona por partido; no hay programa editorial |
| Programa automático | `football/AutoShowPanel.tsx` + `recap.ts` | Funciona: diapositivas de la jornada (resultado → estadísticas → análisis → tabla), con música y cinta. Es el "reproductor de diapositivas" que hay que transformar |
| Audiencia | `engine/audience.ts` (encuestas y debates reales del portal, moderación) | Funciona |
| Centro de dirección | `engine/ProductionRoom.tsx`, control móvil (`remoteControl.ts`) | Funciona |
| Audio | `audioMixer.ts` (ProgramMixer con master), `football/music.ts` (loop generado o archivo del operador), `football/sfx.ts` | Funciona; no hay canales separados ni ducking |
| Salida | `/broadcast/output` + `engine/programOutput.ts` (WebRTC local) | Funciona |
| 3D | `three`, `@react-three/fiber`, `@react-three/drei` **ya instalados** (los usa `news/RevolutionaryNewsFeed.tsx`) | Disponibles: no hace falta instalar nada |
| TTS heredado | `app/api/tts/route.ts` (edge-tts-universal) | **Roto**: Microsoft cambió el token v2 y la síntesis se cuelga (la lista de voces sí responde). Es un servicio no oficial y no se usa |
| Noris | Recursos 2D existentes; sin 3D | Fuera de alcance (solo espacios y contratos) |

## 2. Hardware del PC que transmite (medido)

Intel i7-9700, 8 núcleos, 32 GB de RAM (unos 11 GB libres) y GPU integrada Intel UHD 630, sin
NVIDIA. Consecuencias:

- **TTS en CPU**: Kokoro int8 genera a 0,40 veces el tiempo real (58 s de audio en 23–24 s) y Piper
  a 0,04 (67 s en 2,5 s). El servicio ocupa unos 720 MB de RAM.
- **3D**: con GPU integrada, el estudio debe ser liviano (geometría simple, sin sombras dinámicas
  en LOW y MEDIUM) y renderizar bajo demanda.

## 3. Decisiones de arquitectura

1. **No hay un segundo motor de producción.** El estudio 3D se renderiza en un canvas WebGL fuera
   de pantalla y entra al compositor actual como fuente viva de fondo. Program, TAKE, gráficos y
   `/broadcast/output` siguen igual: la salida recibe el resultado compuesto.
2. **Un solo estudio y ocho configuraciones** (OPENING, NEWSROOM, MATCH CENTER, ANALYSIS,
   STATISTICS, DEBATE, UPCOMING y CLOSING) sobre la misma arquitectura: cambian la cámara, las
   pantallas y la luz, no la página.
3. **Three.js directo, sin React Three Fiber, para el estudio**: se renderiza fuera de React para
   el compositor y el Program. R3F añadiría reconciliación sin aportar nada.
4. **Fallback 2D**: sin WebGL, el escenario 2D actual (`set-show`).
5. **Narrativa sin LLM.** No hay claves de modelos en el proyecto y la regla es no inventar. El
   motor editorial redacta con plantillas a partir de hechos verificados (ESPN, noticias
   publicadas, encuestas reales), como ya hace `recap.ts`. Cada frase lleva su fuente.
6. **Voz local y gratuita.** El servicio `automation/narrator` (127.0.0.1:8802) corre en el PC que
   transmite; el navegador del operador lo llama directo y Vercel nunca. Kokoro es el principal y
   Piper la alternativa.
7. **Audio por canales**: narración, música, efectos y ambiente sobre el ProgramMixer actual, con
   ducking (la música baja cuando habla el narrador) y un limitador.

## 4. Plan por fases

| Fase | Contenido | Estado |
|---|---|---|
| 0 | Auditoría y plan (este documento) | ✅ |
| 3a | Narrador: servicio local Kokoro + Piper, `NarrationProvider`, cola con precarga, caché, diccionario, panel y prueba de 60 s | ✅ (detalle en `NARRATOR.md`) |
| 1 | Estudio virtual 3D: arquitectura, ocho configuraciones, cámaras WIDE/HERO/SCREEN/DATA/SPLIT/DEBATE/CLOSING, pantallas con contenido, perfiles LOW/MEDIUM/HIGH, fallback 2D | Siguiente |
| 2 | Motor editorial: modalidades (ayer, hoy, semana, próximos días, combinado), selección por relevancia, prioridades, vigencia, fuentes, escaleta de 15/30/45/60 min con duración mínima, recomendada y máxima | Pendiente |
| 3b | Integración del narrador al programa | **Bloqueada hasta que el dueño escuche la prueba y elija voz** |
| 4 | Dirección audiovisual: secuencias por segmento (cámara, pantalla, gráfico, voz, pausa), aparición progresiva, música por segmento y ducking | Pendiente |
| 5 | Audiencia en Debate Arena (encuestas reales y resultados) | Pendiente; reutiliza `audience.ts` |
| 6 | Editor de ediciones y modos AUTO, SEMI y MANUAL, con recuperación de estado | Pendiente |
| 7 | Validación: E2E, sesión larga, audio y build | Continuo |

## 5. Riesgos

- **GPU integrada**: el 3D debe medirse en este equipo y empezar en MEDIUM o LOW.
- **Kokoro no controla la emoción**: los perfiles se logran con ritmo, pausas e intensidad. Una
  voz más emotiva requeriría un proveedor de pago, que no se contrata sin aprobación.
- **Licencias**: Kokoro (Apache-2.0), kokoro-onnx (MIT), espeak-ng (GPL-3.0) y Piper (GPL-3.0).
  Se usan localmente y no se redistribuyen.
- **Música**: solo recursos generados o cargados por el operador con derechos.
