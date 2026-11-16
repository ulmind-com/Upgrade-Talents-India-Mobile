import { countdownParts } from "@/lib/format";

/**
 * Where a scheduled thing sits relative to now.
 *
 * The homepage payload gives `start_time` / `end_time` but nothing that says
 * "this is on air" — so a stream scheduled for next December was being drawn
 * with a pulsing LIVE badge. The clock decides, not the section it arrived in.
 */
export type AirState = "upcoming" | "live" | "ended";

const ms = (v?: string | null) => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
};

export function airState(start?: string | null, end?: string | null): AirState {
  const now = Date.now();
  const s = ms(start);
  const e = ms(end);
  if (e !== null && now > e) return "ended";
  if (s !== null && now < s) return "upcoming";
  // No start time at all means whoever published it meant "now".
  return "live";
}

/* These three stay unconstrained: a bound like `T extends { is_visible?: ... }`
   makes TS infer the bound instead of the row type at the call site, and every
   caller then loses its own fields. The flag reads are cast here instead. */

/** Rows an admin has actually published and left visible. */
export function visible<T>(rows?: readonly T[] | null): T[] {
  return (rows || []).filter((r) => {
    const f = r as { is_published?: boolean; is_visible?: boolean } | null;
    return f?.is_published !== false && f?.is_visible !== false;
  });
}

/** Respect the order the admin dragged them into. */
export function ordered<T>(rows: readonly T[]): T[] {
  const key = (r: T) => r as { display_order?: number; created_at?: string };
  return [...rows].sort((a, b) => {
    const x = Number(key(a)?.display_order ?? 0);
    const y = Number(key(b)?.display_order ?? 0);
    if (x !== y) return x - y;
    return String(key(a)?.created_at || "").localeCompare(String(key(b)?.created_at || ""));
  });
}

/** `visible` + `ordered`, which is how every homepage list should be read. */
export function publishedInOrder<T>(rows?: readonly T[] | null): T[] {
  return ordered(visible(rows));
}

/** "2d 04:17:33" — null once the target has passed. */
export function countdownText(to?: string | null): string | null {
  const p = countdownParts(to);
  if (!p || p.done) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.days ? `${p.days}d ` : ""}${pad(p.hours)}:${pad(p.minutes)}:${pad(p.seconds)}`;
}

/** A readable "starts in" for something still ahead. */
export function startsInText(to?: string | null): string | null {
  const p = countdownParts(to);
  if (!p || p.done) return null;
  if (p.days >= 1) return `In ${p.days} day${p.days > 1 ? "s" : ""}`;
  if (p.hours >= 1) return `In ${p.hours}h ${p.minutes}m`;
  return `In ${p.minutes}m`;
}
