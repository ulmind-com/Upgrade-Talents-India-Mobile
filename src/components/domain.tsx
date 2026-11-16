import React, { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MapPin, Calendar, ArrowUpRight, Users, Clock } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt, Badge, Card } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { formatINR, splitDate, formatEventDate, countdownParts, titleCase, isPastEvent, isDeadlinePassed } from "@/lib/format";
import { seatsLeft, type EventItem, type CourseItem } from "@/lib/api";
import { DiagonalStripes } from "@/components/patterns";

/* ─────────────── Page header ─────────────── */
export function PageHeader({ eyebrow, title, subtitle, right }: { eyebrow?: string; title: string; subtitle?: string; right?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ paddingTop: 10, paddingBottom: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          {eyebrow ? <Txt size={11} font="monoMed" tone="accent" tracking={3} uppercase style={{ marginBottom: 8 }}>{eyebrow}</Txt> : null}
          <Txt size={30} font="display" tracking={-1} lh={32}>{title}</Txt>
          {subtitle ? <Txt size={14} tone="muted" lh={20} style={{ marginTop: 8 }}>{subtitle}</Txt> : null}
        </View>
        {right}
      </View>
    </View>
  );
}

/* ─────────────── Date chip ─────────────── */
export function DateChip({ date }: { date?: string | null }) {
  const { c } = useTheme();
  const d = splitDate(date);
  return (
    <View style={{ alignItems: "center", backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingVertical: 8, paddingHorizontal: 12, minWidth: 58 }}>
      <Txt size={22} font="display" tone="accent" lh={24}>{d.day}</Txt>
      <Txt size={10} font="sansBold" tone="muted" tracking={1.5}>{d.month}</Txt>
    </View>
  );
}

/* ─────────────── Event card ─────────────── */
export function EventCard({ ev, onPress, index = 0 }: { ev: EventItem; onPress: () => void; index?: number }) {
  const { c } = useTheme();
  const live = ev.event_status === "live";
  const over = isPastEvent(ev);
  const cancelled = ev.event_status === "cancelled";
  const shut = !over && isDeadlinePassed(ev.registration_deadline);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <View style={{ borderRadius: 24, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: over ? c.border : c.border }}>
        <View style={{ height: 170 }}>
          <AppImage uri={ev.image_url} seed={ev._id || index} style={{ width: "100%", height: "100%", opacity: over ? 0.4 : 1 }} />
          <LinearGradient colors={["transparent", "rgba(4,5,12,0.85)"] as any} style={{ position: "absolute", width: "100%", height: "100%" }} />

          {/* An event that has been and gone reads as archive footage: the
              photo drops back, a grain of hatch sits over it, and a stamp
              lands across the middle. */}
          {over ? (
            <>
              <View pointerEvents="none" style={{ position: "absolute", width: "100%", height: "100%", backgroundColor: c.bg, opacity: 0.42 }} />
              <DiagonalStripes color="#ffffff" opacity={0.055} gap={13} w={4} />
              <View
                pointerEvents="none"
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
              >
                <View
                  style={{
                    transform: [{ rotate: "-11deg" }],
                    borderWidth: 3,
                    borderColor: cancelled ? "rgba(255,120,120,0.8)" : "rgba(255,255,255,0.74)",
                    borderRadius: 11,
                    paddingHorizontal: 16,
                    paddingVertical: 6,
                    backgroundColor: "rgba(6,7,15,0.42)",
                  }}
                >
                  <Txt size={23} font="display" tracking={4} style={{ color: cancelled ? "rgba(255,150,150,0.95)" : "rgba(255,255,255,0.9)" }}>
                    {cancelled ? "CALLED OFF" : "ENDED"}
                  </Txt>
                </View>
              </View>
            </>
          ) : null}

          <View style={{ position: "absolute", top: 12, left: 12, flexDirection: "row", gap: 8 }}>
            {live ? (
              <Badge label="Live now" tone="live" />
            ) : over ? (
              <Badge label={cancelled ? "Cancelled" : "Ended"} tone={cancelled ? "danger" : "neutral"} />
            ) : shut ? (
              <Badge label="Registration closed" tone="warning" />
            ) : (
              <Badge label={titleCase(ev.event_status) || "Upcoming"} tone="brand" />
            )}
          </View>

          <View style={{ position: "absolute", bottom: 12, left: 12, right: 12 }}>
            <Txt size={19} font="heroSemi" lh={22} numberOfLines={2} style={{ color: over ? "rgba(255,255,255,0.72)" : "#fff" }}>{ev.title}</Txt>
          </View>
        </View>

        <View style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <Meta icon={<Calendar size={14} color={c.fgSubtle} />} text={formatEventDate(ev.date)} />
            {ev.venue ? <Meta icon={<MapPin size={14} color={c.fgSubtle} />} text={ev.venue} /> : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Txt
              size={16}
              font="sansBold"
              tone={over ? "subtle" : "accent"}
              style={over ? { textDecorationLine: "line-through" } : undefined}
            >
              {formatINR(ev.price)}
            </Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Txt size={12.5} font="sansBold" tone={over ? "subtle" : "muted"} uppercase tracking={1}>{over ? "Recap" : shut ? "Closed" : "View"}</Txt>
              <ArrowUpRight size={15} color={c.fgSubtle} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function Meta({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {icon}
      <Txt size={12.5} tone="subtle" numberOfLines={1}>{text}</Txt>
    </View>
  );
}

export function CourseCard({ item, onPress, index = 0, enrolled }: { item: CourseItem; onPress?: () => void; index?: number; enrolled?: boolean }) {
  const { c } = useTheme();
  const left = seatsLeft(item);
  const soldOut = left === 0;
  const status = enrolled ? "ENROLLED" : soldOut ? "FULL" : item.registration_status;
  const tone = status === "ENROLLED" ? "success" : status === "OPEN" ? "success" : status === "UPCOMING" ? "warning" : status === "FULL" ? "danger" : "neutral";
  const seatsLow = left !== null && left <= 5;
  return (
    <Card onPress={onPress} padding={0} style={{ overflow: "hidden" }}>
      <View style={{ height: 150 }}>
        <AppImage uri={item.thumbnail} seed={item._id || index} style={{ width: "100%", height: "100%" }} />
        <LinearGradient colors={["rgba(4,5,12,0.05)", "transparent", "rgba(4,5,12,0.75)"] as any} locations={[0, 0.45, 1]} style={{ position: "absolute", width: "100%", height: "100%" }} />
        <View style={{ position: "absolute", top: 12, left: 12, flexDirection: "row", gap: 8 }}>
          <Badge label={item.course_type === "workshop" ? "Workshop" : "Course"} tone="brand" />
          {status ? <Badge label={titleCase(status)} tone={tone as any} /> : null}
        </View>
        <View style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
          <Txt size={18} font="heroSemi" lh={22} numberOfLines={2} style={{ color: "#fff" }}>{item.title}</Txt>
        </View>
      </View>
      <View style={{ padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, flex: 1 }}>
          <View style={{ width: 34, height: 34, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }}>
            <Txt size={13} font="sansBold" tone="accent">{(item.instructor_name || "U").trim()[0]?.toUpperCase()}</Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={13} font="sansSemi" numberOfLines={1}>{item.instructor_name || "Instructor"}</Txt>
            {left !== null ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 1 }}>
                <Users size={11} color={soldOut ? c.danger : seatsLow ? c.warning : c.fgSubtle} />
                <Txt size={11} tone={soldOut ? "danger" : seatsLow ? "warning" : "subtle"}>{soldOut ? "Sold out" : `${left} seats left`}</Txt>
              </View>
            ) : null}
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Txt size={10} font="monoMed" tone="subtle" tracking={1} uppercase>Fee</Txt>
          <Txt size={17} font="sansExt" tone="accent">{formatINR(item.price)}</Txt>
        </View>
      </View>
    </Card>
  );
}

/* ─────────────── Countdown ─────────────── */
export function Countdown({ target }: { target?: string | null }) {
  const { c } = useTheme();
  const [parts, setParts] = useState(() => countdownParts(target));
  useEffect(() => {
    const id = setInterval(() => setParts(countdownParts(target)), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!parts) return null;
  const units = [
    { v: parts.days, l: "Days" },
    { v: parts.hours, l: "Hrs" },
    { v: parts.minutes, l: "Min" },
    { v: parts.seconds, l: "Sec" },
  ];
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {units.map((u) => (
        <View key={u.l} style={{ flex: 1, alignItems: "center", backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingVertical: 12 }}>
          <Txt size={24} font="display" tracking={-0.5}>{String(u.v).padStart(2, "0")}</Txt>
          <Txt size={10} font="monoMed" tone="subtle" tracking={2} uppercase style={{ marginTop: 2 }}>{u.l}</Txt>
        </View>
      ))}
    </View>
  );
}

/* ─────────────── Stat tile ─────────────── */
export function StatTile({ icon, label, value, tone = "fg" }: { icon?: React.ReactNode; label: string; value: string | number; tone?: "fg" | "accent" }) {
  const { c } = useTheme();
  return (
    <Card style={{ flex: 1 }} padding={14}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {icon}
        <Txt size={11.5} font="monoMed" tone="subtle" tracking={1.5} uppercase numberOfLines={1} style={{ flex: 1 }}>{label}</Txt>
      </View>
      <Txt size={26} font="display" tone={tone === "accent" ? "accent" : "fg"} tracking={-0.5}>{value}</Txt>
    </Card>
  );
}

export { Clock };
