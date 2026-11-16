import { isDeadlinePassed } from "@/lib/format";

/**
 * Which shelf a competition belongs on.
 *
 * The public list endpoint carries only `registration_deadline`,
 * `result_status` and `results_published` — no `voting_status`, and no
 * `end_date`. So "voting is live" cannot be guessed from the row: it comes
 * from `/api/public/users/me/home/live-voting`, which is the server's own
 * answer. Signed out, the closest honest read is "audience voting is enabled
 * and the results are not out yet".
 */
export type CompState = "live" | "open" | "over";

export type CompRow = Record<string, any>;

export const compId = (r: CompRow) => String(r?._id ?? r?.id ?? "");

/** The last date the row actually knows about. */
export function compDeadline(r: CompRow): string | null {
  return r?.end_date || r?.submission_deadline || r?.registration_deadline || null;
}

/** Over by its own dates, or because the results are already out. */
export function isCompOver(r: CompRow): boolean {
  if (r?.results_published === true) return true;
  if (String(r?.result_status || "").toUpperCase() === "FINAL") return true;
  if (r?.end_date) return isDeadlinePassed(r.end_date);
  if (r?.submission_deadline) return isDeadlinePassed(r.submission_deadline);
  return isDeadlinePassed(r?.registration_deadline);
}

/**
 * `liveIds` is the server's live-voting set. Voting beats everything: a
 * competition whose registration has closed but whose poll is still running
 * belongs at the top, not the bottom.
 */
export function compState(r: CompRow, liveIds?: Set<string>): CompState {
  const id = compId(r);
  if (liveIds) {
    if (liveIds.has(id)) return "live";
  } else if (r?.audience_voting_enabled === true && r?.results_published !== true) {
    return "live";
  }
  return isCompOver(r) ? "over" : "open";
}

const ms = (v?: string | null) => {
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isNaN(t) ? null : t;
};

/** Soonest deadline first while a shelf is running, most recent first once over. */
export function sortComps(rows: CompRow[], state: CompState): CompRow[] {
  const dir = state === "over" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = ms(compDeadline(a));
    const y = ms(compDeadline(b));
    if (x === null && y === null) return 0;
    if (x === null) return 1;   // undated rows trail either way
    if (y === null) return -1;
    return (x - y) * dir;
  });
}

/** Group a list into the three shelves, each already sorted. */
export function shelveComps(rows: CompRow[], liveIds?: Set<string>) {
  const buckets: Record<CompState, CompRow[]> = { live: [], open: [], over: [] };
  for (const r of rows) buckets[compState(r, liveIds)].push(r);
  return {
    live: sortComps(buckets.live, "live"),
    open: sortComps(buckets.open, "open"),
    over: sortComps(buckets.over, "over"),
  };
}

/** The ids the live-voting endpoint reports, whatever shape it answers in. */
export function liveVotingIds(payload: any): Set<string> | undefined {
  const rows = Array.isArray(payload)
    ? payload
    : payload?.competitions || payload?.items || payload?.live_voting || payload?.data;
  if (!Array.isArray(rows)) return undefined;
  return new Set(rows.map((r: any) => compId(r?.competition || r)).filter(Boolean));
}

/** The live-voting rows themselves, normalised out of the same payload. */
export function liveVotingRows(payload: any): CompRow[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload?.competitions || payload?.items || payload?.live_voting || payload?.data;
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => ({ ...(r?.competition || {}), ...r })).filter((r) => compId(r));
}
