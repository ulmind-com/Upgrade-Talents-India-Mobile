import React, { useRef, useState } from "react";
import { useLive } from "@/context/Live";
import { FestiveStrip } from "@/components/FestiveLottie";
import { compImage } from "@/lib/competition";
import { View, Pressable, ScrollView, RefreshControl, Animated, Linking } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Bell, Search } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { publicApi, extrasApi, safe, type HomepagePayload, type TestimonialItem } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Skeleton } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { Avatar } from "@/components/Avatar";
import { Reveal } from "@/components/motion";
import { SpotlightCarousel } from "@/components/SpotlightCarousel";
import { GrandSponsorModal } from "@/components/GrandSponsorModal";
import { ExploreGrid, EventsIcon, ContestIcon, AcademyIcon, ShopIcon, type ExploreItem } from "@/components/CategoryIcons";
import { ReferralBanner } from "@/components/ReferralBanner";
import { StageBand, type GalleryItem } from "@/components/StageBand";
import { PartnerMarquee } from "@/components/showcase";
import { LiveNow } from "@/components/LiveNow";
import { LiveNowBar } from "@/components/live/LiveBits";
import { BrandFooter } from "@/components/BrandFooter";
import { ReviewDetailModal } from "@/components/ReviewDetailModal";
import { publishedInOrder, visible } from "@/lib/live";
import { formatEventDate, formatINR } from "@/lib/format";
import { playNavFeedback } from "@/lib/sound";
import {
  SectionHead,
  PosterRail,
  GroupedPicks,
  NumbersStrip,
  VoicesHero,
  VoiceCard,
  AutoRail,
  SECTION_GAP,
  type RailItem,
  type PickGroup,
  type Stat,
} from "@/components/HomeSections";

/* ──────────────────────────────────────────────────────────────────────────
   Home.

   One grammar, top to bottom: head → content, on pure black, with the brand
   accent spent only on what is tappable. No tinted section bands, no wave
   dividers, no per-section palette — those were what made the page read as
   a stack of templates rather than one product.

   Order is deliberate: who we are showing off (spotlight) → what to enter
   (competitions) → what we are giving you (offers) → what to learn → who
   backs us → proof (gallery, voices, numbers).
   ────────────────────────────────────────────────────────────────────────── */

const EMPTY: HomepagePayload = {
  brand: {}, upcoming_events: [], live_events: [], sponsored_banners: [], testimonials: [],
  courses: [], workshops: [], contest_promotions: [], app_promotion: null, contact: null, important_links: [],
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** 1480 → "1.4k+", 86 → "86+". Counts are social proof, not accounting. */
function countLabel(n: unknown, noun: string): string | undefined {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return undefined;
  const short = v >= 1000 ? `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(v);
  return `${short}+ ${noun}`;
}

function statValue(n: number): string {
  if (!n) return "";
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k+` : `${n}+`;
}

export default function Home() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { data, loading, refreshing, refresh } = useAsync(() => safe(publicApi.homepage(), EMPTY), []);
  const hp = data || EMPTY;
  const scrollY = useRef(new Animated.Value(0)).current;
  const [selectedReview, setSelectedReview] = useState<TestimonialItem | null>(null);

  const unread = useAsync(
    () => (user ? safe(extrasApi.unreadCount(), { unread_count: 0 } as any) : Promise.resolve({ unread_count: 0 } as any)),
    [user?.email],
    { refetchOnFocus: true }
  );
  const unreadCount = Number(unread.data?.unread_count ?? 0);

  /* Real competitions beat promo banners — the banner is only the fallback
     for when the admin has published art but no live competition yet. */
  const compQ = useAsync(() => safe(publicApi.upcomingCompetitions({ limit: 10 }), [] as any[]), []);

  /* Pull-to-refresh reloads every section on the screen, not just the
     homepage payload: competitions spotlight, unread count, the live dock
     and the "live now" bar all come back fresh together. */
  const live = useLive();
  const [liveKey, setLiveKey] = useState(0);
  const [pulling, setPulling] = useState(false);
  const refreshAll = async () => {
    setPulling(true);
    setLiveKey((k) => k + 1);
    await Promise.all([refresh(), compQ.refresh(), unread.refresh(), live.refresh()]).catch(() => {});
    setPulling(false);
  };

  /* Homepage lists carry is_published / is_visible / display_order — honour
     all three, or the app shows rows the admin hid and in the wrong order. */
  const liveEvents = React.useMemo(() => publishedInOrder(hp.live_events), [hp.live_events]);
  const promos = React.useMemo(() => publishedInOrder(hp.contest_promotions), [hp.contest_promotions]);
  const banners = React.useMemo(() => publishedInOrder(hp.sponsored_banners), [hp.sponsored_banners]);
  const reviews = React.useMemo(() => publishedInOrder(hp.testimonials), [hp.testimonials]);
  const courses = React.useMemo(() => publishedInOrder(hp.courses), [hp.courses]);
  const workshops = React.useMemo(() => publishedInOrder(hp.workshops), [hp.workshops]);
  const events = React.useMemo(() => visible(hp.upcoming_events), [hp.upcoming_events]);
  const featured = events.slice(0, 6);

  /* The stream lives at `public_url`; sending the user to the events list
     instead would quietly drop what the admin published. */
  const openLive = (ev: { public_url?: string }) => {
    const url = ev.public_url || "";
    if (/^https?:/i.test(url)) Linking.openURL(url).catch(() => router.push("/(user)/events"));
    else router.push("/(user)/events");
  };

  /* A banner says where it goes: a real competition first, then an explicit
     link, and only then the generic list. */
  const openPromo = (p: any) => {
    if (p.competition_id) return router.push(`/(more)/competitions/${p.competition_id}`);
    const url = p.target_url || "";
    if (/^https?:/i.test(url)) Linking.openURL(url).catch(() => {});
    else router.push("/(more)/competitions");
  };

  const compRail: RailItem[] = React.useMemo(() => {
    const live = Array.isArray(compQ.data) ? compQ.data : [];
    if (live.length) {
      return live.slice(0, 8).map((x: any) => {
        const id = String(x._id || x.id || "");
        const closes = x.registration_end || x.registration_deadline || x.end_date;
        return {
          id,
          title: x.title || x.name || "Competition",
          image: compImage(x) || x.thumbnail || null,
          sub: closes
            ? `Entries close ${formatEventDate(closes)}`
            : x.start_date
              ? formatEventDate(x.start_date)
              : undefined,
          onPress: () => router.push(`/(more)/competitions/${id}`),
        };
      });
    }
    return promos.slice(0, 8).map((p: any) => ({
      id: String(p._id),
      title: p.title,
      image: p.image_url,
      sub: p.description || undefined,
      onPress: () => openPromo(p),
    }));
  }, [compQ.data, promos]);

  const learnGroups: PickGroup[] = React.useMemo(() => {
    const toRows = (list: any[], kind: "course" | "workshop") =>
      list.slice(0, 3).map((it: any) => ({
        id: String(it._id),
        thumb: it.thumbnail,
        top: it.price ? formatINR(it.price) : "Free",
        title: it.title,
        sub: it.instructor_name || undefined,
        onPress: () => router.push(`/(more)/learn/${it._id}?kind=${kind}`),
      }));
    return [
      {
        key: "courses",
        title: "Courses",
        countLabel: `${courses.length} ${courses.length === 1 ? "course" : "courses"}`,
        rows: toRows(courses, "course"),
        onAll: () => router.push("/(user)/learn"),
      },
      {
        key: "workshops",
        title: "Workshops",
        countLabel: `${workshops.length} ${workshops.length === 1 ? "workshop" : "workshops"}`,
        rows: toRows(workshops, "workshop"),
        onAll: () => router.push("/(user)/learn"),
      },
    ];
  }, [courses, workshops]);

  const stats: Stat[] = [
    { value: statValue(events.length), label: "Events" },
    { value: statValue(courses.length + workshops.length), label: "Courses" },
    { value: statValue(banners.length), label: "Partners" },
  ];

  const galleryItems: GalleryItem[] = [
    ...events.map((e) => ({ uri: e.image_url, label: e.title })),
    ...banners.map((b) => ({ uri: b.image_url, label: b.sponsor_name || b.title })),
  ];
  const GENERIC = ["Live on stage", "The crowd", "Backstage", "Centre spotlight"];
  while (galleryItems.length < 3) galleryItems.push({ uri: null, label: GENERIC[galleryItems.length % GENERIC.length] });

  /* The four places worth a permanent door on the home screen. */
  const exploreItems: ExploreItem[] = [
    { key: "events", label: "Events", Icon: EventsIcon, glow: "#f59e0b", onPress: () => router.push("/(user)/events") },
    { key: "contests", label: "Contests", Icon: ContestIcon, glow: "#a855f7", onPress: () => router.push("/(more)/competitions") },
    { key: "academy", label: "Academy", Icon: AcademyIcon, glow: "#0284c7", onPress: () => router.push("/(user)/learn") },
    { key: "shop", label: "Shop", Icon: ShopIcon, glow: "#10b981", onPress: () => router.push("/(more)/shop") },
  ];

  const [headerH, setHeaderH] = React.useState(62);

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      <StatusBar style="light" />

      {/* One ambient wash, top only (like a status-bar glow) — pinned to the
          top and fading out as you scroll, so it never follows content down. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 300,
          opacity: scrollY.interpolate({ inputRange: [0, 220], outputRange: [1, 0], extrapolate: "clamp" }),
        }}
      >
        <LinearGradient
          colors={[
            "rgba(255, 122, 48, 0.20)",
            "rgba(255, 112, 38, 0.11)",
            "rgba(255, 106, 30, 0.05)",
            "rgba(255, 106, 30, 0.015)",
            "rgba(255, 106, 30, 0)",
          ]}
          locations={[0, 0.25, 0.5, 0.75, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ flex: 1 }}
        />
      </Animated.View>

      {/* status-bar backdrop — goes solid once content scrolls under it */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          zIndex: 20,
          backgroundColor: "#000000",
          opacity: scrollY.interpolate({ inputRange: [0, headerH], outputRange: [0, 1], extrapolate: "clamp" }),
        }}
      />

      <GrandSponsorModal popup={(hp as any).grand_sponsor_popup} />

      <Animated.ScrollView
        style={{ marginTop: insets.top }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        refreshControl={<RefreshControl refreshing={refreshing || pulling} onRefresh={refreshAll} tintColor="#ff385c" colors={["#ff385c"]} />}
      >
          {/* Header — who you are on the left, what needs you on the right. */}
          <View
            onLayout={(e) => setHeaderH(Math.round(e.nativeEvent.layout.height))}
            style={{
              paddingTop: 8,
              paddingHorizontal: 20,
              paddingBottom: 6,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Pressable
              onPress={() => {
                playNavFeedback();
                router.push(user ? "/(more)/profile" : "/(auth)/login");
              }}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                flex: 1,
                marginRight: 12,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 999,
                  overflow: "hidden",
                  borderWidth: 1.5,
                  borderColor: "rgba(255, 255, 255, 0.22)",
                  backgroundColor: "#181a24",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {user?.profile_photo || user?.photo ? (
                  <AppImage uri={user.profile_photo || user.photo} style={{ width: "100%", height: "100%" }} />
                ) : (
                  <Avatar name={user?.name || "U"} size={44} />
                )}
              </View>
              <View style={{ flex: 1, justifyContent: "center" }}>
                <Txt size={11.5} font="sansMed" style={{ color: c.fgMuted }}>
                  {greeting()} 👋
                </Txt>
                <Txt
                  size={16.5}
                  font="sansBold"
                  numberOfLines={1}
                  style={{ color: "#ffffff", letterSpacing: -0.3, marginTop: 1 }}
                >
                  {user?.name ? user.name.trim().split(/\s+/)[0] : "Guest"}
                </Txt>
              </View>
            </Pressable>

            <Pressable
              onPress={() => router.push(user ? "/(more)/notifications" : "/(user)/profile")}
              hitSlop={8}
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.12)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bell size={19} color={unreadCount ? "#ff385c" : "#ffffff"} />
              {user && unreadCount ? (
                <View
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 4,
                    borderRadius: 999,
                    backgroundColor: "#ff385c",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Txt size={9} font="sansBold" style={{ color: "#fff" }}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Txt>
                </View>
              ) : null}
            </Pressable>
          </View>

        {/* Search — scrolls with the page like everything else */}
        <View style={{ paddingTop: 8, paddingBottom: 10 }}>

        <Pressable
          onPress={() => router.push("/(more)/search")}
          style={{
            marginHorizontal: 20,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            height: 50,
            borderRadius: 16,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.border,
            paddingHorizontal: 16,
          }}
        >
          <Search size={18} color={c.fgSubtle} />
          <Txt size={14} style={{ color: c.fgSubtle }}>
            Search events, competitions, artists…
          </Txt>
        </Pressable>
        </View>

        {/* Festive strip — trying Republic Day first; will switch by date (26 Jan / 15 Aug) */}
        {/* Festive strip — Republic Day around 26 Jan, Independence Day around 15 Aug */}
        <FestiveStrip />

        {/* Explore — four glossy doors */}
        <ExploreGrid items={exploreItems} />

        {/* In the spotlight */}
        <View style={{ marginTop: SECTION_GAP }}>
          <SectionHead title="In the spotlight" />
          {loading ? (
            <View style={{ paddingHorizontal: 20 }}>
              <Skeleton h={380} radius={22} />
            </View>
          ) : featured.length ? (
            <SpotlightCarousel events={featured} onOpen={(id) => router.push(`/(user)/events/${id}`)} />
          ) : null}
        </View>

        {/* Live now — urgent, so it sits high, but in the same clean grammar */}
        {/* door into the Live hub — counts straight from /live/summary */}
        <LiveNowBar refreshKey={liveKey} style={{ marginTop: SECTION_GAP }} onPress={() => router.push("/(more)/live")} />
        {liveEvents.length ? <LiveNow events={liveEvents} onOpen={openLive} /> : null}

        {/* Competitions */}
        {compRail.length ? (
          <Reveal scrollY={scrollY}>
            <View style={{ marginTop: SECTION_GAP }}>
              <SectionHead
                title="Competitions"
                sub="Open entries, auditions and live battles"
                onPress={() => router.push("/(more)/competitions")}
              />
              <PosterRail items={compRail} />
            </View>
          </Reveal>
        ) : null}

        {/* Offers for you */}
        <Reveal scrollY={scrollY}>
          <View style={{ marginTop: SECTION_GAP }}>
            <SectionHead title="Offers for you" />
            <ReferralBanner onPress={() => router.push("/(more)/rewards")} />
          </View>
        </Reveal>

        {/* Learn & level up */}
        {courses.length || workshops.length ? (
          <Reveal scrollY={scrollY}>
            <View style={{ marginTop: SECTION_GAP }}>
              <SectionHead
                title="Learn & level up"
                sub="Courses and workshops from working artists"
                onPress={() => router.push("/(user)/learn")}
              />
              <GroupedPicks groups={learnGroups} />
            </View>
          </Reveal>
        ) : null}

        {/* Partners */}
        {banners.length ? (
          <Reveal scrollY={scrollY}>
            <View style={{ marginTop: SECTION_GAP }}>
              <SectionHead title="Our partners" sub="The brands backing every stage" />
              <PartnerMarquee banners={banners} />
            </View>
          </Reveal>
        ) : null}

        {/* Gallery — the one signature moment, kept as it was */}
        {!loading ? (
          <View style={{ marginTop: SECTION_GAP }}>
            <StageBand items={galleryItems} onExplore={() => router.push("/(more)/gallery")} />
          </View>
        ) : null}

        {/* Voices */}
        {reviews.length ? (
          <Reveal scrollY={scrollY}>
            <View style={{ marginTop: SECTION_GAP }}>
              <SectionHead title="What performers say" sub="Straight from the people on our stages" />
              <VoicesHero people={reviews} />
              <View style={{ paddingTop: 14 }}>
                <AutoRail itemWidth={288}>
                  {reviews.map((t) => (
                    <VoiceCard
                      key={t._id}
                      t={t}
                      onPress={() => setSelectedReview(t)}
                    />
                  ))}
                </AutoRail>
              </View>
            </View>
          </Reveal>
        ) : null}

        {/* Numbers so far */}
        <Reveal scrollY={scrollY}>
          <View style={{ marginTop: SECTION_GAP }}>
            <SectionHead title="The numbers so far" />
            <NumbersStrip stats={stats} />
          </View>
        </Reveal>

        <View style={{ paddingHorizontal: 20 }}>
          <BrandFooter />
        </View>
      </Animated.ScrollView>

      {/* Full-Screen Performer Review Detail Modal */}
      <ReviewDetailModal
        item={selectedReview}
        onClose={() => setSelectedReview(null)}
      />
    </View>
  );
}
