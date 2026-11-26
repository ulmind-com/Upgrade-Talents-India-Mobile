import React from "react";
import { View, Pressable, ScrollView, Dimensions, AccessibilityInfo, type NativeSyntheticEvent, type NativeScrollEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { ChevronRight, Flame, Star } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { playNavFeedback } from "@/lib/sound";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { initials } from "@/lib/format";
import type { TestimonialItem } from "@/lib/api";

/* ──────────────────────────────────────────────────────────────────────────
   Home sections — one quiet grammar for the whole page.

   Every section uses the SAME head (title + chevron, optional "See all",
   one muted sub-line) and the same card surface. No per-section tinted
   bands, no wave dividers, no sectional accent colours: the page stays on
   pure black and the brand accent is spent only on what is tappable or
   genuinely urgent. That restraint is what makes the scroll read as one
   product instead of a stack of templates.
   ────────────────────────────────────────────────────────────────────────── */

const { width: SCREEN_W } = Dimensions.get("window");

export const GUTTER = 20;
/** 8-pt rhythm: a new section is two steps away from the one above it. */
export const SECTION_GAP = 32;

export function SectionHead({
  title,
  sub,
  onPress,
  actionLabel = "See all",
}: {
  title: string;
  sub?: string;
  onPress?: () => void;
  actionLabel?: string;
}) {
  return (
    <View style={{ paddingHorizontal: GUTTER, marginBottom: sub ? 14 : 12 }}>
      <Pressable
        disabled={!onPress}
        onPress={onPress}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, flex: 1 }}>
          <Txt size={20} font="sansBold" style={{ color: "#ffffff", letterSpacing: -0.3 }} numberOfLines={1}>
            {title}
          </Txt>
          {onPress ? <ChevronRight size={18} color="#ffffff" strokeWidth={2.4} /> : null}
        </View>
        {onPress ? (
          <Txt size={12.5} font="sansBold" style={{ color: "#ff385c" }}>
            {actionLabel}
          </Txt>
        ) : null}
      </Pressable>
      {sub ? (
        <Txt size={12.5} style={{ color: "#9ea3b8", marginTop: 3 }}>
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}

/* ─────────────── Poster rail (competitions) ─────────────── */

export type RailItem = {
  id: string;
  title: string;
  image?: string | null;
  /** One factual line — when it closes, where it is. */
  sub?: string;
  /** Social proof, shown in amber like the rest of the app's "heat" cues. */
  hype?: string;
  onPress: () => void;
};

const POSTER_W = 232;

export function PosterRail({ items, autoSlide = true }: { items: RailItem[]; autoSlide?: boolean }) {
  const { c } = useTheme();
  if (!items.length) return null;
  const cards = items.map((it) => (
    <Pressable
      key={it.id}
      onPress={it.onPress}
      style={({ pressed }) => ({ width: POSTER_W, transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <View
        style={{
          height: 320,
          borderRadius: 20,
          overflow: "hidden",
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
        }}
      >
        <AppImage uri={it.image} seed={it.id} style={{ width: "100%", height: "100%" }} />
        {/* the caption needs a floor to sit on, not a decorative wash */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.92)"] as any}
          locations={[0.35, 0.6, 1]}
          style={{ position: "absolute", width: "100%", height: "100%" }}
        />
        {it.hype ? (
          <View
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 30,
              height: 30,
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.45)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.16)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Flame size={14} color="#fbbf24" />
          </View>
        ) : null}
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 12, gap: 3 }}>
          <Txt size={16} font="sansBold" lh={20} numberOfLines={2} style={{ color: "#ffffff" }}>
            {it.title}
          </Txt>
          {it.sub ? (
            <Txt size={12} numberOfLines={1} style={{ color: "rgba(255,255,255,0.70)" }}>
              {it.sub}
            </Txt>
          ) : null}
          {it.hype ? (
            <Txt size={12} font="sansBold" style={{ color: "#fbbf24" }} numberOfLines={1}>
              {it.hype}
            </Txt>
          ) : null}
        </View>
      </View>
    </Pressable>
  ));

  if (autoSlide) {
    return (
      <AutoRail itemWidth={POSTER_W} gap={12} interval={3400}>
        {cards}
      </AutoRail>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={POSTER_W + 12}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 12 }}
    >
      {cards}
    </ScrollView>
  );
}

/* ─────────────── Grouped picks (courses / workshops) ─────────────── */

export type PickRow = {
  id: string;
  thumb?: string | null;
  /** The one thing worth scanning first — a fee, a date, a status. */
  top: string;
  title: string;
  sub?: string;
  onPress: () => void;
};

export type PickGroup = {
  key: string;
  title: string;
  countLabel: string;
  rows: PickRow[];
  onAll: () => void;
};

const GROUP_W = Math.min(SCREEN_W - 72, 320);

export function GroupedPicks({ groups }: { groups: PickGroup[] }) {
  const { c } = useTheme();
  const shown = groups.filter((g) => g.rows.length);
  if (!shown.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={GROUP_W + 12}
      decelerationRate="fast"
      contentContainerStyle={{ paddingHorizontal: GUTTER, gap: 12 }}
    >
      {shown.map((g) => (
        <View
          key={g.key}
          style={{
            width: GROUP_W,
            borderRadius: 22,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
            padding: 16,
          }}
        >
          <Pressable
            onPress={g.onAll}
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <View style={{ flex: 1 }}>
              <Txt size={17} font="sansBold" style={{ color: "#ffffff", letterSpacing: -0.2 }} numberOfLines={1}>
                {g.title}
              </Txt>
              <Txt size={12.5} tone="subtle" style={{ marginTop: 2 }}>
                {g.countLabel}
              </Txt>
            </View>
            <ChevronRight size={20} color={c.fgSubtle} />
          </Pressable>

          <View style={{ marginTop: 14, gap: 14 }}>
            {g.rows.slice(0, 3).map((r) => (
              <Pressable
                key={r.id}
                onPress={r.onPress}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  gap: 12,
                  alignItems: "center",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 12,
                    overflow: "hidden",
                    backgroundColor: c.surface2,
                  }}
                >
                  <AppImage uri={r.thumb} seed={r.id} style={{ width: "100%", height: "100%" }} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt size={12.5} font="sansBold" style={{ color: "#fbbf24" }} numberOfLines={1}>
                    {r.top}
                  </Txt>
                  <Txt size={14.5} font="sansBold" lh={19} numberOfLines={2} style={{ color: "#ffffff" }}>
                    {r.title}
                  </Txt>
                  {r.sub ? (
                    <Txt size={12} tone="subtle" numberOfLines={1}>
                      {r.sub}
                    </Txt>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

/* ─────────────── Numbers so far ─────────────── */

export type Stat = { value: string; label: string };

export function NumbersStrip({ stats }: { stats: Stat[] }) {
  const { c } = useTheme();
  const shown = stats.filter((s) => s.value);
  if (!shown.length) return null;
  return (
    <View style={{ paddingHorizontal: GUTTER }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "stretch",
          borderRadius: 20,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          paddingVertical: 18,
        }}
      >
        {shown.map((s, i) => (
          <React.Fragment key={s.label}>
            {i > 0 ? <View style={{ width: 1, backgroundColor: c.border, marginVertical: 2 }} /> : null}
            <View style={{ flex: 1, alignItems: "center", paddingHorizontal: 6, gap: 4 }}>
              <Txt size={20} font="sansExt" style={{ color: "#ffffff", letterSpacing: -0.4 }}>
                {s.value}
              </Txt>
              <Txt size={10} font="sansBold" tracking={1} uppercase tone="subtle" numberOfLines={1}>
                {s.label}
              </Txt>
            </View>
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

/* ─────────────── Voices (testimonials) ─────────────── */

/* Background-free cut-out of the mascot. The source art shipped on a flat
   navy, which forced the whole block into a navy card just to hide it — a
   card the section never wanted. With the matte removed the figure simply
   stands on the page like every other element. */
const CHARACTER_SRC = require("../../assets/banners/3d_avatar_character_cutout.png");

/** Up to four faces, overlapped — proof that real people are behind this. */
function AvatarStack({ people }: { people: TestimonialItem[] }) {
  if (!people.length) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {people.slice(0, 4).map((t, i) => (
        <View
          key={t._id}
          style={{
            width: 26,
            height: 26,
            borderRadius: 999,
            overflow: "hidden",
            borderWidth: 2,
            borderColor: "#000000",
            backgroundColor: "#3a4150",
            marginLeft: i === 0 ? 0 : -9,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {t.profile_image ? (
            <AppImage uri={t.profile_image} seed={t._id} style={{ width: "100%", height: "100%" }} />
          ) : (
            <Txt size={9.5} font="sansExt" style={{ color: "#ffffff" }}>
              {initials(t.person_name)}
            </Txt>
          )}
        </View>
      ))}
    </View>
  );
}

/** Average of whatever ratings the CMS actually sent.
 *
 *  Testimonials carry no rating field today (person_name, role, message,
 *  profile_image and the publish flags — that is the whole record), so this
 *  returns null and the hero shows the real review count instead. The moment
 *  a `rating` starts arriving on even some rows, the score appears on its
 *  own and tracks the data. Nothing here is hard-coded. */
export type ParsedReview = {
  rating: number | null;
  cleanMessage: string;
};

/**
 * 100% dynamic parsing of testimonial review data.
 * - Extracts numeric rating from `rating` field or leading star emojis (e.g. ⭐⭐⭐⭐⭐ or ★★★★★)
 * - Strips duplicate raw emoji stars from the message body so stars are NOT displayed twice!
 * - Unrated testimonials (like John Doe) have `rating: null` (NO hardcoded fake stars).
 */
export function parseReviewData(item: TestimonialItem): ParsedReview {
  const rawNum = Number((item as any).rating);
  let rating: number | null = Number.isFinite(rawNum) && rawNum >= 1 && rawNum <= 5 ? rawNum : null;
  let cleanMessage = (item.message || "").trim();

  if (rating === null) {
    const starMatch = cleanMessage.match(/^([⭐★🌟✰\u2B50\u2605]+)/u);
    if (starMatch && starMatch[1]) {
      const count = Array.from(starMatch[1]).length;
      if (count >= 1 && count <= 5) {
        rating = count;
        cleanMessage = cleanMessage.slice(starMatch[0].length).replace(/^[\r\n\s]+/, "").trim();
      }
    }
  } else {
    cleanMessage = cleanMessage.replace(/^([⭐★🌟✰\u2B50\u2605]+)[\r\n\s]*/u, "").trim();
  }

  // Strip wrapping quotes if any
  cleanMessage = cleanMessage.replace(/^["“](.*)["”]$/s, "$1").trim();

  return { rating, cleanMessage };
}

export function averageRating(people: TestimonialItem[]): { avg: number | null; ratedCount: number } {
  const parsed = people.map(parseReviewData);
  const rated = parsed.filter((p) => p.rating !== null).map((p) => p.rating as number);
  if (!rated.length) return { avg: null, ratedCount: 0 };
  const avg = rated.reduce((a, b) => a + b, 0) / rated.length;
  return { avg, ratedCount: rated.length };
}

/** The section's anchor: the real numbers, the faces behind them, and the
    mascot. No card and no panel — the figure and the figures sit straight on
    the page, so this reads as part of the section, not a banner in it. */
export function VoicesHero({ people }: { people: TestimonialItem[] }) {
  const count = people.length;
  const { avg, ratedCount } = React.useMemo(() => averageRating(people), [people]);
  const filled = avg !== null ? Math.round(avg) : 0;

  return (
    <View style={{ height: 148, justifyContent: "center" }}>
      {/* 3D mascot fully contained without side or bottom cutoffs */}
      <Image
        source={CHARACTER_SRC}
        style={{ position: "absolute", right: 12, bottom: 0, width: 124, height: 148 }}
        contentFit="contain"
        contentPosition="bottom center"
        transition={150}
        pointerEvents="none"
      />

      <View style={{ paddingLeft: GUTTER, paddingRight: 140, gap: 8 }}>
        {/* the count is always real, so it leads */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 7 }}>
          <Txt size={36} font="sansExt" lh={37} style={{ color: "#ffffff", letterSpacing: -1.4 }}>
            {count}
          </Txt>
          <Txt size={12.5} font="sansBold" style={{ color: "rgba(255,255,255,0.45)", paddingBottom: 5 }}>
            {count === 1 ? "story" : "stories"}
          </Txt>
        </View>

        {/* Dynamic Star Rating row: ONLY shown if ratings exist in the data! */}
        {avg !== null && ratedCount > 0 ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <View style={{ flexDirection: "row", gap: 1.5 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Star
                  key={i}
                  size={12}
                  color={i < filled ? "#fbbf24" : "rgba(255,255,255,0.22)"}
                  fill={i < filled ? "#fbbf24" : "transparent"}
                />
              ))}
            </View>
            <Txt size={13.5} font="sansExt" style={{ color: "#ffffff" }}>
              {avg.toFixed(1)}
            </Txt>
            <Txt size={11.5} font="sansBold" style={{ color: "rgba(255,255,255,0.45)" }} numberOfLines={1}>
              avg · {ratedCount} rated
            </Txt>
          </View>
        ) : null}

        {count ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <AvatarStack people={people} />
            <Txt size={11.5} font="sansBold" style={{ color: "rgba(255,255,255,0.5)" }} numberOfLines={1}>
              from {count} {count === 1 ? "performer" : "performers"}
            </Txt>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** A quote card that reads like a person, not a review widget. Tap opens full review modal. */
export function VoiceCard({
  t,
  width = 288,
  onPress,
}: {
  t: TestimonialItem;
  width?: number;
  onPress?: () => void;
}) {
  const { c } = useTheme();
  const { rating, cleanMessage } = React.useMemo(() => parseReviewData(t), [t]);

  return (
    <Pressable
      onPress={() => {
        if (onPress) {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch {}
          playNavFeedback();
          onPress();
        }
      }}
      style={({ pressed }) => ({
        width,
        borderRadius: 22,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
        padding: 18,
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      {/* person first — the name is the credential, not the stars */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            overflow: "hidden",
            backgroundColor: c.surface2,
            borderWidth: 1.5,
            borderColor: c.accent + "66",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {t.profile_image ? (
            <AppImage uri={t.profile_image} seed={t._id} style={{ width: "100%", height: "100%" }} />
          ) : (
            <Txt size={14} font="sansExt" tone="accent">
              {initials(t.person_name)}
            </Txt>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Txt size={14.5} font="sansBold" numberOfLines={1} style={{ color: "#ffffff" }}>
            {t.person_name}
          </Txt>
          {t.role ? (
            <Txt size={12} tone="subtle" numberOfLines={1} style={{ marginTop: 1 }}>
              {t.role}
            </Txt>
          ) : null}
        </View>

        {/* Stars ONLY if reviewer gave a rating! If unrated (e.g. John Doe), NO STARS! */}
        {rating !== null ? (
          <View style={{ flexDirection: "row", gap: 1.5 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Star
                key={i}
                size={10.5}
                color={i < Math.round(rating) ? "#fbbf24" : "rgba(255,255,255,0.22)"}
                fill={i < Math.round(rating) ? "#fbbf24" : "transparent"}
              />
            ))}
          </View>
        ) : null}
      </View>

      {/* Clean review text without duplicate emoji stars */}
      <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
        <View style={{ width: 2, borderRadius: 999, backgroundColor: c.accent + "59" }} />
        <Txt size={15} font="sansMed" lh={23} numberOfLines={5} style={{ flex: 1, minHeight: 92 }}>
          {cleanMessage}
        </Txt>
      </View>

      {/* Read full review tap affordance */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 12,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: "rgba(255, 255, 255, 0.06)",
        }}
      >
        <Txt size={11.5} font="sansBold" style={{ color: "#ff385c" }}>
          Read full review
        </Txt>
        <ChevronRight size={13} color="#ff385c" />
      </View>
    </Pressable>
  );
}


/* ─────────────── Auto-advancing rail ─────────────── */

/**
 * A horizontal rail that walks itself forward.
 *
 * Quotes only work if they are seen, and a rail that never moves reads as a
 * static card with some dead space to its right — most people never swipe
 * it. This nudges to the next card on a timer and wraps at the end.
 *
 * It yields to the reader: the moment a finger lands it stops, and it only
 * picks up again a few seconds after the last interaction, resuming from
 * wherever they left it rather than snapping back. It also stays still for
 * anyone who has asked the system to reduce motion.
 */
export function AutoRail({
  itemWidth,
  gap = 12,
  interval = 3600,
  resumeAfter = 6000,
  contentPadding = GUTTER,
  children,
}: {
  itemWidth: number;
  gap?: number;
  interval?: number;
  resumeAfter?: number;
  contentPadding?: number;
  children: React.ReactNode;
}) {
  const ref = React.useRef<React.ComponentRef<typeof ScrollView>>(null);
  const index = React.useRef(0);
  const paused = React.useRef(false);
  const resumeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reduceMotion, setReduceMotion] = React.useState(false);

  const count = React.Children.count(children);
  const step = itemWidth + gap;

  React.useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => { if (alive) setReduceMotion(on); })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { alive = false; sub?.remove?.(); };
  }, []);

  React.useEffect(() => {
    if (reduceMotion || count < 2) return;
    const t = setInterval(() => {
      if (paused.current) return;
      index.current = (index.current + 1) % count;
      ref.current?.scrollTo({ x: index.current * step, animated: true });
    }, interval);
    return () => clearInterval(t);
  }, [reduceMotion, count, step, interval]);

  React.useEffect(
    () => () => { if (resumeTimer.current) clearTimeout(resumeTimer.current); },
    []
  );

  const hold = () => {
    paused.current = true;
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  };

  /* Carry on from the card they stopped on, not from where the timer was. */
  const release = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    index.current = Math.round(e.nativeEvent.contentOffset.x / step);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => { paused.current = false; }, resumeAfter);
  };

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={step}
      decelerationRate="fast"
      scrollEventThrottle={16}
      onScrollBeginDrag={hold}
      onScrollEndDrag={release}
      onMomentumScrollEnd={release}
      contentContainerStyle={{ gap, paddingHorizontal: contentPadding }}
    >
      {children}
    </ScrollView>
  );
}
