"use client";

// Live SEO + originality panel. Lives in the editor's right column (the same
// 300px the portal uses for its sidebar), so the article keeps its real width.

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, ShieldCheck, XCircle } from "lucide-react";
import type { CheckGroup, SeoCheck, SeoReport } from "./seo";

export interface OriginalityResult {
  originality: number;
  articleWords: number;
  comparedSources: number;
  sources: { name: string; url: string; overlap: number }[];
  copied: { text: string; source: string; ratio: number }[];
  stale?: boolean;
}

export interface SeoFields {
  seoTitle: string;
  seoDescription: string;
  slug: string;
}

const GROUP_ORDER: CheckGroup[] = ["Monetización", "Titular", "Google", "Contenido", "Legibilidad", "Medios", "Fuentes"];

function scoreTone(score: number) {
  if (score >= 85) return { label: "Excelente", ring: "#10b981", text: "text-emerald-600" };
  if (score >= 70) return { label: "Bueno", ring: "#84cc16", text: "text-lime-600" };
  if (score >= 50) return { label: "Mejorable", ring: "#f59e0b", text: "text-amber-600" };
  return { label: "Débil", ring: "#ef4444", text: "text-red-600" };
}

function StatusIcon({ status }: { status: SeoCheck["status"] }) {
  if (status === "pass") return <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-emerald-500" />;
  if (status === "warn") return <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-amber-500" />;
  return <XCircle size={14} className="mt-0.5 flex-shrink-0 text-red-500" />;
}

function Counter({ value, min, max }: { value: number; min: number; max: number }) {
  const ok = value >= min && value <= max;
  return <span className={`text-[10px] ${ok ? "text-emerald-600" : value === 0 ? "text-neutral-400" : "text-amber-600"}`}>{value}/{max}</span>;
}

export default function SeoPanel({
  report, keyword, onKeywordChange, fields, title, onFieldsChange, readOnly,
  originality, analyzing, onAnalyze, onCopyRewrite, onPasteRewrite,
  autoFixLabels = {}, onAutoFix, onAutoFixAll, aiFixCount = 0, onCopyFix, onPasteFix,
}: {
  report: SeoReport;
  keyword: string;
  onKeywordChange: (value: string) => void;
  fields: SeoFields | null;
  title: string;
  onFieldsChange: (patch: Partial<SeoFields>) => void;
  readOnly: boolean;
  originality: OriginalityResult | null;
  analyzing: boolean;
  onAnalyze: () => void;
  onCopyRewrite?: () => void;
  onPasteRewrite?: () => void;
  /** check id -> label of its automatic fix */
  autoFixLabels?: Record<string, string>;
  onAutoFix?: (checkId: string) => void;
  onAutoFixAll?: () => void;
  aiFixCount?: number;
  onCopyFix?: () => void;
  onPasteFix?: () => void;
}) {
  const [showPassed, setShowPassed] = useState(false);
  const tone = scoreTone(report.score);
  const circumference = 2 * Math.PI * 26;

  const grouped = useMemo(() => {
    const order = { fail: 0, warn: 1, pass: 2 } as const;
    return GROUP_ORDER.map((group) => ({
      group,
      checks: report.checks.filter((c) => c.group === group).sort((a, b) => order[a.status] - order[b.status]),
    })).filter((g) => g.checks.length);
  }, [report.checks]);

  const pending = report.checks.filter((c) => c.status !== "pass").length;
  const serpTitle = (fields?.seoTitle || title || "Titular de la noticia").trim();
  const serpDesc = (fields?.seoDescription || "Escribe una meta descripción: es el texto que Google muestra debajo del título.").trim();

  return (
    <div className="space-y-4 font-sans text-[12px] text-neutral-700">
      {/* Score */}
      <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 p-3">
        <svg width="64" height="64" viewBox="0 0 64 64" className="flex-shrink-0" aria-hidden>
          <circle cx="32" cy="32" r="26" fill="none" stroke="#e5e7eb" strokeWidth="6" />
          <circle cx="32" cy="32" r="26" fill="none" stroke={tone.ring} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - report.score / 100)} transform="rotate(-90 32 32)" />
          <text x="32" y="37" textAnchor="middle" className="fill-neutral-900 text-[17px] font-black">{report.score}</text>
        </svg>
        <div className="min-w-0">
          <p className={`text-sm font-bold ${tone.text}`}>SEO {tone.label}</p>
          <p className="text-[11px] leading-snug text-neutral-500">
            {pending ? `${pending} punto(s) por mejorar` : "Todo en orden"} · {report.words} palabras · lectura {report.readability ?? "–"}/100
          </p>
        </div>
      </div>

      {/* Keyword */}
      <label className="block">
        <span className="flex items-center justify-between text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">
          Palabra clave principal
          {report.keywordSource === "auto" && <span className="normal-case tracking-normal text-neutral-400">sugerida</span>}
        </span>
        <input
          value={keyword} onChange={(e) => onKeywordChange(e.target.value)} placeholder={report.keyword} disabled={readOnly}
          className="mt-1 w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-[12.5px] text-neutral-900 outline-none focus:border-neutral-500"
        />
        <span className="mt-1 block text-[10.5px] text-neutral-400">Lo que la gente escribe en Google para encontrar esta noticia.</span>
      </label>

      {/* Google preview + fields */}
      <div className="rounded-2xl border border-neutral-200 p-3">
        <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">Así se verá en Google</p>
        <div className="rounded-lg bg-neutral-50 p-2.5">
          <p className="truncate text-[11px] text-neutral-500">nexusnews.info › noticia › {fields?.slug || "…"}</p>
          <p className="mt-0.5 line-clamp-2 text-[15px] leading-snug text-[#1a0dab]">{serpTitle.length > 62 ? `${serpTitle.slice(0, 60)}…` : serpTitle}</p>
          <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-neutral-600">{serpDesc.length > 160 ? `${serpDesc.slice(0, 157)}…` : serpDesc}</p>
        </div>
        {fields && !readOnly && (
          <div className="mt-3 space-y-2">
            <label className="block">
              <span className="flex justify-between text-[10.5px] text-neutral-500">Título SEO <Counter value={fields.seoTitle.length} min={40} max={60} /></span>
              <input value={fields.seoTitle} onChange={(e) => onFieldsChange({ seoTitle: e.target.value })}
                className="mt-0.5 w-full rounded-md border border-neutral-200 px-2 py-1 text-[12px] text-neutral-900 outline-none focus:border-neutral-500" />
            </label>
            <label className="block">
              <span className="flex justify-between text-[10.5px] text-neutral-500">Meta descripción <Counter value={fields.seoDescription.length} min={120} max={158} /></span>
              <textarea value={fields.seoDescription} rows={3} onChange={(e) => onFieldsChange({ seoDescription: e.target.value })}
                className="mt-0.5 w-full resize-none rounded-md border border-neutral-200 px-2 py-1 text-[12px] text-neutral-900 outline-none focus:border-neutral-500" />
            </label>
            <label className="block">
              <span className="flex justify-between text-[10.5px] text-neutral-500">URL (slug) <Counter value={fields.slug.length} min={1} max={75} /></span>
              <input value={fields.slug}
                onChange={(e) => onFieldsChange({ slug: e.target.value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9-]+/g, "-") })}
                className="mt-0.5 w-full rounded-md border border-neutral-200 px-2 py-1 font-mono text-[11.5px] text-neutral-900 outline-none focus:border-neutral-500" />
            </label>
          </div>
        )}
      </div>

      {/* Originality */}
      <div className="rounded-2xl border border-neutral-200 p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400"><ShieldCheck size={13} /> Antiplagio</p>
          <button type="button" onClick={onAnalyze} disabled={analyzing}
            className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50">
            {analyzing && <Loader2 size={11} className="animate-spin" />} {originality ? "Volver a analizar" : "Analizar originalidad"}
          </button>
        </div>
        {!originality && <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">Compara tu texto con la nota original y con lo que publicaron otros medios sobre la misma historia.</p>}
        {originality && (
          <div className="mt-2 space-y-2">
            <p className={`text-2xl font-black ${originality.originality >= 80 ? "text-emerald-600" : originality.originality >= 60 ? "text-amber-600" : "text-red-600"}`}>
              {Math.round(originality.originality)}% <span className="text-xs font-semibold text-neutral-500">original</span>
            </p>
            {originality.stale && <p className="text-[10.5px] text-amber-600">Editaste después del análisis: vuelve a analizar.</p>}
            <p className="text-[11px] text-neutral-500">
              {originality.comparedSources ? `Comparado con ${originality.comparedSources} fuente(s)` : "No hay fuentes con las que comparar"}
            </p>
            {originality.sources.filter((s) => s.overlap > 0.02).map((s) => (
              <div key={s.url} className="flex items-center gap-2 text-[11px]">
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-100"><span className="block h-full bg-red-400" style={{ width: `${Math.min(100, s.overlap * 100)}%` }} /></span>
                <span className="w-9 text-right text-neutral-500">{Math.round(s.overlap * 100)}%</span>
              </div>
            ))}
            {originality.copied.length > 0 && !readOnly && (
              <div className="rounded-lg bg-neutral-50 p-2">
                <p className="text-[11px] font-semibold text-neutral-800">Corregir solo esas frases con ChatGPT</p>
                <div className="mt-1.5 flex gap-1.5">
                  <button type="button" onClick={onCopyRewrite}
                    className="flex-1 rounded-md bg-neutral-900 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-neutral-700">
                    1 · Copiar frases
                  </button>
                  <button type="button" onClick={onPasteRewrite}
                    className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-neutral-800 hover:border-neutral-500">
                    2 · Pegar correcciones
                  </button>
                </div>
                <p className="mt-1 text-[10.5px] text-neutral-500">Cada frase nueva reemplaza solo la suya; el resto de la nota no se toca.</p>
              </div>
            )}
            {originality.copied.length > 0 && (
              <details className="group" open={originality.originality < 80}>
                <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] font-semibold text-red-600">
                  <ChevronDown size={12} className="transition group-open:rotate-180" /> {originality.copied.length} frase(s) copiadas para reescribir
                </summary>
                <ul className="mt-1.5 space-y-1.5">
                  {originality.copied.map((c, i) => (
                    <li key={i} className="rounded-md bg-red-50 p-2 text-[11px] leading-snug text-neutral-700">
                      «{c.text.length > 220 ? `${c.text.slice(0, 217)}…` : c.text}»
                      <span className="mt-0.5 block text-[10px] text-red-500">{Math.round(c.ratio * 100)}% igual a {c.source}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Fix the warnings */}
      {!readOnly && (Object.keys(autoFixLabels).length > 0 || aiFixCount > 0) && (
        <div className="rounded-2xl border border-yellow-300 bg-yellow-50/60 p-3">
          <p className="text-[12px] font-semibold text-neutral-900">Corregir avisos</p>
          {Object.keys(autoFixLabels).length > 0 && (
            <button type="button" onClick={onAutoFixAll}
              className="mt-2 w-full rounded-md bg-neutral-900 px-2 py-1.5 text-[11.5px] font-semibold text-white hover:bg-neutral-700">
              Arreglar {Object.keys(autoFixLabels).length} automáticamente
            </button>
          )}
          {aiFixCount > 0 && (
            <>
              <p className="mt-2 text-[11px] text-neutral-600">{aiFixCount} aviso(s) necesitan redacción: un solo prompt para ChatGPT con lo que está mal.</p>
              <div className="mt-1.5 flex gap-1.5">
                <button type="button" onClick={onCopyFix}
                  className="flex-1 rounded-md bg-neutral-900 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-neutral-700">1 · Copiar prompt</button>
                <button type="button" onClick={onPasteFix}
                  className="flex-1 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-neutral-800 hover:border-neutral-500">2 · Pegar respuesta</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Checks */}
      <div className="space-y-3">
        {grouped.map(({ group, checks }) => {
          const visible = showPassed ? checks : checks.filter((c) => c.status !== "pass");
          if (!visible.length) return null;
          return (
            <div key={group}>
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">{group}</p>
              <ul className="space-y-1.5">
                {visible.map((c) => (
                  <li key={c.id} className="flex gap-2">
                    <StatusIcon status={c.status} />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-neutral-800">{c.label}</p>
                      <p className="text-[11px] text-neutral-500">{c.detail}</p>
                      {c.fix && <p className="mt-0.5 text-[11px] text-neutral-700">→ {c.fix}</p>}
                      {!readOnly && autoFixLabels[c.id] && (
                        <button type="button" onClick={() => onAutoFix?.(c.id)}
                          className="mt-1 rounded-md border border-neutral-300 px-2 py-0.5 text-[10.5px] font-semibold text-neutral-800 hover:border-neutral-600">
                          Arreglar: {autoFixLabels[c.id]}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <button type="button" onClick={() => setShowPassed((v) => !v)} className="text-[11px] text-neutral-500 underline-offset-2 hover:underline">
          {showPassed ? "Ocultar lo que ya está bien" : `Ver también lo que ya está bien (${report.checks.filter((c) => c.status === "pass").length})`}
        </button>
      </div>
    </div>
  );
}
