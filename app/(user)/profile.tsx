import React, { useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
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
} from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { bookingsApi, extrasApi, publicApi, safe, toRows } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Card, Button, Divider } from "@/components/ui";
import { FadeInUp } from "@/components/FadeInUp";
import { Avatar } from "@/components/Avatar";
import { VerifiedTick } from "@/components/VerifiedBadge";
import { CopyCode } from "@/components/CopyCode";
import { isEventExpired, formatEventDate } from "@/lib/format";
import { LiveStageLineupModal } from "@/components/LiveStageLineupModal";

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const active = compList[0];
    if (active) {
      setSelectedComp({ id: active._id || active.id, title: active.title || active.name || "Live Stage" });
    } else {
      setSelectedComp({ id: "live", title: "Live Stage Lineup" });
    }
    setLineupModalOpen(true);
  };

  const nav = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(route as any);
  };

  return (
    <Screen
      refreshing={tickets.refreshing}
      onRefresh={() => {
        tickets.refresh();
        bookings.refresh();
        rewards.refresh();
      }}
    >
      {user ? (
        <>
          {/* District Profile Identity Header */}
          <FadeInUp>
            <View
              style={{
                borderRadius: 22,
                backgroundColor: "#14161E",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)",
                padding: 18,
                marginBottom: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <Avatar
                    name={user?.name}
                    photo={user?.profile_photo}
                    size={64}
                    fontSize={24}
                    border={{ width: 2, color: "#FF385C" }}
                    style={{ backgroundColor: "#1f2230" }}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Txt size={19} font="sansBold" style={{ color: "#ffffff" }} numberOfLines={1}>
                        {user?.name || "Dancer"}
                      </Txt>
                      <VerifiedTick row={user} size={16} />
                    </View>
                    <Txt size={12.5} style={{ color: "#9ea3b8", marginTop: 2 }} numberOfLines={1}>
                      {user?.email}
                    </Txt>
                    <View
                      style={{
                        alignSelf: "flex-start",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        backgroundColor: "rgba(201, 242, 74, 0.12)",
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 999,
                        marginTop: 6,
                      }}
                    >
                      <BadgeCheck size={11} color="#C9F24A" />
                      <Txt size={10} font="sansBold" style={{ color: "#C9F24A" }}>
                        {user?.is_verified ? "VERIFIED MEMBER" : "MEMBER"}
                      </Txt>
                    </View>
                  </View>
                </View>

                {/* Edit profile icon */}
                <Pressable
                  onPress={() => nav("/(more)/profile-edit")}
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
                  <UserCog size={18} color="#ffffff" />
                </Pressable>
              </View>

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
                    style={{
                      flex: 1,
                      backgroundColor: "#0d0f15",
                      borderRadius: 14,
                      paddingVertical: 12,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.08)",
                    }}
                  >
                    <Txt size={20} font="sansBold" style={{ color: "#ffffff" }}>
                      {s.value}
                    </Txt>
                    <Txt size={10} font="monoMed" style={{ color: "#9ea3b8", letterSpacing: 1, marginTop: 2 }} uppercase>
                      {s.label}
                    </Txt>
                  </Pressable>
                ))}
              </View>
            </View>
          </FadeInUp>

          {/* Next Up Event Banner */}
          {nextUp && (
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

          {/* Live Stage Lineup Quick Bar */}
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

          {/* Referral Code Box */}
          {user?.referral_code && (
            <FadeInUp delay={70}>
              <View style={{ marginBottom: 16 }}>
                <CopyCode code={String(user.referral_code)} />
              </View>
            </FadeInUp>
          )}

          {/* District Group 1: Bookings & Merchandise */}
          <FadeInUp delay={80}>
            <View style={{ marginBottom: 16 }}>
              <Txt size={11} font="monoMed" style={{ color: "#6b728a", letterSpacing: 2, marginBottom: 8 }} uppercase>
                Orders & Tickets
              </Txt>
              <View style={cardContainerStyle}>
                <MenuRow Icon={Receipt} label="My bookings" onPress={() => nav("/(more)/bookings")} />
                <MenuRow Icon={Package} label="My merchandise orders" onPress={() => nav("/(more)/shop/orders")} />
                <MenuRow Icon={Crown} label="VIP backstage passes" onPress={() => nav("/(more)/vip")} />
                <MenuRow Icon={ShoppingBag} label="Merch store" onPress={() => nav("/(more)/shop")} last />
              </View>
            </View>
          </FadeInUp>

          {/* District Group 2: Competitions & Achievements */}
          <FadeInUp delay={90}>
            <View style={{ marginBottom: 16 }}>
              <Txt size={11} font="monoMed" style={{ color: "#6b728a", letterSpacing: 2, marginBottom: 8 }} uppercase>
                Talent & Compete
              </Txt>
              <View style={cardContainerStyle}>
                <MenuRow Icon={Trophy} label="Competitions hub" onPress={() => nav("/(more)/competitions")} />
                <MenuRow Icon={BarChart3} label="Live leaderboard" onPress={() => nav("/(more)/leaderboard")} />
                <MenuRow Icon={Award} label="Certificates" onPress={() => nav("/(more)/certificates")} />
                <MenuRow Icon={ShieldCheck} label="Aadhaar KYC verification" onPress={() => nav("/(more)/kyc")} last />
              </View>
            </View>
          </FadeInUp>

          {/* District Group 3: Perks & Community */}
          <FadeInUp delay={100}>
            <View style={{ marginBottom: 16 }}>
              <Txt size={11} font="monoMed" style={{ color: "#6b728a", letterSpacing: 2, marginBottom: 8 }} uppercase>
                Rewards & Tools
              </Txt>
              <View style={cardContainerStyle}>
                <MenuRow Icon={Gift} label="Rewards & referral coins" onPress={() => nav("/(more)/rewards")} />
                <MenuRow Icon={Bell} label="Notifications" onPress={() => nav("/(more)/notifications")} />
                <MenuRow Icon={Search} label="Universal search" onPress={() => nav("/(more)/search")} />
                <MenuRow Icon={ImageIcon} label="Gallery & moments" onPress={() => nav("/(more)/gallery")} last />
              </View>
            </View>
          </FadeInUp>

          {/* District Group 4: Portals & Settings */}
          <FadeInUp delay={110}>
            <View style={{ marginBottom: 16 }}>
              <Txt size={11} font="monoMed" style={{ color: "#6b728a", letterSpacing: 2, marginBottom: 8 }} uppercase>
                Portals & System
              </Txt>
              <View style={cardContainerStyle}>
                <MenuRow Icon={Gavel} label="Judge panel" onPress={() => nav("/(more)/judge")} />
                <MenuRow Icon={HandHeart} label="Volunteer gate scanner" onPress={() => nav("/(more)/volunteer")} />
                <MenuRow Icon={Info} label="About Upgrade Talents" onPress={() => nav("/(more)/about")} />
                <MenuRow Icon={Phone} label="Contact support" onPress={() => nav("/(more)/contact")} />
                <MenuRow Icon={Settings} label="App preferences" onPress={() => nav("/(more)/settings")} last />
              </View>
            </View>
          </FadeInUp>

          {/* Logout Button */}
          <FadeInUp delay={120}>
            <View style={{ marginTop: 8, marginBottom: 24 }}>
              <Button
                label="Sign out"
                variant="outline"
                full
                onPress={logoutUser}
                icon={<LogOut size={16} color="#ffffff" />}
              />
            </View>
          </FadeInUp>
        </>
      ) : (
        <Card style={{ alignItems: "center", gap: 14, paddingVertical: 36, marginTop: 12, backgroundColor: "#14161E", borderColor: "rgba(255,255,255,0.08)" }}>
          <View style={{ width: 64, height: 64, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "#1f2230" }}>
            <LogIn size={26} color="#FF385C" />
          </View>
          <Txt size={17} font="sansBold" style={{ color: "#ffffff" }} align="center">
            Sign in to Upgrade Talents
          </Txt>
          <Txt size={14} style={{ color: "#9ea3b8", maxWidth: 280 }} align="center">
            Book tickets, enter competitions and collect certificates.
          </Txt>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
            <Button label="Sign in" onPress={() => router.push("/(auth)/login")} />
            <Button label="Register" variant="outline" onPress={() => router.push("/(auth)/register")} />
          </View>
        </Card>
      )}

      {/* Live Stage Lineup Modal */}
      {selectedComp && (
        <LiveStageLineupModal
          visible={lineupModalOpen}
          competitionId={selectedComp.id}
          competitionTitle={selectedComp.title}
          onClose={() => setLineupModalOpen(false)}
        />
      )}
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
        onPress={onPress}
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
