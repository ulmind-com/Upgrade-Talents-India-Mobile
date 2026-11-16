import React, { useEffect, useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Gavel, ChevronRight, Lock, Check, SkipForward, ArrowLeft, LogOut } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { judgeAuthApi, judgeCompetitionsApi, tokenStore, safe, toRows, ApiError, type JudgeCompetition, type JudgeContestant } from "@/lib/api";
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
  const [active, setActive] = useState<JudgeContestant | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comments, setComments] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [livePerformer, setLivePerformer] = useState<any | null>(null);
  const [liveMode, setLiveMode] = useState(false);
  const alert = useAlert();

  const flash = (tone: "success" | "error", text: string) => alert(tone, (tone === "success" ? "Done" : "Something went wrong"), text);

  const loadComps = async () => {
    setLoading(true);
    const rows = toRows(await safe(judgeCompetitionsApi.listAssigned(), [] as any));
    setComps(rows); setLoading(false);
  };
  useEffect(() => { if (authed) loadComps(); }, [authed]);

  const openComp = async (cp: JudgeCompetition) => {
    setComp(cp); setBusy(true);
    setSubs(toRows(await safe(judgeCompetitionsApi.listContestants(cp._id), [] as any)));
    setBusy(false);
  };

  const openSub = async (s: JudgeContestant) => {
    setActive(s); setLiveMode(false); setScores({}); setComments("");
    const d = await safe(judgeCompetitionsApi.getDraft(comp!._id, s._id), null as any);
    if (d?.scores) setScores(Object.fromEntries(Object.entries(d.scores).map(([k, v]) => [k, String(v)])));
    if (d?.comments) setComments(d.comments);
  };

  /* Poll the live stage while a competition is open, so a judge sees the
     current performer the moment the organiser calls them up. */
  useEffect(() => {
    if (!comp || active) return;
    let alive = true;
    const pull = async () => {
      const d = await safe(judgeCompetitionsApi.currentPerformer(comp._id), null as any);
      if (alive) setLivePerformer(d?.has_active_performer ? (d.current_performer || d) : d?.current_performer || null);
    };
    pull();
    const id = setInterval(pull, 12000);
    return () => { alive = false; clearInterval(id); };
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
    setLiveMode(true); setScores({}); setComments("");
  };

  const numScores = () => Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Number(v) || 0]));

  const submit = async () => {
    if (!active) return;
    setBusy(true);
    try {
      if (liveMode && comp) {
        await judgeCompetitionsApi.scoreLiveStage(comp._id, { submission_id: active._id, scores: numScores(), comments: comments || undefined });
      } else {
        await judgeCompetitionsApi.submitScore(active._id, numScores(), comments || undefined);
      }
      flash("success", liveMode ? "Live score recorded." : "Score submitted.");
      setActive(null); setLiveMode(false);
    }
    catch (e) { flash("error", e instanceof ApiError ? e.message : "Could not submit."); }
    finally { setBusy(false); }
  };

  const saveDraft = async () => {
    if (!active || !comp) return;
    setBusy(true);
    try { await judgeCompetitionsApi.saveDraft(comp._id, active._id, numScores(), comments || undefined); flash("success", "Draft saved."); }
    catch (e) { flash("error", e instanceof ApiError ? e.message : "Could not save."); }
    finally { setBusy(false); }
  };

  const skip = async () => {
    if (!active || !comp) return;
    setBusy(true);
    try { await judgeCompetitionsApi.skipContestant(comp._id, active._id, "Conflict of interest"); flash("success", "Marked as conflict."); setActive(null); }
    catch (e) { flash("error", e instanceof ApiError ? e.message : "Could not skip."); }
    finally { setBusy(false); }
  };

  const unlock = async () => {
    if (!comp || !pin.trim()) return;
    setBusy(true);
    try { await judgeCompetitionsApi.verifyPin(comp._id, pin.trim()); flash("success", "Session unlocked."); setPin(""); }
    catch (e) { flash("error", e instanceof ApiError ? e.message : "Wrong PIN."); }
    finally { setBusy(false); }
  };

  const logout = async () => { await tokenStore.setStaff(null); setAuthed(false); setComp(null); setActive(null); };

  if (!authed) {
    return (
      <SubScreen eyebrow="Panel" title="Judge">
        <StaffLogin api={judgeAuthApi} role="Judge" tint={TINT} blurb="Sign in with the email registered by the organiser to score live." onDone={() => setAuthed(true)} />
      </SubScreen>
    );
  }

  /* ── Scoring sheet ── */
  if (active && comp) {
    const criteria = comp.judging_criteria?.length ? comp.judging_criteria : [{ name: "Overall", max_score: 10 }];
    return (
      <SubScreen eyebrow={liveMode ? `${comp.title} · Live` : comp.title} title={liveMode ? "Score live" : "Score"} onBack={() => { setActive(null); setLiveMode(false); }}>
        <Card style={{ marginBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 46, height: 46, borderRadius: 999, overflow: "hidden", backgroundColor: c.surface2 }}>
            <AppImage uri={active.media_url} seed={active._id} style={{ width: "100%", height: "100%" }} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={16} font="sansExt" numberOfLines={1}>{active.user_name || active.user_email}</Txt>
            {active.title ? <Txt size={12.5} tone="muted" numberOfLines={1}>{active.title}</Txt> : null}
          </View>
        </Card>

        <View style={{ gap: 14 }}>
          {criteria.map((cr) => (
            <Field key={cr.name} label={`${cr.name} (max ${cr.max_score})`} hint={cr.description}>
              <Input value={scores[cr.name] || ""} onChangeText={(v) => setScores((s) => ({ ...s, [cr.name]: v.replace(/[^0-9.]/g, "") }))} keyboardType="numeric" placeholder={`0 – ${cr.max_score}`} />
            </Field>
          ))}
          <Field label="Comments" hint="Optional feedback for the participant.">
            <Input value={comments} onChangeText={setComments} multiline style={{ minHeight: 90, textAlignVertical: "top", paddingTop: 12 }} />
          </Field>
        </View>

        <View style={{ gap: 10, marginTop: 18 }}>
          <Button label={liveMode ? "Record live score" : "Submit score"} full size="lg" loading={busy} onPress={submit} icon={<Check size={17} color={c.onAccent} />} />
          {!liveMode ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Button label="Save draft" variant="outline" full onPress={saveDraft} /></View>
              <View style={{ flex: 1 }}><Button label="Conflict" variant="ghost" full onPress={skip} icon={<SkipForward size={15} color={c.danger} />} /></View>
            </View>
          ) : null}
        </View>
      </SubScreen>
    );
  }

  /* ── Contestants ── */
  if (comp) {
    return (
      <SubScreen eyebrow="Judging" title={comp.title} onBack={() => setComp(null)}>

        {/* Live stage — the current performer, ready to score */}
        {livePerformer ? (
          <Pressable onPress={openLive} style={({ pressed }) => ({ marginBottom: 14, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, borderWidth: 1.5, borderColor: "#f0407e", backgroundColor: "#f0407e18", padding: 13 }}>
              <View style={{ width: 44, height: 44, borderRadius: 999, overflow: "hidden", backgroundColor: c.surface2, borderWidth: 2, borderColor: "#f0407e" }}>
                <AppImage uri={livePerformer.avatar || livePerformer.user_photo} seed={livePerformer.user_email || "live"} style={{ width: "100%", height: "100%" }} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: "#f0407e" }} />
                  <Txt size={10} font="sansBold" tracking={1.5} style={{ color: "#f0407e" }}>NOW ON STAGE</Txt>
                </View>
                <Txt size={15} font="sansBold" numberOfLines={1} style={{ marginTop: 2 }}>{livePerformer.participant_name || livePerformer.user_name || livePerformer.user_email}</Txt>
              </View>
              <Button label="Score" size="sm" onPress={openLive} />
            </View>
          </Pressable>
        ) : null}

        <Card style={{ marginBottom: 16, gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <Lock size={16} color={c.accent} />
            <Txt size={14.5} font="sansBold" style={{ flex: 1 }}>Live session PIN</Txt>
            {comp.judging_status ? <Badge label={titleCase(comp.judging_status)} tone="brand" /> : null}
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Input value={pin} onChangeText={setPin} keyboardType="number-pad" placeholder="Enter PIN to unlock" /></View>
            <Button label="Unlock" onPress={unlock} loading={busy} />
          </View>
        </Card>

        {busy && !subs.length ? (
          <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={72} radius={18} />)}</View>
        ) : subs.length ? (
          <View style={{ gap: 12 }}>
            {subs.map((s, i) => (
              <FadeInUp key={s._id} delay={Math.min(i, 8) * 50}>
                <Pressable onPress={() => openSub(s)}>
                  <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 14, overflow: "hidden", backgroundColor: c.surface2 }}>
                      <AppImage uri={s.media_url} seed={s._id} style={{ width: "100%", height: "100%" }} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt size={15} font="sansBold" numberOfLines={1}>{s.user_name || s.user_email}</Txt>
                      <Txt size={12} tone="subtle" numberOfLines={1}>{s.title || titleCase(s.status)}</Txt>
                    </View>
                    <ChevronRight size={18} color={c.fgSubtle} />
                  </Card>
                </Pressable>
              </FadeInUp>
            ))}
          </View>
        ) : (
          <EmptyState icon={<Gavel size={26} color={c.fgMuted} />} title="No contestants yet" subtitle="Submissions appear here once participants enter." />
        )}
      </SubScreen>
    );
  }

  /* ── Assigned competitions ── */
  return (
    <SubScreen
      eyebrow="Panel" title="Judge" refreshing={loading} onRefresh={loadComps}
      right={<Pressable onPress={logout} style={{ width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}><LogOut size={18} color={c.fgMuted} /></Pressable>}
    >
      <View style={{ borderRadius: 24, overflow: "hidden", marginBottom: 18 }}>
        <LinearGradient colors={TINT as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.26)", alignItems: "center", justifyContent: "center" }}>
            <Gavel size={21} color="#fff" />
          </View>
          <Txt size={24} font="display" tracking={-0.5} style={{ color: "#fff", marginTop: 12 }}>Your panel</Txt>
          <Txt size={13} style={{ color: "rgba(255,255,255,0.9)", marginTop: 6 }}>Competitions assigned to you.</Txt>
        </LinearGradient>
      </View>

      {loading ? (
        <View style={{ gap: 12 }}>{[0, 1].map((i) => <Skeleton key={i} h={84} radius={20} />)}</View>
      ) : comps.length ? (
        <View style={{ gap: 12 }}>
          {comps.map((cp, i) => (
            <FadeInUp key={cp._id} delay={i * 60}>
              <Pressable onPress={() => openComp(cp)}>
                <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: "#b36bff22", alignItems: "center", justifyContent: "center" }}>
                    <Gavel size={20} color="#7c3aed" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt size={15.5} font="sansExt" numberOfLines={1}>{cp.title}</Txt>
                    <Txt size={12} tone="subtle" numberOfLines={1}>{cp.category}{cp.judging_status ? ` · ${titleCase(cp.judging_status)}` : ""}</Txt>
                  </View>
                  <ChevronRight size={18} color={c.fgSubtle} />
                </Card>
              </Pressable>
            </FadeInUp>
          ))}
        </View>
      ) : (
        <EmptyState icon={<Gavel size={26} color={c.fgMuted} />} title="No assignments" subtitle="You'll see competitions here once an organiser assigns you." />
      )}
    </SubScreen>
  );
}
