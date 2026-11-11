"use client";

// A real score (0-1) rendered as a colored horizontal bar + percentage.
// "N/A" -- never a fabricated 0% -- when the backend didn't compute it.

const BAR_COLOR: Record<string, string> = {
  green: "bg-green-400",
  blue: "bg-blue-400",
  violet: "bg-violet-400",
};

export default function MetricBar({
  label, value, color, size = "sm",
}: {
  label: string;
  value: number | null;
  color: "green" | "blue" | "violet";
  size?: "sm" | "lg";
}) {
  const pct = value === null ? null : Math.round(value * 100);
  const barH = size === "lg" ? "h-1.5" : "h-1";
  const textSize = size === "lg" ? "text-xs" : "text-[10px]";

  return (
    <div className={size === "lg" ? "space-y-1" : "space-y-0.5"}>
      <div className={`flex items-center justify-between ${textSize} text-neutral-400`}>
        <span>{label}</span>
        <span className="text-neutral-300 font-medium">{pct === null ? "N/A" : `${pct}%`}</span>
      </div>
      <div className={`w-full ${barH} rounded-full bg-white/10 overflow-hidden`}>
        {pct !== null && (
          <div className={`h-full rounded-full ${BAR_COLOR[color]}`} style={{ width: `${pct}%` }} />
        )}
      </div>
    </div>
  );
}
