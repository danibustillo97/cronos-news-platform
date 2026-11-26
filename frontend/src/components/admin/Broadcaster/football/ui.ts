// Shared UI classes of the broadcast control room (design system, Phase 1).
// Colours come from the --nx-* tokens declared on `.nx-studio` (globals.css).

export const ui = {
  panel: "rounded-[var(--nx-r-lg)] border border-[var(--nx-line)] bg-[var(--nx-s1)]",
  panelPad: "rounded-[var(--nx-r-lg)] border border-[var(--nx-line)] bg-[var(--nx-s1)] p-2",
  title: "flex items-center gap-1.5 px-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--nx-muted)]",
  card: "rounded-[var(--nx-r)] border border-[var(--nx-line)] bg-[var(--nx-s2)] hover:border-[var(--nx-line-2)] hover:bg-[var(--nx-s3)]",
  cardOn: "rounded-[var(--nx-r)] border border-[var(--nx-gold)] bg-[color-mix(in_srgb,var(--nx-gold)_12%,var(--nx-s2))]",
  btnPrimary: "inline-flex items-center justify-center gap-1.5 rounded-[var(--nx-r)] bg-[var(--nx-gold)] font-bold text-[var(--nx-gold-ink)] hover:bg-[var(--nx-gold-2)] disabled:opacity-40",
  btnGhost: "inline-flex items-center justify-center gap-1.5 rounded-[var(--nx-r)] border border-[var(--nx-line-2)] text-[var(--nx-text)] hover:bg-[var(--nx-s3)] disabled:opacity-40",
  btnLive: "inline-flex items-center justify-center gap-1.5 rounded-[var(--nx-r)] bg-[var(--nx-live)] font-bold text-white hover:brightness-110",
  chip: "rounded-full border border-[var(--nx-line-2)] px-2.5 py-1 text-[11px] font-semibold text-[var(--nx-muted)] hover:text-[var(--nx-text)]",
  chipOn: "rounded-full bg-[var(--nx-gold)] px-2.5 py-1 text-[11px] font-bold text-[var(--nx-gold-ink)]",
  tab: "rounded-[var(--nx-r-sm)] px-3 py-1 text-[12px] font-semibold text-[var(--nx-muted)] hover:text-[var(--nx-text)]",
  tabOn: "rounded-[var(--nx-r-sm)] bg-[var(--nx-text)] px-3 py-1 text-[12px] font-semibold text-black",
  kbd: "inline-grid min-w-[18px] place-items-center rounded border border-[var(--nx-line-2)] bg-black/40 px-1 font-mono text-[10px] font-bold uppercase text-[var(--nx-muted)]",
  liveDot: "h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--nx-live)]",
} as const;
