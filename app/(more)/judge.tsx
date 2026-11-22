import React, { useEffect, useState, useMemo } from "react";
import { View, Pressable, ScrollView, TextInput, Modal } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  Gavel,
  ChevronRight,
  Lock,
  Check,
  SkipForward,
  ArrowLeft,
  LogOut,
  KeyRound,
  Search,
  Radio,
  Star,
  Users,
} from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import {
  judgeAuthApi,
  judgeCompetitionsApi,
  tokenStore,
  safe,
  toRows,
  ApiError,
  type JudgeCompetition,
  type JudgeContestant,
} from "@/lib/api";
import { Txt, Card, Button, Field, Input, Skeleton, EmptyState, Badge, Divider } from "@/components/ui";
import { useAlert } from "@/components/Popup";
import { StaffLogin } from "@/components/StaffLogin";
import { FadeInUp } from "@/components/FadeInUp";
import { AppImage } from "@/components/AppImage";
import { titleCase } from "@/lib/format";

const TINT: [string, string] = ["#b36bff", "#6d28d9"]; // violet = judging

export default function JudgePanel() {
  const { c } = useTheme();
  const [authed, setAuthed] = useState(!!tokenStore.getStaff());
  const [comps, setComps] = useState<JudgeCompetition[]>([]);
  const [loading, setLoading] = useState(false);
  const [comp, setComp] = useState<JudgeCompetition | null>(null);
  const [subs, setSubs] = useState<JudgeContestant[]>([]);
  const [prog, setProg] = useState<any>(null);
  const [active, setActive] = useState<JudgeContestant | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comments, setComments] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [livePerformer, setLivePerformer] = useState<any | null>(null);
  const [liveMode, setLiveMode] = useState(false);

  // Contestant Filter & Search
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "pending" | "scored">("all");

  const alert = useAlert();
  const flash = (tone: "success" | "error", text: string) =>
    alert(tone, tone === "success" ? "Done" : "Something went wrong", text);

  const loadComps = async () => {
    setLoading(true);
    const rows = toRows(await safe(judgeCompetitionsApi.listAssigned(), [] as any));
    setComps(rows);
    setLoading(false);
  };
  useEffect(() => {
    if (authed) loadComps();
  }, [authed]);

  const refreshProg = (compId: string) => {
    judgeCompetitionsApi.myProgress(compId).then(setProg).catch(() => {});
  };

  const openComp = async (cp: JudgeCompetition) => {
    setComp(cp);
    setProg(null);
    setBusy(true);
    setSubs(toRows(await safe(judgeCompetitionsApi.listContestants(cp._id), [] as any)));
    setBusy(false);
    refreshProg(cp._id);
  };

  const openSub = async (s: JudgeContestant) => {
    setActive(s);
    setLiveMode(false);
    setScores({});
    setComments("");
    const d = await safe(judgeCompetitionsApi.getDraft(comp!._id, s._id), null as any);
    if (d?.scores) {
      setScores(Object.fromEntries(Object.entries(d.scores).map(([k, v]) => [k, String(v)])));
    }
    if (d?.comments) setComments(d.comments);
  };

  // Poll live stage
  useEffect(() => {
    if (!comp || active) return;
    let alive = true;
    const pull = async () => {
      const d = await safe(judgeCompetitionsApi.currentPerformer(comp._id), null as any);
      if (alive) {
        setLivePerformer(
          d?.has_active_performer ? d.current_performer || d : d?.current_performer || null
        );
      }
    };
    pull();
    const id = setInterval(pull, 8000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [comp?._id, active]);

  const openLive = () => {
    if (!livePerformer) return;
    const p = livePerformer;
    setActive({
      _id: String(p.submission_id || p.participant_id || p.user_email || "live"),
      user_name: p.participant_name || p.user_name,
      user_email: p.user_email,
      title: p.entry_title,
      media_url: p.avatar || p.user_photo,
      status: "LIVE",
    } as any);
    setLiveMode(true);
    setScores({});
    setComments("");
  };

  const numScores = () =>
    Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Number(v) || 0]));

  const totalScore = useMemo(() => {
    return Object.values(scores).reduce((sum, v) => sum + (Number(v) || 0), 0);
  }, [scores]);

  const submit = async () => {
    if (!active) return;
    setBusy(true);
    try {
      if (liveMode && comp) {
        await judgeCompetitionsApi.scoreLiveStage(comp._id, {
          submission_id: active._id,
          scores: numScores(),
          comments: comments || undefined,
        });
      } else {
        await judgeCompetitionsApi.submitScore(active._id, numScores(), comments || undefined);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      flash("success", liveMode ? "Live score recorded." : "Score submitted.");
      // Mark as scored in local state
      setSubs((prev) =>
        prev.map((s) => (s._id === active._id ? { ...s, is_scored: true } : s))
      );
      if (comp) refreshProg(comp._id);
      setActive(null);
      setLiveMode(false);
    } catch (e) {
      flash("error", e instanceof ApiError ? e.message : "Could not submit.");
    } finally {
      setBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!active || !comp) return;
    setBusy(true);
    try {
      await judgeCompetitionsApi.saveDraft(
        comp._id,
        active._id,
        numScores(),
        comments || undefined
      );
      flash("success", "Draft saved.");
    } catch (e) {
      flash("error", e instanceof ApiError ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    if (!active || !comp) return;
    setBusy(true);
    try {
      await judgeCompetitionsApi.skipContestant(comp._id, active._id, "Conflict of interest (COI)");
      flash("success", "Marked as conflict of interest.");
      if (comp) refreshProg(comp._id);
      setActive(null);
    } catch (e) {
      flash("error", e instanceof ApiError ? e.message : "Could not skip.");
    } finally {
      setBusy(false);
    }
  };

  const unlock = async () => {
    if (!comp || !pin.trim()) return;
    setBusy(true);
    try {
      await judgeCompetitionsApi.verifyPin(comp._id, pin.trim());
      flash("success", "Session unlocked.");
      setPin("");
    } catch (e) {
      flash("error", e instanceof ApiError ? e.message : "Wrong PIN.");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await tokenStore.setStaff(null);
    setAuthed(false);
    setComp(null);
    setActive(null);
  };

  const [pwOpen, setPwOpen] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confPw, setConfPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const changePw = async () => {
    if (!curPw || !newPw) return alert("warning", "Fill all fields", "Enter your current and new password.");
    if (newPw.length < 8) return alert("warning", "Too short", "New password must be at least 8 characters.");
    if (newPw !== confPw) return alert("warning", "Doesn't match", "New password and confirmation don't match.");
    setPwBusy(true);
    try {
      await judgeAuthApi.changePassword(curPw, newPw);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      alert("success", "Password updated", "Use your new password next time you sign in.");
      setPwOpen(false); setCurPw(""); setNewPw(""); setConfPw("");
    } catch (e: any) {
      alert("error", "Couldn't change password", e instanceof ApiError ? e.message : "Check your current password and try again.");
    } finally {
      setPwBusy(false);
    }
  };

  // Filtered contestants — computed before any early return so hook order is stable.
  const filteredSubs = useMemo(() => {
    return subs.filter((s: any) => {
      const isScored = Boolean(s.is_scored || s.total_score != null);
      if (filter === "pending" && isScored) return false;
      if (filter === "scored" && !isScored) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = (s.user_name || s.user_email || "").toLowerCase();
        const title = (s.title || "").toLowerCase();
        if (!name.includes(q) && !title.includes(q)) return false;
      }
      return true;
    });
  }, [subs, filter, search]);

  if (!authed) {
    return (
      <SubScreen eyebrow="Panel" title="Judge">
        <StaffLogin
          api={judgeAuthApi}
          role="Judge"
          tint={TINT}
          blurb="Sign in with the email registered by the organiser to score live."
          onDone={() => setAuthed(true)}
        />
      </SubScreen>
    );
  }

  /* ── Scoring sheet ── */
  if (active && comp) {
    const criteria = comp.judging_criteria?.length
      ? comp.judging_criteria
      : [{ name: "Overall Performance", max_score: 100 }];

    const maxPossible = criteria.reduce((sum: number, c: any) => sum + (c.max_score || 0), 0);

    return (
      <SubScreen
        eyebrow={liveMode ? `${comp.title} · Live` : comp.title}
        title={liveMode ? "Score live" : "Score contestant"}
        onBack={() => {
          setActive(null);
          setLiveMode(false);
        }}
      >
        <Card style={{ marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 999,
              overflow: "hidden",
              backgroundColor: c.surface2,
              borderWidth: 1.5,
              borderColor: "#b36bff",
            }}
          >
            <AppImage
              uri={active.media_url}
              seed={active._id}
              style={{ width: "100%", height: "100%" }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={16.5} font="sansBold" numberOfLines={1}>
              {active.user_name || active.user_email}
            </Txt>
            {active.title ? (
              <Txt size={12.5} tone="muted" numberOfLines={1}>
                {active.title}
              </Txt>
            ) : null}
          </View>

          {/* Running Total Score Pill */}
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "rgba(179, 107, 255, 0.18)",
              borderWidth: 1,
              borderColor: "#b36bff",
              alignItems: "center",
            }}
          >
            <Txt size={14} font="sansBold" style={{ color: "#c084fc" }}>
              {totalScore} / {maxPossible}
            </Txt>
            <Txt size={9} font="monoMed" uppercase style={{ color: "#9ea3b8" }}>
              Total
            </Txt>
          </View>
        </Card>

        {/* Criteria inputs */}
        <View style={{ gap: 14 }}>
          {criteria.map((cr: any) => (
            <Field key={cr.name} label={`${cr.name} (max ${cr.max_score})`} hint={cr.description}>
              <Input
                value={scores[cr.name] || ""}
                onChangeText={(v) =>
                  setScores((s) => ({
                    ...s,
                    [cr.name]: v.replace(/[^0-9.]/g, ""),
                  }))
                }
                keyboardType="numeric"
                placeholder={`0 – ${cr.max_score}`}
              />
            </Field>
          ))}
          <Field label="Written feedback" hint="Optional comments directly for the performer.">
            <Input
              value={comments}
              onChangeText={setComments}
              multiline
              placeholder="Great energy, work on footwork transitions…"
              style={{ minHeight: 90, textAlignVertical: "top", paddingTop: 12 }}
            />
          </Field>
        </View>

        <View style={{ gap: 10, marginTop: 20 }}>
          <Button
            label={liveMode ? `Submit Live Score (${totalScore} pts)` : `Submit Score (${totalScore} pts)`}
            full
            size="lg"
            loading={busy}
            onPress={submit}
            icon={<Check size={17} color={c.onAccent} />}
          />
          {!liveMode ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button label="Save Draft" variant="outline" full onPress={saveDraft} />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="COI Skip"
                  variant="ghost"
                  full
                  onPress={skip}
                  icon={<SkipForward size={15} color={c.danger} />}
                />
              </View>
            </View>
          ) : null}
        </View>
      </SubScreen>
    );
  }

  /* ── Contestants List ── */
  if (comp) {
    return (
      <SubScreen eyebrow="Judging" title={comp.title} onBack={() => setComp(null)}>
        {/* Your scoring progress */}
        {prog ? (() => {
          const scored = Number(prog.scored ?? prog.scored_count ?? prog.total_scored ?? 0);
          const skipped = Number(prog.skipped ?? prog.skipped_count ?? 0);
          const pending = Number(prog.pending ?? prog.pending_count ?? prog.remaining ?? 0);
          const total = Number(prog.total ?? prog.total_contestants ?? (scored + skipped + pending)) || 1;
          const pct = Math.min(100, Math.round(((scored + skipped) / total) * 100));
          return (
            <View style={{ borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 14, marginBottom: 16, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Txt size={11} font="monoMed" tone="subtle" tracking={2} uppercase>Your progress</Txt>
                <Txt size={13} font="sansExt" tone="accent">{pct}%</Txt>
              </View>
              <View style={{ height: 7, borderRadius: 999, backgroundColor: c.surface2, overflow: "hidden" }}>
                <View style={{ width: `${pct}%`, height: "100%", borderRadius: 999, backgroundColor: c.accent }} />
              </View>
              <View style={{ flexDirection: "row", gap: 18 }}>
                <Txt size={12.5} tone="muted"><Txt size={12.5} font="sansBold" tone="success">{scored}</Txt> scored</Txt>
                <Txt size={12.5} tone="muted"><Txt size={12.5} font="sansBold">{pending}</Txt> pending</Txt>
                {skipped ? <Txt size={12.5} tone="muted"><Txt size={12.5} font="sansBold" tone="warning">{skipped}</Txt> skipped</Txt> : null}
              </View>
            </View>
          );
        })() : null}

        {/* On Stage Live Performer Card */}
        {livePerformer ? (
          <Pressable
            onPress={openLive}
            style={({ pressed }) => ({
              marginBottom: 16,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            })}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderRadius: 18,
                borderWidth: 1.5,
                borderColor: "#b36bff",
                backgroundColor: "rgba(179, 107, 255, 0.12)",
                padding: 13,
              }}
            >
              <View
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 999,
                  overflow: "hidden",
                  backgroundColor: c.surface2,
                  borderWidth: 2,
                  borderColor: "#b36bff",
                }}
              >
                <AppImage
                  uri={livePerformer.avatar || livePerformer.user_photo}
                  seed={livePerformer.user_email || "live"}
                  style={{ width: "100%", height: "100%" }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      backgroundColor: "#b36bff",
                    }}
                  />
                  <Txt size={10} font="sansBold" tracking={1.5} style={{ color: "#b36bff" }}>
                    NOW ON STAGE
                  </Txt>
                </View>
                <Txt size={15} font="sansBold" numberOfLines={1} style={{ marginTop: 2, color: "#fff" }}>
                  {livePerformer.participant_name ||
                    livePerformer.user_name ||
                    livePerformer.user_email}
                </Txt>
              </View>
              <Button label="Score now" size="sm" onPress={openLive} />
            </View>
          </Pressable>
        ) : null}

        {/* PIN Unlock Card */}
        <Card style={{ marginBottom: 16, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <Lock size={16} color="#c084fc" />
            <Txt size={14} font="sansBold" style={{ flex: 1 }}>
              Judge session status
            </Txt>
            {comp.judging_status ? (
              <Badge label={titleCase(comp.judging_status)} tone="brand" />
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input
                value={pin}
                onChangeText={setPin}
                keyboardType="number-pad"
                placeholder="Enter PIN to unlock session"
              />
            </View>
            <Button label="Unlock" onPress={unlock} loading={busy} />
          </View>
        </Card>

        {/* Search & Filter Bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            backgroundColor: "#161822",
            borderRadius: 14,
            paddingHorizontal: 12,
            height: 44,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.08)",
            marginBottom: 12,
          }}
        >
          <Search size={16} color="#8e93a8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search contestants…"
            placeholderTextColor="#6b728a"
            style={{ flex: 1, color: "#ffffff", fontSize: 13.5 }}
          />
        </View>

        {/* Status Filter Chips */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          {(
            [
              { k: "all", label: `All (${subs.length})` },
              {
                k: "pending",
                label: `Pending (${subs.filter((s: any) => !s.is_scored && s.total_score == null).length})`,
              },
              {
                k: "scored",
                label: `Scored (${subs.filter((s: any) => s.is_scored || s.total_score != null).length})`,
              },
            ] as const
          ).map((t) => {
            const active = filter === t.k;
            return (
              <Pressable
                key={t.k}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setFilter(t.k);
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: active ? "rgba(179, 107, 255, 0.22)" : "#181a24",
                  borderWidth: 1,
                  borderColor: active ? "#b36bff" : "rgba(255,255,255,0.08)",
                }}
              >
                <Txt
                  size={12}
                  font={active ? "sansBold" : "sansMed"}
                  style={{ color: active ? "#c084fc" : "#8e93a8" }}
                >
                  {t.label}
                </Txt>
              </Pressable>
            );
          })}
        </View>

        {/* Contestants List */}
        {busy && !subs.length ? (
          <View style={{ gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} h={72} radius={18} />
            ))}
          </View>
        ) : filteredSubs.length ? (
          <View style={{ gap: 10 }}>
            {filteredSubs.map((s: any, i) => {
              const isScored = Boolean(s.is_scored || s.total_score != null);
              return (
                <FadeInUp key={s._id} delay={Math.min(i, 8) * 45}>
                  <Pressable onPress={() => openSub(s)}>
                    <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 14,
                          overflow: "hidden",
                          backgroundColor: c.surface2,
                        }}
                      >
                        <AppImage uri={s.media_url} seed={s._id} style={{ width: "100%", height: "100%" }} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt size={15} font="sansBold" numberOfLines={1}>
                          {s.user_name || s.user_email}
                        </Txt>
                        <Txt size={12} tone="subtle" numberOfLines={1}>
                          {s.title || titleCase(s.status || "Registered")}
                        </Txt>
                      </View>

                      {isScored ? (
                        <Badge
                          label={s.total_score != null ? `${s.total_score} pts` : "Scored"}
                          tone="success"
                        />
                      ) : (
                        <Badge label="Pending" tone="warning" />
                      )}

                      <ChevronRight size={18} color={c.fgSubtle} />
                    </Card>
                  </Pressable>
                </FadeInUp>
              );
            })}
          </View>
        ) : (
          <EmptyState
            icon={<Gavel size={26} color={c.fgMuted} />}
            title="No contestants match"
            subtitle="Change the search or status filter."
          />
        )}
      </SubScreen>
    );
  }

  /* ── Assigned competitions ── */
  return (
    <SubScreen
      eyebrow="Panel"
      title="Judge"
      refreshing={loading}
      onRefresh={loadComps}
      right={
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => setPwOpen(true)}
            style={{ width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}
          >
            <KeyRound size={18} color={c.fgMuted} />
          </Pressable>
          <Pressable
            onPress={logout}
            style={{ width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}
          >
            <LogOut size={18} color={c.fgMuted} />
          </Pressable>
        </View>
      }
    >
      <View style={{ borderRadius: 24, overflow: "hidden", marginBottom: 18 }}>
        <LinearGradient colors={TINT as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20 }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: "rgba(255,255,255,0.26)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Gavel size={21} color="#fff" />
          </View>
          <Txt size={24} font="display" tracking={-0.5} style={{ color: "#fff", marginTop: 12 }}>
            Your panel
          </Txt>
          <Txt size={13} style={{ color: "rgba(255,255,255,0.9)", marginTop: 6 }}>
            Competitions assigned to you.
          </Txt>
        </LinearGradient>
      </View>

      {loading ? (
        <View style={{ gap: 12 }}>
          {[0, 1].map((i) => (
            <Skeleton key={i} h={84} radius={20} />
          ))}
        </View>
      ) : comps.length ? (
        <View style={{ gap: 12 }}>
          {comps.map((cp, i) => (
            <FadeInUp key={cp._id} delay={i * 60}>
              <Pressable onPress={() => openComp(cp)}>
                <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      backgroundColor: "#b36bff22",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Gavel size={20} color="#7c3aed" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt size={15.5} font="sansExt" numberOfLines={1}>
                      {cp.title}
                    </Txt>
                    <Txt size={12} tone="subtle" numberOfLines={1}>
                      {cp.category}
                      {cp.judging_status ? ` · ${titleCase(cp.judging_status)}` : ""}
                    </Txt>
                  </View>
                  <ChevronRight size={18} color={c.fgSubtle} />
                </Card>
              </Pressable>
            </FadeInUp>
          ))}
        </View>
      ) : (
        <EmptyState
          icon={<Gavel size={26} color={c.fgMuted} />}
          title="No assignments"
          subtitle="You'll see competitions here once an organiser assigns you."
        />
      )}

      <Modal visible={pwOpen} transparent animationType="fade" onRequestClose={() => setPwOpen(false)}>
        <Pressable onPress={() => setPwOpen(false)} style={{ flex: 1, backgroundColor: c.scrim, justifyContent: "flex-end" }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: c.bgElevated, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 40, gap: 16, borderWidth: 1, borderColor: c.border }}>
            <View style={{ alignSelf: "center", width: 42, height: 5, borderRadius: 999, backgroundColor: c.border }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: c.accent + "1f", alignItems: "center", justifyContent: "center" }}>
                <KeyRound size={20} color={c.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt size={17} font="sansBold">Change password</Txt>
                <Txt size={12.5} tone="muted" style={{ marginTop: 1 }}>Verify your current password, then set a new one.</Txt>
              </View>
            </View>
            <Field label="Current password" required>
              <Input value={curPw} onChangeText={setCurPw} secureTextEntry autoCapitalize="none" placeholder="••••••••" />
            </Field>
            <Field label="New password" required hint="At least 8 characters">
              <Input value={newPw} onChangeText={setNewPw} secureTextEntry autoCapitalize="none" placeholder="••••••••" />
            </Field>
            <Field label="Confirm new password" required>
              <Input value={confPw} onChangeText={setConfPw} secureTextEntry autoCapitalize="none" placeholder="••••••••" />
            </Field>
            <Button label="Update password" full size="lg" loading={pwBusy} onPress={changePw} icon={<Check size={16} color={c.onAccent} />} />
          </Pressable>
        </Pressable>
      </Modal>
    </SubScreen>
  );
}
