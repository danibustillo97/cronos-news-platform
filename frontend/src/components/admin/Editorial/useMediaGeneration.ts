"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/studio/lab/api-client";
import { PollAbortedError, pollJob } from "./pollJob";

interface MediaJob {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | string;
  error?: string | null;
}

/**
 * Starts an image generation for one media requirement and follows it to the end. Shared by
 * the featured image, body images and media blocks (they used to copy a setInterval loop that
 * never stopped on errors and outlived the component).
 */
export function useMediaGeneration(artifactId: string, placeholderId: string, onChanged: () => void) {
  const abortRef = useRef<AbortController | null>(null);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  useEffect(() => () => abortRef.current?.abort(), []);

  /** Resolves true when an image was generated. */
  return useCallback(async (): Promise<boolean> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await apiFetch(`/api/artifacts/${artifactId}/media/${placeholderId}/generate`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || body?.message || `HTTP ${res.status}`);
      }
      const job: MediaJob = await res.json();
      toast.info("Generando imagen… puede tardar un poco", { id: `media-${placeholderId}` });
      const final = await pollJob<MediaJob>({
        fetchStatus: async () => {
          const r = await apiFetch(`/api/artifacts/media/jobs/${job.id}`);
          return r.ok ? (await r.json()) as MediaJob : null;
        },
        isDone: (current) => current.status === "COMPLETED" || current.status === "FAILED",
        signal: controller.signal,
      });
      if (final.status === "COMPLETED") {
        toast.success("Imagen generada", { id: `media-${placeholderId}` });
        onChangedRef.current();
        return true;
      }
      toast.error(`La generación falló${final.error ? `: ${final.error}` : ""}`, { id: `media-${placeholderId}` });
      return false;
    } catch (err) {
      if (err instanceof PollAbortedError) return false;
      toast.error(err instanceof Error ? err.message : "No se pudo generar la imagen", { id: `media-${placeholderId}` });
      return false;
    }
  }, [artifactId, placeholderId]);
}
