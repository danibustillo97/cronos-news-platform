"use client";

// Dev harness for /broadcast/studio-lab (404 in production). Query:
//   ?modes=yesterday,today&min=30&q=MEDIUM&voice=1&autoplay=1&stage=DEBATE
// Exposes window.__lab for automated tests: edition, director state, renderer stats.

import { useEffect, useRef, useState } from "react";
import { LocalNarrator, NarrationQueue } from "../engine/narration";
import { Director, type DirectorState } from "./director";
import { buildEdition } from "./editorial";
import { gatherShowData } from "./data";
import { aiRewrite, editionContext } from "./aiWriter";
import { ShowRenderer } from "./renderer";
import type { Edition, Mode, Quality, Shot, StageId } from "./types";

declare global { interface Window { __lab?: Record<string, unknown> } }

export default function StudioLab() {
  const host = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState("Preparando…");
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const modes = (q.get("modes") ?? "yesterday,today").split(",") as Mode[];
    const quality = (q.get("q") ?? "MEDIUM") as Quality;
    const r = new ShowRenderer(quality);
    r.start();
    const c = r.output; c.style.width = "100%"; c.style.height = "100%"; c.style.objectFit = "contain";
    host.current?.appendChild(c);
    const lab: Record<string, unknown> = { renderer: r, stats: () => r.stats() };
    window.__lab = lab;
    let d: Director | null = null;
    (async () => {
      if (q.get("stage")) { r.setStage(q.get("stage") as StageId, (q.get("shot") as Shot) ?? undefined); setMsg("Escena fija"); lab.ready = true; return; }
      const { data, report } = await gatherShowData(modes, (q.get("leagues") ?? "").split(",").filter(Boolean), setMsg);
      const edition: Edition = buildEdition(data, { modes, leagues: [], targetMin: Number(q.get("min") ?? 30) as 30 });
      lab.edition = edition; lab.report = report;
      // AI narration test hook: the test injects the provider call (window.__ask)
      lab.aiRewrite = async () => {
        const ask = (window as unknown as { __ask: (p: string) => Promise<string> }).__ask;
        const results = data.recaps.flatMap((x) => x.leagues.flatMap((l) => l.matches));
        const out = await aiRewrite(edition, editionContext(data, results), setMsg, ask);
        lab.aiEdition = out.edition; lab.aiReport = out.report;
        return out.report;
      }; lab.data = { recaps: data.recaps.length, live: data.live.length, upcoming: data.upcoming.length, news: data.news.length, polls: data.polls.length, logos: Object.keys(data.logos).length };
      let narrate: ((l: Parameters<NarrationQueue["speak"]>[0]) => Promise<void>) | undefined;
      let queue: NarrationQueue | null = null;
      if (q.get("voice") === "1") {
        const prov = new LocalNarrator();
        const st = await prov.status();
        if (st.reachable) {
          const ctx = new AudioContext(); await ctx.resume();
          queue = new NarrationQueue(prov, ctx, ctx.destination, { provider: "kokoro", voice: "em_alex" });
          narrate = (l) => queue!.speak(l);
        }
      }
      const states: DirectorState[] = [];
      d = new Director(edition, { renderer: r, narrate, prepare: (l) => void queue?.prepare(l).catch(() => undefined), stopNarration: () => queue?.interrupt(), onState: (s) => { states.push(s); lab.state = s; } });
      d.setVoice(Boolean(narrate));
      lab.director = d; lab.states = states;
      setMsg(`${edition.segments.length} segmentos · ${Math.round(edition.estimatedS / 60)} min`);
      lab.ready = true;
      if (q.get("autoplay") === "1") d.play(0);
    })().catch((e) => { setMsg(String(e)); lab.error = String(e); });
    return () => { d?.stop(); r.dispose(); };
  }, []);
  return (
    <main className="fixed inset-0 flex flex-col bg-black">
      <div ref={host} className="min-h-0 flex-1" />
      <p className="px-2 py-1 font-mono text-[11px] text-white/60">{msg}</p>
    </main>
  );
}
