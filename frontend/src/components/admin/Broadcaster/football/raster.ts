import type { DesignOutput } from "./designs";

interface Entry {
  image: HTMLImageElement;
  ready: boolean;
}

const cache = new Map<string, Entry>();
const lastReady = new Map<string, HTMLImageElement>();
const MAX_ENTRIES = 80;

function toSvgUrl(design: DesignOutput): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${design.width}" height="${design.height}"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml" style="width:${design.width}px;height:${design.height}px"><style>.nx{position:relative;box-sizing:border-box}.nx *{box-sizing:border-box}</style>${design.html}</div></foreignObject></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Returns the newest rasterised image for a design. While a new frame loads, the
 * previously ready frame for the same widget is returned so the canvas never flickers.
 */
export function getDesignImage(widgetId: string, design: DesignOutput): HTMLImageElement | null {
  const key = `${widgetId}|${design.html}`;
  let entry = cache.get(key);
  if (!entry) {
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
    const image = new Image();
    entry = { image, ready: false };
    const created = entry;
    image.onload = () => { created.ready = true; };
    image.onerror = () => { created.ready = false; };
    image.src = toSvgUrl(design);
    cache.set(key, entry);
  }
  if (entry.ready) {
    lastReady.set(widgetId, entry.image);
    return entry.image;
  }
  return lastReady.get(widgetId) ?? null;
}

export async function logoToDataUrl(url: string, size = 160): Promise<string> {
  const response = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
  if (!response.ok) throw new Error("No se pudo descargar el escudo");
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const ratio = Math.min(size / bitmap.width, size / bitmap.height, 1);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}
