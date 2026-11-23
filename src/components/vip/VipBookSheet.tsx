import React, { useEffect, useState } from "react";
import { View, Modal, Pressable, TextInput, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Minus, Plus, Crown, ShieldCheck, Clock } from "lucide-react-native";
import { Txt } from "@/components/ui";
import { useSession } from "@/context/Session";
import type { VipConfig } from "@/lib/api";
import { configState, money, useVipCheckout, VIP_GOLD, MUTED, BAD, type VipResult } from "@/lib/vip";

const ACCENT = "#FF385C";

/**
 * Book a VIP tier: how many, who each pass is for, the total, then pay.
 * Capacity is reserved the moment you tap pay, and held while you finish.
 */
export function VipBookSheet({
  cfg,
  onClose,
  onConfirmed,
}: {
  cfg: VipConfig | null;
  onClose: () => void;
  onConfirmed: (r: VipResult) => void;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const [qty, setQty] = useState(1);
  const [names, setNames] = useState<string[]>([""]);
  const co = useVipCheckout({
    onConfirmed: (r) => {
      onClose();
      onConfirmed(r);
    },
  });

  // fresh sheet per tier — the first pass defaults to the member
  useEffect(() => {
    if (!cfg) return;
    setQty(1);
    setNames([user?.name || ""]);
    co.clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg ? cfg._id || cfg.id : null]);

  useEffect(() => {
    setNames((n) => Array.from({ length: qty }, (_, i) => n[i] ?? ""));
  }, [qty]);

  if (!cfg) return co.sheet;
  const st = configState(cfg);
  const total = Number(cfg.price || 0) * qty;
  const namesOk = names.every((n) => n.trim().length >= 2);

  const pay = () => {
    if (!namesOk || co.busy) return;
    co.start(cfg, { quantity: qty, holder_names: names.map((n) => n.trim()) });
  };

  return (
    <>
      {/* steps aside while the gateway is open — iOS shows one modal at a time */}
      <Modal visible={co.phase !== "paying"} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={s.backdrop}>
            <Pressable style={{ flex: 1 }} onPress={co.busy ? undefined : onClose} />
            <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <View style={s.handle} />
              <View style={s.head}>
                <View style={s.crown}>
                  <Crown size={18} color={VIP_GOLD} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt size={18} font="sansBold" numberOfLines={2} style={{ color: "#fff" }}>{cfg.name}</Txt>
                  <Txt size={12.5} numberOfLines={1} style={{ color: MUTED, marginTop: 2 }}>
                    {cfg.event_title || "VIP pass"} · {money(cfg.price, cfg.currency)} each
                  </Txt>
                </View>
                <Pressable onPress={onClose} disabled={co.busy} hitSlop={8} style={s.close}>
                  <X size={16} color="#fff" />
                </Pressable>
              </View>

              <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {/* how many */}
                <View style={s.row}>
                  <View style={{ flex: 1 }}>
                    <Txt size={14} font="sansSemi" style={{ color: "#fff" }}>Passes</Txt>
                    <Txt size={11.5} style={{ color: MUTED, marginTop: 2 }}>
                      Up to {st.maxQty}
                      {st.left != null ? ` · ${st.left} left` : ""}
                    </Txt>
                  </View>
                  <View style={s.stepper}>
                    <Pressable onPress={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1 || co.busy} style={[s.step, qty <= 1 && { opacity: 0.35 }]}>
                      <Minus size={16} color="#fff" />
                    </Pressable>
                    <Txt size={17} font="sansExt" style={{ color: "#fff", minWidth: 28, textAlign: "center" }}>{qty}</Txt>
                    <Pressable onPress={() => setQty((q) => Math.min(st.maxQty, q + 1))} disabled={qty >= st.maxQty || co.busy} style={[s.step, qty >= st.maxQty && { opacity: 0.35 }]}>
                      <Plus size={16} color="#fff" />
                    </Pressable>
                  </View>
                </View>

                {/* who each pass is for — printed on the pass, checked at the gate */}
                <Txt size={11} font="sansBold" tracking={1.4} style={{ color: MUTED, marginTop: 20, marginBottom: 8 }}>
                  NAME ON EACH PASS
                </Txt>
                <View style={{ gap: 8 }}>
                  {names.map((n, i) => (
                    <TextInput
                      key={i}
                      value={n}
                      onChangeText={(t) => setNames((arr) => arr.map((x, j) => (j === i ? t : x)))}
                      placeholder={`Pass ${i + 1} — full name`}
                      placeholderTextColor="#6B7186"
                      editable={!co.busy}
                      autoCapitalize="words"
                      style={[s.input, n.length > 0 && n.trim().length < 2 && { borderColor: BAD }]}
                    />
                  ))}
                </View>

                <View style={s.notes}>
                  {cfg.reservation_expiry_minutes ? (
                    <View style={s.note}>
                      <Clock size={14} color={MUTED} />
                      <Txt size={12} lh={17} style={{ color: MUTED, flex: 1 }}>
                        Your passes are held for {cfg.reservation_expiry_minutes} minutes while you pay.
                      </Txt>
                    </View>
                  ) : null}
                  {cfg.cancellation_policy ? (
                    <View style={s.note}>
                      <ShieldCheck size={14} color={MUTED} />
                      <Txt size={12} lh={17} style={{ color: MUTED, flex: 1 }}>{cfg.cancellation_policy}</Txt>
                    </View>
                  ) : null}
                </View>

                {co.error ? (
                  <View style={s.error}>
                    <Txt size={12.5} lh={18} style={{ color: "#FFB3C0" }}>{co.error}</Txt>
                  </View>
                ) : null}
              </ScrollView>

              {/* total + pay */}
              <View style={s.footer}>
                <View style={{ flex: 1 }}>
                  <Txt size={11.5} style={{ color: MUTED }}>{qty} × {money(cfg.price, cfg.currency)}</Txt>
                  <Txt size={20} font="display" style={{ color: "#fff" }}>{money(total, cfg.currency)}</Txt>
                </View>
                <Pressable
                  onPress={pay}
                  disabled={!namesOk || co.busy || !st.open}
                  style={({ pressed }) => [s.pay, (!namesOk || !st.open) && { opacity: 0.45 }, { opacity: pressed ? 0.85 : undefined }]}
                >
                  {co.busy ? <ActivityIndicator color="#fff" /> : null}
                  <Txt size={15} font="sansBold" style={{ color: "#fff" }}>
                    {co.phase === "booking" ? "Reserving…" : co.phase === "verifying" ? "Confirming…" : co.phase === "paying" ? "Paying…" : "Pay now"}
                  </Txt>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {co.sheet}
    </>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#111319",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  crown: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(245,197,66,0.14)", alignItems: "center", justifyContent: "center" },
  close: { width: 34, height: 34, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8, padding: 4, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  step: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" },
  input: {
    height: 48,
    borderRadius: 14,
    paddingHorizontal: 14,
    color: "#fff",
    fontSize: 14.5,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  notes: { gap: 8, marginTop: 16 },
  note: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  error: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: "rgba(255,56,92,0.1)", borderWidth: 1, borderColor: "rgba(255,56,92,0.3)" },
  footer: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" },
  pay: { flexDirection: "row", alignItems: "center", gap: 8, height: 52, paddingHorizontal: 24, borderRadius: 16, backgroundColor: ACCENT },
});
