import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, FadeInRight, FadeOutLeft, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { ArrowLeft, ArrowRight, Banknote, Check, CreditCard, ShieldCheck, Trophy, Users, X, AlertCircle } from "lucide-react-native";
import { Txt, Button } from "@/components/ui";
import { formatINR, titleCase } from "@/lib/format";

/* ──────────────────────────────────────────────────────────────────────────
   Entering a competition, one decision per screen:

     1 Category   the divisions, with their age band and fee
     2 Rules      what you agree to (the competition's own rules + eligibility)
     3 Payment    online (Razorpay) or Cash on Spot — skipped when it's free
     4 Review     everything on one card, then register / pay

   The parent owns the state and the actual registration call; this is the
   walk-through. Errors from the call show inline (a Modal sits above toasts).
   ────────────────────────────────────────────────────────────────────────── */

export type EntryCategory = {
  name: string;
  fee: number;
  ageLabel?: string | null;
  description?: string | null;
  /** From the member's DOB (profile): open age · fits · outside the band · no DOB. */
  fit?: "open" | "ok" | "no" | "unknown";
};

type Step = "category" | "rules" | "payment" | "review";
const EASE = Easing.out(Easing.cubic);

export function EntryFlow({
  visible,
  onClose,
  title,
  accent,
  userAge,
  categories,
  baseFee = 0,
  category,
  onCategory,
  rulesText,
  eligibility,
  accepted,
  onAccepted,
  payMode,
  onPayMode,
  busy,
  error,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  accent: string;
  /** The member's age from their profile DOB (null if not set). */
  userAge?: number | null;
  categories: EntryCategory[];
  /** Fee when the competition has no categories. */
  baseFee?: number;
  category: string;
  onCategory: (c: string) => void;
  rulesText?: string | null;
  eligibility?: string | null;
  accepted: boolean;
  onAccepted: (v: boolean) => void;
  payMode: "ONLINE" | "CASH";
  onPayMode: (m: "ONLINE" | "CASH") => void;
  busy: boolean;
  error?: string | null;
  onSubmit: () => void;
}) {
  const insets = useSafeAreaInsets();
  const cat = categories.find((c) => c.name === category) || categories[0];
  const fee = cat ? cat.fee : baseFee;

  const steps = useMemo<Step[]>(() => {
    const s: Step[] = [];
    if (categories.length > 1) s.push("category");
    s.push("rules");
    if (fee > 0) s.push("payment");
    s.push("review");
    return s;
  }, [categories.length, fee]);

  const [i, setI] = useState(0);
  const step = steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;

  const canNext = step === "rules" ? accepted : step === "category" ? !!cat && cat.fit !== "no" : true;
  const next = () => {
    if (!canNext) return;
    Haptics.selectionAsync().catch(() => {});
    if (last) onSubmit();
    else setI((v) => v + 1);
  };
  const back = () => (i === 0 ? onClose() : setI((v) => v - 1));

  const cta = !last
    ? "Continue"
    : fee <= 0
      ? "Register for free"
      : payMode === "CASH"
        ? "Reserve my spot"
        : `Pay ${formatINR(fee)}`;

  const heading: Record<Step, { t: string; s: string }> = {
    category: {
      t: "Pick your category",
      s: userAge != null ? `Based on your profile you're ${userAge} — pick a category you're eligible for.` : "Compete with others in your age group.",
    },
    rules: { t: "The ground rules", s: "Read them once — then you're good to go." },
    payment: { t: "How you'll pay", s: `Entry fee for ${titleCase(cat?.name || "this category")}: ${formatINR(fee)}` },
    review: { t: "Ready to enter?", s: "Check the details, then confirm." },
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={back} onShow={() => setI(0)} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#08090C" }}>
        <StatusBar style="light" />

        {/* header: back · progress · close */}
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Pressable onPress={back} hitSlop={10} accessibilityLabel="Back" style={({ pressed }) => [s.round, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
              <ArrowLeft size={19} color="#fff" />
            </Pressable>
            <Txt size={12.5} font="sansSemi" style={{ color: "rgba(255,255,255,0.55)" }}>
              Step {i + 1} of {steps.length}
            </Txt>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" style={({ pressed }) => [s.round, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
              <X size={19} color="#fff" />
            </Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 16 }}>
            {steps.map((k, n) => (
              <Segment key={k} on={n <= i} color={accent} />
            ))}
          </View>
          <Txt size={12} font="sansSemi" numberOfLines={1} style={{ color: "rgba(255,255,255,0.5)", marginTop: 18 }}>{title}</Txt>
        </View>

        {/* the step */}
        <Animated.View key={step} entering={FadeInRight.duration(260).easing(EASE)} exiting={FadeOutLeft.duration(160)} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
            <Txt size={28} font="display" tracking={-0.8} lh={33} style={{ color: "#fff" }}>{heading[step].t}</Txt>
            <Txt size={14} lh={20} style={{ color: "rgba(255,255,255,0.6)", marginTop: 6, marginBottom: 22 }}>{heading[step].s}</Txt>

            {step === "category" ? (
              <View style={{ gap: 10 }}>
                {categories.map((c) => {
                  const on = c.name === cat?.name;
                  const blocked = c.fit === "no";
                  return (
                    <Pressable
                      key={c.name}
                      disabled={blocked}
                      onPress={() => { Haptics.selectionAsync().catch(() => {}); onCategory(c.name); }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on, disabled: blocked }}
                      style={({ pressed }) => [s.option, on && { borderColor: accent, backgroundColor: accent + "12" }, blocked && { opacity: 0.55 }, { transform: [{ scale: pressed ? 0.985 : 1 }] }]}
                    >
                      <View style={[s.disc, { backgroundColor: on ? accent : "rgba(255,255,255,0.07)" }]}>
                        <Users size={19} color={on ? "#0B0C10" : "#fff"} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt size={16} font="sansBold" style={{ color: "#fff" }}>{titleCase(c.name)}</Txt>
                        <Txt size={12.5} style={{ color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                          {[c.ageLabel, c.fee > 0 ? formatINR(c.fee) : "Free entry"].filter(Boolean).join("  ·  ")}
                        </Txt>
                        <FitChip fit={c.fit} age={userAge} />
                      </View>
                      <Radio on={on} color={accent} />
                    </Pressable>
                  );
                })}
              </View>
            ) : step === "rules" ? (
              <View style={{ gap: 12 }}>
                <View style={s.card}>
                  {eligibility ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
                      <ShieldCheck size={18} color={accent} />
                      <Txt size={14} font="sansSemi" style={{ color: "#fff", flex: 1 }}>{eligibility}</Txt>
                    </View>
                  ) : null}
                  {rulesText ? (
                    <Txt size={14} lh={22} style={{ color: "rgba(255,255,255,0.75)", textAlign: "justify" }}>{rulesText}</Txt>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {[
                        "Your entry must be your own original performance.",
                        "Register in the category that matches your age.",
                        "Judges' scores and audience votes decide the results.",
                        "Paid entry fees confirm your spot in the competition.",
                      ].map((r) => (
                        <View key={r} style={{ flexDirection: "row", gap: 10 }}>
                          <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: accent, marginTop: 8 }} />
                          <Txt size={14} lh={21} style={{ color: "rgba(255,255,255,0.75)", flex: 1 }}>{r}</Txt>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <Pressable
                  onPress={() => { Haptics.selectionAsync().catch(() => {}); onAccepted(!accepted); }}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: accepted }}
                  style={[s.option, accepted && { borderColor: accent, backgroundColor: accent + "12" }]}
                >
                  <View style={{ width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: accepted ? accent : "rgba(255,255,255,0.3)", backgroundColor: accepted ? accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                    {accepted ? <Check size={15} color="#0B0C10" strokeWidth={3} /> : null}
                  </View>
                  <Txt size={14} font="sansSemi" lh={20} style={{ color: "#fff", flex: 1 }}>I accept the rules and the eligibility criteria</Txt>
                </Pressable>
              </View>
            ) : step === "payment" ? (
              <View style={{ gap: 10 }}>
                <PayOption
                  on={payMode === "ONLINE"}
                  color={accent}
                  icon={<CreditCard size={20} color={payMode === "ONLINE" ? "#0B0C10" : "#fff"} />}
                  title="Pay online"
                  sub="UPI, cards, net banking · confirmed instantly"
                  onPress={() => onPayMode("ONLINE")}
                />
                <PayOption
                  on={payMode === "CASH"}
                  color={accent}
                  icon={<Banknote size={20} color={payMode === "CASH" ? "#0B0C10" : "#fff"} />}
                  title="Cash on Spot"
                  sub={`Pay ${formatINR(fee)} at the venue counter on event day`}
                  onPress={() => onPayMode("CASH")}
                />
                {payMode === "CASH" ? (
                  <Animated.View entering={FadeIn.duration(200)} style={[s.note, { borderColor: "rgba(245,184,61,0.35)", backgroundColor: "rgba(245,184,61,0.08)" }]}>
                    <Banknote size={15} color="#F5B83D" />
                    <Txt size={13} lh={18} style={{ color: "rgba(255,255,255,0.75)", flex: 1 }}>
                      Your spot is held now. Carry the exact fee and pay at the counter before you perform.
                    </Txt>
                  </Animated.View>
                ) : null}
              </View>
            ) : (
              <View style={s.card}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={[s.disc, { backgroundColor: accent }]}>
                    <Trophy size={19} color="#0B0C10" />
                  </View>
                  <Txt size={16} font="sansBold" numberOfLines={2} style={{ color: "#fff", flex: 1 }}>{title}</Txt>
                </View>
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 16 }} />
                <View style={{ gap: 14 }}>
                  {categories.length ? <Line k="Category" v={`${titleCase(cat?.name || "")}${cat?.ageLabel ? ` · ${cat.ageLabel}` : ""}`} /> : null}
                  <Line k="Rules" v="Accepted" good />
                  <Line k="Payment" v={fee <= 0 ? "No fee" : payMode === "CASH" ? "Cash on Spot" : "Online"} />
                </View>
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 16 }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Txt size={15} font="sansBold" style={{ color: "#fff" }}>{payMode === "CASH" && fee > 0 ? "Pay at venue" : "Entry fee"}</Txt>
                  <Txt size={22} font="sansBold" style={{ color: "#fff" }}>{fee > 0 ? formatINR(fee) : "Free"}</Txt>
                </View>
              </View>
            )}

            {error ? (
              <Animated.View entering={FadeIn.duration(200)} style={[s.note, { marginTop: 14, borderColor: "rgba(255,90,95,0.4)", backgroundColor: "rgba(255,90,95,0.08)" }]}>
                <AlertCircle size={16} color="#FF5A5F" />
                <Txt size={13} lh={18} style={{ color: "#FFB4B6", flex: 1 }}>{error}</Txt>
              </Animated.View>
            ) : null}
          </ScrollView>
        </Animated.View>

        {/* action */}
        <View style={[s.bar, { paddingBottom: insets.bottom + 14 }]}>
          <Button
            label={cta}
            full
            size="lg"
            loading={busy && last}
            disabled={!canNext || busy}
            onPress={next}
            iconRight={!last ? <ArrowRight size={17} color="#fff" /> : undefined}
            icon={last ? <Trophy size={17} color="#fff" /> : undefined}
          />
        </View>
      </View>
    </Modal>
  );
}

function Segment({ on, color }: { on: boolean; color: string }) {
  const p = useSharedValue(on ? 1 : 0);
  useEffect(() => {
    p.set(withTiming(on ? 1 : 0, { duration: 360, easing: EASE }));
  }, [on, p]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: p.value }] }));
  return (
    <View style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
      <Animated.View style={[{ height: "100%", width: "100%", backgroundColor: color, transformOrigin: "left center" }, fill]} />
    </View>
  );
}

function Radio({ on, color }: { on: boolean; color: string }) {
  return (
    <View style={{ width: 22, height: 22, borderRadius: 999, borderWidth: 2, borderColor: on ? color : "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" }}>
      {on ? <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: color }} /> : null}
    </View>
  );
}

function PayOption({ on, color, icon, title, sub, onPress }: { on: boolean; color: string; icon: React.ReactNode; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
      style={({ pressed }) => [s.option, on && { borderColor: color, backgroundColor: color + "12" }, { transform: [{ scale: pressed ? 0.985 : 1 }] }]}
    >
      <View style={[s.disc, { backgroundColor: on ? color : "rgba(255,255,255,0.07)" }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Txt size={16} font="sansBold" style={{ color: "#fff" }}>{title}</Txt>
        <Txt size={12.5} lh={17} style={{ color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{sub}</Txt>
      </View>
      <Radio on={on} color={color} />
    </Pressable>
  );
}

function Line({ k, v, good }: { k: string; v: string; good?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Txt size={13.5} style={{ color: "rgba(255,255,255,0.55)" }}>{k}</Txt>
      <Txt size={14} font="sansSemi" style={{ color: good ? "#3DD68C" : "#fff", flexShrink: 1, textAlign: "right" }}>{v}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  round: { width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.07)" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#111219",
  },
  disc: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  card: { padding: 18, borderRadius: 22, backgroundColor: "#111219", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  note: { flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 14, borderRadius: 16, borderWidth: 1 },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "rgba(8,9,12,0.97)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
});

/** "✓ Eligible" · "✕ Age 21" · "✓ Open age" — the website's age check, from the profile DOB. */
function FitChip({ fit, age }: { fit?: EntryCategory["fit"]; age?: number | null }) {
  if (!fit || fit === "unknown") return null;
  const t =
    fit === "ok"
      ? { text: "✓ Eligible", fg: "#3DD68C", bg: "rgba(61,214,140,0.12)", bd: "rgba(61,214,140,0.35)" }
      : fit === "open"
        ? { text: "✓ Open age", fg: "#7CB4FF", bg: "rgba(91,140,255,0.12)", bd: "rgba(91,140,255,0.35)" }
        : { text: `✕ Age ${age ?? ""}`.trim(), fg: "#FF7A7E", bg: "rgba(255,90,95,0.12)", bd: "rgba(255,90,95,0.35)" };
  return (
    <View style={{ alignSelf: "flex-start", marginTop: 8, paddingHorizontal: 9, height: 24, borderRadius: 8, justifyContent: "center", backgroundColor: t.bg, borderWidth: 1, borderColor: t.bd }}>
      <Txt size={11.5} font="sansBold" style={{ color: t.fg }}>{t.text}</Txt>
    </View>
  );
}
