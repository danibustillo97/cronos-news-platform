"use client";

// Left column of the studio: every followed match, live first, then upcoming by
// kickoff, then finished. "Transmitir" makes it the main match (scoreboard +
// data follow it automatically); "En pantalla" adds it to the multi-scoreboard.

import { useEffect, useMemo, useState } from "react";
import { Loader2, MonitorUp, Radio, RefreshCw } from "lucide-react";
import { COMPETITIONS } from "./competitions";
import type { Fixture, FootballMatchController } from "./useFootballMatch";
import { readMultiSelection, writeMultiSelection } from "./liveBoard";

const LEAGUES = COMPETITIONS.filter((c) => c.espn && c.id !== "mls");

function ymd(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

export function groupLabel(f: Fixture, now: Date): string {
  if (f.state === "in") return "En vivo";
  if (f.state === "post") return "Terminados";
  const d = new Date(f.date);
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(d) - day(now)) / 86400000);
  if (diff <= 0) return "Hoy";
  if (diff === 1) return "Mañana";
  return d.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "short" });
}

const ORDER = (label: string) => (label === "En vivo" ? 0 : label === "Hoy" ? 1 : label === "Mañana" ? 2 : label === "Terminados" ? 9 : 3);

export function MatchRail({ fm }: { fm: FootballMatchController }) {
  const [fixtures, setFixtures] = useState<(Fixture & { competitionId: string; competition: string })[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setSelected(readMultiSelection());
    let alive = true;
    const from = new Date();
    from.setDate(from.getDate() - 1);
    const to = new Date();
    to.setDate(to.getDate() + 4);
    Promise.all(LEAGUES.map(async (c) => {
      try {
        const res = await fetch(`/api/football/fixtures?league=${encodeURIComponent(c.espn)}&dates=${ymd(from)}-${ymd(to)}`);
        if (!res.ok) return [];
        const data = await res.json() as { fixtures: Fixture[] };
        return data.fixtures.map((f) => ({ ...f, competitionId: c.id, competition: c.short }));
      } catch { return []; }
    })).then((lists) => { if (alive) setFixtures(lists.flat()); });
    const timer = window.setInterval(() => setReload((n) => n + 1), 60000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [reload]);

  const groups = useMemo(() => {
    const now = new Date();
    const map = new Map<string, (Fixture & { competitionId: string; competition: string })[]>();
    for (const f of fixtures ?? []) {
      const label = groupLabel(f, now);
      map.set(label, [...(map.get(label) ?? []), f]);
    }
    return [...map.entries()]
      .map(([label, list]) => [label, list.sort((a, b) => (label === "Terminados" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)))] as const)
      .sort((a, b) => ORDER(a[0]) - ORDER(b[0]));
  }, [fixtures]);

  const toggle = (id: string) => {
    const next = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    setSelected(next);
    writeMultiSelection(next);
  };
  const mainId = fm.fixture?.id;

  return (
    <aside className="flex min-h-0 w-full flex-col border-b border-white/[0.08] bg-[#0b0f15] xl:w-[340px] xl:flex-shrink-0 xl:border-b-0 xl:border-r">
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2.5">
        <Radio size={14} className="text-red-400" />
        <h3 className="text-[13px] font-bold text-white">Partidos</h3>
        <span className="text-[11px] text-neutral-500">{selected.length ? `${selected.length} en pantalla` : "en pantalla: todos los en vivo"}</span>
        <button type="button" onClick={() => setReload((n) => n + 1)} className="ml-auto rounded p-1 text-neutral-500 hover:text-white" aria-label="Actualizar"><RefreshCw size={13} /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {fixtures === null && <p className="flex items-center gap-2 p-3 text-[12px] text-neutral-500"><Loader2 size={13} className="animate-spin" /> Buscando partidos…</p>}
        {groups.map(([label, list]) => (
          <section key={label} className="mb-3">
            <p className={`sticky top-0 z-10 mb-1 bg-[#0b0f15] px-1 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] ${label === "En vivo" ? "text-red-400" : "text-neutral-500"}`}>{label} · {list.length}</p>
            <ul className="space-y-1">
              {list.map((f) => {
                const main = mainId === f.id;
                const onScreen = selected.includes(f.id);
                const time = new Date(f.date).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
                return (
                  <li key={f.id} className={`rounded-xl border p-2 ${main ? "border-emerald-400/70 bg-emerald-400/[0.07]" : "border-white/[0.06] bg-white/[0.02]"}`}>
                    <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                      <span className="truncate">{f.competition}</span>
                      <span className={`ml-auto flex-shrink-0 font-semibold ${f.state === "in" ? "text-red-400" : ""}`}>{f.state === "in" ? `● ${f.detail}` : f.state === "post" ? "Final" : time}</span>
                    </div>
                    {[f.home, f.away].map((t) => (
                      <div key={t.id} className="mt-1 flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {t.logo ? <img src={t.logo} alt="" className="h-5 w-5 object-contain" /> : <span className="h-5 w-5 rounded-full bg-white/10" />}
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-neutral-100">{t.name}</span>
                        {f.state !== "pre" && <span className="text-[13px] font-bold tabular-nums text-white">{t.score}</span>}
                      </div>
                    ))}
                    <div className="mt-2 flex gap-1.5">
                      <button type="button" onClick={() => void fm.loadFixture(f, f.competitionId)}
                        className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold ${main ? "bg-emerald-400 text-black" : "bg-white/[0.08] text-white hover:bg-white/[0.14]"}`}>
                        <MonitorUp size={12} /> {main ? "Transmitiendo" : "Transmitir"}
                      </button>
                      <button type="button" onClick={() => toggle(f.id)} aria-pressed={onScreen}
                        className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${onScreen ? "border-yellow-400 bg-yellow-400/15 text-yellow-200" : "border-white/10 text-neutral-400 hover:border-white/30"}`}>
                        {onScreen ? "En pantalla ✓" : "En pantalla"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </aside>
  );
}
