import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, Animated } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import {
  Trophy, Upload, Check, Heart, Medal, Crown, CalendarDays, ShieldCheck,
  Gavel, Users as UsersIcon, Sparkles, Lock, CreditCard, Banknote, Share2, FileText, ChevronRight,
} from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { ParallaxDetailScreen } from "@/components/ParallaxHero";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { publicApi, competeApi, safe, toRows, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Card, Button, Divider, Skeleton, Alert, Dot } from "@/components/ui";
import { usePopup } from "@/components/Popup";
import { useCheckout } from "@/lib/useCheckout";
import { AppImage, PosterFill } from "@/components/AppImage";
import { LiveStage } from "@/components/LiveStage";
import { ShareSheet } from "@/components/ShareSheet";
import { VerifiedTick } from "@/components/VerifiedBadge";
import { FadeInUp } from "@/components/FadeInUp";
import { DottedGrid } from "@/components/patterns";
import { genz } from "@/theme/tokens";
import { InfoCard, InfoRow, DateChip } from "@/components/InfoRows";
import { formatEventDate, titleCase, formatINR, splitDate } from "@/lib/format";

type Asset = { uri: string; name: string; type: string };
const REG_KEY = "uti_comp_registrations";
const VOTE_KEY = "uti_comp_votes";
const PODIUM = ["#ffd56b", "#cfd8e3", "#e8a87c"];

export default function CompetitionDetail() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useSession();

  const compQ = useAsync(async () => {
    const rows = toRows(await safe(publicApi.competitions(), []));
    return rows.find((r: any) => (r._id || r.id) === id) || null;
  }, [id]);
  const lbQ = useAsync(() => safe(publicApi.leaderboard(String(id)), { leaderboard: [] } as any), [id]);
  const rsQ = useAsync(() => safe(competeApi.registrationStatus(String(id)), null as any), [id], { refetchOnFocus: true });

  const comp = compQ.data;
  const cats: string[] = Array.isArray((comp as any)?.categories)
    ? (comp as any).categories
        .map((cat: any) => (typeof cat === "string" ? cat : cat?.name || cat?.category_name || cat?.title))
        .filter(Boolean)
    : (comp?.category ? [String(comp.category)] : []);
  const rows: any[] = (lbQ.data as any)?.leaderboard || toRows(lbQ.data);
  const [g1, g2] = genz(String(id).length + (comp?.title?.length || 0));

  const [registered, setRegistered] = useState(false);
  const [regInfo, setRegInfo] = useState<any | null>(null);
  const [rules, setRules] = useState(false);
  const [payMode, setPayMode] = useState<"ONLINE" | "CASH">("ONLINE");
  const [selectedCat, setSelectedCat] = useState<string>("");
  const activeCat = selectedCat || cats[0] || "";
  const [files, setFiles] = useState<Record<string, Asset>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareData, setShareData] = useState<any>(null);
  const popup = usePopup();
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [voted, setVoted] = useState<Set<string>>(new Set());

  /* remember registrations locally — the API has no "my registrations" read */
  useEffect(() => {
    SecureStore.getItemAsync(REG_KEY)
      .then((v) => { if (v && JSON.parse(v).includes(String(id))) setRegistered(true); })
      .catch(() => {});
  }, [id]);
  // restore votes for this competition
  useEffect(() => {
    SecureStore.getItemAsync(VOTE_KEY)
      .then((v) => {
        const all = v ? JSON.parse(v) : {};
        const mine: string[] = all[String(id)] || [];
        if (mine.length) setVoted(new Set(mine));
      })
      .catch(() => {});
  }, [id]);

  const rememberVote = async (pid: string) => {
    try {
      const all = JSON.parse((await SecureStore.getItemAsync(VOTE_KEY)) || "{}");
      const mine: string[] = all[String(id)] || [];
      if (!mine.includes(pid)) { all[String(id)] = [...mine, pid]; await SecureStore.setItemAsync(VOTE_KEY, JSON.stringify(all)); }
    } catch {}
  };

  const remember = async () => {
    setRegistered(true);
    try {
      const cur = JSON.parse((await SecureStore.getItemAsync(REG_KEY)) || "[]");
      if (!cur.includes(String(id))) await SecureStore.setItemAsync(REG_KEY, JSON.stringify([...cur, String(id)]));
    } catch {}
  };

  // Authoritative registration state — the backend now has a real read, so
  // this replaces guessing from the leaderboard or local storage.
  useEffect(() => {
    if (!user?.email) return;
    let alive = true;
    competeApi.myRegistration(String(id))
      .then((reg: any) => {
        if (!alive || !reg?.is_registered) return;
        setRegInfo(reg);
        if (reg.is_confirmed !== false) { setRegistered(true); remember(); }
        if (reg.has_submitted || reg.submission_id) setSubmitted(true);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [id, user?.email]);

  // Fallback: if they already appear on the leaderboard, reflect that too.
  useEffect(() => {
    if (!user?.email || registered) return;
    if (rows.some((r: any) => (r.participant_id || r.email || "").toLowerCase() === String(user.email).toLowerCase())) remember();
  }, [rows.length, user?.email]);

  const fields: { name: string; required?: boolean }[] = comp?.dynamic_submission_fields || [];
  const deadline = comp?.registration_deadline;
  const feeAmt = Number(comp?.participation_fee ?? comp?.entry_fee ?? comp?.fee ?? 0);
  const open = !deadline || new Date(deadline).getTime() > Date.now();
  const step: "register" | "submit" | "done" = !registered ? "register" : fields.length && !submitted ? "submit" : "done";

  const flash = (tone: "success" | "error", text: string, title?: string) =>
    popup.show(tone, title || (tone === "success" ? "Done" : "Heads up"), text);

  const checkout = useCheckout({
    onDone: async () => {
      await remember();
      setBusy(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      flash("success", "Entry fee paid — submit your entry when ready.", "Registered");
    },
  });

  useEffect(() => {
    if (checkout.error) { setBusy(null); flash("error", checkout.error, "Payment problem"); checkout.clear(); }
    else if (checkout.cancelled) { setBusy(null); flash("error", "Payment cancelled. Register again to finish.", "Cancelled"); checkout.clear(); }
  }, [checkout.error, checkout.cancelled]);

  const pick = async (name: string) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) {
      const a = res.assets[0];
      setFiles((s) => ({ ...s, [name]: { uri: a.uri, name: a.fileName || a.uri.split("/").pop() || "entry", type: a.mimeType || (a.type === "video" ? "video/mp4" : "image/jpeg") } }));
    }
  };

  const register = async () => {
    if (!user) { flash("error", "Sign in to register."); return; }
    if (!rules) { flash("error", "Please accept the competition rules first."); return; }
    setBusy("reg");
    try {
      const dob = (user as any)?.date_of_birth || undefined;
      // Category-aware eligibility + registration when the competition has categories.
      const el = activeCat
        ? await competeApi.categoryEligibility(String(id), activeCat, dob)
        : await competeApi.eligibility(String(id));
      if (!el.eligible) { flash("error", el.reason || "You are not eligible for this competition.", "Not eligible"); return; }
      const fee = Number(comp?.participation_fee ?? comp?.entry_fee ?? comp?.fee ?? 0);
      // Cash on Spot only makes sense when there is actually a fee to collect.
      const mode = fee > 0 ? payMode : "ONLINE";
      const res = activeCat
        ? await competeApi.registerInCategory(String(id), activeCat, { rules_accepted: true, payment_method: mode, date_of_birth: dob })
        : await competeApi.register(String(id), true, mode);

      // Cash on Spot (or a server-confirmed entry) skips the gateway entirely.
      if (mode === "CASH" || res?.payment_method === "CASH" || res?.status === "CONFIRMED" || !res?.payment_info) {
        await remember();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (mode === "CASH" || res?.payment_method === "CASH") {
          flash("success", `You're in! Pay ₹${fee} in cash at the venue counter on event day, then submit your entry.`, "Cash on Spot");
        } else {
          flash("success", "You're in — submit your entry when ready.", "Registered");
        }
        return;
      }

      // Paid entries go through Razorpay first; free ones confirm immediately.
      if (res?.payment_info && res?.status !== "CONFIRMED" && res?.order_reference) {
        const opened = checkout.start({
          paymentInfo: res.payment_info,
          amount: Number(res.payable_amount ?? comp?.entry_fee ?? comp?.fee ?? 0),
          description: `Entry — ${comp?.title || comp?.name || "Competition"}`,
          context: { kind: "competition", competitionId: String(id), orderReference: res.order_reference },
        });
        if (!opened.opened) flash("error", opened.reason || "Could not open the payment sheet.");
        return;
      }

      await remember();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      flash("success", "You're in — submit your entry when ready.", "Registered");
    } catch (e) {
      const m = e instanceof ApiError ? e.message : "Could not register.";
      if (/already/i.test(m)) { await remember(); flash("success", "We synced your existing registration.", "Already registered"); }
      else flash("error", m);
    } finally { setBusy(null); }
  };

  const submit = async () => {
    const missing = fields.filter((f) => f.required && !files[f.name]);
    if (missing.length) { flash("error", `Attach: ${missing.map((m) => titleCase(m.name)).join(", ")}`); return; }
    setBusy("sub");
    try {
      const names = fields.map((f) => f.name).filter((n) => files[n]);
      await competeApi.submit(String(id), names.map((n) => files[n]), names);
      setSubmitted(true); setFiles({});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      flash("success", "Entry submitted. Good luck!", "Submitted");
    } catch (e) { flash("error", e instanceof ApiError ? e.message : "Submission failed."); }
    finally { setBusy(null); }
  };

  const vote = async (pid: string) => {
    if (!user) { flash("error", "Sign in to vote."); return; }
    if (voted.has(pid)) return;
    setVoted((s) => new Set(s).add(pid));
    setVotes((v) => ({ ...v, [pid]: (v[pid] || 0) + 1 }));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await competeApi.vote(String(id), pid);
      await rememberVote(pid);
      flash("success", "Your vote is counted.", "Voted");
    } catch (e) {
      const m = e instanceof ApiError ? e.message : "Vote failed.";
      if (/already voted/i.test(m)) {
        // Backend already has the vote — keep it marked, just undo the optimistic +1.
        await rememberVote(pid);
        setVotes((v) => ({ ...v, [pid]: Math.max(0, (v[pid] || 1) - 1) }));
        flash("success", "You already voted for this contestant.", "Already voted");
      } else {
        setVoted((s) => { const n = new Set(s); n.delete(pid); return n; });
        setVotes((v) => ({ ...v, [pid]: Math.max(0, (v[pid] || 1) - 1) }));
        flash("error", m, "Vote failed");
      }
    }
  };

  if (compQ.loading) return <SubScreen eyebrow="Competition" title="Loading…"><Skeleton h={200} radius={22} /></SubScreen>;
  if (!comp) return <SubScreen eyebrow="Competition" title="Not found"><Txt size={14} tone="muted">This competition is no longer available.</Txt></SubScreen>;

  const STEPS = ["Register", fields.length ? "Submit" : null, "Done"].filter(Boolean) as string[];
  const stepIdx = step === "register" ? 0 : step === "submit" ? 1 : STEPS.length - 1;

  return (
    <ParallaxDetailScreen
      image={comp.image_url || comp.banner_url}
      seed={comp._id}
      title={comp.title || comp.name}
      refreshing={lbQ.refreshing}
      onRefresh={() => { lbQ.refresh(); compQ.reload(); }}
      onBack={() => (router.canGoBack() ? router.back() : router.replace("/(more)/competitions"))}
      heroOverlay={
        <>
          {comp.category ? (
            <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", borderRadius: 999, paddingHorizontal: 11, height: 26, marginBottom: 10 }}>
              <Trophy size={12} color={g1} />
              <Txt size={10.5} font="sansBold" tracking={1} uppercase style={{ color: "#fff" }}>
                {titleCase(comp.category)}
              </Txt>
            </View>
          ) : null}
          <Txt size={27} font="display" lh={30} tracking={-0.8} numberOfLines={3} style={{ color: "#fff" }}>
            {comp.title || comp.name}
          </Txt>
        </>
      }
      right={
        <Pressable
          onPress={() => {
            setShareOpen(true);
            // universal share resolver first; the per-competition endpoint is the fallback
            publicApi
              .shareCompetition(String(id))
              .catch(() => competeApi.share(String(id)))
              .then(setShareData)
              .catch(() => {});
          }}
          hitSlop={8}
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Share2 size={17} color={c.fg} />
        </Pressable>
      }
      overlay={
        <>
          {popup.node}
          {checkout.sheet}
          <ShareSheet
            visible={shareOpen}
            message={shareData?.share_text || `Check out ${comp.title || comp.name || "this competition"} on Upgrade Talents India! Compete, win cash prizes & perform live on stage.`}
            url={shareData?.share_url || shareData?.page_url || shareData?.registration_url || `https://upgradetalentsindia.in/competitions/${id}`}
            onClose={() => setShareOpen(false)}
            links={shareData?.social_share_links}
            card={{
              image: shareData?.image_url || comp.image_url || comp.banner_url,
              title: shareData?.title || comp.title || comp.name || "Competition",
              meta: shareData?.category || comp.category || (comp.prize ? `Prize pool ${comp.prize}` : null),
            }}
          />
        </>
      }
    >

      {/* ── Clean info rows ── */}
      <FadeInUp>
        <InfoCard style={{ marginBottom: 18 }}>
          {comp.prize ? <InfoRow icon={<Trophy size={19} color={g1} />} label="Prize pool" value={String(comp.prize)} /> : null}
          <InfoRow
            dateChip={deadline ? <DateChip day={splitDate(deadline).day} month={splitDate(deadline).month} /> : undefined}
            icon={!deadline ? <CalendarDays size={19} color={c.accent} /> : undefined}
            label={deadline ? "Entries close" : undefined}
            value={deadline ? formatEventDate(deadline) : "Open entry"}
            sub={deadline ? "Register before this date" : undefined}
          />
          <InfoRow
            icon={<Sparkles size={19} color={feeAmt > 0 ? c.accent : c.success} />}
            label="Entry fee"
            value={feeAmt > 0 ? formatINR(feeAmt) : "FREE"}
            valueColor={feeAmt > 0 ? undefined : c.success}
          />
          {comp.min_age || comp.max_age ? (
            <InfoRow icon={<ShieldCheck size={19} color={c.accent} />} label="Eligibility" value={`Age ${comp.min_age ?? 0}${comp.max_age ? `–${comp.max_age}` : "+"}`} />
          ) : null}
          {comp.result_status ? <InfoRow icon={<Medal size={19} color={c.accent} />} label="Result" value={titleCase(comp.result_status)} /> : null}
        </InfoCard>
      </FadeInUp>

      {/* ── Stepper ── */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 18 }}>
        {STEPS.map((s, i) => (
          <View key={s} style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <View style={{ width: 26, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: i <= stepIdx ? g1 : c.surface2 }}>
                {i < stepIdx ? <Check size={14} color="#fff" /> : <Txt size={12} font="sansBold" style={{ color: i <= stepIdx ? "#fff" : c.fgSubtle }}>{i + 1}</Txt>}
              </View>
              <Txt size={12.5} font={i === stepIdx ? "sansBold" : "sansMed"} tone={i <= stepIdx ? "fg" : "subtle"}>{s}</Txt>
            </View>
            {i < STEPS.length - 1 ? <View style={{ flex: 1, height: 2, marginHorizontal: 8, borderRadius: 2, backgroundColor: i < stepIdx ? g1 : c.border }} /> : null}
          </View>
        ))}
      </View>

      {/* ── Live registration status ── */}
      {(() => {
        const rs: any = rsQ.data;
        if (!rs) return null;
        const regOpen = rs.registration_allowed ?? rs.is_open ?? rs.can_register ?? rs.is_registration_open ?? rs.open;
        const cap = rs.capacity ?? rs.max_participants ?? comp.max_participants;
        const cnt = rs.registered_count ?? rs.total_registrations ?? rs.registrations_count;
        const spots = typeof rs.spots_left === "number" ? rs.spots_left
          : typeof rs.available_slots === "number" ? rs.available_slots
          : (typeof cap === "number" && typeof cnt === "number") ? Math.max(0, cap - cnt) : null;
        const closeAt = rs.registration_close_date || rs.closes_at || rs.registration_deadline || deadline;
        const closed = regOpen === false;
        const tone = closed ? c.danger : spots !== null && spots <= 5 ? c.warning : c.success;
        return (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, borderColor: tone + "55", backgroundColor: tone + "12", padding: 13, marginBottom: 16 }}>
            <Dot color={tone} pulse={!closed} />
            <Txt size={13} font="sansBold" style={{ flex: 1, color: tone }}>
              {closed ? "Registration closed" : "Registration open"}
              {!closed && typeof spots === "number" ? <Txt size={13} font="sansSemi" tone="muted">{`  ·  ${spots} spot${spots === 1 ? "" : "s"} left`}</Txt> : null}
            </Txt>
            {!closed && closeAt ? <Txt size={11.5} tone="subtle">Closes {formatEventDate(closeAt)}</Txt> : null}
          </View>
        );
      })()}

      {/* ── Entry flow — brought up so register + payment are the first thing you reach ── */}
      <FadeInUp delay={100}>
        <Card style={{ gap: 14, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Trophy size={16} color={g1} />
            <Txt size={15} font="sansBold" style={{ flex: 1 }}>Your entry</Txt>
            {registered ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: c.success + "1f", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Check size={12} color={c.success} />
                <Txt size={11} font="sansBold" tone="success">REGISTERED</Txt>
              </View>
            ) : null}
          </View>

          {/* Authoritative registration detail — reference, how they paid, status */}
          {registered && regInfo ? (
            <View style={{ borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, padding: 12, gap: 8 }}>
              {regInfo.registration_reference ? (
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <Txt size={11.5} tone="subtle">Reference</Txt>
                  <Txt size={12.5} font="mono" numberOfLines={1} style={{ flexShrink: 1 }}>{regInfo.registration_reference}</Txt>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <Txt size={11.5} tone="subtle">Payment</Txt>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  {regInfo.payment_method === "CASH" || regInfo.cash_payment ? <Banknote size={12} color={c.warning} /> : <CreditCard size={12} color={c.success} />}
                  <Txt size={12.5} font="sansSemi" style={{ color: regInfo.payment_method === "CASH" || regInfo.cash_payment ? c.warning : c.success }}>
                    {regInfo.payment_method === "CASH" || regInfo.cash_payment ? `Cash on Spot${regInfo.cash_status ? ` · ${titleCase(regInfo.cash_status)}` : ""}` : "Paid online"}
                  </Txt>
                </View>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <Txt size={11.5} tone="subtle">Entry</Txt>
                <Txt size={12.5} font="sansSemi" style={{ color: submitted || regInfo.has_submitted ? c.success : c.fgMuted }}>
                  {submitted || regInfo.has_submitted ? "Submitted" : "Not submitted yet"}
                </Txt>
              </View>
              {(regInfo.payment_method === "CASH" || regInfo.cash_payment) ? (
                <View style={{ flexDirection: "row", gap: 7, alignItems: "flex-start", marginTop: 2 }}>
                  <Banknote size={13} color={c.warning} style={{ marginTop: 1 }} />
                  <Txt size={11.5} tone="muted" lh={16} style={{ flex: 1 }}>Deposit your entry fee in cash at the venue counter on event day.</Txt>
                </View>
              ) : null}
            </View>
          ) : null}

          {!user ? (
            <Alert tone="info">Sign in to register and submit your entry.</Alert>
          ) : !open && !registered ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Lock size={15} color={c.danger} />
              <Txt size={13.5} tone="danger" font="sansSemi">Registration has closed for this competition.</Txt>
            </View>
          ) : step === "register" ? (
            <>
              {cats.length > 1 ? (
                <View style={{ gap: 9 }}>
                  <Txt size={11} font="monoMed" tone="subtle" tracking={2} uppercase>Choose your category</Txt>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {cats.map((cat) => {
                      const on = activeCat === cat;
                      return (
                        <Pressable key={cat} onPress={() => setSelectedCat(cat)} style={{ paddingHorizontal: 15, height: 40, justifyContent: "center", borderRadius: 999, borderWidth: on ? 0 : 1, borderColor: c.border, backgroundColor: on ? g1 : c.surface2 }}>
                          <Txt size={13} font="sansBold" style={{ color: on ? "#fff" : c.fgMuted }}>{titleCase(cat)}</Txt>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              <Pressable onPress={() => setRules((r) => !r)} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: rules ? g1 : c.borderStrong, backgroundColor: rules ? g1 : "transparent", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                  {rules ? <Check size={13} color="#fff" /> : null}
                </View>
                <Txt size={13.5} tone="muted" lh={19} style={{ flex: 1 }}>I have read and accept the competition rules and eligibility criteria.</Txt>
              </Pressable>

              {/* Payment mode — only when there's a fee to pay */}
              {Number(comp.participation_fee ?? comp.entry_fee ?? comp.fee ?? 0) > 0 ? (
                <View style={{ gap: 10 }}>
                  <Txt size={11} font="monoMed" tone="subtle" tracking={2} uppercase>How you'll pay</Txt>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <PayModeCard
                      active={payMode === "ONLINE"} onPress={() => setPayMode("ONLINE")} tint={g1}
                      icon={<CreditCard size={17} color={payMode === "ONLINE" ? g1 : c.fgMuted} />}
                      title="Pay online" sub="Razorpay · instant"
                    />
                    <PayModeCard
                      active={payMode === "CASH"} onPress={() => setPayMode("CASH")} tint={g1}
                      icon={<Banknote size={17} color={payMode === "CASH" ? g1 : c.fgMuted} />}
                      title="Cash on Spot" sub={`₹${Number(comp.participation_fee ?? comp.entry_fee ?? comp.fee ?? 0)} at venue`}
                    />
                  </View>
                  {payMode === "CASH" ? (
                    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start", borderRadius: 12, backgroundColor: c.warning + "14", borderWidth: 1, borderColor: c.warning + "44", padding: 11 }}>
                      <Banknote size={14} color={c.warning} style={{ marginTop: 1 }} />
                      <Txt size={12} tone="muted" lh={16} style={{ flex: 1 }}>Your seat is held now. Carry the exact entry fee in cash and pay at the venue counter on event day.</Txt>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <Button
                label={payMode === "CASH" && Number(comp.participation_fee ?? comp.entry_fee ?? comp.fee ?? 0) > 0 ? "Reserve my spot" : "Register to compete"}
                full size="lg" loading={busy === "reg"} disabled={!rules} onPress={register} icon={<Trophy size={16} color={c.onAccent} />}
              />
            </>
          ) : step === "submit" ? (
            <>
              <Txt size={13.5} tone="muted">Upload your entry to complete your participation.</Txt>
              {fields.map((f) => (
                <Pressable key={f.name} onPress={() => pick(f.name)} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: files[f.name] ? g1 : c.borderStrong, paddingHorizontal: 14 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: g1 + "22" }}>
                    {files[f.name] ? <Check size={17} color={c.success} /> : <Upload size={17} color={g1} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt size={13.5} font="sansSemi">{titleCase(f.name)}{f.required ? " *" : ""}</Txt>
                    <Txt size={11.5} tone={files[f.name] ? "accent" : "subtle"} numberOfLines={1}>{files[f.name]?.name || "Tap to attach photo / video"}</Txt>
                  </View>
                </Pressable>
              ))}
              <Button label="Submit entry" full size="lg" loading={busy === "sub"} onPress={submit} icon={<Check size={16} color={c.onAccent} />} />
            </>
          ) : (
            <View style={{ alignItems: "center", gap: 8, paddingVertical: 8 }}>
              <View style={{ width: 54, height: 54, borderRadius: 999, borderWidth: 3, borderColor: c.success, alignItems: "center", justifyContent: "center" }}>
                <Check size={26} color={c.success} />
              </View>
              <Txt size={16} font="sansExt" align="center">You're all set</Txt>
              <Txt size={13} tone="muted" align="center">Open the leaderboard to track your rank.</Txt>
            </View>
          )}
        </Card>
      </FadeInUp>

      {/* ── About / details ── */}
      {comp.description ? (
        <FadeInUp delay={120}>
          <Card style={{ gap: 12, marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 32, height: 32, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: g1 + "22" }}>
                <FileText size={16} color={g1} />
              </View>
              <Txt size={16} font="sansBold" style={{ flex: 1 }}>About this competition</Txt>
            </View>
            <View style={{ height: 1, backgroundColor: c.border }} />
            <Txt size={15} lh={23} style={{ color: c.fg, opacity: 0.92 }}>{comp.description}</Txt>
            {comp.rules ? (
              <>
                <View style={{ height: 1, backgroundColor: c.border, marginTop: 2 }} />
                <Txt size={11} font="monoMed" tone="subtle" tracking={2} uppercase>Rules</Txt>
                <Txt size={13.5} tone="muted" lh={20}>{comp.rules}</Txt>
              </>
            ) : null}
          </Card>
        </FadeInUp>
      ) : null}

      {/* ── Judging criteria ── */}
      {comp.judging_criteria?.length ? (
        <FadeInUp delay={140}>
          <Card style={{ gap: 12, marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Gavel size={16} color={g1} />
              <Txt size={15} font="sansBold" style={{ flex: 1 }}>How you're scored</Txt>
              {comp.audience_voting_enabled ? <Txt size={11} font="sansBold" style={{ color: g1 }}>+ AUDIENCE</Txt> : null}
            </View>
            {comp.judging_criteria.map((cr: any) => (
              <View key={cr.name} style={{ gap: 5 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Txt size={13.5} font="sansSemi">{cr.name}</Txt>
                  <Txt size={12.5} font="sansBold" style={{ color: g1 }}>{cr.max_score} pts</Txt>
                </View>
                <View style={{ height: 5, borderRadius: 999, backgroundColor: c.surface2, overflow: "hidden" }}>
                  <View style={{ width: `${Math.min(100, cr.max_score)}%`, height: "100%", backgroundColor: g1, borderRadius: 999 }} />
                </View>
              </View>
            ))}
          </Card>
        </FadeInUp>
      ) : null}

      {/* ── Live on-stage, while the competition is running ── */}
      <LiveStage compId={String(id)} live={comp.event_status === "live" || String(comp.result_status || "").toUpperCase() === "LIVE"} />

      {/* ── Official results, once declared ── */}
      {comp.results_published === true || String(comp.result_status || "").toUpperCase() === "FINAL" ? (
        <Pressable
          onPress={() => router.push(`/(more)/competitions/${id}/results`)}
          style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }], marginBottom: 16, borderRadius: 18, overflow: "hidden" })}
        >
          <LinearGradient colors={[g1, g2] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 15 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" }}>
              <Trophy size={20} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={15} font="sansBold" style={{ color: "#fff" }}>Official results are out</Txt>
              <Txt size={12} style={{ color: "rgba(255,255,255,0.85)", marginTop: 1 }}>See the podium and final standings</Txt>
            </View>
            <Crown size={18} color="#ffd166" />
          </LinearGradient>
        </Pressable>
      ) : null}

      {/* ── Leaderboard ──
         The full table lives on its own screen, which already does the
         podium, search, "your standing" and voting far better than a
         20-row stub squeezed under the registration flow. This is the
         door to it: enough signal (who is in, how many) to be worth a
         tap, and nothing that duplicates what is on the other side. */}
      <Pressable
        onPress={() => {
          try { Haptics.selectionAsync(); } catch {}
          router.push(`/(more)/leaderboard?competition=${id}`);
        }}
        style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.surface,
            padding: 16,
          }}
        >
          <View style={{ width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: g1 + "22" }}>
            <Medal size={22} color={g1} />
          </View>

          <View style={{ flex: 1 }}>
            <Txt size={16} font="sansBold">Leaderboard</Txt>
            <Txt size={12.5} tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>
              {lbQ.loading
                ? "Loading rankings…"
                : rows.length
                  ? `${rows.length} competing · live rankings${comp.audience_voting_enabled !== false ? " & voting" : ""}`
                  : "Rankings appear once judging starts"}
            </Txt>
          </View>

          {/* the faces currently on top, as a reason to look */}
          {rows.length ? (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {rows.slice(0, 3).map((r: any, i: number) => (
                <View
                  key={r.participant_id || r.email || i}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    overflow: "hidden",
                    borderWidth: 2,
                    borderColor: c.surface,
                    backgroundColor: c.surface2,
                    marginLeft: i === 0 ? 0 : -9,
                  }}
                >
                  <AppImage uri={r.profile_photo} seed={r.participant_id || i} style={{ width: "100%", height: "100%" }} />
                </View>
              ))}
            </View>
          ) : null}

          <ChevronRight size={20} color={c.fgSubtle} />
        </View>
      </Pressable>

    </ParallaxDetailScreen>
  );
}

function PayModeCard({ active, onPress, tint, icon, title, sub }: { active: boolean; onPress: () => void; tint: string; icon: React.ReactNode; title: string; sub: string }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flex: 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <View style={{ borderRadius: 16, borderWidth: 1.5, borderColor: active ? tint : c.border, backgroundColor: active ? tint + "14" : c.surface, padding: 13, gap: 7 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {icon}
          <View style={{ width: 18, height: 18, borderRadius: 999, borderWidth: 2, borderColor: active ? tint : c.borderStrong, alignItems: "center", justifyContent: "center" }}>
            {active ? <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: tint }} /> : null}
          </View>
        </View>
        <View>
          <Txt size={13.5} font="sansBold" style={{ color: active ? c.fg : c.fgMuted }}>{title}</Txt>
          <Txt size={11} tone="subtle" style={{ marginTop: 1 }}>{sub}</Txt>
        </View>
      </View>
    </Pressable>
  );
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
      {icon}
      <Txt size={12} font="sansSemi" tone="muted">{label}</Txt>
    </View>
  );
}

function VoteButton({ active, count, tint, onPress }: { active: boolean; count: number; tint: string; onPress: () => void }) {
  const { c } = useTheme();
  const a = useRef(new Animated.Value(1)).current;
  const press = () => {
    Animated.sequence([
      Animated.spring(a, { toValue: 1.35, useNativeDriver: true, speed: 50, bounciness: 14 }),
      Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
    onPress();
  };
  return (
    <Pressable onPress={press} disabled={active}>
      <Animated.View style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 11, height: 34, backgroundColor: active ? tint : c.surface2, transform: [{ scale: a }] }}>
        <Heart size={14} color={active ? "#fff" : tint} fill={active ? "#fff" : "transparent"} />
        <Txt size={12.5} font="sansBold" style={{ color: active ? "#fff" : c.fg }}>{count}</Txt>
      </Animated.View>
    </Pressable>
  );
}
