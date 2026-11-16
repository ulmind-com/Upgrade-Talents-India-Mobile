import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Pressable,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { Bookmark, Calendar, MapPin, Sparkles } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { formatINR, splitDate } from "@/lib/format";
import type { EventItem } from "@/lib/api";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = Math.round(SCREEN_W * 0.82);
const CARD_H = Math.round(CARD_W * 1.34);
const SPACING = 12;
const SIDE_PEEK = Math.round((SCREEN_W - CARD_W) / 2);
const BOOKMARKS_KEY = "uti_saved_spotlights";

export function SpotlightCarousel({
  events,
  onOpen,
}: {
  events: EventItem[];
  onOpen: (id: string) => void;
}) {
  const { c } = useTheme();
  const [activeIdx, setActiveIdx] = useState(0);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList>(null);

  // Load saved bookmarks from SecureStore
  useEffect(() => {
    SecureStore.getItemAsync(BOOKMARKS_KEY)
      .then((raw) => {
        if (raw) setSaved(new Set(JSON.parse(raw)));
      })
      .catch(() => {});
  }, []);

  const toggleSave = async (id: string, e: any) => {
    e.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      SecureStore.setItemAsync(BOOKMARKS_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offsetX / (CARD_W + SPACING));
    if (idx >= 0 && idx < events.length && idx !== activeIdx) {
      setActiveIdx(idx);
    }
  };

  if (!events || events.length === 0) return null;

  return (
    <View style={{ marginTop: 22 }}>
      {/* Spotlight Cards Snapping Slider */}
      <FlatList
        ref={flatListRef}
        data={events}
        keyExtractor={(item, index) => item._id || String(index)}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + SPACING}
        decelerationRate="fast"
        contentContainerStyle={{
          paddingHorizontal: SIDE_PEEK,
          gap: SPACING,
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => {
          const isSaved = saved.has(item._id);
          const d = splitDate(item.date);
          const isLive = item.event_status === "live";
          const subtitle =
            item.description ||
            `Live the ultimate experience with celebrity judges and top performers.`;

          return (
            <Pressable
              onPress={() => onOpen(item._id)}
              style={({ pressed }) => ({
                width: CARD_W,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <View
                style={{
                  width: CARD_W,
                  height: CARD_H,
                  borderRadius: 22,
                  overflow: "hidden",
                  backgroundColor: "#12141a",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.08)",
                  shadowColor: "#000",
                  shadowOpacity: 0.55,
                  shadowRadius: 20,
                  shadowOffset: { width: 0, height: 12 },
                  elevation: 12,
                }}
              >
                {/* Poster Image */}
                <AppImage
                  uri={item.image_url}
                  seed={item._id || index}
                  style={{ width: "100%", height: "100%" }}
                />

                {/* Dark Gradient Overlay */}
                <LinearGradient
                  colors={[
                    "rgba(0,0,0,0.4)",
                    "transparent",
                    "rgba(8,9,12,0.85)",
                    "rgba(8,9,12,0.98)",
                  ]}
                  locations={[0, 0.28, 0.72, 1]}
                  style={{ position: "absolute", width: "100%", height: "100%" }}
                />

                {/* Top Badges */}
                <View
                  style={{
                    position: "absolute",
                    top: 14,
                    left: 14,
                    right: 14,
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
                      gap: 6,
                      paddingHorizontal: 11,
                      paddingVertical: 5.5,
                      borderRadius: 999,
                      backgroundColor: "rgba(18, 20, 26, 0.85)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.12)",
                    }}
                  >
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        backgroundColor: isLive ? "#22c55e" : "#ff385c",
                      }}
                    />
                    <Txt size={11.5} font="sansBold" style={{ color: "#ffffff" }}>
                      {isLive ? "Live now" : "Sale is live"}
                    </Txt>
                  </View>

                  {/* Bookmark Button */}
                  <Pressable
                    onPress={(e) => toggleSave(item._id, e)}
                    hitSlop={8}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      backgroundColor: "rgba(18, 20, 26, 0.85)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.12)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Bookmark
                      size={17}
                      color={isSaved ? "#ff385c" : "#ffffff"}
                      fill={isSaved ? "#ff385c" : "transparent"}
                    />
                  </Pressable>
                </View>

                {/* Bottom Event Info */}
                <View style={{ position: "absolute", bottom: 16, left: 16, right: 16 }}>
                  <Txt
                    size={17.5}
                    font="sansBold"
                    lh={22}
                    numberOfLines={2}
                    style={{ color: "#ffffff", letterSpacing: -0.3 }}
                  >
                    {item.title}
                  </Txt>

                  <Txt
                    size={12}
                    tone="muted"
                    lh={16.5}
                    numberOfLines={2}
                    style={{ marginTop: 5, color: "#9ea3b8" }}
                  >
                    {subtitle}
                  </Txt>

                  {/* Meta Bar */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginTop: 10,
                      paddingTop: 10,
                      borderTopWidth: 1,
                      borderTopColor: "rgba(255, 255, 255, 0.08)",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Calendar size={13} color="#9ea3b8" />
                      <Txt size={11.5} font="sansMed" style={{ color: "#9ea3b8" }}>
                        {d.day} {d.month}
                      </Txt>
                    </View>

                    {item.price != null ? (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: "rgba(255, 255, 255, 0.12)",
                        }}
                      >
                        <Txt size={12} font="sansBold" style={{ color: "#ffffff" }}>
                          {formatINR(item.price)}
                        </Txt>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      {/* Modern Capsule Pagination Dots */}
      {events.length > 1 ? (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            gap: 6,
            marginTop: 14,
          }}
        >
          {events.map((_, i) => {
            const isActive = i === activeIdx;
            return (
              <View
                key={i}
                style={{
                  width: isActive ? 22 : 6,
                  height: isActive ? 4 : 6,
                  borderRadius: 999,
                  backgroundColor: isActive ? "#ffffff" : "rgba(255, 255, 255, 0.22)",
                }}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
