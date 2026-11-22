import React, { useEffect, useRef } from "react";
import { View, Pressable, Dimensions, Animated, Easing } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, RadialGradient, Stop, Ellipse } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { Home, CalendarDays, QrCode, LayoutGrid } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";
import { LiveProvider, useLive } from "@/context/Live";
import { playNavFeedback } from "@/lib/sound";

type BottomTabBarProps = {
  state?: { index: number; routes: { key: string; name: string; state?: any }[] };
  navigation?: any;
};

/* "learn" stays a valid route (reached from the home Academy section) but is
   kept off the dock — it is intentionally absent from TAB_ORDER. */
const ICONS: Record<string, any> = { index: Home, events: CalendarDays, tickets: QrCode, profile: LayoutGrid };
const LABELS: Record<string, string> = { index: "Home", events: "Events", tickets: "Tickets", profile: "Menu" };
const TAB_ORDER = ["index", "events", "tickets", "profile"];

const GLOW_BLUE = "#4f9bff";
const GLOW_CORE = "#a9ccff";

/* ─────────── a soft breathing loop (shared by the beacon + the live dot) ─────────── */
function useBreath(active: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);
  return v;
}

/* ─────────── JioHotstar-style blue aura that sits above the active tab ─────────── */
function TabGlow({ x, width }: { x: Animated.Value; width: number }) {
  const GW = Math.min(width, 132);
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, width: GW, height: 58, transform: [{ translateX: Animated.subtract(x, GW / 2) }] }}
    >
      {/* downward blue bloom bleeding into the bar */}
      <Svg width={GW} height={58}>
        <Defs>
          <RadialGradient id="tabglow" cx="50%" cy="0%" r="78%">
            <Stop offset="0%" stopColor={GLOW_CORE} stopOpacity={0.6} />
            <Stop offset="45%" stopColor={GLOW_BLUE} stopOpacity={0.28} />
            <Stop offset="100%" stopColor={GLOW_BLUE} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={GW / 2} cy={0} rx={GW / 2} ry={54} fill="url(#tabglow)" />
      </Svg>
      {/* bright lit top edge */}
      <View
        style={{
          position: "absolute", top: 0, left: GW * 0.22, right: GW * 0.22, height: 2, borderRadius: 2,
          backgroundColor: GLOW_CORE,
          shadowColor: GLOW_BLUE, shadowOpacity: 0.9, shadowRadius: 7, shadowOffset: { width: 0, height: 0 },
        }}
      />
    </Animated.View>
  );
}

/* ─────────── the floating centre beacon — appears only while something is on air ─────────── */
function LiveBeacon({ onPress }: { onPress: () => void }) {
  const breath = useBreath(true);
  return (
    <Pressable onPress={onPress} hitSlop={10} style={{ marginBottom: 9 }}>
      <Animated.View
        style={{
          flexDirection: "row", alignItems: "center", gap: 7,
          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
          backgroundColor: "rgba(255,56,92,0.14)", borderWidth: 1, borderColor: "rgba(255,56,92,0.5)",
          shadowColor: "#ff385c", shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8,
          transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1.04] }) }],
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute", left: 8, width: 12, height: 12, borderRadius: 12,
            borderWidth: 2, borderColor: "#ff385c",
            opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
          }}
        />
        <View style={{ width: 7, height: 7, borderRadius: 7, backgroundColor: "#ff385c" }} />
        <Txt size={10.5} font="sansExt" tracking={1.5} uppercase style={{ color: "#ff6a84" }}>Live now</Txt>
      </Animated.View>
    </Pressable>
  );
}

function Dock({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = Dimensions.get("window");
  const { hasLive, firstLiveId } = useLive();
  const liveDot = useBreath(hasLive);

  const routes = (state?.routes || []).filter((r) => TAB_ORDER.includes(r.name));
  const currentKey = state?.routes?.[state?.index ?? 0]?.key;
  const idx = Math.max(0, routes.findIndex((r) => r.key === currentKey));

  const barWidth = Math.min(width - 24, 430);
  const N = Math.max(1, routes.length);
  const tabW = (barWidth - 16) / N;
  const centerFor = (i: number) => 8 + (i + 0.5) * tabW;

  // The blue aura glides to whichever tab is active.
  const glowX = useRef(new Animated.Value(centerFor(idx))).current;
  useEffect(() => {
    Animated.spring(glowX, { toValue: centerFor(idx), friction: 9, tension: 80, useNativeDriver: true }).start();
  }, [idx, barWidth, N]);

  const activeTab: any = state?.routes?.[state?.index ?? 0];
  const nested = activeTab?.state;
  const nestedRoute = nested?.routes?.[nested.index ?? 0]?.name;
  if (nestedRoute && nestedRoute !== "index") return null;

  const openLive = () => {
    playNavFeedback();
    router.push((firstLiveId ? `/(user)/events/${firstLiveId}` : "/(user)/events") as any);
  };

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingBottom: Math.max(insets.bottom, 10) }}>
      {hasLive ? <LiveBeacon onPress={openLive} /> : null}

      {/* floating glass dock */}
      <View
        style={{
          width: barWidth, height: 64, borderRadius: 30,
          backgroundColor: "rgba(10,10,13,0.97)",
          borderWidth: 1, borderColor: "rgba(255,255,255,0.09)",
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: 8,
          shadowColor: "#000", shadowOpacity: 0.65, shadowRadius: 26, shadowOffset: { width: 0, height: 14 }, elevation: 20,
          overflow: "hidden",
        }}
      >
        {/* glass lip */}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0.06)", "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 22 }}
        />

        {/* the blue aura above the active tab */}
        <TabGlow x={glowX} width={tabW} />

        {routes.map((route, i) => {
          const focused = i === idx;
          const Icon = ICONS[route.name] || Home;
          const label = LABELS[route.name] || route.name;
          const showLiveDot = route.name === "events" && hasLive && !focused;

          const onPress = () => {
            playNavFeedback();
            if (navigation && typeof navigation.emit === "function") {
              try {
                const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !ev?.defaultPrevented && typeof navigation.navigate === "function") {
                  navigation.navigate(route.name);
                  return;
                }
              } catch {}
            }
            if (!focused) router.replace((route.name === "index" ? "/(user)" : `/(user)/${route.name}`) as any);
          };

          return (
            <Pressable
              key={route.key || route.name}
              onPress={onPress}
              hitSlop={6}
              style={({ pressed }) => ({ flex: 1, alignItems: "center", justifyContent: "center", height: 52, opacity: pressed && !focused ? 0.6 : 1 })}
            >
              <View style={{ alignItems: "center", justifyContent: "center", gap: 3.5 }}>
                <View>
                  <Icon size={focused ? 22 : 20} color={focused ? "#ffffff" : c.fgSubtle} strokeWidth={focused ? 2.5 : 1.9} />
                  {showLiveDot ? (
                    <Animated.View
                      style={{
                        position: "absolute", top: -3, right: -4, width: 8, height: 8, borderRadius: 8,
                        backgroundColor: "#ff385c", borderWidth: 1.5, borderColor: "rgba(10,10,13,1)",
                        opacity: liveDot.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
                        transform: [{ scale: liveDot.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] }) }],
                      }}
                    />
                  ) : null}
                </View>
                <Txt size={focused ? 10.5 : 9.5} font={focused ? "sansBold" : "sansMed"} style={{ color: focused ? "#ffffff" : c.fgSubtle }}>
                  {label}
                </Txt>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function UserLayout() {
  return (
    <LiveProvider>
      <Tabs
        tabBar={(props: any) => <Dock {...props} />}
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="events" />
        <Tabs.Screen name="learn" />
        <Tabs.Screen name="tickets" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </LiveProvider>
  );
}
