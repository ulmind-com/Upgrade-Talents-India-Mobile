import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import {
  Package, Check, Truck, MapPin, XCircle, Copy, ShoppingBag, CreditCard,
} from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { shopApi, safe, toRows } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAlert } from "@/components/Popup";
import { Txt, Card, Badge, Skeleton, EmptyState, Button, Field, Input } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { FadeInUp } from "@/components/FadeInUp";
import { formatINR, formatDateTime, titleCase } from "@/lib/format";

/* The website's fulfilment ladder, step for step. */
const STEPS = [
  { key: "CONFIRMED", label: "Order Confirmed", desc: "Payment verified, order received" },
  { key: "PROCESSING", label: "Processing", desc: "Order details sent to fulfillment team" },
  { key: "PACKED", label: "Packed", desc: "Items packed and ready for dispatch" },
  { key: "SHIPPED", label: "Shipped", desc: "Handed over to courier partner" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery", desc: "Package out with delivery agent" },
  { key: "DELIVERED", label: "Delivered", desc: "Order successfully delivered" },
];

const CANCELLABLE = ["PENDING_PAYMENT", "CONFIRMED", "PROCESSING"];

export default function OrderDetail() {
  const { c } = useTheme();
  const alert = useAlert();
  const p = useLocalSearchParams<{ id: string }>();
  const id = String(p.id);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const q = useAsync(() => safe(shopApi.order(id), null as any), [id], { refetchOnFocus: true });
  const t = useAsync(() => safe(shopApi.orderTracking(id), null as any), [id]);

  const order = q.data || {};
  const tracking = t.data || {};
  const status = String(order.status || order.order_status || "").toUpperCase();
  const cancelled = ["CANCELLED", "REFUNDED", "REFUND_PENDING"].includes(status);
  const canCancel = !cancelled && CANCELLABLE.includes(status);
  const trackingNo = order.tracking_number || tracking.tracking_number;
  const items = toRows(order.items || order.line_items || []);

  // How far down the ladder we are; -1 while still awaiting payment.
  const reached = STEPS.findIndex((s) => s.key === status);
  const stepIndex = cancelled ? -1 : reached;

  const cancel = async () => {
    if (!reason.trim()) return alert("warning", "Reason needed", "Tell us why you're cancelling.");
    setBusy(true);
    try {
      await shopApi.cancelOrder(id, reason.trim());
      alert("success", "Order cancelled", "Any payment will be refunded per policy.");
      setCancelOpen(false); setReason("");
      q.reload(); t.reload();
    } catch (e: any) {
      alert("error", "Couldn't cancel", e?.message || "This order can no longer be cancelled.");
    } finally { setBusy(false); }
  };

  const copyTracking = async () => {
    if (!trackingNo) return;
    await Clipboard.setStringAsync(String(trackingNo));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    alert("success", "Copied", "Tracking number copied.");
  };

  return (
    <SubScreen eyebrow="Order" title={order.order_reference || "Order"} refreshing={q.refreshing} onRefresh={() => { q.refresh(); t.reload(); }}>
      {q.loading ? (
        <View style={{ gap: 14 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={110} radius={20} />)}</View>
      ) : !q.data ? (
        <EmptyState icon={<ShoppingBag size={26} color={c.fgMuted} />} title="Order not found" subtitle="It may have been removed." />
      ) : (
        <>
          {/* status header */}
          <FadeInUp>
            <Card style={{ gap: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Txt size={11} font="monoMed" tone="subtle" tracking={1.5} uppercase>Status</Txt>
                  <Txt size={19} font="sansExt" style={{ marginTop: 3 }}>{titleCase(status.replace(/_/g, " ")) || "Pending"}</Txt>
                </View>
                <Badge
                  label={cancelled ? "Cancelled" : order.payment_status === "PAID" ? "Paid" : "Payment pending"}
                  tone={cancelled ? "danger" : order.payment_status === "PAID" ? "success" : "warning"}
                />
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
                <Cell label="Total" value={formatINR(order.total_amount ?? order.amount ?? 0)} />
                <Cell label="Placed" value={formatDateTime(order.created_at)} />
                {order.expected_delivery ? <Cell label="Expected" value={formatDateTime(order.expected_delivery)} /> : null}
              </View>

              {trackingNo ? (
                <Pressable onPress={copyTracking}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.bgElevated, borderRadius: 14, borderWidth: 1, borderColor: c.border, padding: 13 }}>
                    <Truck size={17} color={c.accent} />
                    <View style={{ flex: 1 }}>
                      <Txt size={10.5} font="monoMed" tone="subtle" tracking={1.5} uppercase>Tracking number</Txt>
                      <Txt size={14} font="mono" style={{ marginTop: 2 }}>{trackingNo}</Txt>
                      {order.courier_name || tracking.courier_name ? (
                        <Txt size={11.5} tone="muted" style={{ marginTop: 1 }}>{order.courier_name || tracking.courier_name}</Txt>
                      ) : null}
                    </View>
                    <Copy size={16} color={c.fgMuted} />
                  </View>
                </Pressable>
              ) : null}
            </Card>
          </FadeInUp>

          {/* the ladder */}
          <FadeInUp delay={60}>
            <Txt size={11} font="monoMed" tone="subtle" tracking={2.5} uppercase style={{ marginTop: 20, marginBottom: 12 }}>Progress</Txt>
            {cancelled ? (
              <Card style={{ flexDirection: "row", alignItems: "center", gap: 12, borderColor: c.danger + "55" }}>
                <XCircle size={22} color={c.danger} />
                <View style={{ flex: 1 }}>
                  <Txt size={15} font="sansBold" tone="danger">Order {titleCase(status.replace(/_/g, " "))}</Txt>
                  {order.cancellation_reason ? <Txt size={12.5} tone="muted" style={{ marginTop: 2 }}>{order.cancellation_reason}</Txt> : null}
                </View>
              </Card>
            ) : (
              <Card padding={16}>
                {STEPS.map((s, i) => {
                  const done = stepIndex >= i;
                  const current = stepIndex === i;
                  return (
                    <View key={s.key} style={{ flexDirection: "row", gap: 13 }}>
                      {/* rail */}
                      <View style={{ alignItems: "center", width: 26 }}>
                        <View style={{ width: 26, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: done ? c.success : c.surface2, borderWidth: current ? 2 : 0, borderColor: c.success }}>
                          {done ? <Check size={14} color="#fff" strokeWidth={3} /> : <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: c.fgSubtle }} />}
                        </View>
                        {i < STEPS.length - 1 ? (
                          <View style={{ width: 2, flex: 1, minHeight: 26, backgroundColor: stepIndex > i ? c.success : c.border, marginVertical: 2 }} />
                        ) : null}
                      </View>

                      <View style={{ flex: 1, paddingBottom: i < STEPS.length - 1 ? 16 : 0 }}>
                        <Txt size={14} font={done ? "sansBold" : "sansMed"} tone={done ? "fg" : "subtle"}>{s.label}</Txt>
                        <Txt size={12} tone="muted" lh={17} style={{ marginTop: 2 }}>{s.desc}</Txt>
                      </View>
                    </View>
                  );
                })}
              </Card>
            )}
          </FadeInUp>

          {/* items */}
          {items.length ? (
            <FadeInUp delay={110}>
              <Txt size={11} font="monoMed" tone="subtle" tracking={2.5} uppercase style={{ marginTop: 20, marginBottom: 12 }}>Items</Txt>
              <Card padding={0}>
                {items.map((it: any, i: number) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                    <View style={{ width: 52, height: 52, borderRadius: 12, overflow: "hidden", backgroundColor: c.surface2 }}>
                      <AppImage uri={it.image_url || it.thumbnail} seed={it.product_id || i} style={{ width: "100%", height: "100%" }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt size={14} font="sansSemi" numberOfLines={1}>{it.product_name || it.name || "Item"}</Txt>
                      <Txt size={12} tone="muted" style={{ marginTop: 2 }}>
                        Qty {it.quantity ?? 1}{it.variant_name ? ` · ${it.variant_name}` : ""}
                      </Txt>
                    </View>
                    <Txt size={14} font="sansBold">{formatINR(it.price ?? it.unit_price ?? 0)}</Txt>
                  </View>
                ))}
              </Card>
            </FadeInUp>
          ) : null}

          {/* shipping address */}
          {order.shipping_address ? (
            <FadeInUp delay={150}>
              <Txt size={11} font="monoMed" tone="subtle" tracking={2.5} uppercase style={{ marginTop: 20, marginBottom: 12 }}>Delivering to</Txt>
              <Card style={{ flexDirection: "row", gap: 11 }}>
                <MapPin size={17} color={c.accent} />
                <Txt size={13.5} lh={20} style={{ flex: 1 }}>
                  {[order.shipping_address.full_name, order.shipping_address.address_line1, order.shipping_address.address_line2, order.shipping_address.city, order.shipping_address.state, order.shipping_address.pincode]
                    .filter(Boolean).join(", ")}
                </Txt>
              </Card>
            </FadeInUp>
          ) : null}

          {/* cancel */}
          {canCancel ? (
            <FadeInUp delay={190}>
              <View style={{ marginTop: 22 }}>
                {cancelOpen ? (
                  <Card style={{ gap: 4 }}>
                    <Txt size={15} font="sansBold">Cancel this order</Txt>
                    <Field label="Reason" required>
                      <Input value={reason} onChangeText={setReason} placeholder="Why are you cancelling?" multiline style={{ minHeight: 80, textAlignVertical: "top", paddingTop: 12 }} />
                    </Field>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}><Button label="Confirm cancel" full loading={busy} onPress={cancel} icon={<XCircle size={16} color={c.onAccent} />} /></View>
                      <Button label="Keep" variant="outline" onPress={() => setCancelOpen(false)} />
                    </View>
                  </Card>
                ) : (
                  <Button label="Cancel order" full variant="outline" onPress={() => setCancelOpen(true)} icon={<XCircle size={17} color={c.danger} />} />
                )}
              </View>
            </FadeInUp>
          ) : null}
        </>
      )}
    </SubScreen>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Txt size={10} font="monoMed" tone="subtle" tracking={1.5} uppercase>{label}</Txt>
      <Txt size={13.5} font="sansSemi" style={{ marginTop: 1 }}>{value}</Txt>
    </View>
  );
}
