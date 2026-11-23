import React, { useEffect, useReducer, useState } from "react";
import { View, Pressable, ScrollView, Dimensions, StyleSheet, Image as RNImage } from "react-native";
import { Timer, ArrowUpRight, Heart } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";
import { PosterFill } from "@/components/AppImage";
import { assetUrl } from "@/lib/api";
import { Pulse } from "@/components/motion";
import { countdownParts } from "@/lib/format";
import { compId, type CompRow } from "@/lib/competition";

const SCREEN_W = Dimensions.get("window").width;
const RED = "#FF385C";
const INK = "#0B0B0E";

/** "2d 04:12:09" until the poll closes; nothing once it has. */
function Countdown({ to }: { to: string }) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const p = countdownParts(to);
  if (!p || p.done) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <View style={s.glassChip}>
      <Timer size={12} color="#FFFFFF" />
      <Txt size={11.5} font="sansBold" style={{ color: "#FFFFFF", fontVariant: ["tabular-nums"] }}>
        {p.days ? `${p.days}d ` : ""}
        {pad(p.hours)}:{pad(p.minutes)}:{pad(p.seconds)}
      </Txt>
    </View>
  );
}

/** The banner's real width/height ratio, clamped so a tall poster can't take over the page. */
function useAspect(uri?: string | null, fallback = 16 / 10) {
  const [ratio, setRatio] = useState(fallback);
  useEffect(() => {
    const src = assetUrl(uri ?? undefined);
    if (!src) return;
    let alive = true;
    RNImage.getSize(
      src,
      (w, h) => alive && w > 0 && h > 0 && setRatio(Math.min(1.9, Math.max(0.8, w / h))),
      () => {}
    );
    return () => {
      alive = false;
    };
  }, [uri]);
  return ratio;
}

/**
 * One competition whose audience poll is open right now. The banner is shown
 * whole (never cropped) at its own proportions; the copy sits underneath.
 * Two doors: the card opens the competition, "Cast your vote" opens the
 * leaderboard where voting actually happens.
 *
 * `compact` is the home-screen size; the full size tops the competitions screen.
 */
export function LiveVoteCard({
  comp,
  width,
  compact,
  onPress,
  onVote,
}: {
  comp: CompRow;
  width: number;
  compact?: boolean;
  onPress: () => void;
  onVote?: () => void;
}) {
  const votes = Number(comp.total_votes ?? comp.vote_count ?? comp.votes ?? 0);
  const entries = Number(comp.contestant_count ?? comp.submission_count ?? comp.participant_count ?? 0);
  const endsAt = comp.voting_ends_at || comp.voting_end_date || comp.voting_deadline || comp.voting_end;
  const title = comp.title || comp.name || "Live poll";
  const image = comp.image_url || comp.banner_url;
  const ratio = useAspect(image);

  const facts = [
    votes > 0 ? `${votes.toLocaleString("en-IN")} votes` : null,
    entries > 0 ? `${entries} in the running` : null,
    comp.prize ? `${comp.prize} prize` : null,
  ].filter(Boolean) as string[];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${title}`}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.99 : 1 }] }]}
    >
      <View style={[s.card, { width }]}>
        {/* the whole banner, at its own shape */}
        <View style={{ width: "100%", height: Math.round((width - 2) / ratio) }}>
          <PosterFill uri={image} seed={compId(comp)} />
          <View style={s.topRow}>
            <View style={s.liveChip}>
              <Pulse min={0.35} period={1000}>
                <View style={s.liveDot} />
              </Pulse>
              <Txt size={10.5} font="sansExt" tracking={1.4} style={{ color: "#FFFFFF" }}>VOTING LIVE</Txt>
            </View>
            {endsAt ? <Countdown to={String(endsAt)} /> : null}
          </View>
        </View>

        {/* what it is, and the way in */}
        <View style={s.body}>
          {comp.category ? (
            <Txt size={11} font="sansBold" tracking={1.6} uppercase style={{ color: "rgba(255,255,255,0.6)", marginBottom: 6 }}>
              {String(comp.category)}
            </Txt>
          ) : null}
          <Txt size={compact ? 20 : 22} font="display" tracking={-0.5} lh={compact ? 24 : 27} numberOfLines={2} style={{ color: "#FFFFFF" }}>
            {title}
          </Txt>
          {facts.length ? (
            <Txt size={12.5} numberOfLines={1} style={{ color: "rgba(255,255,255,0.62)", marginTop: 6 }}>
              {facts.join("  ·  ")}
            </Txt>
          ) : null}

          <Pressable
            onPress={onVote ?? onPress}
            accessibilityRole="button"
            accessibilityLabel={`Cast your vote in ${title}`}
            style={({ pressed }) => [s.cta, { opacity: pressed ? 0.9 : 1 }]}
          >
            <Heart size={16} color={RED} fill={RED} />
            <Txt size={14} font="sansBold" style={{ color: INK, flex: 1 }}>Cast your vote</Txt>
            <View style={s.ctaArrow}>
              <ArrowUpRight size={15} color="#FFFFFF" strokeWidth={2.6} />
            </View>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * The live-voting shelf. Renders nothing at all when no poll is open, so it
 * never leaves an empty heading behind.
 */
export function LiveVotingBand({
  rows,
  onOpen,
  onVote,
  compact,
  title = "Voting is open",
}: {
  rows: CompRow[];
  /** Card tap — the competition's details. */
  onOpen: (id: string) => void;
  /** "Cast your vote" — the leaderboard. Falls back to onOpen. */
  onVote?: (id: string) => void;
  compact?: boolean;
  title?: string;
}) {
  const { c } = useTheme();
  if (!rows?.length) return null;
  const one = rows.length === 1;
  const gutter = compact ? 20 : 0;
  const CW = one ? SCREEN_W - 40 : SCREEN_W - 72;

  return (
    <View style={{ marginBottom: compact ? 0 : 24 }}>
      <View style={[s.head, { paddingHorizontal: gutter }]}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={s.headDotWrap}>
              <Pulse min={0.2} period={1400}>
                <View style={s.headHalo} />
              </Pulse>
              <View style={s.headDot} />
            </View>
            <Txt size={20} font="sansBold" tracking={-0.3} style={{ color: c.fg }}>{title}</Txt>
          </View>
          <Txt size={12.5} tone="muted" style={{ marginTop: 4 }}>
            Back your favourite — every vote moves the leaderboard.
          </Txt>
        </View>
        {rows.length > 1 ? (
          <View style={s.count}>
            <Txt size={11} font="sansExt" style={{ color: RED }}>{rows.length} live</Txt>
          </View>
        ) : null}
      </View>

      {one ? (
        <View style={{ paddingHorizontal: gutter }}>
          <LiveVoteCard
            comp={rows[0]}
            width={compact ? SCREEN_W - 40 : CW}
            compact={compact}
            onPress={() => onOpen(compId(rows[0]))}
            onVote={onVote ? () => onVote(compId(rows[0])) : undefined}
          />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CW + 12}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: gutter, gap: 12 }}
        >
          {rows.map((r) => (
            <LiveVoteCard
              key={compId(r)}
              comp={r}
              width={CW}
              compact={compact}
              onPress={() => onOpen(compId(r))}
              onVote={onVote ? () => onVote(compId(r)) : undefined}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#15161C",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  body: { padding: 16 },
  topRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: RED,
  },
  liveDot: { width: 7, height: 7, borderRadius: 999, backgroundColor: "#FFFFFF" },
  glassChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(11,11,14,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 48,
    marginTop: 16,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  ctaArrow: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
  },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  headDotWrap: { width: 14, height: 14, alignItems: "center", justifyContent: "center" },
  headHalo: { position: "absolute", width: 14, height: 14, borderRadius: 999, backgroundColor: RED + "55", left: -7, top: -7 },
  headDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: RED },
  count: {
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    justifyContent: "center",
    backgroundColor: RED + "1F",
    borderWidth: 1,
    borderColor: RED + "4D",
    marginTop: 2,
  },
});
