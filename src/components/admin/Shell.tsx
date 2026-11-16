import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, ScrollView, Animated, Modal, RefreshControl, Dimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { BlurView } from "expo-blur";
import { useRouter, usePathname } from "expo-router";
import {
  LayoutGrid, CalendarDays, Ticket, ScanLine, Crown, Trophy, Gavel, HandHeart, Award, BadgeCheck,
  GraduationCap, Presentation, ShoppingBag, Gift, Users, Bell, Globe, FileClock, Settings,
  Menu, X, ShieldCheck, Sun, Moon, LogOut, Sparkles, ExternalLink, Repeat, ChevronRight,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { AdminTheme, useAdmin, T, ASearch, EASE } from "@/components/admin/ui";

type NavItem = { href: string; label: string; Icon: any };

/* Mirrors the web Shell's navigation, group for group. */
const NAV: { group: string; items: NavItem[] }[] = [
  { group: "Menu", items: [{ href: "/", label: "Dashboard", Icon: LayoutGrid }] },
  {
    group: "Events",
    items: [
      { href: "/events", label: "Events", Icon: CalendarDays },
      { href: "/tickets", label: "Tickets", Icon: Ticket },
      { href: "/check-in", label: "Gate Check-in", Icon: ScanLine },
      { href: "/vip", label: "VIP Passes", Icon: Crown },
    ],
  },
  {
    group: "Competitions",
    items: [
      { href: "/competitions", label: "Competitions", Icon: Trophy },
      { href: "/judges", label: "Judges", Icon: Gavel },
      { href: "/volunteers", label: "Volunteers", Icon: HandHeart },
      { href: "/certificates", label: "Certificates", Icon: Award },
      { href: "/badges", label: "Badges", Icon: BadgeCheck },
    ],
  },
  {
    group: "Learning",
    items: [
      { href: "/courses", label: "Courses", Icon: GraduationCap },
      { href: "/workshops", label: "Workshops", Icon: Presentation },
    ],
  },
  {
    group: "Commerce",
    items: [
      { href: "/merchandise", label: "Merchandise", Icon: ShoppingBag },
      { href: "/rewards", label: "Rewards & Referrals", Icon: Gift },
    ],
  },
  {
    group: "General",
    items: [
      { href: "/users", label: "Users", Icon: Users },
      { href: "/notifications", label: "Notifications", Icon: Bell },
      { href: "/website", label: "Website Content", Icon: Globe },
      { href: "/audit", label: "Audit Log", Icon: FileClock },
      { href: "/settings", label: "Settings", Icon: Settings },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items);

const SUBTITLES: Record<string, string> = {
  "/": "Plan, publish and track everything in one place.",
  "/events": "Create events and control what appears on the public site.",
  "/tickets": "Price, stock and sale windows for every ticket tier.",
  "/check-in": "Verify passes at the gate and admit holders.",
  "/vip": "Issue, track and revoke VIP access.",
  "/competitions": "Run judging, voting and result publishing.",
  "/judges": "Invite judges and manage their panel access.",
  "/volunteers": "Gate staff who scan passes during events.",
  "/certificates": "Issued certificates and their verification links.",
  "/badges": "Automatic achievements earned across the platform.",
  "/courses": "Masterclasses published to the website.",
  "/workshops": "Short-form workshops and bootcamps.",
  "/merchandise": "Products, orders and stock levels.",
  "/rewards": "Referral rules, coin ledger and expiry.",
  "/users": "Everyone registered on the website or app.",
  "/notifications": "Draft, schedule and send announcements.",
  "/website": "Every section of the public site, no developer needed.",
  "/audit": "A record of every admin action.",
  "/settings": "Voting power and environment details.",
};

/** Route segment → the web's href, so one table drives both. */
const hrefFor = (pathname: string) => {
  const seg = pathname.split("/").filter(Boolean).pop() || "";
  if (!seg || seg === "(admin)" || seg === "index") return "/";
  return `/${seg}`;
};
const routeFor = (href: string) => (href === "/" ? "/(admin)" : `/(admin)${href}`);

const { width: SCREEN_W } = Dimensions.get("window");
const DRAWER_W = Math.min(286, SCREEN_W * 0.82);

/**
 * The control room frame: a sticky top bar with the section jump search, and
 * the sidebar as a slide-in drawer — the same navigation the web shell has,
 * folded for a phone.
 */
export function AdminShell(props: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Overrides the auto title, for sub-pages the nav does not list. */
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  action?: React.ReactNode;
}) {
  return (
    <AdminTheme>
      <ShellBody {...props} />
    </AdminTheme>
  );
}

function ShellBody({ children, refreshing, onRefresh, title, subtitle, onBack, action }: {
  children: React.ReactNode; refreshing?: boolean; onRefresh?: () => void;
  title?: string; subtitle?: string; onBack?: () => void; action?: React.ReactNode;
}) {
  const c = useAdmin();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { name, toggle } = useTheme();
  const { admin, logoutAdmin, setMode } = useSession();

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const href = hrefFor(pathname || "");
  const current = ALL_ITEMS.find((i) => i.href === href);
  const heading = title || current?.label || "Control Room";
  const sub = subtitle ?? (current ? SUBTITLES[current.href] : "Manage this section of the platform.");

  const matches = useMemo(
    () => (q.trim() ? ALL_ITEMS.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6) : []),
    [q]
  );

  const go = (item: NavItem) => {
    setQ("");
    setOpen(false);
    router.push(routeFor(item.href) as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={c.barStyle === "light" ? "light" : "dark"} />

      {/* ── sticky top bar ── */}
      <View style={{ paddingTop: insets.top, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.bg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
          <Pressable
            onPress={() => (onBack ? onBack() : setOpen(true))}
            style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.surface2 : c.surface })}
          >
            {onBack ? <ChevronRight size={16} color={c.fg} style={{ transform: [{ rotate: "180deg" }] }} /> : <Menu size={16} color={c.fg} />}
          </Pressable>

          <View style={{ flex: 1 }}>
            <ASearch value={q} onChangeText={setQ} placeholder="Search section…" />
          </View>

          <Pressable
            onPress={toggle}
            style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: pressed ? c.surface2 : c.surface })}
          >
            {name === "dark" ? <Sun size={17} color={c.fgMuted} /> : <Moon size={17} color={c.fgMuted} />}
          </Pressable>
        </View>

        {/* jump results, exactly as the web dropdown behaves */}
        {matches.length ? (
          <View style={{ marginHorizontal: 16, marginBottom: 10, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
            {matches.map((m, i) => (
              <Pressable
                key={m.href}
                onPress={() => go(m)}
                style={({ pressed }) => ({ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, backgroundColor: pressed ? c.surface2 : "transparent", borderTopWidth: i ? 1 : 0, borderTopColor: c.border })}
              >
                <m.Icon size={16} color={c.fgMuted} />
                <T size={13}>{m.label}</T>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* ── page ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: insets.bottom + 40 }}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.brand} colors={[c.brand]} /> : undefined}
      >
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 24 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={27} font="bold" lh={32}>{heading}</T>
            {sub ? <T size={13.5} mut style={{ marginTop: 4 }}>{sub}</T> : null}
          </View>
          {action}
        </View>

        {children}
      </ScrollView>

      <Drawer open={open} onClose={() => setOpen(false)} active={href} onGo={go} />
    </View>
  );
}

/* ── the sidebar, as a drawer ── */
function Drawer({ open, onClose, active, onGo }: { open: boolean; onClose: () => void; active: string; onGo: (i: NavItem) => void }) {
  const c = useAdmin();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { admin, logoutAdmin, setMode } = useSession();
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(a, { toValue: open ? 1 : 0, duration: 320, easing: EASE, useNativeDriver: true }).start();
  }, [open]);

  const leave = async () => { onClose(); await logoutAdmin(); router.replace("/(admin)/login"); };
  const toUser = () => { onClose(); setMode("user"); router.replace("/(user)"); };

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={{ flex: 1, opacity: a }}>
        <Pressable onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.scrim }} />
        <Animated.View
          style={{
            position: "absolute", top: 0, bottom: 0, left: 0, width: DRAWER_W,
            backgroundColor: c.surface, paddingTop: insets.top,
            transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [-DRAWER_W, 0] }) }],
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 20, paddingVertical: 18 }}>
            <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: c.brand }}>
              <ShieldCheck size={20} color="#fff" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={14.5} font="bold" lh={18} numberOfLines={1}>Upgrade Talents</T>
              <T size={10.5} font="medium" sub upper track={1} lh={14}>Control Room</T>
            </View>
            <Pressable onPress={onClose} style={{ width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" }}>
              <X size={16} color={c.fgMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 20 }}>
            {NAV.map((group) => (
              <View key={group.group}>
                <T size={10.5} font="bold" sub upper track={1.3} style={{ paddingHorizontal: 12, paddingBottom: 8 }}>{group.group}</T>
                <View style={{ gap: 2 }}>
                  {group.items.map((item) => {
                    const on = item.href === active;
                    return (
                      <Pressable
                        key={item.href}
                        onPress={() => onGo(item)}
                        style={({ pressed }) => ({
                          minHeight: 42, flexDirection: "row", alignItems: "center", gap: 12,
                          paddingHorizontal: 12, borderRadius: 12,
                          backgroundColor: on ? c.brandSoft : pressed ? c.surface2 : "transparent",
                        })}
                      >
                        <item.Icon size={17} color={on ? c.brand : c.fgMuted} />
                        <T size={13} font={on ? "semi" : "regular"} color={on ? c.brand : c.fg} numberOfLines={1}>{item.label}</T>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}

            {/* the brand-surface promo block from the web sidebar */}
            <View style={{ borderRadius: 16, overflow: "hidden", backgroundColor: c.brand, padding: 16 }}>
              <View style={{ width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" }}>
                <Sparkles size={16} color="#fff" />
              </View>
              <T size={14} font="bold" color="#fff" lh={19} style={{ marginTop: 12 }}>View the live site</T>
              <T size={11.5} color="rgba(255,255,255,0.7)" lh={16} style={{ marginTop: 4 }}>See what visitors see right now</T>
              <Pressable onPress={toUser} style={({ pressed }) => ({ marginTop: 16, minHeight: 38, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: pressed ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)" })}>
                <T size={12.5} font="semi" color="#fff">Open app</T>
                <ExternalLink size={14} color="#fff" />
              </Pressable>
            </View>
          </ScrollView>

          {/* account footer */}
          <View style={{ borderTopWidth: 1, borderTopColor: c.border, padding: 16, paddingBottom: Math.max(insets.bottom, 16), flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{ width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.brandSoft }}>
              <T size={11} font="bold" color={c.brand}>{String(admin?.email || "A").slice(0, 2).toUpperCase()}</T>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={12.5} font="bold" numberOfLines={1}>{String(admin?.email || "Admin").split("@")[0]}</T>
              <T size={10.5} sub numberOfLines={1}>{admin?.email}</T>
            </View>
            <Pressable onPress={toUser} style={{ width: 36, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border }}>
              <Repeat size={16} color={c.fgMuted} />
            </Pressable>
            <Pressable onPress={leave} style={{ width: 36, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border }}>
              <LogOut size={16} color={c.danger} />
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
