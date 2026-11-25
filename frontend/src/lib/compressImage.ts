// Client-side image compression before upload: AI images often arrive as
// 2-3 MB PNGs, which made capsules slow for readers. Re-encode to WebP at a
// sane size (keeps aspect ratio) so each slide weighs ~100-250 KB.

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0..1
  type?: "image/webp" | "image/jpeg";
}

/** Target box that fits (w,h) inside (maxW,maxH) without upscaling. */
export function fitWithin(w: number, h: number, maxW: number, maxH: number): { width: number; height: number } {
  const scale = Math.min(1, maxW / w, maxH / h);
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxWidth = 1080, maxHeight = 1920, quality = 0.82, type = "image/webp" } = opts;
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxWidth, maxHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  if (!blob || blob.size >= file.size) return file; // never make it bigger
  const name = file.name.replace(/\.[a-z0-9]+$/i, "") + (type === "image/webp" ? ".webp" : ".jpg");
  return new File([blob], name, { type });
}
