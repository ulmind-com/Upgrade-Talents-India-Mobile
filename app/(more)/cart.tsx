import React, { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ShoppingCart, Minus, Plus, Trash2, Check, CheckCircle2 , Lock } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { useCart } from "@/context/Cart";
import { useSession } from "@/context/Session";
import { shopApi, ApiError } from "@/lib/api";
import { Txt, Card, Button, Field, Input, Divider, EmptyState } from "@/components/ui";
import { useAlert } from "@/components/Popup";
import { useCheckout } from "@/lib/useCheckout";
import { AppImage } from "@/components/AppImage";
import { formatINR } from "@/lib/format";

const FIELDS: { k: string; label: string; req?: boolean; kb?: any }[] = [
  { k: "full_name", label: "Full name", req: true },
  { k: "phone", label: "Phone", req: true, kb: "phone-pad" },
  { k: "address_line1", label: "Address line 1", req: true },
  { k: "address_line2", label: "Address line 2 (optional)" },
  { k: "city", label: "City", req: true },
  { k: "state", label: "State", req: true },
  { k: "postal_code", label: "Postal code", req: true, kb: "number-pad" },
];

export default function Cart() {
  const { c } = useTheme();
  const router = useRouter();
  const { user } = useSession();
  const { items, subtotal, setQty, remove, clear } = useCart();
  const [step, setStep] = useState<"cart" | "address" | "done">("cart");
  const [addr, setAddr] = useState<Record<string, string>>({});

  // Prefill shipping details from the signed-in profile so users don't retype.
  useEffect(() => {
    if (!user) return;
    const u: any = user;
    setAddr((cur) => ({
      full_name: cur.full_name || u.name || "",
      phone: cur.phone || String(u.phone_number ?? u.phone ?? ""),
      address_line1: cur.address_line1 || u.address_line1 || u.address || "",
      address_line2: cur.address_line2 || u.address_line2 || "",
      city: cur.city || u.city || "",
      state: cur.state || u.state || "",
      postal_code: cur.postal_code || String(u.postal_code ?? u.pincode ?? ""),
    }));
  }, [user]);
  const [busy, setBusy] = useState(false);
  const alert = useAlert();
  const setError = (m: string | null) => { if (m) alert("error", "Can't place order", m); };

  const checkout = useCheckout({
    onDone: () => { clear(); setBusy(false); setStep("done"); },
  });

  useEffect(() => {
    if (checkout.error) { setBusy(false); alert("error", "Payment problem", checkout.error); checkout.clear(); }
    else if (checkout.cancelled) { setBusy(false); alert("warning", "Payment cancelled", "Your cart is still here — checkout again to finish."); checkout.clear(); }
  }, [checkout.error, checkout.cancelled]);

  const placeOrder = async () => {
    const missing = FIELDS.filter((f) => f.req && !addr[f.k]?.trim());
    if (missing.length) { setError(`Please fill: ${missing.map((m) => m.label).join(", ")}`); return; }
    setError(null); setBusy(true);
    try {
      const order = await shopApi.createOrder({
        items: items.map((i) => ({ product_id: String(i.productId), variant_id: i.variantId ? String(i.variantId) : undefined, quantity: Number(i.qty) || 1 })),
        shipping_address: { ...addr, country: "India" },
      });

      // The merch endpoint returns `payment_details`, not `payment_info`.
      const pay = order?.payment_details;
      const orderNumber = order?.order_number || order?.order_reference;

      // Gateway not configured on the server — the order still stands.
      if (!pay || pay.status === "PENDING_CONFIGURATION" || !orderNumber) {
        clear();
        setStep("done");
        return;
      }

      const opened = checkout.start({
        paymentInfo: pay,
        amount: Number(order.total_amount ?? subtotal),
        description: pay.checkout_data?.description || `Merchandise order ${orderNumber}`,
        context: { kind: "merch", orderNumber: String(orderNumber) },
      });
      if (!opened.opened) { setError(opened.reason || "Could not open the payment sheet."); setBusy(false); }
      return;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not place the order. Try again.");
    } finally { setBusy(false); }
  };

  if (step === "done") {
    return (
      <SubScreen eyebrow="Order placed" title="Thank you!">
        <Card style={{ alignItems: "center", gap: 14, paddingVertical: 36, marginTop: 10 }}>
          <View style={{ width: 80, height: 80, borderRadius: 999, borderWidth: 3, borderColor: c.success, alignItems: "center", justifyContent: "center" }}>
            <CheckCircle2 size={44} color={c.success} />
          </View>
          <Txt size={19} font="sansBold" align="center">Your order is confirmed</Txt>
          <Txt size={14} tone="muted" align="center" style={{ maxWidth: 280 }}>We'll email you tracking details. Follow it live from My orders.</Txt>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
            <Button label="Track order" onPress={() => router.replace("/(more)/shop/orders")} />
            <Button label="Keep shopping" variant="outline" onPress={() => router.replace("/(more)/shop")} />
          </View>
        </Card>
      </SubScreen>
    );
  }

  return (
    <SubScreen eyebrow={step === "cart" ? "Your bag" : "Shipping details"} title={step === "cart" ? "Cart" : "Checkout"} onBack={step === "address" ? () => setStep("cart") : undefined}>

      {items.length === 0 ? (
        <EmptyState icon={<ShoppingCart size={26} color={c.fgMuted} />} title="Your cart is empty" subtitle="Add some merch to get started." />
      ) : step === "cart" ? (
        <>
          <View style={{ gap: 12 }}>
            {items.map((it) => (
              <Card key={it.key} padding={10} style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ width: 70, height: 70, borderRadius: 12, overflow: "hidden", backgroundColor: c.surface2 }}>
                  <AppImage uri={it.image} seed={it.key} style={{ width: "100%", height: "100%" }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt size={14} font="sansBold" numberOfLines={1}>{it.name}</Txt>
                  {(it.size || it.color) ? <Txt size={11.5} tone="subtle" style={{ marginTop: 1 }}>{[it.color, it.size].filter(Boolean).join(" · ")}</Txt> : null}
                  <Txt size={14} font="sansExt" tone="accent" style={{ marginTop: 3 }}>{formatINR(it.price * it.qty)}</Txt>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 }}>
                    <Pressable onPress={() => setQty(it.key, it.qty - 1)} style={{ width: 28, height: 28, borderRadius: 999, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}><Minus size={14} color={c.fg} /></Pressable>
                    <Txt size={14} font="sansBold">{it.qty}</Txt>
                    <Pressable onPress={() => setQty(it.key, it.qty + 1)} style={{ width: 28, height: 28, borderRadius: 999, borderWidth: 1, borderColor: c.border, alignItems: "center", justifyContent: "center" }}><Plus size={14} color={c.fg} /></Pressable>
                    <Pressable onPress={() => remove(it.key)} style={{ marginLeft: "auto" }}><Trash2 size={16} color={c.danger} /></Pressable>
                  </View>
                </View>
              </Card>
            ))}
          </View>

          <Card style={{ marginTop: 16, gap: 10 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Txt size={14} tone="muted">Subtotal</Txt>
              <Txt size={15} font="sansBold">{formatINR(subtotal)}</Txt>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Txt size={14} tone="muted">Shipping</Txt>
              <Txt size={14} font="sansSemi" tone={subtotal >= 999 ? "success" : "fg"}>{subtotal >= 999 ? "Free" : "Calculated at checkout"}</Txt>
            </View>
            <Divider />
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Txt size={15} font="sansBold">Total</Txt>
              <Txt size={20} font="display" tone="accent">{formatINR(subtotal)}</Txt>
            </View>
          </Card>

          <View style={{ marginTop: 16 }}>
            <Button label={user ? "Checkout" : "Sign in to checkout"} full size="lg" onPress={() => (user ? setStep("address") : router.push("/(auth)/login"))} />
          </View>
        </>
      ) : (
        <>
          <View style={{ gap: 14 }}>
            {FIELDS.map((f) => (
              <Field key={f.k} label={f.label} required={f.req}>
                <Input value={addr[f.k] || ""} onChangeText={(v) => setAddr((s) => ({ ...s, [f.k]: v }))} keyboardType={f.kb} />
              </Field>
            ))}
          </View>
          <Card style={{ marginTop: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Txt size={15} font="sansBold">Total</Txt>
            <Txt size={20} font="display" tone="accent">{formatINR(subtotal)}</Txt>
          </Card>
          <View style={{ marginTop: 16 }}>
            <Button label={`Pay with Razorpay · ${formatINR(subtotal)}`} full size="lg" loading={busy || checkout.verifying} onPress={placeOrder} icon={<Lock size={17} color={c.onAccent} />} />
          </View>
        </>
      )}
      {checkout.sheet}
    </SubScreen>
  );
}
