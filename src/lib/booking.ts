import { ticketWay } from "@/components/TicketPass";
import type { MyTicket } from "@/lib/api";

/** The five states a booking can be in, collapsed from the API's two fields. */
export type BookingState = "confirmed" | "pending" | "cancelled" | "refunded" | "free";

export type BookingRow = Record<string, any>;

export function bookingId(b: BookingRow): string {
  return String(b?.booking_id ?? b?._id ?? b?.id ?? b?.booking_reference ?? "");
}

/**
 * `booking_status` and `payment_status` disagree on stale rows, so the two are
 * read together: a cancellation always wins, then a settled payment, then
 * anything still waiting on money.
 */
export function bookingState(b: BookingRow): BookingState {
  const bs = String(b?.booking_status || "").toUpperCase();
  const ps = String(b?.payment_status || "").toUpperCase();
  if (bs === "CANCELLED" || ps === "CANCELLED") return "cancelled";
  if (ps === "REFUNDED" || bs === "REFUNDED") return "refunded";
  if (ps === "NOT_REQUIRED") return "free";
  if (ps === "PAID" || bs === "CONFIRMED") return "confirmed";
  return "pending";
}

export const STATE_LABEL: Record<BookingState, string> = {
  confirmed: "Confirmed",
  pending: "Payment pending",
  cancelled: "Cancelled",
  refunded: "Refunded",
  free: "Free entry",
};

/** `tone` keys match the Badge component's. */
export const STATE_TONE: Record<BookingState, "success" | "warning" | "danger" | "info"> = {
  confirmed: "success",
  pending: "warning",
  cancelled: "danger",
  refunded: "info",
  free: "success",
};

/** Can the user still call this off? */
export function isCancellable(b: BookingRow): boolean {
  const s = bookingState(b);
  return s === "pending" || s === "free";
}

/**
 * A booking borrows the colourway of its own tickets, so a card on this shelf
 * and the pass it opens are recognisably the same object.
 */
export function bookingWay(b: BookingRow, tickets: MyTicket[] = []) {
  return ticketWay(tickets[0]?.ticket_ref || bookingId(b) || "x");
}

/** The tickets issued against one booking. */
export function ticketsOf(id: string, all: MyTicket[] = []): MyTicket[] {
  return all.filter((t) => String(t.booking_id) === String(id));
}

/** Pull whatever the booking row knows about the event, tickets filling gaps. */
export function eventOf(b: BookingRow, tickets: MyTicket[] = []) {
  const t = tickets[0];
  return {
    title: b?.event_title || b?.title || t?.event_title || "Event booking",
    date: b?.event_date || t?.event_date || null,
    time: b?.event_time || t?.event_time || null,
    venue: b?.event_venue || b?.venue || t?.event_venue || null,
    cover: b?.event_cover || b?.image_url || t?.event_cover || null,
    eventId: String(b?.event_id || t?.event_id || ""),
  };
}
