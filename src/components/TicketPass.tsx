import React, { useEffect, useRef } from "react";
import { View, Pressable, Dimensions, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import QRCode from "react-native-qrcode-svg";
import { CheckCircle2, ChevronRight, Ban, CalendarX } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { formatINR, formatEventDate, isEventExpired, endedAgo } from "@/lib/format";
import type { MyTicket } from "@/lib/api";

export type TicketWay = {
  grad: [string, string];
  stub: [string, string];
  /** Text on the stub — dark on the bright metallic stubs, white elsewhere. */
  ink?: string;
};

/* Tier colourways — a pass looks like what it is. Platinum is the dark
   gunmetal card with a bright platinum stub, gold is gold, silver is
   silver, bronze is copper, free entry is emerald. Same tier, same look,
   on the pass, the ticket screen and the PDF. */
const TIERS: { match: RegExp; way: TicketWay }[] = [
  { match: /plat|vip|diamond|royal/i, way: { grad: ["#4B5466", "#1B1F28"], stub: ["#F1F3F7", "#A5AEBD"], ink: "#1B1F28" } },
  { match: /gold|exec|premier/i, way: { grad: ["#C9961F", "#6E4A0B"], stub: ["#FCE08A", "#D4A42A"], ink: "#3D2905" } },
  { match: /silver|standard|mezz/i, way: { grad: ["#9BA4B1", "#47505E"], stub: ["#F3F5F8", "#B9C1CC"], ink: "#2B323D" } },
  { match: /bronze/i, way: { grad: ["#B36B36", "#5E3214"], stub: ["#F0B27A", "#B9733C"], ink: "#3A1D08" } },
  { match: /free/i, way: { grad: ["#059669", "#0f766e"], stub: ["#34d399", "#0f766e"] } },
];

/** The pass colours for a ticket type; other tiers keep a stable colourway per ticket. */
export const tierWay = (type: string | undefined | null, seed: string): TicketWay =>
  TIERS.find((t) => t.match.test(String(type || "")))?.way || ticketWay(seed);

/* Colourways for tiers without a metal (General etc.), picked deterministically per ticket. */
const WAYS: TicketWay[] = [
  { grad: ["#d91a7a", "#a21caf"], stub: ["#f0407e", "#a21caf"] }, // magenta
  { grad: ["#0284c7", "#1d4ed8"], stub: ["#38bdf8", "#1d4ed8"] }, // blue
  { grad: ["#059669", "#0f766e"], stub: ["#34d399", "#0f766e"] }, // emerald
  { grad: ["#f59e0b", "#ea580c"], stub: ["#fbbf24", "#ea580c"] }, // amber
  { grad: ["#8b5cf6", "#6d28d9"], stub: ["#a78bfa", "#6d28d9"] }, // violet
];
export const ticketWay = (seed: string) => WAYS[Math.abs([...String(seed)].reduce((a, ch) => a + ch.charCodeAt(0), 0)) % WAYS.length];

const W = Dimensions.get("window").width - 40;
const STUB = 104;
const H = 168;

/**
 * A clean District status pill for expired tickets.
 */
export function ExpiredStamp({
  label = "EXPIRED", size = 13, color = "#ff7a7a", delay = 260, style,
}: {
  label?: string; size?: number; color?: string; delay?: number; style?: any;
}) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          backgroundColor: "rgba(0,0,0,0.7)",
          borderWidth: 1,
          borderColor: color + "66",
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 6,
        },
        style,
      ]}
    >
      <Txt size={size} font="sansBold" tracking={1.5} style={{ color }}>{label}</Txt>
    </View>
  );
}

export function TicketPass({
  ticket, eventTitle, eventDate, venue, price, cover, onPress,
}: {
  ticket: MyTicket; eventTitle?: string; eventDate?: string; venue?: string; price?: number | null; cover?: string | null; onPress?: () => void;
}) {
  const { c } = useTheme();
  const way = tierWay(ticket.ticket_type, ticket.ticket_ref || ticket.event_id || "x");
  const ink = way.ink || "rgba(255,255,255,0.95)";
  const used = ticket.is_checked_in;
  /* A pass dies with its event, whatever the backend still calls it. `used`
     is the more useful truth, so a scanned pass keeps saying USED. */
  const date = eventDate ?? ticket.event_date;
  const expired = !used && isEventExpired(date, ticket.event_time);
  const ended = expired ? endedAgo(date, ticket.event_time) : null;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }], opacity: used ? 0.92 : 1 })}>
      <View style={{ width: W, height: H, borderRadius: 22, overflow: "hidden", flexDirection: "row", shadowColor: expired ? "#000" : way.grad[1], shadowOpacity: expired ? 0.25 : 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 10 }, elevation: 9 }}>
        {/* ── Main ── */}
        <View style={{ flex: 1 }}>
          <LinearGradient colors={way.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
            <AppImage uri={cover || ticket.event_cover} seed={ticket.event_id || ticket.ticket_ref} style={{ position: "absolute", width: "100%", height: "100%", opacity: 0.38 }} />
            <LinearGradient colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.55)"] as any} style={{ position: "absolute", width: "100%", height: "100%" }} />

            <View style={{ flex: 1, padding: 15, justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ backgroundColor: "rgba(255,255,255,0.26)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Txt size={9.5} font="sansBold" style={{ color: "#fff", letterSpacing: 1 }} uppercase>{ticket.ticket_type || "Pass"}</Txt>
                </View>
                {used ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.4)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
                    <CheckCircle2 size={11} color="#7ee787" />
                    <Txt size={9} font="sansBold" style={{ color: "#7ee787", letterSpacing: 1 }}>USED</Txt>
                  </View>
                ) : expired ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
                    <CalendarX size={11} color="#ff9b9b" />
                    <Txt size={9} font="sansBold" style={{ color: "#ff9b9b", letterSpacing: 1 }}>EXPIRED</Txt>
                  </View>
                ) : null}
              </View>

              <View>
                <Txt size={19} font="display" tracking={-0.5} lh={22} numberOfLines={2} style={{ color: "#fff" }}>{eventTitle || "Event pass"}</Txt>
                <Txt size={11.5} lh={15.5} style={{ color: ended ? "rgba(255,180,180,0.95)" : "rgba(255,255,255,0.85)", marginTop: 4 }} numberOfLines={2}>
                  {ended || (date ? formatEventDate(date) : ticket.holder_name)}{venue && !ended ? ` · ${venue}` : ""}
                </Txt>
              </View>

              <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
                <View>
                  <Txt size={8.5} font="monoMed" style={{ color: "rgba(255,255,255,0.65)", letterSpacing: 1.5 }} uppercase>Holder</Txt>
                  <Txt size={13} font="sansExt" style={{ color: "#fff" }} numberOfLines={1}>{ticket.holder_name}</Txt>
                </View>
                {price == null ? null : (
                  <View style={{ backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4 }}>
                    <Txt size={12.5} font="sansExt" style={{ color: way.grad[1] }}>{price > 0 ? formatINR(price) : "FREE"}</Txt>
                  </View>
                )}
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* ── Stub ── */}
        <View style={{ width: STUB }}>
          <LinearGradient colors={way.stub} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 7 }}>
            <View style={{ backgroundColor: "#fff", padding: 7, borderRadius: 10 }}>
              <QRCode value={ticket.ticket_ref || "UTI"} size={62} backgroundColor="#fff" color={expired ? "#9aa0ad" : "#000"} />
              {/* An expired code must not look scannable. */}
              {expired ? (
                <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderRadius: 10, backgroundColor: "rgba(15,17,27,0.78)", alignItems: "center", justifyContent: "center" }}>
                  <Ban size={26} color="#ff9b9b" />
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
              <Txt size={8.5} font="monoMed" style={{ color: ink, letterSpacing: 1 }}>{expired ? "ENDED" : "VIEW"}</Txt>
              {expired ? null : <ChevronRight size={10} color={ink} />}
            </View>
          </LinearGradient>
        </View>

        {/* ── Expired: the colour drains out and the stamp lands ── */}
        {expired ? (
          <>
            <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: "rgba(6,8,16,0.52)" }} />
            <ExpiredStamp size={19} style={{ position: "absolute", left: (W - STUB) / 2 - 66, top: H / 2 - 20 }} />
          </>
        ) : null}

        {/* ── Perforation: notches + dashes at the stub seam ── */}
        <View pointerEvents="none" style={{ position: "absolute", right: STUB - 10, top: -10, width: 20, height: 20, borderRadius: 999, backgroundColor: c.bg }} />
        <View pointerEvents="none" style={{ position: "absolute", right: STUB - 10, bottom: -10, width: 20, height: 20, borderRadius: 999, backgroundColor: c.bg }} />
        <View pointerEvents="none" style={{ position: "absolute", right: STUB - 1, top: 12, bottom: 12, width: 2, justifyContent: "space-between" }}>
          {Array.from({ length: 11 }).map((_, i) => (
            <View key={i} style={{ width: 2, height: 6, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.75)" }} />
          ))}
        </View>
      </View>
    </Pressable>
  );
}
