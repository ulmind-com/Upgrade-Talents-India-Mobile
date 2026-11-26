import React, { useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  Receipt,
  Gift,
  Award,
  Bell,
  Trophy,
  UserCog,
  Package,
  Image as ImageIcon,
  Phone,
  Settings,
  Sun,
  Moon,
  LogOut,
  LogIn,
  ChevronRight,
  ShoppingBag,
  Crown,
  ShieldCheck,
  BadgeCheck,
  BarChart3,
  Gavel,
  HandHeart,
  Info,
  CalendarClock,
  MapPin,
  QrCode,
  Search,
  Radio,
  Flame,
  ArrowUpRight,
  Sparkles,
  Share2,
} from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { bookingsApi, extrasApi, publicApi, safe, toRows } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Card, Button, Divider } from "@/components/ui";
import { ShareSheet } from "@/components/ShareSheet";
import { FadeInUp } from "@/components/FadeInUp";
import { Avatar } from "@/components/Avatar";
import { VerifiedTick, VerifiedName } from "@/components/VerifiedBadge";
import { CopyCode } from "@/components/CopyCode";
import { isEventExpired, formatEventDate } from "@/lib/format";
import { LiveStageLineupModal } from "@/components/LiveStageLineupModal";
import { BrandFooter } from "@/components/BrandFooter";
import { InstagramCard } from "@/components/InstagramCard";
import { playNavFeedback } from "@/lib/sound";

export default function Profile() {
  const { c, name, toggle } = useTheme();
  const router = useRouter();
  const { user, logoutUser, setMode } = useSession();

  const [lineupModalOpen, setLineupModalOpen] = useState(false);
  const [selectedComp, setSelectedComp] = useState<{ id: string; title: string } | null>(null);

  const comps = useAsync(() => safe(publicApi.competitions(), []), []);
  const compList = toRows(comps.data);

  const tickets = useAsync(() => (user ? safe(bookingsApi.myTickets(), []) : Promise.resolve([])), [user?.email]);
  const bookings = useAsync(() => (user ? safe(bookingsApi.my(), []) : Promise.resolve([])), [user?.email]);
  const rewards = useAsync(() => (user ? safe(extrasApi.rewards(), null) : Promise.resolve(null)), [user?.email]);
  const points = (rewards.data as any)?.balance ?? (rewards.data as any)?.points ?? (rewards.data as any)?.total ?? 0;

  const nextUp = React.useMemo(() => {
    const list = Array.isArray(tickets.data) ? tickets.data : [];
    return (
      list
        .filter((t: any) => t.event_date && !isEventExpired(t.event_date, t.event_time))
        .sort((a: any, b: any) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())[0] || null
    );
  }, [tickets.data]);

  const openLineup = () => {
    playNavFeedback();
    const active = compList[0];
    if (active) {
      setSelectedComp({ id: active._id || active.id, title: active.title || active.name || "Live Stage" });
    } else {
      setSelectedComp({ id: "live", title: "Live Stage Lineup" });
    }
    setLineupModalOpen(true);
  };

  const nav = (route: string) => {
    playNavFeedback();
    router.push(route as any);
  };

  const [shareAppOpen, setShareAppOpen] = useState(false);

  const handleShareApp = () => {
    playNavFeedback();
    setShareAppOpen(true);
  };

  const navWithAuth = (route: string) => {
    playNavFeedback();
    if (!user) {
      router.push("/(auth)/login");
      return;
    }
    router.push(route as any);
  };

  return (
    <Screen
      refreshing={tickets.refreshing}
      contentStyle={{ paddingTop: 16 }}
      onRefresh={() => {
        tickets.refresh();
        bookings.refresh();
        rewards.refresh();
      }}
    >
      {/* 1. Header Identity: Logged-in Profile OR Guest Account Card */}
      {user ? (
        <FadeInUp>
          <View
            style={{
              borderRadius: 24,
              backgroundColor: "#13151D",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.09)",
              padding: 18,
              marginBottom: 16,
              overflow: "hidden",
            }}
          >
            {/* Ambient luxury glow overlay */}
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(255, 56, 92, 0.1)", "rgba(139, 92, 246, 0.05)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: "absolute", top: 0, left: 0, right: 0, height: 160 }}
            />

            {/* Clickable Header Identity: Logged-in Profile */}
            <Pressable
              onPress={() => nav("/(more)/profile")}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 13 }}>
                <Avatar
                  name={user?.name}
                  photo={user?.profile_photo}
                  size={62}
                  fontSize={22}
                  border={{ width: 2, color: "#FF385C" }}
                  style={{ backgroundColor: "#1f2230" }}
                />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <VerifiedName name={user?.name || "Dancer"} row={user} size={18} lh={23} numberOfLines={2} style={{ color: "#ffffff" }} />
                  <Txt size={12} style={{ color: "#9ea3b8", marginTop: 2 }} numberOfLines={1}>
                    {user?.email}
                  </Txt>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        backgroundColor: "rgba(201, 242, 74, 0.12)",
                        borderWidth: 1,
                        borderColor: "rgba(201, 242, 74, 0.25)",
                        paddingHorizontal: 8,
                        paddingVertical: 2.5,
                        borderRadius: 999,
                      }}
                    >
                      <BadgeCheck size={11} color="#C9F24A" />
                      <Txt size={9.5} font="sansBold" style={{ color: "#C9F24A" }}>
                        {user?.is_verified ? "VERIFIED MEMBER" : "MEMBER"}
                      </Txt>
                    </View>

                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                        backgroundColor: "rgba(255, 56, 92, 0.12)",
                        borderWidth: 1,
                        borderColor: "rgba(255, 56, 92, 0.28)",
                        paddingHorizontal: 8,
                        paddingVertical: 2.5,
                        borderRadius: 999,
                      }}
                    >
                      <Txt size={9.5} font="sansBold" style={{ color: "#FF385C" }}>
                        View Profile →
                      </Txt>
                    </View>
                  </View>
                </View>
              </View>

              {/* View profile chevron button */}
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.14)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronRight size={18} color="#ffffff" />
              </View>
            </Pressable>

            {/* Stat Chips Row */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
              {[
                { label: "Tickets", value: tickets.data?.length ?? 0, route: "/(user)/tickets" },
                { label: "Bookings", value: bookings.data?.length ?? 0, route: "/(more)/bookings" },
                { label: "Coins", value: points, route: "/(more)/rewards" },
              ].map((s) => (
                <Pressable
                  key={s.label}
                  onPress={() => nav(s.route)}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: "#0d0f15",
                    borderRadius: 15,
                    paddingVertical: 12,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  })}
                >
                  <Txt size={20} font="sansBold" style={{ color: "#ffffff" }}>
                    {s.value}
                  </Txt>
                  <Txt size={10} font="monoMed" style={{ color: "#9ea3b8", letterSpacing: 1.2, marginTop: 2 }} uppercase>
                    {s.label}
                  </Txt>
                </Pressable>
              ))}
            </View>
          </View>
        </FadeInUp>
      ) : (
        <FadeInUp>
          <View
            style={{
              borderRadius: 24,
              backgroundColor: "#13151D",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.09)",
              padding: 18,
              marginBottom: 16,
              overflow: "hidden",
            }}
          >
            {/* Ambient luxury glow overlay */}
            <LinearGradient
              pointerEvents="none"
              colors={["rgba(255, 56, 92, 0.1)", "rgba(139, 92, 246, 0.05)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: "absolute", top: 0, left: 0, right: 0, height: 160 }}
            />

            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: "rgba(255, 56, 92, 0.12)",
                  borderWidth: 1.5,
                  borderColor: "rgba(255, 56, 92, 0.4)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sparkles size={24} color="#FF385C" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Txt size={18} font="sansBold" style={{ color: "#ffffff" }} numberOfLines={1}>
                  Guest Explorer
                </Txt>
                <Txt size={12} style={{ color: "#9ea3b8", marginTop: 2 }}>
                  Sign in to view your tickets, bookings & rewards
                </Txt>
              </View>
            </View>

            {/* Quick Auth Actions */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Button
                label="Sign In"
                onPress={() => nav("/(auth)/login")}
                style={{ flex: 1 }}
                size="sm"
                icon={<LogIn size={15} color="#ffffff" />}
              />
              <Button
                label="Register"
                variant="outline"
                onPress={() => nav("/(auth)/register")}
                style={{ flex: 1 }}
                size="sm"
              />
            </View>

            {/* Guest Stat Chips */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              {[
                { label: "Tickets", value: "0", route: "/(auth)/login" },
                { label: "Bookings", value: "0", route: "/(auth)/login" },
                { label: "Coins", value: "0", route: "/(auth)/login" },
              ].map((s) => (
                <Pressable
                  key={s.label}
                  onPress={() => nav(s.route)}
                  style={({ pressed }) => ({
                    flex: 1,
                    backgroundColor: "#0d0f15",
                    borderRadius: 14,
                    paddingVertical: 10,
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  })}
                >
                  <Txt size={18} font="sansBold" style={{ color: "rgba(255, 255, 255, 0.5)" }}>
                    {s.value}
                  </Txt>
                  <Txt size={9.5} font="monoMed" style={{ color: "#6b728a", letterSpacing: 1, marginTop: 2 }} uppercase>
                    {s.label}
                  </Txt>
                </Pressable>
              ))}
            </View>
          </View>
        </FadeInUp>
      )}

      {/* 2. Next Up Event Banner (if logged in with upcoming ticket) */}
      {user && nextUp && (
        <FadeInUp delay={40}>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/(more)/ticket/[ref]",
                params: {
                  ref: nextUp.ticket_ref,
                  type: nextUp.ticket_type,
                  holder: nextUp.holder_name,
                  issued: nextUp.issued_at,
                  checked: nextUp.is_checked_in ? "1" : "0",
                  event_id: nextUp.event_id,
                },
              })
            }
            style={({ pressed }) => ({ marginBottom: 14, transform: [{ scale: pressed ? 0.985 : 1 }] })}
          >
            <View
              style={{
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "rgba(255, 56, 92, 0.3)",
                backgroundColor: "#14161E",
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: "rgba(255, 56, 92, 0.15)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CalendarClock size={20} color="#FF385C" />
              </View>
              <View style={{ flex: 1 }}>
                <Txt size={10} font="monoMed" style={{ color: "#FF385C", letterSpacing: 1.5 }} uppercase>
                  Next pass up
                </Txt>
                <Txt size={15} font="sansBold" style={{ color: "#ffffff", marginTop: 2 }} numberOfLines={1}>
                  {nextUp.event_title || "Upcoming event"}
                </Txt>
                <Txt size={11.5} style={{ color: "#9ea3b8", marginTop: 2 }}>
                  {formatEventDate(nextUp.event_date)}
                </Txt>
              </View>
              <QrCode size={18} color="#9ea3b8" />
            </View>
          </Pressable>
        </FadeInUp>
      )}

      {/* 3. Live Stage Lineup Quick Bar (Available to everyone) */}
      <FadeInUp delay={60}>
        <Pressable
          onPress={openLineup}
          style={({ pressed }) => ({ marginBottom: 16, transform: [{ scale: pressed ? 0.985 : 1 }] })}
        >
          <View
            style={{
              borderRadius: 20,
              borderWidth: 1,
              borderColor: "rgba(139, 92, 246, 0.35)",
              backgroundColor: "rgba(139, 92, 246, 0.1)",
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: "rgba(139, 92, 246, 0.25)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Radio size={20} color="#C9F24A" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Txt size={10} font="monoMed" style={{ color: "#C9F24A", letterSpacing: 1.5 }} uppercase>
                  Stage Lineup
                </Txt>
                <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: "#C9F24A" }} />
              </View>
              <Txt size={14} font="sansBold" style={{ color: "#ffffff", marginTop: 1 }}>
                Live Queue & Callouts
              </Txt>
            </View>
            <ChevronRight size={18} color="#9ea3b8" />
          </View>
        </Pressable>
      </FadeInUp>

      {/* 4. Referral Code Box (if logged in with referral code) */}
      {user?.referral_code && (
        <FadeInUp delay={70}>
          <View style={{ marginBottom: 16 }}>
            <CopyCode code={String(user.referral_code)} />
          </View>
        </FadeInUp>
      )}

      {/* 5. District Group 1: Bookings & Merchandise (Visible to all) */}
      <FadeInUp delay={80}>
        <View style={{ marginBottom: 16 }}>
          <Txt size={11} font="monoMed" style={{ color: "#6b728a", letterSpacing: 2, marginBottom: 8 }} uppercase>
            Orders & Tickets
          </Txt>
          <View style={cardContainerStyle}>
            <MenuRow Icon={QrCode} label="My tickets & passes" onPress={() => navWithAuth("/(user)/tickets")} />
            <MenuRow Icon={CalendarClock} label="My events" onPress={() => navWithAuth("/(more)/my-activity?tab=events")} />
            <MenuRow Icon={Receipt} label="My bookings" onPress={() => navWithAuth("/(more)/bookings")} />
            <MenuRow Icon={Package} label="My merchandise orders" onPress={() => navWithAuth("/(more)/shop/orders")} />
            <MenuRow Icon={Crown} label="VIP backstage passes" onPress={() => nav("/(more)/vip")} />
            <MenuRow Icon={ShoppingBag} label="Merch store" onPress={() => nav("/(more)/shop")} last />
          </View>
        </View>
      </FadeInUp>

      {/* 6. District Group 2: Competitions & Achievements (Visible to all) */}
      <FadeInUp delay={90}>
        <View style={{ marginBottom: 16 }}>
          <Txt size={11} font="monoMed" style={{ color: "#6b728a", letterSpacing: 2, marginBottom: 8 }} uppercase>
            Talent & Compete
          </Txt>
          <View style={cardContainerStyle}>
            <MenuRow Icon={UserCog} label="My profile" onPress={() => navWithAuth("/(more)/profile")} />
            <MenuRow Icon={Trophy} label="Competitions hub" onPress={() => nav("/(more)/competitions")} />
            <MenuRow Icon={Flame} label="My competitions" onPress={() => navWithAuth("/(more)/my-activity?tab=competitions")} />
            <MenuRow Icon={BarChart3} label="Live leaderboard" onPress={() => nav("/(more)/leaderboard")} />
            <MenuRow Icon={Award} label="My certificates & badges" onPress={() => navWithAuth("/(more)/certificates")} />
            <MenuRow Icon={ShieldCheck} label="Verify certificate" onPress={() => nav("/(more)/verify")} last />
          </View>
        </View>
      </FadeInUp>

      {/* 7. District Group 3: Perks & Community (Visible to all) */}
      <FadeInUp delay={100}>
        <View style={{ marginBottom: 16 }}>
          <Txt size={11} font="monoMed" style={{ color: "#6b728a", letterSpacing: 2, marginBottom: 8 }} uppercase>
            Rewards & Tools
          </Txt>
          <View style={cardContainerStyle}>
            <MenuRow Icon={Gift} label="Rewards & referral coins" onPress={() => nav("/(more)/rewards")} />
            <MenuRow Icon={Bell} label="Notifications" onPress={() => navWithAuth("/(more)/notifications")} />
            <MenuRow Icon={Search} label="Universal search" onPress={() => nav("/(more)/search")} />
            <MenuRow Icon={ImageIcon} label="Gallery & moments" onPress={() => nav("/(more)/gallery")} last />
          </View>
        </View>
      </FadeInUp>

      {/* 8. District Group 4: Portals & System (Visible to all) */}
      <FadeInUp delay={110}>
        <View style={{ marginBottom: 16 }}>
          <Txt size={11} font="monoMed" style={{ color: "#6b728a", letterSpacing: 2, marginBottom: 8 }} uppercase>
            Portals & System
          </Txt>
          <View style={cardContainerStyle}>
            <MenuRow Icon={Share2} label="Share the app" onPress={handleShareApp} />
            <MenuRow Icon={Gavel} label="Judge panel" onPress={() => nav("/(more)/judge")} />
            <MenuRow Icon={HandHeart} label="Volunteer gate scanner" onPress={() => nav("/(more)/volunteer")} />
            <MenuRow Icon={Info} label="About Upgrade Talents" onPress={() => nav("/(more)/about")} />
            <MenuRow Icon={Phone} label="Contact support" onPress={() => nav("/(more)/contact")} last />
          </View>
        </View>
      </FadeInUp>

      {/* 9. Follow us on Instagram Card (Zomato District 3D Style) */}
      <FadeInUp delay={110}>
        <View style={{ marginTop: 14, marginBottom: 6 }}>
          <InstagramCard />
        </View>
      </FadeInUp>

      {/* 10. Bottom Sign In or Sign Out Action */}
      <FadeInUp delay={120}>
        <View style={{ marginTop: 8, marginBottom: 28 }}>
          {user ? (
            <Button
              label="Sign out"
              variant="outline"
              full
              onPress={() => {
                playNavFeedback();
                logoutUser();
              }}
              icon={<LogOut size={16} color="#ffffff" />}
            />
          ) : (
            <Button
              label="Sign In to Your Account"
              variant="primary"
              full
              onPress={() => nav("/(auth)/login")}
              icon={<LogIn size={16} color="#ffffff" />}
            />
          )}
        </View>
      </FadeInUp>

      {/* 10. Swiggy-style signature Footer with pulsing heart & Indian flag */}
      <FadeInUp delay={130}>
        <BrandFooter />
      </FadeInUp>

      {/* Live Stage Lineup Modal */}
      {selectedComp && (
        <LiveStageLineupModal
          visible={lineupModalOpen}
          competitionId={selectedComp.id}
          competitionTitle={selectedComp.title}
          onClose={() => setLineupModalOpen(false)}
        />
      )}

      {/* Official App Share Sheet (Play Store link) */}
      <ShareSheet
        visible={shareAppOpen}
        onClose={() => setShareAppOpen(false)}
        title="Share Upgrade Talents India"
        subtitle="Invite friends to join live concerts, auditions & VIP passes"
        message="🌟 Download Upgrade Talents India — Discover live concerts, enter national talent auditions & get instant digital QR entry passes!"
        url="https://play.google.com/store/apps/details?id=in.upgradetalents.app"
        card={{
          title: "Upgrade Talents India",
          meta: "Google Play Store · Live Events & Talent",
        }}
      />
    </Screen>
  );
}

const cardContainerStyle = {
  backgroundColor: "#14161E",
  borderRadius: 20,
  borderWidth: 1,
  borderColor: "rgba(255, 255, 255, 0.08)",
  overflow: "hidden" as const,
};

function MenuRow({
  Icon,
  label,
  onPress,
  last,
}: {
  Icon: any;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <>
      <Pressable
        onPress={() => {
          playNavFeedback();
          onPress();
        }}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 13,
          paddingHorizontal: 16,
          paddingVertical: 14,
          backgroundColor: pressed ? "rgba(255, 255, 255, 0.04)" : "transparent",
        })}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255, 255, 255, 0.06)",
          }}
        >
          <Icon size={17} color="#ffffff" />
        </View>
        <Txt size={14.5} font="sansBold" style={{ flex: 1, color: "#ffffff" }}>
          {label}
        </Txt>
        <ChevronRight size={17} color="#6b728a" />
      </Pressable>
      {!last && <Divider style={{ marginLeft: 65, backgroundColor: "rgba(255,255,255,0.06)" }} />}
    </>
  );
}
