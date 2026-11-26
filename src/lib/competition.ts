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
  return new Set(rows.map((r: any) => compId(r?.competition || r) || String(r?.competition_id ?? "")).filter(Boolean));
}

/** The live-voting rows themselves, normalised out of the same payload. */
export function liveVotingRows(payload: any): CompRow[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload?.competitions || payload?.items || payload?.live_voting || payload?.data;
  if (!Array.isArray(rows)) return [];
  // `/users/me/home/live-voting` answers with `competition_id` rather than `_id`.
  return rows
    .map((r: any) => ({ ...(r?.competition || {}), ...r }))
    .map((r: any) => (compId(r) ? r : { ...r, _id: r.competition_id }))
    .filter((r) => compId(r));
}

/**
 * The competition's picture for a phone. The admin uploads two: a 16:9 card
 * (`card_image_url` / `image_url`, the website's desktop art) and a 9:16
 * banner (`banner_image_url` / `banner_url`, the website's mobile art). The
 * website shows the banner on phones — so does the app, which is also why a
 * banner the admin just changed shows up here at once.
 */
export function compImage(c: any): string | undefined {
  return c?.banner_image_url || c?.banner_url || c?.card_image_url || c?.image_url || undefined;
}

/** The competition poster we design for: 736 × 920 (4:5). Boxes start at this
    shape so nothing jumps or crops before the image reports its real size. */
export const COMP_POSTER_RATIO = 736 / 920;

/* ── Age eligibility — a 1:1 port of the website's CompetitionDetail rules ── */

export type AgeRange = { minAge: number | null; maxAge: number | null; label: string };

/** A category's age band from min_age / max_age, or parsed from "3-8 years", "14+", "Open". */
export function parseAgeRange(cat: any): AgeRange {
  const open: AgeRange = { minAge: null, maxAge: null, label: "Open for all ages" };
  if (!cat) return open;
  const catName = String(cat?.name || (typeof cat === "string" ? cat : "")).trim();
  const num = (v: any) => (v != null && v !== "" && !isNaN(Number(v)) ? Number(v) : null);
  let minAge = num(cat.min_age);
  let maxAge = num(cat.max_age);
  const ageLimitStr = String(cat.age_limit || cat.age_range || (typeof cat === "string" ? cat : "")).trim();
  if (ageLimitStr && /open|all\s*ages?|any/i.test(ageLimitStr)) return open;

  // the website's guard: "Group" once got a default 8–14 that meant group size, not age
  const isGroup = catName.toLowerCase() === "group";
  const desc = String(cat.description || "").trim();
  const descIsGroupSize = desc && (/^\s*\d+\s*-\s*\d+\s*$/.test(desc) || /members|contestants|performers/i.test(desc));
  if (isGroup && (descIsGroupSize || (minAge === 8 && maxAge === 14 && !/years|yrs|age/i.test(desc)))) return open;

  if ((minAge == null || maxAge == null) && ageLimitStr) {
    const t = ageLimitStr.toLowerCase();
    const m = t.match(/(\d{1,2})\s*(?:-|to|\.\.|and)\s*(\d{1,2})/);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      minAge = Math.min(a, b);
      maxAge = Math.max(a, b);
    } else {
      const p = t.match(/(\d{1,2})\s*\+|above\s*(\d{1,2})|min\s*(\d{1,2})/);
      if (p) minAge = parseInt(p[1] || p[2] || p[3], 10);
    }
  }
  const label =
    minAge != null && maxAge != null ? `${minAge} to ${maxAge} years` : minAge != null ? `${minAge}+ years` : maxAge != null ? `Up to ${maxAge} years` : "Open for all ages";
  return { minAge, maxAge, label };
}

/** Age in whole years from a DOB ("2005-01-13", "13/01/2005", …); null if unknown. */
export function ageFromDob(dob?: string | null): number | null {
  if (!dob) return null;
  const s = String(dob).trim();
  let y = 0, m = 0, d = 0;
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  const dmy = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (iso) {
    y = +iso[1]; m = +iso[2] - 1; d = +iso[3];
  } else if (dmy) {
    d = +dmy[1]; m = +dmy[2] - 1; y = +dmy[3];
  } else {
    const t = new Date(s);
    if (isNaN(t.getTime())) return null;
    y = t.getFullYear(); m = t.getMonth(); d = t.getDate();
  }
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() < m || (now.getMonth() === m && now.getDate() < d)) age--;
  return age >= 0 ? age : null;
}

/** "open" — no age limit · "ok" — age fits · "no" — outside the band · "unknown" — no DOB on the profile. */
export function ageFit(range: AgeRange, age: number | null): "open" | "ok" | "no" | "unknown" {
  if (range.minAge == null && range.maxAge == null) return "open";
  if (age == null) return "unknown";
  if (range.minAge != null && age < range.minAge) return "no";
  if (range.maxAge != null && age > range.maxAge) return "no";
  return "ok";
}
