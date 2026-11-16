import React from "react";
import { View, Pressable, Dimensions } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Home, CalendarDays, GraduationCap, QrCode, User } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";

type BottomTabBarProps = {
  state: { index: number; routes: { key: string; name: string; state?: any }[] };
  navigation: any;
};

const ICONS: Record<string, any> = {
  index: Home,
  events: CalendarDays,
  learn: GraduationCap,
  tickets: QrCode,
  profile: User,
};

const LABELS: Record<string, string> = {
  index: "Home",
  events: "Events",
  learn: "Learn",
  tickets: "Tickets",
  profile: "Profile",
};

const TAB_ORDER = ["index", "events", "learn", "tickets", "profile"];

function TabBar({ state, navigation }: BottomTabBarProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = Dimensions.get("window");

  const activeTab: any = state.routes[state.index];
  const nested = activeTab?.state;
  const nestedRoute = nested?.routes?.[nested.index ?? 0]?.name;
  const hidden = !!nestedRoute && nestedRoute !== "index";

  const routes = state.routes.filter((r) => TAB_ORDER.includes(r.name));
  const idx = Math.max(0, routes.findIndex((r) => r.key === state.routes[state.index]?.key));

  if (hidden) return null;

  const barWidth = Math.min(width - 28, 420);

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: "center",
        paddingBottom: Math.max(insets.bottom, 12),
      }}
    >
      {/* Floating Pill Capsule Dock */}
      <View
        style={{
          width: barWidth,
          height: 62,
          borderRadius: 999,
          backgroundColor: "rgba(20, 22, 30, 0.95)",
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.12)",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 8,
          shadowColor: "#000",
          shadowOpacity: 0.5,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 10 },
          elevation: 16,
        }}
      >
        {routes.map((route, i) => {
          const focused = i === idx;
          const Icon = ICONS[route.name] || Home;
          const label = LABELS[route.name] || route.name;

          const onPress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            const ev = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !ev.defaultPrevented) navigation.navigate(route.name as never);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              hitSlop={6}
              style={{
                flex: focused ? 1.25 : 1,
                alignItems: "center",
                justifyContent: "center",
                height: 48,
              }}
            >
              {focused ? (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 13,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: "rgba(255, 255, 255, 0.12)",
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.14)",
                  }}
                >
                  <Icon size={18} color="#ffffff" strokeWidth={2.4} />
                  <Txt size={11.5} font="sansBold" style={{ color: "#ffffff" }}>
                    {label}
                  </Txt>
                </View>
              ) : (
                <View style={{ alignItems: "center", justifyContent: "center", gap: 3 }}>
                  <Icon size={19} color="#8e93a8" strokeWidth={1.9} />
                  <Txt size={10} font="sansMed" style={{ color: "#8e93a8" }}>
                    {label}
                  </Txt>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function UserLayout() {
  return (
    <Tabs tabBar={(props: any) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="events" />
      <Tabs.Screen name="learn" />
      <Tabs.Screen name="tickets" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
