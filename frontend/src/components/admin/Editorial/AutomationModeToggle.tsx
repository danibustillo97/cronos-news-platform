"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Hand, Loader2 } from "lucide-react";
import { apiFetch } from "@/studio/lab/api-client";

type AutomationSettings = {
  enabled: boolean;
  maxArticlesPerRun: number;
  maxArticlesPerDay: number;
  minTextChars: number;
  autoPublish?: boolean;
  minOriginality?: number;
  updatedAt?: string | null;
  updatedBy?: string | null;
};

const ENDPOINT = "/api/settings/editorial-automation";

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return body.message || body.detail || `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

/**
 * Modo automático editorial.
 *  - Apagado (manual): el scraper trae noticias a "Descubrir IA" y tú las redactas en el editor.
 *  - Encendido (API): tras cada pasada del scraper (cada 10 min) la IA redacta borradores
 *    de las mejores candidatas, dentro de los límites. Quedan en Revisión…
 *  - …salvo con «Publicar solo si es original»: el borrador sale sin aprobación humana
 *    únicamente si pasó las validaciones, todas sus afirmaciones tienen evidencia y el
 *    detector de plagio da originalidad ≥ mínimo y ninguna frase copiada.
 */
export default function AutomationModeToggle() {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [draft, setDraft] = useState<AutomationSettings | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch(ENDPOINT)
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response));
        const data: AutomationSettings = await response.json();
        if (!cancelled) setSettings(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo leer el modo");
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const openPanel = () => {
    if (!settings) return;
    setDraft(settings);
    setError(null);
    setOpen((value) => !value);
  };

  const save = async (next: AutomationSettings) => {
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch(ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: next.enabled,
          maxArticlesPerRun: next.maxArticlesPerRun,
          maxArticlesPerDay: next.maxArticlesPerDay,
          minTextChars: next.minTextChars,
          autoPublish: next.enabled && Boolean(next.autoPublish),
          minOriginality: next.minOriginality ?? 85,
        }),
      });
      if (!response.ok) throw new Error(await readError(response));
      const saved: AutomationSettings = await response.json();
      setSettings(saved);
      setDraft(saved);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const enabled = settings?.enabled ?? false;
  const Icon = enabled ? Bot : Hand;

  return (
    <div className="relative ml-auto flex-shrink-0 pl-2" ref={panelRef}>
      <button
        type="button"
        onClick={openPanel}
        disabled={!settings}
        title={error && !settings ? error : "Modo de redacción"}
        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-50 ${
          enabled
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/15"
            : "border-white/10 text-neutral-300 hover:bg-white/[0.06]"
        }`}
      >
        {!settings && !error ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
        {enabled ? (settings?.autoPublish ? "Automático · publica" : "Automático (IA)") : "Manual"}
      </button>

      {open && draft && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-white/10 bg-[#111] p-4 text-[12px] text-neutral-300 shadow-xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="font-semibold text-white">Modo automático</span>
            <button
              type="button"
              role="switch"
              aria-checked={draft.enabled}
              onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}
              className={`relative h-5 w-9 rounded-full transition-colors ${draft.enabled ? "bg-emerald-500" : "bg-white/15"}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${draft.enabled ? "left-[18px]" : "left-0.5"}`} />
            </button>
          </div>

          <p className="mb-3 leading-relaxed text-neutral-400">
            {draft.enabled
              ? draft.autoPublish
                ? "Cada 10 min la IA (API de Anthropic) redacta las mejores noticias nuevas y publica sola las que pasan el control: validaciones, afirmaciones con evidencia y detector de plagio. Las dudosas quedan en Revisión. Cada artículo consume créditos de la API."
                : "Cada 10 min la IA (API de Anthropic) redacta borradores de las mejores noticias nuevas. Quedan en Revisión: tú decides qué se publica. Cada borrador consume créditos de la API."
              : "El scraper trae noticias a «Descubrir IA» y tú las redactas en el editor. Sin costo de IA."}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-neutral-500">Por pasada</span>
              <input
                type="number" min={1} max={10} value={draft.maxArticlesPerRun}
                onChange={(e) => setDraft({ ...draft, maxArticlesPerRun: Number(e.target.value) })}
                className="rounded border border-white/10 bg-black px-2 py-1 text-white"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-neutral-500">Máximo por día</span>
              <input
                type="number" min={1} max={100} value={draft.maxArticlesPerDay}
                onChange={(e) => setDraft({ ...draft, maxArticlesPerDay: Number(e.target.value) })}
                className="rounded border border-white/10 bg-black px-2 py-1 text-white"
              />
            </label>
          </div>

          {draft.enabled && (
            <div className="mt-3 rounded-md border border-white/10 bg-black/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-white">Publicar solo si es original</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(draft.autoPublish)}
                  onClick={() => setDraft({ ...draft, autoPublish: !draft.autoPublish })}
                  className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${draft.autoPublish ? "bg-emerald-500" : "bg-white/15"}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${draft.autoPublish ? "left-[18px]" : "left-0.5"}`} />
                </button>
              </div>
              {draft.autoPublish && (
                <label className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-neutral-500">Originalidad mínima</span>
                  <span className="flex items-center gap-1">
                    <input
                      type="number" min={60} max={100} value={draft.minOriginality ?? 85}
                      onChange={(e) => setDraft({ ...draft, minOriginality: Number(e.target.value) })}
                      className="w-16 rounded border border-white/10 bg-black px-2 py-1 text-right text-white"
                    />
                    <span className="text-neutral-500">%</span>
                  </span>
                </label>
              )}
            </div>
          )}

          {error && <p className="mt-3 rounded border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-red-300">{error}</p>}

          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="truncate text-[10px] text-neutral-500">
              {settings?.updatedBy ? `Último cambio: ${settings.updatedBy}` : ""}
            </span>
            <button
              type="button"
              onClick={() => void save(draft)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-[11px] font-semibold text-black disabled:opacity-60"
            >
              {saving && <Loader2 size={12} className="animate-spin" />}
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
