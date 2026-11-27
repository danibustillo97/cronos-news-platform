# NEXUS AI Narrator: voz local gratuita

## Qué es

Un servicio local, `automation/narrator`, que corre **en el PC que transmite** y genera la voz del
narrador sin API de pago ni internet. El broadcaster (servido desde Vercel o desde localhost) lo
llama desde el navegador del operador en `http://127.0.0.1:8802`. Los servidores de Vercel nunca
lo tocan.

| Proveedor | Rol | Voces | Licencia | Medido en este PC (i7-9700, sin GPU) |
|---|---|---|---|---|
| **Kokoro 82M** (kokoro-onnx, ONNX Runtime CPU, modelo int8) | Principal | `em_santa`, `em_alex` (masculinas) y `ef_dora` | Modelo Apache-2.0, kokoro-onnx MIT | 0,40 veces el tiempo real (58 s de audio en unos 24 s) · carga en 0,7 s |
| **Piper** (`es_MX-ald-medium`) | Alternativa | Ald (masculina, México) | Piper GPL-3.0, dataset Unlicense | 0,04 veces el tiempo real (67 s en 2,5 s) |

Los dos usan espeak-ng (GPL-3.0) para los fonemas del español. El uso es local y no se redistribuye.
El servicio entero ocupa unos 720 MB de RAM.

## Seguridad

- Escucha solo en `127.0.0.1`, no es accesible desde la red, y no tiene claves.
- CORS restringido a `https://www.nexusnews.info`, `https://nexusnews.info` y `localhost:3000`.
  Otro origen recibe un 403. Se configura con `NARRATOR_ORIGINS`.
- Responde a la verificación de Chrome para páginas HTTPS que llaman a 127.0.0.1
  (`Access-Control-Allow-Private-Network: true`).

## API

| Método | Ruta | Uso |
|---|---|---|
| GET | `/status` | Proveedores listos o con error, RTF real, caché, diccionario y último error |
| POST | `/synthesize` | `{provider, voice, speed, gain, segments:[{text, speed?, pauseAfterMs}]}` → WAV PCM de 16 bits. Cabeceras `X-Cache`, `X-Duration`, `X-Elapsed` |
| GET/PUT | `/lexicon` | Diccionario de pronunciación (`lexicon.json`): `{term, say?, ipa?, kind?}` |

- **Caché**: cada audio se guarda en disco por un hash de todo lo que lo cambia (texto, voz,
  velocidad, pausas, diccionario y modelo). Una repetición responde en unos 0,2 s. Límite de
  512 MB (`NARRATOR_CACHE_MB`).
- **Una inferencia a la vez**, en un hilo aparte, así que `/status` responde mientras genera.
- **Sin clipping**: el audio se normaliza a un pico de 0,99.

## Frontend

- `engine/narration.ts`:
  - `NarrationProvider` (contrato reemplazable) y `LocalNarrator`.
  - Perfiles EPIC, NEWS, ANALYSIS, DEBATE, EXPECTATION y FRIENDLY.
  - `segment()`, que divide en frases con pausas intencionales.
  - `NarrationQueue`, que genera la frase siguiente mientras suena la actual, reintenta con espera
    y sigue con la próxima si una falla.
- `engine/narratorScript.ts`: la hora y la fecha dichas en hora de Colombia y la prueba de 60 s
  armada solo con los partidos reales del día.
- `football/NarratorPanel.tsx`, en la pestaña **Narrador IA** del broadcaster:
  - estado del proveedor;
  - selector de voz;
  - volumen;
  - prueba de cada perfil;
  - prueba de 60 s con métricas (primer audio, silencios por espera y duración);
  - editor del diccionario.

**Kokoro no tiene control de emoción.** Cada perfil cambia la velocidad, las pausas y la
intensidad (ganancia), y el énfasis hace una frase más lenta y fuerte. La emoción la pone también
la redacción. No se presenta como algo que no es.

## Pruebas

- `engine/narration.test.ts` (8 pruebas): segmentación, pausas, énfasis, clave de caché, estimación
  de duración, horas en Colombia y que el guion de prueba solo nombra partidos reales.
- **Navegador real (Chromium) contra el servicio**: 8 frases con Kokoro `em_alex`. El primer audio
  salió en 0,95 s, con **0 s de silencio por espera** entre frases y sin errores.
- **Prueba de 60 s**: se generaron WAV con `em_santa`, `em_alex` y Piper para escucharlos.

## Arranque

```powershell
.\nexus.ps1 up          # lo inicia si automation\narrator\venv existe
# o manualmente:
cd automation\narrator
venv\Scripts\python -m uvicorn app:app --host 127.0.0.1 --port 8802
```

Instalación desde cero: crear `venv`, ejecutar `pip install -r requirements.txt` y descargar en
`models/` los archivos `kokoro-v1.0.int8.onnx` y `voices-v1.0.bin` (releases de kokoro-onnx), más
`piper/es_MX-ald-medium.onnx` con su `.json` (rhasspy/piper-voices). `venv`, `models` y `cache` no
se suben a git.

## Pendiente

La integración con el programa automático (Fase 3b) espera a que el dueño escuche la prueba y
elija la voz.
