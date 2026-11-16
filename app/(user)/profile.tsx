import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
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
  Repeat,
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
import { DottedGrid } from "@/components/patterns";
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

  /* The soonest still-upcoming pass — the dashboard's "next up" at a glance. */
  const nextUp = React.useMemo(() => {
    const list = Array.isArray(tickets.data) ? tickets.data : [];
    return (
      list
        .filter((t: any) => t.event_date && !isEventExpired(t.event_date, t.event_time))
        .sort((a: any, b: any) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())[0] || null
    );
  }, [tickets.data]);

  const openLineup = () => {
    const active = compList[0];
    if (active) {
      setSelectedComp({ id: active._id || active.id, title: active.title || active.name || "Live Stage" });
    } else {
      setSelectedComp({ id: "live", title: "Live Stage Lineup" });
    }
    setLineupModalOpen(true);
  };

  const switchToAdmin = () => {
    setMode("admin");
    router.replace("/(admin)");
  };

  return (
    <Screen
      refreshing={tickets.refreshing}
      onRefresh={() => {
        tickets.refresh();
        bookings.refresh();
        rewards.refresh();
      }}
      contentStyle={{ paddingTop: 8 }}
    >
      {user ? (
        <>
          {/* Gen-Z District Hero Banner */}
          <FadeInUp>
            <View style={{ borderRadius: 28, overflow: "hidden" }}>
              <LinearGradient
                colors={["#8B5CF6", "#FF385C", "#08090C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 20, paddingTop: 18 }}
              >
                <DottedGrid color="rgba(255,255,255,0.22)" opacity={0.5} gap={20} />
                {/* top row: badge + search + theme */}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View
                    style={{
                      backgroundColor: "rgba(255,255,255,0.22)",
                      borderRadius: 999,
                      paddingHorizontal: 11,
                      paddingVertical: 5,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    {user?.is_verified ? <BadgeCheck size={13} color="#fff" /> : null}
                    <Txt size={10.5} font="sansBold" style={{ color: "#fff", letterSpacing: 1 }} uppercase>
                      {user?.is_verified ? "Verified" : "Member"}
                    </Txt>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Pressable
                      onPress={() => router.push("/(more)/search")}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 999,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(255,255,255,0.22)",
                      }}
                    >
                      <Search size={18} color="#fff" />
                    </Pressable>
                    <Pressable
                      onPress={toggle}
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 999,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "rgba(255,255,255,0.22)",
                      }}
                    >
                      {name === "dark" ? <Moon size={18} color="#fff" /> : <Sun size={18} color="#fff" />}
                    </Pressable>
                  </View>
                </View>

                {/* identity */}
                <View style={{ alignItems: "center", marginTop: 6 }}>
                  <Avatar
                    name={user?.name}
                    photo={user?.profile_photo}
                    size={88}
                    fontSize={32}
                    gradient={false}
                    border={{ width: 3, color: "rgba(255,255,255,0.6)" }}
                    style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      marginTop: 12,
                    }}
                  >
                    <Txt
                      size={23}
                      font="display"
                      tracking={-0.5}
                      style={{ color: "#fff", flexShrink: 1 }}
                      numberOfLines={1}
                    >
                      {user?.name || "Dancer"}
                    </Txt>
                    <VerifiedTick row={user} size={18} />
                  </View>
                  <Txt size={13} style={{ color: "rgba(255,255,255,0.9)", marginTop: 2 }} numberOfLines={1}>
                    {user?.email}
                  </Txt>
                </View>

                {/* stat chips */}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
                  {[
                    { label: "Tickets", value: tickets.data?.length ?? 0 },
                    { label: "Bookings", value: bookings.data?.length ?? 0 },
                    { label: "Points", value: points },
                  ].map((s) => (
                    <View
                      key={s.label}
                      style={{
                        flex: 1,
                        backgroundColor: "rgba(20,22,30,0.55)",
                        borderRadius: 16,
                        paddingVertical: 12,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: "rgba(255,255,255,0.12)",
                      }}
                    >
                      <Txt size={22} font="display" style={{ color: "#fff" }}>
                        {s.value}
                      </Txt>
                      <Txt
                        size={10}
                        font="sansBold"
                        style={{ color: "rgba(255,255,255,0.88)", letterSpacing: 1, marginTop: 2 }}
                        uppercase
                      >
                        {s.label}
                      </Txt>
                    </View>
                  ))}
                </View>
              </LinearGradient>
            </View>
          </FadeInUp>

          {/* Next up — the soonest upcoming pass */}
          {nextUp ? (
            <FadeInUp delay={50}>
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
                style={({ pressed }) => ({ marginTop: 14, transform: [{ scale: pressed ? 0.985 : 1 }] })}
              >
                <View
                  style={{
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: c.border,
                    backgroundColor: c.surface,
                    overflow: "hidden",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 13,
                    padding: 14,
                  }}
                >
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 14,
                      backgroundColor: c.accent + "1c",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CalendarClock size={22} color={c.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt size={10.5} font="monoMed" tone="accent" tracking={1.8} uppercase>
                      Next up
                    </Txt>
                    <Txt size={15} font="sansBold" numberOfLines={1} style={{ marginTop: 2 }}>
                      {nextUp.event_title || "Your event"}
                    </Txt>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 3 }}>
                      <Txt size={11.5} tone="muted">
                        {formatEventDate(nextUp.event_date)}
                      </Txt>
                      {nextUp.event_venue ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                          <MapPin size={10} color={c.fgSubtle} />
                          <Txt size={11.5} tone="subtle" numberOfLines={1} style={{ maxWidth: 120 }}>
                            {nextUp.event_venue}
                          </Txt>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <QrCode size={20} color={c.fgMuted} />
                </View>
              </Pressable>
            </FadeInUp>
          ) : null}

          {/* Live Stage Lineup banner */}
          <FadeInUp delay={60}>
            <Pressable
              onPress={openLineup}
              style={({ pressed }) => ({ marginTop: 14, transform: [{ scale: pressed ? 0.985 : 1 }] })}
            >
              <View
                style={{
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: "rgba(139, 92, 246, 0.4)",
                  backgroundColor: "rgba(139, 92, 246, 0.12)",
                  overflow: "hidden",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 13,
                  padding: 14,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: "rgba(139, 92, 246, 0.25)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Radio size={22} color="#C9F24A" />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Txt size={10.5} font="monoMed" style={{ color: "#C9F24A" }} tracking={1.5} uppercase>
                      Live Queue
                    </Txt>
                    <View
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        backgroundColor: "#C9F24A",
                      }}
                    />
                  </View>
                  <Txt size={14.5} font="sansBold" style={{ color: "#FFF", marginTop: 2 }}>
                    Stage Lineup & Arrival Order
                  </Txt>
                  <Txt size={11.5} tone="subtle" style={{ color: "rgba(255,255,255,0.7)" }}>
                    Tap to see performance order & live venue callouts.
                  </Txt>
                </View>
                <ChevronRight size={18} color="rgba(255,255,255,0.5)" />
              </View>
            </Pressable>
          </FadeInUp>

          {/* referral */}
          {user?.referral_code ? (
            <FadeInUp delay={70}>
              <View style={{ marginTop: 14 }}>
                <CopyCode code={String(user.referral_code)} />
              </View>
            </FadeInUp>
          ) : null}

          {/* menu */}
          <FadeInUp delay={120}>
            <View
              style={{
                marginTop: 16,
                backgroundColor: c.surface,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: c.border,
                overflow: "hidden",
              }}
            >
              <Row Icon={Receipt} label="My bookings" onPress={() => router.push("/(more)/bookings")} />
              <Row Icon={ShoppingBag} label="Shop merch" onPress={() => router.push("/(more)/shop")} />
              <Row Icon={Package} label="My orders" onPress={() => router.push("/(more)/shop/orders")} />
              <Row Icon={Crown} label="VIP passes" onPress={() => router.push("/(more)/vip")} />
              <Row Icon={Award} label="My badges" onPress={() => router.push("/(more)/badges")} />
              <Row Icon={ShieldCheck} label="Aadhaar KYC" onPress={() => router.push("/(more)/kyc")} />
              <Row Icon={UserCog} label="Edit profile" onPress={() => router.push("/(more)/profile-edit")} />
              <Row Icon={Gift} label="Rewards & referrals" onPress={() => router.push("/(more)/rewards")} />
              <Row Icon={Award} label="Certificates" onPress={() => router.push("/(more)/certificates")} />
              <Row Icon={Bell} label="Notifications" onPress={() => router.push("/(more)/notifications")} />
              <Row Icon={Trophy} label="Competitions" onPress={() => router.push("/(more)/competitions")} />
              <Row Icon={BarChart3} label="Leaderboard" onPress={() => router.push("/(more)/leaderboard")} last />
            </View>
          </FadeInUp>
        </>
      ) : (
        <Card style={{ alignItems: "center", gap: 14, paddingVertical: 32, marginTop: 8 }}>
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: c.surface2,
            }}
          >
            <LogIn size={24} color={c.accent} />
          </View>
          <Txt size={17} font="sansBold" align="center">
            Sign in to Upgrade Talents
          </Txt>
          <Txt size={14} tone="muted" align="center" style={{ maxWidth: 280 }}>
            Book tickets, enter competitions and collect certificates.
          </Txt>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Button label="Sign in" onPress={() => router.push("/(auth)/login")} />
            <Button label="Register" variant="outline" onPress={() => router.push("/(auth)/register")} />
          </View>
        </Card>
      )}

      {/* general menu */}
      <View
        style={{
          marginTop: 16,
          backgroundColor: c.surface,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: c.border,
          overflow: "hidden",
        }}
      >
        <Row Icon={Search} label="Search events & shop" muted onPress={() => router.push("/(more)/search")} />
        <Row Icon={ImageIcon} label="Gallery" muted onPress={() => router.push("/(more)/gallery")} />
        <Row Icon={Info} label="About us" muted onPress={() => router.push("/(more)/about")} />
        <Row Icon={ShieldCheck} label="Verify a certificate" muted onPress={() => router.push("/(more)/verify")} />
        <Row Icon={Phone} label="Contact us" muted onPress={() => router.push("/(more)/contact")} />
        <Row Icon={Settings} label="App settings" muted onPress={() => router.push("/(more)/settings")} />
        <Row Icon={Gavel} label="Judge panel" muted onPress={() => router.push("/(more)/judge")} />
        <Row Icon={HandHeart} label="Volunteer gate scanner" muted onPress={() => router.push("/(more)/volunteer")} />
        <Row Icon={Repeat} label="Switch to Admin mode" muted onPress={switchToAdmin} last />
      </View>

      {user ? (
        <View style={{ marginTop: 16 }}>
          <Button label="Log out" variant="outline" full onPress={logoutUser} icon={<LogOut size={17} color={c.fg} />} />
        </View>
      ) : null}

      <Txt size={12} tone="subtle" align="center" style={{ marginTop: 22 }}>
        Upgrade Talents India · v1.0.0
      </Txt>

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

function Row({
  Icon,
  label,
  onPress,
  last,
  muted,
}: {
  Icon: any;
  label: string;
  onPress: () => void;
  last?: boolean;
  muted?: boolean;
}) {
  const { c } = useTheme();
  return (
    <>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 13,
          paddingHorizontal: 14,
          paddingVertical: 12,
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: muted ? c.surface2 : c.accent + "1f",
          }}
        >
          <Icon size={18} color={muted ? c.fgMuted : c.accent} />
        </View>
        <Txt size={15} font="sansSemi" style={{ flex: 1 }}>
          {label}
        </Txt>
        <ChevronRight size={18} color={c.fgSubtle} />
      </Pressable>
      {!last ? <Divider style={{ marginLeft: 65 }} /> : null}
    </>
  );
}
