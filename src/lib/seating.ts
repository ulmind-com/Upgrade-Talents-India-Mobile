import type { TicketTier } from "@/lib/api";

/* ──────────────────────────────────────────────────────────────────────────
   Seating — the same arena the website draws (BookingFlow.tsx), so a seat
   booked on the web is the same seat here and vice versa.

   • Each ticket tier becomes a zone. Its capacity decides the row width
     (10 / 14 / 16 / 20 seats) and how many rows it gets.
   • Rows take letters from one master list, continuing tier after tier
     (A, B, C … skipping I and O), so every seat id is unique: "A-01".
   • Each row splits into left · centre · right blocks with aisles between.
   ────────────────────────────────────────────────────────────────────────── */

export type Zone = {
  rank: number; // 1 platinum · 2 gold · 3 silver · 4 general · 5 free
  label: string;
  title: string;
  subtitle: string;
  color: string;
  perks: string[];
};

export function zoneFor(name: string, price?: number): Zone {
  const n = (name || "").toLowerCase();
  const isFree = (price !== undefined && Number(price) === 0) || n.includes("free");
  if (/plat|vip|royal|front|diamond/.test(n))
    return {
      rank: 1,
      label: "Platinum",
      title: "Platinum VIP Lounge",
      subtitle: "Front-row sightline · VIP hospitality",
      color: "#C084FC",
      perks: ["Front-row stage view", "Fast-track VIP gate", "Lounge refreshment", "Closest to artists & judges"],
    };
  if (/gold|exec|middle|premier/.test(n))
    return {
      rank: 2,
      label: "Gold",
      title: "Gold Executive Field",
      subtitle: "Centre stage · eye level",
      color: "#FBBF24",
      perks: ["Centre-stage eye level", "Audio & visual sweet spot", "Comfortable spacing", "Express check-in"],
    };
  if (/silver|standard|mezz/.test(n))
    return {
      rank: 3,
      label: "Silver",
      title: "Silver Elevated Tier",
      subtitle: "Full arena panorama · great value",
      color: "#94A3B8",
      perks: ["Elevated panoramic view", "Stadium-quality sound", "Dedicated restrooms", "Digital programme"],
    };
  if (isFree)
    return {
      rank: 5,
      label: "Free",
      title: "General Free Admission",
      subtitle: "Full arena access · free entry",
      color: "#34D399",
      perks: ["Free official entry", "QR check-in at the gate", "Full show access", "Instant pass"],
    };
  return {
    rank: 4,
    label: n.includes("bronze") ? "Bronze" : "General",
    title: n.includes("bronze") ? "Bronze Arena" : "General Field",
    subtitle: "High-energy crowd · best value",
    color: "#38BDF8",
    perks: ["Panoramic arena view", "Crowd energy", "Budget-friendly entry", "Concessions & merch"],
  };
}

const ROW_LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M",
  "N", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
  "AA", "BB", "CC", "DD", "EE", "FF", "GG", "HH", "JJ", "KK",
  "LL", "MM", "NN", "PP", "QQ", "RR", "SS", "TT", "UU", "VV",
];

export type SeatRow = { code: string; left: number[]; center: number[]; right: number[] };

const capOf = (t: TicketTier) => Math.max(1, Number(t.total_quantity || t.available || 50));

function shape(cap: number) {
  if (cap <= 24) return { per: 10, l: 2, c: 6, r: 2 };
  if (cap <= 70) return { per: 14, l: 2, c: 10, r: 2 };
  if (cap <= 140) return { per: 16, l: 3, c: 10, r: 3 };
  return { per: 20, l: 4, c: 12, r: 4 };
}

/** Rows for one tier — a 1:1 port of the website's generateDynamicTierRows. */
export function rowsForTier(tier: TicketTier, index: number, all: TicketTier[]): SeatRow[] {
  const cap = capOf(tier);
  const { per, l, c, r } = shape(cap);

  let start = 0;
  for (let i = 0; i < index; i++) {
    const pc = capOf(all[i]);
    start += Math.ceil(pc / shape(pc).per);
  }

  const rows: SeatRow[] = [];
  let assigned = 0;
  for (let k = 0; k < Math.ceil(cap / per); k++) {
    const code = ROW_LETTERS[(start + k) % ROW_LETTERS.length];
    const inRow = Math.min(per, cap - assigned);
    assigned += inRow;
    let lc = l, rc = r, cc = c;
    if (inRow < per) {
      if (inRow <= 4) {
        lc = 1; rc = 1; cc = Math.max(0, inRow - 2);
      } else {
        lc = Math.min(l, Math.max(1, Math.floor(inRow / 5)));
        rc = lc;
        cc = inRow - (lc + rc);
      }
    }
    rows.push({
      code,
      left: Array.from({ length: lc }, (_, i) => i + 1),
      center: Array.from({ length: cc }, (_, i) => i + 1 + lc),
      right: Array.from({ length: rc }, (_, i) => i + 1 + lc + cc),
    });
  }
  return rows;
}

export const seatId = (row: string, n: number) => `${row}-${String(n).padStart(2, "0")}`;

/**
 * The tiers the arena is built from — event.categories are the authority
 * (name, price, capacity), matched to live ticket rows for availability;
 * then plain ticket rows; then one tier from the event's own price/capacity.
 * Same precedence as the website.
 */
export function buildTiers(event: any, list: TicketTier[]): TicketTier[] {
  const cats: any[] = Array.isArray(event?.categories) ? event.categories : [];
  if (cats.length) {
    return cats.map((cat, idx) => {
      const name = String(cat?.name || "General");
      const matched =
        list.find((t) => String((t as any).category || t.type || "").trim().toLowerCase() === name.trim().toLowerCase()) || list[idx];
      const cap = Number(cat?.capacity != null ? cat.capacity : event?.capacity || 50);
      const sold = matched ? Math.max(0, Number(matched.total_quantity || cap) - Number(matched.available ?? cap)) : 0;
      return {
        _id: matched?._id || `cat-${idx}-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
        event_id: String(event?._id || ""),
        type: name,
        category: name,
        price: Number(cat?.price ?? 0),
        total_quantity: cap,
        available: Math.max(0, cap - sold),
        display_order: idx,
        is_visible: true,
      } as TicketTier;
    });
  }
  const visible = list.filter((t) => t.is_visible !== false);
  if (visible.length) {
    return [...visible].sort((a, b) => zoneFor(a.type, a.price).rank - zoneFor(b.type, b.price).rank || b.price - a.price);
  }
  const cap = Number(event?.capacity || 100);
  const name = String(event?.category || "General Admission");
  return [
    {
      _id: `default-${event?._id || "event"}`,
      event_id: String(event?._id || ""),
      type: name,
      category: name,
      price: Number(event?.price || 0),
      total_quantity: cap,
      available: Math.max(0, cap - Number(event?.registered_count || 0)),
      is_visible: true,
    } as TicketTier,
  ];
}

export type PickedSeat = { id: string; row: string; num: number; tierId: string; tierName: string; price: number; color: string };

export const MAX_SEATS = 10;
