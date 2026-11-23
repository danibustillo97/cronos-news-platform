// Frame ticks for the compositor. requestAnimationFrame stops in hidden tabs, which would
// freeze a live output; timers inside a dedicated worker keep firing in the background.

const WORKER_SOURCE = "let timer;onmessage=(event)=>{clearInterval(timer);if(event.data>0)timer=setInterval(()=>postMessage(0),event.data)};";

export function startFrameClock(intervalMs: number, onTick: (now: number) => void): () => void {
  let worker: Worker | null = null;
  let url: string | null = null;
  try {
    url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
    worker = new Worker(url);
    worker.onmessage = () => onTick(performance.now());
    worker.postMessage(intervalMs);
  } catch {
    // Workers unavailable (CSP, old browser): plain timers still beat rAF in background tabs.
    worker = null;
  }
  const fallback = worker ? 0 : window.setInterval(() => onTick(performance.now()), intervalMs);
  return () => {
    worker?.terminate();
    if (url) URL.revokeObjectURL(url);
    if (fallback) window.clearInterval(fallback);
  };
}
