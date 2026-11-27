"""NEXUS Narrator — local, free text-to-speech for the broadcaster PC.

Runs ON THE MACHINE THAT BROADCASTS (never on Vercel): the broadcaster page, served
from Vercel or localhost, calls http://127.0.0.1:8802 from the operator's own browser.
It binds to 127.0.0.1 only (not reachable from the network), exposes no keys and needs
no paid API.

Providers
- kokoro (main): Kokoro-82M (Apache-2.0) through kokoro-onnx (MIT) on ONNX Runtime CPU.
  Spanish voices em_santa, em_alex (male) and ef_dora.
- piper (alternative): Piper (GPL-3.0) with the es_MX "ald" voice (dataset: Unlicense).

Both phonemize Spanish with espeak-ng (GPL-3.0, bundled by espeakng-loader / piper).
Local use; nothing is redistributed.

What a request controls
- segments: the narration is split into phrases; each one has its own speed and
  the silence after it (intentional pauses).
- voice and provider; global speed and gain (intensity).
- pronunciation: an editable lexicon (lexicon.json) of respellings ("say") or IPA
  ("ipa", Kokoro only) for clubs, players, competitions, stadiums.
Kokoro has no emotion control: profiles are expressed with speed, pauses, gain and
the wording itself. Nothing here pretends otherwise.

Output: 16-bit PCM WAV (plays in every browser). Every result is cached on disk by a
hash of everything that changes the audio, so a repeated line never costs CPU again.
Inference runs one at a time in a worker thread: the server keeps answering /status
while it generates.
"""
from __future__ import annotations

import asyncio
import hashlib
import io
import json
import os
import re
import threading
import time
import wave
from pathlib import Path
from typing import Literal

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
MODELS = ROOT / "models"
CACHE = ROOT / "cache"
LEXICON_FILE = ROOT / "lexicon.json"
CACHE.mkdir(exist_ok=True)

KOKORO_MODEL = os.getenv("NARRATOR_KOKORO_MODEL", "kokoro-v1.0.int8.onnx")  # int8: same speed class, 1/4 of the RAM
KOKORO_VOICES = {"em_santa": "Santa (masculina)", "em_alex": "Alex (masculina)", "ef_dora": "Dora (femenina)"}
PIPER_VOICES = {"es_MX-ald-medium": "Ald (masculina, México)"}
SAMPLE_RATE = 24000
CACHE_MAX_MB = int(os.getenv("NARRATOR_CACHE_MB", "512"))

# Browsers only: the production site and local development. Anything else is refused.
ALLOWED_ORIGINS = {
    o.strip() for o in os.getenv(
        "NARRATOR_ORIGINS",
        "https://www.nexusnews.info,https://nexusnews.info,http://localhost:3000,http://127.0.0.1:3000",
    ).split(",") if o.strip()
}

app = FastAPI(title="NEXUS Narrator", version="1.0.0")


# ----------------------------------------------------------------------------- CORS + Private Network Access
@app.middleware("http")
async def cors(request: Request, call_next):
    origin = request.headers.get("origin")
    allowed = origin in ALLOWED_ORIGINS
    if origin and not allowed:
        return JSONResponse({"error": f"origin not allowed: {origin}"}, status_code=403)
    if request.method == "OPTIONS":
        response = Response(status_code=204)
    else:
        response = await call_next(request)
    if allowed:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Vary"] = "Origin"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Expose-Headers"] = "X-Cache, X-Duration, X-Elapsed, X-Provider, X-Voice"
        # Chrome Private Network Access: a public HTTPS page calling 127.0.0.1 needs this on the preflight
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


# ----------------------------------------------------------------------------- providers
class ProviderState:
    def __init__(self, name: str):
        self.name = name
        self.engine = None
        self.error: str | None = None
        self.load_s: float | None = None
        self.last_rtf: float | None = None
        self.generated_s = 0.0

    def info(self) -> dict:
        return {"name": self.name, "ready": self.engine is not None, "error": self.error,
                "loadSeconds": self.load_s, "lastRtf": self.last_rtf, "generatedSeconds": round(self.generated_s, 1)}


kokoro = ProviderState("kokoro")
piper = ProviderState("piper")
infer_lock = threading.Lock()
last_error: dict | None = None


def load_kokoro():
    try:
        from kokoro_onnx import Kokoro
        t = time.time()
        kokoro.engine = Kokoro(str(MODELS / KOKORO_MODEL), str(MODELS / "voices-v1.0.bin"))
        kokoro.load_s = round(time.time() - t, 2)
    except Exception as exc:  # missing model files, onnxruntime problem...
        kokoro.error = f"{type(exc).__name__}: {exc}"


def load_piper():
    try:
        from piper import PiperVoice
        t = time.time()
        piper.engine = PiperVoice.load(str(MODELS / "piper" / "es_MX-ald-medium.onnx"))
        piper.load_s = round(time.time() - t, 2)
    except Exception as exc:
        piper.error = f"{type(exc).__name__}: {exc}"


@app.on_event("startup")
def startup():
    load_kokoro()
    load_piper()


# ----------------------------------------------------------------------------- lexicon
def read_lexicon() -> list[dict]:
    if not LEXICON_FILE.exists():
        return []
    try:
        data = json.loads(LEXICON_FILE.read_text(encoding="utf-8"))
        return [e for e in data if isinstance(e, dict) and e.get("term")]
    except Exception:
        return []


def apply_lexicon(text: str, lexicon: list[dict]) -> tuple[str, list[tuple[str, str]]]:
    """Respellings replace the term in the text; IPA entries are returned as (placeholder, ipa)."""
    ipa: list[tuple[str, str]] = []
    # longest terms first so "Atlético Nacional" wins over "Nacional"
    for i, entry in enumerate(sorted(lexicon, key=lambda e: -len(e["term"]))):
        pattern = re.compile(rf"(?<!\w){re.escape(entry['term'])}(?!\w)", re.IGNORECASE)
        if entry.get("ipa"):
            token = f"§{i}§"
            if pattern.search(text):
                text = pattern.sub(token, text)
                ipa.append((token, entry["ipa"]))
        elif entry.get("say"):
            text = pattern.sub(entry["say"], text)
    return text, ipa


# ----------------------------------------------------------------------------- synthesis
class Segment(BaseModel):
    text: str = Field(min_length=1, max_length=1200)
    speed: float | None = Field(default=None, ge=0.5, le=2.0)
    pauseAfterMs: int = Field(default=250, ge=0, le=4000)


class SynthesisRequest(BaseModel):
    provider: Literal["kokoro", "piper"] = "kokoro"
    voice: str = "em_santa"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    gain: float = Field(default=1.0, ge=0.2, le=2.0)
    segments: list[Segment] = Field(min_length=1, max_length=60)


def to_wav(samples: np.ndarray, sr: int) -> bytes:
    peak = float(np.max(np.abs(samples))) if samples.size else 0.0
    if peak > 0.99:  # never clip
        samples = samples * (0.99 / peak)
    pcm = (np.clip(samples, -1.0, 1.0) * 32767).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())
    return buf.getvalue()


def kokoro_phrase(text: str, voice: str, speed: float, lexicon: list[dict]) -> np.ndarray:
    eng = kokoro.engine
    said, ipa = apply_lexicon(text, lexicon)
    if not ipa:
        samples, _ = eng.create(said, voice=voice, speed=speed, lang="es")
        return samples
    # mixed: phonemize the plain parts with espeak and splice the IPA overrides in
    parts = re.split(r"(§\d+§)", said)
    lookup = dict(ipa)
    phonemes = "".join(lookup.get(p) or (eng.tokenizer.phonemize(p, "es") if p.strip() else p) for p in parts)
    samples, _ = eng.create(phonemes, voice=voice, speed=speed, lang="es", is_phonemes=True)
    return samples


def piper_phrase(text: str, speed: float, lexicon: list[dict]) -> tuple[np.ndarray, int]:
    from piper.config import SynthesisConfig
    said, _ = apply_lexicon(text, [e for e in lexicon if e.get("say")])
    chunks, sr = [], 22050
    for ch in piper.engine.synthesize(said, syn_config=SynthesisConfig(length_scale=1.0 / speed)):
        chunks.append(np.frombuffer(ch.audio_int16_bytes, dtype="<i2").astype(np.float32) / 32768.0)
        sr = ch.sample_rate
    return (np.concatenate(chunks) if chunks else np.zeros(0, np.float32)), sr


def synthesize(req: SynthesisRequest, lexicon: list[dict]) -> tuple[bytes, float, float]:
    state = kokoro if req.provider == "kokoro" else piper
    if state.engine is None:
        raise RuntimeError(f"{req.provider} no está disponible: {state.error or 'no cargado'}")
    if req.provider == "kokoro" and req.voice not in KOKORO_VOICES:
        raise ValueError(f"voz desconocida para kokoro: {req.voice}")
    t = time.time()
    out: list[np.ndarray] = []
    sr = SAMPLE_RATE
    with infer_lock:  # one inference at a time; the event loop stays free
        for seg in req.segments:
            speed = (seg.speed or 1.0) * req.speed
            if req.provider == "kokoro":
                audio = kokoro_phrase(seg.text, req.voice, speed, lexicon)
            else:
                audio, sr = piper_phrase(seg.text, speed, lexicon)
            out.append(audio * req.gain)
            if seg.pauseAfterMs:
                out.append(np.zeros(int(sr * seg.pauseAfterMs / 1000), np.float32))
    samples = np.concatenate(out) if out else np.zeros(0, np.float32)
    elapsed = time.time() - t
    duration = samples.size / sr
    state.last_rtf = round(elapsed / duration, 3) if duration else None
    state.generated_s += duration
    return to_wav(samples, sr), duration, elapsed


def cache_key(req: SynthesisRequest, lexicon: list[dict]) -> str:
    payload = json.dumps({"r": req.model_dump(), "lex": lexicon, "model": KOKORO_MODEL if req.provider == "kokoro" else "ald"}, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:40]


def trim_cache():
    files = sorted(CACHE.glob("*.wav"), key=lambda p: p.stat().st_atime)
    total = sum(p.stat().st_size for p in files)
    while files and total > CACHE_MAX_MB * 1024 * 1024:
        victim = files.pop(0)
        total -= victim.stat().st_size
        victim.unlink(missing_ok=True)


@app.post("/synthesize")
async def post_synthesize(req: SynthesisRequest):
    global last_error
    lexicon = read_lexicon()
    key = cache_key(req, lexicon)
    path = CACHE / f"{key}.wav"
    meta = CACHE / f"{key}.json"
    if path.exists() and meta.exists():
        info = json.loads(meta.read_text())
        os.utime(path)
        return Response(path.read_bytes(), media_type="audio/wav", headers={
            "X-Cache": "hit", "X-Duration": str(info["duration"]), "X-Elapsed": "0", "X-Provider": req.provider, "X-Voice": req.voice})
    try:
        audio, duration, elapsed = await asyncio.to_thread(synthesize, req, lexicon)
    except (RuntimeError, ValueError) as exc:
        last_error = {"at": time.time(), "message": str(exc)}
        raise HTTPException(status_code=503 if isinstance(exc, RuntimeError) else 422, detail=str(exc)) from exc
    except Exception as exc:
        last_error = {"at": time.time(), "message": f"{type(exc).__name__}: {exc}"}
        raise HTTPException(status_code=500, detail=last_error["message"]) from exc
    path.write_bytes(audio)
    meta.write_text(json.dumps({"duration": round(duration, 3), "elapsed": round(elapsed, 3)}))
    trim_cache()
    return Response(audio, media_type="audio/wav", headers={
        "X-Cache": "miss", "X-Duration": f"{duration:.3f}", "X-Elapsed": f"{elapsed:.3f}", "X-Provider": req.provider, "X-Voice": req.voice})


@app.get("/status")
def status():
    files = list(CACHE.glob("*.wav"))
    return {
        "service": "nexus-narrator", "version": app.version,
        "providers": {"kokoro": kokoro.info() | {"model": KOKORO_MODEL, "voices": KOKORO_VOICES},
                      "piper": piper.info() | {"voices": PIPER_VOICES}},
        "busy": infer_lock.locked(),
        "cache": {"files": len(files), "mb": round(sum(p.stat().st_size for p in files) / 1048576, 1), "maxMb": CACHE_MAX_MB},
        "lexiconEntries": len(read_lexicon()),
        "lastError": last_error,
    }


@app.get("/lexicon")
def get_lexicon():
    return read_lexicon()


class LexiconEntry(BaseModel):
    term: str = Field(min_length=1, max_length=80)
    say: str | None = Field(default=None, max_length=120)
    ipa: str | None = Field(default=None, max_length=160)
    kind: str | None = Field(default=None, max_length=24)  # club | player | competition | stadium | country


@app.put("/lexicon")
def put_lexicon(entries: list[LexiconEntry]):
    clean = [e.model_dump(exclude_none=True) for e in entries if e.say or e.ipa]
    LEXICON_FILE.write_text(json.dumps(clean, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"saved": len(clean)}
