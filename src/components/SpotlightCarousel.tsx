import React, { useRef, useState, useEffect } from "react";
import {
  View,
  Pressable,
  Dimensions,
  Animated,
  FlatList,
  FlatListProps,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { Bookmark } from "lucide-react-native";
import { Txt } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { splitDate } from "@/lib/format";
import type { EventItem } from "@/lib/api";
import { playNavFeedback } from "@/lib/sound";

/* ──────────────────────────────────────────────────────────────────────────
   District-style 3D Coverflow Spotlight Carousel
   Matches the Zomato District spotlight pattern:
   - Centered active poster card (scale 1.0, opacity 1.0)
   - Peeking left & right cards (scale 0.88, opacity 0.45)
   - Centered Title + Subtitle / Tagline below the active card
   - Modern elongated capsule pagination indicator (• ═ •)
   - Native-driver animated scroll interpolation
   ────────────────────────────────────────────────────────────────────────── */

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = Math.round(SCREEN_W * 0.74);
const CARD_H = Math.round(CARD_W * 1.30);
const SPACING = 14;
const ITEM_FULL_WIDTH = CARD_W + SPACING;
const SIDE_PEEK = Math.round((SCREEN_W - CARD_W) / 2);
const BOOKMARKS_KEY = "uti_saved_spotlights";

const AnimatedFlatList = Animated.FlatList as unknown as React.ComponentType<
  FlatListProps<EventItem> & { ref?: any }
>;

const AUTO_PLAY_INTERVAL = 3800;

export function SpotlightCarousel({
  events,
  onOpen,
}: {
  events: EventItem[];
  onOpen: (id: string) => void;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const activeIdxRef = useRef(0);
  activeIdxRef.current = activeIdx;

  const [saved, setSaved] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList<EventItem>>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const isInteracting = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = () => {
    stopTimer();
    if (events && events.length > 1) {
      timerRef.current = setInterval(() => {
        if (isInteracting.current || !events || events.length <= 1) return;
        const next = (activeIdxRef.current + 1) % events.length;
        flatListRef.current?.scrollToOffset({
          offset: next * ITEM_FULL_WIDTH,
          animated: true,
        });
      }, AUTO_PLAY_INTERVAL);
    }
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Start auto-play timer on mount & reset on unmount or events change
  useEffect(() => {
    startTimer();
    return () => stopTimer();
  }, [events?.length]);

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
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    playNavFeedback();
    setSaved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      SecureStore.setItemAsync(BOOKMARKS_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  };

  if (!events || events.length === 0) return null;

  const currentEvent = events[activeIdx] || events[0];
  const d = currentEvent ? splitDate(currentEvent.date) : null;
  const currentSubtitle =
    currentEvent?.description?.trim() ||
    (d && currentEvent?.venue
      ? `${d.day} ${d.month}  ·  ${currentEvent.venue}`
      : "The lineup is loud. The countdown is on.");

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    {
      useNativeDriver: true,
      listener: (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const offsetX = e.nativeEvent.contentOffset.x;
        const idx = Math.round(offsetX / ITEM_FULL_WIDTH);
        if (idx >= 0 && idx < events.length && idx !== activeIdx) {
          setActiveIdx(idx);
          try {
            Haptics.selectionAsync();
          } catch {}
        }
      },
    }
  );

  return (
    <View style={styles.container}>
      {/* 3D Snapping Coverflow List */}
      <AnimatedFlatList
        ref={flatListRef}
        data={events}
        keyExtractor={(item, index) => item._id || String(index)}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ITEM_FULL_WIDTH}
        decelerationRate="fast"
        bounces={false}
        contentContainerStyle={{
          paddingHorizontal: SIDE_PEEK,
        }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          isInteracting.current = true;
          stopTimer();
        }}
        onScrollEndDrag={() => {
          isInteracting.current = false;
          startTimer();
        }}
        onMomentumScrollEnd={() => {
          isInteracting.current = false;
          startTimer();
        }}
        renderItem={({ item, index }) => {
          const isSaved = saved.has(item._id);
          const isLive = item.event_status === "live";

          // Calculate 3D scale and opacity based on scroll distance from center
          const inputRange = [
            (index - 1) * ITEM_FULL_WIDTH,
            index * ITEM_FULL_WIDTH,
            (index + 1) * ITEM_FULL_WIDTH,
          ];

          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.88, 1, 0.88],
            extrapolate: "clamp",
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.45, 1, 0.45],
            extrapolate: "clamp",
          });

          return (
            <Animated.View
              style={{
                width: CARD_W,
                marginRight: index === events.length - 1 ? 0 : SPACING,
                transform: [{ scale }],
                opacity,
              }}
            >
              <Pressable
                onPress={() => {
                  if (index === activeIdx) {
                    playNavFeedback();
                    onOpen(item._id);
                  } else {
                    flatListRef.current?.scrollToOffset({
                      offset: index * ITEM_FULL_WIDTH,
                      animated: true,
                    });
                  }
                }}
                style={({ pressed }) => [
                  styles.card,
                  {
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                {/* Full-bleed Poster Image */}
                <AppImage
                  uri={item.image_url}
                  seed={item._id || index}
                  style={styles.posterImage}
                />

                {/* Subtle scrim gradient for badge readability */}
                <LinearGradient
                  colors={[
                    "rgba(0, 0, 0, 0.55)",
                    "transparent",
                    "rgba(0, 0, 0, 0.35)",
                  ]}
                  locations={[0, 0.3, 1]}
                  style={styles.scrim}
                />

                {/* Top Header inside Card: Status Badge + Bookmark */}
                <View style={styles.cardHeader}>
                  {/* Category / Status Pill */}
                  <View style={styles.pillBadge}>
                    {isLive ? (
                      <View style={styles.liveDot} />
                    ) : null}
                    <Txt size={11.5} font="sansBold" style={styles.pillText}>
                      {isLive ? "Live now" : ((item as any).category || "District Live")}
                    </Txt>
                  </View>

                  {/* Bookmark Button */}
                  <Pressable
                    onPress={(e) => toggleSave(item._id, e)}
                    hitSlop={8}
                    style={styles.bookmarkBtn}
                  >
                    <Bookmark
                      size={17}
                      color={isSaved ? "#ff385c" : "#ffffff"}
                      fill={isSaved ? "#ff385c" : "transparent"}
                    />
                  </Pressable>
                </View>
              </Pressable>
            </Animated.View>
          );
        }}
      />

      {/* Title & Tagline below active card (Centered, matching screenshot) */}
      <View style={styles.infoWrapper}>
        <Txt
          size={19}
          font="sansBold"
          numberOfLines={1}
          style={styles.title}
        >
          {currentEvent?.title || "Upcoming Spotlight"}
        </Txt>

        <Txt
          size={13}
          font="sansMed"
          numberOfLines={2}
          style={styles.subtitle}
        >
          {currentSubtitle}
        </Txt>
      </View>

      {/* Modern Capsule Pagination Dots (• ═ •) */}
      {events.length > 1 ? (
        <View style={styles.paginationRow}>
          {events.map((_, i) => {
            const isActive = i === activeIdx;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    width: isActive ? 20 : 5,
                    height: isActive ? 4.5 : 5,
                    backgroundColor: isActive
                      ? "#ffffff"
                      : "rgba(255, 255, 255, 0.28)",
                  },
                ]}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#13141c",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.65,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  scrim: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  cardHeader: {
    position: "absolute",
    top: 14,
    left: 14,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pillBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#22c55e",
  },
  pillText: {
    color: "#ffffff",
    letterSpacing: -0.2,
  },
  bookmarkBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoWrapper: {
    alignItems: "center",
    paddingHorizontal: 28,
    marginTop: 16,
  },
  title: {
    color: "#ffffff",
    textAlign: "center",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: "#9ea3b8",
    textAlign: "center",
    marginTop: 5,
    lineHeight: 18,
  },
  paginationRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 14,
  },
  dot: {
    borderRadius: 999,
  },
});
