'use client';

// Single shared "what is CRONOS working on right now" context for the whole
// Admin app — talks ONLY to the FastAPI backend over HTTP (rule #3/#16).
// News, Production, Studio and Distribution all read the SAME workspace
// projection (GET /api/stories/{id}/workspace) instead of each holding
// their own copy. This file contains zero editorial/business logic — it
// just calls use cases and stores their responses.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { apiUrl } from './api-client';
import { supabase } from '@/lib/supabaseClient';
import type { StoryWorkspaceDTO, CompositionDTO, ProductionDTO, ActiveProductionItemDTO, ApiErrorBody } from './api-types';

const RUNTIME_STALE_AFTER_MS = 30_000; // sin heartbeat nuevo en este tiempo, se asume desconectado

export interface ActiveStory {
  newsId: string | null;
  title: string | null;
  imageUrl: string | null;
  storyId?: string | null; // LAB item_id, real once convert-to-content ran
}

export type AdminView = 'dashboard' | 'editorial' | 'news' | 'production' | 'social' | 'distribution' | 'tags_seo';

interface ProductionState {
  activeView: AdminView;
  setActiveView: (v: AdminView) => void;

  activeStory: ActiveStory | null;
  setActiveStory: (story: ActiveStory) => void;

  storyId: string | null;
  workspace: StoryWorkspaceDTO | null;
  primaryComposition: CompositionDTO | null;
  isProducing: boolean;
  isLoadingWorkspace: boolean;
  lastError: ApiErrorBody | null;
  runtimeConnected: boolean | null; // null = todavía no se consultó

  // Tablero operacional: todas las producciones en curso (RUNNING/PENDING)
  // más un puñado de recientes -- ver GET /api/productions. Se carga una
  // vez y se actualiza por Realtime, nunca por polling.
  activeProductions: ActiveProductionItemDTO[];
  openProduction: (storyId: string, headline: string | null) => void;

  produceStory: (storyId: string) => Promise<void>;
  refreshWorkspace: (storyId: string) => Promise<void>;
  reviewComposition: (compositionId: string, decision: 'APPROVE' | 'REJECT') => Promise<void>;
  resetProduction: () => void;
  // "Convertir en contenido" real (sección 7 del pedido) — el único punto
  // de entrada que dispara LAB de verdad. Devuelve null si falló (el error
  // real queda en lastError).
  convertToContent: (newsId: string, title: string, imageUrl: string | null) => Promise<{ storyId: string; productionId: string } | null>;
}

const ProductionContext = createContext<ProductionState | null>(null);

async function readJson(response: Response) {
  try { return await response.json(); } catch { return null; }
}

export function ProductionProvider({ children }: { children: React.ReactNode }) {
  const [activeView, setActiveView] = useState<AdminView>('dashboard');
  const [activeStory, setActiveStoryState] = useState<ActiveStory | null>(null);
  const [storyId, setStoryId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<StoryWorkspaceDTO | null>(null);
  const [isProducing, setIsProducing] = useState(false);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);
  const [lastError, setLastError] = useState<ApiErrorBody | null>(null);
  const [runtimeConnected, setRuntimeConnected] = useState<boolean | null>(null);

  const setActiveStory = useCallback((story: ActiveStory) => {
    setActiveStoryState(story);
  }, []);

  const refreshWorkspace = useCallback(async (id: string) => {
    setIsLoadingWorkspace(true);
    try {
      const res = await fetch(apiUrl(`/api/stories/${encodeURIComponent(id)}/workspace`));
      if (res.status === 404) {
        setWorkspace(null);
        setLastError(null);
        return;
      }
      if (!res.ok) {
        setLastError(await readJson(res) as ApiErrorBody);
        return;
      }
      setWorkspace(await res.json());
      setLastError(null);
    } catch (e) {
      setLastError({ error: 'NETWORK_ERROR', message: e instanceof Error ? e.message : 'fetch failed — is the FastAPI backend running on :8000?' });
    } finally {
      setIsLoadingWorkspace(false);
    }
  }, []);

  const produceStory = useCallback(async (id: string) => {
    setIsProducing(true);
    setStoryId(id);
    setLastError(null);
    try {
      const res = await fetch(apiUrl(`/api/stories/${encodeURIComponent(id)}/produce`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newsId: activeStory?.newsId ?? null }),
      });
      if (!res.ok) {
        setLastError(await readJson(res) as ApiErrorBody);
        return;
      }
      const body = await res.json();
      if (!activeStory) {
        setActiveStoryState({ newsId: null, title: body.story.headline, imageUrl: null });
      }
      await refreshWorkspace(id);
    } catch (e) {
      setLastError({ error: 'NETWORK_ERROR', message: e instanceof Error ? e.message : 'fetch failed — is the FastAPI backend running on :8000?' });
    } finally {
      setIsProducing(false);
    }
  }, [activeStory, refreshWorkspace]);

  const reviewComposition = useCallback(async (compositionId: string, decision: 'APPROVE' | 'REJECT') => {
    try {
      const res = await fetch(apiUrl(`/api/compositions/${encodeURIComponent(compositionId)}/review`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        setLastError(await readJson(res) as ApiErrorBody);
        return;
      }
      if (storyId) await refreshWorkspace(storyId);
    } catch (e) {
      // Sin este catch, un fetch fallido (backend caído/CORS) quedaba como
      // una promesa rechazada sin manejar -- eso es exactamente lo que se
      // ve como "Failed to fetch" sin contexto (ERROR 3 del pedido).
      setLastError({ error: 'NETWORK_ERROR', message: e instanceof Error ? e.message : 'fetch failed — is the FastAPI backend running on :8000?' });
    }
  }, [storyId, refreshWorkspace]);

  const convertToContent = useCallback(async (newsId: string, title: string, imageUrl: string | null) => {
    setIsProducing(true);
    setLastError(null);
    try {
      const res = await fetch(apiUrl(`/api/news/${encodeURIComponent(newsId)}/convert-to-content`), { method: 'POST' });
      if (!res.ok) {
        setLastError(await readJson(res) as ApiErrorBody);
        return null;
      }
      const body = await res.json() as { storyId: string; productionId: string; alreadyExisted: boolean };
      setActiveStoryState({ newsId, title, imageUrl, storyId: body.storyId });
      setStoryId(body.storyId);
      await refreshWorkspace(body.storyId);
      return { storyId: body.storyId, productionId: body.productionId };
    } catch (e) {
      setLastError({ error: 'NETWORK_ERROR', message: e instanceof Error ? e.message : 'fetch failed — is the FastAPI backend running on :8000?' });
      return null;
    } finally {
      setIsProducing(false);
    }
  }, [refreshWorkspace]);

  // Estado del Local Runtime -- sin polling HTTP repetido (perf fix):
  // una carga inicial + suscripción Realtime a runtime_registrations
  // (el Runtime escribe ahí cada heartbeat). Honesto ante un crash sin
  // shutdown limpio: un timer LOCAL (sin red) chequea si el último
  // heartbeat quedó viejo y recién ahí marca desconectado -- nunca
  // asume conectado indefinidamente por falta de evidencia.
  const lastHeartbeatRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const applyRow = (row: { status?: string; last_heartbeat_at?: string } | null) => {
      if (!row) { if (!cancelled) setRuntimeConnected(false); return; }
      lastHeartbeatRef.current = row.last_heartbeat_at ? Date.parse(row.last_heartbeat_at) : Date.now();
      if (!cancelled) setRuntimeConnected(row.status === 'CONNECTED');
    };

    // Carga inicial única (no un poll -- una sola vez al montar).
    supabase.from('runtime_registrations').select('status,last_heartbeat_at').eq('id', 'local').maybeSingle()
      .then(({ data }) => applyRow(data));

    const channel = supabase
      .channel('runtime_registrations_local')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'runtime_registrations', filter: 'id=eq.local' },
        (payload) => applyRow(payload.new as { status?: string; last_heartbeat_at?: string }))
      .subscribe();

    // Chequeo de staleness -- SIN red, solo compara el reloj local contra
    // el último heartbeat recibido (por carga inicial o por Realtime).
    const staleCheck = setInterval(() => {
      if (lastHeartbeatRef.current && Date.now() - lastHeartbeatRef.current > RUNTIME_STALE_AFTER_MS) {
        if (!cancelled) setRuntimeConnected(false);
      }
    }, RUNTIME_STALE_AFTER_MS);

    return () => { cancelled = true; clearInterval(staleCheck); supabase.removeChannel(channel); };
  }, []);

  const [activeProductions, setActiveProductions] = useState<ActiveProductionItemDTO[]>([]);

  const openProduction = useCallback((id: string, headline: string | null) => {
    setActiveStoryState({ newsId: null, title: headline, imageUrl: null, storyId: id });
    setStoryId(id);
    refreshWorkspace(id);
  }, [refreshWorkspace]);

  // Feed del tablero -- una carga inicial (GET /api/productions) y de ahí
  // en más, actualización incremental por fila via Realtime (upsert por
  // id, nunca un refetch completo de la lista).
  useEffect(() => {
    let cancelled = false;

    fetch(apiUrl('/api/productions')).then(readJson).then((body) => {
      if (!cancelled && body?.items) setActiveProductions(body.items as ActiveProductionItemDTO[]);
    });

    const channel = supabase
      .channel('productions_dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productions' }, (payload) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
        if (!row || !row.id) return;
        if (payload.eventType === 'DELETE') {
          setActiveProductions(prev => prev.filter(i => i.production.id !== row.id));
          return;
        }
        const production: ProductionDTO = {
          id: row.id as string, storyId: row.story_id as string, status: row.status as ProductionDTO['status'],
          stages: (row.stages as ProductionDTO['stages']) ?? [], progress: 0,
          errors: (row.errors as string[]) ?? [],
          startedAt: row.started_at as string, completedAt: (row.completed_at as string) ?? null,
        };
        setActiveProductions(prev => {
          const idx = prev.findIndex(i => i.production.id === production.id);
          if (idx === -1) return [{ production, storyHeadline: null }, ...prev];
          const next = [...prev];
          next[idx] = { ...next[idx], production };
          return next;
        });
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, []);

  const resetProduction = useCallback(() => {
    setActiveStoryState(null);
    setStoryId(null);
    setWorkspace(null);
    setLastError(null);
  }, []);

  const primaryComposition = useMemo(
    () => workspace?.compositions[0] ?? null,
    [workspace]
  );

  // Sin polling: el workspace se carga una vez (al producir/convertir, o
  // al llamar refreshWorkspace explícitamente) y de ahí en adelante se
  // actualiza por evento. `productions` llega completo por row (status,
  // stages, errors) -- se mergea directo, sin volver a pedir el workspace
  // entero. `compositions` recién aparece/cambia una vez que termina el
  // pipeline -- ahí sí hace falta al backend (mapea final_asset_ref a URL
  // firmada), así que ese evento puntual dispara UN refetch, no un timer.
  useEffect(() => {
    if (!storyId) return;

    const channel = supabase
      .channel(`production_${storyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productions', filter: `story_id=eq.${storyId}` },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (!row || !row.id) return;
          const production: ProductionDTO = {
            id: row.id as string, storyId: row.story_id as string, status: row.status as ProductionDTO['status'],
            stages: (row.stages as ProductionDTO['stages']) ?? [], progress: 0,
            errors: (row.errors as string[]) ?? [],
            startedAt: row.started_at as string, completedAt: (row.completed_at as string) ?? null,
          };
          setWorkspace(prev => (prev ? { ...prev, production } : prev));
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compositions', filter: `story_id=eq.${storyId}` },
        () => { refreshWorkspace(storyId); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [storyId, refreshWorkspace]);

  const value = useMemo<ProductionState>(() => ({
    activeView, setActiveView,
    activeStory, setActiveStory,
    storyId, workspace, primaryComposition, isProducing, isLoadingWorkspace, lastError, runtimeConnected,
    activeProductions, openProduction,
    produceStory, refreshWorkspace, reviewComposition, resetProduction, convertToContent,
  }), [activeView, activeStory, storyId, workspace, primaryComposition, isProducing, isLoadingWorkspace, lastError, runtimeConnected, activeProductions, openProduction, produceStory, refreshWorkspace, reviewComposition, resetProduction, convertToContent]);

  return <ProductionContext.Provider value={value}>{children}</ProductionContext.Provider>;
}

export function useProduction(): ProductionState {
  const ctx = useContext(ProductionContext);
  if (!ctx) throw new Error('useProduction must be used inside <ProductionProvider>');
  return ctx;
}
