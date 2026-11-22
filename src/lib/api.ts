/**
 * Eventora API client — React Native port.
 * Mirrors the FastAPI backend exactly; the backend contract is never modified.
 * Combines the user (frontend) and admin clients into one module since the app
 * runs both modes. Tokens live in memory for synchronous access and are
 * persisted to SecureStore by the auth providers.
 */
import * as SecureStore from "expo-secure-store";
import { DEFAULT_API_BASE, WEBAUTHN_ORIGIN } from "./config";

/* ─────────────── base url (live-overridable) ─────────────── */
let API_BASE = DEFAULT_API_BASE;
export const getApiBase = () => API_BASE;
export const setApiBase = (url: string) => {
  API_BASE = url.replace(/\/$/, "");
  SecureStore.setItemAsync("uti_api_base", API_BASE).catch(() => {});
};
export async function loadApiBase() {
  try {
    const v = await SecureStore.getItemAsync("uti_api_base");
    if (v) API_BASE = v.replace(/\/$/, "");
  } catch {}
}

/* ─────────────── token stores (SecureStore keys) ─────────────── */
const KEYS = {
  user: "uti_access_token",
  reg: "uti_registration_token",
  admin: "uti_admin_token",
  staff: "uti_staff_token",
};

const mem: { user: string | null; reg: string | null; admin: string | null; staff: string | null } = {
  user: null,
  reg: null,
  admin: null,
  staff: null,
};

export const tokenStore = {
  getUser: () => mem.user,
  getReg: () => mem.reg,
  getAdmin: () => mem.admin,
  getStaff: () => mem.staff,
  async setUser(t: string | null) {
    mem.user = t;
    t ? await SecureStore.setItemAsync(KEYS.user, t) : await SecureStore.deleteItemAsync(KEYS.user);
  },
  async setReg(t: string | null) {
    mem.reg = t;
    t ? await SecureStore.setItemAsync(KEYS.reg, t) : await SecureStore.deleteItemAsync(KEYS.reg);
  },
  async setAdmin(t: string | null) {
    mem.admin = t;
    t ? await SecureStore.setItemAsync(KEYS.admin, t) : await SecureStore.deleteItemAsync(KEYS.admin);
  },
  async setStaff(t: string | null) {
    mem.staff = t;
    t ? await SecureStore.setItemAsync(KEYS.staff, t) : await SecureStore.deleteItemAsync(KEYS.staff);
  },
  async hydrate() {
    try {
      mem.user = await SecureStore.getItemAsync(KEYS.user);
      mem.reg = await SecureStore.getItemAsync(KEYS.reg);
      mem.admin = await SecureStore.getItemAsync(KEYS.admin);
      mem.staff = await SecureStore.getItemAsync(KEYS.staff);
    } catch {}
  },
};

/* ─────────────── error type ─────────────── */
/** Lets the session layer react when a user token is rejected. */
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function extractDetail(data: any, fallback: string) {
  const d = data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length) {
    const first = d[0];
    const loc = Array.isArray(first?.loc) ? first.loc.filter((p: any) => p !== "body").join(".") : "";
    return loc ? `${loc}: ${first?.msg}` : first?.msg || fallback;
  }
  return data?.message || fallback;
}

/* ─────────────── core fetch ─────────────── */
type Auth = "user" | "reg" | "admin" | "staff" | false;
type Opts = {
  method?: string;
  body?: any;
  form?: FormData;
  query?: Record<string, string | number | boolean | undefined | null>;
  auth?: Auth;
  raw?: boolean;
  headers?: Record<string, string>;
};

export async function apiFetch<T = any>(path: string, opts: Opts = {}): Promise<T> {
  const { method = "GET", body, form, query, auth = false, raw } = opts;

  let url = `${API_BASE}${path}`;
  if (query) {
    const qs = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
    });
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const headers: Record<string, string> = {};
  if (!form && body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const t = auth === "user" ? mem.user : auth === "reg" ? mem.reg : auth === "staff" ? mem.staff : mem.admin;
    if (t) headers["Authorization"] = `Bearer ${t}`;
  }
  // Explicit per-call headers (e.g. the WebAuthn Origin the backend derives its
  // rp_id from). Native apps may set Origin, which browsers forbid.
  if (opts.headers) Object.assign(headers, opts.headers);

  let status: number;
  let text: string;

  if (form) {
    // Multipart/file uploads: React Native's fetch + FormData is unreliable on
    // the new architecture ("Network request failed"). XMLHttpRequest streams
    // the body correctly and lets the engine set the multipart boundary, so we
    // use it for every file upload. No AbortController — it breaks the stream.
    try {
      const result = await new Promise<{ status: number; text: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(method, url);
        Object.entries(headers).forEach(([k, v]) => {
          // Never set Content-Type for FormData — the engine adds the boundary.
          if (v != null && k.toLowerCase() !== "content-type") xhr.setRequestHeader(k, v);
        });
        xhr.timeout = 120000;
        xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText || "" });
        xhr.onerror = () => reject(new Error("network"));
        xhr.ontimeout = () => reject(new Error("timeout"));
        xhr.send(form as any);
      });
      status = result.status;
      text = result.text;
    } catch {
      throw new ApiError("Upload failed. Check your connection and try again.", 0);
    }
  } else {
    let res: Response;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000); // onRender free tier can cold-start slowly
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch {
      throw new ApiError("Couldn't reach the server. It may be waking up — wait a few seconds and try again.", 0);
    } finally {
      clearTimeout(timer);
    }
    if (raw) {
      if (!res.ok) throw new ApiError(`Request failed (${res.status})`, res.status);
      return (await res.blob()) as T;
    }
    status = res.status;
    text = await res.text();
  }

  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (status === 401 && auth === "user") {
    // Token is stale — drop it so the UI can prompt a fresh sign-in instead of
    // silently showing empty lists.
    tokenStore.setUser(null).catch(() => {});
    onUnauthorized?.();
  }
  if (status < 200 || status >= 300) throw new ApiError(extractDetail(data, `Request failed (${status})`), status);
  return data as T;
}

/** Pings the backend health endpoint. Used by the Settings connection test. */
export async function pingBackend(): Promise<{ ok: boolean; status: number; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/homepage`, { method: "GET" });
    // Any HTTP response (even a 4xx) means the server is reachable.
    if (res.status < 500) return { ok: true, status: res.status, message: "Connected — backend is reachable." };
    return { ok: false, status: res.status, message: `Server error (${res.status}). The backend is up but failing.` };
  } catch {
    return { ok: false, status: 0, message: "No response. Check the API address and your connection." };
  }
}

/** Returns a fallback instead of throwing — for optional sections. */
export async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

/** Absolute URL for a backend-relative asset path. */
export function assetUrl(p?: string | null): string | undefined {
  if (!p) return undefined;
  // Already-complete URIs pass through untouched — remote URLs, inline data,
  // and local device files (a freshly picked photo). Only a bare server path
  // gets the API base prepended.
  if (/^(https?|data|file|content|blob|ph):/i.test(p)) return p;
  return `${API_BASE}${p.startsWith("/") ? "" : "/"}${p}`;
}

/* ═══════════════════════════════════════════════════════════
   TYPES (from backend schemas)
   ═══════════════════════════════════════════════════════════ */
export type EventItem = {
  _id: string;
  title: string;
  description: string;
  image_url?: string;
  date: string;
  time?: string;
  venue: string;
  capacity?: number;
  price?: number;
  registration_deadline?: string;
  event_status?: "upcoming" | "live" | "completed" | "cancelled";
  registration_enabled?: boolean;
  ticket_enabled?: boolean;
  is_published?: boolean;
  is_visible?: boolean;
  display_order?: number;
};

export type LiveEventItem = {
  _id: string;
  title: string;
  description?: string;
  /** Where the stream actually is — the card must open this, not a list. */
  public_url?: string;
  start_time: string;
  end_time?: string;
  image_url?: string;
  is_published?: boolean;
  is_visible?: boolean;
  display_order?: number;
};

export type BannerItem = {
  _id: string;
  title: string;
  image_url: string;
  description?: string;
  sponsor_name?: string;
  target_url?: string;
  /* Every homepage list carries these; the app honours all three. */
  is_published?: boolean;
  is_visible?: boolean;
  display_order?: number;
  created_at?: string;
};

export type TestimonialItem = {
  _id: string;
  person_name: string;
  role?: string;
  profile_image?: string;
  message: string;
  rating?: number;
  /* Every homepage list carries these; the app honours all three. */
  is_published?: boolean;
  is_visible?: boolean;
  display_order?: number;
  created_at?: string;
};

export type CourseItem = {
  _id: string;
  title: string;
  description: string;
  thumbnail?: string;
  instructor_name: string;
  instructor_info?: string;
  start_date?: string;
  end_date?: string;
  price: number;
  available_seats?: number;
  registered_count?: number;
  enrolled_count?: number;
  registration_start_at?: string;
  registration_end_at?: string;
  course_type?: "course" | "workshop";
  registration_status?: "OPEN" | "CLOSED" | "UPCOMING";
  can_register?: boolean;
  /* Every homepage list carries these; the app honours all three. */
  is_published?: boolean;
  is_visible?: boolean;
  display_order?: number;
  created_at?: string;
};

/** Seats still open — available_seats is the total capacity, not the remainder. */
export function seatsLeft(item: { available_seats?: number; registered_count?: number; enrolled_count?: number }): number | null {
  if (typeof item.available_seats !== "number") return null;
  const taken = Number(item.registered_count ?? item.enrolled_count ?? 0);
  return Math.max(0, item.available_seats - taken);
}

export type TicketTier = {
  _id: string;
  event_id: string;
  type: string;
  price: number;
  total_quantity: number;
  available: number;
  sale_start?: string;
  sale_end?: string;
  is_visible?: boolean;
  display_order?: number;
};

export type ContestPromotion = {
  _id: string;
  title: string;
  description?: string;
  image_url?: string;
  target_url?: string;
  /** Set when the banner points at a real competition — deep-link to it. */
  competition_id?: string | null;
  /** The banner carries its own poll window, separate from the competition's. */
  voting_start?: string | null;
  voting_end?: string | null;
  /** The admin writes the button label; the app must not invent one. */
  cta_text?: string | null;
  is_published?: boolean;
  is_visible?: boolean;
  display_order?: number;
};

export type HomepagePayload = {
  brand: {
    name?: string;
    logo?: string;
    favicon?: string;
    tagline?: string;
    title?: string;
    description?: string;
  };
  upcoming_events: EventItem[];
  live_events: LiveEventItem[];
  sponsored_banners: BannerItem[];
  testimonials: TestimonialItem[];
  courses: CourseItem[];
  workshops: CourseItem[];
  contest_promotions: ContestPromotion[];
  app_promotion: Record<string, any> | null;
  contact: {
    contact_email?: string;
    contact_phone?: string;
    office_address?: string;
    social_media?: {
      facebook?: string;
      instagram?: string;
      twitter?: string;
      youtube?: string;
      linkedin?: string;
    };
  } | null;
  important_links: { _id: string; title?: string; label?: string; url?: string }[];
};

export type MyTicket = {
  ticket_ref: string;
  booking_id: string;
  event_id: string;
  ticket_type: string;
  holder_name: string;
  holder_email: string;
  is_checked_in: boolean;
  issued_at: string;
  /* The API denormalises the event onto each ticket — the website's type
     carries these too, and they are what a ticket shows without a second
     round trip for the event. */
  event_title?: string;
  event_date?: string;
  event_time?: string;
  event_venue?: string;
  event_cover?: string;
  price?: number;
  base_price?: number;
  qr_token?: string;
};

/* ═══════════════════════════════════════════════════════════
   USER / PUBLIC API  (frontend)
   ═══════════════════════════════════════════════════════════ */
export const publicApi = {
  /* Each v1 call falls back to its /api/public mirror if v1 is unavailable. */
  homepage: () => apiFetch<HomepagePayload>("/api/v1/homepage").catch(() => apiFetch<HomepagePayload>("/api/public/homepage")),
  settings: () => apiFetch<Record<string, any>>("/api/v1/website-settings").catch(() => apiFetch<Record<string, any>>("/api/public/website-settings")),
  upcomingEvents: (p: { skip?: number; limit?: number; search?: string } = {}) =>
    apiFetch<EventItem[]>("/api/v1/events/upcoming", { query: p }).catch(() => apiFetch<EventItem[]>("/api/public/events/upcoming", { query: p })),
  liveEvents: () => apiFetch<LiveEventItem[]>("/api/v1/events/live").catch(() => apiFetch<LiveEventItem[]>("/api/public/events/live")),
  banners: () => apiFetch<BannerItem[]>("/api/v1/banners").catch(() => apiFetch<BannerItem[]>("/api/public/banners")),
  testimonials: () => apiFetch<TestimonialItem[]>("/api/v1/testimonials").catch(() => apiFetch<TestimonialItem[]>("/api/public/testimonials")),
  /* Individual homepage sections (the bundled /homepage already carries these,
     but each is also fetchable on its own; v1 → public fallback). */
  homepageSections: () => apiFetch<any[]>("/api/v1/homepage-sections").catch(() => apiFetch<any[]>("/api/public/homepage-sections")),
  sponsorPopup: () => apiFetch<any>("/api/v1/sponsor-popup").catch(() => apiFetch<any>("/api/public/sponsor-popup")),
  stageMoments: () => apiFetch<any[]>("/api/v1/stage-moments").catch(() => apiFetch<any[]>("/api/public/stage-moments")),
  spotlightSection: () => apiFetch<any>("/api/v1/spotlight-section").catch(() => apiFetch<any>("/api/public/spotlight-section")),
  partnersSection: () => apiFetch<any>("/api/v1/partners-section").catch(() => apiFetch<any>("/api/public/partners-section")),
  upcomingCompetitions: (p: { skip?: number; limit?: number; search?: string } = {}) =>
    apiFetch<any[]>("/api/v1/competitions/upcoming", { query: p }).catch(() => apiFetch<any[]>("/api/public/competitions/upcoming", { query: p })),
  /** Universal share resolver → structured share links + social metadata (json=true). */
  shareEvent: (eventId: string) =>
    apiFetch<any>(`/api/v1/share/event/${encodeURIComponent(eventId)}`, { query: { json: true } })
      .catch(() => apiFetch<any>(`/api/public/share/event/${encodeURIComponent(eventId)}`, { query: { json: true } })),
  shareCompetition: (compId: string) =>
    apiFetch<any>(`/api/v1/share/competition/${encodeURIComponent(compId)}`, { query: { json: true } })
      .catch(() => apiFetch<any>(`/api/public/share/competition/${encodeURIComponent(compId)}`, { query: { json: true } })),
  courses: (p: { skip?: number; limit?: number } = {}) =>
    apiFetch<CourseItem[]>("/api/v1/courses", { query: p }).catch(() => apiFetch<CourseItem[]>("/api/public/courses", { query: p })),
  workshops: (p: { skip?: number; limit?: number } = {}) =>
    apiFetch<CourseItem[]>("/api/v1/workshops", { query: p }).catch(() => apiFetch<CourseItem[]>("/api/public/workshops", { query: p })),
  contestPromotions: () => apiFetch<ContestPromotion[]>("/api/v1/contest-promotions").catch(() => apiFetch<ContestPromotion[]>("/api/public/contest-promotions")),
  appPromotion: () => apiFetch<Record<string, any>>("/api/v1/app-promotion").catch(() => apiFetch<Record<string, any>>("/api/public/app-promotion")),
  contactInfo: () => apiFetch<Record<string, any>>("/api/v1/contact-info").catch(() => apiFetch<Record<string, any>>("/api/public/contact-info")),
  importantLinks: () => apiFetch<any[]>("/api/v1/important-links").catch(() => apiFetch<any[]>("/api/public/important-links")),
  competitions: (p: { skip?: number; limit?: number; search?: string; category?: string } = {}) =>
    apiFetch<any[]>("/api/activities/competitions", { query: { limit: 50, ...p } }),
  leaderboard: (id: string) =>
    apiFetch<{ ranking_mode?: string; leaderboard?: any[]; categories?: string[]; category_leaderboards?: Record<string, any[]> }>(
      `/api/v1/competitions/${id}/leaderboard`
    ).catch(() =>
      apiFetch<any>(`/api/public/competitions/${id}/leaderboard`)
    ),
  rounds: (id: string) =>
    apiFetch<any>(`/api/v1/competitions/${id}/rounds`).catch(() =>
      apiFetch<any>(`/api/public/competitions/${id}/rounds`)
    ),
  roundLeaderboard: (id: string, roundNumber: number, category?: string) =>
    apiFetch<{
      competition_id?: string;
      round_number?: number;
      round_name?: string;
      round_status?: string;
      is_final_round?: boolean;
      advancing_count?: number;
      current_active_round?: number;
      total_rounds?: number;
      rounds?: any[];
      category?: string;
      categories?: string[];
      leaderboard?: any[];
      category_leaderboards?: Record<string, any[]>;
    }>(`/api/v1/competitions/${id}/rounds/${roundNumber}/leaderboard`, {
      query: category ? { category } : undefined,
    }).catch(() =>
      apiFetch<any>(`/api/public/competitions/${id}/rounds/${roundNumber}/leaderboard`, {
        query: category ? { category } : undefined,
      })
    ),
  verifyCertificate: (token: string) => apiFetch<any>(`/api/public/certificates/verify/${encodeURIComponent(token)}`),
};

/* ─────────────── COMPETE (register / submit / vote) ─────────────── */
export const competeApi = {
  eligibility: (id: string) =>
    apiFetch<{ eligible: boolean; status: string; reason: string }>(`/api/v1/competitions/${id}/eligibility`, { auth: "user" }),
  register: (id: string, rules_accepted = true, payment_method: "ONLINE" | "CASH" = "ONLINE") =>
    apiFetch<any>(`/api/v1/competitions/${id}/register`, { method: "POST", auth: "user", query: { rules_accepted, payment_method } }),
  submit: (id: string, files: { uri: string; name: string; type: string }[], fieldNames: string[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", { uri: f.uri, name: f.name, type: f.type } as any));
    fd.append("field_names", fieldNames.join(", "));
    return apiFetch<any>(`/api/v1/competitions/${id}/submissions`, { method: "POST", auth: "user", form: fd });
  },
  vote: (id: string, participant_id: string) =>
    apiFetch<any>(`/api/v1/competitions/${id}/vote`, { method: "POST", auth: "user", body: { participant_id, source: "APP" } }),

  /** Single competition, including whether this member is already entered. */
  detail: (id: string) => apiFetch<any>(`/api/v1/competitions/${id}`, { auth: "user" }),

  /** This member's registration + submission status for one competition. */
  myRegistration: (id: string) => apiFetch<any>(`/api/v1/competitions/${id}/my-registration`, { auth: "user" }),

  /** The live on-stage state (current performer, standings) for a running competition. */
  liveStage: (id: string) => apiFetch<any>(`/api/v1/competitions/${id}/live-stage`, { auth: "user" }),

  /** Official, published results — the authoritative v1 view, public fallback. */
  results: (id: string) =>
    apiFetch<any>(`/api/v1/competitions/${id}/results`, { auth: "user" }).catch(() =>
      apiFetch<any>(`/api/public/competitions/${id}/results`)
    ),
  /** Standings — v1 when signed in, public otherwise. */
  leaderboard: (id: string) =>
    apiFetch<any>(`/api/v1/competitions/${id}/leaderboard`, { auth: "user" }).catch(() =>
      apiFetch<any>(`/api/public/competitions/${id}/leaderboard`)
    ),

  /** Paid entries settle through Razorpay like everything else. */
  verifyPayment: (id: string, body: {
    order_reference?: string;
    registration_reference?: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => apiFetch<any>(`/api/v1/competitions/${id}/verify-payment`, { method: "POST", auth: "user", body }),

  /** All published competitions grouped by category. */
  byCategory: () => apiFetch<any>("/api/v1/competitions/by-category"),

  /** Shareable deep-link + pre-composed text + social share links. */
  share: (id: string) => apiFetch<{
    share_url?: string; page_url?: string; registration_url?: string; share_text?: string;
    image_url?: string; title?: string;
    social_share_links?: { whatsapp?: string; facebook?: string; twitter?: string; linkedin?: string; telegram?: string };
    [k: string]: any;
  }>(`/api/v1/competitions/${id}/share`),

  /** Authoritative real-time registration window + capacity + is-open-now. */
  registrationStatus: (id: string) => apiFetch<any>(`/api/v1/competitions/${id}/registration-status`),

  /** Eligibility for a specific category (age/DOB aware). */
  categoryEligibility: (id: string, category: string, date_of_birth?: string) =>
    apiFetch<{ eligible: boolean; status?: string; reason?: string }>(
      `/api/v1/competitions/${id}/categories/${encodeURIComponent(category)}/eligibility`,
      { auth: "user", query: { category, ...(date_of_birth ? { date_of_birth } : {}) } }
    ),

  /** Register in a specific category — idempotent, with age/fee/cash safety. */
  registerInCategory: (id: string, category: string, opts: { rules_accepted?: boolean; payment_method?: "ONLINE" | "CASH"; date_of_birth?: string; idempotencyKey?: string } = {}) =>
    apiFetch<any>(`/api/v1/competitions/${id}/categories/${encodeURIComponent(category)}/register`, {
      method: "POST", auth: "user",
      query: {
        rules_accepted: opts.rules_accepted ?? true,
        payment_method: opts.payment_method ?? "ONLINE",
        category,
        ...(opts.date_of_birth ? { date_of_birth: opts.date_of_birth } : {}),
      },
      headers: { "Idempotency-Key": opts.idempotencyKey || `reg:${id}:${category}` },
    }),
};

/** Public competition feeds — readable without signing in. */
export const publicCompetitionsApi = {
  detail: (id: string) => apiFetch<any>(`/api/activities/competitions/${id}`),
  leaderboard: (id: string) => apiFetch<any>(`/api/public/competitions/${id}/leaderboard`),
  results: (id: string) => apiFetch<any>(`/api/public/competitions/${id}/results`),
  feedbacks: (id: string, submissionId: string) =>
    apiFetch<any>(`/api/v1/competitions/${id}/contestants/${submissionId}/feedbacks`, { auth: "user" }).catch(() =>
      apiFetch<any>(`/api/public/competitions/${id}/contestants/${submissionId}/feedbacks`)
    ),
  vote: (id: string, body: any) => apiFetch<any>(`/api/public/competitions/${id}/vote`, { method: "POST", auth: "user", body }),
  liveVoting: () =>
    apiFetch<any>("/api/v1/users/me/home/live-voting", { auth: "user" }).catch(() =>
      apiFetch<any>("/api/public/users/me/home/live-voting", { auth: "user" })
    ),
  /** Public live-stage snapshot — readable without signing in. */
  liveStage: (id: string) => apiFetch<any>(`/api/public/competitions/${id}/live-stage`),
};

/** Homepage featured tiles — the admin-curated promo grid. */
export const featuredApi = {
  tiles: () => apiFetch<any[]>("/api/v1/featured-tiles").catch(() => apiFetch<any[]>("/api/public/featured-tiles")),
};

/* ─────────────── SHOP (merchandise) ─────────────── */
export const shopApi = {
  products: (p: { skip?: number; limit?: number; search?: string; category?: string } = {}) =>
    apiFetch<any[]>("/api/merchandise/products", { query: { limit: 60, ...p } }),
  product: (id: string) => apiFetch<any>(`/api/merchandise/products/${id}`),
  categories: () => apiFetch<any[]>("/api/merchandise/categories"),
  createOrder: (payload: { items: { product_id: string; variant_id?: string; quantity: number }[]; shipping_address: Record<string, string> }) =>
    apiFetch<any>("/api/merchandise/orders", { method: "POST", auth: "user", body: payload }),
  verifyPayment: (body: {
    order_number: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => apiFetch<any>("/api/merchandise/orders/verify-payment", { method: "POST", auth: "user", body }),

  /* Order history and fulfilment tracking */
  myOrders: (p: { limit?: number; skip?: number } = {}) =>
    apiFetch<any>("/api/merchandise/orders", { auth: "user", query: { limit: 50, ...p } }),
  order: (orderId: string) => apiFetch<any>(`/api/merchandise/orders/${orderId}`, { auth: "user" }),
  orderTracking: (orderId: string) => apiFetch<any>(`/api/merchandise/orders/${orderId}/tracking`, { auth: "user" }),
  /** Absolute URL of the authoritative Tax Invoice PDF — fetch with the user's
   * Bearer token in the Authorization header (never put the token in the URL). */
  invoiceUrl: (orderId: string, download = true) =>
    `${getApiBase()}/api/merchandise/orders/${encodeURIComponent(orderId)}/invoice.pdf${download ? "?download=true" : ""}`,
  cancelOrder: (orderId: string, reason?: string) =>
    apiFetch<any>(`/api/merchandise/orders/${orderId}/cancel`, { method: "POST", auth: "user", body: { reason } }),
};

/* ─────────────── VIP PASSES (user) ─────────────── */
export const userVipApi = {
  forEvent: (eventId: string) => apiFetch<any[]>(`/api/events/${eventId}/vip-passes`),
  config: (eventId: string, configId: string) => apiFetch<any>(`/api/events/${eventId}/vip-passes/${configId}`),
  book: (eventId: string, configId: string, quantity = 1) =>
    apiFetch<any>(`/api/events/${eventId}/vip-passes/${configId}/book`, { method: "POST", auth: "user", body: { quantity } }),

  /* What the signed-in member owns. */
  myBookings: (q?: { limit?: number; skip?: number }) =>
    apiFetch<any>("/api/users/me/vip-bookings", { auth: "user", query: { limit: 50, ...q } }),
  myBooking: (bookingId: string) => apiFetch<any>(`/api/users/me/vip-bookings/${bookingId}`, { auth: "user" }),
  myPasses: (q?: { limit?: number; skip?: number }) =>
    apiFetch<any>("/api/users/me/vip-passes", { auth: "user", query: { limit: 50, ...q } }),
  myPass: (passId: string) => apiFetch<any>(`/api/users/me/vip-passes/${passId}`, { auth: "user" }),
  passQr: (passId: string) => apiFetch<any>(`/api/users/me/vip-passes/${passId}/qr`, { auth: "user" }),

  /** VIP checkout has its own verifier, separate from ticket bookings. */
  verifyPayment: (body: {
    booking_reference: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => apiFetch<any>("/api/vip/verify-payment", { method: "POST", auth: "user", body }),
};

export const activitiesApi = {
  events: (p: { skip?: number; limit?: number; search?: string } = {}) =>
    apiFetch<EventItem[]>("/api/activities/events", { query: p }),
  tickets: (event_id: string, p: { skip?: number; limit?: number } = {}) =>
    apiFetch<TicketTier[]>("/api/activities/tickets", {
      query: { event_id, limit: p.limit ?? 20, skip: p.skip ?? 0 },
    }),
  competitions: (p: { skip?: number; limit?: number; search?: string; category?: string } = {}) =>
    apiFetch<any[]>("/api/activities/competitions", { query: p }),
  merchandise: (p: { skip?: number; limit?: number; search?: string } = {}) =>
    apiFetch<any[]>("/api/activities/merchandise", { query: p }),
  /** Activities courses feed (paginated + search), per the activities API. */
  courses: (p: { skip?: number; limit?: number; search?: string } = {}) =>
    apiFetch<any[]>("/api/activities/courses", { query: p }),
};

export const authApi = {
  registerStep1: (email: string, referral_code?: string) =>
    apiFetch<any>("/api/auth/register/step1", { method: "POST", body: { email, referral_code } }),
  registerStep2: (email: string, otp: string) =>
    apiFetch<any>("/api/auth/register/step2", { method: "POST", body: { email, otp } }),
  registerStep3: (form: FormData) =>
    apiFetch<any>("/api/auth/register/step3", { method: "POST", form, auth: "reg" }),
  login: (email: string, password: string) =>
    apiFetch<{ access_token: string; token_type: string }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  googleLogin: (id_token: string, referral_code?: string) =>
    apiFetch<{ access_token: string; token_type: string }>("/api/auth/google-login", {
      method: "POST",
      body: { id_token, referral_code },
    }),
  me: () => apiFetch<any>("/api/auth/me", { auth: "user" }),

  /** Whether the signed-in member still owes mandatory profile details. */
  status: () => apiFetch<{ profile_complete?: boolean; needs_profile?: boolean; missing_fields?: string[]; [k: string]: any }>("/api/auth/status", { auth: "user" }),

  /** Finish the mandatory onboarding. JSON variant; `form` when a photo is attached. */
  completeProfile: (body: {
    name?: string; phone_number?: string; date_of_birth?: string; address?: string;
    parent_phone_number?: string; profile_photo?: string; password?: string;
  }) => apiFetch<any>("/api/auth/complete-profile-json", { method: "POST", body, auth: "user" }),
  completeProfileForm: (form: FormData) => apiFetch<any>("/api/auth/complete-profile", { method: "POST", form, auth: "user" }),

  /* Forgot-password: request an OTP, verify it for a reset token, then set the
     new password with that token. Mirrors the website's four-step flow. */
  forgotRequest: (email: string) =>
    apiFetch<{ message: string }>("/api/auth/forgot-password/request", { method: "POST", body: { email } }),
  forgotVerifyOtp: (email: string, otp: string) =>
    apiFetch<{ reset_token: string; message?: string }>("/api/auth/forgot-password/verify-otp", { method: "POST", body: { email, otp } }),
  forgotReset: (reset_token: string, new_password: string, confirm_password: string) =>
    apiFetch<{ message: string }>("/api/auth/forgot-password/reset-password", { method: "POST", body: { reset_token, new_password, confirm_password } }),
  /** One-shot reset: email + OTP + new password together — the flow the website ships. */
  forgotConfirm: (email: string, otp: string, new_password: string, confirm_password: string) =>
    apiFetch<{ message: string; success?: boolean }>("/api/auth/forgot-password/confirm", { method: "POST", body: { email, otp, new_password, confirm_password } }),
};

/** A registered passkey (WebAuthn credential). Server shapes vary, so loose. */
export type PasskeyCredential = {
  id?: string;
  credential_id?: string;
  _id?: string;
  name?: string;
  device_name?: string;
  device?: string;
  created_at?: string;
  last_used_at?: string;
  [k: string]: any;
};

/**
 * Passkey (WebAuthn) endpoints. Login is options → native authenticator →
 * verify; the credential routes list and revoke saved passkeys.
 */
const WEBAUTHN_HEADERS = { Origin: WEBAUTHN_ORIGIN };

export const passkeyApi = {
  /* Register (a signed-in user adds a passkey on this device). */
  registerOptions: () => apiFetch<any>("/api/auth/passkey/register/options", { method: "POST", auth: "user", headers: WEBAUTHN_HEADERS }),
  registerVerify: (attestation: Record<string, any>) =>
    apiFetch<any>("/api/auth/passkey/register/verify", { method: "POST", body: attestation, auth: "user", headers: WEBAUTHN_HEADERS }),
  /* Login (usernameless, discoverable credential). */
  loginOptions: () => apiFetch<any>("/api/auth/passkey/login/options", { method: "POST", headers: WEBAUTHN_HEADERS }),
  loginVerify: (assertion: Record<string, any>) =>
    apiFetch<{ access_token?: string; token_type?: string; [k: string]: any }>("/api/auth/passkey/login/verify", { method: "POST", body: assertion, headers: WEBAUTHN_HEADERS }),
  /* Manage saved passkeys. */
  listCredentials: () => apiFetch<PasskeyCredential[]>("/api/auth/passkey/credentials", { auth: "user" }),
  deleteCredential: (credentialId: string) =>
    apiFetch<any>(`/api/auth/passkey/credentials/${encodeURIComponent(credentialId)}`, { method: "DELETE", auth: "user" }),
};

export const profileApi = {
  get: () => apiFetch<any>("/api/profile/me", { auth: "user" }),
  update: (body: any) => apiFetch<any>("/api/profile/me", { method: "PUT", body, auth: "user" }),
  /** Multipart variant, for when a profile photo is part of the change. */
  updateForm: (form: FormData) => apiFetch<any>("/api/profile/me", { method: "PUT", form, auth: "user" }),
  dashboard: () => apiFetch<any>("/api/profile/dashboard", { auth: "user" }),
  /** JSON profile-complete / update (alt to authApi.completeProfile). */
  complete: (body: { name?: string; phone_number?: string | number; date_of_birth?: string; address?: string; parent_phone_number?: string | number }) =>
    apiFetch<any>("/api/profile/complete", { method: "POST", body, auth: "user" }),
  /** Registered + booked events, flat list + category-wise grouping. */
  myEvents: () => apiFetch<any>("/api/profile/my-events", { auth: "user" }),
  /** Registered competitions, flat list + category-wise grouping. */
  myCompetitions: () => apiFetch<any>("/api/profile/my-competitions", { auth: "user" }),
};

export const bookingsApi = {
  create: (body: { event_id: string; ticket_id: string; quantity: number; holder_names?: string[] }) =>
    apiFetch<any>("/api/bookings/", { method: "POST", body, auth: "user" }),
  my: () => apiFetch<any[]>("/api/bookings/my", { auth: "user" }),
  cancel: (booking_id: string) => apiFetch<any>(`/api/bookings/${booking_id}/cancel`, { method: "POST", auth: "user" }),
  myTickets: () => apiFetch<MyTicket[]>("/api/bookings/my-tickets", { auth: "user" }),
  ticketQr: (ticket_ref: string) => apiFetch<any>(`/api/bookings/tickets/${ticket_ref}/qr`, { auth: "user" }),
  /** Re-send (or send) the admission pass + QR to the attendee's email inbox. */
  sendTicketEmail: (ticket_ref: string) =>
    apiFetch<any>(`/api/bookings/tickets/${encodeURIComponent(ticket_ref)}/send-email`, { method: "POST", auth: "user" }),
};

export const paymentsApi = {
  createOrder: (booking_id: string) => apiFetch<any>(`/api/payments/create-order/${booking_id}`, { method: "POST", auth: "user" }),
  verifyRazorpay: (body: {
    booking_id: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => apiFetch<any>("/api/payments/verify-razorpay", { method: "POST", body, auth: "user" }),

  /** Cash-on-Spot / test settlement — the backend marks the booking paid without a gateway. */
  verifyMock: (booking_id: string, body?: { transaction_id?: string; status?: string }) =>
    apiFetch<any>(`/api/payments/verify-mock/${booking_id}`, {
      method: "POST",
      body: {
        status: body?.status || "success",
        transaction_id: body?.transaction_id || `mock_${Date.now()}`,
      },
      auth: "user",
    }),

  /** On-demand reconciliation — recovers payments captured at Razorpay but not
   * yet marked confirmed (e.g. the app closed before verify, or the webhook was
   * delayed). The server inspects pending orders and settles the captured ones. */
  reconcilePending: () => apiFetch<any>("/api/payments/reconcile-pending", { method: "POST", auth: "user" }),
};

export type RegistrationCreate = {
  activity_id: string;
  activity_type: "event" | "competition" | "course" | "workshop" | string;
  category?: string;
  coins_to_use?: number;
  order_reference?: string;
  payment_method?: "ONLINE" | "CASH";
};

export const registrationsApi = {
  /** Register for an event / competition / course (optionally spending coins). */
  create: (body: RegistrationCreate) => apiFetch<any>("/api/registrations/", { method: "POST", body, auth: "user" }),
  /** Cancel a registration by its registration_id. */
  remove: (id: string) => apiFetch<any>(`/api/registrations/${encodeURIComponent(id)}`, { method: "DELETE", auth: "user" }),
  /** Verify the Razorpay signature for a paid registration → marks it CONFIRMED. */
  verifyPayment: (body: { order_reference: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
    apiFetch<any>("/api/registrations/verify-payment", { method: "POST", body, auth: "user" }),
};

export const extrasApi = {
  notifications: () => apiFetch<any>("/api/notifications/", { auth: "user" }),
  notificationList: (p: { is_read?: boolean; notification_type?: string; page?: number; page_size?: number } = {}) =>
    apiFetch<any>("/api/notifications/", { auth: "user", query: { page: 1, page_size: 30, ...p } }),
  unreadCount: () => apiFetch<{ unread_count: number }>("/api/notifications/unread-count", { auth: "user" }),
  notification: (id: string) => apiFetch<any>(`/api/notifications/${encodeURIComponent(id)}`, { auth: "user" }),
  deleteNotification: (id: string) =>
    apiFetch<{ success?: boolean; modified_count?: number; message?: string }>(`/api/notifications/${encodeURIComponent(id)}`, { method: "DELETE", auth: "user" }),
  markRead: (id: string) => apiFetch<any>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH", auth: "user" }),
  markUnread: (id: string) => apiFetch<any>(`/api/notifications/${encodeURIComponent(id)}/unread`, { method: "PATCH", auth: "user" }),
  markAllRead: () => apiFetch<any>("/api/notifications/read-all", { method: "PATCH", auth: "user" }),
  notificationPrefs: () => apiFetch<any>("/api/notifications/preferences", { auth: "user" }),
  updateNotificationPrefs: (body: Record<string, boolean>) =>
    apiFetch<any>("/api/notifications/preferences", { method: "PATCH", auth: "user", body }),
  myCertificates: () => apiFetch<any>("/api/users/me/certificates", { auth: "user" }),
  certificate: (id: string) => apiFetch<any>(`/api/users/me/certificates/${encodeURIComponent(id)}`, { auth: "user" }),
  /** Social share metadata + preview link for a certificate. */
  certificateShare: (id: string) => apiFetch<any>(`/api/users/me/certificates/${encodeURIComponent(id)}/share`, { auth: "user" }),
  /** Absolute URL of the official certificate PDF — fetch with the Bearer token in the header. */
  certificateDownloadUrl: (id: string) => `${getApiBase()}/api/users/me/certificates/${encodeURIComponent(id)}/download`,
  myBadges: () => apiFetch<{ total: number; badges: any[] }>("/api/users/me/badges", { auth: "user" }),
  coins: () => apiFetch<{ total_coins: number; history: any[] }>("/api/rewards/coins", { auth: "user" }),
  wallet: () => apiFetch<any>("/api/rewards/wallet", { auth: "user" }),
  coinTransactions: (p: { limit?: number; skip?: number } = {}) =>
    apiFetch<any>("/api/rewards/transactions", { auth: "user", query: { limit: 50, ...p } }),
  coinLots: () => apiFetch<any>("/api/rewards/lots", { auth: "user" }),
  /** What a given number of coins is worth against an item, before committing. */
  calculateDiscount: (body: { item_id: string; item_type: "course" | "workshop"; coins_to_use?: number }) =>
    apiFetch<any>("/api/rewards/calculate-discount", { method: "POST", auth: "user", body }),
  reserveDiscount: (body: { item_id: string; item_type: "course" | "workshop"; coins_to_reserve: number; order_reference: string }) =>
    apiFetch<any>("/api/rewards/reserve-discount", { method: "POST", auth: "user", body }),

  /**
   * There is no single rewards endpoint — the wallet, the referral profile and
   * the ledger are three calls. Merged here into the one shape the rewards
   * screen and the profile widget read.
   */
  rewards: async () => {
    // Mirror the website exactly: the coin balance comes from /rewards/coins
    // (top-level `total_coins` + `history`). /rewards/wallet nests everything
    // under a `wallet` object, which made the old balance always read 0.
    const [coins, referral, ledger] = await Promise.all([
      safe(apiFetch<any>("/api/rewards/coins", { auth: "user" }), {} as any),
      safe(apiFetch<any>("/api/rewards/referral-profile", { auth: "user" }), {} as any),
      // The coin ledger is the authoritative activity list: it carries
      // `coin_amount` and `direction`. The legacy /coins history has neither.
      safe(apiFetch<any>("/api/rewards/transactions", { auth: "user", query: { limit: 50 } }), {} as any),
    ]);
    const totalCoins = Number(coins?.total_coins ?? 0);
    const entries = Array.isArray(ledger?.transactions) ? ledger.transactions : [];
    return {
      balance: totalCoins,
      total_earned: Number(referral?.total_referrer_rewards_earned ?? referral?.rewards_earned ?? referral?.total_coins_earned ?? totalCoins),
      referral_code: referral?.referral_code,
      referral_link: referral?.referral_link ?? referral?.website_referral_link ?? referral?.app_referral_link,
      referral_count: Number(referral?.total_referrals ?? 0),
      qualified_referrals: Number(referral?.qualified_referrals ?? 0),
      pending_referrals: Number(referral?.pending_referrals ?? 0),
      transactions: entries.length ? entries : (Array.isArray(coins?.history) ? coins.history : []),
    };
  },

  /** Public preview of a referral code — inviter + how many coins each side gets. */
  validateReferral: (code: string) =>
    apiFetch<{
      valid: boolean; referral_code?: string; inviter_name?: string; inviter_full_name?: string;
      inviter_photo?: string | null; welcome_coins?: number; referrer_coins?: number;
      welcome_coins_value_inr?: number; coin_value_rate?: number; message?: string; reason?: string;
    }>("/api/rewards/referral/validate", { query: { code } }),
};

/** The canonical invite link for a code — never a legacy eventora domain. */
export function referralLink(codeOrLink?: string | null): string {
  const raw = String(codeOrLink || "").trim();
  if (!raw) return "https://upgradetalentsindia.in/register";
  const link = /^https?:/i.test(raw) ? raw : `https://upgradetalentsindia.in/register?ref=${encodeURIComponent(raw)}`;
  return link.replace(/https?:\/\/(?:www\.)?eventora\.com/gi, "https://upgradetalentsindia.in");
}

/* ═══════════════════════════════════════════════════════════
   ADMIN API  (control room)
   ═══════════════════════════════════════════════════════════ */
function a<T = any>(path: string, opts: Omit<Opts, "auth"> = {}) {
  return apiFetch<T>(path, { ...opts, auth: "admin" });
}

export const adminAuthApi = {
  login: (email: string, password: string) =>
    apiFetch<{ access_token: string; token_type?: string }>("/api/admin/login", {
      method: "POST",
      body: { email, password },
    }),
  me: () => a<any>("/api/admin/me"),
  logout: () => a<any>("/api/admin/logout", { method: "POST" }),
  bootstrap: () => apiFetch<any>("/api/admin/bootstrap", { method: "POST" }),
  changePassword: (current_password: string, new_password: string) =>
    a<{ message: string }>("/api/admin/change-password", { method: "POST", body: { current_password, new_password } }),
  changeEmail: (current_password: string, new_email: string) =>
    a<{ message: string }>("/api/admin/change-email", { method: "POST", body: { current_password, new_email } }),
};

const cms = "/api/admin";
export const cmsApi = {
  getSettings: () => a(`${cms}/website-settings`),
  updateSettings: (body: any) => a(`${cms}/website-settings`, { method: "PUT", body }),
  listEvents: (q?: any) => a<any[]>(`${cms}/events`, { query: q }),
  createEvent: (body: any) => a(`${cms}/events`, { method: "POST", body }),
  updateEvent: (id: string, body: any) => a(`${cms}/events/${id}`, { method: "PUT", body }),
  deleteEvent: (id: string) => a(`${cms}/events/${id}`, { method: "DELETE" }),
  publishEvent: (id: string, q: any) => a(`${cms}/events/${id}/publish`, { method: "PATCH", query: q }),
  visibilityEvent: (id: string, q: any) => a(`${cms}/events/${id}/visibility`, { method: "PATCH", query: q }),
  reorderEvent: (id: string, q: any) => a(`${cms}/events/${id}/reorder`, { method: "PATCH", query: q }),
  listLiveEvents: () => a<any[]>(`${cms}/live-events`),
  createLiveEvent: (body: any) => a(`${cms}/live-events`, { method: "POST", body }),
  updateLiveEvent: (id: string, body: any) => a(`${cms}/live-events/${id}`, { method: "PUT", body }),
  deleteLiveEvent: (id: string) => a(`${cms}/live-events/${id}`, { method: "DELETE" }),
  publishLiveEvent: (id: string, q: any) => a(`${cms}/live-events/${id}/publish`, { method: "PATCH", query: q }),
  listBanners: () => a<any[]>(`${cms}/banners`),
  createBanner: (body: any) => a(`${cms}/banners`, { method: "POST", body }),
  updateBanner: (id: string, body: any) => a(`${cms}/banners/${id}`, { method: "PUT", body }),
  deleteBanner: (id: string) => a(`${cms}/banners/${id}`, { method: "DELETE" }),
  publishBanner: (id: string, q: any) => a(`${cms}/banners/${id}/publish`, { method: "PATCH", query: q }),
  listTestimonials: () => a<any[]>(`${cms}/testimonials`),
  createTestimonial: (body: any) => a(`${cms}/testimonials`, { method: "POST", body }),
  updateTestimonial: (id: string, body: any) => a(`${cms}/testimonials/${id}`, { method: "PUT", body }),
  deleteTestimonial: (id: string) => a(`${cms}/testimonials/${id}`, { method: "DELETE" }),
  approveTestimonial: (id: string, q: any) => a(`${cms}/testimonials/${id}/approve`, { method: "PATCH", query: q }),
  publishTestimonial: (id: string, q: any) => a(`${cms}/testimonials/${id}/publish`, { method: "PATCH", query: q }),
  listTickets: (q?: any) => a<any[]>(`${cms}/tickets`, { query: q }),
  createTicket: (body: any) => a(`${cms}/tickets`, { method: "POST", body }),
  updateTicket: (id: string, body: any) => a(`${cms}/tickets/${id}`, { method: "PUT", body }),
  deleteTicket: (id: string) => a(`${cms}/tickets/${id}`, { method: "DELETE" }),
  listContestPromos: () => a<any[]>(`${cms}/contest-promotions`),
  createContestPromo: (body: any) => a(`${cms}/contest-promotions`, { method: "POST", body }),
  updateContestPromo: (id: string, body: any) => a(`${cms}/contest-promotions/${id}`, { method: "PUT", body }),
  deleteContestPromo: (id: string) => a(`${cms}/contest-promotions/${id}`, { method: "DELETE" }),
  publishContestPromo: (id: string, q: any) => a(`${cms}/contest-promotions/${id}/publish`, { method: "PATCH", query: q }),
  getAppPromo: () => a(`${cms}/app-promotion`),
  updateAppPromo: (body: any) => a(`${cms}/app-promotion`, { method: "PUT", body }),
  getContact: () => a(`${cms}/contact-info`),
  updateContact: (body: any) => a(`${cms}/contact-info`, { method: "PUT", body }),
  listLinks: () => a<any[]>(`${cms}/important-links`),
  createLink: (body: any) => a(`${cms}/important-links`, { method: "POST", body }),
  updateLink: (id: string, body: any) => a(`${cms}/important-links/${id}`, { method: "PUT", body }),
  deleteLink: (id: string) => a(`${cms}/important-links/${id}`, { method: "DELETE" }),
  auditLogs: (q?: any) => a(`${cms}/audit-logs`, { query: q }),
  getVotingSettings: () => a(`${cms}/voting-settings`),
  updateVotingSettings: (body: any) => a(`${cms}/voting-settings`, { method: "PUT", body }),
};

export const usersApi = {
  list: (q?: any) => a("/api/admin/users/", { query: q }),
  remove: (email: string) => a(`/api/admin/users/${encodeURIComponent(email)}`, { method: "DELETE" }),
  verify: (identifier: string) => a(`/api/admin/users/${encodeURIComponent(identifier)}/verify`, { method: "POST" }),
  unverify: (identifier: string) => a(`/api/admin/users/${encodeURIComponent(identifier)}/unverify`, { method: "POST" }),
  recycleBin: (q?: any) => a("/api/admin/users/recycle-bin", { query: q }),
  restore: (id: string) => a(`/api/admin/users/recycle-bin/${id}/restore`, { method: "POST" }),
  forceDelete: (id: string) => a(`/api/admin/users/recycle-bin/${id}/force`, { method: "DELETE" }),
  profileSummary: (id: string) => a(`/api/admin/users/${id}/profile-summary`),
  activity: (id: string, q?: any) => a(`/api/admin/users/${id}/activity`, { query: q }),
  events: (id: string) => a(`/api/admin/users/${id}/events`),
  competitions: (id: string) => a(`/api/admin/users/${id}/competitions`),
  courses: (id: string) => a(`/api/admin/users/${id}/courses`),
  workshops: (id: string) => a(`/api/admin/users/${id}/workshops`),
  badges: (id: string) => a(`/api/admin/users/${id}/badges`),
  certificates: (id: string) => a(`/api/admin/users/${id}/certificates`),
  achievements: (id: string) => a(`/api/admin/users/${id}/achievements`),
  activitySummary: (id: string) => a(`/api/admin/users/${id}/activity-summary`),
  vipBookings: (id: string) => a(`/api/admin/users/${id}/vip-bookings`),
};

const comp = "/api/admin/advanced-competitions";
export const competitionsApi = {
  list: (q?: any) => a(`${comp}/`, { query: q }),
  create: (body: any) => a(`${comp}/`, { method: "POST", body }),
  update: (id: string, body: any) => a(`${comp}/${id}`, { method: "PATCH", body }),
  remove: (id: string) => a(`${comp}/${id}`, { method: "DELETE" }),
  publish: (id: string) => a(`${comp}/${id}/publish`, { method: "POST" }),
  unpublish: (id: string) => a(`${comp}/${id}/unpublish`, { method: "POST" }),
  overview: (id: string) => a(`${comp}/${id}/overview`),
  judgingProgress: (id: string) => a(`${comp}/${id}/judging/progress`),
  lockJudging: (id: string) => a(`${comp}/${id}/judging/lock`, { method: "POST" }),
  closeJudging: (id: string) => a(`${comp}/${id}/judging/close`, { method: "POST" }),
  closeVoting: (id: string) => a(`${comp}/${id}/voting/close`, { method: "POST" }),
  recalculate: (id: string) => a(`${comp}/${id}/recalculate-rankings`, { method: "POST" }),
  startFinalization: (id: string) => a(`${comp}/${id}/finalization/start`, { method: "POST" }),
  approveResults: (id: string) => a(`${comp}/${id}/results/approve`, { method: "POST" }),
  publishResults: (id: string) => a(`${comp}/${id}/results/publish`, { method: "POST" }),
  openSession: (id: string) => a(`${comp}/${id}/session/open`, { method: "POST" }),
  closeSession: (id: string) => a(`${comp}/${id}/session/close`, { method: "POST" }),
  feedbacks: (id: string) => a(`${comp}/${id}/feedbacks`),
};

export const judgesApi = {
  list: (q?: any) => a("/api/admin/judges/", { query: q }),
  create: (body: any) => a("/api/admin/judges/", { method: "POST", body }),
  sendInvitation: (email: string) => a(`/api/admin/judges/${encodeURIComponent(email)}/send-invitation`, { method: "POST" }),
  assign: (body: any) => a("/api/admin/judges/assignments", { method: "POST", body }),
  unassign: (body: any) => a("/api/admin/judges/assignments", { method: "DELETE", body }),
};

export const volunteersApi = {
  list: (q?: any) => a("/api/admin/volunteers/", { query: q }),
  create: (body: any) => a("/api/admin/volunteers/", { method: "POST", body }),
  remove: (email: string) => a(`/api/admin/volunteers/${encodeURIComponent(email)}`, { method: "DELETE" }),
};

function learnApi(base: string) {
  return {
    list: (q?: any) => a(`${base}/`, { query: q }),
    create: (body: any) => a(`${base}/`, { method: "POST", body }),
    get: (id: string) => a(`${base}/${id}`),
    update: (id: string, body: any) => a(`${base}/${id}`, { method: "PUT", body }),
    publish: (id: string, q: any) => a(`${base}/${id}/publish`, { method: "PATCH", query: q }),
    remove: (id: string) => a(`${base}/${id}`, { method: "DELETE" }),
    registrations: (id: string, q?: any) => a(`${base}/${id}/registrations`, { query: q }),
    registrationStats: (id: string) => a(`${base}/${id}/registration-stats`),
  };
}
export const adminCoursesApi = learnApi("/api/admin/courses");
export const adminWorkshopsApi = learnApi("/api/admin/workshops");

const vip = "/api/admin";
export const vipApi = {
  listConfigs: (eventId: string) => a(`${vip}/events/${eventId}/vip-configurations`),
  createConfig: (eventId: string, body: any) => a(`${vip}/events/${eventId}/vip-configurations`, { method: "POST", body }),
  getConfig: (id: string) => a(`${vip}/vip-configurations/${id}`),
  updateConfig: (id: string, body: any) => a(`${vip}/vip-configurations/${id}`, { method: "PUT", body }),
  enableConfig: (id: string) => a(`${vip}/vip-configurations/${id}/enable`, { method: "POST" }),
  disableConfig: (id: string) => a(`${vip}/vip-configurations/${id}/disable`, { method: "POST" }),
  capacity: (eventId: string) => a(`${vip}/events/${eventId}/vip-capacity`),
  analytics: (eventId: string) => a(`${vip}/events/${eventId}/vip-analytics`),
  issuePass: (eventId: string, body: any) => a(`${vip}/events/${eventId}/vip-passes/issue`, { method: "POST", body }),
  listPasses: (eventId: string, q?: any) => a(`${vip}/events/${eventId}/vip-passes`, { query: q }),
  getPass: (id: string) => a(`${vip}/vip-passes/${id}`),
  revokePass: (id: string, body?: any) => a(`${vip}/vip-passes/${id}/revoke`, { method: "POST", body }),
  passHistory: (id: string) => a(`${vip}/vip-passes/${id}/history`),
  listBookings: (eventId: string, q?: any) => a(`${vip}/events/${eventId}/vip-bookings`, { query: q }),
  cancelBooking: (id: string, body?: any) => a(`${vip}/vip-bookings/${id}/cancel`, { method: "POST", body }),
  checkins: (eventId: string, q?: any) => a(`${vip}/events/${eventId}/vip-checkins`, { query: q }),
  verifyPass: (body: any) => a(`${vip}/vip-passes/verify`, { method: "POST", body }),
};

export const checkinApi = {
  verify: (body: any) => a("/api/admin/tickets/verify", { method: "POST", body }),
  checkIn: (body: any) => a("/api/admin/tickets/check-in", { method: "POST", body }),
};

const merch = "/api/admin/merchandise";
export const merchApi = {
  listProducts: (q?: any) => a(`${merch}/products`, { query: q }),
  createProduct: (body: any) => a(`${merch}/products`, { method: "POST", body }),
  getProduct: (id: string) => a(`${merch}/products/${id}`),
  updateProduct: (id: string, body: any) => a(`${merch}/products/${id}`, { method: "PUT", body }),
  publishProduct: (id: string) => a(`${merch}/products/${id}/publish`, { method: "POST" }),
  archiveProduct: (id: string) => a(`${merch}/products/${id}/archive`, { method: "POST" }),
  listOrders: (q?: any) => a(`${merch}/orders`, { query: q }),
  getOrder: (id: string) => a(`${merch}/orders/${id}`),
  setOrderStatus: (id: string, body: any) => a(`${merch}/orders/${id}/status`, { method: "PATCH", body }),
  inventory: (q?: any) => a(`${merch}/inventory`, { query: q }),
  adjustInventory: (body: any) => a(`${merch}/inventory/adjustments`, { method: "POST", body }),
  analytics: () => a(`${merch}/analytics`),
};

const notif = "/api/admin/notifications";
export const notificationsApi = {
  list: (q?: any) => a(`${notif}/announcements`, { query: q }),
  create: (body: any) => a(`${notif}/announcements`, { method: "POST", body }),
  get: (id: string) => a(`${notif}/announcements/${id}`),
  update: (id: string, body: any) => a(`${notif}/announcements/${id}`, { method: "PATCH", body }),
  publish: (id: string) => a(`${notif}/announcements/${id}/publish`, { method: "POST" }),
  cancel: (id: string) => a(`${notif}/announcements/${id}/cancel`, { method: "POST" }),
  analytics: () => a(`${notif}/analytics`),
};

export const rewardsApi = {
  referralConfig: () => a("/api/admin/referral/config"),
  updateReferralConfig: (body: any) => a("/api/admin/referral/config", { method: "PUT", body }),
  rewardsConfig: () => a("/api/admin/rewards/config"),
  updateRewardsConfig: (body: any) => a("/api/admin/rewards/config", { method: "PUT", body }),
  expiryConfig: () => a("/api/admin/rewards/expiry-config"),
  updateExpiryConfig: (body: any) => a("/api/admin/rewards/expiry-config", { method: "PUT", body }),
  referrals: (q?: any) => a("/api/admin/referrals", { query: q }),
  referral: (id: string) => a(`/api/admin/referrals/${id}`),
  transactions: (q?: any) => a("/api/admin/rewards/transactions", { query: q }),
  expiryReport: (q?: any) => a("/api/admin/rewards/expiry-report", { query: q }),
  triggerExpiry: () => a("/api/admin/rewards/trigger-expiry", { method: "POST" }),
  analytics: () => a("/api/admin/referral/analytics"),
};

export const certificatesApi = {
  list: (q?: any) => a("/api/admin/certificates", { query: q }),
  get: (id: string) => a(`/api/admin/certificates/${id}`),
  revoke: (id: string, body?: any) => a(`/api/admin/certificates/${id}/revoke`, { method: "POST", body }),
  analytics: () => a("/api/admin/certificates/analytics/overview"),

  /* Competition awards & certificate issuing */
  eligibility: (compId: string) => a(`/api/admin/competitions/${compId}/certificate-eligibility`),
  awardConfig: (compId: string) => a(`/api/admin/competitions/${compId}/award-config`),
  updateAwardConfig: (compId: string, body: any) => a(`/api/admin/competitions/${compId}/award-config`, { method: "PUT", body }),
  generate: (compId: string, body?: any) => a(`/api/admin/competitions/${compId}/certificates/generate`, { method: "POST", body }),
  byCompetition: (compId: string, q?: any) => a(`/api/admin/competitions/${compId}/certificates`, { query: q }),

  /** Absolute URL of a certificate PDF — handed to the share/print sheet. */
  downloadUrl: (id: string) => `${getApiBase()}/api/admin/certificates/${id}/download`,
};

export const badgesApi = {
  list: (q?: any) => a("/api/admin/badges/", { query: q }),
  config: () => a("/api/admin/badges/config"),
  updateConfig: (body: any) => a("/api/admin/badges/config", { method: "PUT", body }),
  reconcile: () => a("/api/admin/badges/reconcile", { method: "POST" }),
  analytics: () => a("/api/admin/badges/analytics"),
  revoke: (awardId: string, body?: any) => a(`/api/admin/badges/user-badges/${awardId}/revoke`, { method: "POST", body }),
};

/* ─────────────── list-shape normalisers ─────────────── */
export function toRows(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  for (const key of [
    "items", "data", "results", "rows", "records", "users", "events", "orders", "products",
    "announcements", "transactions", "referrals", "certificates", "passes", "bookings",
    "judges", "volunteers", "competitions", "logs", "badges",
  ]) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
}

export function totalOf(payload: any, rows: any[]): number {
  return Number(payload?.total ?? payload?.count ?? payload?.total_count ?? rows.length) || rows.length;
}

/* ═══════════════════════════════════════════════════════════
   STAFF: JUDGE + VOLUNTEER (OTP login, own token slot)
   ═══════════════════════════════════════════════════════════ */
type StaffToken = { access_token: string; token_type: string; user_email: string; role: string; must_set_password?: boolean };

export const judgeAuthApi = {
  loginStep1: (email: string) => apiFetch<{ message: string }>("/api/judge/auth/login/step1", { method: "POST", body: { email } }),
  loginStep2: (email: string, otp: string) =>
    apiFetch<StaffToken>("/api/judge/auth/login/step2", { method: "POST", body: { email, otp } }),
  /** Password sign-in, for a judge who has set one. */
  loginPassword: (email: string, password: string) =>
    apiFetch<StaffToken>("/api/judge/auth/login/password", { method: "POST", body: { email, password } }),
  /** First-time password set (after an OTP login). */
  setPassword: (password: string) =>
    apiFetch<{ message: string }>("/api/judge/auth/set-password", { method: "POST", body: { password }, auth: "staff" }),
  changePassword: (current_password: string, new_password: string) =>
    apiFetch<{ message: string }>("/api/judge/auth/change-password", { method: "POST", body: { current_password, new_password }, auth: "staff" }),
};

export const volunteerAuthApi = {
  loginStep1: (email: string) => apiFetch<{ message: string }>("/api/volunteer/auth/login/step1", { method: "POST", body: { email } }),
  loginStep2: (email: string, otp: string) =>
    apiFetch<StaffToken>("/api/volunteer/auth/login/step2", { method: "POST", body: { email, otp } }),
  loginPassword: (email: string, password: string) =>
    apiFetch<StaffToken>("/api/volunteer/auth/login/password", { method: "POST", body: { email, password } }),
  setPassword: (password: string) =>
    apiFetch<{ message: string }>("/api/volunteer/auth/set-password", { method: "POST", body: { password }, auth: "staff" }),
  changePassword: (current_password: string, new_password: string) =>
    apiFetch<{ message: string }>("/api/volunteer/auth/change-password", { method: "POST", body: { current_password, new_password }, auth: "staff" }),
};

export type JudgingCriterion = { name: string; max_score: number; weight?: number; description?: string };
export type JudgeCompetition = {
  _id: string; title: string; category: string; description?: string;
  judge_scoring_enabled?: boolean; judging_status?: string;
  judging_criteria?: JudgingCriterion[]; banner_url?: string;
};
export type JudgeContestant = {
  _id: string; competition_id: string; user_email: string; user_name?: string;
  title?: string; submission_url?: string; media_url?: string; description?: string;
  status: string; submitted_at?: string;
};

export const judgeCompetitionsApi = {
  /** Competitions this judge is assigned to. */
  listAssigned: () => apiFetch<JudgeCompetition[]>("/api/judge/", { auth: "staff" }),

  /** Approved submissions with scoring status (round/category/present-filter aware). */
  listContestants: (compId: string, opts: { category?: string; only_present?: boolean; round_number?: number } = {}) =>
    apiFetch<JudgeContestant[]>(`/api/judge/${compId}/contestants`, { auth: "staff", query: {
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.only_present ? { only_present: true } : {}),
      ...(opts.round_number != null ? { round_number: opts.round_number } : {}),
    } }),

  /** The official confirmed PRESENT lineup for event-day judging (per round). */
  finalContestants: (compId: string, opts: { category?: string; round_number?: number } = {}) =>
    apiFetch<JudgeContestant[]>(`/api/judge/${compId}/final-contestants`, { auth: "staff", query: {
      ...(opts.category ? { category: opts.category } : {}),
      ...(opts.round_number != null ? { round_number: opts.round_number } : {}),
    } }),

  /** The multi-round sequence + active round for an assigned competition. */
  rounds: (compId: string) => apiFetch<any>(`/api/judge/${compId}/rounds`, { auth: "staff" }),
  /** Independent leaderboard for a specific round (1st/2nd/3rd rankings). */
  roundLeaderboard: (compId: string, roundNumber: number, category?: string) =>
    apiFetch<any>(`/api/judge/${compId}/rounds/${roundNumber}/leaderboard`, { auth: "staff", query: category ? { category } : undefined }),

  verifyPin: (compId: string, pin: string) =>
    apiFetch<{ message: string }>(`/api/judge/${compId}/verify-pin`, { method: "POST", body: { pin }, auth: "staff" }),

  saveDraft: (compId: string, subId: string, scores: Record<string, number>, comments?: string, round_number?: number) =>
    apiFetch<{ message: string }>(`/api/judge/${compId}/contestants/${subId}/draft`, { method: "POST", body: { scores, comments, ...(round_number != null ? { round_number } : {}) }, auth: "staff" }),
  getDraft: (compId: string, subId: string) =>
    apiFetch<{ scores?: Record<string, number>; comments?: string }>(`/api/judge/${compId}/contestants/${subId}/draft`, { auth: "staff" }),

  skipContestant: (compId: string, subId: string, reason: string) =>
    apiFetch<{ message: string }>(`/api/judge/${compId}/contestants/${subId}/skip`, { method: "POST", body: { reason }, auth: "staff" }),

  /** How many this judge has scored / skipped / still pending. */
  myProgress: (compId: string) => apiFetch<any>(`/api/judge/${compId}/my-progress`, { auth: "staff" }),

  /** Text (and optional audio) feedback for a contestant. */
  sendFeedback: (compId: string, subId: string, feedback: string, audio_feedback_url?: string) =>
    apiFetch<{ message: string }>(`/api/judge/${compId}/contestants/${subId}/feedback`, { method: "POST", body: { text_feedback: feedback, ...(audio_feedback_url ? { audio_feedback_url } : {}) }, auth: "staff" }),

  /** Final official score by submission id (one per judge per participant). */
  submitScore: (subId: string, scores: Record<string, number>, comments?: string, extra?: { participant_id?: string; feedback?: string; round_number?: number }) =>
    apiFetch<{ message: string }>(`/api/judge/submissions/${subId}/scores`, { method: "POST", body: { scores, comments, ...(extra || {}) }, auth: "staff" }),

  /** Direct competition score (offline stage / multi-round) by participant/registration/email/submission id. */
  submitCompetitionScore: (compId: string, body: { scores: Record<string, number>; participant_id?: string; comments?: string; feedback?: string; round_number?: number }) =>
    apiFetch<any>(`/api/judge/${compId}/scores`, { method: "POST", body, auth: "staff" }),

  /** Who is on stage right now, in the one-by-one live round. */
  currentPerformer: (compId: string) => apiFetch<any>(`/api/judge/${compId}/current-performer`, { auth: "staff" }),
  /** The judge live-stage card (alias of current-performer). */
  liveStage: (compId: string) => apiFetch<any>(`/api/judge/${compId}/live-stage`, { auth: "staff" }),
  /** One-click score for the performer currently on stage. */
  scoreLiveStage: (compId: string, body: { submission_id?: string; participant_id?: string; scores: Record<string, number>; comments?: string; feedback?: string; round_number?: number }) =>
    apiFetch<any>(`/api/judge/${compId}/live-stage/score`, { method: "POST", body, auth: "staff" }),
};

export type TicketScanVerifyResult = {
  is_valid: boolean;
  ticket: { ticket_ref: string; holder_name: string; holder_email: string; is_checked_in: boolean; check_in_time: string | null; [k: string]: any };
  booking_status: string;
  /* multi-person capacity + cash state (loose — shapes vary) */
  admit_count?: number; max_admit?: number; remaining_admits?: number; admitted_count?: number;
  is_cash?: boolean; cash_payment?: boolean; cash_amount?: number; cash_status?: string;
  [k: string]: any;
};

export const volunteerScannerApi = {
  /** Scan a QR → full ticket status, multi-person capacity, cash state. */
  verifyTicket: (qr_token: string, opts: { event_id?: string; admit_count?: number } = {}) =>
    apiFetch<TicketScanVerifyResult>("/api/volunteer/tickets/verify", { method: "POST", body: { qr_token, ...opts }, auth: "staff" }),
  /** Atomically admit attendees (multi-person) and auto-collect cash if requested. */
  checkInTicket: (qr_token: string, opts: { admit_count?: number; event_id?: string; collect_cash?: boolean; cash_collected?: boolean; cash_amount?: number; notes?: string } = {}) =>
    apiFetch<{ message?: string; ticket_ref?: string; [k: string]: any }>("/api/volunteer/tickets/check-in", { method: "POST", body: { qr_token, ...opts }, auth: "staff" }),
  /** Live shift stats for this volunteer (check-ins, cash collected). */
  stats: (event_id?: string) => apiFetch<any>("/api/volunteer/tickets/stats", { auth: "staff", query: event_id ? { event_id } : undefined }),
  /** Recent check-ins across the shift. */
  checkinHistory: (opts: { limit?: number; event_id?: string } = {}) =>
    apiFetch<any>("/api/volunteer/tickets/checkin-history", { auth: "staff", query: { limit: 50, ...opts } }),
  /** Mark a cash ticket's payment as collected at the venue. */
  collectCash: (ticket_ref: string, opts: { qr_token?: string; amount?: number; notes?: string } = {}) =>
    apiFetch<any>(`/api/volunteer/tickets/${encodeURIComponent(ticket_ref)}/collect-cash`, { method: "POST", body: { ticket_ref, ...opts }, auth: "staff" }),
  /** Events assigned to this volunteer. */
  assignedEvents: () => apiFetch<any>("/api/volunteer/tickets/assigned-events", { auth: "staff" }),
};
