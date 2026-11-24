"use client";

// Estación de radio: biblioteca libre de derechos + auto DJ + programa en vivo.
// Audio mixed in the browser (RadioEngine) -> WHIP -> local gateway -> Zeno.fm.
// Going on air can switch the homepage stage to the radio automatically.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Headphones, Loader2, Mic, MicOff, Music2, Pause, Play, Radio as RadioIcon, Settings2, SkipForward, Trash2, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/studio/lab/api-client";
import { supabase } from "@/lib/supabaseClient";
import { nextTrack, planAhead, targetEnergy, type PlayedItem, type RadioTrack, type TrackKind } from "./autoDj";
import { RadioEngine, type DeckTrack } from "./engine";
import { gatewayEndpoint, publishWhip, type WhipSession } from "../live/whip";
import { portalEndLive, portalGoLive } from "../live/portalOnAir";

const KIND_LABEL: Record<TrackKind, string> = {
  song: "Canción", jingle: "Jingle", station_id: "ID de estación", promo: "Promo", bed: "Cortina",
};
const SETTINGS_KEY = "nexus.radio.settings";

interface Settings {
  stationName: string;
  whipUrl: string;
  listenUrl: string;      // public Zeno.fm stream URL the portal plays
  showOnPortal: boolean;
  crossfadeS: number;
}
const DEFAULT_SETTINGS: Settings = {
  stationName: "Nexus Radio", whipUrl: gatewayEndpoint("radio"), listenUrl: "", showOnPortal: true, crossfadeS: 6,
};

function loadSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  return `${m}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

async function errorText(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.detail || body?.message || `HTTP ${response.status}`;
}

function audioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    audio.preload = "metadata";
    audio.onloadedmetadata = () => { resolve(Number.isFinite(audio.duration) ? Math.round(audio.duration) : null); URL.revokeObjectURL(url); };
    audio.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
    audio.src = url;
  });
}

export default function RadioStation() {
  const [library, setLibrary] = useState<RadioTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [history, setHistory] = useState<PlayedItem[]>([]);
  const [nowPlaying, setNowPlaying] = useState<{ track: DeckTrack; reason: string } | null>(null);
  const [position, setPosition] = useState({ position: 0, duration: 0, paused: true });
  const [running, setRunning] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [monitorOn, setMonitorOn] = useState(true);
  const [level, setLevel] = useState(0);
  const [onAir, setOnAir] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [uploadKind, setUploadKind] = useState<TrackKind>("song");
  const [uploadLicense, setUploadLicense] = useState("");
  const [filter, setFilter] = useState<TrackKind | "all">("all");
  const engineRef = useRef<RadioEngine | null>(null);
  const sessionRef = useRef<WhipSession | null>(null);
  const libraryRef = useRef(library);
  libraryRef.current = library;
  const historyRef = useRef(history);
  historyRef.current = history;
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setSettings(loadSettings()); }, []);
  const saveSettings = (patch: Partial<Settings>) => setSettings((prev) => {
    const next = { ...prev, ...patch };
    try { window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* per-device convenience only */ }
    if (engineRef.current) engineRef.current.crossfadeS = next.crossfadeS;
    return next;
  });

  const loadLibrary = useCallback(async () => {
    try {
      const response = await apiFetch("/api/radio/tracks");
      if (!response.ok) throw new Error(await errorText(response));
      setLibrary(await response.json());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la biblioteca");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void loadLibrary(); }, [loadLibrary]);

  // ── Auto DJ loop ─────────────────────────────────────────────────────────
  const playNext = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    const decision = nextTrack(libraryRef.current, historyRef.current, new Date());
    if (!decision) {
      toast.error("La biblioteca no tiene pistas activas para sonar.");
      return;
    }
    const { track, reason } = decision;
    await engine.play({ id: track.id, url: track.url, title: track.title, artist: track.artist, kind: track.kind });
    setNowPlaying({ track: { id: track.id, url: track.url, title: track.title, artist: track.artist, kind: track.kind }, reason });
    setHistory((prev) => [...prev.slice(-200), { trackId: track.id, kind: track.kind, artist: track.artist, energy: track.energy, at: Date.now() }]);
    void apiFetch(`/api/radio/tracks/${track.id}/played`, { method: "POST" }).catch(() => undefined);
  }, []);

  const start = async () => {
    if (!library.some((t) => t.active)) { toast.error("Sube al menos una canción a la biblioteca."); return; }
    if (!engineRef.current) {
      const engine = new RadioEngine();
      engine.crossfadeS = settings.crossfadeS;
      engine.setMonitor(monitorOn);
      engine.on((event) => {
        if (event.type === "needNext") void playNext();
        if (event.type === "error") toast.error(`${event.track.title}: ${event.message}`);
      });
      engineRef.current = engine;
    }
    setRunning(true);
    if (engineRef.current.current.track) await engineRef.current.resume();
    else await playNext();
  };

  const pause = () => { engineRef.current?.pause(); setRunning(false); };

  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const engine = engineRef.current;
      if (engine) {
        setLevel(engine.level());
        const c = engine.current;
        setPosition({ position: c.position, duration: c.duration, paused: c.paused });
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => () => {
    void sessionRef.current?.stop();
    void engineRef.current?.dispose();
  }, []);

  const toggleMic = async () => {
    try {
      if (!engineRef.current) await start();
      await engineRef.current?.setMic(!micOn);
      setMicOn((v) => !v);
    } catch {
      toast.error("No se pudo abrir el micrófono. Revisa los permisos del navegador.");
    }
  };

  // ── On air ───────────────────────────────────────────────────────────────
  const goOnAir = async () => {
    if (!engineRef.current || !running) await start();
    const engine = engineRef.current;
    if (!engine) return;
    setConnecting(true);
    try {
      sessionRef.current = await publishWhip(engine.output, settings.whipUrl, "", () => {
        toast.error("Se perdió la conexión con el puente. La radio salió del aire.");
        void stopOnAir(true);
      });
      setOnAir(true);
      toast.success("¡Al aire! La señal va a Zeno.fm.");
      if (settings.showOnPortal) {
        if (!settings.listenUrl) toast.warning("Agrega la URL pública de Zeno.fm en Ajustes para que suene en la portada.");
        else await portalGoLive("radio", { url: settings.listenUrl, title: settings.stationName }).then(
          () => toast.success("La portada cambió a la radio en vivo."),
          (err) => toast.error(`No se pudo cambiar la portada: ${err instanceof Error ? err.message : err}`),
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo salir al aire");
    } finally {
      setConnecting(false);
    }
  };

  const stopOnAir = async (lost = false) => {
    const session = sessionRef.current;
    sessionRef.current = null;
    setOnAir(false);
    await session?.stop();
    if (settings.showOnPortal && settings.listenUrl) await portalEndLive("radio").catch(() => undefined);
    if (!lost) toast.success("Fuera del aire");
  };

  // ── Library ──────────────────────────────────────────────────────────────
  const uploadFiles = async (files: FileList) => {
    if (!uploadLicense.trim()) { toast.error("Indica de dónde viene la licencia (ej. Pixabay Music, música propia)."); return; }
    const list = Array.from(files);
    setUploading({ done: 0, total: list.length });
    for (const [i, file] of list.entries()) {
      try {
        const signed = await apiFetch("/api/radio/tracks/upload-url", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, contentType: file.type || "audio/mpeg" }),
        });
        if (!signed.ok) throw new Error(await errorText(signed));
        const { path, token, publicUrl } = await signed.json();
        const { error } = await supabase.storage.from("media").uploadToSignedUrl(path, token, file, { contentType: file.type || "audio/mpeg" });
        if (error) throw new Error(error.message);
        const base = file.name.replace(/\.[a-z0-9]+$/i, "");
        const [artist, title] = base.includes(" - ") ? base.split(" - ", 2) : ["", base];
        const created = await apiFetch("/api/radio/tracks", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim() || base, artist: artist.trim(), kind: uploadKind, url: publicUrl, storagePath: path,
            durationS: await audioDuration(file), energy: 3, license: uploadLicense.trim(),
          }),
        });
        if (!created.ok) throw new Error(await errorText(created));
        const track: RadioTrack = await created.json();
        setLibrary((prev) => [track, ...prev]);
      } catch (err) {
        toast.error(`${file.name}: ${err instanceof Error ? err.message : "no se pudo subir"}`);
      }
      setUploading({ done: i + 1, total: list.length });
    }
    setUploading(null);
  };

  const patchTrack = async (id: string, patch: Partial<RadioTrack>) => {
    setLibrary((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const response = await apiFetch(`/api/radio/tracks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    if (!response.ok) { toast.error(await errorText(response)); void loadLibrary(); }
  };

  const removeTrack = async (track: RadioTrack) => {
    if (!window.confirm(`¿Borrar «${track.title}» de la biblioteca? Se elimina también el archivo.`)) return;
    const response = await apiFetch(`/api/radio/tracks/${track.id}`, { method: "DELETE" });
    if (!response.ok) { toast.error(await errorText(response)); return; }
    setLibrary((prev) => prev.filter((t) => t.id !== track.id));
  };

  const upNext = useMemo(() => planAhead(library, history, new Date(), 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-plan only when the library or the history changes
    [library, history.length]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: library.length };
    for (const t of library) c[t.kind] = (c[t.kind] ?? 0) + 1;
    return c;
  }, [library]);
  const shown = library.filter((t) => filter === "all" || t.kind === filter);
  const progress = position.duration ? position.position / position.duration : 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto bg-[#070707] p-4 text-neutral-300 lg:flex-row lg:overflow-hidden">
      {/* Console */}
      <section className="flex w-full flex-shrink-0 flex-col gap-4 lg:w-[420px] lg:overflow-y-auto">
        <div className={`rounded-2xl border p-4 ${onAir ? "border-red-500/60 bg-red-500/[0.06]" : "border-white/10 bg-white/[0.02]"}`}>
          <div className="flex items-center gap-2">
            <RadioIcon size={18} className={onAir ? "text-red-400" : "text-neutral-400"} />
            <h2 className="text-sm font-semibold text-white">{settings.stationName}</h2>
            {onAir && <span className="ml-1 inline-flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Al aire</span>}
            <button type="button" onClick={() => setSettingsOpen((o) => !o)} aria-label="Ajustes" className="ml-auto rounded-md p-1.5 text-neutral-500 hover:bg-white/10 hover:text-white"><Settings2 size={15} /></button>
          </div>

          {settingsOpen && (
            <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-black/40 p-3 text-[12px]">
              <SettingField label="Nombre de la estación" value={settings.stationName} onChange={(stationName) => saveSettings({ stationName })} />
              <SettingField label="Puente (WHIP)" value={settings.whipUrl} onChange={(whipUrl) => saveSettings({ whipUrl })} mono />
              <SettingField label="URL pública de Zeno.fm (la que escuchan en el portal)" value={settings.listenUrl} onChange={(listenUrl) => saveSettings({ listenUrl })} placeholder="https://stream.zeno.fm/…" mono />
              <label className="flex items-center gap-2"><input type="checkbox" checked={settings.showOnPortal} onChange={(e) => saveSettings({ showOnPortal: e.target.checked })} /> Poner la radio en la portada al salir al aire</label>
              <label className="block">Crossfade: {settings.crossfadeS} s
                <input type="range" min={0} max={12} step={1} value={settings.crossfadeS} onChange={(e) => saveSettings({ crossfadeS: Number(e.target.value) })} className="mt-1 w-full" />
              </label>
            </div>
          )}

          {/* Now playing */}
          <div className="mt-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-neutral-500">Sonando</p>
            <p className="mt-1 truncate text-base font-semibold text-white">{nowPlaying?.track.title ?? "—"}</p>
            <p className="truncate text-[12px] text-neutral-400">{nowPlaying ? `${nowPlaying.track.artist || KIND_LABEL[nowPlaying.track.kind as TrackKind]}` : "Pulsa «Iniciar auto DJ»"}</p>
            {nowPlaying && <p className="mt-1 text-[11px] text-neutral-500">{nowPlaying.reason}</p>}
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-yellow-400" style={{ width: `${progress * 100}%` }} /></div>
            <div className="mt-1 flex justify-between text-[10.5px] tabular-nums text-neutral-500"><span>{fmt(position.position)}</span><span>-{fmt(position.duration - position.position)}</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10" title="Nivel de salida">
              <div className={`h-full transition-[width] duration-75 ${level > 0.95 ? "bg-red-500" : level > 0.7 ? "bg-yellow-400" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, level * 100)}%` }} />
            </div>
          </div>

          {/* Controls */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {running
              ? <Control label="Pausar" onClick={pause}><Pause size={18} /></Control>
              : <Control label="Iniciar auto DJ" onClick={() => void start()} primary><Play size={18} /></Control>}
            <Control label="Siguiente" onClick={() => engineRef.current?.skip()} disabled={!running}><SkipForward size={18} /></Control>
            <Control label={micOn ? "Cerrar micrófono" : "Hablar (baja la música)"} onClick={() => void toggleMic()} active={micOn}>{micOn ? <Mic size={18} /> : <MicOff size={18} />}</Control>
            <Control label={monitorOn ? "Silenciar mi monitor" : "Escuchar (monitor)"} onClick={() => { const next = !monitorOn; setMonitorOn(next); engineRef.current?.setMonitor(next); }} active={monitorOn}><Headphones size={18} /></Control>
          </div>

          <button
            type="button" onClick={() => void (onAir ? stopOnAir() : goOnAir())} disabled={connecting}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:opacity-50 ${onAir ? "bg-white/10 text-white hover:bg-white/15" : "bg-red-600 text-white hover:bg-red-500"}`}
          >
            {connecting && <Loader2 size={16} className="animate-spin" />} {onAir ? "Salir del aire" : "Salir al aire"}
          </button>
          <p className="mt-2 text-[10.5px] leading-relaxed text-neutral-500">Requiere el puente local encendido (start-gateway.ps1). Energía objetivo ahora: {targetEnergy(new Date())}/5.</p>
        </div>

        {/* Up next */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-neutral-500">A continuación (auto DJ)</p>
          {upNext.length === 0 && <p className="mt-2 text-[12px] text-neutral-500">Sube música para ver la programación.</p>}
          <ol className="mt-2 space-y-1.5">
            {upNext.map((d, i) => (
              <li key={`${d.track.id}-${i}`} className="flex items-start gap-2 text-[12px]">
                <span className="mt-0.5 w-4 text-right text-neutral-600">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block truncate text-white">{d.track.title}</span>
                  <span className="block truncate text-[10.5px] text-neutral-500">{KIND_LABEL[d.track.kind]} · {d.reason}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Library */}
      <section className="flex min-h-[420px] min-w-0 flex-1 flex-col rounded-2xl border border-white/10 bg-white/[0.02]">
        <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
          <Music2 size={16} className="text-neutral-400" />
          <h3 className="text-sm font-semibold text-white">Biblioteca</h3>
          <div className="flex flex-wrap gap-1">
            {(["all", "song", "jingle", "station_id", "promo", "bed"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setFilter(k)}
                className={`rounded-md px-2 py-1 text-[11px] ${filter === k ? "bg-white/10 text-white" : "text-neutral-500 hover:text-white"}`}>
                {k === "all" ? "Todo" : KIND_LABEL[k]} <span className="text-neutral-600">{counts[k] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-b border-white/10 p-3 text-[12px]">
          <label className="flex flex-col gap-1">Tipo
            <select value={uploadKind} onChange={(e) => setUploadKind(e.target.value as TrackKind)} className="rounded-md border border-white/10 bg-black px-2 py-1.5 text-white">
              {(Object.keys(KIND_LABEL) as TrackKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </label>
          <label className="flex min-w-[220px] flex-1 flex-col gap-1">Licencia (obligatoria)
            <input value={uploadLicense} onChange={(e) => setUploadLicense(e.target.value)} placeholder="Pixabay Music · Música propia · Licencia X"
              className="rounded-md border border-white/10 bg-black px-2 py-1.5 text-white outline-none focus:border-white/30" />
          </label>
          <input ref={fileRef} type="file" accept="audio/*" multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) void uploadFiles(e.target.files); e.target.value = ""; }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={Boolean(uploading)}
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 font-semibold text-black disabled:opacity-50">
            {uploading ? <><Loader2 size={13} className="animate-spin" /> {uploading.done}/{uploading.total}</> : <><Upload size={13} /> Subir pistas</>}
          </button>
          <p className="w-full text-[10.5px] text-neutral-500">Solo música libre de derechos o con licencia: la música comercial hace que Kick y TikTok silencien o corten la transmisión. Nombra los archivos «Artista - Título» y se rellenan solos.</p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <p className="p-4 text-[12px] text-neutral-500"><Loader2 size={13} className="mr-1 inline animate-spin" /> Cargando biblioteca…</p>
          ) : shown.length === 0 ? (
            <p className="p-6 text-center text-[12px] text-neutral-500">Aún no hay pistas. Sube canciones, jingles e identificaciones de la estación.</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-[#0b0b0b] text-left text-[10.5px] uppercase tracking-wide text-neutral-500">
                <tr><th className="px-3 py-2">Pista</th><th className="px-2 py-2">Tipo</th><th className="px-2 py-2">Energía</th><th className="px-2 py-2 text-right">Dur.</th><th className="px-2 py-2 text-right">Veces</th><th className="px-2 py-2" /></tr>
              </thead>
              <tbody>
                {shown.map((t) => (
                  <tr key={t.id} className={`border-t border-white/5 ${t.active ? "" : "opacity-40"} ${nowPlaying?.track.id === t.id ? "bg-yellow-400/[0.06]" : ""}`}>
                    <td className="max-w-[260px] px-3 py-2">
                      <span className="block truncate text-white">{t.title}</span>
                      <span className="block truncate text-[10.5px] text-neutral-500">{t.artist || "—"}</span>
                    </td>
                    <td className="px-2 py-2">
                      <select value={t.kind} onChange={(e) => void patchTrack(t.id, { kind: e.target.value as TrackKind })} className="rounded border border-white/10 bg-black px-1 py-1 text-[11px] text-white">
                        {(Object.keys(KIND_LABEL) as TrackKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex gap-0.5" role="radiogroup" aria-label="Energía">
                        {[1, 2, 3, 4, 5].map((e) => (
                          <button key={e} type="button" role="radio" aria-checked={t.energy === e} title={`Energía ${e}`} onClick={() => void patchTrack(t.id, { energy: e })}
                            className={`h-5 w-3 rounded-sm ${e <= t.energy ? "bg-yellow-400" : "bg-white/10"}`} />
                        ))}
                      </div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-neutral-400">{t.durationS ? fmt(Number(t.durationS)) : "—"}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-neutral-400">{t.playCount}</td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => void patchTrack(t.id, { active: !t.active })} title={t.active ? "Sacar de la rotación" : "Volver a la rotación"}
                          className="rounded px-2 py-1 text-[10.5px] text-neutral-400 hover:bg-white/10 hover:text-white">{t.active ? "Activa" : "Pausada"}</button>
                        <button type="button" onClick={() => void removeTrack(t)} aria-label="Borrar" className="rounded p-1 text-neutral-500 hover:bg-white/10 hover:text-red-400"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function Control({ label, onClick, children, primary, active, disabled }: {
  label: string; onClick: () => void; children: React.ReactNode; primary?: boolean; active?: boolean; disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={label} aria-label={label}
      className={`flex h-12 items-center justify-center rounded-xl disabled:opacity-30 ${primary ? "bg-yellow-400 text-black hover:bg-yellow-300" : active ? "bg-white text-black" : "bg-white/[0.06] text-white hover:bg-white/10"}`}>
      {children}
    </button>
  );
}

function SettingField({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <label className="block">
      <span className="text-[10.5px] text-neutral-400">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`mt-0.5 w-full rounded-md border border-white/10 bg-black px-2 py-1.5 text-white outline-none focus:border-white/30 ${mono ? "font-mono text-[11px]" : ""}`} />
    </label>
  );
}
