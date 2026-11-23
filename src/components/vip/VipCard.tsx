import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, Check, CalendarRange, DoorOpen } from "lucide-react-native";
import { Txt } from "@/components/ui";
import type { VipConfig } from "@/lib/api";
import { areaLabel, configState, entryPolicyLabel, money, VIP_GOLD, MUTED, BAD } from "@/lib/vip";
import { formatEventDate } from "@/lib/format";

const SURFACE = "#11131A";
const HAIR = "rgba(255,255,255,0.08)";

/**
 * One VIP tier, styled as a ticket: what it costs, where it gets you in,
 * when it's valid, and how many are left — every number off the live config.
 */
export function VipCard({ cfg, onBook, compact }: { cfg: VipConfig; onBook: () => void; compact?: boolean }) {
  const st = configState(cfg);
  const areas = cfg.access_areas || [];
  const valid =
    cfg.validity_start && cfg.validity_end
      ? `${formatEventDate(cfg.validity_start)} – ${formatEventDate(cfg.validity_end)}`
      : cfg.validity_start
      ? `From ${formatEventDate(cfg.validity_start)}`
      : null;
  const pct = st.total ? Math.min(100, Math.round(((st.total - (st.left ?? st.total)) / st.total) * 100)) : null;
  const scarce = st.left != null && st.total != null && st.left > 0 && st.left <= Math.max(3, st.total * 0.15);

  return (
    <View style={[s.card, !st.open && { opacity: 0.72 }]}>
      {/* head: tier + price */}
      <LinearGradient colors={["rgba(245,197,66,0.14)", "rgba(245,197,66,0.02)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.head}>
        <View style={s.crown}>
          <Crown size={16} color={VIP_GOLD} />
        </View>
        <View style={{ flex: 1 }}>
          {cfg.category ? (
            <Txt size={10.5} font="sansExt" tracking={1.4} style={{ color: VIP_GOLD }}>
              {String(cfg.category).toUpperCase()}
            </Txt>
          ) : null}
          <Txt size={17} font="sansBold" lh={22} numberOfLines={2} style={{ color: "#fff", marginTop: 2 }}>
            {cfg.name}
          </Txt>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Txt size={20} font="display" style={{ color: "#fff" }}>{money(cfg.price, cfg.currency)}</Txt>
          <Txt size={10.5} style={{ color: MUTED }}>per pass</Txt>
        </View>
      </LinearGradient>

      {/* perforation */}
      <View style={s.perf}>
        <View style={[s.notch, { left: -9 }]} />
        <View style={s.dash} />
        <View style={[s.notch, { right: -9 }]} />
      </View>

      <View style={s.body}>
        {cfg.description && !compact ? (
          <Txt size={13} lh={19} numberOfLines={3} style={{ color: "#C5CAD6", marginBottom: 12 }}>{cfg.description}</Txt>
        ) : null}

        {areas.length ? (
          <View style={s.areas}>
            {areas.slice(0, compact ? 3 : 8).map((a) => (
              <View key={a} style={s.area}>
                <Check size={11} color={VIP_GOLD} strokeWidth={3} />
                <Txt size={11.5} font="sansSemi" style={{ color: "#E2E8F0" }}>{areaLabel(a)}</Txt>
              </View>
            ))}
            {compact && areas.length > 3 ? <Txt size={11.5} style={{ color: MUTED, alignSelf: "center" }}>+{areas.length - 3} more</Txt> : null}
          </View>
        ) : null}

        {!compact ? (
          <View style={{ gap: 6, marginTop: 12 }}>
            {valid ? (
              <View style={s.meta}>
                <CalendarRange size={13} color={MUTED} />
                <Txt size={12} style={{ color: MUTED }}>Valid {valid}</Txt>
              </View>
            ) : null}
            <View style={s.meta}>
              <DoorOpen size={13} color={MUTED} />
              <Txt size={12} style={{ color: MUTED }}>
                {entryPolicyLabel(cfg.entry_policy, cfg.max_entries, cfg.reentry_cooldown_minutes)}
                {cfg.max_passes_per_user ? `  ·  max ${cfg.max_passes_per_user} per person` : ""}
              </Txt>
            </View>
          </View>
        ) : null}

        {/* live availability */}
        {pct != null ? (
          <View style={{ marginTop: 14 }}>
            <View style={s.bar}>
              <View style={[s.fill, { width: `${pct}%`, backgroundColor: st.soldOut ? BAD : VIP_GOLD }]} />
            </View>
            <Txt size={11.5} font="sansSemi" style={{ color: st.soldOut ? BAD : scarce ? VIP_GOLD : MUTED, marginTop: 6 }}>
              {st.soldOut ? "Sold out" : `${st.left} of ${st.total} left${scarce ? " — going fast" : ""}`}
            </Txt>
          </View>
        ) : null}

        <Pressable
          onPress={onBook}
          disabled={!st.open}
          accessibilityRole="button"
          accessibilityLabel={st.open ? `Book ${cfg.name}` : st.label || "Unavailable"}
          style={({ pressed }) => [s.cta, !st.open && s.ctaOff, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Txt size={14} font="sansBold" style={{ color: st.open ? "#0B0B0E" : MUTED }}>
            {st.open ? `Book · ${money(cfg.price, cfg.currency)}` : st.label || "Unavailable"}
          </Txt>
        </Pressable>
      </View>
    </View>
  );
}

/** A small status pill. */
export function Chip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[s.chip, { backgroundColor: color + "1F" }]}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Txt size={11} font="sansBold" style={{ color }}>{label}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 5, height: 22, paddingHorizontal: 8, borderRadius: 999, alignSelf: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: 999 },
  card: { borderRadius: 22, backgroundColor: SURFACE, borderWidth: 1, borderColor: "rgba(245,197,66,0.22)", overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  crown: { width: 36, height: 36, borderRadius: 12, backgroundColor: "rgba(245,197,66,0.14)", alignItems: "center", justifyContent: "center" },
  perf: { height: 18, justifyContent: "center" },
  notch: { position: "absolute", width: 18, height: 18, borderRadius: 999, backgroundColor: "#08090C", borderWidth: 1, borderColor: "rgba(245,197,66,0.22)" },
  dash: { marginHorizontal: 16, borderTopWidth: 1, borderStyle: "dashed", borderColor: HAIR },
  body: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
  areas: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  area: { flexDirection: "row", alignItems: "center", gap: 5, height: 26, paddingHorizontal: 9, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)" },
  meta: { flexDirection: "row", alignItems: "center", gap: 7 },
  bar: { height: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999 },
  cta: { marginTop: 16, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: VIP_GOLD },
  ctaOff: { backgroundColor: "rgba(255,255,255,0.06)" },
});
