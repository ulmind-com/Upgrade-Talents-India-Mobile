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
import Svg, {
  Path,
  G,
  Polygon,
  Circle,
  Defs,
  RadialGradient,
  Stop,
} from "react-native-svg";
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
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { publicApi, competeApi, safe, toRows } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useSession } from "@/context/Session";
import { Txt, Skeleton, EmptyState } from "@/components/ui";
import { VerifiedTick } from "@/components/VerifiedBadge";
import { useAlert } from "@/components/Popup";
import { playNavFeedback } from "@/lib/sound";

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

function GreenDiamond({ size = 10 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="#10B981">
      <Path d="M12 2L22 12L12 22L2 12Z" />
    </Svg>
  );
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
   PodiumWreath — Classic Laurel Wreath with bold number 1, 2, or 3
   ────────────────────────────────────────────────────────────────────────── */
function PodiumWreath({
  rank,
  size = 50,
  showAura = false,
}: {
  rank: 1 | 2 | 3;
  size?: number;
  showAura?: boolean;
}) {
  const color =
    rank === 1 ? "#FBBF24" : rank === 2 ? "#CBD5E1" : "#D97706";
  const numColor =
    rank === 1 ? "#FFFFFF" : rank === 2 ? "#CBD5E1" : "#D97706";

  const numFontSize = Math.round(size * 0.42);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 60 60" style={StyleSheet.absoluteFill}>
        {showAura && (
          <Defs>
            <RadialGradient id="wreathGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#F59E0B" stopOpacity="0.45" />
              <Stop offset="70%" stopColor="#F59E0B" stopOpacity="0.12" />
              <Stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
            </RadialGradient>
          </Defs>
        )}
        {showAura && <Circle cx="30" cy="30" r="28" fill="url(#wreathGlow)" />}

        {/* Left branch */}
        <G fill={color}>
          <Path
            d="M 28 50 C 17 48 10 38 10 27 C 10 17 18 9 27 7"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            fill="none"
          />
          <Path d="M 25 48 C 21 49 17 48 15 45 C 18 44 22 45 25 48 Z" />
          <Path d="M 26 44 C 22 44 19 41 20 37 C 23 39 26 41 26 44 Z" />
          <Path d="M 19 38 C 14 38 11 36 10 33 C 14 32 17 34 19 38 Z" />
          <Path d="M 18 33 C 14 31 12 28 13 24 C 16 26 18 29 18 33 Z" />
          <Path d="M 13 26 C 8 25 6 22 7 19 C 10 19 13 21 13 26 Z" />
          <Path d="M 15 22 C 12 20 12 16 14 13 C 17 15 17 19 15 22 Z" />
          <Path d="M 16 15 C 13 12 14 8 17 6 C 19 9 18 13 16 15 Z" />
          <Path d="M 21 12 C 18 10 20 6 23 4 C 24 7 23 10 21 12 Z" />
          <Path d="M 27 7 C 26 4 28 2 30 2 C 30 5 29 7 27 7 Z" />
        </G>

        {/* Right branch mirrored */}
        <G transform="translate(60, 0) scale(-1, 1)" fill={color}>
          <Path
            d="M 28 50 C 17 48 10 38 10 27 C 10 17 18 9 27 7"
            stroke={color}
            strokeWidth={1.8}
            strokeLinecap="round"
            fill="none"
          />
          <Path d="M 25 48 C 21 49 17 48 15 45 C 18 44 22 45 25 48 Z" />
          <Path d="M 26 44 C 22 44 19 41 20 37 C 23 39 26 41 26 44 Z" />
          <Path d="M 19 38 C 14 38 11 36 10 33 C 14 32 17 34 19 38 Z" />
          <Path d="M 18 33 C 14 31 12 28 13 24 C 16 26 18 29 18 33 Z" />
          <Path d="M 13 26 C 8 25 6 22 7 19 C 10 19 13 21 13 26 Z" />
          <Path d="M 15 22 C 12 20 12 16 14 13 C 17 15 17 19 15 22 Z" />
          <Path d="M 16 15 C 13 12 14 8 17 6 C 19 9 18 13 16 15 Z" />
          <Path d="M 21 12 C 18 10 20 6 23 4 C 24 7 23 10 21 12 Z" />
          <Path d="M 27 7 C 26 4 28 2 30 2 C 30 5 29 7 27 7 Z" />
        </G>

        {/* Bottom knot */}
        <Path d="M 27 50 Q 30 48 33 50 Q 30 52 27 50 Z" fill={color} />
      </Svg>

      {/* Bold Rank Number in Center */}
      <Txt
        size={numFontSize}
        font="display"
        style={{
          color: numColor,
          lineHeight: numFontSize + 4,
          textShadowColor: "rgba(0, 0, 0, 0.9)",
          textShadowOffset: { width: 0, height: 1 },
          textShadowRadius: 3,
        }}
      >
        {rank}
      </Txt>
    </View>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Leaderboard Main Screen
   ────────────────────────────────────────────────────────────────────────── */
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
  const animPodium = useRef(new Animated.Value(0)).current;
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
    animPodium.setValue(0);
    animList.setValue(0);

    Animated.parallel([
      Animated.spring(animPodium, {
        toValue: 1,
        tension: 36,
        friction: 6.5,
        useNativeDriver: true,
      }),
      Animated.timing(animList, {
        toValue: 1,
        duration: 380,
        useNativeDriver: true,
        delay: 150,
      }),
    ]).start();
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
  const top1 = filteredRows[0] || null;
  const top2 = filteredRows[1] || null;
  const top3 = filteredRows[2] || null;

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
            <Txt size={11} tone="subtle" numberOfLines={1} style={{ maxWidth: 200, marginTop: 1 }}>
              {selectedComp.title || selectedComp.name}
            </Txt>
          ) : null}
        </View>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            playNavFeedback();
            setFilterModalOpen(true);
          }}
          hitSlop={12}
          style={({ pressed }) => [
            styles.headerBtn,
            { transform: [{ scale: pressed ? 0.92 : 1 }] },
          ]}
        >
          <SlidersHorizontal size={18} color="#FFFFFF" />
        </Pressable>
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

        {/* Round Chips */}
        {rounds.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.roundListPills}
          >
            {rounds.map((rnd: any) => {
              const rNum = rnd.round_number;
              const on = activeRound === rNum;
              return (
                <Pressable
                  key={rNum}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    playNavFeedback();
                    setActiveRound(rNum);
                  }}
                  style={[
                    styles.roundPill,
                    {
                      backgroundColor: on ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)",
                      borderColor: on ? "#10B981" : "transparent",
                    },
                  ]}
                >
                  <Sparkles size={11} color={on ? "#10B981" : "#9EA3B8"} />
                  <Txt size={11.5} font="sansBold" style={{ color: on ? "#10B981" : "#9EA3B8" }}>
                    {rnd.round_name || `Round ${rNum}`}
                  </Txt>
                </Pressable>
              );
            })}
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
            <Animated.View
              style={[
                styles.podiumWrapper,
                {
                  transform: [
                    {
                      translateY: animPodium.interpolate({
                        inputRange: [0, 1],
                        outputRange: [40, 0],
                      }),
                    },
                  ],
                  opacity: animPodium,
                },
              ]}
            >
              <View style={styles.podiumClusterRow}>
                {/* ── PEDESTAL 2 (Left - Rank 2 - Silver) ── */}
                <View style={[styles.pedestalCol, { zIndex: 2, marginRight: -8 }]}>
                  {top2 ? (
                    <View style={styles.pedestalColInner}>
                      {/* Floating Avatar + Name + Score */}
                      <View style={[styles.avatarRing, { borderColor: "#EC4899", width: 54, height: 54, shadowColor: "#EC4899" }]}>
                        <Image
                          source={getAvatarSource(top2.profile_photo, top2.participant_id || 2)}
                          style={styles.avatarImg}
                          contentFit="cover"
                        />
                      </View>
                      <Txt size={12} font="sansBold" numberOfLines={1} style={styles.contestantName}>
                        {top2.name || "Contestant"}
                      </Txt>
                      <View style={styles.scorePill}>
                        <GreenDiamond size={9} />
                        <Txt size={11} font="sansBold" style={{ color: "#10B981" }}>
                          {formatScore(top2.final_score ?? voteCount(top2))}
                        </Txt>
                      </View>

                      {/* 3D Glass Block 2 */}
                      <View style={[styles.glassBlockWrap, { width: 104 }]}>
                        {/* Isometric Diamond Top Surface */}
                        <Svg width={104} height={22} viewBox="0 0 104 22">
                          <Polygon
                            points="52,2 102,11 52,20 2,11"
                            fill="rgba(203, 213, 225, 0.08)"
                            stroke="rgba(203, 213, 225, 0.45)"
                            strokeWidth={1.4}
                          />
                        </Svg>
                        {/* Front Face with Silver Wreath & 2 */}
                        <View style={[styles.glassBlockFront, { height: 92, borderColor: "rgba(203, 213, 225, 0.25)" }]}>
                          <LinearGradient
                            colors={["rgba(203, 213, 225, 0.12)", "rgba(18, 19, 32, 0.95)", "rgba(9, 10, 18, 0.98)"]}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                            style={StyleSheet.absoluteFill}
                          />
                          <PodiumWreath rank={2} size={46} />
                        </View>
                      </View>
                    </View>
                  ) : null}
                </View>

                {/* ── PEDESTAL 1 (Center - Rank 1 - Champion - ELEVATED) ── */}
                <View style={[styles.pedestalCol, { zIndex: 10, marginTop: -26 }]}>
                  {top1 ? (
                    <View style={styles.pedestalColInner}>
                      {/* Floating Avatar (LARGER with Cyan Glow Ring) */}
                      <View
                        style={[
                          styles.avatarRing,
                          {
                            borderColor: "#06B6D4",
                            width: 64,
                            height: 64,
                            shadowColor: "#06B6D4",
                            shadowOpacity: 0.8,
                            shadowRadius: 12,
                          },
                        ]}
                      >
                        <Image
                          source={getAvatarSource(top1.profile_photo, top1.participant_id || 1)}
                          style={styles.avatarImg}
                          contentFit="cover"
                        />
                      </View>
                      <Txt size={13.5} font="sansBold" numberOfLines={1} style={styles.contestantName}>
                        {top1.name || "Contestant"}
                      </Txt>
                      <View style={[styles.scorePill, { backgroundColor: "rgba(16, 185, 129, 0.22)", borderColor: "rgba(16, 185, 129, 0.45)" }]}>
                        <GreenDiamond size={10} />
                        <Txt size={12} font="sansExt" style={{ color: "#10B981" }}>
                          {formatScore(top1.final_score ?? voteCount(top1))}
                        </Txt>
                      </View>

                      {/* 3D Glass Block 1 (Gold Neon Wireframe Top & Glowing Gold Wreath 1) */}
                      <View style={[styles.glassBlockWrap, { width: 120 }]}>
                        {/* Glowing Golden Neon Wireframe Top */}
                        <Svg width={120} height={26} viewBox="0 0 120 26">
                          <Polygon
                            points="60,2 118,13 60,24 2,13"
                            fill="rgba(245, 158, 11, 0.16)"
                            stroke="#FBBF24"
                            strokeWidth={2}
                          />
                        </Svg>
                        {/* Front Face with Golden Glowing Wreath & 1 */}
                        <View
                          style={[
                            styles.glassBlockFront,
                            {
                              height: 114,
                              borderColor: "rgba(245, 158, 11, 0.5)",
                              borderWidth: 1.5,
                            },
                          ]}
                        >
                          <LinearGradient
                            colors={["rgba(245, 158, 11, 0.24)", "rgba(20, 20, 32, 0.95)", "rgba(10, 11, 18, 0.98)"]}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                            style={StyleSheet.absoluteFill}
                          />
                          <PodiumWreath rank={1} size={58} showAura />
                        </View>
                      </View>
                    </View>
                  ) : null}
                </View>

                {/* ── PEDESTAL 3 (Right - Rank 3 - Bronze) ── */}
                <View style={[styles.pedestalCol, { zIndex: 2, marginLeft: -8 }]}>
                  {top3 ? (
                    <View style={styles.pedestalColInner}>
                      {/* Floating Avatar + Name + Score */}
                      <View style={[styles.avatarRing, { borderColor: "#F59E0B", width: 50, height: 50, shadowColor: "#F59E0B" }]}>
                        <Image
                          source={getAvatarSource(top3.profile_photo, top3.participant_id || 3)}
                          style={styles.avatarImg}
                          contentFit="cover"
                        />
                      </View>
                      <Txt size={12} font="sansBold" numberOfLines={1} style={styles.contestantName}>
                        {top3.name || "Contestant"}
                      </Txt>
                      <View style={styles.scorePill}>
                        <GreenDiamond size={9} />
                        <Txt size={11} font="sansBold" style={{ color: "#10B981" }}>
                          {formatScore(top3.final_score ?? voteCount(top3))}
                        </Txt>
                      </View>

                      {/* 3D Glass Block 3 */}
                      <View style={[styles.glassBlockWrap, { width: 104 }]}>
                        {/* Isometric Diamond Top Surface */}
                        <Svg width={104} height={22} viewBox="0 0 104 22">
                          <Polygon
                            points="52,2 102,11 52,20 2,11"
                            fill="rgba(217, 119, 6, 0.08)"
                            stroke="rgba(217, 119, 6, 0.45)"
                            strokeWidth={1.4}
                          />
                        </Svg>
                        {/* Front Face with Bronze Wreath & 3 */}
                        <View style={[styles.glassBlockFront, { height: 86, borderColor: "rgba(217, 119, 6, 0.25)" }]}>
                          <LinearGradient
                            colors={["rgba(217, 119, 6, 0.12)", "rgba(18, 19, 32, 0.95)", "rgba(9, 10, 18, 0.98)"]}
                            start={{ x: 0.5, y: 0 }}
                            end={{ x: 0.5, y: 1 }}
                            style={StyleSheet.absoluteFill}
                          />
                          <PodiumWreath rank={3} size={44} />
                        </View>
                      </View>
                    </View>
                  ) : null}
                </View>
              </View>
            </Animated.View>

            {/* ══════════════════════════════════════════════════════════
                SPOTLIGHT PRIZE POOL BANNER (Matching Screenshot)
               ══════════════════════════════════════════════════════════ */}
            <View style={styles.spotlightBanner}>
              <Pressable hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Txt size={12} font="sansBold" style={{ color: "#FBBF24" }}>
                  See how it works
                </Txt>
              </Pressable>

              <Txt size={24} font="display" style={{ color: "#FFFFFF", marginTop: 2, letterSpacing: -0.4 }}>
                {selectedComp ? selectedComp.title || selectedComp.name : "Prize Pool"}
              </Txt>

              <View style={styles.timeRow}>
                <Clock size={12} color="#94A3B8" />
                <Txt size={11.5} tone="subtle">
                  Ends in: 23h 58m 41s • Live Rankings
                </Txt>
              </View>
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
                <View style={{ width: 85, alignItems: "flex-end", paddingRight: 10 }}>
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
                        {rankNum === 1 ? (
                          <PodiumWreath rank={1} size={32} />
                        ) : rankNum === 2 ? (
                          <PodiumWreath rank={2} size={32} />
                        ) : rankNum === 3 ? (
                          <PodiumWreath rank={3} size={32} />
                        ) : (
                          <View style={styles.tableNumCircle}>
                            <Txt size={12} font="sansBold" style={{ color: "#94A3B8" }}>
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
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Txt
                              size={13.5}
                              font="sansBold"
                              numberOfLines={1}
                              style={{ color: "#FFFFFF", flexShrink: 1 }}
                            >
                              {r.name || "Contestant"}
                            </Txt>
                            <VerifiedTick row={r} size={11} />
                          </View>
                          {r.category ? (
                            <Txt size={10} tone="subtle" numberOfLines={1}>
                              {r.category}
                            </Txt>
                          ) : null}
                        </View>
                      </View>

                      {/* 3. SCORE COLUMN */}
                      <View style={{ width: 85, alignItems: "flex-end", paddingRight: 10 }}>
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
  headerTitleWrap: {
    alignItems: "center",
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
  podiumClusterRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  pedestalCol: {
    alignItems: "center",
  },
  pedestalColInner: {
    alignItems: "center",
  },
  avatarRing: {
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#161724",
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    zIndex: 12,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  contestantName: {
    color: "#FFFFFF",
    marginTop: 4,
    textAlign: "center",
    maxWidth: 95,
  },
  scorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 999,
    marginTop: 3,
    marginBottom: 6,
  },
  glassBlockWrap: {
    alignItems: "center",
  },
  glassBlockFront: {
    width: "100%",
    marginTop: -8,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderLeftWidth: 1.2,
    borderRightWidth: 1.2,
    borderBottomWidth: 1.2,
    borderTopWidth: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: 4,
  },

  /* ── Spotlight Banner ── */
  spotlightBanner: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 10,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
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
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
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
