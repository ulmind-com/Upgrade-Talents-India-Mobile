import React, { useState, useMemo } from "react";
import { PASSKEYS_ENABLED } from "@/lib/passkey";
import {
  View,
  Pressable,
  ScrollView,
  RefreshControl,
  Share,
  Alert,
  Modal,
  Dimensions,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import QRCode from "react-native-qrcode-svg";
import {
  ChevronLeft,
  Pencil,
  Share2,
  Copy,
  Check,
  Sparkles,
  Trophy,
  Award,
  Ticket,
  CalendarDays,
  Coins,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  User,
  Calendar,
  Flame,
  ChevronRight,
  LogOut,
  LogIn,
  BadgeCheck,
  Settings,
  QrCode,
  KeyRound,
  Package,
  Crown,
  Clock,
  Maximize2,
  X,
} from "lucide-react-native";

import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { profileApi, bookingsApi, extrasApi, safe } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Button, Divider } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { VerifiedTick, VerifiedName } from "@/components/VerifiedBadge";
import { FadeInUp } from "@/components/FadeInUp";
import { useAlert } from "@/components/Popup";
import { playNavFeedback } from "@/lib/sound";
import { formatEventDate } from "@/lib/format";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function DedicatedProfileScreen() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser, logoutUser } = useSession();
  const alert = useAlert();

  const [copiedId, setCopiedId] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);

  // Fetch full live profile details
  const profileQ = useAsync(
    () => (user ? safe(profileApi.get(), null as any) : Promise.resolve(null)),
    [user?.email],
    { refetchOnFocus: true }
  );

  // User tickets, bookings, rewards, and certs
  const ticketsQ = useAsync(
    () => (user ? safe(bookingsApi.myTickets(), []) : Promise.resolve([])),
    [user?.email]
  );
  const bookingsQ = useAsync(
    () => (user ? safe(bookingsApi.my(), []) : Promise.resolve([])),
    [user?.email]
  );
  const rewardsQ = useAsync(
    () => (user ? safe(extrasApi.rewards(), null as any) : Promise.resolve(null)),
    [user?.email]
  );
  const certsQ = useAsync(
    () => (user ? safe(extrasApi.myCertificates(), []) : Promise.resolve([])),
    [user?.email]
  );

  const me = profileQ.data || user || {};
  const points =
    (rewardsQ.data as any)?.balance ??
    (rewardsQ.data as any)?.points ??
    (rewardsQ.data as any)?.total ??
    0;

  const ticketsCount = Array.isArray(ticketsQ.data) ? ticketsQ.data.length : 0;
  const bookingsCount = Array.isArray(bookingsQ.data) ? bookingsQ.data.length : 0;
  const certsCount = Array.isArray(certsQ.data) ? certsQ.data.length : 0;

  const refreshing =
    profileQ.refreshing || ticketsQ.refreshing || bookingsQ.refreshing || rewardsQ.refreshing;

  const handleRefresh = async () => {
    await Promise.all([
      refreshUser(),
      profileQ.refresh(),
      ticketsQ.refresh(),
      bookingsQ.refresh(),
      rewardsQ.refresh(),
      certsQ.refresh(),
    ]);
  };

  const nav = (route: string) => {
    playNavFeedback();
    router.push(route as any);
  };

  // Unique Talent Pass ID
  const passId = useMemo(() => {
    const raw = me?._id || me?.id || user?._id || user?.id || "884291";
    return String(raw).slice(-6).toUpperCase();
  }, [me?._id, me?.id, user?._id, user?.id]);

  const handleCopyPassId = async () => {
    playNavFeedback();
    await Clipboard.setStringAsync(`UTI-${passId}`);
    setCopiedId(true);
    alert("success", "Talent ID Copied", `UTI-${passId} copied to clipboard.`);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyReferral = async () => {
    if (!user?.referral_code) return;
    playNavFeedback();
    await Clipboard.setStringAsync(String(user.referral_code));
    setCopiedRef(true);
    alert("success", "Code Copied", `Referral code ${user.referral_code} copied!`);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handleShareProfile = async () => {
    playNavFeedback();
    try {
      const performerName = me?.name || user?.name || "Performer";
      await Share.share({
        title: `${performerName} on Upgrade Talents India`,
        message: `🌟 Official talent passport for ${performerName}\nTalent ID: UTI-${passId}\n\nJoin Upgrade Talents India to compete in live stages & national rankings:\nhttps://upgradetalents.com`,
      });
    } catch (err) {
      console.warn("Share failed", err);
    }
  };

  const handleConfirmLogout = () => {
    playNavFeedback();
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: () => {
          logoutUser();
          router.replace("/(user)/profile");
        },
      },
    ]);
  };

  // Formatted date of joining or DOB
  const memberSinceFormatted = useMemo(() => {
    const raw = me?.created_at || user?.created_at;
    if (!raw) return "Member";
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return "Verified Member";
      return `Member since ${d.toLocaleString("en-US", { month: "short", year: "numeric" })}`;
    } catch {
      return "Verified Member";
    }
  }, [me?.created_at, user?.created_at]);

  const formattedDob = useMemo(() => {
    const dob = me?.date_of_birth || user?.date_of_birth;
    if (!dob) return null;
    return formatEventDate(dob);
  }, [me?.date_of_birth, user?.date_of_birth]);

  const qrValue = useMemo(() => {
    return user?.email || user?._id || `uti-talent-${passId}`;
  }, [user?.email, user?._id, passId]);

  return (
    <View style={{ flex: 1, backgroundColor: "#07080E" }}>
      {/* Subtle Ambient Background Gradient */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255, 56, 92, 0.12)", "rgba(255, 255, 255, 0.02)", "transparent"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 260 }}
      />

      {/* Top Navigation Bar - Minimal & Clean */}
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: 16,
          paddingBottom: 10,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 10,
        }}
      >
        <Pressable
          onPress={() => {
            playNavFeedback();
            if (router.canGoBack()) router.back();
            else router.replace("/(user)/profile");
          }}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.1)",
            alignItems: "center",
            justifyContent: "center",
            transform: [{ scale: pressed ? 0.94 : 1 }],
          })}
        >
          <ChevronLeft size={20} color="#FFFFFF" />
        </Pressable>

        <Txt size={16.5} font="sansBold" style={{ color: "#FFFFFF", letterSpacing: -0.2 }}>
          Profile
        </Txt>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {user ? (
            <>
              <Pressable
                onPress={handleShareProfile}
                hitSlop={8}
                style={({ pressed }) => ({
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                })}
              >
                <Share2 size={16} color="#FFFFFF" />
              </Pressable>
              <Pressable
                onPress={() => nav("/(more)/profile-edit")}
                hitSlop={8}
                style={({ pressed }) => ({
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                })}
              >
                <Pencil size={15} color="#FFFFFF" />
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => nav("/(auth)/login")}
              hitSlop={8}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 18,
                backgroundColor: "#FF385C",
                alignItems: "center",
                justifyContent: "center",
                transform: [{ scale: pressed ? 0.94 : 1 }],
              })}
            >
              <Txt size={12} font="sansBold" style={{ color: "#ffffff" }}>
                Sign In
              </Txt>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FF385C"
            colors={["#FF385C"]}
          />
        }
      >
        {user ? (
          <>
            {/* 1. HERO IDENTITY CARD - Clean Zomato District Style */}
            <FadeInUp>
              <View
                style={{
                  borderRadius: 24,
                  backgroundColor: "#11131D",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.08)",
                  padding: 20,
                  marginBottom: 14,
                  alignItems: "center",
                }}
              >
                {/* Avatar with clean tap-to-edit */}
                <Pressable
                  onPress={() => nav("/(more)/profile-edit")}
                  style={({ pressed }) => ({
                    position: "relative",
                    marginBottom: 12,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  })}
                >
                  <View
                    style={{
                      padding: 3,
                      borderRadius: 999,
                      backgroundColor: "#161824",
                      borderWidth: 1.5,
                      borderColor: "rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    <Avatar
                      name={me?.name || user?.name}
                      photo={me?.profile_photo || user?.profile_photo}
                      size={76}
                      fontSize={28}
                      textColor="#ffffff"
                    />
                  </View>

                  {/* Tiny pencil indicator */}
                  <View
                    style={{
                      position: "absolute",
                      bottom: 0,
                      right: 0,
                      width: 26,
                      height: 26,
                      borderRadius: 13,
                      backgroundColor: "#1F2232",
                      borderWidth: 1.5,
                      borderColor: "rgba(255, 255, 255, 0.2)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Pencil size={11} color="#FFFFFF" />
                  </View>
                </Pressable>

                {/* Full Name without cut-off */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    flexWrap: "wrap",
                    paddingHorizontal: 8,
                  }}
                >
                  <VerifiedName name={me?.name || user?.name || "Performer"} row={me || user} size={20} lh={26} align="center" style={{ color: "#ffffff" }} />
                </View>

                {/* Email */}
                <Txt size={12.5} style={{ color: "#8E95AC", textAlign: "center", marginTop: 3 }}>
                  {me?.email || user?.email}
                </Txt>

                {/* Status Badge Pills */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    marginTop: 10,
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
                      paddingHorizontal: 9,
                      paddingVertical: 3,
                      borderRadius: 999,
                    }}
                  >
                    <BadgeCheck size={12} color="#C9F24A" />
                    <Txt size={10} font="sansBold" style={{ color: "#C9F24A" }}>
                      {user?.is_verified ? "VERIFIED PERFORMER" : "REGISTERED TALENT"}
                    </Txt>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: "rgba(255, 255, 255, 0.05)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      paddingHorizontal: 9,
                      paddingVertical: 3,
                      borderRadius: 999,
                    }}
                  >
                    <Clock size={11} color="#FFFFFF" />
                    <Txt size={10} font="monoMed" style={{ color: "#b3b9cf" }}>
                      {memberSinceFormatted}
                    </Txt>
                  </View>
                </View>
              </View>
            </FadeInUp>

            {/* 2. DIGITAL TALENT PASS (Tappable to Full Screen Scanner) */}
            <FadeInUp delay={20}>
              <Pressable
                onPress={() => {
                  playNavFeedback();
                  setQrModalVisible(true);
                }}
                style={({ pressed }) => ({
                  borderRadius: 22,
                  backgroundColor: "#11131D",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  padding: 16,
                  marginBottom: 14,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                })}
              >
                {/* Header row */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingBottom: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: "rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Sparkles size={14} color="#FFFFFF" />
                    </View>
                    <Txt size={11} font="monoMed" style={{ color: "#d0d4e4", letterSpacing: 1.5 }} uppercase>
                      UTI Talent Pass
                    </Txt>
                  </View>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: "rgba(255, 255, 255, 0.06)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.12)",
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 6,
                    }}
                  >
                    <Maximize2 size={11} color="#FFFFFF" />
                    <Txt size={9.5} font="monoMed" style={{ color: "#FFFFFF", letterSpacing: 0.8 }} uppercase>
                      Full Screen
                    </Txt>
                  </View>
                </View>

                {/* Content row: Info + QR Preview */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 14,
                    gap: 12,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt size={9.5} font="monoMed" style={{ color: "#787e97", letterSpacing: 1.2 }} uppercase>
                      Talent ID
                    </Txt>
                    <Txt size={18} font="monoMed" style={{ color: "#ffffff", marginTop: 2 }}>
                      UTI-{passId}
                    </Txt>

                    <View style={{ marginTop: 8 }}>
                      <Txt size={9.5} font="monoMed" style={{ color: "#787e97", letterSpacing: 1.2 }} uppercase>
                        Stage Access
                      </Txt>
                      <Txt size={13} font="sansBold" style={{ color: "#e2e6f3", marginTop: 1 }}>
                        National Contender
                      </Txt>
                    </View>
                  </View>

                  {/* QR Box */}
                  <View
                    style={{
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "#ffffff",
                      padding: 7,
                      borderRadius: 12,
                    }}
                  >
                    <QRCode value={qrValue} size={64} backgroundColor="#ffffff" color="#0c0e16" />
                    <Txt size={8} font="monoMed" style={{ color: "#0c0e16", marginTop: 3, letterSpacing: 0.8 }} uppercase>
                      Tap Scan
                    </Txt>
                  </View>
                </View>

                {/* Footer hint */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: "rgba(255, 255, 255, 0.06)",
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E" }} />
                    <Txt size={10} font="monoMed" style={{ color: "#22C55E", letterSpacing: 0.8 }}>
                      ACTIVE PASS
                    </Txt>
                  </View>
                  <Txt size={10} font="monoMed" style={{ color: "#8E95AC" }}>
                    Tap to open full screen scanner
                  </Txt>
                </View>
              </Pressable>
            </FadeInUp>

            {/* 3. PERFORMANCE & ASSETS - Sleek Line-by-Line List */}
            <FadeInUp delay={35}>
              <View style={{ marginBottom: 14 }}>
                <Txt size={11} font="monoMed" style={{ color: "#6b728a", letterSpacing: 1.8, marginBottom: 8 }} uppercase>
                  Performance & Assets
                </Txt>

                <View
                  style={{
                    backgroundColor: "#11131D",
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    overflow: "hidden",
                  }}
                >
                  <ListMetricRow
                    icon={<Ticket size={17} color="#FFFFFF" />}
                    title="Event Passes"
                    subtitle="Active tickets & stage entry"
                    value={String(ticketsCount)}
                    onPress={() => nav("/(user)/tickets")}
                  />
                  <Divider style={{ marginLeft: 64, backgroundColor: "rgba(255, 255, 255, 0.05)" }} />

                  <ListMetricRow
                    icon={<CalendarDays size={17} color="#FFFFFF" />}
                    title="My Bookings"
                    subtitle="Workshops & registered events"
                    value={String(bookingsCount)}
                    onPress={() => nav("/(more)/bookings")}
                  />
                  <Divider style={{ marginLeft: 64, backgroundColor: "rgba(255, 255, 255, 0.05)" }} />

                  <ListMetricRow
                    icon={<Coins size={17} color="#FFFFFF" />}
                    title="UTI Coins"
                    subtitle="Rewards balance & discount credits"
                    value={String(points)}
                    onPress={() => nav("/(more)/rewards")}
                  />
                  <Divider style={{ marginLeft: 64, backgroundColor: "rgba(255, 255, 255, 0.05)" }} />

                  <ListMetricRow
                    icon={<Award size={17} color="#FFFFFF" />}
                    title="Certificates & Badges"
                    subtitle="Verified national talent awards"
                    value={String(certsCount)}
                    onPress={() => nav("/(more)/certificates")}
                    last
                  />
                </View>
              </View>
            </FadeInUp>

            {/* 4. PERFORMER DOSSIER - Minimal Monochrome List */}
            <FadeInUp delay={50}>
              <View style={{ marginBottom: 14 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <Txt size={11} font="monoMed" style={{ color: "#6b728a", letterSpacing: 1.8 }} uppercase>
                    Performer Details
                  </Txt>
                  <Pressable
                    onPress={() => nav("/(more)/profile-edit")}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <Txt size={11} font="sansBold" style={{ color: "#FFFFFF" }}>
                      Edit
                    </Txt>
                    <Pencil size={11} color="#FFFFFF" />
                  </Pressable>
                </View>

                <View
                  style={{
                    backgroundColor: "#11131D",
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                  }}
                >
                  <DossierRow
                    icon={<User size={16} color="#FFFFFF" />}
                    label="Full Name"
                    value={me?.name || user?.name || "Not specified"}
                  />
                  <Divider style={{ marginVertical: 9, backgroundColor: "rgba(255, 255, 255, 0.05)" }} />

                  <DossierRow
                    icon={<Mail size={16} color="#FFFFFF" />}
                    label="Email"
                    value={me?.email || user?.email || "Not specified"}
                    badge="Verified"
                  />
                  <Divider style={{ marginVertical: 9, backgroundColor: "rgba(255, 255, 255, 0.05)" }} />

                  <DossierRow
                    icon={<Phone size={16} color="#FFFFFF" />}
                    label="Mobile Phone"
                    value={me?.phone_number || user?.phone_number || "Add mobile number"}
                    isAction={!me?.phone_number && !user?.phone_number}
                    onPress={() => nav("/(more)/profile-edit")}
                  />
                  <Divider style={{ marginVertical: 9, backgroundColor: "rgba(255, 255, 255, 0.05)" }} />

                  <DossierRow
                    icon={<Calendar size={16} color="#FFFFFF" />}
                    label="Date of Birth"
                    value={formattedDob || "Add date of birth"}
                    isAction={!formattedDob}
                    onPress={() => nav("/(more)/profile-edit")}
                  />
                  <Divider style={{ marginVertical: 9, backgroundColor: "rgba(255, 255, 255, 0.05)" }} />

                  <DossierRow
                    icon={<MapPin size={16} color="#FFFFFF" />}
                    label="Address"
                    value={me?.address || user?.address || "Add address"}
                    isAction={!me?.address && !user?.address}
                    onPress={() => nav("/(more)/profile-edit")}
                  />

                  {Boolean(me?.parent_phone_number || user?.parent_phone_number) && (
                    <>
                      <Divider style={{ marginVertical: 9, backgroundColor: "rgba(255, 255, 255, 0.05)" }} />
                      <DossierRow
                        icon={<Phone size={16} color="#FFFFFF" />}
                        label="Emergency Contact"
                        value={String(me?.parent_phone_number || user?.parent_phone_number)}
                      />
                    </>
                  )}
                </View>
              </View>
            </FadeInUp>

            {/* 5. REFERRAL CODE CARD */}
            {user?.referral_code && (
              <FadeInUp delay={60}>
                <View
                  style={{
                    borderRadius: 18,
                    backgroundColor: "#11131D",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    padding: 15,
                    marginBottom: 14,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Txt size={10} font="monoMed" style={{ color: "#787e97", letterSpacing: 1.2 }} uppercase>
                      Referral Code
                    </Txt>
                    <Txt size={17} font="sansBold" style={{ color: "#ffffff", marginTop: 2 }}>
                      {String(user.referral_code)}
                    </Txt>
                    <Txt size={11} style={{ color: "#8E95AC", marginTop: 2 }}>
                      Share with friends to earn bonus coins
                    </Txt>
                  </View>

                  <Pressable
                    onPress={handleCopyReferral}
                    style={({ pressed }) => ({
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 10,
                      backgroundColor: "rgba(255, 255, 255, 0.08)",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.12)",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      transform: [{ scale: pressed ? 0.94 : 1 }],
                    })}
                  >
                    {copiedRef ? (
                      <>
                        <Check size={13} color="#FFFFFF" />
                        <Txt size={11.5} font="sansBold" style={{ color: "#FFFFFF" }}>
                          Copied
                        </Txt>
                      </>
                    ) : (
                      <>
                        <Copy size={13} color="#FFFFFF" />
                        <Txt size={11.5} font="sansBold" style={{ color: "#FFFFFF" }}>
                          Copy
                        </Txt>
                      </>
                    )}
                  </Pressable>
                </View>
              </FadeInUp>
            )}

            {/* 6. TALENT SHORTCUTS & ECOSYSTEM - Clean Monochrome Icons */}
            <FadeInUp delay={70}>
              <View style={{ marginBottom: 14 }}>
                <Txt size={11} font="monoMed" style={{ color: "#6b728a", letterSpacing: 1.8, marginBottom: 8 }} uppercase>
                  Talent Hub
                </Txt>

                <View
                  style={{
                    backgroundColor: "#11131D",
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    overflow: "hidden",
                  }}
                >
                  <ProfileLinkRow
                    icon={<Trophy size={17} color="#FFFFFF" />}
                    title="Championship Leaderboard"
                    subtitle="Live scores & rankings"
                    onPress={() => nav("/(more)/leaderboard")}
                  />
                  <ProfileLinkRow
                    icon={<Flame size={17} color="#FFFFFF" />}
                    title="My Competitions"
                    subtitle="Registered rounds & auditions"
                    onPress={() => nav("/(more)/my-activity?tab=competitions")}
                  />
                  <ProfileLinkRow
                    icon={<Crown size={17} color="#FFFFFF" />}
                    title="VIP Backstage Passes"
                    subtitle="Priority stage access"
                    onPress={() => nav("/(more)/vip")}
                  />
                  <ProfileLinkRow
                    icon={<Package size={17} color="#FFFFFF" />}
                    title="Merchandise Orders"
                    subtitle="Official UTI merchandise"
                    onPress={() => nav("/(more)/shop/orders")}
                    last
                  />
                </View>
              </View>
            </FadeInUp>

            {/* 7. SECURITY — only passkeys live here, hidden while they're off */}
            {PASSKEYS_ENABLED ? (
            <FadeInUp delay={80}>
              <View style={{ marginBottom: 20 }}>
                <Txt size={11} font="monoMed" style={{ color: "#6b728a", letterSpacing: 1.8, marginBottom: 8 }} uppercase>
                  Security & Settings
                </Txt>

                <View
                  style={{
                    backgroundColor: "#11131D",
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    overflow: "hidden",
                  }}
                >
                  <ProfileLinkRow
                    icon={<KeyRound size={17} color="#FFFFFF" />}
                    title="Biometric Passkeys"
                    subtitle="Fast & secure sign-in"
                    onPress={() => nav("/(more)/passkeys")}
                    last
                  />
                </View>
              </View>
            </FadeInUp>
            ) : null}

            {/* 8. SIGN OUT ACTION - Clean Minimal */}
            <FadeInUp delay={90}>
              <View style={{ marginBottom: 24 }}>
                <Pressable
                  onPress={handleConfirmLogout}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    paddingVertical: 13,
                    borderRadius: 14,
                    backgroundColor: "rgba(239, 68, 68, 0.08)",
                    borderWidth: 1,
                    borderColor: "rgba(239, 68, 68, 0.22)",
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}
                >
                  <LogOut size={15} color="#EF4444" />
                  <Txt size={13.5} font="sansBold" style={{ color: "#EF4444" }}>
                    Sign Out
                  </Txt>
                </Pressable>
              </View>
            </FadeInUp>
          </>
        ) : (
          /* GUEST STATE */
          <FadeInUp>
            <View
              style={{
                borderRadius: 24,
                backgroundColor: "#11131D",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.08)",
                padding: 24,
                marginTop: 20,
                alignItems: "center",
              }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  backgroundColor: "rgba(255, 255, 255, 0.06)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <Sparkles size={28} color="#FFFFFF" />
              </View>

              <Txt size={20} font="sansBold" style={{ color: "#ffffff", textAlign: "center" }}>
                Claim Your Talent Pass
              </Txt>

              <Txt
                size={13}
                style={{ color: "#8E95AC", textAlign: "center", marginTop: 6, lineHeight: 19, maxWidth: 300 }}
              >
                Sign in to activate your official UTI Talent ID, live leaderboard ranking, stage passes,
                and certificates.
              </Txt>

              <View style={{ width: "100%", gap: 10, marginTop: 22 }}>
                <Button
                  label="Sign In"
                  variant="primary"
                  full
                  onPress={() => nav("/(auth)/login")}
                  icon={<LogIn size={15} color="#ffffff" />}
                />
                <Button
                  label="Create Account"
                  variant="outline"
                  full
                  onPress={() => nav("/(auth)/register")}
                />
              </View>
            </View>
          </FadeInUp>
        )}

        {/* Brand Footer */}
        <View style={{ alignItems: "center", marginTop: 8 }}>
          <Txt size={10.5} font="monoMed" style={{ color: "rgba(255, 255, 255, 0.25)", letterSpacing: 1.5 }}>
            UPGRADE TALENTS INDIA
          </Txt>
        </View>
      </ScrollView>

      {/* FULL-SCREEN DIGITAL TALENT PASS SCANNER MODAL */}
      <Modal
        visible={qrModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setQrModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.94)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 20,
          }}
        >
          {/* Close button at top-right */}
          <Pressable
            onPress={() => {
              playNavFeedback();
              setQrModalVisible(false);
            }}
            hitSlop={12}
            style={{
              position: "absolute",
              top: insets.top + 16,
              right: 20,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: "rgba(255, 255, 255, 0.12)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.18)",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 20,
            }}
          >
            <X size={22} color="#FFFFFF" />
          </Pressable>

          {/* Centered Pass Card */}
          <View
            style={{
              width: "100%",
              maxWidth: 360,
              backgroundColor: "#11131D",
              borderRadius: 28,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.14)",
              padding: 24,
              alignItems: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: 0.6,
              shadowRadius: 24,
              elevation: 10,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 4 }}>
              <Sparkles size={16} color="#FFFFFF" />
              <Txt size={12} font="monoMed" style={{ color: "#FFFFFF", letterSpacing: 2 }} uppercase>
                UPGRADE TALENTS INDIA
              </Txt>
            </View>

            <Txt size={11} font="monoMed" style={{ color: "#787e97", letterSpacing: 1.5 }} uppercase>
              OFFICIAL TALENT PASSPORT
            </Txt>

            {/* High-Resolution QR Code */}
            <View
              style={{
                backgroundColor: "#FFFFFF",
                padding: 16,
                borderRadius: 20,
                marginTop: 20,
                marginBottom: 16,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <QRCode
                value={qrValue}
                size={Math.min(SCREEN_WIDTH - 120, 210)}
                backgroundColor="#FFFFFF"
                color="#000000"
              />
            </View>

            {/* Performer Details */}
            <Txt size={19} font="sansBold" style={{ color: "#FFFFFF", textAlign: "center" }}>
              {me?.name || user?.name || "Performer"}
            </Txt>

            <Pressable
              onPress={handleCopyPassId}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}
            >
              <Txt size={16} font="monoMed" style={{ color: "#d0d4e4", letterSpacing: 1 }}>
                UTI-{passId}
              </Txt>
              {copiedId ? (
                <Check size={15} color="#22C55E" />
              ) : (
                <Copy size={14} color="#787e97" />
              )}
            </Pressable>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginTop: 12,
                backgroundColor: "rgba(34, 197, 94, 0.12)",
                borderWidth: 1,
                borderColor: "rgba(34, 197, 94, 0.3)",
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 999,
              }}
            >
              <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#22C55E" }} />
              <Txt size={11} font="monoMed" style={{ color: "#22C55E", letterSpacing: 1 }}>
                ACTIVE STAGE VERIFICATION
              </Txt>
            </View>

            <Txt
              size={11.5}
              style={{
                color: "#787e97",
                textAlign: "center",
                marginTop: 14,
                lineHeight: 17,
                maxWidth: 280,
              }}
            >
              Scan this code at the event gate or backstage desk for instant performer admission.
            </Txt>

            {/* Bottom Actions */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 20, width: "100%" }}>
              <Pressable
                onPress={handleCopyPassId}
                style={({ pressed }) => ({
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 11,
                  borderRadius: 12,
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.12)",
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                })}
              >
                <Copy size={14} color="#FFFFFF" />
                <Txt size={12} font="sansBold" style={{ color: "#FFFFFF" }}>
                  {copiedId ? "Copied" : "Copy ID"}
                </Txt>
              </Pressable>

              <Pressable
                onPress={() => {
                  playNavFeedback();
                  setQrModalVisible(false);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 11,
                  borderRadius: 12,
                  backgroundColor: "#FFFFFF",
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                })}
              >
                <Txt size={12} font="sansBold" style={{ color: "#000000" }}>
                  Done
                </Txt>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ListMetricRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  last,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        playNavFeedback();
        onPress();
      }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 13,
        backgroundColor: pressed ? "rgba(255, 255, 255, 0.04)" : "transparent",
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={14} font="sansBold" style={{ color: "#ffffff" }}>
            {title}
          </Txt>
          <Txt size={11} style={{ color: "#8E95AC", marginTop: 1 }} numberOfLines={1}>
            {subtitle}
          </Txt>
        </View>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Txt size={16} font="sansBold" style={{ color: "#ffffff" }}>
          {value}
        </Txt>
        <ChevronRight size={16} color="#6b728a" />
      </View>
    </Pressable>
  );
}

function DossierRow({
  icon,
  label,
  value,
  badge,
  isAction,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge?: string;
  isAction?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11, flex: 1, minWidth: 0 }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={10} font="monoMed" style={{ color: "#787e97", letterSpacing: 1 }} uppercase>
            {label}
          </Txt>
          <Txt
            size={13}
            font={isAction ? "sansBold" : "sansMed"}
            style={{ color: isAction ? "#FFFFFF" : "#ffffff", marginTop: 1 }}
            numberOfLines={1}
          >
            {value}
          </Txt>
        </View>
      </View>

      {badge ? (
        <View
          style={{
            backgroundColor: "rgba(34, 197, 94, 0.12)",
            borderWidth: 1,
            borderColor: "rgba(34, 197, 94, 0.25)",
            paddingHorizontal: 7,
            paddingVertical: 2,
            borderRadius: 5,
          }}
        >
          <Txt size={9.5} font="monoMed" style={{ color: "#22C55E" }}>
            {badge}
          </Txt>
        </View>
      ) : isAction ? (
        <ChevronRight size={15} color="#8E95AC" />
      ) : null}
    </View>
  );

  if (isAction && onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
        {content}
      </Pressable>
    );
  }

  return content;
}

function ProfileLinkRow({
  icon,
  title,
  subtitle,
  onPress,
  last,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
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
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 13,
          backgroundColor: pressed ? "rgba(255, 255, 255, 0.04)" : "transparent",
        })}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255, 255, 255, 0.06)",
          }}
        >
          {icon}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Txt size={13.5} font="sansBold" style={{ color: "#ffffff" }}>
            {title}
          </Txt>
          <Txt size={11} style={{ color: "#8E95AC", marginTop: 1 }} numberOfLines={1}>
            {subtitle}
          </Txt>
        </View>
        <ChevronRight size={16} color="#6b728a" />
      </Pressable>
      {!last && <Divider style={{ marginLeft: 64, backgroundColor: "rgba(255, 255, 255, 0.05)" }} />}
    </>
  );
}
