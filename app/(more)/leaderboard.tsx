import React, { useEffect, useMemo, useRef, useState } from "react";
import { compImage } from "@/lib/competition";
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
  ImageDown,
  ArrowUpRight,
  Flag,
  Lock,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { publicApi, competeApi, safe, toRows, type ShareLinkData } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useSession } from "@/context/Session";
import { Txt, Skeleton, EmptyState } from "@/components/ui";
import type { RoundInfo } from "@/lib/api";
import { VerifiedTick, VerifiedName, isVerified } from "@/components/VerifiedBadge";
import { useAlert } from "@/components/Popup";
import { playNavFeedback } from "@/lib/sound";
import { ShareSheet } from "@/components/ShareSheet";
import { ShareImageSheet } from "@/components/share/ShareImageSheet";
import { Podium, RankLaurel, type PodiumEntry } from "@/components/Podium";
import { useRealtime } from "@/lib/realtime";

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
  const params = useLocalSearchParams<{ competition?: string; comp_id?: string; id?: string; round?: string }>();
  const say = useAlert();
  const initialCompId = params.competition || params.comp_id || params.id;

  const comps = useAsync(() => safe(publicApi.competitions(), []), []);
  const list = toRows(comps.data);
  const [sel, setSel] = useState<string | null>(initialCompId || null);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [activeRound, setActiveRound] = useState<number | null>(null);
  const [rounds, setRounds] = useState<RoundInfo[]>([]);
  /** The round that is live right now — the only one votes count towards. */
  const [currentRound, setCurrentRound] = useState<number | null>(null);
  const roundParamUsed = useRef(false);
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

  /* ── Standings loader ──
     One pass per competition: rounds first, then the standings for the round
     we'll actually show — so the screen fills once instead of loading the
     overall board and then reloading it for the round. Every request carries
     an id; anything older than the latest is dropped, so fast taps can't
     paint stale data. */
  const [lbData, setLbData] = useState<any>(null);
  const [lbLoading, setLbLoading] = useState(true); // first fill for this competition
  const [lbSwitching, setLbSwitching] = useState(false); // round change — keep old board up
  const [refreshing, setRefreshing] = useState(false);
  const reqId = useRef(0);

  const fetchBoard = async (compId: string, round: number | null, multi: boolean) => {
    try {
      return multi && round ? await publicApi.roundLeaderboard(compId, round) : await publicApi.leaderboard(compId);
    } catch {
      return { leaderboard: [] };
    }
  };

  const applyBoard = (res: any) => {
    setLbData(res);
    setCategories(Array.isArray(res?.categories) ? res.categories : []);
    setCategoryLeaderboards(
      res?.category_leaderboards && typeof res.category_leaderboards === "object" ? res.category_leaderboards : {}
    );
  };

  useEffect(() => {
    if (!sel) return;
    const id = ++reqId.current;
    setLbLoading(true);
    setActiveCategory("ALL");
    (async () => {
      const rr = await safe(publicApi.rounds(sel), null);
      if (id !== reqId.current) return;
      const list: RoundInfo[] = Array.isArray(rr?.rounds) ? rr!.rounds! : [];
      let want: number | null = null;
      let live: number | null = null;
      if (list.length) {
        live = rr?.current_round ?? list[0].round_number ?? 1;
        // deep link from the competition's round journey: ?round=N
        const asked = Number(params.round);
        want = !roundParamUsed.current && asked && list.some((r) => r.round_number === asked) ? asked : live;
        roundParamUsed.current = true;
      }
      const res = await fetchBoard(sel, want, list.length > 1);
      if (id !== reqId.current) return;
      setRounds(list);
      setCurrentRound(live);
      setActiveRound(want);
      applyBoard(res);
      setLbLoading(false);
    })();
  }, [sel]);

  /** Switch rounds without blanking the screen. */
  const pickRound = async (round: number) => {
    if (!sel || round === activeRound) return;
    const id = ++reqId.current;
    setActiveRound(round);
    setLbSwitching(true);
    const res = await fetchBoard(sel, round, rounds.length > 1);
    if (id !== reqId.current) return;
    applyBoard(res);
    setLbSwitching(false);
  };

  /* live: votes / round changes on `competition:<id>` refresh the board in place
     (declared after refreshBoard below via a ref, so it always calls the latest) */
  const refreshRef = useRef<() => void>(() => {});
  useRealtime([sel ? `competition:${sel}` : null], () => refreshRef.current());

  /** Pull-to-refresh and post-vote refresh: same board, fresh numbers, no skeleton. */
  const refreshBoard = async (silent = false) => {
    if (!sel) return;
    const id = ++reqId.current;
    if (!silent) setRefreshing(true);
    const res = await fetchBoard(sel, activeRound, rounds.length > 1);
    if (id === reqId.current) applyBoard(res);
    if (!silent) setRefreshing(false);
  };
  refreshRef.current = () => refreshBoard(true);

  // List entrance — once per competition/round, not on every refresh
  useEffect(() => {
    if (lbLoading) return;
    animList.setValue(0);
    Animated.timing(animList, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
      delay: 260,
    }).start();
  }, [sel, activeRound, lbLoading]);

  // Compute effective rows
  const rawRows: Row[] = useMemo(() => {
    const data = lbData as any;
    const all = (data?.leaderboard || toRows(data) || []) as Row[];
    if (activeCategory === "ALL") return all;
    const want = activeCategory.trim().toLowerCase();
    // the server only sends boards for categories that have entrants (and none
    // per round) — so match its key loosely, else rank that category ourselves
    const key = Object.keys(categoryLeaderboards).find((k) => k.trim().toLowerCase() === want);
    if (key) return categoryLeaderboards[key];
    return all.filter((r) => String(r.category || "").trim().toLowerCase() === want).map((r, i) => ({ ...r, rank: i + 1 }));
  }, [lbData, activeCategory, categoryLeaderboards]);

  // Filtered by search
  const searching = search.trim().length > 0;
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rawRows;
    return rawRows
      .map((r, i) => ({ ...r, rank: r.rank || i + 1 })) // keep each contestant's real rank
      .filter((r: any) =>
        [r.name, r.user_name, r.full_name, r.email, r.participant_id, r.registration_reference]
          .some((v) => String(v || "").toLowerCase().includes(q))
      );
  }, [rawRows, search]);

  // User's standing
  /** Is this row the signed-in member? (same matching as "your standing") */
  const isMe = (r: Row) => {
    if (!user) return false;
    const em = user.email?.toLowerCase();
    const uid = (user as any).id || (user as any)._id;
    return !!((r.email && em && r.email.toLowerCase() === em) || (r.participant_id && uid && r.participant_id === uid) || (r.participant_id && em && r.participant_id.toLowerCase() === em));
  };

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
  const isMultiRound = rounds.length > 1;
  // one vote per contestant *per round* (backend rule) — remember them the same way
  const voteScope = isMultiRound && currentRound ? `${sel}#r${currentRound}` : String(sel);

  const [voted, setVoted] = useState<Set<string>>(new Set());
  const [bump, setBump] = useState<Record<string, number>>({});
  // the optimistic +1 only bridges the gap until fresh standings arrive (an app
  // vote is weighted server-side, so the real number replaces the guess)
  useEffect(() => setBump({}), [lbData]);

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
        setVoted(new Set<string>(all[voteScope] || []));
      })
      .catch(() => {
        if (alive) setVoted(new Set());
      });
    return () => {
      alive = false;
    };
  }, [sel, userVoteKey, voteScope]);

  const rememberVote = async (pid: string) => {
    if (!userVoteKey || !sel) return;
    try {
      const all = JSON.parse((await SecureStore.getItemAsync(userVoteKey)) || "{}");
      const mine: string[] = all[voteScope] || [];
      if (!mine.includes(pid)) {
        all[voteScope] = [...mine, pid];
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
      await competeApi.vote(sel, pId, currentRound ? { round_number: currentRound } : {});
      await rememberVote(pId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      say("success", "Vote counted", `You backed ${who}. Rankings update live.`);
      refreshBoard();
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
  const [shareImage, setShareImage] = useState(false);
  const [shareData, setShareData] = useState<ShareLinkData | null>(null);
  // Site origin from the backend's page_url (honours its FRONTEND_URL).
  const siteOrigin = /^https?:\/\/[^/]+/i.exec(shareData?.page_url || "")?.[0] || "https://upgradetalentsindia.in";
  const compTitle = selectedComp?.title || selectedComp?.name || "this competition";
  const shareMessage = (() => {
    const overall: Row[] = ((lbData as any)?.leaderboard as Row[]) || rawRows;
    const podium = overall
      .slice(0, 3)
      .map((r, i) => `${["🥇", "🥈", "🥉"][i]} ${r.name || "Contestant"}`)
      .join("\n");
    const head = myStanding
      ? `I'm ranked #${myStanding.rank} in ${compTitle} on Upgrade Talents India! Cast your vote 🗳️`
      : `${compTitle} is live on Upgrade Talents India — check the leaderboard and vote for your favourite! 🏆`;
    return podium ? `${head}\n\n${podium}` : head;
  })();

  const roundInfo = isMultiRound ? rounds.find((r) => r.round_number === activeRound) : undefined;
  const roundUpcoming = String(roundInfo?.status || "").toUpperCase() === "UPCOMING";
  const advancingCount = (lbData as any)?.advancing_count ?? roundInfo?.advancing_count ?? null;

  /* A round that hasn't started has no scores yet — show who qualified into it. */
  const qualified = useAsync(
    () =>
      sel && activeRound && roundUpcoming
        ? safe(publicApi.roundContestants(sel, activeRound, activeCategory !== "ALL" ? activeCategory : undefined), null)
        : Promise.resolve(null),
    [sel, activeRound, roundUpcoming, activeCategory]
  );
  const qualifiedRows: Row[] = (qualified.data?.contestants as Row[]) || [];

  /* Votes only land while voting is OPEN, and only in the live round. */
  const votingOpen =
    selectedComp?.audience_voting_enabled !== false &&
    String(selectedComp?.voting_status ?? "OPEN").toUpperCase() === "OPEN";
  const canVote = votingOpen && (!isMultiRound || activeRound === currentRound);

  /* What SCORE and VOTES mean, straight off the ranking service's own fields:
     final_score is normalised to 100 and weighted; audience_votes is the sum of
     each vote's weight (an app vote can carry more than a web vote). */
  const scoreNote = useMemo(() => {
    const first: any = rawRows[0];
    const mode = String((lbData as any)?.ranking_mode || first?.ranking_mode || "").toUpperCase();
    const pct = (w: any) => {
      const n = Number(w) || 0;
      return Math.round(n <= 1 ? n * 100 : n);
    };
    const votes = "VOTES are weighted vote points.";
    if (mode === "COMBINED_AUDIENCE_AND_JUDGES") {
      let a = pct(first?.audience_weight);
      let j = pct(first?.judge_weight);
      if (!a && !j) a = j = 50;
      return `SCORE out of 100 — judges ${j}% + audience ${a}%. ${votes}`;
    }
    if (mode === "AUDIENCE_VOTING_ONLY") return `SCORE comes from audience votes. ${votes}`;
    if (mode === "JUDGES_SCORE_ONLY") return "SCORE is the judges' marks — votes don't change the ranking.";
    return null;
  }, [lbData, rawRows]);

  const top1 = rawRows[0] || null;
  const top2 = rawRows[1] || null;
  const top3 = rawRows[2] || null;

  /** A podium slot from a real leaderboard row — nothing invented. */
  const toEntry = (r: Row | null): PodiumEntry =>
    r
      ? {
          key: pidOf(r) || r.name || "",
          name: r.name || "Contestant",
          avatar: getAvatarSource(r.profile_photo, r.participant_id || r.email),
          score: formatScore(r.final_score ?? voteCount(r)),
          verified: isVerified(r),
        }
      : null;

  /* The shareable image: the screen's own podium and table (same components,
     same styles), the top ten, framed with the brand strip. */
  const SHARE_W = Math.min(SCREEN_W - 40, 420);
  const shareSub = [activeCategory !== "ALL" ? activeCategory : null, isMultiRound && roundInfo ? roundInfo.name || `Round ${activeRound}` : null]
    .filter(Boolean)
    .join(" · ");
  const shareBoard = (
    <LinearGradient colors={["#FF385C", "#F9862B"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: SHARE_W, borderRadius: 26, padding: 5, alignSelf: "center" }}>
      <View style={{ borderRadius: 22, overflow: "hidden", backgroundColor: "#08090C" }}>
        <LinearGradient
          colors={["rgba(124, 58, 237, 0.22)", "rgba(245, 158, 11, 0.07)", "transparent"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={{ alignItems: "center", paddingTop: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: "#FF385C" }} />
            <Txt size={10.5} font="sansBold" tracking={2} style={{ color: "#FF6A84" }}>LIVE LEADERBOARD</Txt>
          </View>
          {shareSub ? <Txt size={12} tone="subtle" style={{ marginTop: 4 }}>{shareSub}</Txt> : null}
        </View>

        <Podium width={SHARE_W - 10} first={toEntry(top1)} second={toEntry(top2)} third={toEntry(top3)} replayKey={`share|${sel}|${activeCategory}|${activeRound ?? ""}`} bg="#08090C" />

        <Txt size={26} font="display" align="center" numberOfLines={2} style={{ color: "#fff", paddingHorizontal: 16, marginTop: 4 }}>{compTitle}</Txt>

        <View style={[styles.tableHeader, { marginTop: 14 }]}>
          <View style={{ width: 44, alignItems: "center" }}><Txt size={10.5} font="sansBold" style={styles.headerLabel}>RANK</Txt></View>
          <View style={{ flex: 1, paddingLeft: 8 }}><Txt size={10.5} font="sansBold" style={styles.headerLabel}>USER</Txt></View>
          <View style={{ width: 60, alignItems: "flex-end", paddingRight: 10 }}><Txt size={10.5} font="sansBold" style={styles.headerLabel}>SCORE</Txt></View>
          <View style={{ width: 58, alignItems: "flex-end", paddingRight: 4 }}><Txt size={10.5} font="sansBold" style={styles.headerLabel}>VOTES</Txt></View>
        </View>
        <View style={[styles.tableBody, { paddingBottom: 8 }]}>
          {!rawRows.length ? (
            <Txt size={13} tone="subtle" align="center" style={{ paddingVertical: 22 }}>
              {activeCategory !== "ALL" ? `No one in ${activeCategory} yet — entries are open.` : "Rankings appear once voting starts."}
            </Txt>
          ) : null}
          {rawRows.slice(0, 10).map((r, i) => {
            const rankNum = r.rank || i + 1;
            return (
              <View key={r.participant_id || r.email || i} style={styles.tableRow}>
                <View style={{ width: 44, alignItems: "center", justifyContent: "center" }}>
                  {rankNum <= 3 ? (
                    <RankLaurel rank={rankNum} size={40} medal />
                  ) : (
                    <View style={styles.tableNumCircle}>
                      <Txt size={12.5} font="sansBold" style={{ color: "#E2E8F0" }}>{rankNum}</Txt>
                    </View>
                  )}
                </View>
                <View style={styles.userColumn}>
                  <View style={[styles.tableAvatarRing, { borderColor: LIST_RING_COLORS[i % LIST_RING_COLORS.length] }]}>
                    <Image source={getAvatarSource(r.profile_photo, r.participant_id || rankNum)} style={styles.avatarImg} contentFit="cover" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <VerifiedName name={r.name || "Contestant"} row={r} size={13.5} lh={18} numberOfLines={2} style={{ color: "#FFFFFF" }} />
                    {r.category ? <Txt size={10} tone="subtle" style={{ marginTop: 1 }}>{r.category}</Txt> : null}
                  </View>
                </View>
                <View style={{ width: 60, alignItems: "flex-end", paddingRight: 10 }}>
                  <Txt size={13.5} font="sansExt" style={{ color: "#FFFFFF" }}>{formatScore(r.final_score ?? voteCount(r))}</Txt>
                </View>
                <View style={{ width: 58, alignItems: "flex-end" }}>
                  <View style={[styles.voteActionBtn, styles.voteStatic]}>
                    <Heart size={12} color="#8A90A6" />
                    <Txt size={11.5} font="sansBold" style={{ color: "#C5CAD6" }}>{voteCount(r)}</Txt>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Image source={require("../../assets/Logo/u-mark-white-512.png")} style={{ width: 22, height: 22 }} contentFit="contain" />
          <Txt size={13.5} font="sansBold" style={{ color: "#fff" }}>Upgrade Talents India</Txt>
        </View>
        <Txt size={13.5} font="sansBold" style={{ color: "#fff" }}>#VoteNow</Txt>
      </View>
    </LinearGradient>
  );

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
                if (sel) publicApi.shareCompetition(String(sel)).then(setShareData).catch(() => {});
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
          {sel ? (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                setShareImage(true);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Share leaderboard as an image"
              style={({ pressed }) => [styles.headerBtn, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}
            >
              <ImageDown size={17} color="#FFFFFF" />
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
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshBoard}
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
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      pickRound(rNum);
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
                      style={{ color: on ? "#FFFFFF" : "rgba(255,255,255,0.55)" }}
                    >
                      {rnd.name || `Round ${rNum}`}
                    </Txt>
                    <RoundStatus status={rnd.status} />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}

        {roundInfo ? (
          <RoundBrief
            round={roundInfo}
            total={rounds.length}
            advancing={advancingCount}
            isLive={activeRound === currentRound}
          />
        ) : null}

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
          <View style={[styles.searchBar, searchFocused && styles.searchBarOn]}>
            <View style={[styles.searchIcon, searchFocused && styles.searchIconOn]}>
              <Search size={16} color={searchFocused ? "#FF385C" : "#9EA3B8"} strokeWidth={2.4} />
            </View>
            <TextInput
              placeholder="Search name, email or ID"
              placeholderTextColor="#6B7186"
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={styles.searchInput}
              selectionColor="#FF385C"
              cursorColor="#FF385C"
              returnKeyType="search"
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="never"
              accessibilityLabel="Search contestants"
            />
            {search.trim().length > 0 ? (
              <>
                <View style={styles.searchCount}>
                  <Txt size={11} font="sansBold" style={{ color: filteredRows.length ? "#C5CAD6" : "#FF385C" }}>
                    {filteredRows.length ? `${filteredRows.length} found` : "No match"}
                  </Txt>
                </View>
                <Pressable
                  onPress={() => setSearch("")}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  style={({ pressed }) => [styles.searchClear, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <X size={13} color="#FFFFFF" strokeWidth={2.6} />
                </Pressable>
              </>
            ) : null}
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
        {lbLoading ? (
          <View style={{ gap: 14, marginTop: 10, paddingHorizontal: 16 }}>
            <Skeleton h={220} radius={22} />
            <Skeleton h={300} radius={22} />
          </View>
        ) : roundUpcoming ? (
          <QualifiedList
            loading={qualified.loading}
            roundName={roundInfo?.name || `Round ${activeRound}`}
            rows={qualifiedRows.filter(
              (r: any) =>
                !searching ||
                [r.user_name, r.full_name, r.name, r.registration_reference].some((v) => String(v || "").toLowerCase().includes(search.trim().toLowerCase()))
            )}
          />
        ) : filteredRows.length > 0 ? (
          <View style={{ opacity: lbSwitching ? 0.45 : 1 }}>
            {/* ══════════════════════════════════════════════════════════
                TOP 3 3D ISOMETRIC GLASS PEDESTAL PODIUM
               ══════════════════════════════════════════════════════════ */}
            {/* The blocks rise out of the floor on their own; replays when the
                competition, round or category changes — not after a vote. */}
            {searching ? null : (
            <View style={styles.podiumWrapper}>
              <Podium
                width={SCREEN_W}
                first={toEntry(top1)}
                second={toEntry(top2)}
                third={toEntry(top3)}
                replayKey={`${sel}|${(lbData as any)?.round_number ?? ""}|${activeCategory}`}
              />
            </View>
            )}

            {/* ══════════════════════════════════════════════════════════
                SPOTLIGHT PRIZE POOL BANNER (Matching Screenshot)
               ══════════════════════════════════════════════════════════ */}
            {/* tucks under the podium normally; with the podium hidden (searching) it sits in flow */}
            <View style={[styles.spotlightBanner, searching && { marginTop: 12 }]}>
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
              {scoreNote ? (
                <View style={styles.scoreNote}>
                  <Txt size={11.5} lh={16} style={{ color: "#8A90A6" }}>
                    <Txt size={11.5} font="sansBold" style={{ color: "#C5CAD6" }}>How it's scored · </Txt>
                    {scoreNote}
                  </Txt>
                </View>
              ) : null}

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
                  const advancing = isMultiRound && !!(r as any).is_advancing;
                  const out = String((r as any).round_status || "").toUpperCase() === "ELIMINATED";
                  // the cutoff sits under the last contestant inside the advancing zone
                  const cutoffAfter =
                    advancing && !(filteredRows[i + 1] as any)?.is_advancing && i < filteredRows.length - 1;
                  return (
                    <React.Fragment key={r.participant_id || r.email || i}>
                    <View style={[styles.tableRow, out && { opacity: 0.55 }, isMe(r) && styles.tableRowMe]}>
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
                          <VerifiedName name={r.name || "Contestant"} row={r} size={13.5} lh={18} style={{ color: "#FFFFFF" }} />
                          {r.category ? (
                            <Txt size={10} tone="subtle" style={{ marginTop: 1 }}>
                              {r.category}
                            </Txt>
                          ) : null}
                          {advancing || out ? (
                            <View style={[styles.zoneChip, out && styles.zoneChipOut]}>
                              {advancing ? <ArrowUpRight size={10} color="#22C55E" strokeWidth={3} /> : null}
                              <Txt size={10} font="sansBold" style={{ color: advancing ? "#22C55E" : "#8A90A6" }}>
                                {advancing ? (roundInfo?.is_final_round ? "Winner zone" : "Qualifies") : "Eliminated"}
                              </Txt>
                            </View>
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
                        {!canVote ? (
                          <View style={[styles.voteActionBtn, styles.voteStatic]}>
                            <Heart size={12} color="#8A90A6" />
                            <Txt size={11.5} font="sansBold" style={{ color: "#C5CAD6" }}>
                              {voteCount(r)}
                            </Txt>
                          </View>
                        ) : (
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
                        )}
                      </View>
                    </View>
                    {cutoffAfter ? (
                      <View style={styles.cutoff}>
                        <View style={styles.cutoffLine} />
                        <Txt size={10} font="sansBold" tracking={1.4} style={{ color: "#22C55E" }}>
                          {advancingCount ? `TOP ${advancingCount} ADVANCE` : "QUALIFYING CUTOFF"}
                        </Txt>
                        <View style={styles.cutoffLine} />
                      </View>
                    ) : null}
                    </React.Fragment>
                  );
                })}
              </View>
            </Animated.View>
          </View>
        ) : (
          <EmptyState
            icon={<Trophy size={28} color="#9EA3B8" />}
            title={searching ? "No contestant matches search" : activeCategory !== "ALL" ? `No one in ${activeCategory} yet` : "No rankings available"}
            subtitle={
              searching
                ? "Try searching with a different name."
                : activeCategory !== "ALL"
                  ? "Rankings for this category appear once its contestants are scored."
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

      <ShareImageSheet visible={shareImage} onClose={() => setShareImage(false)} cta="Share leaderboard" dialogTitle={`${compTitle} — leaderboard`}>
        {shareBoard}
      </ShareImageSheet>

      <ShareSheet
        visible={shareOpen}
        title="Share leaderboard"
        subtitle={compTitle}
        message={shareMessage}
        url={`${siteOrigin}/leaderboard?competition=${sel ?? ""}`}
        card={{
          image: shareData?.image_url || compImage(selectedComp),
          title: `${compTitle} — Live leaderboard`,
          meta: top1 ? `Leading: ${top1.name || "Contestant"}` : null,
        }}
        onClose={() => setShareOpen(false)}
      />
    </View>
  );
}

/* ── Rounds ─────────────────────────────────────────────────────────────── */

const ROUND_TONE: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Live", color: "#FF385C" },
  COMPLETED: { label: "Done", color: "#22C55E" },
  UPCOMING: { label: "Upcoming", color: "#8A90A6" },
};
const toneOf = (status?: string) => ROUND_TONE[String(status || "").toUpperCase()] || ROUND_TONE.UPCOMING;

/** Tiny status line under a round tab. */
function RoundStatus({ status }: { status?: string }) {
  const t = toneOf(status);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
      <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: t.color }} />
      <Txt size={10} font="sansSemi" style={{ color: t.color }}>{t.label}</Txt>
    </View>
  );
}

const shortDate = (d?: string | null) => {
  if (!d) return null;
  const t = new Date(d);
  return Number.isFinite(t.getTime()) ? t.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null;
};

/** What this round is: its stage in the journey, who's in it, how many go through. */
function RoundBrief({
  round,
  total,
  advancing,
  isLive,
}: {
  round: RoundInfo;
  total: number;
  advancing: number | null;
  isLive: boolean;
}) {
  const t = toneOf(round.status);
  const dates = [shortDate(round.start_date), shortDate(round.end_date)].filter(Boolean).join(" – ");
  const facts = [
    `Round ${round.round_number} of ${total}`,
    round.qualified_contestant_count != null ? `${round.qualified_contestant_count} in this round` : null,
    dates || null,
  ].filter(Boolean);
  return (
    <View style={styles.brief}>
      <View style={[styles.briefIcon, { backgroundColor: t.color + "1F" }]}>
        {round.is_final_round ? <Trophy size={16} color={t.color} /> : <Flag size={16} color={t.color} />}
      </View>
      <View style={{ flex: 1 }}>
        <Txt size={14} font="sansBold" style={{ color: "#FFFFFF" }}>
          {round.name || `Round ${round.round_number}`}
        </Txt>
        <Txt size={11.5} style={{ color: "#8A90A6", marginTop: 2 }}>{facts.join(" · ")}</Txt>
        {round.description ? (
          <Txt size={12} lh={17} style={{ color: "#C5CAD6", marginTop: 6 }}>{round.description}</Txt>
        ) : null}
        <Txt size={11.5} font="sansSemi" style={{ color: round.is_final_round ? "#F5C542" : "#22C55E", marginTop: 6 }}>
          {round.is_final_round
            ? "Final round — this decides the winners"
            : advancing
            ? `Top ${advancing} advance to the next round`
            : "Qualifiers are picked when this round closes"}
        </Txt>
        {!isLive && String(round.status).toUpperCase() !== "UPCOMING" ? (
          <Txt size={11} style={{ color: "#8A90A6", marginTop: 4 }}>Votes now count towards the live round.</Txt>
        ) : null}
      </View>
    </View>
  );
}

/** Contestants qualified into a round that hasn't started yet. */
function QualifiedList({ loading, roundName, rows }: { loading: boolean; roundName: string; rows: Row[] }) {
  if (loading) {
    return (
      <View style={{ gap: 10, marginTop: 10, paddingHorizontal: 16 }}>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={60} radius={16} />)}
      </View>
    );
  }
  if (!rows.length) {
    return (
      <EmptyState
        icon={<Lock size={26} color="#9EA3B8" />}
        title={`${roundName} hasn't started`}
        subtitle="Qualifiers are announced when the previous round closes."
      />
    );
  }
  return (
    <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <Txt size={17} font="sansBold" style={{ color: "#FFFFFF" }}>Qualified for {roundName}</Txt>
        <Txt size={12} font="sansSemi" style={{ color: "#8A90A6" }}>{rows.length}</Txt>
      </View>
      <View style={{ gap: 8 }}>
        {rows.map((r: any, i) => (
          <View key={r.registration_id || r.user_email || i} style={styles.qRow}>
            <Txt size={12} font="sansExt" style={{ color: "#8A90A6", width: 22, textAlign: "center" }}>{i + 1}</Txt>
            <View style={styles.tableAvatarRing}>
              <Image source={getAvatarSource(r.profile_photo || r.avatar, r.user_email || i)} style={styles.avatarImg} contentFit="cover" />
            </View>
            <View style={{ flex: 1 }}>
              <VerifiedName name={r.user_name || r.full_name || "Contestant"} row={r} size={13.5} lh={18} style={{ color: "#FFFFFF" }} />
              {r.category ? <Txt size={10.5} tone="subtle" style={{ marginTop: 1 }}>{r.category}</Txt> : null}
            </View>
            <View style={styles.zoneChip}>
              <Check size={10} color="#22C55E" strokeWidth={3} />
              <Txt size={10} font="sansBold" style={{ color: "#22C55E" }}>Qualified</Txt>
            </View>
          </View>
        ))}
      </View>
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
  /* Title sits next to the back button and takes the room that's left, so
     the three actions on the right can never run into it. */
  headerTitleWrap: {
    flex: 1,
    marginHorizontal: 12,
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
    marginTop: 8,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    borderRadius: 16,
    paddingLeft: 6,
    paddingRight: 8,
    gap: 10,
    backgroundColor: "#14161E",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  /* focus: the accent ring + a soft glow, nothing louder */
  // border + tint only: toggling elevation/shadow on Android can rebuild the
  // native view under the input, which drops focus and closes the keyboard
  searchBarOn: {
    borderColor: "rgba(255, 56, 92, 0.55)",
    backgroundColor: "#181A23",
  },
  searchIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  searchIconOn: { backgroundColor: "rgba(255, 56, 92, 0.14)" },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: "Inter_500Medium",
    color: "#FFFFFF",
    paddingVertical: 0,
  },
  searchCount: {
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 999,
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  searchClear: {
    width: 26,
    height: 26,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.14)",
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
    minHeight: 46,
    paddingVertical: 6,
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
  // your own row: a lifted grey band with a white edge — calm, not alarming
  // your own row: a rounded, lifted grey tile with a light rim — not a square band
  tableRowMe: {
    marginHorizontal: 8,
    marginVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 18,
    borderBottomWidth: 1,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },
  meEdge: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  youChip: {
    alignSelf: "flex-start",
    marginTop: 3,
    paddingHorizontal: 7,
    height: 17,
    borderRadius: 999,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
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
  scoreNote: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  zoneChip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 3,
    marginTop: 4,
    paddingHorizontal: 7,
    height: 18,
    borderRadius: 999,
    backgroundColor: "rgba(34,197,94,0.12)",
  },
  zoneChipOut: { backgroundColor: "rgba(255,255,255,0.06)" },
  cutoff: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cutoffLine: { flex: 1, height: 1, backgroundColor: "rgba(34,197,94,0.35)" },
  voteStatic: { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)" },
  brief: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  briefIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  qRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
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
