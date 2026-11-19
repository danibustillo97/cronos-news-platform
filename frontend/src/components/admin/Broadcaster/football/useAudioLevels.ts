"use client";

import { useEffect, useRef, useState } from "react";

export interface MeterSource {
  id: string;
  stream?: MediaStream;
}

export interface Level {
  db: number;
  peakDb: number;
}

export const MIN_DB = -60;

const toDb = (value: number) => (value <= 0.00001 ? MIN_DB : Math.max(MIN_DB, 20 * Math.log10(value)));

/** Measures the live level (dBFS) of every stream that carries an audio track. */
export function useAudioLevels(sources: MeterSource[]): Record<string, Level> {
  const [levels, setLevels] = useState<Record<string, Level>>({});
  const contextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef(new Map<string, { analyser: AnalyserNode; source: MediaStreamAudioSourceNode; stream: MediaStream; peak: number; peakAt: number }>());
  const buffer = useRef<Float32Array<ArrayBuffer> | null>(null);
  const key = sources.map((source) => `${source.id}:${source.stream?.id ?? ""}`).join("|");

  useEffect(() => {
    const analysers = analysersRef.current;
    const active = new Set<string>();
    sources.forEach((source) => {
      const tracks = source.stream?.getAudioTracks() ?? [];
      if (!source.stream || !tracks.length) return;
      active.add(source.id);
      const existing = analysers.get(source.id);
      if (existing && existing.stream === source.stream) return;
      if (existing) { existing.source.disconnect(); analysers.delete(source.id); }
      const context = contextRef.current ?? new AudioContext();
      contextRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      const node = context.createMediaStreamSource(new MediaStream(tracks));
      node.connect(analyser);
      analysers.set(source.id, { analyser, source: node, stream: source.stream, peak: MIN_DB, peakAt: 0 });
    });
    analysers.forEach((entry, id) => {
      if (!active.has(id)) { entry.source.disconnect(); analysers.delete(id); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    let frame = 0;
    let last = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (now - last < 50) return;
      last = now;
      if (contextRef.current?.state === "suspended") void contextRef.current.resume();
      const next: Record<string, Level> = {};
      analysersRef.current.forEach((entry, id) => {
        const size = entry.analyser.fftSize;
        if (!buffer.current || buffer.current.length !== size) buffer.current = new Float32Array(size);
        entry.analyser.getFloatTimeDomainData(buffer.current);
        let sum = 0;
        for (let index = 0; index < size; index += 1) sum += buffer.current[index] * buffer.current[index];
        const db = toDb(Math.sqrt(sum / size));
        if (db >= entry.peak || now - entry.peakAt > 1500) { entry.peak = db; entry.peakAt = now; }
        else entry.peak = Math.max(MIN_DB, entry.peak - 0.6);
        next[id] = { db, peakDb: entry.peak };
      });
      setLevels(next);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => () => {
    analysersRef.current.forEach((entry) => entry.source.disconnect());
    analysersRef.current.clear();
    void contextRef.current?.close();
    contextRef.current = null;
  }, []);

  return levels;
}
