// Downscales and re-encodes photos in the browser before uploading. Phone photos weigh
// 5-12 MB; on Vercel a function accepts at most 4.5 MB per request (artifact uploads go
// through the /api proxy), and smaller files also publish and load faster on the site.

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_DIMENSION = 2400;
const QUALITY_STEPS = [0.86, 0.78, 0.7, 0.6];

/** Target size keeping the aspect ratio, never upscaling. */
export function fitWithin(width: number, height: number, max = MAX_DIMENSION): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Files that can be sent as they are (small enough, already a web format). */
export function canSkipCompression(file: { size: number; type: string }): boolean {
  return file.size <= 900 * 1024 && ["image/jpeg", "image/webp", "image/png"].includes(file.type);
}

/**
 * Returns a JPEG/WebP no larger than MAX_UPLOAD_BYTES when possible. Falls back to the
 * original file when the browser cannot decode it (the server then validates it).
 */
export async function compressImage(file: File): Promise<File> {
  if (typeof document === "undefined" || canSkipCompression(file) || file.type === "image/gif") return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const size = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close?.();
  // PNGs with transparency (logos, crests) stay lossless-ish as WebP; photos become JPEG.
  const type = file.type === "image/png" ? "image/webp" : "image/jpeg";
  let best: Blob | null = null;
  for (const quality of QUALITY_STEPS) {
    best = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
    if (best && best.size <= MAX_UPLOAD_BYTES) break;
  }
  if (!best || best.size >= file.size) return file.size <= MAX_UPLOAD_BYTES ? file : best ? toFile(best, file.name, type) : file;
  return toFile(best, file.name, type);
}

function toFile(blob: Blob, originalName: string, type: string): File {
  const base = originalName.replace(/\.[^.]+$/, "") || "imagen";
  return new File([blob], `${base}.${type === "image/webp" ? "webp" : "jpg"}`, { type });
}
