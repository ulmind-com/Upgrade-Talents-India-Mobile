import React, { useEffect, useRef, useState } from "react";
import { View, Modal, Pressable, Animated, Easing, AppState, Linking, Platform, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePathname, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import * as Haptics from "expo-haptics";
import { Star, X, ExternalLink, MessageSquareHeart } from "lucide-react-native";
import { useSession } from "@/context/Session";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";
import { playNavFeedback } from "@/lib/sound";

const PLAY_STORE_WEB = "https://play.google.com/store/apps/details?id=in.upgradetalents.app";
const PLAY_STORE_MARKET = "market://details?id=in.upgradetalents.app";
const STORAGE_KEY = "uti_store_review_v1";

// Trigger after genuine active foreground exploration:
// ~60s on first session, or ~35s on return visits.
const FIRST_SESSION_MS = 60_000;
const RETURN_SESSION_MS = 35_000;
const SNOOZE_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

const BLOCKED_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/complete-profile",
  "/mode-select",
  "/staff",
  "/book",
  "/check-in",
  "/verify",
  "/ticket/",
  "/cart",
];

type ReviewState = {
  activeMs: number;
  launches: number;
  status: "pending" | "later" | "done";
  lastPromptAt?: number;
};

const STAR_LABELS: Record<number, string> = {
  1: "Needs improvement — tell us why",
  2: "Could be better — share feedback",
  3: "Good, with room to grow",
  4: "Really enjoying the vibe!",
  5: "Loving Upgrade Talents India! ✨",
};

const LOGO_MARK = require("../../assets/Logo/u-mark-512.png");

/**
 * Smart, engagement-aware In-App Review Gate.
 * Tracks active foreground usage in SecureStore and opens a sleek rating sheet
 * after the user has explored the app, directing happy ratings straight to
 * Google Play Store (`in.upgradetalents.app`).
 */
export function ReviewPromptGate({ readyToShow = true }: { readyToShow?: boolean }) {
  const { mode, ready } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { c } = useTheme();

  const [visible, setVisible] = useState(false);
  const [rating, setRating] = useState(0);
  const [canDismissForever, setCanDismissForever] = useState(false);

  const stateRef = useRef<ReviewState | null>(null);
  const shownThisSession = useRef(false);
  const anim = useRef(new Animated.Value(0)).current;

  const isSafeRoute = !BLOCKED_ROUTES.some((r) => pathname === r || pathname.includes(r));

  const persist = async (next: ReviewState) => {
    stateRef.current = next;
    try {
      await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  // Load persisted usage state and increment launch counter once
  useEffect(() => {
    let alive = true;
    (async () => {
      let cur: ReviewState = { activeMs: 0, launches: 0, status: "pending" };
      try {
        const raw = await SecureStore.getItemAsync(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            cur = {
              activeMs: Number(parsed.activeMs || 0),
              launches: Number(parsed.launches || 0),
              status: parsed.status === "done" || parsed.status === "later" ? parsed.status : "pending",
              lastPromptAt: parsed.lastPromptAt ? Number(parsed.lastPromptAt) : undefined,
            };
          }
        }
      } catch {}
      if (!alive) return;
      cur.launches += 1;
      await persist(cur);
      setCanDismissForever(cur.status === "later");
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Accumulate active foreground time cleanly and check eligibility
  useEffect(() => {
    if (!ready || !readyToShow || mode === "admin" || shownThisSession.current) return;

    const tick = setInterval(() => {
      if (AppState.currentState !== "active") return;
      const st = stateRef.current;
      if (!st || st.status === "done" || shownThisSession.current) return;

      st.activeMs += 5000;
      if (st.activeMs % 15000 === 0) {
        persist(st);
      }

      if (!isSafeRoute) return;

      const threshold = st.launches >= 2 ? RETURN_SESSION_MS : FIRST_SESSION_MS;
      const snoozeElapsed = !st.lastPromptAt || Date.now() - st.lastPromptAt >= SNOOZE_MS;

      if (st.status === "pending" && st.activeMs >= threshold) {
        shownThisSession.current = true;
        setVisible(true);
      } else if (st.status === "later" && snoozeElapsed && st.activeMs >= threshold) {
        shownThisSession.current = true;
        setVisible(true);
      }
    }, 5000);

    return () => clearInterval(tick);
  }, [ready, readyToShow, mode, isSafeRoute]);

  useEffect(() => {
    if (!visible) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 320,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);

  const closeWith = async (status: "later" | "done") => {
    playNavFeedback();
    const cur = stateRef.current || { activeMs: 0, launches: 1, status };
    await persist({
      ...cur,
      status,
      lastPromptAt: Date.now(),
    });
    Animated.timing(anim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => setVisible(false));
  };

  const openPlayStore = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    playNavFeedback();
    try {
      if (Platform.OS === "android") {
        await Linking.openURL(PLAY_STORE_MARKET).catch(() => Linking.openURL(PLAY_STORE_WEB));
      } else {
        await Linking.openURL(PLAY_STORE_WEB);
      }
    } catch {}
    await closeWith("done");
  };

  const openFeedback = async () => {
    playNavFeedback();
    await closeWith("done");
    router.push("/(more)/contact");
  };

  const selectStar = (s: number) => {
    Haptics.selectionAsync().catch(() => {});
    setRating(s);
  };

  if (!visible) return null;

  const isLowRating = rating > 0 && rating <= 3;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={() => closeWith("later")}>
      <View style={styles.root}>
        {/* Blurred Backdrop */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
          <Pressable style={{ flex: 1 }} onPress={() => closeWith("later")}>
            <BlurView intensity={26} tint="dark" style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(6, 7, 15, 0.62)" }]} />
          </Pressable>
        </Animated.View>

        {/* Sheet Card */}
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: c.bgElevated,
              borderColor: "rgba(255, 255, 255, 0.12)",
              paddingBottom: Math.max(insets.bottom, 16) + 12,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [380, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Ambient golden top glow */}
          <LinearGradient
            colors={["rgba(245, 158, 11, 0.18)", "rgba(255, 56, 92, 0.08)", "transparent"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.topGlow}
            pointerEvents="none"
          />

          <View style={styles.handle} />

          {/* Close X */}
          <Pressable
            onPress={() => closeWith("later")}
            hitSlop={10}
            style={styles.closeBtn}
            accessibilityLabel="Close review prompt"
          >
            <X size={16} color="#9EA3B8" />
          </Pressable>

          {/* Brand Emblem */}
          <View style={styles.logoWrap}>
            <Image source={LOGO_MARK} style={{ width: 38, height: 38 }} contentFit="contain" />
          </View>

          <Txt size={11} font="monoMed" tracking={2.2} uppercase style={{ color: "#FBBF24", marginTop: 12 }}>
            Upgrade Talents India
          </Txt>

          <Txt size={22} font="display" tracking={-0.5} align="center" style={{ color: "#FFFFFF", marginTop: 6 }}>
            Enjoying the app?
          </Txt>

          <Txt size={13.5} tone="muted" lh={20} align="center" style={{ marginTop: 6, maxWidth: 290 }}>
            Tap a star to rate your experience. Your review helps performers &amp; fans discover live stages.
          </Txt>

          {/* Interactive 5-Star Selector */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => {
              const active = n <= rating;
              return (
                <Pressable
                  key={n}
                  onPress={() => selectStar(n)}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.starBtn,
                    active && styles.starBtnActive,
                    { transform: [{ scale: pressed ? 0.9 : active ? 1.06 : 1 }] },
                  ]}
                >
                  <Star
                    size={26}
                    color={active ? "#FBBF24" : "#6B728A"}
                    fill={active ? "#FBBF24" : "transparent"}
                    strokeWidth={1.9}
                  />
                </Pressable>
              );
            })}
          </View>

          {/* Dynamic reaction pill */}
          <View style={{ minHeight: 24, justifyContent: "center", marginBottom: 16 }}>
            {rating > 0 ? (
              <Txt size={12.5} font="sansSemi" style={{ color: isLowRating ? "#FCA5A5" : "#FDE68A" }}>
                {STAR_LABELS[rating]}
              </Txt>
            ) : (
              <Txt size={12} tone="subtle">
                Takes less than 10 seconds
              </Txt>
            )}
          </View>

          {/* Primary Action */}
          {isLowRating ? (
            <Pressable
              onPress={openFeedback}
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: "#1F2433", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", transform: [{ scale: pressed ? 0.98 : 1 }] }]}
            >
              <MessageSquareHeart size={17} color="#FF385C" />
              <Txt size={15} font="sansBold" style={{ color: "#FFFFFF" }}>
                Send us feedback
              </Txt>
            </Pressable>
          ) : (
            <Pressable
              onPress={openPlayStore}
              style={({ pressed }) => ({ width: "100%", transform: [{ scale: pressed ? 0.98 : 1 }] })}
            >
              <LinearGradient
                colors={["#FF385C", "#E11D48"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtn}
              >
                <Star size={16} color="#FFFFFF" fill="#FFFFFF" />
                <Txt size={15} font="sansBold" style={{ color: "#FFFFFF" }}>
                  {rating >= 4 ? `Rate ${rating}★ on Google Play` : "Rate on Google Play"}
                </Txt>
                <ExternalLink size={15} color="#FFFFFF" />
              </LinearGradient>
            </Pressable>
          )}

          {/* Secondary Actions */}
          <View style={styles.secRow}>
            {isLowRating ? (
              <Pressable onPress={openPlayStore} hitSlop={8}>
                <Txt size={12.5} font="sansSemi" tone="muted">
                  Rate on Play Store anyway
                </Txt>
              </Pressable>
            ) : (
              <Pressable onPress={() => closeWith("later")} hitSlop={8}>
                <Txt size={13} font="sansSemi" tone="muted">
                  Maybe later
                </Txt>
              </Pressable>
            )}
            {canDismissForever ? (
              <>
                <Txt size={12} tone="subtle">·</Txt>
                <Pressable onPress={() => closeWith("done")} hitSlop={8}>
                  <Txt size={12.5} tone="subtle">
                    Don&apos;t ask again
                  </Txt>
                </Pressable>
              </>
            ) : null}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 18,
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    shadowColor: "#F59E0B",
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 20,
    marginBottom: 10,
  },
  starBtn: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.09)",
    alignItems: "center",
    justifyContent: "center",
  },
  starBtnActive: {
    backgroundColor: "rgba(251, 191, 36, 0.14)",
    borderColor: "rgba(251, 191, 36, 0.45)",
  },
  primaryBtn: {
    width: "100%",
    height: 50,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 14,
  },
});
