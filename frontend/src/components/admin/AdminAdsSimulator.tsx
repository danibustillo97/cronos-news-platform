"use client";

// The REAL portal, embedded live in a same-origin iframe -- not a redrawn
// mockup that can silently drift from the actual design. Every
// <AdSlot position="..."> on the real page already renders a
// data-ad-position attribute (frontend/src/components/ads/AdSlot.tsx);
// this reads those elements' real bounding boxes straight out of the
// iframe's own DOM (legal because it's same-origin -- the src is always a
// RELATIVE path, so it resolves to whatever host is serving /admin right
// now, nexus.local or localhost) and draws clickable markers exactly on
// top of them. Upload a banner, refresh the simulation, and it shows up
// exactly where -- and at exactly the size -- it will for a real visitor.

import { useEffect, useRef, useState } from "react";

interface Marker {
  position: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const IFRAME_WIDTH = 1280;
const FALLBACK_HEIGHT = 2200;

function PagePreview({
  src, selected, onSelect, labelFor, badgeFor, reloadToken,
}: {
  src: string;
  selected: string;
  onSelect: (position: string) => void;
  labelFor: (position: string) => string;
  badgeFor: (position: string) => { text: string; ok: boolean };
  reloadToken: number;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.5);
  const [frameHeight, setFrameHeight] = useState(FALLBACK_HEIGHT);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const measure = () => {
      if (wrapperRef.current) setScale(wrapperRef.current.clientWidth / IFRAME_WIDTH);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const locate = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || !doc.body) return false;
    const height = Math.max(doc.documentElement.scrollHeight, FALLBACK_HEIGHT);
    setFrameHeight(height);
    const found = Array.from(doc.querySelectorAll<HTMLElement>("[data-ad-position]")).map((el) => {
      const rect = el.getBoundingClientRect();
      return { position: el.getAttribute("data-ad-position")!, x: rect.left, y: rect.top, w: rect.width, h: rect.height };
    });
    if (found.length > 0) {
      setMarkers(found);
      setReady(true);
      return true;
    }
    return false;
  };

  useEffect(() => {
    setReady(false);
    setMarkers([]);
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tryLocate = () => {
      attempts += 1;
      const ok = locate();
      if (!ok && attempts < 8) timer = setTimeout(tryLocate, 400);
    };
    const onLoad = () => { timer = setTimeout(tryLocate, 500); };
    const el = iframeRef.current;
    el?.addEventListener("load", onLoad);
    return () => { el?.removeEventListener("load", onLoad); clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, reloadToken]);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full rounded-2xl border border-white/10 bg-neutral-950 overflow-y-auto overflow-x-hidden"
      style={{ height: 560 }}
    >
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-500 text-sm gap-2 z-10 bg-neutral-950">
          <span className="h-4 w-4 rounded-full border-2 border-neutral-600 border-t-red-500 animate-spin" />
          Cargando el portal real...
        </div>
      )}
      <div style={{ width: IFRAME_WIDTH * scale, height: frameHeight * scale, position: "relative" }}>
        <div style={{ width: IFRAME_WIDTH, height: frameHeight, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          <iframe
            ref={iframeRef}
            src={src}
            title="Vista previa del portal"
            style={{ width: IFRAME_WIDTH, height: frameHeight, border: 0, pointerEvents: "none", background: "#fff" }}
          />
          {markers.map((m) => {
            const isSelected = m.position === selected;
            const badge = badgeFor(m.position);
            return (
              <button
                key={m.position}
                onClick={() => onSelect(m.position)}
                className="absolute flex flex-col items-center justify-center gap-1 transition-all"
                style={{
                  left: m.x, top: m.y, width: m.w, height: m.h,
                  border: `2px dashed ${isSelected ? "#ef4444" : "rgba(255,255,255,0.5)"}`,
                  background: isSelected ? "rgba(239,68,68,0.15)" : "rgba(0,0,0,0.35)",
                }}
              >
                <span
                  className="px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap"
                  style={{ background: isSelected ? "#ef4444" : "#18181b", color: "#fff" }}
                >
                  {labelFor(m.position)} · {Math.round(m.w)}×{Math.round(m.h)}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    badge.ok ? "bg-emerald-500 text-white" : "bg-amber-500 text-black"
                  }`}
                >
                  {badge.text}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function AdminAdsSimulator({
  selected, onSelect, labelFor, badgeFor, articleSrc, reloadToken, onRefresh,
}: {
  selected: string;
  onSelect: (position: string) => void;
  labelFor: (position: string) => string;
  badgeFor: (position: string) => { text: string; ok: boolean };
  articleSrc: string | null;
  reloadToken: number;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<"home" | "article">("home");

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("home")}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
              tab === "home" ? "bg-white text-black" : "bg-black/40 text-neutral-300 border border-white/10"
            }`}
          >
            Inicio
          </button>
          <button
            onClick={() => setTab("article")}
            disabled={!articleSrc}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 ${
              tab === "article" ? "bg-white text-black" : "bg-black/40 text-neutral-300 border border-white/10"
            }`}
          >
            Artículo
          </button>
        </div>
        <button
          onClick={onRefresh}
          className="text-xs font-medium text-neutral-400 hover:text-white transition-colors"
        >
          ↻ Refrescar simulación
        </button>
      </div>

      <p className="text-xs text-neutral-500 mb-3">
        Esto es el sitio real, en vivo. Haz clic en cualquier espacio marcado para gestionarlo abajo.
      </p>

      {tab === "home" ? (
        <PagePreview
          key={`home-${reloadToken}`}
          src="/"
          selected={selected}
          onSelect={onSelect}
          labelFor={labelFor}
          badgeFor={badgeFor}
          reloadToken={reloadToken}
        />
      ) : articleSrc ? (
        <PagePreview
          key={`article-${reloadToken}`}
          src={articleSrc}
          selected={selected}
          onSelect={onSelect}
          labelFor={labelFor}
          badgeFor={badgeFor}
          reloadToken={reloadToken}
        />
      ) : null}
    </div>
  );
}
