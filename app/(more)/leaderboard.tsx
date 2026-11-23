import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Pressable,
  ScrollView,
  TextInput,
  StyleSheet,
  Dimensions,
  Animated,
  RefreshControl,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import {
  ChevronLeft,
  SlidersHorizontal,
  Search,
  Heart,
  Sparkles,
  TrendingUp,
  Trophy,
  UserCheck,
  X,
  Check,
  Clock,
  Share2,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { publicApi, competeApi, safe, toRows } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useSession } from "@/context/Session";
import { Txt, Skeleton, EmptyState } from "@/components/ui";
import { VerifiedTick } from "@/components/VerifiedBadge";
import { useAlert } from "@/components/Popup";
import { playNavFeedback } from "@/lib/sound";
import { ShareSheet } from "@/components/ShareSheet";
import { Podium, RankLaurel, type PodiumEntry } from "@/components/Podium";

/* ──────────────────────────────────────────────────────────────────────────
   Leaderboard — 3D Glass Block Podium & Championship Table
   Matched 1:1 with the reference screenshot:
   - Top 3 3D Glass Pedestal Blocks with Laurel Wreaths (1, 2, 3) on front face
   - Center block (Rank 1) elevated with glowing golden neon wireframe rim
   - Floating contestants above each block with glowing rings (Pink, Cyan, Amber)
   - Spotlight Prize Pool banner below podium
   - Championship Table starting from Rank 1 (Gold wreath, Silver wreath,
     Bronze wreath, and sleek dark numbered circles for ranks 4+)
   ────────────────────────────────────────────────────────────────────────── */

const { width: SCREEN_W } = Dimensions.get("window");

type Row = {
  rank?: number;
  name?: string;
  participant_id?: string;
  email?: string;
  profile_photo?: string;
  audience_votes?: number;
  raw_audience_votes?: number;
  judge_score?: number;
  final_score?: number;
  points?: number;
  category?: string;
  is_verified?: boolean;
  verified_badge?: boolean;
};

// 16 3D Avatar fallbacks
const AVATAR_FALLBACKS = [
  require("../../assets/avatars/m1.png"),
  require("../../assets/avatars/f1.png"),
  require("../../assets/avatars/m2.png"),
  require("../../assets/avatars/f2.png"),
  require("../../assets/avatars/m3.png"),
  require("../../assets/avatars/f3.png"),
  require("../../assets/avatars/m4.png"),
  require("../../assets/avatars/f4.png"),
  require("../../assets/avatars/m5.png"),
  require("../../assets/avatars/f5.png"),
  require("../../assets/avatars/m6.png"),
  require("../../assets/avatars/f6.png"),
  require("../../assets/avatars/c1.png"),
  require("../../assets/avatars/c2.png"),
  require("../../assets/avatars/c3.png"),
  require("../../assets/avatars/c4.png"),
];

function getAvatarSource(uri?: string | null, seed?: string | number) {
  if (uri && typeof uri === "string" && uri.startsWith("http")) {
    return { uri };
  }
  const str = String(seed ?? "avatar");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % AVATAR_FALLBACKS.length;
  return AVATAR_FALLBACKS[idx];
}

function formatScore(n?: number): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "0";
  return n.toLocaleString("en-IN");
}

const LIST_RING_COLORS = [
  "#06B6D4", // Cyan
  "#EC4899", // Pink
  "#F59E0B", // Amber
  "#A855F7", // Purple
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F97316", // Orange
];


/* ──────────────────────────────────────────────────────────────────────────
   Leaderboard Main Screen
   ────────────────────────────────────────────────────────────────────────── */
/**
 * Ticking time-left string.
 *
 * The banner used to read a literal "23h 58m 41s" — the same number on every
 * screen, every day. A prize window is the one thing on this page that is
 * genuinely urgent, so it has to come off the competition's real deadline
 * and actually move.
 */
function useCountdown(target?: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!target) return null;
  const end = new Date(target).getTime();
  if (!Number.isFinite(end)) return null;
  const ms = end - now;
  if (ms <= 0) return "Ended";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (d > 0) return `${d}d ${h}h ${m}m ${sec}s`;
  return `${h}h ${m}m ${sec}s`;
}

export default function Leaderboard() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const params = useLocalSearchParams<{ competition?: string; comp_id?: string; id?: string }>();
  const say = useAlert();
  const initialCompId = params.competition || params.comp_id || params.id;

  const comps = useAsync(() => safe(publicApi.competitions(), []), []);
  const list = toRows(comps.data);
  const [sel, setSel] = useState<string | null>(initialCompId || null);
  const [search, setSearch] = useState("");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [activeRound, setActiveRound] = useState<number | null>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryLeaderboards, setCategoryLeaderboards] = useState<Record<string, Row[]>>({});
  const [votingId, setVotingId] = useState<string | null>(null);

  // Entrance spring animations
  const animList = useRef(new Animated.Value(0)).current;

  // Clean legacy vote key
  useEffect(() => {
    SecureStore.deleteItemAsync("uti_comp_votes").catch(() => {});
  }, []);

  // Sync initial or first competition
  useEffect(() => {
    if (!sel && list.length) {
      setSel(list[0]._id || list[0].id);
    }
  }, [list.length]);

  // Fetch rounds & categories on competition change
  useEffect(() => {
    if (!sel) return;
    publicApi
      .rounds(sel)
      .then((res: any) => {
        if (res && Array.isArray(res.rounds) && res.rounds.length > 0) {
          setRounds(res.rounds);
          setActiveRound(res.current_round ?? res.rounds[0].round_number ?? 1);
        } else {
          setRounds([]);
          setActiveRound(null);
        }
      })
      .catch(() => {
        setRounds([]);
        setActiveRound(null);
      });
  }, [sel]);

  const lb = useAsync(async () => {
    if (!sel) return { leaderboard: [] };
    try {
      let res: any;
      if (activeRound && rounds.length > 1) {
        res = await publicApi.roundLeaderboard(sel, activeRound);
      } else {
        res = await publicApi.leaderboard(sel);
      }
      if (Array.isArray(res?.categories)) {
        setCategories(res.categories);
      }
      if (res?.category_leaderboards && typeof res.category_leaderboards === "object") {
        setCategoryLeaderboards(res.category_leaderboards);
      }
      return res;
    } catch {
      return { leaderboard: [] };
    }
  }, [sel, activeRound]);

  // Entrance spring animation
  useEffect(() => {
    animList.setValue(0);
    Animated.timing(animList, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
      delay: 260,
    }).start();
  }, [sel, activeRound, lb.data]);

  // Compute effective rows
  const rawRows: Row[] = useMemo(() => {
    if (activeCategory !== "ALL" && categoryLeaderboards[activeCategory]) {
      return categoryLeaderboards[activeCategory];
    }
    const data = lb.data as any;
    return (data?.leaderboard || toRows(data) || []) as Row[];
  }, [lb.data, activeCategory, categoryLeaderboards]);

  // Filtered by search
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rawRows;
    const q = search.trim().toLowerCase();
    return rawRows.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.participant_id?.toLowerCase().includes(q)
    );
  }, [rawRows, search]);

  // User's standing
  const myStanding = useMemo(() => {
    if (!user) return null;
    const userEmail = user.email?.toLowerCase();
    const userId = (user as any).id || (user as any)._id;
    const idx = rawRows.findIndex(
      (r) =>
        (r.email && r.email.toLowerCase() === userEmail) ||
        (r.participant_id && r.participant_id === userId)
    );
    if (idx !== -1) {
      return { row: rawRows[idx], rank: rawRows[idx].rank || idx + 1 };
    }
    return null;
  }, [user, rawRows]);

  /* ── User-scoped Voting System ── */
  const userEmail = user?.email?.toLowerCase().trim();
  const userVoteKey = userEmail ? `uti_votes_${userEmail}` : null;

  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [bump, setBump] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!sel || !userVoteKey) {
      setVoted(new Set());
      setBump({});
      return;
    }
    let alive = true;
    SecureStore.getItemAsync(userVoteKey)
      .then((v) => {
        if (!alive) return;
        const all = v ? JSON.parse(v) : {};
        setVoted(new Set<string>(all[String(sel)] || []));
      })
      .catch(() => {
        if (alive) setVoted(new Set());
      });
    return () => {
      alive = false;
    };
  }, [sel, userVoteKey]);

  const rememberVote = async (pid: string) => {
    if (!userVoteKey || !sel) return;
    try {
      const all = JSON.parse((await SecureStore.getItemAsync(userVoteKey)) || "{}");
      const mine: string[] = all[String(sel)] || [];
      if (!mine.includes(pid)) {
        all[String(sel)] = [...mine, pid];
        await SecureStore.setItemAsync(userVoteKey, JSON.stringify(all));
      }
    } catch {}
  };

  const pidOf = (r: Row) => r.participant_id || r.email || "";
  const hasVoted = (r: Row) => voted.has(pidOf(r));
  const voteCount = (r: Row): number =>
    (r.audience_votes ?? r.raw_audience_votes ?? 0) + (bump[pidOf(r)] || 0);

  const handleVote = async (r: Row) => {
    const pId = pidOf(r);
    const who = r.name || "the contestant";
    if (!pId || !sel) return;
    if (!user) {
      say("error", "Sign in to vote", "Create an account or sign in to back your favourite.");
      return;
    }
    if (voted.has(pId)) {
      say("success", "Already voted", `Your vote for ${who} is already in.`);
      return;
    }

    setVoted((v) => new Set(v).add(pId));
    setBump((b) => ({ ...b, [pId]: (b[pId] || 0) + 1 }));
    setVotingId(pId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    playNavFeedback();

    try {
      await competeApi.vote(sel, pId);
      await rememberVote(pId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      say("success", "Vote counted", `You backed ${who}. Rankings update live.`);
      lb.refresh();
    } catch (e: any) {
      const m = e?.message || "Could not submit your vote right now.";
      if (/already voted/i.test(m)) {
        await rememberVote(pId);
        setBump((b) => ({ ...b, [pId]: Math.max(0, (b[pId] || 1) - 1) }));
        say("success", "Already voted", `Your vote for ${who} is already in.`);
      } else {
        setVoted((v) => {
          const n = new Set(v);
          n.delete(pId);
          return n;
        });
        setBump((b) => ({ ...b, [pId]: Math.max(0, (b[pId] || 1) - 1) }));
        say("error", "Vote failed", m);
      }
    } finally {
      setVotingId(null);
    }
  };

  const selectedComp = list.find((c: any) => (c._id || c.id) === sel);

  /* The window the prize actually closes on, in the order the backend fills
     them: voting first, then submission, then the competition's own end. */
  const deadline =
    selectedComp?.voting_end ||
    selectedComp?.submission_deadline ||
    selectedComp?.end_date ||
    selectedComp?.registration_deadline ||
    null;
  const timeLeft = useCountdown(deadline);

  /* `prize` is free text from the CMS ("₹50,000", "Cash prizes up to ₹1L").
     Print it as it was written and only add the words it is missing. */
  const prizeRaw = String(
    selectedComp?.prize ?? selectedComp?.prize_pool ?? selectedComp?.total_prize ?? ""
  ).trim();
  const prizeTitle = prizeRaw
    ? /prize/i.test(prizeRaw)
      ? prizeRaw
      : `${prizeRaw} Prize Pool`
    : selectedComp?.title || selectedComp?.name || "Live Rankings";
  /* Share — built from the live standings: the member's own rank when they're
     on the board, then the overall top three (not the active filter). */
  const [shareOpen, setShareOpen] = useState(false);
  const compTitle = selectedComp?.title || selectedComp?.name || "this competition";
  const shareMessage = (() => {
    const overall: Row[] = ((lb.data as any)?.leaderboard as Row[]) || rawRows;
    const podium = overall
      .slice(0, 3)
      .map((r, i) => `${["🥇", "🥈", "🥉"][i]} ${r.name || "Contestant"}`)
      .join("\n");
    const head = myStanding
      ? `I'm ranked #${myStanding.rank} in ${compTitle} on Upgrade Talents India! Cast your vote 🗳️`
      : `${compTitle} is live on Upgrade Talents India — check the leaderboard and vote for your favourite! 🏆`;
    return podium ? `${head}\n\n${podium}` : head;
  })();

  const top1 = filteredRows[0] || null;
  const top2 = filteredRows[1] || null;
  const top3 = filteredRows[2] || null;

  /** A podium slot from a real leaderboard row — nothing invented. */
  const toEntry = (r: Row | null): PodiumEntry =>
    r
      ? {
          key: pidOf(r) || r.name || "",
          name: r.name || "Contestant",
          avatar: getAvatarSource(r.profile_photo, r.participant_id || r.email),
          score: formatScore(r.final_score ?? voteCount(r)),
          badge: <VerifiedTick row={r} size={12} />,
        }
      : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Ambient Top Glow */}
      <LinearGradient
        colors={["rgba(124, 58, 237, 0.16)", "rgba(245, 158, 11, 0.06)", "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.38 }}
        style={styles.ambientGlow}
        pointerEvents="none"
      />

      {/* Top Navigation Bar */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            playNavFeedback();
            router.back();
          }}
          hitSlop={12}
          style={({ pressed }) => [
            styles.headerBtn,
            { transform: [{ scale: pressed ? 0.92 : 1 }] },
          ]}
        >
          <ChevronLeft size={22} color="#FFFFFF" strokeWidth={2.4} />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Txt size={19} font="sansBold" style={{ color: "#FFFFFF", letterSpacing: -0.3 }}>
            Leaderboard
          </Txt>
          {selectedComp ? (
            <Txt size={11} tone="subtle" numberOfLines={1} style={{ marginTop: 1 }}>
              {selectedComp.title || selectedComp.name}
            </Txt>
          ) : null}
        </View>

        <View style={styles.headerRight}>
          {sel ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setShareOpen(true);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Share leaderboard"
              style={({ pressed }) => [
                styles.headerBtn,
                { transform: [{ scale: pressed ? 0.92 : 1 }] },
              ]}
            >
              <Share2 size={17} color="#FFFFFF" />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              playNavFeedback();
              setFilterModalOpen(true);
            }}
            hitSlop={8}
            style={({ pressed }) => [
              styles.headerBtn,
              { transform: [{ scale: pressed ? 0.92 : 1 }] },
            ]}
          >
            <SlidersHorizontal size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={lb.refreshing}
            onRefresh={lb.refresh}
            tintColor="#FF385C"
            colors={["#FF385C"]}
          />
        }
      >
        {/* Competition Selection Pills */}
        {list.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.compListPills}
          >
            {list.map((cp: any) => {
              const id = cp._id || cp.id;
              const on = sel === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    playNavFeedback();
                    setSel(id);
                  }}
                  style={[
                    styles.compPill,
                    {
                      backgroundColor: on ? "#FF385C" : "rgba(255, 255, 255, 0.06)",
                      borderColor: on ? "#FF385C" : "rgba(255, 255, 255, 0.1)",
                    },
                  ]}
                >
                  <Txt
                    size={12}
                    font="sansBold"
                    style={{ color: on ? "#FFFFFF" : "#9EA3B8" }}
                    numberOfLines={1}
                  >
                    {cp.title || cp.name}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Round switch — the reference's Daily / Weekly / All-time control,
            carrying this competition's real rounds. Equal segments on one
            dark track, the selected one lifted out of it. */}
        {rounds.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20 }}
          >
            <View style={styles.segTrack}>
              {rounds.map((rnd: any) => {
                const rNum = rnd.round_number;
                const on = activeRound === rNum;
                return (
                  <Pressable
                    key={rNum}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setActiveRound(rNum);
                    }}
                    style={({ pressed }) => [
                      styles.segItem,
                      on && styles.segItemOn,
                      { transform: [{ scale: pressed ? 0.96 : 1 }] },
                    ]}
                  >
                    <Txt
                      size={13}
                      font="sansBold"
                      numberOfLines={1}
                      style={{ color: on ? "#FFFFFF" : "rgba(255,255,255,0.45)" }}
                    >
                      {rnd.round_name || `Round ${rNum}`}
                    </Txt>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}

        {/* Categories Pills */}
        {categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catListPills}
          >
            {["ALL", ...categories].map((cat) => {
              const active = activeCategory === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    setActiveCategory(cat);
                  }}
                  style={[
                    styles.catPill,
                    {
                      backgroundColor: active ? "rgba(255, 56, 92, 0.2)" : "rgba(255, 255, 255, 0.05)",
                      borderColor: active ? "#FF385C" : "rgba(255, 255, 255, 0.08)",
                    },
                  ]}
                >
                  <Txt size={11} font="sansBold" style={{ color: active ? "#FF385C" : "#9EA3B8" }}>
                    {cat}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Search Bar */}
        <View style={styles.searchBarWrap}>
          <View style={styles.searchBar}>
            <Search size={15} color="#9EA3B8" />
            <TextInput
              placeholder="Search contestant or ID..."
              placeholderTextColor="#64748B"
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <X size={15} color="#9EA3B8" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Your Standing Card */}
        {myStanding && (
          <View style={styles.myStandingCard}>
            <LinearGradient
              colors={["rgba(124, 58, 237, 0.25)", "rgba(16, 185, 129, 0.12)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.myStandingLeft}>
              <View style={styles.myRankBadge}>
                <Txt size={16} font="display" style={{ color: "#10B981" }}>
                  #{myStanding.rank}
                </Txt>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <UserCheck size={13} color="#A78BFA" />
                  <Txt size={12.5} font="sansBold" style={{ color: "#FFFFFF" }}>
                    Your Standing
                  </Txt>
                </View>
                <Txt size={11} tone="subtle" style={{ marginTop: 1 }} numberOfLines={1}>
                  {myStanding.row.name || user?.name || "You"} •{" "}
                  {formatScore(myStanding.row.final_score ?? voteCount(myStanding.row))} pts
                </Txt>
              </View>
            </View>
            <View style={styles.standingTrend}>
              <TrendingUp size={13} color="#10B981" />
              <Txt size={11} font="sansBold" style={{ color: "#10B981" }}>
                Active
              </Txt>
            </View>
          </View>
        )}

        {/* Loading Skeletons */}
        {lb.loading ? (
          <View style={{ gap: 14, marginTop: 10, paddingHorizontal: 16 }}>
            <Skeleton h={220} radius={22} />
            <Skeleton h={300} radius={22} />
          </View>
        ) : filteredRows.length > 0 ? (
          <View>
            {/* ══════════════════════════════════════════════════════════
                TOP 3 3D ISOMETRIC GLASS PEDESTAL PODIUM
               ══════════════════════════════════════════════════════════ */}
            {/* The blocks rise out of the floor on their own; replays when the
                competition, round or category changes — not after a vote. */}
            <View style={styles.podiumWrapper}>
              <Podium
                width={SCREEN_W}
                first={toEntry(top1)}
                second={toEntry(top2)}
                third={toEntry(top3)}
                replayKey={`${sel}|${activeRound}|${activeCategory}`}
              />
            </View>

            {/* ══════════════════════════════════════════════════════════
                SPOTLIGHT PRIZE POOL BANNER (Matching Screenshot)
               ══════════════════════════════════════════════════════════ */}
            <View style={styles.spotlightBanner}>
              <Pressable
                hitSlop={8}
                onPress={() => {
                  if (sel) router.push(`/(more)/competitions/${sel}`);
                }}
              >
                <Txt size={13} font="sansBold" style={styles.howItWorks}>
                  See how it works
                </Txt>
              </Pressable>

              <Txt
                size={30}
                font="display"
                numberOfLines={2}
                style={styles.prizeTitle}
              >
                {prizeTitle}
              </Txt>

              {timeLeft ? (
                <View style={styles.timeRow}>
                  <Clock size={13} color="#8A90A6" />
                  <Txt size={12.5} font="sansMed" style={{ color: "#8A90A6" }}>
                    {timeLeft === "Ended" ? "Entries closed" : `Ends in: ${timeLeft}`}
                  </Txt>
                </View>
              ) : null}
            </View>

            {/* ══════════════════════════════════════════════════════════
                CHAMPIONSHIP TABLE (Rank 1, 2, 3 Wreaths + 4+ Circles)
               ══════════════════════════════════════════════════════════ */}
            <Animated.View
              style={[
                styles.tableContainer,
                {
                  transform: [
                    {
                      translateY: animList.interpolate({
                        inputRange: [0, 1],
                        outputRange: [30, 0],
                      }),
                    },
                  ],
                  opacity: animList,
                },
              ]}
            >
              {/* Table Column Header: RANK | USER | SCORE | VOTES */}
              <View style={styles.tableHeader}>
                <View style={{ width: 44, alignItems: "center" }}>
                  <Txt size={10.5} font="sansBold" style={styles.headerLabel}>
                    RANK
                  </Txt>
                </View>
                <View style={{ flex: 1, paddingLeft: 8 }}>
                  <Txt size={10.5} font="sansBold" style={styles.headerLabel}>
                    USER
                  </Txt>
                </View>
                <View style={{ width: 64, alignItems: "flex-end", paddingRight: 10 }}>
                  <Txt size={10.5} font="sansBold" style={styles.headerLabel}>
                    SCORE
                  </Txt>
                </View>
                <View style={{ width: 65, alignItems: "flex-end", paddingRight: 4 }}>
                  <Txt size={10.5} font="sansBold" style={styles.headerLabel}>
                    VOTES
                  </Txt>
                </View>
              </View>

              {/* Table Rows */}
              <View style={styles.tableBody}>
                {filteredRows.map((r, i) => {
                  const rankNum = r.rank || i + 1;
                  const ringColor = LIST_RING_COLORS[i % LIST_RING_COLORS.length];
                  return (
                    <View key={r.participant_id || r.email || i} style={styles.tableRow}>
                      {/* 1. RANK BADGE (Laurel Wreath for 1,2,3; Dark circle for 4+) */}
                      <View style={{ width: 44, alignItems: "center", justifyContent: "center" }}>
                        {rankNum <= 3 ? (
                          <RankLaurel rank={rankNum} size={42} medal />
                        ) : (
                          <View style={styles.tableNumCircle}>
                            <Txt size={12.5} font="sansBold" style={{ color: "#E2E8F0" }}>
                              {rankNum}
                            </Txt>
                          </View>
                        )}
                      </View>

                      {/* 2. USER: Avatar with ring + Contestant Name */}
                      <View style={styles.userColumn}>
                        <View style={[styles.tableAvatarRing, { borderColor: ringColor }]}>
                          <Image
                            source={getAvatarSource(r.profile_photo, r.participant_id || rankNum)}
                            style={styles.avatarImg}
                            contentFit="cover"
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          {/* Full name, wrapping onto as many lines as it needs —
                              never cut off with an ellipsis. */}
                          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 4 }}>
                            <Txt
                              size={13.5}
                              font="sansBold"
                              style={{ color: "#FFFFFF", flexShrink: 1, lineHeight: 18 }}
                            >
                              {r.name || "Contestant"}
                            </Txt>
                            <View style={{ marginTop: 3 }}>
                              <VerifiedTick row={r} size={11} />
                            </View>
                          </View>
                          {r.category ? (
                            <Txt size={10} tone="subtle" style={{ marginTop: 1 }}>
                              {r.category}
                            </Txt>
                          ) : null}
                        </View>
                      </View>

                      {/* 3. SCORE COLUMN */}
                      <View style={{ width: 64, alignItems: "flex-end", paddingRight: 10 }}>
                        <Txt size={13.5} font="sansExt" style={{ color: "#FFFFFF" }}>
                          {formatScore(r.final_score ?? voteCount(r))}
                        </Txt>
                      </View>

                      {/* 4. VOTES & ACTION COLUMN (Green text + heart) */}
                      <View style={styles.votesColumn}>
                        <Pressable
                          onPress={() => handleVote(r)}
                          disabled={hasVoted(r) || votingId === pidOf(r)}
                          hitSlop={8}
                          style={({ pressed }) => [
                            styles.voteActionBtn,
                            hasVoted(r) && styles.voteActionBtnActive,
                            { transform: [{ scale: pressed ? 0.9 : 1 }] },
                          ]}
                        >
                          <Heart
                            size={12}
                            color={hasVoted(r) ? "#FF385C" : "#10B981"}
                            fill={hasVoted(r) ? "#FF385C" : "transparent"}
                          />
                          <Txt
                            size={11.5}
                            font="sansBold"
                            style={{ color: hasVoted(r) ? "#FF385C" : "#10B981" }}
                          >
                            {voteCount(r)}
                          </Txt>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Animated.View>
          </View>
        ) : (
          <EmptyState
            icon={<Trophy size={28} color="#9EA3B8" />}
            title={search ? "No contestant matches search" : "No rankings available"}
            subtitle={
              search
                ? "Try searching with a different name."
                : "Scores will appear once judging or voting commences."
            }
          />
        )}
      </ScrollView>

      {/* Competition Filter Modal */}
      <Modal
        visible={filterModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setFilterModalOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Txt size={16} font="sansBold" style={{ color: "#FFFFFF" }}>
                Select Competition
              </Txt>
              <Pressable onPress={() => setFilterModalOpen(false)} hitSlop={8}>
                <X size={18} color="#9EA3B8" />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {list.map((cp: any) => {
                const id = cp._id || cp.id;
                const active = sel === id;
                return (
                  <Pressable
                    key={id}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      playNavFeedback();
                      setSel(id);
                      setFilterModalOpen(false);
                    }}
                    style={[
                      styles.modalOption,
                      active && { backgroundColor: "rgba(255, 56, 92, 0.15)" },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Txt
                        size={14}
                        font={active ? "sansBold" : "sansMed"}
                        style={{ color: active ? "#FF385C" : "#FFFFFF" }}
                      >
                        {cp.title || cp.name}
                      </Txt>
                    </View>
                    {active && <Check size={16} color="#FF385C" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <ShareSheet
        visible={shareOpen}
        title="Share leaderboard"
        subtitle={compTitle}
        message={shareMessage}
        url={`https://upgradetalentsindia.in/leaderboard?competition=${sel ?? ""}`}
        onClose={() => setShareOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#07080e",
  },
  ambientGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 420,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  /* Absolutely centred so the title stays in the middle even though the
     right side carries two buttons and the left only one. */
  headerTitleWrap: {
    position: "absolute",
    left: 112,
    right: 112,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 40,
  },
  compListPills: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
  },
  compPill: {
    paddingHorizontal: 14,
    height: 32,
    borderRadius: 999,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  roundListPills: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 6,
  },
  roundPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    height: 28,
    borderRadius: 999,
    borderWidth: 1,
  },
  catListPills: {
    paddingHorizontal: 16,
    gap: 7,
    paddingBottom: 6,
  },
  catPill: {
    paddingHorizontal: 11,
    height: 26,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  searchBarWrap: {
    paddingHorizontal: 16,
    marginVertical: 6,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 38,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    color: "#FFFFFF",
    paddingVertical: 0,
  },
  myStandingCard: {
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    marginBottom: 10,
  },
  myStandingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  myRankBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.4)",
  },
  standingTrend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },

  /* ── 3D Isometric Glass Podium ── */
  podiumWrapper: {
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },

  /* ── Spotlight Banner ── */
  /* Pulled up so the link sits on the fading foot of the champion's block. */
  spotlightBanner: {
    paddingHorizontal: 20,
    marginTop: -Math.round(SCREEN_W * 0.1),
    marginBottom: 14,
    alignItems: "center",
  },
  howItWorks: {
    color: "#F5C542",
    textDecorationLine: "underline",
    textDecorationColor: "#F5C542",
  },
  prizeTitle: {
    color: "#FFFFFF",
    marginTop: 8,
    letterSpacing: -0.6,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 8,
  },
  /* Segmented round switch — one dark track, the active round raised out of
     it. Scrolls instead of shrinking when a competition has many rounds. */
  segTrack: {
    flexDirection: "row",
    alignSelf: "center",
    marginTop: 4,
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segItem: {
    height: 36,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  segItemOn: {
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 4,
  },

  /* ── Table Styling ── */
  tableContainer: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
  },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  headerLabel: {
    color: "#64748B",
    letterSpacing: 0.8,
  },
  tableBody: {
    paddingTop: 2,
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  userColumn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 8,
  },
  tableAvatarRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: "hidden",
    borderWidth: 2,
    backgroundColor: "#161724",
    alignItems: "center",
    justifyContent: "center",
  },
  tableNumCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#151824",
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  votesColumn: {
    width: 65,
    alignItems: "flex-end",
    paddingRight: 4,
  },
  voteActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.25)",
  },
  voteActionBtnActive: {
    backgroundColor: "rgba(255, 56, 92, 0.15)",
    borderColor: "#FF385C",
  },

  /* ── Modal Filter ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalSheet: {
    width: "100%",
    backgroundColor: "#13141f",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
});
