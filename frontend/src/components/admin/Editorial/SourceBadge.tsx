"use client";

// A small colored initials badge for a real source (sourceName/domain).
// Color is deterministic (hash of the domain) so the same outlet always
// gets the same color -- not random, not per-category.

const PALETTE = [
  "bg-blue-500/20 text-blue-300",
  "bg-orange-500/20 text-orange-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-purple-500/20 text-purple-300",
  "bg-pink-500/20 text-pink-300",
  "bg-cyan-500/20 text-cyan-300",
];

function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function initials(name: string): string {
  const cleaned = name.replace(/^www\./, "").split(".")[0];
  const parts = cleaned.split(/[\s-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}

export default function SourceBadge({ name, domain }: { name: string | null; domain: string }) {
  const label = name ?? domain;
  return (
    <span className={`inline-flex items-center justify-center w-4 h-4 rounded text-[8.5px] font-bold flex-shrink-0 ${hashColor(domain)}`}>
      {initials(label)}
    </span>
  );
}
