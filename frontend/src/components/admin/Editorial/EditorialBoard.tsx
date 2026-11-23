"use client";

// Redacción -- the single board where the newsroom works.
// Entrantes → Redactando → Por revisar → Programadas → Publicadas.
// One call loads every column (GET /api/editorial/board); each card moves
// forward with one click; clicking an article opens the editor full screen.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Bot, CalendarClock, CheckCircle2, ExternalLink, Inbox, Loader2, PenLine, Plus, RefreshCw,
  Search, Send, Sparkles, X,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/studio/lab/api-client";
import AutomationModeToggle from "./AutomationModeToggle";
import RevisionWorkspace from "./RevisionWorkspace";
import { StatusPill } from "./EditorialStatus";
import ContentSetup, { type ContentProfile } from "./ContentSetup";

type ColumnId = "incoming" | "writing" | "review" | "scheduled" | "published";

type Card = {
  kind: "item" | "job" | "article";
  id: string;
  column: ColumnId;
  title: string;
  status: string;
  storyId: string | null;
  excerpt: string | null;
  imageUrl: string | null;
  source: string | null;
  categoryId: string | null;
  at: string | null;
  scheduledAt: string | null;
  issueCount: number;
  jobStatus: string | null;
  jobError: string | null;
  slug: string | null;
  topics: string[];
  relevance: number | null;
  heat: number | null;
  signals: string[];
  sources: string[];
  clusterIds: string[];
  firstSeen: string | null;
};

type IncomingView = "hot" | "recent" | "trending";
const INCOMING_VIEWS: { id: IncomingView; label: string; hint: string }[] = [
  { id: "hot", label: "Calientes", hint: "Lo más nuevo y lo que más medios cubren, primero" },
  { id: "recent", label: "Recientes", hint: "Por hora de publicación, la más nueva arriba" },
  { id: "trending", label: "Tendencias", hint: "Historias que cubren 2 o más medios" },
];

type Board = { columns: Record<ColumnId, Card[]>; counts: Record<ColumnId, number> };

const COLUMNS: { id: ColumnId; label: string; hint: string; icon: typeof Inbox }[] = [
  { id: "incoming", label: "Entrantes", hint: "Noticias nuevas del scraper", icon: Inbox },
  { id: "writing", label: "Redactando", hint: "Borradores tuyos o de la IA", icon: PenLine },
  { id: "review", label: "Por revisar", hint: "Revisa, aprueba y publica", icon: CheckCircle2 },
  { id: "scheduled", label: "Programadas", hint: "Se publican solas a su hora", icon: CalendarClock },
  { id: "published", label: "Publicadas", hint: "Ya están en el sitio", icon: Send },
];

const EMPTY: Record<ColumnId, string> = {
  incoming: "No hay noticias nuevas. El scraper trae más cada 10 min, o pulsa «Buscar noticias».",
  writing: "Nada en redacción. Elige una noticia en Entrantes o crea una nueva.",
  review: "Nada por revisar.",
  scheduled: "No hay publicaciones programadas.",
  published: "Todavía no hay publicaciones.",
};

async function errorMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => null);
  return body?.message || body?.detail || `HTTP ${response.status}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short" });
}

function formatWhen(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString("es", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
}

export default function EditorialBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [query, setQuery] = useState("");
  const [mobileColumn, setMobileColumn] = useState<ColumnId>("incoming");
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [newOpen, setNewOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [searching, setSearching] = useState(false);
  const [profile, setProfile] = useState<ContentProfile | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [incomingView, setIncomingView] = useState<IncomingView>("hot");
  const mounted = useRef(true);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const response = await apiFetch("/api/editorial/board");
      if (!response.ok) throw new Error(await errorMessage(response));
      const data: Board = await response.json();
      if (mounted.current) {
        setBoard(data);
        setLoadError(null);
      }
    } catch (err) {
      if (mounted.current) setLoadError(err instanceof Error ? err.message : "No se pudo cargar el tablero");
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    apiFetch("/api/settings/content-profile").then(async (response) => {
      if (!response.ok) return;
      const data: ContentProfile = await response.json();
      if (!mounted.current) return;
      setProfile(data);
      if (!data.setupCompleted) setSetupOpen(true);
    }).catch(() => undefined);
    apiFetch("/api/categories").then(async (response) => {
      if (!response.ok) return;
      const data = await response.json();
      const names: Record<string, string> = {};
      for (const group of data.groups ?? []) for (const c of group.categories ?? []) names[c.id] = c.name;
      if (mounted.current) setCategories(names);
    }).catch(() => undefined);
    return () => { mounted.current = false; };
  }, [load]);

  // Poll faster while the AI is writing something; refresh on tab focus.
  const aiWorking = useMemo(
    () => board?.columns.writing.some((c) => c.jobStatus === "QUEUED" || c.jobStatus === "RUNNING" || c.status === "AI_PENDING") ?? false,
    [board],
  );
  useEffect(() => {
    if (openArticleId) return;
    const timer = setInterval(() => void load(true), aiWorking ? 15000 : 60000);
    const onFocus = () => void load(true);
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [aiWorking, load, openArticleId]);

  const withBusy = async (id: string, label: string, action: () => Promise<void>) => {
    setBusy((prev) => ({ ...prev, [id]: label }));
    try {
      await action();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo completar la acción");
    } finally {
      setBusy((prev) => { const next = { ...prev }; delete next[id]; return next; });
    }
  };

  const write = (card: Card, mode: "manual" | "ai") => withBusy(card.id, mode, async () => {
    const response = await apiFetch(`/api/editorial/items/${encodeURIComponent(card.id)}/write`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, siblingIds: (card.clusterIds ?? []).filter((id) => id !== card.id) }),
    });
    if (!response.ok) throw new Error(await errorMessage(response));
    const result = await response.json();
    if (mode === "manual" && result.artifact?.id) {
      setOpenArticleId(result.artifact.id);
    } else {
      toast.success("La IA está redactando. Aparecerá en «Por revisar» en unos minutos.");
    }
    await load(true);
  });

  const retryAi = (card: Card) => withBusy(card.id, "ai", async () => {
    const response = await apiFetch("/api/artifacts/jobs", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storyId: card.storyId ?? card.id }),
    });
    if (!response.ok) throw new Error(await errorMessage(response));
    toast.success("La IA lo intenta de nuevo");
    await load(true);
  });

  const discard = (card: Card) => withBusy(card.id, "discard", async () => {
    const response = await apiFetch("/api/editorial/items/discard", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: card.clusterIds?.length ? card.clusterIds : [card.id] }),
    });
    if (!response.ok) throw new Error(await errorMessage(response));
    setBoard((prev) => prev && ({
      ...prev,
      columns: { ...prev.columns, incoming: prev.columns.incoming.filter((c) => c.id !== card.id) },
      counts: { ...prev.counts, incoming: Math.max(0, prev.counts.incoming - 1) },
    }));
  });

  const publish = (card: Card) => withBusy(card.id, "publish", async () => {
    const response = await apiFetch(`/api/artifacts/${encodeURIComponent(card.id)}/publish`, { method: "POST" });
    if (!response.ok) throw new Error(await errorMessage(response));
    toast.success("Publicada: ya está en el sitio");
    await load(true);
  });

  const searchNews = async () => {
    setSearching(true);
    try {
      const response = await apiFetch("/api/discovery/jobs", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      toast.success("Buscando noticias. Las nuevas aparecerán en «Entrantes» en 1–2 minutos.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo iniciar la búsqueda");
    } finally {
      setSearching(false);
    }
  };

  const createArticle = async () => {
    const title = newTitle.trim();
    if (!title) return;
    await withBusy("new", "create", async () => {
      const response = await apiFetch("/api/editorial/articles", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const artifact = await response.json();
      setNewOpen(false);
      setNewTitle("");
      setOpenArticleId(artifact.id);
      await load(true);
    });
  };

  const filtered = useMemo(() => {
    if (!board) return null;
    const q = query.trim().toLocaleLowerCase();
    const match = (c: Card) => !q || c.title.toLocaleLowerCase().includes(q)
      || [c.source ?? "", ...(c.sources ?? []), ...(c.topics ?? [])].some((s) => s.toLocaleLowerCase().includes(q))
      || (c.categoryId ? (categories[c.categoryId] ?? "").toLocaleLowerCase().includes(q) : false);
    const columns = Object.fromEntries(Object.entries(board.columns).map(([k, v]) => [k, v.filter(match)])) as Board["columns"];
    // Incoming arrives ranked by heat from the backend; the other views re-sort/filter it.
    const time = (c: Card) => (c.at ? new Date(c.at).getTime() : 0);
    if (incomingView === "recent") columns.incoming = [...columns.incoming].sort((a, b) => time(b) - time(a));
    if (incomingView === "trending") {
      columns.incoming = columns.incoming.filter((c) => (c.sources?.length ?? 0) >= 2)
        .sort((a, b) => (b.sources.length - a.sources.length) || time(b) - time(a));
    }
    return columns;
  }, [board, query, categories, incomingView]);

  const openCard = (card: Card) => {
    if (card.kind === "article") setOpenArticleId(card.id);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#080808]">
      {/* Header */}
      <header className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-white/10 px-3 py-2 sm:px-5">
        <h1 className="mr-2 text-[15px] font-semibold text-white">Redacción</h1>
        <label className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-2.5 sm:max-w-xs">
          <Search size={14} className="flex-shrink-0 text-neutral-500" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar en el tablero"
            className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-neutral-600"
          />
          {query && <button onClick={() => setQuery("")} aria-label="Limpiar búsqueda"><X size={13} className="text-neutral-500" /></button>}
        </label>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => void load()} title="Actualizar" aria-label="Actualizar"
            className="rounded-lg p-2 text-neutral-400 hover:bg-white/[0.06] hover:text-white"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => void searchNews()} disabled={searching}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-neutral-200 hover:bg-white/[0.06] disabled:opacity-50"
          >
            {searching ? <Loader2 size={13} className="animate-spin" /> : <Inbox size={13} />} Buscar noticias
          </button>
          <button
            onClick={() => setNewOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-white px-2.5 py-1.5 text-[11px] font-semibold text-black hover:bg-neutral-200"
          >
            <Plus size={13} /> Nueva noticia
          </button>
        </div>
        {profile && (
          <button
            onClick={() => setSetupOpen(true)} title="Tipo de contenido, competiciones y fuentes"
            className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-neutral-200 hover:bg-white/[0.06]"
          >
            Contenido: {profile.catalog.modes.find((m) => m.id === profile.mode)?.name ?? profile.mode}
          </button>
        )}
        <AutomationModeToggle />
      </header>

      {/* Mobile column picker */}
      <nav className="flex flex-shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 py-2 md:hidden" aria-label="Columnas">
        {COLUMNS.map(({ id, label }) => (
          <button
            key={id} onClick={() => setMobileColumn(id)}
            className={`flex-shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-medium ${mobileColumn === id ? "bg-white/[0.1] text-white" : "text-neutral-400"}`}
          >
            {label} {board ? <span className="text-neutral-500">{board.counts[id]}</span> : null}
          </button>
        ))}
      </nav>

      {/* Columns */}
      {loadError && !board ? (
        <div className="m-6 max-w-lg rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4 text-sm text-red-200">
          <p className="font-semibold">No se pudo cargar el tablero</p>
          <p className="mt-1 text-red-200/70">{loadError}</p>
          <button onClick={() => void load()} className="mt-3 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-black">Reintentar</button>
        </div>
      ) : !filtered ? (
        <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
          <Loader2 size={16} className="mr-2 animate-spin" /> Cargando tablero…
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3 sm:px-5">
          {COLUMNS.map(({ id, label, hint, icon: Icon }) => (
            <section
              key={id}
              className={`${mobileColumn === id ? "flex" : "hidden"} md:flex min-h-0 w-full flex-shrink-0 flex-col rounded-xl border border-white/[0.07] bg-white/[0.02] md:w-[300px] xl:w-auto xl:min-w-[240px] xl:flex-1`}
            >
              <div className="flex flex-shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
                <Icon size={14} className="text-neutral-400" />
                <h2 className="text-[12.5px] font-semibold text-white">{label}</h2>
                <span className="rounded-full bg-white/[0.06] px-1.5 text-[10.5px] text-neutral-400">{filtered[id].length}</span>
                <span className="ml-auto hidden truncate text-[10.5px] text-neutral-600 2xl:inline">{hint}</span>
              </div>
              {id === "incoming" && (
                <div className="flex flex-shrink-0 gap-1 border-b border-white/[0.06] px-2 py-1.5">
                  {INCOMING_VIEWS.map((view) => (
                    <button
                      key={view.id} title={view.hint} onClick={() => setIncomingView(view.id)}
                      className={`rounded-md px-2 py-1 text-[10.5px] font-medium ${incomingView === view.id ? "bg-white/[0.1] text-white" : "text-neutral-500 hover:text-neutral-200"}`}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
                {filtered[id].length === 0 ? (
                  <p className="px-2 py-6 text-center text-[11.5px] leading-relaxed text-neutral-600">{query ? "Sin coincidencias." : EMPTY[id]}</p>
                ) : filtered[id].map((card) => (
                  <BoardCardView
                    key={`${card.kind}-${card.id}`} card={card} busy={busy[card.id]}
                    category={card.categoryId ? categories[card.categoryId] : undefined}
                    onOpen={() => openCard(card)} onWrite={(mode) => void write(card, mode)}
                    onDiscard={() => void discard(card)} onRetryAi={() => void retryAi(card)} onPublish={() => void publish(card)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {setupOpen && profile && (
        <ContentSetup
          profile={profile}
          onClose={() => setSetupOpen(false)}
          onSaved={(saved) => {
            setProfile(saved);
            setSetupOpen(false);
            toast.success(`Listo: ${saved.activeSourceCount} fuentes activas. Pulsa «Buscar noticias» para traer las primeras.`);
          }}
        />
      )}

      {/* New article */}
      {newOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/60 p-4 pt-[15vh]" onClick={() => setNewOpen(false)}>
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#111] p-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white">Nueva noticia</h3>
            <p className="mt-1 text-[11.5px] text-neutral-500">Escribe el titular; el resto lo completas en el editor.</p>
            <input
              autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void createArticle(); if (e.key === "Escape") setNewOpen(false); }}
              placeholder="Titular de la noticia"
              className="mt-3 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-white/30"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setNewOpen(false)} className="rounded-md px-3 py-1.5 text-xs text-neutral-400 hover:text-white">Cancelar</button>
              <button
                onClick={() => void createArticle()} disabled={!newTitle.trim() || Boolean(busy.new)}
                className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
              >
                {busy.new && <Loader2 size={12} className="animate-spin" />} Crear y abrir editor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen editor */}
      {openArticleId && (
        <div className="fixed inset-0 z-30 bg-[#080808]">
          <RevisionWorkspace
            key={openArticleId}
            focusArtifactId={openArticleId}
            onClose={() => { setOpenArticleId(null); void load(true); }}
            onChanged={() => void load(true)}
          />
        </div>
      )}
    </div>
  );
}

function BoardCardView({
  card, busy, category, onOpen, onWrite, onDiscard, onRetryAi, onPublish,
}: {
  card: Card;
  busy?: string;
  category?: string;
  onOpen: () => void;
  onWrite: (mode: "manual" | "ai") => void;
  onDiscard: () => void;
  onRetryAi: () => void;
  onPublish: () => void;
}) {
  const clickable = card.kind === "article";
  const aiRunning = card.kind === "job" && card.jobStatus !== "FAILED";
  const aiFailed = card.kind === "job" && card.jobStatus === "FAILED";

  return (
    <article
      onClick={clickable ? onOpen : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter") onOpen(); } : undefined}
      tabIndex={clickable ? 0 : undefined}
      className={`group rounded-lg border border-white/[0.07] bg-[#0f0f0f] p-2.5 transition-colors ${clickable ? "cursor-pointer hover:border-white/20 focus:border-white/30 focus:outline-none" : ""}`}
    >
      {card.kind === "item" && <TrendSignals card={card} />}
      <div className="flex gap-2.5">
        {card.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageUrl} alt="" loading="lazy" className="h-14 w-14 flex-shrink-0 rounded-md object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-3 text-[12.5px] font-medium leading-snug text-white">{card.title}</h3>
          {card.kind === "item" ? (
            <p className="mt-1 truncate text-[10.5px] text-neutral-500" title={card.sources?.join(", ")}>
              <span className={`font-semibold ${ageMinutes(card.at) < 60 ? "text-red-300" : ageMinutes(card.at) < 360 ? "text-neutral-200" : "text-neutral-500"}`}>
                {timeAgo(card.at)}
              </span>
              {" · "}{sourcesLabel(card.sources?.length ? card.sources : [card.source ?? ""])}
            </p>
          ) : (
            <p className="mt-1 truncate text-[10.5px] text-neutral-500">
              {[card.source, category, card.column === "scheduled" ? formatWhen(card.scheduledAt) : timeAgo(card.at)].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {card.kind !== "item" && <StatusPill status={card.status} issues={card.issueCount} />}
        {card.kind === "item" && card.topics.slice(0, 2).map((topic) => (
          <span key={topic} className="max-w-[140px] truncate rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-neutral-400">{topic}</span>
        ))}
        {aiRunning && <Loader2 size={12} className="animate-spin text-sky-300" />}
      </div>
      {aiFailed && card.jobError && (
        <p className="mt-1.5 line-clamp-2 flex gap-1 text-[10.5px] text-red-300/80"><AlertTriangle size={11} className="mt-px flex-shrink-0" />{card.jobError}</p>
      )}

      {/* Actions */}
      {card.kind === "item" && (
        <div className="mt-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <ActionButton onClick={() => onWrite("manual")} busy={busy === "manual"} disabled={Boolean(busy)} primary>
            <PenLine size={12} /> Redactar
          </ActionButton>
          <ActionButton onClick={() => onWrite("ai")} busy={busy === "ai"} disabled={Boolean(busy)} title="La IA escribe un borrador (usa créditos de la API)">
            <Sparkles size={12} /> Con IA
          </ActionButton>
          <button
            onClick={onDiscard} disabled={Boolean(busy)} title="Descartar" aria-label="Descartar"
            className="ml-auto rounded-md p-1.5 text-neutral-500 hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
          >
            {busy === "discard" ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
          </button>
        </div>
      )}
      {aiFailed && (
        <div className="mt-2 flex gap-1.5">
          <ActionButton onClick={onRetryAi} busy={busy === "ai"} disabled={Boolean(busy)}><Bot size={12} /> Reintentar IA</ActionButton>
          <ActionButton onClick={() => onWrite("manual")} busy={busy === "manual"} disabled={Boolean(busy)}><PenLine size={12} /> Redactar yo</ActionButton>
        </div>
      )}
      {card.status === "APPROVED" && (
        <div className="mt-2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
          <ActionButton onClick={onPublish} busy={busy === "publish"} disabled={Boolean(busy)} primary><Send size={12} /> Publicar</ActionButton>
        </div>
      )}
      {card.status === "PUBLISHED" && card.slug && (
        <a
          href={`/noticia/${card.slug}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
          className="mt-2 inline-flex items-center gap-1 text-[10.5px] text-neutral-400 hover:text-white"
        >
          <ExternalLink size={11} /> Ver en el sitio
        </a>
      )}
    </article>
  );
}

function ageMinutes(iso: string | null): number {
  return iso ? (Date.now() - new Date(iso).getTime()) / 60000 : Number.POSITIVE_INFINITY;
}

function sourcesLabel(sources: string[]): string {
  const names = sources.filter(Boolean).map((s) => s.split(" · ")[0]);
  const unique = [...new Set(names)];
  if (unique.length <= 2) return unique.join(", ");
  return `${unique.slice(0, 2).join(", ")} +${unique.length - 2}`;
}

const SIGNAL_STYLE: Record<string, { label: string; className: string; title: string }> = {
  BREAKING: { label: "Última hora", className: "bg-red-500/15 text-red-300", title: "Publicada hace menos de 1 hora" },
  LIVE: { label: "En vivo", className: "bg-emerald-500/15 text-emerald-300", title: "Cobertura en directo" },
  TRENDING: { label: "Tendencia", className: "bg-orange-500/15 text-orange-300", title: "La están cubriendo 3 o más medios" },
  SCOOP: { label: "Primicia", className: "bg-yellow-400/15 text-yellow-300", title: "Solo 1 medio la tiene y es reciente: oportunidad de salir primero" },
};

function TrendSignals({ card }: { card: Card }) {
  const outlets = card.sources?.length ?? 0;
  const signals = card.signals ?? [];
  if (!signals.length && outlets < 2) return null;
  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-1">
      {signals.map((signal) => {
        const style = SIGNAL_STYLE[signal];
        if (!style) return null;
        return (
          <span key={signal} title={style.title} className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${style.className}`}>
            {signal === "BREAKING" || signal === "LIVE" ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> : null}
            {style.label}
          </span>
        );
      })}
      {outlets >= 2 && (
        <span title={card.sources.join(", ")} className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[9.5px] font-semibold text-neutral-300">
          {outlets} medios
        </span>
      )}
    </div>
  );
}

function ActionButton({
  children, onClick, busy, disabled, primary, title,
}: {
  children: React.ReactNode; onClick: () => void; busy?: boolean; disabled?: boolean; primary?: boolean; title?: string;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }} disabled={disabled} title={title}
      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium disabled:opacity-50 ${
        primary ? "bg-white text-black hover:bg-neutral-200" : "bg-white/[0.06] text-neutral-200 hover:bg-white/[0.1]"
      }`}
    >
      {busy ? <Loader2 size={12} className="animate-spin" /> : null}
      {children}
    </button>
  );
}
