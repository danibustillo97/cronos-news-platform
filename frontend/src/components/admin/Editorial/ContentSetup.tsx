"use client";

// First-run setup: what kind of content this newsroom (or creator) makes.
// Drives the scraper: sources, what it keeps and how it ranks it.

import { useMemo, useState } from "react";
import { Check, Globe2, Loader2, Plus, Trophy, X } from "lucide-react";
import { apiFetch } from "@/studio/lab/api-client";

export type ContentProfile = {
  mode: "football" | "all";
  setupCompleted: boolean;
  competitions: string[];
  focuses: string[];
  disabledSources: string[];
  customSources: { url: string; name: string | null; covers: string[] }[];
  priorityTerms: string[];
  blockedTerms: string[];
  activeSourceCount: number;
  catalog: {
    modes: { id: "football" | "all"; name: string; description: string; available: boolean }[];
    competitions: { id: string; name: string; group: string }[];
    focuses: { id: string; name: string; description: string }[];
    sources: { id: string; name: string; url: string; modes: string[]; covers: string[]; language: string }[];
  };
};

const MODE_ICON = { football: Trophy, all: Globe2 } as const;
const STEPS = ["Tipo de contenido", "Competiciones", "Enfoque", "Fuentes"] as const;

function splitTerms(value: string): string[] {
  return value.split(",").map((t) => t.trim()).filter(Boolean);
}

export default function ContentSetup({
  profile, onSaved, onClose,
}: {
  profile: ContentProfile;
  onSaved: (profile: ContentProfile) => void;
  onClose?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState(profile.mode);
  const [competitions, setCompetitions] = useState<string[]>(profile.competitions);
  const [focuses, setFocuses] = useState<string[]>(profile.focuses);
  const [disabled, setDisabled] = useState<string[]>(profile.disabledSources);
  const [custom, setCustom] = useState(profile.customSources);
  const [newUrl, setNewUrl] = useState("");
  const [priority, setPriority] = useState(profile.priorityTerms.join(", "));
  const [blocked, setBlocked] = useState(profile.blockedTerms.join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { catalog } = profile;
  const steps = mode === "football" ? STEPS : (["Tipo de contenido", "Fuentes"] as const);
  const current = steps[step];

  const groups = useMemo(() => {
    const byGroup = new Map<string, typeof catalog.competitions>();
    for (const c of catalog.competitions) byGroup.set(c.group, [...(byGroup.get(c.group) ?? []), c]);
    return [...byGroup.entries()];
  }, [catalog.competitions]);

  const candidateSources = useMemo(() => {
    const wanted = new Set([...competitions, ...(focuses.includes("market") ? ["market"] : []), "general"]);
    return catalog.sources.filter((s) => s.modes.includes(mode) && (mode !== "football" || s.covers.some((c) => wanted.has(c))));
  }, [catalog.sources, competitions, focuses, mode]);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const addCustom = () => {
    const url = newUrl.trim();
    if (!/^https?:\/\//i.test(url) || custom.some((s) => s.url === url)) return;
    setCustom([...custom, { url, name: null, covers: ["general"] }]);
    setNewUrl("");
  };

  const canContinue = current !== "Competiciones" || competitions.length > 0;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch("/api/settings/content-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode, competitions: mode === "football" ? competitions : [], focuses: mode === "football" ? focuses : [],
          disabledSources: disabled, customSources: custom, priorityTerms: splitTerms(priority), blockedTerms: splitTerms(blocked),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || body?.detail || `HTTP ${response.status}`);
      onSaved(body as ContentProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const activeCount = candidateSources.filter((s) => !disabled.includes(s.id)).length + custom.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0e0e0e] shadow-2xl">
        <header className="flex items-start gap-3 border-b border-white/10 px-5 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
              {profile.setupCompleted ? "Configuración de contenido" : "Bienvenido · configura tu redacción"}
            </p>
            <h2 className="mt-1 text-base font-semibold text-white">{current}</h2>
            <ol className="mt-3 flex gap-1.5" aria-label="Pasos">
              {steps.map((label, i) => (
                <li key={label} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-white" : "bg-white/10"}`} title={label} />
              ))}
            </ol>
          </div>
          {onClose && profile.setupCompleted && (
            <button onClick={onClose} aria-label="Cerrar" className="rounded-md p-1 text-neutral-500 hover:text-white"><X size={16} /></button>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-[12.5px] text-neutral-300">
          {current === "Tipo de contenido" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {catalog.modes.map((m) => {
                const Icon = MODE_ICON[m.id] ?? Globe2;
                const active = mode === m.id;
                return (
                  <button
                    key={m.id} onClick={() => setMode(m.id)} disabled={!m.available}
                    className={`rounded-xl border p-4 text-left transition-colors ${active ? "border-white bg-white/[0.06]" : "border-white/10 hover:border-white/30"}`}
                  >
                    <Icon size={20} className={active ? "text-white" : "text-neutral-500"} />
                    <p className="mt-2 text-sm font-semibold text-white">{m.name}</p>
                    <p className="mt-1 leading-relaxed text-neutral-400">{m.description}</p>
                  </button>
                );
              })}
            </div>
          )}

          {current === "Competiciones" && (
            <div className="space-y-4">
              <p className="text-neutral-400">El scraper solo guarda noticias de lo que marques y las ordena por relevancia.</p>
              {groups.map(([group, items]) => (
                <section key={group}>
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{group}</h3>
                    <button
                      className="text-[11px] text-neutral-400 hover:text-white"
                      onClick={() => {
                        const ids = items.map((c) => c.id);
                        const all = ids.every((id) => competitions.includes(id));
                        setCompetitions(all ? competitions.filter((id) => !ids.includes(id)) : [...new Set([...competitions, ...ids])]);
                      }}
                    >
                      {items.every((c) => competitions.includes(c.id)) ? "Quitar todas" : "Todas"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((c) => (
                      <Chip key={c.id} active={competitions.includes(c.id)} onClick={() => setCompetitions(toggle(competitions, c.id))}>{c.name}</Chip>
                    ))}
                  </div>
                </section>
              ))}
              {competitions.length === 0 && <p className="text-amber-300">Elige al menos una competición.</p>}
            </div>
          )}

          {current === "Enfoque" && (
            <div className="space-y-4">
              <p className="text-neutral-400">Las noticias de estos temas suben en la lista de Entrantes.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {catalog.focuses.map((f) => {
                  const active = focuses.includes(f.id);
                  return (
                    <button
                      key={f.id} onClick={() => setFocuses(toggle(focuses, f.id))}
                      className={`flex gap-2 rounded-lg border p-3 text-left ${active ? "border-white bg-white/[0.06]" : "border-white/10 hover:border-white/30"}`}
                    >
                      <span className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${active ? "border-white bg-white text-black" : "border-white/30"}`}>
                        {active && <Check size={11} />}
                      </span>
                      <span>
                        <span className="block font-medium text-white">{f.name}</span>
                        <span className="mt-0.5 block text-neutral-400">{f.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Equipos o jugadores que más te importan</span>
                <input
                  value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="Millonarios, Luis Díaz, Real Madrid"
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-white outline-none focus:border-white/30"
                />
              </label>
            </div>
          )}

          {current === "Fuentes" && (
            <div className="space-y-4">
              <p className="text-neutral-400">
                {activeCount} fuentes activas. Todas fueron verificadas: publican a diario y con el texto completo.
              </p>
              <ul className="divide-y divide-white/5 rounded-lg border border-white/10">
                {candidateSources.map((s) => {
                  const on = !disabled.includes(s.id);
                  return (
                    <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                      <button
                        role="switch" aria-checked={on} onClick={() => setDisabled(toggle(disabled, s.id))}
                        className={`relative h-4 w-7 flex-shrink-0 rounded-full ${on ? "bg-emerald-500" : "bg-white/15"}`}
                      >
                        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${on ? "left-[14px]" : "left-0.5"}`} />
                      </button>
                      <span className="min-w-0 flex-1 truncate text-white">{s.name}</span>
                      {s.language !== "es" && <span className="text-[10px] uppercase text-neutral-500">{s.language}</span>}
                    </li>
                  );
                })}
                {custom.map((s) => (
                  <li key={s.url} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-white">{s.name || s.url}</span>
                    <button onClick={() => setCustom(custom.filter((c) => c.url !== s.url))} aria-label="Quitar" className="text-neutral-500 hover:text-white"><X size={13} /></button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <input
                  value={newUrl} onChange={(e) => setNewUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }}
                  placeholder="Agregar feed RSS propio: https://…/rss"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black px-3 py-2 text-white outline-none focus:border-white/30"
                />
                <button onClick={addCustom} className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-3 text-white hover:bg-white/15"><Plus size={13} /> Agregar</button>
              </div>
              <label className="block">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Nunca traer noticias que mencionen</span>
                <input
                  value={blocked} onChange={(e) => setBlocked(e.target.value)} placeholder="apuestas, casino"
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-white outline-none focus:border-white/30"
                />
              </label>
            </div>
          )}

          {error && <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-300">{error}</p>}
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-white/10 px-5 py-3">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="rounded-md px-3 py-1.5 text-xs text-neutral-400 hover:text-white disabled:opacity-0">
            Atrás
          </button>
          {step < steps.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)} disabled={!canContinue}
              className="rounded-md bg-white px-4 py-1.5 text-xs font-semibold text-black disabled:opacity-40"
            >
              Continuar
            </button>
          ) : (
            <button onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-md bg-white px-4 py-1.5 text-xs font-semibold text-black disabled:opacity-50">
              {saving && <Loader2 size={12} className="animate-spin" />} Guardar y empezar
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-[12px] ${active ? "border-white bg-white text-black" : "border-white/15 text-neutral-300 hover:border-white/40"}`}
    >
      {active && <Check size={12} />} {children}
    </button>
  );
}
