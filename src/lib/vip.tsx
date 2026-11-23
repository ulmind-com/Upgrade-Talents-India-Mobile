import React, { useCallback, useRef, useState } from "react";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { ApiError, userVipApi, type VipBooking, type VipConfig, type VipPass } from "@/lib/api";
import { RazorpayCheckout, isValidRazorpayOrderId, type RazorpayOptions, type RazorpaySuccess } from "@/components/RazorpayCheckout";
import { titleCase, formatEventDate } from "@/lib/format";

/* ── labels & tones ───────────────────────────────────────────────────── */

export const VIP_GOLD = "#F5C542";
export const VIP_ORANGE = "#F9862B";
export const OK = "#22C55E";
export const WARN = "#F5B544";
export const BAD = "#FF385C";
export const MUTED = "#8A90A6";

export const vipId = (c: VipConfig) => String(c._id || c.id || "");

const AREA: Record<string, string> = {
  MAIN_GATE: "Main gate",
  VIP_LOUNGE: "VIP lounge",
  BACKSTAGE: "Backstage",
  SPEAKER_LOUNGE: "Speaker lounge",
  SPONSOR_AREA: "Sponsor area",
  NETWORKING_AREA: "Networking area",
  EXCLUSIVE_ZONE: "Exclusive zone",
};
export const areaLabel = (a: string) => AREA[a] || titleCase(String(a).replace(/_/g, " ").toLowerCase());

export const entryPolicyLabel = (p?: string, maxEntries?: number | null, cooldown?: number) => {
  if (String(p).toUpperCase() === "ALLOW_REENTRY") {
    const bits = [maxEntries ? `up to ${maxEntries} entries` : "re-entry allowed", cooldown ? `${cooldown} min between entries` : null];
    return bits.filter(Boolean).join(" · ");
  }
  return "Single entry";
};

export const money = (n?: number, currency = "INR") => {
  const v = Number(n || 0);
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: v % 1 ? 2 : 0 }).format(v);
  } catch {
    return `₹${v.toLocaleString("en-IN")}`;
  }
};

export function bookingTone(status?: string): { label: string; color: string } {
  switch (String(status).toUpperCase()) {
    case "CONFIRMED":
      return { label: "Confirmed", color: OK };
    case "PENDING_PAYMENT":
      return { label: "Payment pending", color: WARN };
    case "PAYMENT_FAILED":
      return { label: "Payment failed", color: BAD };
    case "EXPIRED":
      return { label: "Expired", color: MUTED };
    case "CANCELLED":
      return { label: "Cancelled", color: MUTED };
    case "REFUND_PENDING":
      return { label: "Refund pending", color: WARN };
    case "REFUNDED":
      return { label: "Refunded", color: MUTED };
    default:
      return { label: titleCase(String(status || "Unknown").replace(/_/g, " ").toLowerCase()), color: MUTED };
  }
}

export function passTone(p: Pick<VipPass, "status" | "validity_end">): { label: string; color: string; usable: boolean } {
  const st = String(p.status).toUpperCase();
  if (st === "REVOKED") return { label: "Revoked", color: BAD, usable: false };
  if (st === "CANCELLED") return { label: "Cancelled", color: MUTED, usable: false };
  if (st === "EXPIRED" || (p.validity_end && new Date(p.validity_end).getTime() < Date.now()))
    return { label: "Expired", color: MUTED, usable: false };
  return { label: "Valid", color: OK, usable: true };
}

/** Can this configuration be booked right now — and if not, why not. */
export function configState(cfg: VipConfig) {
  const cap = cfg.capacity;
  const now = Date.now();
  const start = cfg.booking_start ? new Date(cfg.booking_start).getTime() : null;
  const end = cfg.booking_end ? new Date(cfg.booking_end).getTime() : null;
  const left = cap?.available_count ?? null;
  const soldOut = !!cap?.sold_out || (left != null && left <= 0);
  const notYet = start != null && now < start;
  const closed = end != null && now > end;
  const open = cap ? !!cap.booking_open && !soldOut : !soldOut && !notYet && !closed;
  const label = soldOut
    ? "Sold out"
    : notYet
    ? `Opens ${formatEventDate(cfg.booking_start!)}`
    : closed || (cap && !cap.booking_open)
    ? "Booking closed"
    : null;
  const maxQty = Math.max(1, Math.min(cfg.max_passes_per_user || 1, left ?? 10, 10));
  return { open, soldOut, label, left, maxQty, total: cap?.total_capacity ?? null, sold: cap?.confirmed_count ?? null };
}

/* ── checkout ─────────────────────────────────────────────────────────── */

export type VipResult = { bookingId: string; reference: string; passIds: string[] };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const newKey = (cfgId: string) => `vip-${cfgId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * The VIP payment flow, end to end — and honest about it.
 *
 * book → Razorpay → `/vip/verify-payment`. If the verify call fails we do NOT
 * claim success: we re-read the booking (the gateway webhook may already have
 * confirmed it) and only report "confirmed" when the server says CONFIRMED.
 */
export function useVipCheckout({ onConfirmed }: { onConfirmed: (r: VipResult) => void }) {
  const { c } = useTheme();
  const { user } = useSession();
  const [pay, setPay] = useState<{ options: RazorpayOptions; booking: VipBooking } | null>(null);
  const [phase, setPhase] = useState<"idle" | "booking" | "paying" | "verifying">("idle");
  const [error, setError] = useState<string | null>(null);
  const last = useRef<VipBooking | null>(null);

  const openGateway = useCallback(
    (b: VipBooking) => {
      last.current = b;
      if (String(b.booking_status).toUpperCase() === "CONFIRMED") {
        onConfirmed({ bookingId: b.booking_id, reference: b.booking_reference, passIds: b.issued_pass_ids || [] });
        setPhase("idle");
        return;
      }
      const pd = b.payment_details || {};
      const cd = pd.checkout_data || {};
      if (pd.status === "PENDING_CONFIGURATION" || !cd.key) {
        setPhase("idle");
        setError(pd.message || "Payments aren't set up on the server yet. Your booking is held as pending.");
        return;
      }
      setPay({
        booking: b,
        options: {
          key: cd.key,
          amount: cd.amount ?? Math.round(Number(b.total_amount || 0) * 100),
          currency: cd.currency || b.currency || "INR",
          name: "Upgrade Talents India",
          description: cd.description || `${b.pass_name} · VIP pass`,
          order_id: isValidRazorpayOrderId(cd.order_id) ? cd.order_id : undefined,
          prefill: { name: user?.name || "", email: user?.email || "", contact: user?.phone_number || "" },
          notes: { booking_reference: b.booking_reference },
          theme: { color: c.accent },
        },
      });
      setPhase("paying");
    },
    [onConfirmed, user?.email, user?.name, user?.phone_number, c.accent]
  );

  /** New booking for `quantity` passes. */
  const start = useCallback(
    async (cfg: VipConfig, opts: { quantity: number; holder_names?: string[] }) => {
      setError(null);
      setPhase("booking");
      try {
        const b = await userVipApi.book(cfg.event_id, vipId(cfg), {
          quantity: opts.quantity,
          holder_names: opts.holder_names?.length ? opts.holder_names : undefined,
          idempotency_key: newKey(vipId(cfg)),
        });
        openGateway(b);
      } catch (e) {
        setPhase("idle");
        setError(e instanceof ApiError ? e.message : "Couldn't reserve this pass. Please try again.");
      }
    },
    [openGateway]
  );

  /** Finish paying a booking that is still pending (same idempotency key → same booking, fresh order). */
  const resume = useCallback(
    async (b: VipBooking) => {
      setError(null);
      if (!b.idempotency_key) {
        setError("This booking can't be resumed here — book the pass again.");
        return;
      }
      setPhase("booking");
      try {
        const again = await userVipApi.book(b.event_id, b.configuration_id, {
          quantity: b.quantity,
          holder_names: b.holder_names,
          idempotency_key: b.idempotency_key,
        });
        openGateway(again);
      } catch (e) {
        setPhase("idle");
        setError(e instanceof ApiError ? e.message : "Couldn't reopen this payment.");
      }
    },
    [openGateway]
  );

  const settle = async (r: RazorpaySuccess, b: VipBooking) => {
    setPhase("verifying");
    try {
      const v = await userVipApi.verifyPayment({
        booking_reference: b.booking_reference,
        razorpay_order_id: r.razorpay_order_id || "",
        razorpay_payment_id: r.razorpay_payment_id,
        razorpay_signature: r.razorpay_signature || "",
      });
      onConfirmed({ bookingId: b.booking_id, reference: b.booking_reference, passIds: v.issued_pass_ids || [] });
    } catch {
      // the webhook may confirm it a moment later — ask the server, don't guess
      for (let i = 0; i < 3; i++) {
        await wait(2000);
        try {
          const fresh = await userVipApi.myBooking(b.booking_id);
          if (String(fresh.booking_status).toUpperCase() === "CONFIRMED") {
            onConfirmed({ bookingId: fresh.booking_id, reference: fresh.booking_reference, passIds: fresh.issued_pass_ids || [] });
            setPhase("idle");
            return;
          }
        } catch {}
      }
      setError(
        `Payment received but not confirmed yet (payment id ${r.razorpay_payment_id}). It will show in My bookings once the gateway confirms it.`
      );
    } finally {
      setPhase("idle");
    }
  };

  const sheet = (
    <RazorpayCheckout
      visible={!!pay}
      options={pay?.options || null}
      onSuccess={(r) => {
        const b = pay?.booking;
        setPay(null);
        if (b) settle(r, b);
      }}
      onFailure={(m) => {
        setPay(null);
        setPhase("idle");
        setError(m || "Payment failed.");
      }}
      onDismiss={() => {
        const b = pay?.booking;
        setPay(null);
        setPhase("idle");
        setError(
          b?.expires_at
            ? `Payment cancelled. Your pass is held until ${new Date(b.expires_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} — finish it from My bookings.`
            : "Payment cancelled."
        );
      }}
    />
  );

  return { start, resume, sheet, phase, busy: phase !== "idle", error, clearError: () => setError(null), lastBooking: last.current };
}
