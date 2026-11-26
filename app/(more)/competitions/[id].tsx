import React, { useEffect, useRef, useState } from "react";
import { FormattedDescription, PrizeCard, findPrizeLine } from "@/components/FormattedDescription";
import * as DocumentPicker from "expo-document-picker";
import { compImage, COMP_POSTER_RATIO, parseAgeRange, ageFromDob, ageFit } from "@/lib/competition";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Shine } from "@/components/Shine";
import { EntryFlow, type EntryCategory } from "@/components/competition/EntryFlow";
import { RegistrationSuccess, type RegistrationResult } from "@/components/RegistrationSuccess";
import { View, Pressable, Animated, Modal } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as SecureStore from "expo-secure-store";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import {
  Trophy, Upload, Check, Heart, Medal, Crown, CalendarDays, ShieldCheck,
  Gavel, Users as UsersIcon, Sparkles, Lock, CreditCard, Banknote, Share2, FileText, ChevronRight,
  ArrowRight,
  ArrowLeft,
  Image as ImageIcon,
  FolderOpen,
  Users,
  Ticket,
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
import { RoundsJourney } from "@/components/RoundsJourney";
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
  /** Registered, but the entry fee isn't paid yet (online order left open). */
  const [pendingReg, setPendingReg] = useState<any | null>(null);
  const [rules, setRules] = useState(false);
  const [payMode, setPayMode] = useState<"ONLINE" | "CASH">("ONLINE");
  const [selectedCat, setSelectedCat] = useState<string>("");
  const activeCat = selectedCat || cats[0] || "";
  const [files, setFiles] = useState<Record<string, Asset>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  /** Set when a registration lands — opens the full-screen "you're in" moment. */
  const [won, setWon] = useState<RegistrationResult | null>(null);
  /** The step-by-step entry flow (category → rules → payment → review). */
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareData, setShareData] = useState<any>(null);
  const popup = usePopup();
  const [votes, setVotes] = useState<Record<string, number>>({});
  // optimistic +1s only bridge the gap until fresh standings arrive (app votes are weighted server-side)
  useEffect(() => setVotes({}), [lbQ.data]);
  const [voted, setVoted] = useState<Set<string>>(new Set());

  /* Registration used to be remembered on the phone, keyed only by the
     competition — so one account's entry showed as "Registered" for every
     account on the device, and never cleared. The server is the only truth
     now; drop that old shared list. */
  useEffect(() => {
    SecureStore.deleteItemAsync(REG_KEY).catch(() => {});
    SecureStore.deleteItemAsync(VOTE_KEY).catch(() => {});
  }, []);
  // votes are remembered per account (a SecureStore key can't hold "@")
  const voteKey = user?.email ? `${VOTE_KEY}.${String(user.email).toLowerCase().replace(/[^a-z0-9._-]/g, "_")}` : null;
  useEffect(() => {
    setVoted(new Set());
    if (!voteKey) return;
    SecureStore.getItemAsync(voteKey)
      .then((v) => {
        const all = v ? JSON.parse(v) : {};
        const mine: string[] = all[String(id)] || [];
        if (mine.length) setVoted(new Set(mine));
      })
      .catch(() => {});
  }, [id, voteKey]);

  const rememberVote = async (pid: string) => {
    if (!voteKey) return;
    try {
      const all = JSON.parse((await SecureStore.getItemAsync(voteKey)) || "{}");
      const mine: string[] = all[String(id)] || [];
      if (!mine.includes(pid)) { all[String(id)] = [...mine, pid]; await SecureStore.setItemAsync(voteKey, JSON.stringify(all)); }
    } catch {}
  };

  /** Ask the server whether *this* account is entered — the only source of truth. */
  const [regTick, setRegTick] = useState(0);
  const remember = async () => {
    setRegistered(true); // the server just confirmed it; the re-read fills in the details
    setRegTick((t) => t + 1);
  };

  useEffect(() => {
    let alive = true;
    // a different account (or none) starts from "not registered"
    if (!user?.email) {
      setRegistered(false);
      setRegInfo(null);
      setPendingReg(null);
      setSubmitted(false);
      return;
    }
    competeApi
      .myRegistration(String(id))
      .then((reg: any) => {
        if (!alive) return;
        const dead = /CANCEL|EXPIRE|REJECT/i.test(String(reg?.status || ""));
        // confirmed = paid, free, or cash-on-spot
        const ok = !!reg?.is_registered && reg.is_confirmed !== false && !dead;
        setRegistered(ok);
        setRegInfo(ok ? reg : null);
        setSubmitted(ok && !!(reg.has_submitted || reg.submission_id));
        // registered but the online fee is still unpaid — offer to finish it
        setPendingReg(!ok && reg?.is_registered && !dead ? reg : null);
      })
      .catch(() => {
        // couldn't ask the server: if they're on the standings, they're in
        if (!alive) return;
        const em = String(user.email).toLowerCase();
        if (rows.some((r: any) => String(r.email || r.participant_id || "").toLowerCase() === em)) setRegistered(true);
      });
    return () => {
      alive = false;
    };
  }, [id, user?.email, regTick]);

  const feeAmt = Number(comp?.participation_fee ?? comp?.entry_fee ?? comp?.fee ?? 0);
  const fields: { name: string; required?: boolean }[] = comp?.dynamic_submission_fields || [];
  // the member's age from their profile DOB — drives "Eligible / Age N / Open age"
  const userAge = ageFromDob((user as any)?.date_of_birth || (user as any)?.dob);
  const entryCats: EntryCategory[] = (Array.isArray((comp as any)?.categories) ? (comp as any).categories : [])
    .map((cat: any) => {
      if (typeof cat === "string") {
        const range = parseAgeRange(cat);
        return { name: cat, fee: Number(comp?.participation_fee ?? comp?.entry_fee ?? comp?.fee ?? 0), ageLabel: range.label, fit: ageFit(range, userAge) };
      }
      const name = cat?.name || cat?.category_name || cat?.title;
      if (!name) return null;
      const f = cat.fee ?? cat.entry_fee ?? cat.participation_fee ?? cat.price ?? comp?.participation_fee ?? comp?.entry_fee ?? comp?.fee ?? 0;
      const range = parseAgeRange(cat);
      return { name: String(name), fee: Number(f) || 0, ageLabel: range.label, description: cat.description || null, fit: ageFit(range, userAge) };
    })
    .filter(Boolean) as EntryCategory[];
  /** The real fee range across categories ("₹1,500 – ₹2,000"), or the single fee. */
  const feeText = (() => {
    const fees = entryCats.length ? entryCats.map((x) => x.fee) : [feeAmt];
    const lo = Math.min(...fees);
    const hi = Math.max(...fees);
    return hi <= 0 ? "Free entry" : lo === hi ? formatINR(lo) : `${formatINR(lo)} – ${formatINR(hi)}`;
  })();
  const hasFee = feeAmt > 0 || entryCats.some((x) => x.fee > 0);
  const deadline = comp?.registration_deadline;
  const open = !deadline || new Date(deadline).getTime() > Date.now();
  const step: "register" | "submit" | "done" = !registered ? "register" : fields.length && !submitted ? "submit" : "done";

  // inside the entry flow (a Modal, above the toast layer) errors show inline
  const flash = (tone: "success" | "error", text: string, title?: string) =>
    entryOpen && tone === "error" ? setEntryError(text) : popup.show(tone, title || (tone === "success" ? "Done" : "Heads up"), text);

  // the entry being paid for online (filled in just before Razorpay opens)
  const paying = useRef<Omit<RegistrationResult, "method"> | null>(null);
  const checkout = useCheckout({
    onDone: async (ref) => {
      await remember();
      setBusy(null);
      setWon({ ...(paying.current || { title: comp?.title || comp?.name || "Competition", fee: feeAmt }), reference: ref || paying.current?.reference, method: "ONLINE", verified: true });
    },
  });

  useEffect(() => {
    if (checkout.error) { setBusy(null); flash("error", checkout.error, "Payment problem"); checkout.clear(); }
    else if (checkout.cancelled) { setBusy(null); flash("error", "Payment cancelled. Register again to finish.", "Cancelled"); checkout.clear(); }
  }, [checkout.error, checkout.cancelled]);

  /* Picking an entry file: first ask where from — the photo/video gallery or
     the phone's files (documents, audio, video, anything) — then open that. */
  const [pickFor, setPickFor] = useState<string | null>(null);
  const pick = (name: string) => setPickFor(name);

  const fromGallery = async (name: string) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images", "videos"], quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) {
      const a = res.assets[0];
      setFiles((s) => ({ ...s, [name]: { uri: a.uri, name: a.fileName || a.uri.split("/").pop() || "entry", type: a.mimeType || (a.type === "video" ? "video/mp4" : "image/jpeg") } }));
    }
  };

  const fromFiles = async (name: string) => {
    const res = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true, multiple: false });
    if (!res.canceled && res.assets?.[0]) {
      const a = res.assets[0];
      setFiles((s) => ({ ...s, [name]: { uri: a.uri, name: a.name || a.uri.split("/").pop() || "entry", type: a.mimeType || "application/octet-stream" } }));
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
      const fee = entryCats.find((x) => x.name === activeCat)?.fee ?? Number(comp?.participation_fee ?? comp?.entry_fee ?? comp?.fee ?? 0);
      // Cash on Spot only makes sense when there is actually a fee to collect.
      const mode = fee > 0 ? payMode : "ONLINE";
      const res = activeCat
        ? await competeApi.registerInCategory(String(id), activeCat, { rules_accepted: true, payment_method: mode, date_of_birth: dob })
        : await competeApi.register(String(id), true, mode);

      const isCash = mode === "CASH" || res?.payment_method === "CASH";
      // the backend names it `reference` (the website reads the same field)
      const ref = res?.reference || res?.registration_reference || res?.order_reference || null;
      const base = { title: comp?.title || comp?.name || "Competition", category: res?.category || activeCat || null, reference: ref, fee };

      // Cash on Spot, a free entry, or one the server already confirmed: no gateway.
      if (isCash || res?.status === "CONFIRMED" || fee <= 0) {
        await remember();
        setEntryOpen(false);
        setWon({ ...base, method: isCash ? "CASH" : fee > 0 ? "ONLINE" : "FREE" });
        return;
      }

      // Online: the entry stays PENDING until Razorpay is paid and verified.
      if (!res?.payment_info || !ref) {
        flash("error", "The payment gateway didn't respond. Try again, or choose Cash on Spot.", "Payment unavailable");
        return;
      }
      paying.current = base;
      setEntryOpen(false); // Razorpay opens over the screen, not over the flow
      const opened = checkout.start({
        paymentInfo: res.payment_info,
        amount: Number(res.payable_amount ?? fee),
        description: `Entry — ${base.title}`,
        context: { kind: "competition", competitionId: String(id), orderReference: ref },
      });
      if (!opened.opened) flash("error", opened.reason || "Could not open the payment sheet.");
      return;
    } catch (e) {
      const m = e instanceof ApiError ? e.message : "Could not register.";
      if (/already/i.test(m)) { await remember(); setEntryOpen(false); flash("success", "We synced your existing registration.", "Already registered"); }
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
      await competeApi.vote(String(id), pid, comp?.current_round ? { round_number: Number(comp.current_round) } : {});
      await rememberVote(pid);
      flash("success", "Your vote is counted.", "Voted");
      lbQ.refresh();
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

  // first load only: a skeleton shaped like the screen itself (pull-to-refresh keeps the page up)
  if (compQ.loading && !comp) return <CompSkeleton onBack={() => (router.canGoBack() ? router.back() : router.replace("/(more)/competitions"))} />;
  if (!comp) return <SubScreen eyebrow="Competition" title="Not found"><Txt size={14} tone="muted">This competition is no longer available.</Txt></SubScreen>;

  const STEPS = ["Register", fields.length ? "Submit" : null, "Done"].filter(Boolean) as string[];
  const stepIdx = step === "register" ? 0 : step === "submit" ? 1 : STEPS.length - 1;

  return (
    <ParallaxDetailScreen
      image={compImage(comp)}
      imageRatio={COMP_POSTER_RATIO}
      seed={comp._id}
      title={comp.title || comp.name}
      refreshing={lbQ.refreshing}
      onRefresh={() => { lbQ.refresh(); compQ.reload(); }}
      onBack={() => (router.canGoBack() ? router.back() : router.replace("/(more)/competitions"))}
      bottomPad={110}
      footer={<LeaderboardDock rows={rows} accent={g1} onOpen={() => router.push(`/(more)/leaderboard?competition=${id}`)} />}
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
          <SourceSheet
            visible={!!pickFor}
            onClose={() => setPickFor(null)}
            onGallery={() => { const n = pickFor; setPickFor(null); if (n) setTimeout(() => fromGallery(n), 250); }}
            onFiles={() => { const n = pickFor; setPickFor(null); if (n) setTimeout(() => fromFiles(n), 250); }}
          />
          <EntryFlow
            visible={entryOpen}
            onClose={() => setEntryOpen(false)}
            title={comp?.title || comp?.name || "Competition"}
            accent={g1}
            userAge={userAge}
            categories={entryCats}
            baseFee={feeAmt}
            category={activeCat}
            onCategory={(x) => { setEntryError(null); setSelectedCat(x); }}
            rulesText={comp?.rules || null}
            eligibility={comp?.min_age || comp?.max_age ? `Open to ages ${comp.min_age ?? 0}${comp.max_age ? `–${comp.max_age}` : "+"}` : null}
            accepted={rules}
            onAccepted={setRules}
            payMode={payMode}
            onPayMode={setPayMode}
            busy={busy === "reg"}
            error={entryError}
            onSubmit={() => { setEntryError(null); register(); }}
          />
          <RegistrationSuccess
            result={won}
            needsEntry={fields.length > 0 && !submitted}
            onSubmitEntry={() => setWon(null)}
            onClose={() => setWon(null)}
          />
          <ShareSheet
            visible={shareOpen}
            message={shareData?.share_text || `Check out ${comp.title || comp.name || "this competition"} on Upgrade Talents India! Compete, win cash prizes & perform live on stage.`}
            url={shareData?.share_url || shareData?.page_url || shareData?.registration_url || `https://upgradetalentsindia.in/competitions/${id}`}
            onClose={() => setShareOpen(false)}
            links={shareData?.social_share_links}
            card={{
              image: shareData?.image_url || compImage(comp),
              title: shareData?.title || comp.title || comp.name || "Competition",
              meta: shareData?.category || comp.category || (comp.prize ? `Prize pool ${comp.prize}` : null),
            }}
          />
        </>
      }
    >

      {/* ── Prize — the organiser's prize line (or the prize field), right above the info rows ── */}
      {(() => {
        const prize = findPrizeLine(comp.description) || (comp.prize ? String(comp.prize) : null);
        return prize ? (
          <FadeInUp>
            <View style={{ marginBottom: 12 }}>
              <PrizeCard text={prize} />
            </View>
          </FadeInUp>
        ) : null;
      })()}

      {/* ── Clean info rows ── */}
      <FadeInUp>
        <InfoCard style={{ marginBottom: 18 }}>
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
            value={hasFee ? feeText : "FREE"}
            valueColor={hasFee ? undefined : c.success}
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
          ) : step === "register" && pendingReg ? (
            <>
              <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 14, backgroundColor: c.warning + "14", borderWidth: 1, borderColor: c.warning + "44" }}>
                <CreditCard size={16} color={c.warning} style={{ marginTop: 1 }} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt size={14} font="sansBold" style={{ color: c.fg }}>{"You're registered — payment pending"}</Txt>
                  <Txt size={12.5} tone="muted" lh={17}>
                    {[pendingReg.category ? titleCase(pendingReg.category) : null, pendingReg.registration_reference].filter(Boolean).join("  ·  ") || "Finish paying the entry fee to confirm your spot."}
                  </Txt>
                </View>
              </View>
              <Button
                label="Complete payment"
                full
                size="lg"
                onPress={() => {
                  setEntryError(null);
                  if (pendingReg.category) setSelectedCat(String(pendingReg.category));
                  setEntryOpen(true);
                }}
                iconRight={<ArrowRight size={17} color={c.onAccent} />}
              />
            </>
          ) : step === "register" ? (
            <>
              {/* a short summary — the choices themselves happen in the entry flow */}
              {(() => {
                return (
                  <View style={{ borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2 }}>
                    <SummaryRow
                      icon={<Users size={16} color={g1} />}
                      label={entryCats.length > 1 ? `${entryCats.length} categories` : "Category"}
                      value={entryCats.length ? entryCats.map((x) => titleCase(x.name)).join("  ·  ") : "Open to all"}
                    />
                    <SummaryRow icon={<Ticket size={16} color={g1} />} label="Entry fee" value={feeText} divider />
                    {hasFee ? <SummaryRow icon={<CreditCard size={16} color={g1} />} label="Payment" value="Online or Cash on Spot" divider /> : null}
                  </View>
                );
              })()}
              <View>
                <Button
                  label="Enter competition"
                  full
                  size="lg"
                  onPress={() => {
                    setEntryError(null);
                    const cur = entryCats.find((x) => x.name === activeCat);
                    if (cur?.fit === "no") {
                      const ok = entryCats.find((x) => x.fit === "ok") || entryCats.find((x) => x.fit === "open") || entryCats.find((x) => x.fit !== "no");
                      if (ok) setSelectedCat(ok.name);
                    }
                    setEntryOpen(true);
                  }}
                  iconRight={<ArrowRight size={17} color={c.onAccent} />}
                />
                {/* the glint, clipped to the button's pill (its glow stays outside) */}
                <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: 999, overflow: "hidden" }}>
                  <Shine />
                </View>
              </View>
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
            {/* the website's reading of the organiser's text: prize card, headings, bullets… */}
            <FormattedDescription content={comp.description} collapsible />
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
      <RoundsJourney compId={String(id)} />

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

function SummaryRow({ icon, label, value, divider }: { icon: React.ReactNode; label: string; value: string; divider?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: divider ? 1 : 0, borderTopColor: c.border }}>
      <View style={{ marginTop: 2 }}>{icon}</View>
      <Txt size={12.5} tone="subtle" style={{ width: 96, marginTop: 1 }}>{label}</Txt>
      <Txt size={13.5} font="sansSemi" lh={19} style={{ flex: 1, textAlign: "right" }}>{value}</Txt>
    </View>
  );
}

/** The competition screen's own shape, while it loads — hero, title, info, entry. */
function CompSkeleton({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: "#08090C" }}>
      <Skeleton h={340} radius={0} />
      <Pressable onPress={onBack} hitSlop={10} accessibilityLabel="Back" style={{ position: "absolute", top: insets.top + 8, left: 16, width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(20,22,30,0.85)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
        <ArrowLeft size={20} color="#fff" />
      </Pressable>
      <View style={{ padding: 20, gap: 12, marginTop: -40 }}>
        <Skeleton h={26} w={90} radius={999} />
        <Skeleton h={30} w="80%" radius={8} />
        <Skeleton h={30} w="55%" radius={8} />
        <View style={{ height: 8 }} />
        <Skeleton h={150} radius={22} />
        <Skeleton h={190} radius={22} />
      </View>
    </View>
  );
}

/** Pinned to the bottom of the competition: the standings, one tap away. */
function LeaderboardDock({ rows, accent, onOpen }: { rows: any[]; accent: string; onOpen: () => void }) {
  const insets = useSafeAreaInsets();
  const top = rows.slice(0, 3);
  const lead = rows[0];
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: insets.bottom + 10,
        backgroundColor: "rgba(8,9,12,0.96)",
        borderTopWidth: 1,
        borderTopColor: "rgba(255,255,255,0.07)",
      }}
    >
      <Pressable
        onPress={() => { Haptics.selectionAsync().catch(() => {}); onOpen(); }}
        accessibilityRole="button"
        accessibilityLabel="Open leaderboard"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          minHeight: 62,
          paddingHorizontal: 12,
          borderRadius: 20,
          backgroundColor: "#15161E",
          // a soft halo around the whole bar (the shadow glows on iOS; the
          // light rim + top sheen carry it on Android)
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.16)",
          shadowColor: "#FFFFFF",
          shadowOpacity: 0.14,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 0 },
          elevation: 6,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        })}
      >
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0.09)", "rgba(255,255,255,0)"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, borderRadius: 19 }}
        />
        {top.length ? (
          <View style={{ flexDirection: "row" }}>
            {top.map((r: any, i: number) => (
              <View key={r.participant_id || r.email || i} style={{ width: 34, height: 34, borderRadius: 999, marginLeft: i ? -10 : 0, borderWidth: 2, borderColor: "#14151C", backgroundColor: ["#F5C542", "#C9D1DC", "#D08A4E"][i], overflow: "hidden", alignItems: "center", justifyContent: "center", zIndex: 3 - i }}>
                {r.profile_photo ? (
                  <Image source={{ uri: r.profile_photo }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                ) : (
                  <Txt size={13} font="sansBold" style={{ color: "#0B0C10" }}>{String(r.name || "?").charAt(0).toUpperCase()}</Txt>
                )}
              </View>
            ))}
          </View>
        ) : (
          <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: accent + "22" }}>
            <Trophy size={18} color={accent} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Txt size={15} font="sansBold" style={{ color: "#fff" }}>Leaderboard</Txt>
          <Txt size={12} numberOfLines={1} style={{ color: "rgba(255,255,255,0.55)", marginTop: 1 }}>
            {lead ? `${rows.length} contestants · #1 ${lead.name || "—"}` : "Rankings appear once voting starts"}
          </Txt>
        </View>
        {/* white "View" with a glow ring */}
        <View style={{ padding: 3, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.14)", shadowColor: "#FFFFFF", shadowOpacity: 0.6, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 32, paddingHorizontal: 13, borderRadius: 999, backgroundColor: "#FFFFFF" }}>
            <Txt size={12.5} font="sansBold" style={{ color: "#0B0C10" }}>View</Txt>
            <ChevronRight size={15} color="#0B0C10" />
          </View>
        </View>
      </Pressable>
    </View>
  );
}

/** Where should the entry come from? Gallery (photos & videos) or Files (anything). */
function SourceSheet({ visible, onClose, onGallery, onFiles }: { visible: boolean; onClose: () => void; onGallery: () => void; onFiles: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: "#14151C", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 16, paddingTop: 10, paddingBottom: insets.bottom + 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
          <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.18)", marginBottom: 16 }} />
          <Txt size={17} font="sansBold" style={{ color: "#fff", marginBottom: 4, paddingHorizontal: 4 }}>Add your entry</Txt>
          <Txt size={13} style={{ color: "rgba(255,255,255,0.55)", marginBottom: 16, paddingHorizontal: 4 }}>Choose where to pick it from</Txt>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <SourceOption icon={<ImageIcon size={22} color="#fff" />} title="Gallery" sub="Photos & videos" onPress={onGallery} />
            <SourceOption icon={<FolderOpen size={22} color="#fff" />} title="Files" sub="Documents, audio, any file" onPress={onFiles} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SourceOption({ icon, title, sub, onPress }: { icon: React.ReactNode; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      accessibilityRole="button"
      style={({ pressed }) => ({ flex: 1, padding: 16, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", gap: 12, transform: [{ scale: pressed ? 0.97 : 1 }] })}
    >
      <View style={{ width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.08)" }}>{icon}</View>
      <View>
        <Txt size={15} font="sansBold" style={{ color: "#fff" }}>{title}</Txt>
        <Txt size={12} lh={16} style={{ color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{sub}</Txt>
      </View>
    </Pressable>
  );
}
