import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { MapPin, Calendar, ArrowUpRight, Users, Bookmark, Sparkles, ChevronRight } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { formatINR, splitDate, formatEventDate, countdownParts, titleCase, isPastEvent, isDeadlinePassed } from "@/lib/format";
import { seatsLeft, type EventItem, type CourseItem } from "@/lib/api";
import { playNavFeedback } from "@/lib/sound";

/* ─────────────── Zomato District Page Header ─────────────── */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { name } = useTheme();
  return (
    <View style={{ paddingTop: 6, paddingBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          {eyebrow ? (
            <Txt size={11} font="monoMed" style={{ color: "#C9F24A", letterSpacing: 2, marginBottom: 6 }} uppercase>
              {eyebrow}
            </Txt>
          ) : null}
          <Txt size={28} font="sansBold" tracking={-0.6} style={{ color: "#ffffff" }}>
            {title}
          </Txt>
          {subtitle ? (
            <Txt size={13} style={{ color: "#9ea3b8", marginTop: 4, maxWidth: 320 }}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

/* ─────────────── Date chip ─────────────── */
export function DateChip({ date }: { date?: string | null }) {
  const d = splitDate(date);
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: "#14161E",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.12)",
        paddingVertical: 8,
        paddingHorizontal: 12,
        minWidth: 54,
      }}
    >
      <Txt size={20} font="display" style={{ color: "#FF385C" }} lh={22}>
        {d.day}
      </Txt>
      <Txt size={9.5} font="sansBold" style={{ color: "#9ea3b8", letterSpacing: 1 }}>
        {d.month}
      </Txt>
    </View>
  );
}

/* ─────────────── Zomato District Event Card ─────────────── */
export function EventCard({
  ev,
  onPress,
  index = 0,
}: {
  ev: EventItem;
  onPress: () => void;
  index?: number;
}) {
  const [bookmarked, setBookmarked] = useState(false);
  const live = ev.event_status === "live";
  const over = isPastEvent(ev);
  const shut = !over && isDeadlinePassed(ev.registration_deadline);

  const toggleBookmark = (e: any) => {
    e.stopPropagation();
    playNavFeedback();
    setBookmarked(!bookmarked);
  };

  return (
    <Pressable
      onPress={() => {
        playNavFeedback();
        onPress();
      }}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View
        style={{
          borderRadius: 22,
          overflow: "hidden",
          backgroundColor: "#14161E",
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.08)",
          shadowColor: "#000",
          shadowOpacity: 0.4,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        }}
      >
        {/* Banner with dark bottom gradient */}
        <View style={{ height: 180, backgroundColor: "#0b0b0e" }}>
          <AppImage uri={ev.image_url} seed={ev._id || index} style={{ width: "100%", height: "100%", opacity: over ? 0.5 : 1 }} />
          <LinearGradient
            colors={["rgba(8, 9, 12, 0.2)", "transparent", "rgba(8, 9, 12, 0.95)"]}
            locations={[0, 0.35, 1]}
            style={{ position: "absolute", width: "100%", height: "100%" }}
          />

          {/* Top badges & Bookmark action */}
          <View
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              right: 12,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            {/* Status Pill Badge */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                backgroundColor: live
                  ? "#FF385C"
                  : over
                  ? "rgba(20, 22, 30, 0.85)"
                  : "rgba(20, 22, 30, 0.78)",
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: live
                  ? "#FF385C"
                  : "rgba(255, 255, 255, 0.15)",
              }}
            >
              {live && (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    backgroundColor: "#fff",
                  }}
                />
              )}
              <Txt size={11} font="sansBold" style={{ color: "#ffffff" }}>
                {live ? "Live now" : over ? "Ended" : shut ? "Closed" : "Sale is live"}
              </Txt>
            </View>

            {/* Bookmark button */}
            <Pressable
              onPress={toggleBookmark}
              hitSlop={8}
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                backgroundColor: "rgba(20, 22, 30, 0.75)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.15)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bookmark
                size={16}
                color={bookmarked ? "#FF385C" : "#ffffff"}
                fill={bookmarked ? "#FF385C" : "transparent"}
              />
            </Pressable>
          </View>

          {/* Title on the bottom gradient */}
          <View style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
            <Txt size={19} font="sansBold" lh={23} numberOfLines={2} style={{ color: "#ffffff" }}>
              {ev.title}
            </Txt>
          </View>
        </View>

        {/* Card Body */}
        <View style={{ padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Calendar size={13} color="#9ea3b8" />
              <Txt size={12.5} style={{ color: "#9ea3b8" }}>
                {formatEventDate(ev.date)}
              </Txt>
            </View>
            {ev.venue ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1 }}>
                <MapPin size={13} color="#9ea3b8" />
                <Txt size={12.5} style={{ color: "#9ea3b8" }} numberOfLines={1}>
                  {ev.venue}
                </Txt>
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4 }}>
            <View>
              <Txt size={10} font="monoMed" style={{ color: "#6b728a" }} uppercase>
                Starting from
              </Txt>
              <Txt size={18} font="sansBold" style={{ color: over ? "#6b728a" : "#FF385C" }}>
                {formatINR(ev.price)}
              </Txt>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                backgroundColor: over ? "rgba(255,255,255,0.06)" : "#FF385C",
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 999,
              }}
            >
              <Txt size={12} font="sansBold" style={{ color: over ? "#9ea3b8" : "#ffffff" }}>
                {over ? "Recap" : shut ? "Closed" : "Book tickets"}
              </Txt>
              {!over && <ArrowUpRight size={13} color="#ffffff" />}
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/* ─────────────── Zomato District Course/Workshop Card ─────────────── */
export function CourseCard({
  item,
  onPress,
  index = 0,
  enrolled,
}: {
  item: CourseItem;
  onPress?: () => void;
  index?: number;
  enrolled?: boolean;
}) {
  const left = seatsLeft(item);
  const soldOut = left === 0;

  return (
    <Pressable
      onPress={() => {
        playNavFeedback();
        if (onPress) onPress();
      }}
      style={({ pressed }) => ({
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View
        style={{
          borderRadius: 22,
          overflow: "hidden",
          backgroundColor: "#14161E",
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.08)",
          shadowColor: "#000",
          shadowOpacity: 0.35,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 5,
        }}
      >
        <View style={{ height: 160, backgroundColor: "#0b0b0e" }}>
          <AppImage uri={item.thumbnail} seed={item._id || index} style={{ width: "100%", height: "100%" }} />
          <LinearGradient
            colors={["rgba(8, 9, 12, 0.2)", "transparent", "rgba(8, 9, 12, 0.95)"]}
            locations={[0, 0.4, 1]}
            style={{ position: "absolute", width: "100%", height: "100%" }}
          />

          <View style={{ position: "absolute", top: 12, left: 12, flexDirection: "row", gap: 7 }}>
            <View
              style={{
                backgroundColor: "rgba(20, 22, 30, 0.8)",
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.14)",
              }}
            >
              <Txt size={10} font="sansBold" style={{ color: "#ffffff" }} uppercase>
                {item.course_type === "workshop" ? "Workshop" : "Course"}
              </Txt>
            </View>
            {enrolled && (
              <View
                style={{
                  backgroundColor: "rgba(201, 242, 74, 0.2)",
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "#C9F24A",
                }}
              >
                <Txt size={10} font="sansBold" style={{ color: "#C9F24A" }}>
                  ENROLLED
                </Txt>
              </View>
            )}
          </View>

          <View style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
            <Txt size={18} font="sansBold" lh={22} numberOfLines={2} style={{ color: "#ffffff" }}>
              {item.title}
            </Txt>
          </View>
        </View>

        <View style={{ padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Txt size={13} font="sansBold" style={{ color: "#ffffff" }} numberOfLines={1}>
              {item.instructor_name || "Instructor"}
            </Txt>
            {left !== null && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                <Users size={11} color={soldOut ? "#ef4444" : "#9ea3b8"} />
                <Txt size={11.5} style={{ color: soldOut ? "#ef4444" : "#9ea3b8" }}>
                  {soldOut ? "Sold out" : `${left} seats remaining`}
                </Txt>
              </View>
            )}
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Txt size={10} font="monoMed" style={{ color: "#6b728a" }} uppercase>
              Fee
            </Txt>
            <Txt size={18} font="sansBold" style={{ color: "#FF385C" }}>
              {formatINR(item.price)}
            </Txt>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/* ─────────────── Countdown ─────────────── */
export function Countdown({ target }: { target?: string | null }) {
  const [parts, setParts] = useState(() => countdownParts(target));
  React.useEffect(() => {
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
        <View
          key={u.l}
          style={{
            flex: 1,
            alignItems: "center",
            backgroundColor: "#14161E",
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.08)",
            paddingVertical: 10,
          }}
        >
          <Txt size={22} font="display" style={{ color: "#ffffff" }} tracking={-0.5}>
            {String(u.v).padStart(2, "0")}
          </Txt>
          <Txt size={10} font="monoMed" style={{ color: "#9ea3b8" }} tracking={1.5} uppercase>
            {u.l}
          </Txt>
        </View>
      ))}
    </View>
  );
}
