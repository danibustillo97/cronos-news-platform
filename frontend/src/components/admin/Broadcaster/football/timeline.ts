// ESPN key events → match actions. ESPN publishes goals, cards and changes with a short delay;
// the operator reviews them as suggestions (or lets goals and cards apply on their own).

/** One item of /api/football/timeline. */
export interface TimelineEvent {
  id: string;
  minute: string;
  order: number;
  kind: "goal" | "own-goal" | "penalty" | "yellow" | "red" | "sub" | "var" | "other";
  side: "home" | "away" | null;
  player: string;
  assist: string;
  playerOut: string;
  text: string;
}

export type TimelineAction =
  | { type: "goal"; team: "home" | "away"; player: string; minute: number; detail?: string }
  | { type: "card"; team: "home" | "away"; card: "yellow" | "red"; player: string; minute: number }
  | { type: "sub"; team: "home" | "away"; playerIn: string; playerOut: string; minute: number };

export interface TimelineSuggestion {
  event: TimelineEvent;
  action: TimelineAction;
  /** A matching event was already entered by hand (same kind and team, within 2 minutes). */
  duplicate: boolean;
  /** Safe to apply without review: an unambiguous goal or card that is not a duplicate. */
  auto: boolean;
}

interface LoggedEvent {
  kind: "goal" | "yellow" | "red" | "sub";
  team: "home" | "away";
  minute: number;
  voided?: boolean;
}

/** "67'" → 67, "90'+4'" → 94, "45+2" → 47. */
export function parseMinute(value: string): number {
  const [base, extra] = value.replace(/'/g, "").split("+").map((part) => Number.parseInt(part, 10));
  return (Number.isFinite(base) ? base : 0) + (Number.isFinite(extra) ? extra : 0);
}

function toAction(event: TimelineEvent): TimelineAction | null {
  if (!event.side) return null;
  const minute = parseMinute(event.minute);
  switch (event.kind) {
    case "goal": return { type: "goal", team: event.side, player: event.player, minute };
    case "penalty": return { type: "goal", team: event.side, player: event.player, minute, detail: "Penal" };
    // ESPN's side for an own goal is not reliably the team that scores: always left to review.
    case "own-goal": return { type: "goal", team: event.side, player: event.player, minute, detail: "Autogol" };
    case "yellow": case "red": return { type: "card", team: event.side, card: event.kind, player: event.player, minute };
    case "sub": return { type: "sub", team: event.side, playerIn: event.player, playerOut: event.playerOut, minute };
    default: return null;
  }
}

const loggedKind = (action: TimelineAction): LoggedEvent["kind"] =>
  action.type === "goal" ? "goal" : action.type === "sub" ? "sub" : action.card;

/** New ESPN events (not applied or dismissed before), oldest first, ready to review. */
export function planTimeline(events: TimelineEvent[], handled: ReadonlySet<string>, logged: LoggedEvent[]): TimelineSuggestion[] {
  return events
    .filter((event) => !handled.has(event.id))
    .sort((a, b) => a.order - b.order)
    .flatMap((event) => {
      const action = toAction(event);
      if (!action) return [];
      const duplicate = logged.some((item) => !item.voided && item.kind === loggedKind(action) && item.team === action.team && Math.abs(item.minute - action.minute) <= 2);
      const ambiguous = event.kind === "own-goal" || action.type === "sub";
      return [{ event, action, duplicate, auto: !duplicate && !ambiguous }];
    });
}
