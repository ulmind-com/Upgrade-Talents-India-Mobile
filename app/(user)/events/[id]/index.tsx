import React, { useRef, useState } from "react";
import Reanimated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { BookedBy } from "@/components/booking/BookedBy";
import { View, Text, Pressable, Animated, Share, Linking, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, useNavigation, useFocusEffect } from "expo-router";
import { BackHandler } from "react-native";
import { eventOrigin, tabHref } from "@/lib/tabOrigin";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  ArrowLeft, Share2, CalendarDays, Clock, MapPin, Users, Ticket, ShieldCheck, Zap, QrCode, ChevronRight, Flame,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { getEventById, getRelatedEvents } from "@/lib/events";
import { publicApi, assetUrl } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Badge, Button, Card, SectionLabel, Skeleton } from "@/components/ui";
import { ShareSheet } from "@/components/ShareSheet";
import { EventVipSection } from "@/components/vip/EventVipSection";
import { AppImage, PosterFill } from "@/components/AppImage";
import { useParallaxHero } from "@/components/ParallaxHero";
import { FadeInUp } from "@/components/FadeInUp";
import { Countdown } from "@/components/domain";
import { DottedGrid } from "@/components/patterns";
import { InfoCard, InfoRow, DateChip } from "@/components/InfoRows";
import { formatEventDate, formatINR, splitDate, isPastEvent, isDeadlinePassed, isBookable, isUsableImageUrl } from "@/lib/format";

const HERO = 380;

export default function EventDetail() {
  const { c, fonts } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  /* Back goes where you came from. Opened straight from Home (or another tab)
     → back to that tab. Opened from the Events list, or from another event's
     "you might also like" → normal back within the Events stack. */
  const navigation = useNavigation();
  const [origin] = React.useState(() => {
    const st: any = navigation.getState?.();
    const below = st?.routes?.[(st?.index ?? 0) - 1]?.name;
    return below && below !== "index" ? null : eventOrigin();
  });
  const goBack = React.useCallback(() => {
    if (origin) router.navigate(tabHref(origin) as any);
    else if (router.canGoBack()) router.back();
    else router.replace("/(user)/events");
  }, [origin, router]);
  useFocusEffect(
    React.useCallback(() => {
      if (!origin) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goBack();
        return true;
      });
      return () => sub.remove();
    }, [origin, goBack])
  );
  const { data: ev, loading } = useAsync(() => getEventById(String(id)), [id]);
  const { data: related } = useAsync(() => getRelatedEvents(String(id)), [id]);

  /* Shared with competition detail so the two heroes stay identical. */
  /* The poster at its own proportions — full width, its real height, nothing
     cropped and no blurred sides. The sheet overlaps the bottom by OVERLAP. */
  const { width: W } = useWindowDimensions();
  const OVERLAP = 26;
  const [ratio, setRatio] = useState<number | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const heroImg = assetUrl(ev?.image_url ?? undefined);
  const hasImg = isUsableImageUrl(heroImg) && !imgFailed;
  const imgH = hasImg && ratio ? Math.round(Math.min(W * 1.6, Math.max(W * 0.45, W / ratio))) : null;
  const H = imgH ? imgH + OVERLAP : HERO;
  const { onScroll, imgTranslate, imgScale, headerOpacity } = useParallaxHero(H);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareData, setShareData] = useState<any>(null);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 60, paddingHorizontal: 20, gap: 14 }}>
        <Skeleton h={260} radius={24} />
        <Skeleton h={28} w="70%" />
        <Skeleton h={120} radius={16} />
      </View>
    );
  }
  if (!ev) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", gap: 14 }}>
        <Txt size={18} font="sansBold">Event not found</Txt>
        <Button label="Back to events" onPress={() => router.replace("/(user)/events")} />
      </View>
    );
  }

  const over = isPastEvent(ev);
  const deadlineOver = isDeadlinePassed(ev.registration_deadline);
  const bookable = isBookable(ev);
  const registered = (ev as any).registered_count ?? 0;
  const seatsLeft = ev.capacity ? Math.max(0, ev.capacity - registered) : null;
  const lowSeats = seatsLeft !== null && seatsLeft <= 20 && seatsLeft > 0;
  const d = splitDate(ev.date);

  const openMaps = () => {
    const q = encodeURIComponent(`${ev.venue}`);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`).catch(() => {});
  };
  const perks = [
    { Icon: QrCode, title: "Instant digital ticket", body: "A scannable QR pass lands in your tickets the moment payment clears." },
    { Icon: ShieldCheck, title: "Secure checkout", body: "Payments are verified server-side with signature validation." },
    { Icon: Zap, title: "Gate-ready entry", body: "Tap in at the gate — one scan per pass." },
  ];

  const share = () => {
    setShareOpen(true);
    if (ev?._id) publicApi.shareEvent(String(ev._id)).then(setShareData).catch(() => {});
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#08090C" }}>
      <StatusBar style="light" />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 150 }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {/* Parallax hero */}
        <View style={{ height: H, overflow: "hidden" }}>
          <Animated.View style={{ width: "100%", height: imgH ?? "100%", transform: [{ translateY: imgTranslate }, { scale: imgScale }] }}>
            {hasImg ? (
              <Image
                source={{ uri: heroImg }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                transition={250}
                cachePolicy="memory-disk"
                onLoad={(e) => {
                  const w = e?.source?.width;
                  const h = e?.source?.height;
                  if (w && h) setRatio(w / h);
                }}
                onError={() => setImgFailed(true)}
              />
            ) : (
              <PosterFill uri={null} seed={3} />
            )}
          </Animated.View>
          <LinearGradient colors={["rgba(4,5,12,0.55)", "transparent", "rgba(4,5,12,0.5)", "rgba(4,5,12,0.9)"] as any} locations={[0, 0.32, 0.7, 1]} style={{ position: "absolute", width: "100%", height: "100%" }} />
          <View style={{ position: "absolute", bottom: OVERLAP + 20, left: 20, right: 20, flexDirection: "row", alignItems: "flex-end", gap: 14 }}>
            <View style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 16, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}>
              <Txt size={26} font="display" style={{ color: "#fff" }} lh={28}>{d.day}</Txt>
              <Txt size={11} font="sansBold" style={{ color: "rgba(255,255,255,0.85)" }} tracking={1.5}>{d.month}</Txt>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
                {ev.event_status === "live" ? null : over ? <Badge label={ev.event_status === "cancelled" ? "Cancelled" : "Ended"} tone={ev.event_status === "cancelled" ? "danger" : "neutral"} /> : deadlineOver ? <Badge label="Registration closed" tone="warning" /> : null}
                {!ev.price ? <Badge label="Free entry" tone="brand" /> : null}
                {lowSeats ? <Badge label={`${seatsLeft} left`} tone="warning" /> : null}
              </View>
              <Txt size={21} font="display" lh={25} tracking={-0.5} numberOfLines={3} style={{ color: "#fff" }}>{ev.title}</Txt>
            </View>
          </View>
        </View>

        {/* Content sheet — overlaps the hero with a rounded top */}
        <View style={{ backgroundColor: "#08090C", borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -26, paddingTop: 26, paddingHorizontal: 20, gap: 24 }}>
          {/* grab handle */}
          <View style={{ alignSelf: "center", width: 42, height: 5, borderRadius: 999, backgroundColor: c.border, marginTop: -14 }} />

          {/* Live now — a quiet line in the content, not a sticker on the poster */}
          {ev.event_status === "live" ? <LiveLine /> : null}

          {/* Registration shut before the event itself */}
          {deadlineOver && !over ? (
            <View style={{ flexDirection: "row", gap: 11, borderRadius: 20, borderWidth: 1, borderColor: c.warning + "55", backgroundColor: c.warning + "14", padding: 16 }}>
              <Flame size={18} color={c.warning} />
              <View style={{ flex: 1 }}>
                <Txt size={15} font="sansBold">Deadline passed</Txt>
                <Txt size={13} tone="muted" lh={19} style={{ marginTop: 3 }}>
                  Registration closed on {formatEventDate(ev.registration_deadline)}. New bookings are disabled.
                </Txt>
              </View>
            </View>
          ) : null}

          {/* Countdown urgency band */}
          {ev.registration_deadline && bookable ? (
            <View style={{ borderRadius: 22, overflow: "hidden" }}>
              <LinearGradient colors={[c.theaterPink, c.theaterDeep] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18 }}>
                <DottedGrid color="rgba(255,255,255,0.1)" gap={18} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 14 }}>
                  <Flame size={15} color="#fff" />
                  <Txt size={11} font="monoMed" tracking={2} uppercase style={{ color: "#fff" }}>Registration closes in</Txt>
                </View>
                <Countdown target={ev.registration_deadline} />
              </LinearGradient>
            </View>
          ) : null}

          {/* Clean info rows */}
          <FadeInUp>
            <InfoCard>
              <InfoRow icon={<Ticket size={19} color={c.accent} />} label="Entry" value={ev.price ? formatINR(ev.price) : "FREE"} valueColor={ev.price ? undefined : c.success} />
              <InfoRow dateChip={<DateChip day={d.day} month={d.month} />} value={formatEventDate(ev.date)} sub={ev.time || "Time to be announced"} />
              <InfoRow icon={<MapPin size={19} color={c.accent} />} value={ev.venue || "Venue to be announced"} sub={ev.venue ? "Tap for directions" : undefined} onPress={ev.venue ? openMaps : undefined} />
              {seatsLeft !== null ? (
                <InfoRow icon={<Users size={19} color={c.accent} />} label="Availability" value={seatsLeft > 0 ? `${seatsLeft} seats left` : "Sold out"} valueColor={lowSeats ? c.warning : seatsLeft === 0 ? c.danger : undefined} />
              ) : null}
            </InfoCard>
          </FadeInUp>

          {/* Who's going — real confirmed bookings */}
          <BookedBy eventId={String(ev._id)} />

          {/* About */}
          <FadeInUp>
            <View style={{ gap: 12 }}>
              <Txt size={20} font="display" tracking={-0.5} uppercase>About this event</Txt>
              <Txt size={15} tone="muted" lh={24} style={{ textAlign: "justify" }}>{ev.description}</Txt>
            </View>
          </FadeInUp>

          {/* VIP tiers for this event — renders nothing if there are none */}
          <EventVipSection eventId={String(ev._id)} eventTitle={ev.title} />

          {/* Perks */}
          <View style={{ gap: 14 }}>
            <SectionLabel>Why book here</SectionLabel>
            {perks.map((p, i) => (
              <FadeInUp key={p.title} delay={i * 70}>
                <View style={{ flexDirection: "row", gap: 14, alignItems: "flex-start" }}>
                  <View style={{ width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2 }}>
                    <p.Icon size={18} color={c.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt size={15} font="sansBold">{p.title}</Txt>
                    <Txt size={13} tone="muted" lh={19} style={{ marginTop: 2 }}>{p.body}</Txt>
                  </View>
                </View>
              </FadeInUp>
            ))}
          </View>

          {/* Related */}
          {related?.length ? (
            <View style={{ gap: 12 }}>
              <SectionLabel>You might also like</SectionLabel>
              {related.map((r) => (
                <Pressable key={r._id} onPress={() => router.push(`/(user)/events/${r._id}`)}>
                  <Card padding={0} style={{ overflow: "hidden", flexDirection: "row" }}>
                    <View style={{ width: 90, height: 74 }}>
                      <AppImage uri={r.image_url} seed={r._id} style={{ width: "100%", height: "100%" }} />
                    </View>
                    <View style={{ flex: 1, padding: 12, justifyContent: "center" }}>
                      <Txt size={14} font="sansBold" numberOfLines={1}>{r.title}</Txt>
                      <Txt size={12} tone="muted" style={{ marginTop: 2 }}>{formatEventDate(r.date)}</Txt>
                    </View>
                    <View style={{ justifyContent: "center", paddingRight: 10 }}>
                      <ChevronRight size={18} color={c.fgSubtle} />
                    </View>
                  </Card>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </Animated.ScrollView>

      {/* Animated glass header (fades in on scroll) */}
      <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 54, backgroundColor: "#08090C", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)", opacity: headerOpacity, justifyContent: "flex-end", paddingBottom: 12, paddingHorizontal: 70 }}>
        <Txt size={16} font="sansBold" align="center" numberOfLines={1} style={{ color: "#fff" }}>{ev.title}</Txt>
      </Animated.View>

      {/* Floating back + share */}
      <View style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" }}>
        <FloatBtn onPress={goBack}><ArrowLeft size={20} color={c.fg} /></FloatBtn>
        <FloatBtn onPress={share}><Share2 size={18} color={c.fg} /></FloatBtn>
      </View>

      <ShareSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share this event"
        subtitle={ev.title}
        message={shareData?.share_text || `Check out ${ev.title} on Upgrade Talents — ${formatEventDate(ev.date)}${ev.venue ? ` at ${ev.venue}` : ""}.`}
        url={shareData?.share_url || shareData?.page_url || shareData?.ticket_booking_url || `https://upgradetalentsindia.in/events/${ev._id}`}
        links={shareData?.social_share_links}
        card={{
          image: shareData?.image_url || ev.image_url,
          title: shareData?.title || ev.title,
          meta: [formatEventDate(ev.date), shareData?.venue || ev.venue].filter(Boolean).join(" · "),
        }}
      />

      {/* Sticky booking bar — District style */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 14, paddingBottom: insets.bottom + 14, backgroundColor: "rgba(20, 22, 30, 0.96)", borderTopWidth: 1, borderTopColor: "rgba(255, 255, 255, 0.1)", flexDirection: "row", alignItems: "center", gap: 14 }}>
        <View>
          <Txt size={11} font="monoMed" tone="subtle" tracking={1.5} uppercase>{ev.price ? "From" : "Entry"}</Txt>
          <Txt size={22} font="display" style={{ color: "#FF385C" }}>{formatINR(ev.price)}</Txt>
          {lowSeats ? <Txt size={11} font="sansBold" style={{ color: "#C9F24A", marginTop: 1 }}>Only {seatsLeft} seats left</Txt> : null}
        </View>
        {/* a compact pill on the right — the price keeps the left */}
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Button label={over ? (ev.event_status === "cancelled" ? "Event cancelled" : "This event has ended") : deadlineOver ? "Registration closed" : !bookable ? "Booking closed" : ev.ticket_enabled === false ? "Register now" : "Book tickets"} disabled={!bookable} size="sm" onPress={() => router.push(`/(user)/events/${ev._id}/book`)} icon={<Ticket size={15} color={c.onAccent} />} />
        </View>
      </View>
    </View>
  );
}

function FloatBtn({ children, onPress }: { children: React.ReactNode; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceGlass, borderWidth: 1, borderColor: c.border }}>
      {children}
    </Pressable>
  );
}

/** "● Live now · happening right now" — the dot breathes, nothing else moves. */
function LiveLine() {
  const p = useSharedValue(0);
  React.useEffect(() => {
    p.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [p]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.55 * (1 - p.value), transform: [{ scale: 1 + p.value * 1.4 }] }));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: -6 }}>
      <View style={{ width: 10, height: 10, alignItems: "center", justifyContent: "center" }}>
        <Reanimated.View style={[{ position: "absolute", width: 10, height: 10, borderRadius: 999, backgroundColor: "#FF385C" }, ring]} />
        <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: "#FF385C" }} />
      </View>
      <Txt size={14} font="sansBold" style={{ color: "#fff" }}>Live now</Txt>
      <Txt size={13} style={{ color: "rgba(255,255,255,0.55)" }}>Happening right now</Txt>
    </View>
  );
}
