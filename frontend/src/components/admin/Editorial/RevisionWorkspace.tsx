"use client";

// Revisión -- the real editorial workspace where a human finishes what
// Artifact produced. The queue and document remain visible together on
// desktop; review and SEO tools open on demand so writing has more space.
// On mobile the queue and editor switch screens.
//
// The queue is REVIEW_REQUIRED ∪ VALIDATED -- both genuinely need a human
// (REVIEW_REQUIRED because automated checks failed, VALIDATED because no
// human has approved it yet). APPROVED/PUBLISHED/REJECTED never appear
// here -- there is no separate "Ready" screen (section 1): READY is
// what APPROVED means, not a place you navigate to.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle, BookOpen, Check, ChevronLeft, ChevronRight, FileCheck2, Loader2, RefreshCw, Search, Sparkles, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/studio/lab/api-client";
import { type RevisionDraft } from "./revisionDraft";
import PortalBlockEditor from "./blocks/PortalBlockEditor";
import RevisionInspector, { type SeoDraft } from "./RevisionInspector";
import ArtifactDrawer from "./ArtifactDrawer";
import ArtifactQueueRow from "./ArtifactQueueRow";
import ArchivedDrawer from "./ArchivedDrawer";
import ProviderPickerModal from "./ProviderPickerModal";
import ResearchPanel from "./ResearchPanel";
import type { Editor } from "@tiptap/react";
import { type Claim } from "./ClaimCard";
import { type MediaRequirement } from "./MediaRequirementBlock";
import { StatusPill } from "./EditorialStatus";
import { responseError } from "./apiErrors";
import { createAutosave, type Autosave, type AutosaveStatus } from "./autosave";
import { safeHttpUrl } from "./safeLinks";

interface Category { id: string; name: string; }
interface CategoryGroup { id: string; name: string; categories: Category[]; }

interface ValidationIssue { check: string; detail: string; severity?: "BLOCKING" | "WARNING"; }

const ISSUE_ES: Record<string, string> = {
  title: "Falta el titular",
  excerpt: "Falta la entradilla",
  summary: "Falta el resumen",
  content_html: "El cuerpo tiene un formato que el portal no acepta",
  seo_title: "Falta el título SEO",
  seo_description: "Falta la meta descripción",
  slug: "La URL (slug) no es válida: solo minúsculas, números y guiones",
  sources: "No hay fuente registrada",
  category: "Elige una categoría",
  evidence: "Faltan afirmaciones verificables",
  multimedia: "Falta la imagen de portada",
};
export function issueInSpanish(issue: ValidationIssue): string {
  return ISSUE_ES[issue.check] ?? issue.detail;
}

interface ArtifactDetail {
  id: string;
  storyId: string;
  version: number;
  status: string;
  title: string;
  subtitle: string | null;
  excerpt: string;
  summary: string;
  contentHtml: string;
  categoryId: string | null;
  tags: string[];
  seo: { seoTitle: string; seoDescription: string; slug: string; canonicalUrl: string | null };
  sources: { sourceName: string | null; sourceDomain: string; sourceUrl: string }[];
  claims: Claim[];
  mediaRequirements: MediaRequirement[];
  validationIssues: ValidationIssue[];
  createdAt: string;
}

interface ArtifactJob {
  id: string; storyId: string; status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "REVIEW_REQUIRED";
  provider: string | null; model: string | null; startedAt: string | null; finishedAt: string | null; error: string | null;
  validationOk?: boolean | null; validationIssueCount?: number | null;
}

const AUTOSAVE_DELAY_MS = 1000;

interface SaveSnapshot {
  artifactId: string;
  draft: RevisionDraft;
  seo: SeoDraft;
  saveAsDraft: boolean;
}

function toDraft(a: ArtifactDetail): RevisionDraft {
  return {
    title: a.title, subtitle: a.subtitle ?? "", excerpt: a.excerpt, summary: a.summary,
    contentHtml: a.contentHtml, categoryId: a.categoryId, tags: a.tags,
  };
}
function toSeoDraft(a: ArtifactDetail): SeoDraft {
  return { seoTitle: a.seo.seoTitle, seoDescription: a.seo.seoDescription, slug: a.seo.slug, canonicalUrl: a.seo.canonicalUrl ?? "" };
}

export default function RevisionWorkspace({
  active = true, openRequest = null, manualQueue = [], onManualQueueConsumed, onGoToDiscovery,
  focusArtifactId, onClose, onChanged,
}: {
  active?: boolean;
  /** Opens an artifact from outside (the Ctrl/⌘+K palette). */
  openRequest?: { id: string; nonce: number } | null;
  manualQueue?: string[];
  onManualQueueConsumed?: () => void;
  onGoToDiscovery?: () => void;
  /** Focus mode (opened from the board): one article, full screen, with publish actions. */
  focusArtifactId?: string;
  onClose?: () => void;
  /** Called after any status change so the board can refresh. */
  onChanged?: () => void;
}) {
  const focusMode = Boolean(focusArtifactId);
  const [queue, setQueue] = useState<ArtifactDetail[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<ArtifactDetail | null>(null);
  const [job, setJob] = useState<ArtifactJob | null>(null);
  const [jobHistory, setJobHistory] = useState<ArtifactJob[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const [draft, setDraft] = useState<RevisionDraft | null>(null);
  const [seoDraft, setSeoDraft] = useState<SeoDraft | null>(null);
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>("idle");

  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [approving, setApproving] = useState(false);
  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const [artifactDrawerOpen, setArtifactDrawerOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<"list" | "editor">("list");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [bodyEditor, setBodyEditor] = useState<Editor | null>(null);
  const [queueSearch, setQueueSearch] = useState("");
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [manualQueueIds, setManualQueueIds] = useState<string[]>([]);
  const [manualQueueIndex, setManualQueueIndex] = useState(0);
  const [openingManualItem, setOpeningManualItem] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const manualQueueKey = JSON.stringify(manualQueue);
  const handledManualQueueRef = useRef("");

  const selectedRef = useRef<ArtifactDetail | null>(null);
  selectedRef.current = selected;
  const draftRef = useRef<RevisionDraft | null>(null);
  draftRef.current = draft;
  const seoDraftRef = useRef<SeoDraft | null>(null);
  seoDraftRef.current = seoDraft;

  const fetchQueue = useCallback(async () => {
    setLoadingQueue(true);
    setError(null);
    try {
      const [draftRes, reviewRes, validatedRes] = await Promise.all([
        apiFetch("/api/artifacts?status=DRAFT&limit=50"),
        apiFetch("/api/artifacts?status=REVIEW_REQUIRED&limit=50"),
        apiFetch("/api/artifacts?status=VALIDATED&limit=50"),
      ]);
      if (!draftRes.ok) throw await responseError(draftRes);
      if (!reviewRes.ok) throw await responseError(reviewRes);
      if (!validatedRes.ok) throw await responseError(validatedRes);
      const [draftData, reviewData, validatedData] = await Promise.all([
        draftRes.json(), reviewRes.json(), validatedRes.json(),
      ]);
      const merged: ArtifactDetail[] = [
        ...(draftData.artifacts ?? []), ...(reviewData.artifacts ?? []), ...(validatedData.artifacts ?? []),
      ];
      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setQueue(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la cola de revisión");
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/api/categories");
        if (res.ok) setCategoryGroups((await res.json()).groups ?? []);
      } catch {
        // Category select just stays sparse -- not fatal.
      }
    })();
  }, []);

  useEffect(() => { if (!focusMode) void fetchQueue(); }, [fetchQueue, focusMode]);

  // One autosave queue for the open article: edits are never lost or reordered, a failed
  // save stays pending, and approve/switch/submit wait for it (see autosave.ts).
  const autosaveRef = useRef<Autosave<SaveSnapshot> | null>(null);
  if (!autosaveRef.current) {
    autosaveRef.current = createAutosave<SaveSnapshot>({
      delayMs: AUTOSAVE_DELAY_MS,
      onStatus: setSaveStatus,
      onError: (err) => toast.error(err instanceof Error ? `No se guardaron los cambios: ${err.message}` : "No se guardaron los cambios", { id: "revision-save-error" }),
      save: async ({ artifactId, draft: d, seo: s, saveAsDraft }) => {
        const res = await apiFetch(`/api/artifacts/${artifactId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: d.title, subtitle: d.subtitle || null, excerpt: d.excerpt, summary: d.summary,
            contentHtml: d.contentHtml,
            categoryId: d.categoryId, tags: d.tags, seoTitle: s.seoTitle, seoDescription: s.seoDescription,
            slug: s.slug, canonicalUrl: s.canonicalUrl || null,
            saveAsDraft,
          }),
        });
        if (!res.ok) throw await responseError(res);
        const updated: ArtifactDetail = await res.json();
        // The backend re-validates on save (status/validationIssues can change from a fixed
        // field): reflect that in the open editor and in its queue row.
        if (selectedRef.current?.id === updated.id) setSelected(updated);
        setQueue((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      },
    });
  }
  const autosave = autosaveRef.current;

  const scheduleSave = useCallback(() => {
    const artifact = selectedRef.current;
    const d = draftRef.current;
    const s = seoDraftRef.current;
    if (!artifact || !d || !s) return;
    autosave.schedule({ artifactId: artifact.id, draft: d, seo: s, saveAsDraft: artifact.status === "DRAFT" });
  }, [autosave]);

  const flushPendingSave = useCallback(() => autosave.flush(), [autosave]);

  // Ctrl/⌘+S saves now (autosave runs anyway; this answers "is it saved?" instantly).
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && selectedRef.current) {
        event.preventDefault();
        void autosave.flush().then((ok) => { if (ok) toast.success("Cambios guardados", { id: "revision-saved" }); });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, autosave]);

  // Leaving the editorial view or the page must not drop the last edits.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!autosave.isDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      void autosave.flush();
    };
  }, [autosave]);

  const selectArticle = useCallback(async (item: ArtifactDetail) => {
    if (selectedRef.current?.id === item.id) return;
    if (!await flushPendingSave()
      && !window.confirm("Los últimos cambios de este artículo no se pudieron guardar. ¿Descartarlos y abrir el otro?")) return;
    autosave.reset();
    setLoadingDetail(true);
    setJob(null);
    setJobHistory([]);
    try {
      const res = await apiFetch(`/api/artifacts/${item.id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const full: ArtifactDetail = await res.json();
      selectedRef.current = full;
      draftRef.current = toDraft(full);
      seoDraftRef.current = toSeoDraft(full);
      setSelected(full);
      setDraft(draftRef.current);
      setSeoDraft(seoDraftRef.current);
      setMobilePane("editor");
      const jobRes = await apiFetch(`/api/artifacts/jobs/by-story/${full.storyId}`);
      if (jobRes.ok) setJob(await jobRes.json());
      const historyRes = await apiFetch(`/api/artifacts/jobs/by-story/${full.storyId}/history`);
      if (historyRes.ok) setJobHistory((await historyRes.json()).jobs ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el artículo");
    } finally {
      setLoadingDetail(false);
    }
  }, [autosave, flushPendingSave]);

  useEffect(() => {
    if (openRequest) void selectArticle({ id: openRequest.id } as ArtifactDetail);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest?.nonce]);

  useEffect(() => {
    if (focusArtifactId) void selectArticle({ id: focusArtifactId } as ArtifactDetail);
  }, [focusArtifactId, selectArticle]);

  const reloadSelected = useCallback(async () => {
    const current = selectedRef.current;
    if (!current) return;
    const res = await apiFetch(`/api/artifacts/${current.id}`);
    if (res.ok) {
      const full: ArtifactDetail = await res.json();
      setSelected(full);
      setQueue((prev) => prev.map((a) => (a.id === full.id ? full : a)));
    }
  }, []);

  const [publishing, setPublishing] = useState(false);

  const runArticleAction = async (path: string, init: RequestInit, success: string) => {
    const artifact = selectedRef.current;
    if (!artifact) return false;
    if (!await flushPendingSave()) return false;
    setPublishing(true);
    try {
      const res = await apiFetch(`/api/artifacts/${artifact.id}${path}`, init);
      if (!res.ok) throw await responseError(res);
      toast.success(success);
      await reloadSelected();
      onChanged?.();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo completar la acción");
      return false;
    } finally {
      setPublishing(false);
    }
  };

  const cancelSchedule = () => runArticleAction("/schedule/cancel", { method: "POST" }, "Programación cancelada");
  /**
   * One-click publish: save → submit (if draft) → approve → publish/schedule.
   * The editorial states still exist and are still enforced by the backend;
   * the editor just doesn't have to walk them by hand.
   */
  const publishFlow = async (when?: Date): Promise<boolean> => {
    const artifact = selectedRef.current;
    if (!artifact) return false;
    setPublishing(true);
    const call = async (path: string, init?: RequestInit): Promise<ArtifactDetail> => {
      const res = await apiFetch(`/api/artifacts/${artifact.id}${path}`, init);
      if (!res.ok) throw await responseError(res);
      return res.json();
    };
    try {
      if (!await flushPendingSave()) return false;
      let current = await call("");
      if (current.status === "DRAFT") current = await call("/submit", { method: "POST" });
      if (current.status === "REVIEW_REQUIRED") {
        setSelected(current);
        const blocking = current.validationIssues.filter((i) => (i.severity ?? "BLOCKING") === "BLOCKING");
        throw new Error(`Falta corregir: ${(blocking.length ? blocking : current.validationIssues).map(issueInSpanish).join(" · ")}`);
      }
      if (current.status === "VALIDATED") {
        current = await call("/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "APPROVE" }) });
      }
      if (current.status !== "APPROVED") throw new Error(`No se puede publicar desde el estado ${current.status}`);
      if (when) {
        await call("/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scheduledAt: when.toISOString() }) });
        toast.success(`Programada para el ${when.toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}`);
      } else {
        await call("/publish", { method: "POST" });
        toast.success("Publicada: ya está en el portal");
      }
      await reloadSelected();
      onChanged?.();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo publicar");
      return false;
    } finally {
      setPublishing(false);
    }
  };

  const openManualDiscoveryItem = useCallback(async (itemId: string) => {
    setOpeningManualItem(true);
    try {
      const res = await apiFetch(`/api/discovery/items/${itemId}/manual-editor`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || body?.detail || `HTTP ${res.status}`);
      }
      const artifact: ArtifactDetail = await res.json();
      setQueue((prev) => prev.some((item) => item.id === artifact.id)
        ? prev.map((item) => item.id === artifact.id ? artifact : item)
        : [artifact, ...prev]);
      await selectArticle(artifact);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo abrir la noticia en el editor manual");
    } finally {
      setOpeningManualItem(false);
    }
  }, [selectArticle]);

  useEffect(() => {
    if (!manualQueue.length) {
      handledManualQueueRef.current = "";
      return;
    }
    if (handledManualQueueRef.current === manualQueueKey) return;
    handledManualQueueRef.current = manualQueueKey;
    setManualQueueIds(manualQueue);
    setManualQueueIndex(0);
    void openManualDiscoveryItem(manualQueue[0]).finally(() => onManualQueueConsumed?.());
  }, [manualQueue, manualQueueKey, onManualQueueConsumed, openManualDiscoveryItem]);

  // Refs are updated synchronously so the snapshot handed to autosave is always the newest one.
  const onFieldChange = (patch: Partial<RevisionDraft>) => {
    if (!draftRef.current) return;
    draftRef.current = { ...draftRef.current, ...patch };
    setDraft(draftRef.current);
    scheduleSave();
  };
  const onSeoChange = (patch: Partial<SeoDraft>) => {
    if (!seoDraftRef.current) return;
    seoDraftRef.current = { ...seoDraftRef.current, ...patch };
    setSeoDraft(seoDraftRef.current);
    scheduleSave();
  };

  // Section 5's real "Aplicar propuesta" -- deliberately reuses the SAME
  // autosave path as a manual edit (onFieldChange/onSeoChange -> the
  // existing debounced PATCH), never a second persistence mechanism. The
  // AI proposal (or the editor's own edit of it) becomes real content
  // only once this runs; PATCH re-validates server-side (see
  // UpdateArtifact), which is what actually clears the warning.
  const onApplySeoFix = (field: "title" | "seoTitle" | "seoDescription", value: string) => {
    if (field === "title") onFieldChange({ title: value });
    else if (field === "seoTitle") onSeoChange({ seoTitle: value });
    else onSeoChange({ seoDescription: value });
  };

  const onMediaChanged = useCallback(async () => {
    if (!selectedRef.current) return;
    const res = await apiFetch(`/api/artifacts/${selectedRef.current.id}`);
    if (res.ok) {
      const full: ArtifactDetail = await res.json();
      setSelected(full);
      setQueue((prev) => prev.map((a) => (a.id === full.id ? full : a)));
    }
  }, []);

  // Section 11 (plain "looked at it") and section 2/4 (accepting a real
  // ProposeClaimResolution proposal) are ONE real write path -- both just
  // send a different body to the same POST .../review.
  const reviewClaim = useCallback(async (claimId: string, body: Record<string, unknown>) => {
    const artifact = selectedRef.current;
    if (!artifact) return;
    try {
      const res = await apiFetch(`/api/artifacts/${artifact.id}/claims/${claimId}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated: ArtifactDetail = await res.json();
      setSelected(updated);
      setQueue((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar la afirmación");
    }
  }, []);

  const onMarkClaimReviewed = useCallback(
    (claimId: string, reviewed: boolean) => reviewClaim(claimId, { reviewed }),
    [reviewClaim],
  );
  const onResolveClaim = useCallback(
    (claimId: string, label: string, sourceUrls: string[]) =>
      reviewClaim(claimId, { reviewed: true, label, sourceUrls }),
    [reviewClaim],
  );

  // One step from Revisión to the site: approve, then publish right away (with confirmation).
  const onApproveAndPublish = async () => {
    const artifact = selectedRef.current;
    if (!artifact) return;
    if (!window.confirm(`¿Aprobar y publicar «${draftRef.current?.title ?? artifact.title}» ahora? Quedará visible en el sitio de inmediato.`)) return;
    const approved = await onApprove();
    if (!approved) return;
    try {
      const res = await apiFetch(`/api/artifacts/${artifact.id}/publish`, { method: "POST" });
      if (!res.ok) throw await responseError(res);
      const published: ArtifactDetail = await res.json();
      toast.success("Publicado -- ya está en nexusnews.info", {
        action: { label: "Ver", onClick: () => window.open(`https://www.nexusnews.info/noticia/${published.seo.slug}`, "_blank", "noopener") },
      });
    } catch (err) {
      toast.error(err instanceof Error ? `Aprobado, pero no se pudo publicar: ${err.message}. Publícalo desde la Cola.` : "Aprobado, pero no se pudo publicar");
    }
  };

  const onApprove = async (): Promise<boolean> => {
    const artifact = selectedRef.current;
    if (!artifact) return false;
    if (!await flushPendingSave()) {
      toast.error("No se puede aprobar: hay cambios sin guardar. Revisa la conexión y vuelve a intentarlo.");
      return false;
    }
    setApproving(true);
    try {
      const res = await apiFetch(`/api/artifacts/${artifact.id}/review`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "APPROVE" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      toast.success("Aprobada: ya puedes publicarla o programarla");
      onChanged?.();
      if (focusMode) {
        setInspectorOpen(false);
        await reloadSelected();
        return true;
      }
      setQueue((prev) => prev.filter((a) => a.id !== artifact.id));
      setSelected(null);
      setDraft(null);
      setSeoDraft(null);
      setMobilePane("list");
      setInspectorOpen(false);
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo aprobar la revisión");
      return false;
    } finally {
      setApproving(false);
    }
  };

  const submitForReview = async () => {
    const artifact = selectedRef.current;
    if (!artifact || artifact.status !== "DRAFT" || submitting) return;
    if (!await flushPendingSave()) {
      toast.error("No se puede enviar: hay cambios sin guardar.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/artifacts/${artifact.id}/submit`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || body?.detail || `HTTP ${res.status}`);
      }
      const updated: ArtifactDetail = await res.json();
      setSelected(updated);
      setQueue((prev) => prev.map((item) => item.id === updated.id ? updated : item));
      toast.success(updated.status === "VALIDATED" ? "Lista para revisar" : "Enviada a revisión: hay avisos por resolver");
      onChanged?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar a revisión");
    } finally {
      setSubmitting(false);
    }
  };

  const moveManualQueue = async (direction: -1 | 1) => {
    const nextIndex = manualQueueIndex + direction;
    if (nextIndex < 0 || nextIndex >= manualQueueIds.length) return;
    setManualQueueIndex(nextIndex);
    await openManualDiscoveryItem(manualQueueIds[nextIndex]);
  };

  const onArchiveArtifact = async () => {
    const artifact = selectedRef.current;
    if (!artifact) return;
    setArchiving(true);
    try {
      const res = await apiFetch(`/api/artifacts/${artifact.id}/archive`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `HTTP ${res.status}`);
      }
      toast.success("Enviada a la papelera");
      onChanged?.();
      if (focusMode) {
        onClose?.();
        return;
      }
      setQueue((prev) => prev.filter((a) => a.id !== artifact.id));
      setSelected(null);
      setDraft(null);
      setSeoDraft(null);
      setMobilePane("list");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar el artículo");
    } finally {
      setArchiving(false);
    }
  };

  const confirmRetry = async (providerId: string) => {
    const artifact = selectedRef.current;
    setProviderPickerOpen(false);
    if (!artifact) return;
    try {
      const res = await apiFetch("/api/artifacts/jobs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: artifact.storyId, provider: providerId }),
      });
      if (!res.ok) throw await responseError(res);
      toast.success("La IA está volviendo a redactar esta noticia");
      onChanged?.();
      if (focusMode) onClose?.();
      else setArtifactDrawerOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? `No se pudo reintentar: ${err.message}` : "No se pudo reintentar");
    }
  };

  const allTopics = useMemo(() => categoryGroups.flatMap((g) => g.categories), [categoryGroups]);
  const categoryNameById = useMemo(() => Object.fromEntries(allTopics.map((c) => [c.id, c.name])), [allTopics]);
  const visibleQueue = useMemo(() => {
    const query = queueSearch.trim().toLocaleLowerCase();
    return queue.filter((item) => !query || item.title.toLocaleLowerCase().includes(query));
  }, [queue, queueSearch]);

  return (
    <div className="flex h-full min-h-0">
      {/* LISTA -- independent scroll (hidden in focus mode: the board is the list) */}
      <div className={`${focusMode ? "hidden" : mobilePane === "list" ? "flex" : "hidden md:flex"} w-full md:w-[280px] lg:w-[310px] flex-shrink-0 flex-col border-r border-white/10 h-full min-h-0 bg-[#0b0b0b]`}>
        <div className="flex-shrink-0 border-b border-white/10 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Espacio de trabajo</p>
              <h2 className="mt-1 text-[15px] font-semibold text-white">
                Bandeja de edición <span className="ml-1 text-xs font-normal text-neutral-500">{queue.length}</span>
              </h2>
            </div>
            <button onClick={fetchQueue} title="Actualizar bandeja" className="rounded-lg p-2 text-neutral-500 hover:bg-white/5 hover:text-white">
              <RefreshCw size={14} />
            </button>
          </div>
          <label className="mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5">
            <Search size={14} className="text-neutral-600" />
            <input
              value={queueSearch}
              onChange={(event) => setQueueSearch(event.target.value)}
              placeholder="Buscar noticia"
              className="h-9 min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-neutral-600"
            />
          </label>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-white/5">
          {error ? (
            <div className="m-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3 text-xs leading-relaxed text-red-200">
              <p className="font-semibold">No se pudo cargar la bandeja</p>
              <p className="mt-1 break-words text-red-200/70">{error}</p>
            </div>
          ) : !loadingQueue && visibleQueue.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm font-medium text-neutral-300">
                {queue.length ? "No hay coincidencias" : "No hay noticias para editar"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">
                {queue.length ? "Prueba con otro título." : "Selecciona una noticia en Discovery y ábrela en el editor manual."}
              </p>
              {!queue.length && onGoToDiscovery && (
                <button onClick={onGoToDiscovery} className="mt-4 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-black hover:bg-neutral-200">
                  Ir a Discovery
                </button>
              )}
            </div>
          ) : (
            visibleQueue.map((a) => (
              <ArtifactQueueRow
                key={a.id}
                artifact={a}
                categoryName={a.categoryId ? categoryNameById[a.categoryId] ?? null : null}
                selected={selected?.id === a.id}
                onSelect={() => selectArticle(a)}
              />
            ))
          )}
        </div>
        <div className="flex-shrink-0 border-t border-white/10 p-2">
          <button
            onClick={() => setArchivedOpen(true)}
            className="w-full flex items-center gap-2 text-[12px] text-neutral-500 hover:text-white px-2 py-1.5 rounded-md hover:bg-white/5"
          >
            <Trash2 size={13} /> Papelera
          </button>
        </div>
      </div>

      {/* EDITOR -- independent scroll */}
      <div className={`${mobilePane === "editor" ? "flex" : "hidden"} md:flex flex-1 min-w-0 flex-col h-full min-h-0`}>
        {selected && draft ? (
          <>
            <div className="flex flex-shrink-0 flex-wrap items-center gap-3 border-b border-white/10 px-4 py-2.5">
              {focusMode ? (
                <button
                  onClick={async () => { if (await flushPendingSave()) onClose?.(); }}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/10 hover:text-white"
                >
                  <ChevronLeft size={14} /> Tablero
                </button>
              ) : (
                <button onClick={() => setMobilePane("list")} className="md:hidden text-xs text-neutral-400 hover:text-white">← Lista</button>
              )}
              {focusMode && <StatusPill status={selected.status} issues={selected.validationIssues.length} />}

              <div className="flex items-center gap-1.5 text-[11.5px]">
                {saveStatus === "pending" && <span className="text-neutral-400">Cambios sin guardar…</span>}
                {saveStatus === "saving" && <span className="flex items-center gap-1.5 text-neutral-400"><Loader2 size={12} className="animate-spin" /> Guardando…</span>}
                {saveStatus === "saved" && <span className="flex items-center gap-1.5 text-green-400"><Check size={12} /> Guardado</span>}
                {saveStatus === "error" && (
                  <button type="button" onClick={() => void flushPendingSave()} className="flex items-center gap-1.5 text-red-400 hover:text-red-300">
                    <AlertCircle size={12} /> Error al guardar · Reintentar
                  </button>
                )}
                {saveStatus === "idle" && <span className="text-neutral-500">Sin cambios</span>}
              </div>

              <span className="hidden sm:inline text-[11.5px] text-neutral-600 ml-2">
                Versión {selected.version} · {new Date(selected.createdAt).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })} · {new Date(selected.createdAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
              </span>
              {manualQueueIds.length > 1 && (
                <div className="hidden md:flex items-center gap-1 text-[11px] text-neutral-500">
                  <button onClick={() => void moveManualQueue(-1)} disabled={manualQueueIndex === 0 || openingManualItem}
                    className="rounded p-1 hover:bg-white/10 disabled:opacity-30" aria-label="Noticia anterior">
                    <ChevronLeft size={14} />
                  </button>
                  {manualQueueIndex + 1} / {manualQueueIds.length}
                  <button onClick={() => void moveManualQueue(1)}
                    disabled={manualQueueIndex >= manualQueueIds.length - 1 || openingManualItem}
                    className="rounded p-1 hover:bg-white/10 disabled:opacity-30" aria-label="Siguiente noticia">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}

              <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
                <button
                  onClick={flushPendingSave}
                  disabled={saveStatus === "saving"}
                  className="flex items-center gap-1.5 text-[12px] font-bold px-3.5 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {selected.status === "DRAFT" ? "Guardar borrador" : "Guardar"}
                </button>
                {!focusMode && selected.status === "DRAFT" && (
                  <button
                    onClick={() => void submitForReview()}
                    disabled={submitting || saveStatus === "saving" || openingManualItem}
                    className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg bg-green-500/15 text-green-300 hover:bg-green-500/25 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="animate-spin" size={13} /> : <FileCheck2 size={13} />}
                    Enviar a revisión
                  </button>
                )}
                {focusMode && selected.status === "SCHEDULED" && (
                  <button
                    onClick={() => void cancelSchedule()}
                    disabled={publishing}
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-lg bg-white/5 text-neutral-200 hover:bg-white/10 disabled:opacity-50"
                  >
                    Cancelar programación
                  </button>
                )}
                <button
                  onClick={() => setResearchOpen((open) => !open)}
                  aria-pressed={researchOpen}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${researchOpen ? "border-white/30 bg-white/10 text-white" : "border-white/10 text-neutral-300 hover:bg-white/5 hover:text-white"}`}
                >
                  <BookOpen size={12} /> Buscar información
                </button>
                <button
                  onClick={() => setInspectorOpen(true)}
                  className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-medium text-neutral-300 hover:bg-white/5 hover:text-white"
                >
                  Detalles y revisión
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {selected.sources[0] && (
                <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-white/[0.015] text-[11px] text-neutral-500">
                  <span className="font-semibold text-neutral-400">Fuente original:</span>
                  <a href={safeHttpUrl(selected.sources[0].sourceUrl) ?? undefined} target="_blank" rel="noreferrer" className="truncate hover:text-white hover:underline">
                    {selected.sources[0].sourceName ?? selected.sources[0].sourceDomain}
                  </a>
                </div>
              )}
              <PortalBlockEditor
                key={selected.id}
                draft={draft} onFieldChange={onFieldChange} categoryGroups={categoryGroups}
                mediaRequirements={selected.mediaRequirements} artifactId={selected.id} onMediaChanged={onMediaChanged}
                readOnly={selected.status === "PUBLISHED" || selected.status === "PUBLISHING"}
                seo={seoDraft} onSeoChange={onSeoChange} sources={selected.sources}
                status={selected.status} onPublish={focusMode ? publishFlow : undefined} publishing={publishing}
                blockingIssues={selected.validationIssues.filter((i) => (i.severity ?? "BLOCKING") === "BLOCKING").map(issueInSpanish)}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-neutral-600">
            {loadingDetail ? "Cargando…" : (
              <>
                <Sparkles size={22} />
                <p className="text-sm">Elige un artículo de la lista para empezar.</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Keep metadata and review actions available on demand, not as a permanent third column. */}
      {selected && seoDraft && (
        inspectorOpen && (
          <div className="fixed inset-0 z-40 flex justify-end">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setInspectorOpen(false)} />
            <div className="relative h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-neutral-950 shadow-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-neutral-950/95 px-4 py-3 backdrop-blur">
                <span className="text-sm font-semibold text-white">Detalles y revisión</span>
                <button onClick={() => setInspectorOpen(false)} aria-label="Cerrar detalles">
                  <X size={16} className="text-neutral-500 hover:text-white" />
                </button>
              </div>
              <RevisionInspector
                artifactId={selected.id}
                status={selected.status} job={job} jobHistory={jobHistory} validationIssues={selected.validationIssues} claims={selected.claims}
                seoDraft={seoDraft} onSeoChange={onSeoChange} mediaRequirements={selected.mediaRequirements}
                onMarkClaimReviewed={onMarkClaimReviewed} onResolveClaim={onResolveClaim} onApprove={() => void onApprove()} onApproveAndPublish={() => void onApproveAndPublish()} approving={approving}
                onRetry={() => setProviderPickerOpen(true)} onChooseProvider={() => setProviderPickerOpen(true)}
                onArchive={onArchiveArtifact} archiving={archiving} onApplySeoFix={onApplySeoFix}
              />
            </div>
          </div>
        )
      )}

      {researchOpen && selected && (
        <div className="fixed bottom-4 right-4 top-28 z-30 w-[min(340px,calc(100vw-2rem))] overflow-y-auto rounded-xl shadow-2xl shadow-black/60">
          <ResearchPanel key={selected.id} editor={bodyEditor} />
        </div>
      )}

      {providerPickerOpen && (
        <ProviderPickerModal onCancel={() => setProviderPickerOpen(false)} onConfirm={confirmRetry} />
      )}

      {archivedOpen && <ArchivedDrawer onClose={() => setArchivedOpen(false)} />}

      {artifactDrawerOpen && selected && (
        <ArtifactDrawer
          storyId={selected.storyId} title={selected.title}
          onClose={() => { setArtifactDrawerOpen(false); fetchQueue(); }}
          onRetry={() => { setArtifactDrawerOpen(false); setProviderPickerOpen(true); }}
        />
      )}
    </div>
  );
}
