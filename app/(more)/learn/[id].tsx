import React, { useEffect, useMemo, useState } from "react";
import { View, ScrollView, Pressable, Dimensions, RefreshControl } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft, CalendarDays, Clock, User as UserIcon, Users, GraduationCap,
  Check, LogIn, Sparkles,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { publicApi, profileApi, registrationsApi, safe, seatsLeft, ApiError, type CourseItem } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAlert } from "@/components/Popup";
import { useCheckout } from "@/lib/useCheckout";
import { CoinRedeem } from "@/components/CoinRedeem";
import { Txt, Button, Skeleton, Badge, Glow, EmptyState } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { FadeInUp } from "@/components/FadeInUp";
import { formatINR, formatEventDate, titleCase } from "@/lib/format";

const { width: W } = Dimensions.get("window");

/** Course / workshop detail with enrolment — the website's LearnDetail page. */
export default function LearnDetail() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const alert = useAlert();
  const p = useLocalSearchParams<{ id: string; kind?: string }>();
  const kind: "course" | "workshop" = p.kind === "workshop" ? "workshop" : "course";

  const [busy, setBusy] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  // Coins the member chose to spend, and what the backend says they would pay.
  const [coins, setCoins] = useState(0);
  const [payable, setPayable] = useState<number | null>(null);

  const { data, loading, refreshing, refresh } = useAsync(async () => {
    const list = await safe(kind === "workshop" ? publicApi.workshops({ limit: 200 }) : publicApi.courses({ limit: 200 }), [] as CourseItem[]);
    return list.find((x) => x._id === String(p.id)) || null;
  }, [p.id, kind]);

  // What the member is already registered in, so the screen opens on the right
  // state instead of offering to enrol again.
  const mine = useAsync(
    () => (user ? safe(profileApi.dashboard(), null as any) : Promise.resolve(null)),
    [user?.email],
    { refetchOnFocus: true }
  );
  const alreadyIn = useMemo(() => {
    const regs: any[] = mine.data?.my_courses || [];
    return regs.some((r) => String(r.activity_id) === String(p.id) && r.status !== "CANCELLED");
  }, [mine.data, p.id]);
  useEffect(() => { if (alreadyIn) setEnrolled(true); }, [alreadyIn]);

  const checkout = useCheckout({
    onDone: () => {
      setBusy(false);
      setEnrolled(true);
      alert("success", "You're in", `Enrolment confirmed for this ${kind}.`);
    },
  });

  // Surface whatever the checkout sheet reported back.
  useEffect(() => {
    if (checkout.error) { setBusy(false); alert("error", "Payment problem", checkout.error); checkout.clear(); }
    else if (checkout.cancelled) { setBusy(false); alert("warning", "Payment cancelled", "Your seat is held briefly — enrol again to finish."); checkout.clear(); }
  }, [checkout.error, checkout.cancelled]);

  const item = data;
  const left = item ? seatsLeft(item) : null;
  const soldOut = left === 0;
  const upcoming = item?.registration_status === "UPCOMING";
  const closed = item?.registration_status === "CLOSED";
  // The backend's own gate: false when full, closed, unpublished or past deadline.
  const cannotRegister = item?.can_register === false;
  const blocked = enrolled || soldOut || upcoming || closed || cannotRegister;

  const ctaLabel = enrolled
    ? "Enrolled"
    : busy || checkout.verifying
      ? "Processing"
      : soldOut
        ? "Seats full"
        : upcoming
          ? "Opens soon"
          : closed || cannotRegister
            ? "Registration closed"
            : (item?.price ?? 0) > 0
              ? `Enrol · ${formatINR(item?.price ?? 0)}`
              : "Enrol free";

  const enrol = async () => {
    if (!user) { router.push("/(auth)/login"); return; }
    if (!item) return;
    setBusy(true);
    try {
      const res = await registrationsApi.create({ activity_id: item._id, activity_type: kind, coins_to_use: coins || undefined });

      if (res?.status === "CONFIRMED" || !res?.payment_info) {
        setEnrolled(true);
        setBusy(false);
        alert("success", "You're in", `Enrolment confirmed for this ${kind}.`);
        return;
      }

      const r = checkout.start({
        paymentInfo: res.payment_info,
        amount: Number(res.payable_amount ?? item.price ?? 0),
        description: `${kind === "workshop" ? "Workshop" : "Course"} — ${item.title}`,
        context: { kind: "registration", orderReference: res.order_reference },
      });
      if (!r.opened) { setBusy(false); alert("error", "Can't continue", r.reason || "Please try again."); }
    } catch (e) {
      setBusy(false);
      const m = e instanceof ApiError ? e.message : `Could not enrol in this ${kind}.`;
      // Re-registering (common while testing) comes back as a 400 — treat it as
      // already-enrolled rather than an error.
      if (/already\s*registered/i.test(m)) {
        setEnrolled(true);
        alert("success", "Already enrolled", `You're already enrolled in this ${kind}.`);
      } else {
        alert("error", "Can't enrol", m);
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="light" />
      <Glow color={c.spot1} size={320} top={-120} right={-100} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.accent} colors={[c.accent]} />}
      >
        {/* Hero */}
        <View style={{ height: 300 }}>
          <AppImage uri={item?.thumbnail} seed={String(p.id)} style={{ position: "absolute", width: "100%", height: "100%" }} />
          <LinearGradient
            colors={["rgba(5,6,12,0.25)", "rgba(5,6,12,0.65)", c.bg] as any}
            locations={[0, 0.5, 1]}
            style={{ position: "absolute", width: "100%", height: "100%" }}
          />
          <View style={{ flex: 1, justifyContent: "flex-end", padding: 20, paddingBottom: 24 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, marginBottom: 10 }}>
              <GraduationCap size={12} color="#fff" />
              <Txt size={10} font="monoMed" tracking={2} uppercase style={{ color: "#fff" }}>{kind}</Txt>
            </View>
            {loading ? (
              <Skeleton h={30} w="80%" />
            ) : (
              <Txt size={27} font="display" tracking={-0.8} lh={31} numberOfLines={3} style={{ color: "#fff" }}>{item?.title || "Not found"}</Txt>
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {loading ? (
            <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={70} radius={18} />)}</View>
          ) : !item ? (
            <EmptyState icon={<GraduationCap size={26} color={c.fgMuted} />} title="Not available" subtitle="This programme is no longer listed." />
          ) : (
            <>
              <FadeInUp>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
                  {item.instructor_name ? <Chip Icon={UserIcon} label={item.instructor_name} /> : null}
                  {item.start_date ? <Chip Icon={CalendarDays} label={formatEventDate(item.start_date)} /> : null}
                  {item.end_date ? <Chip Icon={Clock} label={`Ends ${formatEventDate(item.end_date)}`} /> : null}
                  {left !== null ? <Chip Icon={Users} label={soldOut ? "Sold out" : `${left} seats left`} /> : null}
                  {item.registration_status && !soldOut ? <Chip Icon={Sparkles} label={titleCase(item.registration_status)} /> : null}
                </View>
              </FadeInUp>

              {item.description ? (
                <FadeInUp delay={60}>
                  <Txt size={11} font="monoMed" tone="subtle" tracking={2.5} uppercase style={{ marginBottom: 8 }}>About</Txt>
                  <Txt size={14.5} lh={22} tone="muted" style={{ marginBottom: 22 }}>{item.description}</Txt>
                </FadeInUp>
              ) : null}

              {item.instructor_info ? (
                <FadeInUp delay={120}>
                  <Txt size={11} font="monoMed" tone="subtle" tracking={2.5} uppercase style={{ marginBottom: 8 }}>Your instructor</Txt>
                  <View style={{ backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.border, padding: 16, marginBottom: 22 }}>
                    <Txt size={15} font="sansBold">{item.instructor_name}</Txt>
                    <Txt size={13.5} tone="muted" lh={20} style={{ marginTop: 6 }}>{item.instructor_info}</Txt>
                  </View>
                </FadeInUp>
              ) : null}

              {user && !enrolled && !blocked && (item.price ?? 0) > 0 ? (
                <FadeInUp delay={150}>
                  <View style={{ marginBottom: 18 }}>
                    <CoinRedeem
                      itemId={item._id}
                      itemType={kind}
                      disabled={busy || checkout.verifying}
                      onChange={(n, p) => { setCoins(n); setPayable(p); }}
                    />
                  </View>
                </FadeInUp>
              ) : null}

              {enrolled ? (
                <FadeInUp delay={160}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.success + "1a", borderWidth: 1, borderColor: c.success + "55", borderRadius: 18, padding: 16 }}>
                    <Check size={18} color={c.success} />
                    <Txt size={14} font="sansSemi" style={{ flex: 1 }}>You are enrolled. Details are in your bookings.</Txt>
                  </View>
                </FadeInUp>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>

      {checkout.sheet}

      {/* Back */}
      <View style={{ position: "absolute", top: insets.top + 8, left: 16 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(user)/learn"))} style={{ width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" }}>
          <ArrowLeft size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Enrol bar */}
      {item ? (
        <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 14, paddingBottom: insets.bottom + 14, backgroundColor: c.bgElevated, borderTopWidth: 1, borderTopColor: c.border, flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View>
            <Txt size={11} font="monoMed" tone="subtle" tracking={1.5} uppercase>Fee</Txt>
            <Txt size={22} font="display" tone="accent">{item.price > 0 ? formatINR(payable ?? item.price) : "Free"}</Txt>
            {payable !== null && payable < (item.price ?? 0) ? (
              <Txt size={11.5} tone="subtle" style={{ textDecorationLine: "line-through" }}>{formatINR(item.price)}</Txt>
            ) : null}
          </View>
          <View style={{ flex: 1 }}>
            {!user ? (
              <Button label="Sign in to enrol" full size="lg" onPress={() => router.push("/(auth)/login")} icon={<LogIn size={17} color={c.onAccent} />} />
            ) : (
              <Button
                label={ctaLabel}
                full
                size="lg"
                disabled={blocked}
                loading={busy || checkout.verifying}
                onPress={enrol}
                icon={enrolled ? <Check size={17} color={c.onAccent} /> : <Sparkles size={17} color={c.onAccent} />}
              />
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Chip({ Icon, label }: { Icon: any; label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
      <Icon size={13} color={c.accent} />
      <Txt size={12.5} font="sansMed" numberOfLines={1}>{label}</Txt>
    </View>
  );
}
