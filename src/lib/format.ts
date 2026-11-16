/** Formatting + fallback-image helpers, ported from the website's utils.ts. */

export function formatINR(value?: number | null) {
  const n = Number(value ?? 0);
  if (!n) return "Free";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n);
  } catch {
    return `₹${n}`;
  }
}

export function parseDate(input?: string | null): Date | null {
  if (!input) return null;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

export function formatEventDate(input?: string | null) {
  const d = parseDate(input);
  if (!d) return input || "TBA";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(input?: string | null) {
  const d = parseDate(input);
  if (!d) return input || "TBA";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function splitDate(input?: string | null) {
  const d = parseDate(input);
  if (!d) return { day: "--", month: "TBA", weekday: "", year: "" };
  return {
    day: d.toLocaleDateString("en-IN", { day: "2-digit" }),
    month: d.toLocaleDateString("en-IN", { month: "short" }).toUpperCase(),
    weekday: d.toLocaleDateString("en-IN", { weekday: "short" }),
    year: String(d.getFullYear()),
  };
}

export function countdownParts(target?: string | null) {
  const d = parseDate(target);
  if (!d) return null;
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    minutes: Math.floor((diff / 60000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    done: false,
  };
}

/** Curated fallback imagery (royalty-free Unsplash) — only when CMS has no image. */
export const FALLBACK_IMAGES = [
  "https://images.unsplash.com/photo-1547153760-18fc86324498?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1535525153412-5a42439a210d?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1518834107812-67b0b7c58434?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1545959570-a94084071b5d?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1400&q=80",
  "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=1400&q=80",
];

const BAD_IMAGE_PATTERNS = [/(^|\/\/)(www\.)?example\.(com|org|net)/i, /placeholder/i, /your-?domain/i];

export function isUsableImageUrl(url: string | undefined | null): url is string {
  if (!url || !url.trim()) return false;
  return !BAD_IMAGE_PATTERNS.some((re) => re.test(url));
}

function fallbackImage(seed: string | number) {
  const i = typeof seed === "number" ? seed : seed.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return FALLBACK_IMAGES[Math.abs(i) % FALLBACK_IMAGES.length];
}

export function imageFor(url: string | undefined | null, seed: string | number = 0) {
  if (isUsableImageUrl(url)) return url as string;
  return fallbackImage(seed);
}

export function initials(name?: string | null) {
  if (!name) return "U";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function titleCase(s?: string | null) {
  if (!s) return "";
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Best-effort id for a backend row across the various shapes the API returns. */
export function rowId(row: any): string {
  return String(row?._id ?? row?.id ?? row?.email ?? row?.slug ?? row?.ref ?? "");
}

/** ISO/date → "YYYY-MM-DD" for date inputs. */
export function toDateInput(v?: string | null) {
  const d = parseDate(v);
  if (!d) return typeof v === "string" ? v : "";
  return d.toISOString().slice(0, 10);
}

/** ISO/date → "YYYY-MM-DDTHH:mm" for datetime inputs. */
export function toDateTimeInput(v?: string | null) {
  const d = parseDate(v);
  if (!d) return typeof v === "string" ? v : "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Whether an event has already happened. The backend's `event_status` is often
 * still "upcoming" on stale rows, so the date is the source of truth — counted
 * generously to the end of the event's own day.
 */
/**
 * Has the event already happened? Mirrors the website's `isEventExpired`:
 * when a start time is known the event lingers for a 4-hour grace period, but
 * it never expires before the end of its own calendar day.
 */
export function isEventExpired(dateInput?: string | null, timeInput?: string | null): boolean {
  if (!dateInput) return false;
  const trimmed = String(dateInput).trim();
  if (!trimmed) return false;

  let y: number, mo: number, d: number;
  let h = 23, mi = 59;
  let hasTime = false;

  const ymd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd) {
    y = parseInt(ymd[1], 10); mo = parseInt(ymd[2], 10) - 1; d = parseInt(ymd[3], 10);
    const iso = trimmed.match(/T(\d{1,2}):(\d{2})/);
    if (iso) { h = parseInt(iso[1], 10); mi = parseInt(iso[2], 10); hasTime = true; }
  } else {
    const p = new Date(trimmed);
    if (isNaN(p.getTime())) return false;
    y = p.getFullYear(); mo = p.getMonth(); d = p.getDate();
    h = p.getHours(); mi = p.getMinutes();
    hasTime = h !== 0 || mi !== 0;
  }

  // A separate time field ("10:00 PM", "18:00") wins over anything inline.
  if (timeInput) {
    const t = String(timeInput).match(/(\d{1,2}):(\d{2})(?:\s*([aApP][mM]))?/);
    if (t) {
      let hh = parseInt(t[1], 10);
      const mer = t[3]?.toUpperCase();
      if (mer === "PM" && hh < 12) hh += 12;
      else if (mer === "AM" && hh === 12) hh = 0;
      h = hh; mi = parseInt(t[2], 10); hasTime = true;
    }
  }

  const endOfDay = new Date(y, mo, d, 23, 59, 59, 999).getTime();
  const expiry = hasTime
    ? Math.max(new Date(y, mo, d, h, mi, 0, 0).getTime() + 4 * 60 * 60 * 1000, endOfDay)
    : endOfDay;
  return Date.now() > expiry;
}

/**
 * Has registration closed? A date-only deadline runs to the end of that day;
 * a full timestamp is honoured exactly. Mirrors the website's
 * `isDeadlinePassed`.
 */
export function isDeadlinePassed(deadlineInput?: string | null): boolean {
  if (!deadlineInput) return false;
  const trimmed = String(deadlineInput).trim();
  if (!trimmed) return false;
  const ymd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (ymd && !/T\d/.test(trimmed)) {
    const endOfDay = new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10), 23, 59, 59, 999).getTime();
    return Date.now() > endOfDay;
  }
  const parsed = new Date(trimmed).getTime();
  return !isNaN(parsed) && Date.now() > parsed;
}

/** Event is over — by status, or by its date/time. */
export function isPastEvent(ev: { date?: string | null; time?: string | null; event_status?: string | null }): boolean {
  if (ev.event_status === "live") return false;
  if (ev.event_status === "completed" || ev.event_status === "cancelled") return true;
  return isEventExpired(ev.date, ev.time);
}

/** Can tickets still be bought? The single gate the whole app should use. */
export function isBookable(ev: {
  date?: string | null;
  time?: string | null;
  event_status?: string | null;
  registration_deadline?: string | null;
  registration_enabled?: boolean;
}): boolean {
  if (isPastEvent(ev)) return false;
  if (isDeadlinePassed(ev.registration_deadline)) return false;
  return ev.registration_enabled !== false;
}

/**
 * How long ago an event finished, or null while it is still ahead. Reads from
 * the same expiry rule the rest of the app uses, so a pass and its event can
 * never disagree about whether the night is over.
 */
export function endedAgo(dateInput?: string | null, timeInput?: string | null): string | null {
  if (!isEventExpired(dateInput, timeInput)) return null;
  // "YYYY-MM-DD" is read component-wise, exactly as isEventExpired does it:
  // Date() would treat it as UTC midnight and slide the day in some zones.
  const trimmed = String(dateInput ?? "").trim();
  const ymd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const d = ymd
    ? new Date(parseInt(ymd[1], 10), parseInt(ymd[2], 10) - 1, parseInt(ymd[3], 10))
    : parseDate(dateInput);
  if (!d) return "Event has ended";
  // Whole calendar days between the event's day and today — not elapsed hours,
  // or a 1am visit the morning after would read as "earlier today".
  const today = new Date();
  const days = Math.round(
    (new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000
  );
  if (days <= 0) return "Ended earlier today";
  if (days === 1) return "Ended yesterday";
  if (days < 30) return `Ended ${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Ended ${months} month${months > 1 ? "s" : ""} ago`;
  const years = Math.floor(days / 365);
  return `Ended ${years} year${years > 1 ? "s" : ""} ago`;
}
