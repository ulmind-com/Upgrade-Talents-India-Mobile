import React, { useEffect, useRef } from "react";
import { View, Pressable, ScrollView, Animated, Easing, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Quote, Star, ChevronRight, BadgeCheck, Trophy, ArrowUpRight, Timer } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt, Glow, SectionLabel } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { initials, isUsableImageUrl } from "@/lib/format";
import type { TestimonialItem, BannerItem, ContestPromotion } from "@/lib/api";
import { DiagonalStripes } from "@/components/patterns";
import { genz } from "@/theme/tokens";
import { airState, countdownText, startsInText } from "@/lib/live";

const { width: SW } = Dimensions.get("window");
const SCREEN_W = SW;

/* ─────────────── Full-bleed section background band ───────────────
   Gives a home section its own tinted "zone" with a faint wordmark behind,
   like the reference. Each section passes a different colour/wordmark. */
export function SectionBand({
  eyebrow,
  title,
  wordmark,
  color,
  gradient,
  glow,
  light,
  onMore,
  children,
}: {
  eyebrow: string;
  title: string;
  wordmark: string;
  color?: string;
  gradient?: string[];
  glow?: string;
  light?: boolean;
  onMore?: () => void;
  children: React.ReactNode;
}) {
  const { c, fonts } = useTheme();
  const titleColor = light ? "#ffffff" : c.fg;
  const moreColor = c.accent;
  return (
    <View style={{ marginTop: 26, paddingVertical: 22, overflow: "hidden" }}>
      {gradient ? (
        <LinearGradient colors={gradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", width: "100%", height: "100%" }} />
      ) : (
        <View style={{ position: "absolute", width: "100%", height: "100%", backgroundColor: color }} />
      )}
      {glow ? <Glow color={glow} size={300} top={-120} right={-90} /> : null}

      {/* faint wordmark */}
      <Txt size={92} font="display" style={{ position: "absolute", top: 8, left: -8, color: light ? "rgba(255,255,255,0.06)" : "rgba(127,127,127,0.08)", letterSpacing: -4 }} numberOfLines={1}>
        {wordmark}
      </Txt>

      <View style={{ paddingHorizontal: 20, marginBottom: 16, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <View style={{ gap: 8 }}>
          <SectionLabel>{eyebrow}</SectionLabel>
          <Txt size={22} font="display" tracking={-0.5} style={{ color: titleColor }}>{title}</Txt>
        </View>
        {onMore ? (
          <Pressable onPress={onMore} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <Txt size={12.5} font="sansBold" uppercase tracking={1} style={{ color: moreColor }}>See all</Txt>
            <ChevronRight size={16} color={moreColor} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/* ─────────────── Auto-scrolling partner marquee ─────────────── */
const TILE_W = 150;
const GAP = 12;

export function PartnerMarquee({ banners, reverse = false }: { banners: BannerItem[]; reverse?: boolean }) {
  const { c } = useTheme();
  const x = useRef(new Animated.Value(0)).current;
  const unit = TILE_W + GAP;
  const total = banners.length * unit;

  useEffect(() => {
    if (!total) return;
    const from = reverse ? -total : 0;
    const to = reverse ? 0 : -total;
    x.setValue(from);
    const loop = Animated.loop(
      Animated.timing(x, { toValue: to, duration: Math.max(6000, total * 26), easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [total, reverse]);

  if (!banners.length) return null;
  const row = [...banners, ...banners]; // duplicate for seamless loop

  return (
    <View style={{ overflow: "hidden" }}>
      <Animated.View style={{ flexDirection: "row", gap: GAP, transform: [{ translateX: x }] }}>
        {row.map((b, i) => (
          <View key={`${b._id}-${i}`} style={{ width: TILE_W, height: 82, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface, alignItems: "center", justifyContent: "center", padding: 10 }}>
            <AppImage uri={b.image_url} seed={b._id} style={{ width: "100%", height: "100%" }} contentFit="contain" />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

/* ─────────────── Gen-Z review card ─────────────── */
export function ReviewCard({ t, width = 290 }: { t: TestimonialItem; width?: number }) {
  const { c } = useTheme();
  const hasImg = isUsableImageUrl(t.profile_image);
  return (
    <View style={{ width, borderRadius: 26, overflow: "hidden", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 18 }}>
      {/* big faint quote mark */}
      <Quote size={92} color={c.accent + "16"} fill={c.accent + "16"} style={{ position: "absolute", top: -14, right: -8 }} />

      {/* rating */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={15} color="#ffb300" fill="#ffb300" />
        ))}
        <Txt size={13.5} font="sansExt" style={{ marginLeft: 6 }}>5.0</Txt>
      </View>

      {/* message */}
      <Txt size={15.5} font="sansMed" lh={23} style={{ marginTop: 14, minHeight: 92 }} numberOfLines={4}>{t.message}</Txt>

      {/* author */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.border }}>
        <View style={{ width: 44, height: 44, borderRadius: 999, padding: 2, borderWidth: 2, borderColor: c.accent, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
          {hasImg ? (
            <AppImage uri={t.profile_image} seed={t._id} style={{ width: "100%", height: "100%", borderRadius: 999 }} />
          ) : (
            <View style={{ width: "100%", height: "100%", borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }}>
              <Txt size={15} font="display" tone="accent">{initials(t.person_name)}</Txt>
            </View>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Txt size={14.5} font="sansExt" numberOfLines={1} style={{ flexShrink: 1 }}>{t.person_name}</Txt>
            <BadgeCheck size={15} color={c.accent} fill={c.accent + "33"} />
          </View>
          {t.role ? <Txt size={11.5} tone="subtle" numberOfLines={1}>{t.role}</Txt> : null}
        </View>
      </View>
    </View>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   ContestBand — the website's competition teaser, as a swipeable deck.
   ──────────────────────────────────────────────────────────────────────── */

export function ContestBand({ items, onEnter, onLeaderboard }: { items: ContestPromotion[]; onEnter: (p: ContestPromotion) => void; onLeaderboard: (p: ContestPromotion) => void }) {
  const { c } = useTheme();
  const shine = useRef(new Animated.Value(0)).current;
  /* A banner can carry its own poll window, so the countdown has to tick. */
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(shine, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(shine, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  if (!items?.length) return null;
  const CW = SCREEN_W - 40;

  return (
    <View style={{ marginTop: 30 }}>
      <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Trophy size={13} color="#f0407e" />
          <Txt size={11} font="monoMed" tracking={2.5} uppercase style={{ color: "#f0407e" }}>Competition</Txt>
        </View>
        <Txt size={23} font="display" tracking={-0.5} style={{ marginTop: 8 }}>Take the floor</Txt>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={CW + 12} decelerationRate="fast" contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
        {items.map((p, i) => {
          const [g0, g1] = genz(i + 2);
          /* The banner's own voting window — null/null means the admin set no
             window, so the card makes no claim about a poll either way. */
          const hasWindow = !!(p.voting_start || p.voting_end);
          const poll = hasWindow ? airState(p.voting_start, p.voting_end) : null;
          const closes = poll === "live" ? countdownText(p.voting_end) : null;
          const opensIn = poll === "upcoming" ? startsInText(p.voting_start) : null;
          /* The admin writes the button; the app does not invent a label. */
          const cta = (p.cta_text || "").trim() || (poll === "ended" ? "See results" : "Enter now");
          return (
            <Pressable key={p._id} onPress={() => onEnter(p)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
              <View style={{ width: CW, height: 300, borderRadius: 28, overflow: "hidden", shadowColor: g1, shadowOpacity: 0.45, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, elevation: 12 }}>
                <AppImage uri={p.image_url} seed={p._id} style={{ position: "absolute", width: "100%", height: "100%" }} />
                <LinearGradient colors={[g0 + "26", "rgba(6,6,14,0.55)", "rgba(6,6,14,0.95)"] as any} locations={[0, 0.45, 1]} style={{ position: "absolute", width: "100%", height: "100%" }} />
                <DiagonalStripes color={g0} opacity={0.12} gap={20} w={7} />

                {/* foil sweep */}
                <Animated.View
                  pointerEvents="none"
                  style={{
                    position: "absolute", top: -60, bottom: -60, width: 110,
                    transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-CW * 0.4, CW * 1.1] }) }, { rotate: "16deg" }],
                  }}
                >
                  <LinearGradient colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.18)", "rgba(255,255,255,0)"] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
                </Animated.View>

                <View style={{ flex: 1, padding: 20, justifyContent: "flex-end" }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 7, marginBottom: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: poll === "ended" ? "rgba(255,255,255,0.18)" : g1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 }}>
                      <Trophy size={12} color="#fff" />
                      <Txt size={10} font="sansBold" tracking={1.2} style={{ color: "#fff" }} uppercase>
                        {poll === "live" ? "Voting live" : poll === "upcoming" ? "Voting soon" : poll === "ended" ? "Voting closed" : cta}
                      </Txt>
                    </View>
                    {closes ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", backgroundColor: "rgba(0,0,0,0.42)", paddingHorizontal: 9, paddingVertical: 4 }}>
                        <Timer size={11} color="#fff" />
                        <Txt size={10.5} font="monoMed" style={{ color: "#fff" }}>{closes} left</Txt>
                      </View>
                    ) : opensIn ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)", backgroundColor: "rgba(0,0,0,0.42)", paddingHorizontal: 9, paddingVertical: 4 }}>
                        <Timer size={11} color="#fff" />
                        <Txt size={10.5} font="monoMed" style={{ color: "#fff" }}>{opensIn}</Txt>
                      </View>
                    ) : null}
                  </View>
                  <Txt size={27} font="display" tracking={-0.8} lh={30} numberOfLines={2} style={{ color: "#fff" }}>{p.title}</Txt>
                  {p.description ? (
                    <Txt size={13} lh={19} numberOfLines={2} style={{ color: "rgba(255,255,255,0.72)", marginTop: 8 }}>{p.description}</Txt>
                  ) : null}

                  <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                    <Pressable onPress={() => onEnter(p)} style={{ flex: 1 }}>
                      <LinearGradient
                        colors={(poll === "ended" ? ["#6b7280", "#374151"] : [g0, g1]) as any}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{ height: 46, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}
                      >
                        <Txt size={13.5} font="sansBold" style={{ color: "#fff" }} numberOfLines={1}>{cta}</Txt>
                        <ArrowUpRight size={16} color="#fff" />
                      </LinearGradient>
                    </Pressable>
                    <Pressable onPress={() => onLeaderboard(p)} style={{ height: 46, paddingHorizontal: 18, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)", backgroundColor: "rgba(255,255,255,0.08)" }}>
                      <Txt size={13.5} font="sansBold" style={{ color: "#fff" }}>Leaderboard</Txt>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
