import React, { useCallback, useEffect, useRef } from "react";
import { View, StyleSheet, Animated, AppState } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { LinearGradient } from "expo-linear-gradient";
import {
  Flame,
  Users,
  Trophy,
  Target,
  HeartHandshake,
  Music4,
  ArrowUpRight,
  Sparkles,
  ShieldCheck,
  Headphones,
  Ticket,
} from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt, Card, Button } from "@/components/ui";
import { FadeInUp } from "@/components/FadeInUp";
import { genz } from "@/theme/tokens";

const ABOUT_VIDEO = require("../../assets/Video/13442340_1920_1080_30fps.mp4");

const VALUES = [
  {
    Icon: Flame,
    title: "Stage first",
    body: "Every decision starts with one question — does it make the performance and artist experience better?",
  },
  {
    Icon: Users,
    title: "Open floor",
    body: "From first-time auditionees to national finalists, every performer gets an equal shot at the spotlight.",
  },
  {
    Icon: Trophy,
    title: "Real stakes",
    body: "Transparent judging, verifiable scoring, and cash & stage rewards that move careers forward.",
  },
  {
    Icon: Target,
    title: "Built to scale",
    body: "Instant digital QR check-in, VIP pass tiers, and live leaderboards engineered for arena crowds.",
  },
  {
    Icon: HeartHandshake,
    title: "Community driven",
    body: "Crews, academies, mentors, and fans shape the season calendar alongside our curators.",
  },
  {
    Icon: Music4,
    title: "Culture respected",
    body: "Vocal, instrumental, classical, street dance, and contemporary — every art form gets its dedicated stage.",
  },
];

function AboutHeroVideo({ source }: { source: any }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.audioMixingMode = "mixWithOthers";
    p.play();
  });
  const fade = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      player.play();
      return () => player.pause();
    }, [player])
  );

  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) =>
      st === "active" ? player.play() : player.pause()
    );
    return () => sub.remove();
  }, [player]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
        surfaceType="textureView"
        onFirstFrameRender={() =>
          Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start()
        }
      />
    </Animated.View>
  );
}

export default function About() {
  const { c } = useTheme();
  const router = useRouter();

  return (
    <SubScreen eyebrow="Who we are" title="About us">
      {/* 1. Hero Video — High Production Live Stage */}
      <FadeInUp>
        <View
          style={{
            height: 220,
            borderRadius: 24,
            overflow: "hidden",
            marginBottom: 20,
            backgroundColor: "#0d0f17",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.12)",
            position: "relative",
          }}
        >
          {/* Looping concert video */}
          <AboutHeroVideo source={ABOUT_VIDEO} />

          {/* Atmospheric gradient overlay for contrast */}
          <LinearGradient
            colors={[
              "rgba(8, 9, 13, 0.4)",
              "rgba(8, 9, 13, 0.15)",
              "rgba(8, 9, 13, 0.96)",
            ]}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Bottom Brand Title & Tagline */}
          <View style={{ position: "absolute", bottom: 16, left: 18, right: 18 }}>
            <Txt size={20} font="display" tracking={-0.4} lh={24} style={{ color: "#FFFFFF" }}>
              Upgrade Talents India
            </Txt>
            <Txt size={12} font="sansMed" style={{ color: "#C9F24A", marginTop: 3 }}>
              Discover, Book & Experience Live Talent
            </Txt>
          </View>
        </View>
      </FadeInUp>

      {/* 2. Platform Story */}
      <FadeInUp delay={60}>
        <Card style={{ gap: 10, marginBottom: 16, backgroundColor: c.surface, borderColor: c.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Sparkles size={18} color={c.accent} />
            <Txt size={11} font="monoMed" tone="accent" tracking={2} uppercase>
              Our Mission
            </Txt>
          </View>
          <Txt size={21} font="display" tracking={-0.5} uppercase>
            We build stages,{"\n"}not just events
          </Txt>
          <Txt size={14.5} tone="muted" lh={22} style={{ textAlign: "justify" }}>
            Upgrade Talents India is India’s premier live entertainment and talent discovery platform.
            We connect audiences with electrifying concerts, fair auditions, workshops, and
            masterclasses by leading industry artists. From your very first audition to the grand
            spotlight, everything is built for the performance.
          </Txt>
        </Card>
      </FadeInUp>

      {/* 3. 4 High-Impact Stat Pills */}
      <FadeInUp delay={80}>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 22 }}>
          <StatPill icon={<Sparkles size={14} color="#C9F24A" />} value="100+" label="Live Stages" />
          <StatPill icon={<Users size={14} color="#F76F1C" />} value="50K+" label="Fans & Stars" />
          <StatPill icon={<Ticket size={14} color="#38BDF8" />} value="100%" label="Verified Pass" />
          <StatPill icon={<Headphones size={14} color="#A78BFA" />} value="24/7" label="Support" />
        </View>
      </FadeInUp>

      {/* 4. Principles List */}
      <Txt
        size={11}
        font="monoMed"
        tone="subtle"
        tracking={2.5}
        uppercase
        style={{ marginBottom: 12 }}
      >
        Our principles
      </Txt>
      <View style={{ gap: 12 }}>
        {VALUES.map((v, i) => {
          const [g1, g2] = genz(i);
          return (
            <FadeInUp key={v.title} delay={Math.min(i, 6) * 45 + 100}>
              <View
                style={{
                  flexDirection: "row",
                  gap: 13,
                  backgroundColor: c.surface,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: c.border,
                  padding: 14,
                }}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 13,
                    overflow: "hidden",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <LinearGradient
                    colors={[g1, g2] as any}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ position: "absolute", width: "100%", height: "100%" }}
                  />
                  <v.Icon size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt size={15.5} font="sansExt">
                    {v.title}
                  </Txt>
                  <Txt size={13} tone="muted" lh={19} style={{ marginTop: 3, textAlign: "justify" }}>
                    {v.body}
                  </Txt>
                </View>
              </View>
            </FadeInUp>
          );
        })}
      </View>

      {/* 5. Action Buttons */}
      <View style={{ marginTop: 22, gap: 10 }}>
        <Button
          label="Browse live events"
          full
          size="lg"
          onPress={() => router.push("/(user)/events")}
          iconRight={<ArrowUpRight size={17} color={c.onAccent} />}
        />
        <Button
          label="Contact support"
          variant="outline"
          full
          onPress={() => router.push("/(more)/contact")}
        />
      </View>
    </SubScreen>
  );
}

function StatPill({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  const { c } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border,
        paddingVertical: 10,
        paddingHorizontal: 6,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={{ marginBottom: 4 }}>{icon}</View>
      <Txt size={15} font="display" tracking={-0.3} style={{ color: "#FFFFFF" }}>
        {value}
      </Txt>
      <Txt size={10} font="monoMed" tone="subtle" numberOfLines={1} style={{ marginTop: 2 }}>
        {label}
      </Txt>
    </View>
  );
}
