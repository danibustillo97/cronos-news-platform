# Broadcast Output — señal limpia para KICK

`/broadcast/output` es el renderizador final de la emisión. Muestra **solo lo que está al aire**:
el Program del broadcaster, sin sidebar, sin Preview, sin TAKE, sin toasts, sin banner de cookies,
sin anuncios ni analítica. Se captura desde **KICK Web Go Live** y, más adelante, desde Restream o
cualquier servicio que comparta una pestaña del navegador.

## Arquitectura

```
Pestaña del estudio (/admin → Broadcaster)              Pestaña de salida (/broadcast/output)
┌───────────────────────────────────────────┐           ┌──────────────────────────────────┐
│ Motor actual (sin cambios):               │           │ <video> 16:9 a pantalla completa │
│ escenas · gráficos · transiciones · FTB   │  WebRTC   │ (la misma imagen y el mismo      │
│ ──► canvas Program 1920×1080              │──local──▶ │  audio del Program)              │
│ mezcla de audio (micrófonos, música, SFX) │ loopback  │ último cuadro congelado si se    │
│ ProgramOutputHost                         │           │ corta · reconexión automática    │
└───────────────────────────────────────────┘           └──────────────────────────────────┘
              ▲ señalización: BroadcastChannel "nexus-program-output" (mismo origen y perfil) ▲
```

- **No hay un segundo motor**: la salida no consulta datos, no hace polling y no compone nada.
  Recibe el Program ya compuesto, así que siempre coincide con lo que el operador ve en Program
  (partido principal, multipartido, marcador, cronología, estadísticas, encuestas, cinta,
  escenarios virtuales, cámaras, invitados, transiciones y fundido a negro).
- **Sin servidor**: es WebRTC entre dos pestañas del mismo navegador, solo con candidatos locales
  (`iceServers: []`). No hay RTMP, FFmpeg, encoder propio ni claves de transmisión en el frontend.
- **Calidad**: H.264 preferido (por hardware, menos CPU en emisiones largas), 30 fps,
  `contentHint = "detail"` (prioriza la nitidez del texto y los escudos), bitrate de 4 a 16 Mbps
  (`x-google-*`) y `degradationPreference = maintain-resolution`.
- **Varias salidas**: cada pestaña de salida es un peer independiente. Si hay dos estudios
  abiertos, la salida se queda con el primero que la atiende.
- **Código**:
  - `frontend/src/components/admin/Broadcaster/engine/programOutput.ts`: host, cliente y protocolo.
  - `frontend/src/components/broadcast/BroadcastOutput.tsx`: la página.
  - `frontend/src/app/broadcast/output/page.tsx`: la ruta, con `noindex`.
  - `AppLayoutClient.tsx`: excluye esta ruta de todo el chrome público.

### Protocolo

| Mensaje | De → a | Para qué |
|---|---|---|
| `hello` | salida → estudio | Se anuncia y repite cada 2 s hasta que la atienden (el estudio puede abrirse después) |
| `offer` / `answer` / `ice` | ambos | Negociación WebRTC (un peer por salida) |
| `ready` | estudio → todos | El estudio arrancó o se recargó |
| `beat` | estudio → todos | Latido cada segundo; 3,5 s de silencio → la salida congela el último cuadro y vuelve a anunciarse |
| `stats` | salida → estudio | fps reales presentados, resolución, cuadros perdidos, jitter, memoria y estado del audio |
| `bye` | ambos | Cierre limpio (en `pagehide`) |

El estudio libera las salidas que dejan de reportar durante 10 s (pestaña cerrada a la fuerza).

## Uso con KICK Web Go Live

1. Abre el Broadcaster en una pestaña y pulsa **Salida** en la barra superior. Se abre
   `/broadcast/output` en una pestaña nueva. Ese mismo clic activa la mezcla de audio del Program.
2. En la pestaña de salida, **haz un clic** para que el navegador permita el sonido. Si está
   bloqueado, aparece abajo a la derecha el aviso "Clic para activar el audio de la salida"; quítalo
   antes de salir al aire.
3. En KICK entra a **Web Go Live**, elige **compartir pestaña** y selecciona **solo** la pestaña
   «NEXUS SPORT · Salida de emisión». Activa **compartir audio de la pestaña**.
4. Comienza la transmisión y opera normalmente desde el estudio: cada TAKE, gráfico o cambio de
   partido aparece en la salida sin recargar.

El botón **Salida** del estudio muestra la señal real: número de salidas, fps recibidos (en verde,
o en ámbar si bajan de 24 o si el audio está bloqueado) y, al pasar el mouse, el detalle por salida
(fps recibidos y enviados, resolución, audio, cuadros perdidos, memoria y límite del encoder).

### Atajos en la pestaña de salida (no se ven al aire)

| Tecla | Acción |
|---|---|
| `M` | Silenciar o activar el audio (también desbloquea el audio si estaba bloqueado) |
| `↑` / `↓` | Volumen de la salida (el volumen maestro sigue en el estudio) |
| `F` | Pantalla completa |
| `S` | Panel de diagnóstico (también con `?stats=1`) |

El cursor se oculta solo a los 2 s sin movimiento.

## Comportamiento

| Situación | Lo que ve la audiencia |
|---|---|
| Ningún estudio conectado todavía | Placa NEXUS SPORT: "La transmisión comienza en breve" |
| Señal en vivo | El Program, 16:9, escalado a la ventana y con barras negras fuera de esa proporción; sin scroll |
| El estudio se recarga o se cierra | El último cuadro válido, congelado; reconecta solo (unos 1,3 s en las pruebas) |
| El estudio se queda congelado sin avisar | Lo mismo, detectado por el latido en unos 3,2 s |

Mientras haya salidas conectadas, el estudio sigue dibujando el Program aunque cambies de panel o
la pestaña quede en segundo plano (el reloj de cuadros corre en un worker). Si el canvas de Program
se vuelve a montar al cambiar de modo, la pista de video se reemplaza en caliente.

## Audio

- **Una sola fuente**: la mezcla del Program (micrófonos e invitados en Program, música del
  programa automático, efectos y volumen maestro) llega a la salida como una sola pista, y solo la
  pestaña de salida la reproduce. La mezcla nunca sale por los altavoces del estudio. La música del
  programa automático, que el estudio sí monitorea por sus altavoces, se silencia ahí mientras haya
  una salida conectada, así que nunca se oye dos veces.
- El navegador no permite sonido sin interacción: el clic en **Salida** inicia la mezcla y el clic
  en la pestaña de salida habilita la reproducción.
- La música solo suena si hay un recurso autorizado (el loop generado por NEXUS o un archivo que
  cargue el operador).

## Escenas de emisión: piezas que ya existen

| Fase | Gráficos del catálogo (`graphicsCatalog.ts`) y escaleta (`rundown.ts`) |
|---|---|
| Previa | `prematch`, `lineup-home` y `lineup-away`, bloque de cuenta regresiva de la escaleta, `standings`, `duel` |
| En vivo | Marcadores (`pro`, `elite`, `compact`, `editorial`, `live`), `events`, `timeline`, `goal-pro`, `card`, `sub`, `var`, `stats`, `duel`, `dato`, `poll`, `cinta` |
| Descanso | `result-card`, `stats`, `timeline` |
| Postpartido | `result-card`, `player`, `poll-result`, `stats` |
| Multipartido | `multi`, `goal-alert`, `cinta` |

Todas usan datos reales: ESPN, el motor de partidos en vivo y los votos del portal.

## Rendimiento medido

Prueba E2E con el módulo real como host, en Chromium headless sin GPU, ventana de 1280×720:

- Cambios de escena (previa → en vivo → gol → estadística → encuesta → cambio de partido →
  postpartido): aparecen en la salida en 70–340 ms, sin recargar.
- Corrida de 3 minutos: **23–26 fps recibidos** (con 25–28 dibujados por el host de prueba),
  **0 cuadros perdidos**, memoria estable en 65–67 MB y sin fugas.
- Ventanas de 1920×1080, 1000×900, 1600×600 y 390×844: el escenario siempre queda en 1,778, sin
  scroll y sin banner.

En una máquina con GPU y el estudio real se espera estar más cerca de 30 fps, pero no está
garantizado: el botón **Salida** muestra la cifra real de tu equipo durante la emisión.

## Fuera de alcance en esta fase

Encoder propio, RTMP desde el navegador, FFmpeg, OBS, servidor de streaming e integraciones
directas con Facebook, TikTok o Restream. La salida no depende de la plataforma: cualquier
servicio que capture una pestaña la puede usar.
