import React, { useMemo } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import type { TicketTier } from "@/lib/api";
import { seatId, zoneFor, type SeatRow } from "@/lib/seating";
import { formatINR, formatEventDate } from "@/lib/format";
import { AppImage } from "@/components/AppImage";

/* The seat map as a shareable card: event header, the whole arena drawn
   small (booked seats shaded, your picks lit), a legend and the brand strip. */

const PICK = "#FF385C";
const LOGO = require("../../../assets/Logo/u-mark-white-512.png");

export function SeatShareCard({
  event,
  tiers,
  rows,
  booked,
  picked,
}: {
  event: any;
  tiers: TicketTier[];
  rows: Map<string, SeatRow[]>;
  booked: Set<string>;
  picked: Set<string>;
}) {
  const { width } = useWindowDimensions();
  const W = Math.min(width - 40, 420);
  const inner = W - 12 - 32; // frame + padding

  const maxCols = useMemo(() => {
    let m = 10;
    rows.forEach((rs) => rs.forEach((r) => (m = Math.max(m, r.left.length + r.center.length + r.right.length))));
    return m;
  }, [rows]);
  const LABEL = 12;
  const unit = (inner - LABEL - 4) / (maxCols + 1.4);
  const seat = Math.max(4, Math.floor(unit * 0.78));
  const gap = Math.max(1, unit - seat);

  const poster = event?.card_image_url || event?.image_url || event?.banner_url || event?.banner_image_url;
  const when = [event?.date ? formatEventDate(event.date) : null, event?.time].filter(Boolean).join(" · ");

  return (
    <LinearGradient colors={["#FF385C", "#F9862B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: W, borderRadius: 26, padding: 6, alignSelf: "center" }}>
      <View style={s.inner}>
        {/* event */}
        <View style={{ flexDirection: "row", gap: 14 }}>
          <View style={{ width: 62, height: 82, borderRadius: 12, overflow: "hidden", backgroundColor: "#1A1B23" }}>
            <AppImage uri={poster} seed={3} style={{ width: "100%", height: "100%" }} />
          </View>
          <View style={{ flex: 1, justifyContent: "center", gap: 4 }}>
            <Text style={s.title} numberOfLines={2}>{event?.title || "Event"}</Text>
            {when ? <Text style={s.meta} numberOfLines={1}>{when}</Text> : null}
            {event?.venue ? <Text style={s.meta} numberOfLines={1}>{event.venue}</Text> : null}
          </View>
        </View>

        {/* stage */}
        <View style={{ alignItems: "center", marginTop: 18 }}>
          <View style={{ width: "78%", height: 4, borderRadius: 4, backgroundColor: PICK, opacity: 0.85 }} />
          <Text style={s.stage}>STAGE THIS WAY</Text>
        </View>

        {/* arena */}
        {tiers.map((t) => {
          const z = zoneFor(t.type, t.price);
          return (
            <View key={t._id} style={{ marginTop: 14 }}>
              <Text style={[s.zone, { color: z.color }]}>
                {(t.type || z.label).toUpperCase()} : {t.price > 0 ? formatINR(t.price) : "FREE"}
              </Text>
              {(rows.get(t._id) || []).map((r) => (
                <View key={r.code} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: gap }}>
                  <Text style={[s.row, { width: LABEL }]}>{r.code}</Text>
                  <Block nums={r.left} row={r.code} seat={seat} gap={gap} color={z.color} booked={booked} picked={picked} />
                  <View style={{ width: unit * 0.7 }} />
                  <Block nums={r.center} row={r.code} seat={seat} gap={gap} color={z.color} booked={booked} picked={picked} />
                  <View style={{ width: unit * 0.7 }} />
                  <Block nums={r.right} row={r.code} seat={seat} gap={gap} color={z.color} booked={booked} picked={picked} />
                </View>
              ))}
            </View>
          );
        })}

        {/* legend */}
        <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.1)", marginTop: 16, marginBottom: 12 }} />
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 18 }}>
          <Legend label="Available"><View style={[s.key, { borderWidth: 1.2, borderColor: "rgba(255,255,255,0.7)" }]} /></Legend>
          <Legend label="Booked"><View style={[s.key, { backgroundColor: "#2A2C36" }]} /></Legend>
          {picked.size ? <Legend label="Mine"><View style={[s.key, { backgroundColor: PICK }]} /></Legend> : null}
        </View>
      </View>

      {/* brand strip */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Image source={LOGO} style={{ width: 22, height: 22 }} contentFit="contain" />
          <Text style={s.brand}>Upgrade Talents India</Text>
        </View>
        <Text style={s.tag}>#SeeYouThere</Text>
      </View>
    </LinearGradient>
  );
}

function Block({ nums, row, seat, gap, color, booked, picked }: { nums: number[]; row: string; seat: number; gap: number; color: string; booked: Set<string>; picked: Set<string> }) {
  if (!nums.length) return null;
  return (
    <View style={{ flexDirection: "row", gap }}>
      {nums.map((n) => {
        const id = seatId(row, n);
        const mine = picked.has(id);
        const taken = !mine && booked.has(id);
        return (
          <View
            key={id}
            style={{
              width: seat,
              height: seat,
              borderRadius: Math.max(1.5, seat * 0.25),
              backgroundColor: mine ? PICK : taken ? "#2A2C36" : "transparent",
              borderWidth: mine || taken ? 0 : 1,
              borderColor: color + "B3",
            }}
          />
        );
      })}
    </View>
  );
}

function Legend({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      {children}
      <Text style={s.legend}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  inner: { borderRadius: 21, padding: 16, backgroundColor: "#0E0F16" },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  meta: { color: "rgba(255,255,255,0.6)", fontSize: 12.5, fontWeight: "500" },
  stage: { marginTop: 6, fontSize: 9, fontWeight: "800", letterSpacing: 3, color: "rgba(255,255,255,0.5)" },
  zone: { textAlign: "center", fontSize: 10.5, fontWeight: "800", letterSpacing: 1.2, marginBottom: 7 },
  row: { fontSize: 7.5, fontWeight: "700", color: "rgba(255,255,255,0.45)" },
  key: { width: 14, height: 14, borderRadius: 4 },
  legend: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "600" },
  brand: { color: "#fff", fontSize: 13.5, fontWeight: "800", letterSpacing: 0.2 },
  tag: { color: "#fff", fontSize: 13, fontWeight: "800" },
});
