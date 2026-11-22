import React from "react";
import { View, Pressable, ScrollView, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  Trophy,
  CalendarDays,
  GraduationCap,
  ShoppingBag,
  Gift,
  Award,
  Mic,
  ChevronRight,
  Flame,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";
import { playNavFeedback } from "@/lib/sound";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_GAP = 12;
const CARD_W = Math.round((SCREEN_W - 40 - CARD_GAP) / 2);

export type QuickAction = {
  label: string;
  badge?: string;
  icon: any;
  tone: string;
  onPress: () => void;
};

export function ExploreSection({
  onOpenCompetitions,
  onOpenEvents,
  quickActions,
}: {
  onOpenCompetitions: () => void;
  onOpenEvents: () => void;
  quickActions: QuickAction[];
}) {
  const { c } = useTheme();

  const handlePress = (fn: () => void) => {
    playNavFeedback();
    fn();
  };

  return (
    <View style={{ marginTop: 22, paddingHorizontal: 20 }}>
      {/* Explore Section Heading */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <Txt size={21} font="sansBold" style={{ color: "#ffffff", letterSpacing: -0.4 }}>
          Explore
        </Txt>
      </View>

      {/* Two Hero Feature Cards Side-by-Side (as shown in District screenshot) */}
      <View style={{ flexDirection: "row", gap: CARD_GAP }}>
        {/* Card 1: Competitions / Talents (Purple Glossy Card) */}
        <Pressable
          onPress={() => handlePress(onOpenCompetitions)}
          style={({ pressed }) => ({
            width: CARD_W,
            height: 92,
            borderRadius: 20,
            overflow: "hidden",
            backgroundColor: "#13151f",
            borderWidth: 1,
            borderColor: "rgba(139, 92, 246, 0.25)",
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            transform: [{ scale: pressed ? 0.97 : 1 }],
            shadowColor: "#8b5cf6",
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 6,
          })}
        >
          {/* Subtle Ambient Glow */}
          <LinearGradient
            colors={["rgba(139, 92, 246, 0.22)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: "absolute", width: "100%", height: "100%" }}
          />

          {/* 3D Glossy Purple Clapper / Trophy Container */}
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              backgroundColor: "rgba(124, 58, 237, 0.25)",
              borderWidth: 1,
              borderColor: "rgba(139, 92, 246, 0.4)",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#8b5cf6",
              shadowOpacity: 0.35,
              shadowRadius: 10,
            }}
          >
            <Trophy size={26} color="#c084fc" strokeWidth={2.2} />
          </View>

          <View style={{ flex: 1 }}>
            <Txt size={16} font="sansBold" style={{ color: "#ffffff", letterSpacing: -0.2 }}>
              Contests
            </Txt>
            <Txt size={11} style={{ color: "#9ea3b8", marginTop: 2 }}>
              Win prizes & cash
            </Txt>
          </View>
        </Pressable>

        {/* Card 2: Events / Shows (Golden Amber Card) */}
        <Pressable
          onPress={() => handlePress(onOpenEvents)}
          style={({ pressed }) => ({
            width: CARD_W,
            height: 92,
            borderRadius: 20,
            overflow: "hidden",
            backgroundColor: "#13151f",
            borderWidth: 1,
            borderColor: "rgba(245, 158, 11, 0.25)",
            paddingHorizontal: 14,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            transform: [{ scale: pressed ? 0.97 : 1 }],
            shadowColor: "#f59e0b",
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 6,
          })}
        >
          {/* Subtle Ambient Glow */}
          <LinearGradient
            colors={["rgba(245, 158, 11, 0.2)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: "absolute", width: "100%", height: "100%" }}
          />

          {/* 3D Glossy Golden Speaker Container */}
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              backgroundColor: "rgba(245, 158, 11, 0.22)",
              borderWidth: 1,
              borderColor: "rgba(245, 158, 11, 0.4)",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#f59e0b",
              shadowOpacity: 0.35,
              shadowRadius: 10,
            }}
          >
            <CalendarDays size={26} color="#fbbf24" strokeWidth={2.2} />
          </View>

          <View style={{ flex: 1 }}>
            <Txt size={16} font="sansBold" style={{ color: "#ffffff", letterSpacing: -0.2 }}>
              Events
            </Txt>
            <Txt size={11} style={{ color: "#9ea3b8", marginTop: 2 }}>
              Concerts & tours
            </Txt>
          </View>
        </Pressable>
      </View>

      {/* Horizontal Category Quick Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, marginTop: 14 }}
      >
        {quickActions.map((qa, i) => (
          <Pressable
            key={i}
            onPress={() => handlePress(qa.onPress)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              paddingHorizontal: 13,
              paddingVertical: 9,
              borderRadius: 999,
              backgroundColor: "#151722",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.08)",
              transform: [{ scale: pressed ? 0.95 : 1 }],
            })}
          >
            <qa.icon size={15} color={qa.tone} strokeWidth={2.2} />
            <Txt size={12} font="sansBold" style={{ color: "#ffffff" }}>
              {qa.label}
            </Txt>
            {qa.badge ? (
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 1.5,
                  borderRadius: 999,
                  backgroundColor: qa.tone + "22",
                }}
              >
                <Txt size={9} font="sansBold" style={{ color: qa.tone }}>
                  {qa.badge}
                </Txt>
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
