"use client";

import { useTicker } from "./football/clock";

const mmss = (seconds: number) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
};

interface Props {
  name: string;
  getElement: () => HTMLVideoElement | undefined;
}

/**
 * Playback position of a file video, read straight from its pool element. Only this
 * component re-renders while the video plays (it used to re-render the whole studio).
 */
export function MediaPosition({ name, getElement }: Props) {
  useTicker(250);
  const element = getElement();
  const duration = element && Number.isFinite(element.duration) ? element.duration : 0;
  const current = element?.currentTime ?? 0;
  return (
    <>
      <span className="ml-auto text-[10px] tabular-nums text-neutral-500">{mmss(current)} / {mmss(duration)}</span>
      <input
        aria-label={`Posición de ${name}`}
        type="range"
        min="0"
        max={duration}
        step="0.1"
        value={current}
        disabled={!duration}
        onChange={(event) => { if (element) element.currentTime = Number(event.target.value); }}
        className="mt-2 h-1.5 w-full basis-full cursor-pointer accent-sky-400 disabled:cursor-not-allowed disabled:opacity-40"
      />
    </>
  );
}
