import React, { useEffect, useMemo, useState } from "react";
import { View, Pressable, ScrollView, TextInput, StyleSheet, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import {
  Trophy,
  Medal,
  Crown,
  Heart,
  Search,
  Sparkles,
  Flame,
  UserCheck,
  ChevronRight,
  TrendingUp,
} from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { publicApi, competeApi, safe, toRows } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useSession } from "@/context/Session";
import { Txt, Card, Skeleton, EmptyState, Divider } from "@/components/ui";
import { VerifiedTick } from "@/components/VerifiedBadge";
import { AppImage } from "@/components/AppImage";
import { FadeInUp } from "@/components/FadeInUp";

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

const PODIUM_CONFIG = [
  {
    rank: 1,
    title: "1st Place",
    label: "CHAMPION",
    border: "#F59E0B",
    bgGrad: ["rgba(245, 158, 11, 0.28)", "rgba(20, 22, 30, 0.95)"],
    badgeGrad: ["#FBBF24", "#F59E0B"],
    textColor: "#FCD34D",
    Icon: Crown,
  },
  {
    rank: 2,
    title: "2nd Place",
    label: "RUNNER-UP",
    border: "#94A3B8",
    bgGrad: ["rgba(148, 163, 184, 0.25)", "rgba(20, 22, 30, 0.95)"],
    badgeGrad: ["#E2E8F0", "#94A3B8"],
    textColor: "#E2E8F0",
    Icon: Medal,
  },
  {
    rank: 3,
    title: "3rd Place",
    label: "2ND RUNNER-UP",
    border: "#B45309",
    bgGrad: ["rgba(180, 83, 9, 0.25)", "rgba(20, 22, 30, 0.95)"],
    badgeGrad: ["#D97706", "#B45309"],
    textColor: "#FDBA74",
    Icon: Medal,
  },
];

export default function Leaderboard() {
  const { c } = useTheme();
  const { user } = useSession();
  const params = useLocalSearchParams<{ competition?: string; comp_id?: string; id?: string }>();
  const initialCompId = params.competition || params.comp_id || params.id;

  const comps = useAsync(() => safe(publicApi.competitions(), []), []);
  const list = toRows(comps.data);
  const [sel, setSel] = useState<string | null>(initialCompId || null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [activeRound, setActiveRound] = useState<number | null>(null);
  const [rounds, setRounds] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryLeaderboards, setCategoryLeaderboards] = useState<Record<string, Row[]>>({});
  const [votingId, setVotingId] = useState<string | null>(null);

  // Sync initial or first competition
  useEffect(() => {
    if (!sel && list.length) {
      setSel(list[0]._id || list[0].id);
    }
  }, [list.length]);

  // When competition changes, fetch rounds & categories
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

  // Compute effective rows based on active category
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

  // Find current user's standing if they are a contestant
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

  const handleVote = async (r: Row) => {
    const pId = r.participant_id || r.email;
    if (!pId || !sel) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setVotingId(pId);
      await competeApi.vote(sel, pId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Vote Recorded!", `You cast your vote for ${r.name || "the contestant"}.`);
      lb.refresh();
    } catch (e: any) {
      Alert.alert("Voting info", e?.message || "Could not submit vote at this moment.");
    } finally {
      setVotingId(null);
    }
  };

  const top3 = filteredRows.slice(0, 3);
  const remaining = filteredRows.slice(3);

  return (
    <SubScreen eyebrow="Live Rankings" title="Leaderboard" refreshing={lb.refreshing} onRefresh={lb.refresh}>
      {/* Gen-Z District Hero Banner */}
      <FadeInUp>
        <View style={styles.heroContainer}>
          <LinearGradient
            colors={["#7C3AED", "#FF385C", "#08090C"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroHeader}>
              <View style={styles.trophyIconWrap}>
                <Trophy size={22} color="#FFF" />
              </View>
              <View style={styles.liveTag}>
                <Flame size={12} color="#C9F24A" />
                <Txt size={11} font="sansBold" style={{ color: "#C9F24A" }}>
                  LIVE ROUND
                </Txt>
              </View>
            </View>
            <Txt size={24} font="display" lh={28} style={{ color: "#FFF", marginTop: 12 }}>
              District Spotlight.{"\n"}Every Score Counts.
            </Txt>
            <Txt size={12.5} tone="subtle" style={{ color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
              Audience votes and judge criteria combined in real-time.
            </Txt>
          </LinearGradient>
        </View>
      </FadeInUp>

      {/* Competition selector pills */}
      {list.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.compListContent}
          style={styles.compList}
        >
          {list.map((cp: any) => {
            const id = cp._id || cp.id;
            const on = sel === id;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setSel(id);
                }}
                style={[
                  styles.compPill,
                  {
                    backgroundColor: on ? "#FF385C" : c.surface,
                    borderColor: on ? "#FF385C" : c.border,
                  },
                ]}
              >
                <Txt size={13} font="sansBold" style={{ color: on ? "#FFF" : c.fgMuted }} numberOfLines={1}>
                  {cp.title || cp.name}
                </Txt>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Round selector chips if multiple rounds */}
      {rounds.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.compListContent}
          style={{ marginBottom: 14 }}
        >
          {rounds.map((rnd: any) => {
            const rNum = rnd.round_number;
            const on = activeRound === rNum;
            return (
              <Pressable
                key={rNum}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveRound(rNum);
                }}
                style={[
                  styles.roundPill,
                  {
                    backgroundColor: on ? "rgba(201, 242, 74, 0.15)" : c.surface2,
                    borderColor: on ? "#C9F24A" : "transparent",
                  },
                ]}
              >
                <Sparkles size={12} color={on ? "#C9F24A" : c.fgSubtle} />
                <Txt size={12} font="sansBold" style={{ color: on ? "#C9F24A" : c.fgMuted }}>
                  {rnd.round_name || `Round ${rNum}`}
                </Txt>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Search Bar & Category Chips */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Search size={16} color={c.fgMuted} />
          <TextInput
            placeholder="Search contestant or handle..."
            placeholderTextColor={c.fgSubtle}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: c.fg }]}
            returnKeyType="search"
          />
        </View>

        {/* Category Pills (ALL, Junior, Senior, etc.) */}
        {categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
          >
            {["ALL", ...categories].map((cat) => {
              const active = activeCategory === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActiveCategory(cat);
                  }}
                  style={[
                    styles.catPill,
                    {
                      backgroundColor: active ? c.accent : c.surface2,
                      borderColor: active ? c.accent : "transparent",
                    },
                  ]}
                >
                  <Txt size={11.5} font="sansBold" style={{ color: active ? "#FFF" : c.fgMuted }}>
                    {cat}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Pinned "Your Standing" card if participant */}
      {myStanding && (
        <FadeInUp>
          <View style={[styles.myStandingCard, { backgroundColor: "rgba(139, 92, 246, 0.15)", borderColor: "#8B5CF6" }]}>
            <View style={styles.myStandingLeft}>
              <View style={styles.myRankBadge}>
                <Txt size={18} font="display" style={{ color: "#C9F24A" }}>
                  #{myStanding.rank}
                </Txt>
              </View>
              <View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <UserCheck size={14} color="#8B5CF6" />
                  <Txt size={13} font="sansBold" style={{ color: "#FFF" }}>
                    Your Standing
                  </Txt>
                </View>
                <Txt size={11.5} tone="subtle">
                  {myStanding.row.name || user?.name || "You"} •{" "}
                  {typeof myStanding.row.final_score === "number"
                    ? `${myStanding.row.final_score} pts`
                    : `${myStanding.row.audience_votes ?? 0} votes`}
                </Txt>
              </View>
            </View>
            <View style={styles.standingTrend}>
              <TrendingUp size={16} color="#C9F24A" />
              <Txt size={11} font="sansBold" style={{ color: "#C9F24A" }}>
                Active
              </Txt>
            </View>
          </View>
        </FadeInUp>
      )}

      {/* Results content */}
      {lb.loading ? (
        <View style={{ gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} h={80} radius={18} />
          ))}
        </View>
      ) : filteredRows.length > 0 ? (
        <View style={{ gap: 16 }}>
          {/* Top 3 Podium */}
          {top3.map((r, i) => {
            const cfg = PODIUM_CONFIG[i] || PODIUM_CONFIG[0];
            const Icon = cfg.Icon;
            return (
              <FadeInUp key={r.participant_id || r.email || i} delay={i * 80}>
                <View style={[styles.podiumCard, { borderColor: cfg.border }]}>
                  <LinearGradient
                    colors={cfg.bgGrad as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.podiumInner}
                  >
                    {/* Rank Indicator */}
                    <View style={[styles.podiumRankBadge, { backgroundColor: cfg.border }]}>
                      <Icon size={16} color="#08090C" />
                      <Txt size={11} font="display" style={{ color: "#08090C" }}>
                        {cfg.title}
                      </Txt>
                    </View>

                    <View style={styles.podiumRow}>
                      <View style={[styles.podiumAvatarWrap, { borderColor: cfg.border }]}>
                        <AppImage uri={r.profile_photo} seed={i} style={styles.podiumAvatar} />
                      </View>

                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          <Txt size={16} font="sansExt" numberOfLines={1} style={{ flexShrink: 1, color: "#FFF" }}>
                            {r.name || "Contestant"}
                          </Txt>
                          <VerifiedTick row={r} size={14} />
                        </View>
                        {r.category && (
                          <Txt size={11} font="sansBold" style={{ color: cfg.textColor, marginTop: 2 }}>
                            {r.category.toUpperCase()}
                          </Txt>
                        )}
                        <View style={styles.statsRow}>
                          <Txt size={12} tone="subtle">
                            Votes: <Txt size={12} font="sansBold" style={{ color: "#FFF" }}>{r.audience_votes ?? r.raw_audience_votes ?? 0}</Txt>
                          </Txt>
                          {typeof r.judge_score === "number" && (
                            <Txt size={12} tone="subtle">
                              Judge: <Txt size={12} font="sansBold" style={{ color: "#FFF" }}>{r.judge_score}</Txt>
                            </Txt>
                          )}
                        </View>
                      </View>

                      {/* Score / Vote Button */}
                      <View style={styles.scoreVoteCol}>
                        <Txt size={24} font="display" style={{ color: cfg.textColor }}>
                          {typeof r.final_score === "number"
                            ? r.final_score
                            : (r.audience_votes ?? r.raw_audience_votes ?? 0)}
                        </Txt>
                        <Pressable
                          onPress={() => handleVote(r)}
                          disabled={votingId === (r.participant_id || r.email)}
                          style={[styles.voteBtn, { backgroundColor: c.accent }]}
                        >
                          <Heart size={12} color="#FFF" />
                          <Txt size={11} font="sansBold" style={{ color: "#FFF" }}>
                            Vote
                          </Txt>
                        </Pressable>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              </FadeInUp>
            );
          })}

          {/* Remaining ranks (4+) */}
          {remaining.length > 0 && (
            <Card padding={0} style={{ borderRadius: 20, overflow: "hidden" }}>
              {remaining.map((r, i) => {
                const rankNum = r.rank || i + 4;
                return (
                  <View key={r.participant_id || r.email || i}>
                    <View style={styles.rowItem}>
                      <Txt size={14} font="display" tone="subtle" style={{ width: 28 }}>
                        #{rankNum}
                      </Txt>
                      <View style={styles.listAvatarWrap}>
                        <AppImage uri={r.profile_photo} seed={i + 3} style={styles.listAvatar} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Txt size={14} font="sansBold" numberOfLines={1} style={{ flexShrink: 1 }}>
                            {r.name || "Contestant"}
                          </Txt>
                          <VerifiedTick row={r} size={12} />
                        </View>
                        <Txt size={11} tone="subtle">
                          {r.category ? `${r.category} • ` : ""}
                          {r.audience_votes ?? r.raw_audience_votes ?? 0} votes
                        </Txt>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Txt size={14} font="display" style={{ color: c.fg }}>
                          {typeof r.final_score === "number"
                            ? r.final_score
                            : (r.audience_votes ?? r.raw_audience_votes ?? 0)}
                        </Txt>
                        <Pressable
                          onPress={() => handleVote(r)}
                          style={[styles.smallVoteBtn, { backgroundColor: c.surface2 }]}
                        >
                          <Heart size={13} color={c.accent} />
                        </Pressable>
                      </View>
                    </View>
                    {i < remaining.length - 1 && <Divider style={{ marginLeft: 50 }} />}
                  </View>
                );
              })}
            </Card>
          )}
        </View>
      ) : (
        <EmptyState
          icon={<Trophy size={28} color={c.fgMuted} />}
          title={search ? "No contestant matches search" : "No rankings available"}
          subtitle={search ? "Try searching with a different name." : "Scores will appear once judging or voting commences."}
        />
      )}
    </SubScreen>
  );
}

const styles = StyleSheet.create({
  heroContainer: {
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 16,
  },
  heroGradient: {
    padding: 18,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trophyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  liveTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(201, 242, 74, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(201, 242, 74, 0.4)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  compList: {
    marginBottom: 12,
  },
  compListContent: {
    gap: 8,
    paddingBottom: 4,
  },
  compPill: {
    paddingHorizontal: 15,
    height: 36,
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
  },
  roundPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
  },
  searchWrap: {
    gap: 10,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
  },
  catPill: {
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  myStandingCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  myStandingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  myRankBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#14161E",
    alignItems: "center",
    justifyContent: "center",
  },
  standingTrend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(201, 242, 74, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  podiumCard: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1.5,
  },
  podiumInner: {
    padding: 14,
  },
  podiumRankBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 10,
  },
  podiumRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  podiumAvatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: 2,
    backgroundColor: "#14161E",
  },
  podiumAvatar: {
    width: "100%",
    height: "100%",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },
  scoreVoteCol: {
    alignItems: "flex-end",
    gap: 6,
  },
  voteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  rowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  listAvatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#14161E",
  },
  listAvatar: {
    width: "100%",
    height: "100%",
  },
  smallVoteBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
