import React, { useCallback, useState } from "react";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import {
  ApiError, paymentsApi, registrationsApi, userVipApi, competeApi, shopApi,
} from "@/lib/api";
import { RazorpayCheckout, type RazorpayOptions, type RazorpaySuccess } from "@/components/RazorpayCheckout";

/**
 * Which flow a payment belongs to. Each one is settled by its own verifier on
 * the backend, so the kind has to travel with the order.
 */
export type CheckoutKind = "booking" | "registration" | "vip" | "competition" | "merch";

type Ctx =
  | { kind: "booking"; bookingId: string; reference?: string }
  | { kind: "registration"; orderReference: string }
  | { kind: "vip"; bookingReference: string }
  | { kind: "competition"; competitionId: string; orderReference: string }
  | { kind: "merch"; orderNumber: string };

export type StartArgs = {
  /** Whatever the create call returned — its `payment_info` drives checkout. */
  paymentInfo: any;
  /** Fallback amount in rupees, when the server did not send paise. */
  amount?: number;
  description?: string;
  context: Ctx;
};

/**
 * One Razorpay checkout for the whole app.
 *
 * Every paid flow — tickets, paid registrations, VIP, competitions, merch —
 * opens the same hosted sheet and then has its signature verified server-side
 * by the verifier that belongs to that flow. Nothing is confirmed on the
 * client's word.
 */
export function useCheckout({ onDone }: { onDone?: (reference: string) => void } = {}) {
  const { c } = useTheme();
  const { user } = useSession();
  const [pay, setPay] = useState<{ options: RazorpayOptions; context: Ctx } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);

  const start = useCallback(
    ({ paymentInfo, amount, description, context }: StartArgs): { opened: boolean; reason?: string } => {
      const info = paymentInfo || {};
      const key = info.key_id || info.checkout_data?.key;
      if (!key) return { opened: false, reason: "Payments are not configured on the server yet. Please contact support." };

      // Only a real Razorpay order id may be handed to checkout.
      const rawOrderId = info.checkout_data?.order_id || info.order_id || info.provider_order_id;
      const orderId = String(rawOrderId || "").startsWith("order_") ? String(rawOrderId) : undefined;

      setError(null);
      setCancelled(false);
      setPay({
        context,
        options: {
          key,
          amount: info.checkout_data?.amount ?? info.amount_paise ?? Math.round(Number(amount || 0) * 100),
          currency: info.currency || "INR",
          name: info.checkout_data?.name || "Upgrade Talents India",
          description: description || info.checkout_data?.description || "Payment",
          order_id: orderId,
          prefill: { name: user?.name || "", email: user?.email || "", contact: user?.phone_number || "" },
          theme: { color: c.accent },
        },
      });
      return { opened: true };
    },
    [user?.email, user?.name, user?.phone_number, c.accent]
  );

  const verify = async (r: RazorpaySuccess, ctx: Ctx) => {
    const common = {
      razorpay_order_id: r.razorpay_order_id,
      razorpay_payment_id: r.razorpay_payment_id,
      razorpay_signature: r.razorpay_signature,
    };
    switch (ctx.kind) {
      case "booking":
        await paymentsApi.verifyRazorpay({ booking_id: ctx.bookingId, ...common });
        return ctx.reference || ctx.bookingId;
      case "registration":
        await registrationsApi.verifyPayment({ order_reference: ctx.orderReference, ...common });
        return ctx.orderReference;
      case "vip":
        await userVipApi.verifyPayment({ booking_reference: ctx.bookingReference, ...common });
        return ctx.bookingReference;
      case "competition":
        await competeApi.verifyPayment(ctx.competitionId, { order_reference: ctx.orderReference, ...common });
        return ctx.orderReference;
      case "merch":
        await shopApi.verifyPayment({ order_number: ctx.orderNumber, ...common });
        return ctx.orderNumber;
    }
  };

  const sheet = (
    <RazorpayCheckout
      visible={!!pay}
      options={pay?.options || null}
      onSuccess={async (r) => {
        const ctx = pay?.context;
        setPay(null);
        if (!ctx) return;
        setVerifying(true);
        try {
          const ref = await verify(r, ctx);
          onDone?.(ref);
        } catch (e) {
          setError(
            e instanceof ApiError
              ? e.message
              : "Payment went through but we could not confirm it. Contact support with your payment id."
          );
        } finally {
          setVerifying(false);
        }
      }}
      onFailure={(m) => { setPay(null); setError(m); }}
      onDismiss={() => { setPay(null); setCancelled(true); }}
    />
  );

  return { start, sheet, open: !!pay, verifying, error, cancelled, clear: () => { setError(null); setCancelled(false); } };
}
