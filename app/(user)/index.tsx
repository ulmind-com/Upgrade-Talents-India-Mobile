import React, { useRef, useState } from "react";
import { View, Pressable, ScrollView, RefreshControl, Dimensions, Animated, Linking, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ticket, ChevronRight, ArrowUpRight, Star, Bell, Sun, Moon, Search, MapPin, ChevronDown, CalendarDays, Trophy, GraduationCap, Sparkles, Users, Wrench, ShoppingBag, Gift, Flame } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { publicApi, extrasApi, publicCompetitionsApi, featuredApi, safe, seatsLeft, type HomepagePayload, type EventItem, type ContestPromotion } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Badge, Card, SectionLabel, Skeleton, Glow, IconButton } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { Avatar } from "@/components/Avatar";
import { CourseCard } from "@/components/domain";
import { FadeInUp } from "@/components/FadeInUp";
import { useIntro, Intro, Reveal, Sheen, Drift } from "@/components/motion";
import { SpotlightCarousel } from "@/components/SpotlightCarousel";
import { LocationPickerModal, useUserLocation, type LocationInfo } from "@/components/LocationPickerModal";
import { GrandSponsorModal } from "@/components/GrandSponsorModal";
import { ExploreSection } from "@/components/ExploreSection";
import { StageBand, type GalleryItem } from "@/components/StageBand";
import { PartnerMarquee, ReviewCard, ContestBand } from "@/components/showcase";
import { LiveVotingBand } from "@/components/LiveVoting";
import { FeaturedTiles } from "@/components/FeaturedTiles";
import { liveVotingRows } from "@/lib/competition";
import { publishedInOrder, visible } from "@/lib/live";
import { StatsRun } from "@/components/StatsRun";
import { DottedGrid, WaveBand } from "@/components/patterns";
import { LiveNow } from "@/components/LiveNow";
import { formatEventDate, formatINR, initials, splitDate } from "@/lib/format";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = SCREEN_W - 40;
const CARD_GAP = 14;
/* The testimonials band runs cool, so it reads as its own chapter between the
   warm sections on either side. */
const HYPE = ["#0b1b3a", "#102a52", "#160f3a"];
/* The Academy band carves its wave straight out of the stage band above it, so
   the navy runs all the way down into the curve with no strip of page between. */
const ACADEMY_WAVE = 26;

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

export default function Home() {
  const { c, toggle, name } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { location, saveLocation } = useUserLocation();
  const [locModalOpen, setLocModalOpen] = useState(false);
  const { data, loading, refreshing, refresh } = useAsync(() => safe(publicApi.homepage(), EMPTY), []);
  const hp = data || EMPTY;
  const scrollY = useRef(new Animated.Value(0)).current;
  const intro = useIntro();
  const unread = useAsync(
    () => (user ? safe(extrasApi.unreadCount(), { unread_count: 0 } as any) : Promise.resolve({ unread_count: 0 } as any)),
    [user?.email],
    { refetchOnFocus: true }
  );
  const unreadCount = Number(unread.data?.unread_count ?? 0);

  /* "Voting live" is the server's call, not something the homepage payload
     knows — contest_promotions are banners, with no poll state on them. */
  const lv = useAsync(
    () => (user ? safe(publicCompetitionsApi.liveVoting(), null) : Promise.resolve(null)),
    [user?.email],
    { refetchOnFocus: true }
  );
  const livePolls = React.useMemo(() => liveVotingRows(lv.data), [lv.data]);

  const tilesQ = useAsync(() => safe(featuredApi.tiles(), [] as any), []);
  const tiles = React.useMemo(() => publishedInOrder(Array.isArray(tilesQ.data) ? tilesQ.data : []), [tilesQ.data]);

  /* A banner says where it goes: a real competition first, then an explicit
     link, and only then the generic list. */
  const openContest = (p: ContestPromotion) => {
    if (p.competition_id) return router.push(`/(more)/competitions/${p.competition_id}`);
    const url = p.target_url || "";
    if (/^https?:/i.test(url)) Linking.openURL(url).catch(() => {});
    else router.push("/(more)/competitions");
  };

  /* The stream lives at `public_url`; sending the user to the events list
     instead would quietly drop what the admin published. */
  const openLive = (ev: { public_url?: string }) => {
    const url = ev.public_url || "";
    if (/^https?:/i.test(url)) Linking.openURL(url).catch(() => router.push("/(user)/events"));
    else router.push("/(user)/events");
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

  const galleryItems: GalleryItem[] = [
    ...events.map((e) => ({ uri: e.image_url, label: e.title })),
    ...banners.map((b) => ({ uri: b.image_url, label: b.sponsor_name || b.title })),
  ];
  const GENERIC = ["Live on stage", "The crowd", "Backstage", "Centre spotlight"];
  while (galleryItems.length < 3) galleryItems.push({ uri: null, label: GENERIC[galleryItems.length % GENERIC.length] });

  const quickCategories = [
    { label: "Workshops", icon: GraduationCap, tone: "#38bdf8", badge: "Live", onPress: () => router.push("/(user)/learn") },
    { label: "Courses", icon: GraduationCap, tone: "#c084fc", onPress: () => router.push("/(user)/learn") },
    { label: "Shop", icon: ShoppingBag, tone: "#f472b6", badge: "New", onPress: () => router.push("/(more)/shop") },
    { label: "Leaderboard", icon: Trophy, tone: "#fbbf24", onPress: () => router.push("/(more)/leaderboard") },
    { label: "Rewards", icon: Gift, tone: "#4ade80", badge: "Coins", onPress: () => router.push("/(more)/rewards") },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: "#08090c" }}>
      <StatusBar style="light" />

      {/* Top Ambient Violet/Purple Mesh Radial Glow (matching Zomato District screenshot) */}
      <LinearGradient
        colors={["rgba(139, 92, 246, 0.28)", "rgba(88, 28, 135, 0.12)", "transparent"]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 260 }}
        pointerEvents="none"
      />

      {/* Location Picker Modal */}
      <LocationPickerModal
        visible={locModalOpen}
        current={location}
        onSelect={saveLocation}
        onClose={() => setLocModalOpen(false)}
      />

      {/* Grand Sponsor Announcement Modal */}
      <GrandSponsorModal popup={(hp as any).grand_sponsor_popup} />

      {/* Top Bar Header (District style with Location Selector & Profile) */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 10,
        }}
      >
        {/* Location selector */}
        <Pressable
          onPress={() => setLocModalOpen(true)}
          hitSlop={8}
          style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
        >
          <MapPin size={22} color="#ffffff" strokeWidth={2.4} />
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <Txt size={17} font="sansBold" style={{ color: "#ffffff", letterSpacing: -0.3 }}>
                {location.area}
              </Txt>
              <ChevronDown size={15} color="#ffffff" strokeWidth={2.4} />
            </View>
            <Txt size={12} font="sansMed" style={{ color: "#9ea3b8", marginTop: 1 }}>
              {location.city}
            </Txt>
          </View>
        </Pressable>

        {/* Right side: Notifications & Avatar */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={() => router.push(user ? "/(more)/notifications" : "/(user)/profile")}
            hitSlop={8}
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.12)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Bell size={18} color={unreadCount ? "#ff385c" : "#ffffff"} />
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

          <Pressable
            onPress={() => router.push("/(user)/profile")}
            hitSlop={8}
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              overflow: "hidden",
              borderWidth: 1.5,
              borderColor: "rgba(255, 255, 255, 0.22)",
              backgroundColor: "#181a24",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {user?.photo ? (
              <AppImage uri={user.photo} style={{ width: "100%", height: "100%" }} />
            ) : (
              <Avatar name={user?.name || "U"} size={36} />
            )}
          </Pressable>
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 130 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#ff385c" colors={["#ff385c"]} />}
      >
        {/* Search Input Bar */}
        <Pressable
          onPress={() => router.push("/(more)/search")}
          style={{
            marginHorizontal: 20,
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            height: 48,
            borderRadius: 16,
            backgroundColor: "#13151d",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.08)",
            paddingHorizontal: 16,
          }}
        >
          <Search size={18} color="#6b728a" />
          <Txt size={14} style={{ color: "#6b728a" }}>
            Search events, competitions, artists…
          </Txt>
        </Pressable>

        {/* 1. Explore Section (Cards side-by-side: Contests & Events + Quick categories) */}
        <ExploreSection
          onOpenCompetitions={() => router.push("/(more)/competitions")}
          onOpenEvents={() => router.push("/(user)/events")}
          quickActions={quickCategories}
        />

        {/* 2. In the spotlight Section (Snapping Hero Slider) */}
        <View style={{ marginTop: 26 }}>
          <View style={{ paddingHorizontal: 20 }}>
            <Txt size={21} font="sansBold" style={{ color: "#ffffff", letterSpacing: -0.4 }}>
              In the spotlight
            </Txt>
          </View>

          {loading ? (
            <View style={{ paddingHorizontal: 20, marginTop: 14 }}>
              <Skeleton h={380} radius={22} />
            </View>
          ) : featured.length ? (
            <SpotlightCarousel
              events={featured}
              onOpen={(id) => router.push(`/(user)/events/${id}`)}
            />
          ) : null}
        </View>

        {/* Spotlight curated tiles (if any) */}
        {tiles.length ? (
          <Reveal scrollY={scrollY}>
            <FeaturedTiles tiles={tiles} />
          </Reveal>
        ) : null}

        {/* Live Now broadcast strip */}
        {liveEvents.length ? <LiveNow events={liveEvents} onOpen={openLive} /> : null}

        {/* Live Voting Section */}
        {livePolls.length ? (
          <Reveal scrollY={scrollY}>
            <LiveVotingBand
              rows={livePolls}
              compact
              title="Voting is open"
              onOpen={(id) => router.push(`/(more)/competitions/${id}`)}
            />
          </Reveal>
        ) : null}

        {/* Competitions Promo Banners */}
        <Reveal scrollY={scrollY}>
          <ContestBand items={promos} onEnter={openContest} onLeaderboard={() => router.push("/(more)/leaderboard")} />
        </Reveal>

        {/* 3. Upcoming Events Section (with chevron > and subtitle) */}
        <Reveal scrollY={scrollY}>
          <View style={{ marginTop: 28, paddingHorizontal: 20 }}>
            <Pressable
              onPress={() => router.push("/(user)/events")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Txt size={20} font="sansBold" style={{ color: "#ffffff", letterSpacing: -0.3 }}>
                  Upcoming events
                </Txt>
                <ChevronRight size={18} color="#ffffff" strokeWidth={2.4} />
              </View>
              <Txt size={12.5} font="sansBold" style={{ color: "#ff385c" }}>
                See all
              </Txt>
            </Pressable>
            <Txt size={12.5} style={{ color: "#9ea3b8", marginBottom: 16 }}>
              Latest trailers & live events you'll love
            </Txt>

            {loading ? (
              <View style={{ gap: 12 }}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} h={92} radius={20} />
                ))}
              </View>
            ) : events.length ? (
              <View style={{ gap: 12 }}>
                {events.slice(0, 5).map((ev, i) => (
                  <FadeInUp key={ev._id} delay={i * 60}>
                    <EventRow ev={ev} index={i} onPress={() => router.push(`/(user)/events/${ev._id}`)} />
                  </FadeInUp>
                ))}
              </View>
            ) : (
              <Txt size={14} tone="muted">
                No upcoming events yet — check back soon.
              </Txt>
            )}
          </View>
        </Reveal>

        {/* Stage Band Gallery */}
        {!loading ? (
          <StageBand
            items={galleryItems}
            onExplore={() => router.push("/(more)/gallery")}
            bottomBleed={courses.length ? ACADEMY_WAVE : 0}
          />
        ) : null}

        {/* Academy Section: Courses & Workshops */}
        {courses.length ? (
          <WaveBand
            color="#0e1017"
            wave={ACADEMY_WAVE}
            style={{ marginTop: -ACADEMY_WAVE }}
            backdrop={<DottedGrid color="#ff385c" opacity={0.12} />}
          >
            <View
              style={{
                paddingHorizontal: 20,
                marginBottom: 16,
                flexDirection: "row",
                alignItems: "flex-end",
                justifyContent: "space-between",
              }}
            >
              <View>
                <View
                  style={{
                    alignSelf: "flex-start",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: "rgba(255, 56, 92, 0.15)",
                    borderColor: "rgba(255, 56, 92, 0.35)",
                    borderWidth: 1,
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    marginBottom: 10,
                  }}
                >
                  <GraduationCap size={13} color="#ff385c" />
                  <Txt size={10.5} font="sansBold" style={{ color: "#ff385c" }} tracking={1.5} uppercase>
                    Academy
                  </Txt>
                </View>
                <Txt size={23} font="display" tracking={-0.5} style={{ color: "#ffffff" }}>
                  Sharpen your craft
                </Txt>
              </View>
              <Pressable
                onPress={() => router.push("/(user)/learn")}
                hitSlop={8}
                style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
              >
                <Txt size={12.5} font="sansBold" style={{ color: "#ff385c" }} uppercase tracking={1}>
                  All
                </Txt>
                <ChevronRight size={16} color="#ff385c" />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={272}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
            >
              {courses.slice(0, 6).map((it, i) => (
                <ShelfCourseCard key={it._id} item={it} index={i} onPress={() => router.push(`/(more)/learn/${it._id}?kind=course`)} />
              ))}
            </ScrollView>

            {/* Workshops */}
            {workshops.length ? (
              <>
                <View
                  style={{
                    paddingHorizontal: 20,
                    marginTop: 22,
                    marginBottom: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Wrench size={14} color="#9ea3b8" />
                  <Txt size={11} font="monoMed" style={{ color: "#9ea3b8" }} tracking={2.5} uppercase>
                    Workshops
                  </Txt>
                  <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255, 255, 255, 0.08)" }} />
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={272}
                  decelerationRate="fast"
                  contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
                >
                  {workshops.slice(0, 6).map((it, i) => (
                    <ShelfCourseCard key={it._id} item={it} index={i + 3} onPress={() => router.push(`/(more)/learn/${it._id}?kind=workshop`)} />
                  ))}
                </ScrollView>
              </>
            ) : null}
          </WaveBand>
        ) : null}

        {/* Stats */}
        <StatsRun
          eventCount={events.length}
          courseCount={courses.length + workshops.length}
          scrollY={scrollY}
        />

        {/* Reviews */}
        {reviews.length ? (
          <Reveal scrollY={scrollY} y={36}>
            <WaveBand
              color={HYPE[0]}
              bottomColor={HYPE[2]}
              flip
              paddingTop={26}
              paddingBottom={26}
              style={{ marginTop: 28 }}
              backdrop={
                <>
                  <LinearGradient colors={HYPE as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", width: "100%", height: "100%" }} />
                  <DottedGrid color="#9fe7ff" opacity={0.08} gap={24} r={1.1} />
                  <Glow color="#3ec6f5" size={240} top={-70} left={-90} />
                  <Glow color="#7c5cff" size={210} top={150} right={-80} />
                </>
              }
            >
              <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <View style={{ flexDirection: "row", gap: 1 }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} size={13} color="#ffb300" fill="#ffb300" />
                    ))}
                  </View>
                  <Txt size={11} font="monoMed" tracking={2.5} uppercase style={{ color: "#7fe3ff" }}>
                    The hype
                  </Txt>
                </View>
                <Txt size={26} font="display" tracking={-0.5} style={{ color: "#fff", marginTop: 8 }}>
                  Loved by performers
                </Txt>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={302}
                decelerationRate="fast"
                contentContainerStyle={{ gap: 12, paddingHorizontal: 20 }}
              >
                {reviews.map((t) => (
                  <ReviewCard key={t._id} t={t} />
                ))}
              </ScrollView>
            </WaveBand>
          </Reveal>
        ) : null}

        {/* Partners Marquee */}
        {banners.length ? (
          <Reveal scrollY={scrollY} style={{ marginTop: 30 }}>
            <View>
              <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                <SectionLabel>The squad</SectionLabel>
                <Txt size={23} font="display" tracking={-0.5} style={{ marginTop: 8 }}>
                  Backed by the best
                </Txt>
              </View>
              <PartnerMarquee banners={banners} />
              <View style={{ height: 10 }} />
              <PartnerMarquee banners={banners} reverse />
            </View>
          </Reveal>
        ) : null}
      </Animated.ScrollView>
    </View>
  );
}

/* ── Featured snapping carousel ── */
function FeaturedCarousel({ events, onOpen }: { events: EventItem[]; onOpen: (id: string) => void }) {
  const { c } = useTheme();
  const [idx, setIdx] = useState(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / (CARD_W + CARD_GAP));
    if (i !== idx) setIdx(i);
  };
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 20, gap: CARD_GAP }}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {events.map((ev, i) => {
          const d = splitDate(ev.date);
          return (
            <Pressable key={ev._id} onPress={() => onOpen(ev._id)} style={{ width: CARD_W }}>
              <View style={{ height: 380, borderRadius: 28, overflow: "hidden" }}>
                <AppImage uri={ev.image_url} seed={ev._id || i} style={{ width: "100%", height: "100%" }} />
                <LinearGradient colors={["rgba(4,5,12,0.1)", "transparent", "rgba(4,5,12,0.55)", "rgba(4,5,12,0.95)"] as any} locations={[0, 0.35, 0.7, 1]} style={{ position: "absolute", width: "100%", height: "100%" }} />
                {/* date chip */}
                <View style={{ position: "absolute", top: 16, left: 16, alignItems: "center", backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 }}>
                  <Txt size={22} font="display" style={{ color: "#fff" }} lh={24}>{d.day}</Txt>
                  <Txt size={10} font="sansBold" style={{ color: "rgba(255,255,255,0.8)" }} tracking={1.5}>{d.month}</Txt>
                </View>
                <View style={{ position: "absolute", top: 16, right: 16, flexDirection: "row", gap: 8 }}>
                  {ev.event_status === "live" ? <Badge label="Live now" tone="live" /> : <Badge label="Upcoming" tone="brand" />}
                </View>
                <View style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
                  <Txt size={26} font="display" tracking={-0.5} lh={28} style={{ color: "#fff" }} numberOfLines={2}>{ev.title}</Txt>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 }}>
                    {ev.venue ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <MapPin size={14} color="rgba(255,255,255,0.85)" />
                        <Txt size={13} style={{ color: "rgba(255,255,255,0.85)" }} numberOfLines={1}>{ev.venue}</Txt>
                      </View>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
                    <Txt size={20} font="sansExt" style={{ color: "#fff" }}>{formatINR(ev.price)}</Txt>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderRadius: 999, paddingHorizontal: 18, height: 44 }}>
                      <Ticket size={16} color="#111" />
                      <Txt size={13.5} font="sansBold" style={{ color: "#111" }} uppercase tracking={1}>Book</Txt>
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      {/* dots */}
      {events.length > 1 ? (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 14 }}>
          {events.map((_, i) => (
            <View key={i} style={{ width: i === idx ? 20 : 7, height: 7, borderRadius: 999, backgroundColor: i === idx ? c.accent : c.border }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/* ── Compact event row ── */
function EventRow({ ev, index = 0, onPress }: { ev: EventItem; index?: number; onPress: () => void }) {
  const { c } = useTheme();
  const d = splitDate(ev.date);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {/* big Gen-Z index */}
        <Txt size={38} font="display" style={{ color: c.fgSubtle, width: 36, textAlign: "center", opacity: 0.5 }}>{String(index + 1).padStart(2, "0")}</Txt>

        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: c.surface, borderRadius: 22, borderWidth: 1, borderColor: c.border, padding: 10 }}>
          <View style={{ width: 78, height: 78, borderRadius: 18, overflow: "hidden" }}>
            <AppImage uri={ev.image_url} seed={ev._id} style={{ width: "100%", height: "100%" }} />
          </View>
          <View style={{ flex: 1, gap: 7 }}>
            <Txt size={16} font="sansExt" numberOfLines={1}>{ev.title}</Txt>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              <View style={{ backgroundColor: c.accent + "22", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
                <Txt size={10.5} font="sansBold" tone="accent" tracking={0.5}>{d.day} {d.month}</Txt>
              </View>
              {ev.venue ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: c.surface2, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, maxWidth: 130 }}>
                  <MapPin size={10} color={c.fgSubtle} />
                  <Txt size={10.5} font="sansSemi" tone="muted" numberOfLines={1}>{ev.venue}</Txt>
                </View>
              ) : null}
            </View>
            <Txt size={16} font="sansExt" tone="accent">{formatINR(ev.price)}</Txt>
          </View>
          <View style={{ width: 38, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            <LinearGradient colors={c.gradBrand as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", width: "100%", height: "100%" }} />
            <ArrowUpRight size={18} color="#fff" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/* ── Gen-Z course card (home shelf) ── */
function ShelfCourseCard({ item, index = 0, onPress }: { item: any; index?: number; onPress: () => void }) {
  const { c } = useTheme();
  const open = item.registration_status === "OPEN";
  const statusTone = open ? c.success : c.warning;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <View style={{ width: 260, borderRadius: 24, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
        <View style={{ height: 148 }}>
          <AppImage uri={item.thumbnail} seed={item._id || index} style={{ width: "100%", height: "100%" }} />
          <LinearGradient colors={["rgba(4,5,12,0.05)", "transparent", "rgba(4,5,12,0.9)"] as any} locations={[0, 0.4, 1]} style={{ position: "absolute", width: "100%", height: "100%" }} />
          <View style={{ position: "absolute", top: 12, left: 12, backgroundColor: c.accent, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Txt size={9.5} font="sansBold" style={{ color: c.onAccent, letterSpacing: 1 }}>{item.course_type === "workshop" ? "WORKSHOP" : "COURSE"}</Txt>
          </View>
          {item.registration_status ? (
            <View style={{ position: "absolute", top: 12, right: 12, backgroundColor: statusTone + "EE", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
              <Txt size={9.5} font="sansBold" style={{ color: "#fff", letterSpacing: 0.5 }}>{open ? "OPEN" : item.registration_status}</Txt>
            </View>
          ) : null}
          <View style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
            <Txt size={17} font="heroSemi" lh={21} numberOfLines={2} style={{ color: "#fff" }}>{item.title}</Txt>
          </View>
        </View>
        <View style={{ padding: 14, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
              <View style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }}>
                <Txt size={12} font="sansBold" tone="accent">{initials(item.instructor_name)}</Txt>
              </View>
              <Txt size={12.5} font="sansSemi" tone="muted" numberOfLines={1} style={{ flex: 1 }}>{item.instructor_name || "Instructor"}</Txt>
            </View>
            {seatsLeft(item) !== null ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                <Users size={12} color={c.fgSubtle} />
                <Txt size={11} tone="subtle">{seatsLeft(item) === 0 ? "Full" : seatsLeft(item)}</Txt>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View>
              <Txt size={9.5} font="monoMed" tone="subtle" tracking={1} uppercase>Fee</Txt>
              <Txt size={18} font="sansExt" tone="accent">{formatINR(item.price)}</Txt>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, overflow: "hidden", paddingHorizontal: 15, height: 38 }}>
              <LinearGradient colors={c.gradBrand as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", width: "100%", height: "100%" }} />
              <Txt size={12.5} font="sansBold" style={{ color: c.onAccent }} uppercase tracking={0.5}>Enroll</Txt>
              <ArrowUpRight size={15} color={c.onAccent} />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/* ── Section wrapper ── */
function Section({ title, onMore, children }: { title: string; onMore?: () => void; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ marginTop: 28, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <Txt size={19} font="display" tracking={-0.5}>{title}</Txt>
        {onMore ? (
          <Pressable onPress={onMore} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <Txt size={12.5} font="sansBold" tone="accent" uppercase tracking={1}>See all</Txt>
            <ChevronRight size={16} color={c.accent} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}
