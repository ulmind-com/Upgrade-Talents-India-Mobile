import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Flame, Users, Trophy, Target, HeartHandshake, Music4, ArrowUpRight } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { publicApi, safe } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Card, Button } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { FadeInUp } from "@/components/FadeInUp";
import { DottedGrid } from "@/components/patterns";
import { genz } from "@/theme/tokens";

const VALUES = [
  { Icon: Flame, title: "Stage first", body: "Every decision starts with one question — does it make the performance better?" },
  { Icon: Users, title: "Open floor", body: "From first-timers to finalists, every dancer gets a fair shot at the spotlight." },
  { Icon: Trophy, title: "Real stakes", body: "Judged formats, transparent scoring and prizes that move careers forward." },
  { Icon: Target, title: "Built to scale", body: "Gate scanning, VIP access and live results — infrastructure made for crowds." },
  { Icon: HeartHandshake, title: "Community owned", body: "Crews, studios and choreographers shape the calendar alongside us." },
  { Icon: Music4, title: "Culture respected", body: "Street, classical, contemporary — every form gets its own stage." },
];

export default function About() {
  const { c } = useTheme();
  const router = useRouter();
  const { data } = useAsync(() => safe(publicApi.settings(), {} as any), []);
  const s: any = data || {};

  return (
    <SubScreen eyebrow="Who we are" title="About us">
      {/* Hero — cyan sectional colour */}
      <FadeInUp>
        <View style={{ borderRadius: 24, overflow: "hidden", marginBottom: 20 }}>
          <View style={{ height: 150 }}>
            <AppImage seed={4} style={{ width: "100%", height: "100%" }} />
            <LinearGradient colors={["rgba(17,120,200,0.55)", "rgba(10,40,90,0.9)"] as any} style={{ position: "absolute", width: "100%", height: "100%" }} />
            <DottedGrid color="rgba(255,255,255,0.22)" opacity={0.5} gap={18} />
            <View style={{ position: "absolute", bottom: 16, left: 18, right: 18 }}>
              <Txt size={24} font="display" tracking={-0.5} lh={27} style={{ color: "#fff" }}>{s?.brand_name || "Upgrade Talents India"}</Txt>
              <Txt size={13} style={{ color: "rgba(255,255,255,0.9)", marginTop: 4 }} numberOfLines={2}>{s?.tagline || "The team behind the stage."}</Txt>
            </View>
          </View>
        </View>
      </FadeInUp>

      {/* Story */}
      <FadeInUp delay={60}>
        <Card style={{ gap: 10, marginBottom: 22 }}>
          <Txt size={20} font="display" tracking={-0.5} uppercase>We build stages,{"\n"}not just events</Txt>
          <Txt size={14.5} tone="muted" lh={22}>
            {s?.description ||
              "Upgrade Talents India runs competitions, workshops and showcases where dancers get a real stage, real judging and a real audience. From the first audition to the final spotlight, everything is built around the performance."}
          </Txt>
        </Card>
      </FadeInUp>

      {/* Principles — each a different colour */}
      <Txt size={11} font="monoMed" tone="subtle" tracking={2.5} uppercase style={{ marginBottom: 12 }}>Our principles</Txt>
      <View style={{ gap: 12 }}>
        {VALUES.map((v, i) => {
          const [g1, g2] = genz(i);
          return (
            <FadeInUp key={v.title} delay={Math.min(i, 6) * 55}>
              <View style={{ flexDirection: "row", gap: 13, backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.border, padding: 14 }}>
                <View style={{ width: 44, height: 44, borderRadius: 13, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
                  <LinearGradient colors={[g1, g2] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", width: "100%", height: "100%" }} />
                  <v.Icon size={20} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt size={15.5} font="sansExt">{v.title}</Txt>
                  <Txt size={13} tone="muted" lh={19} style={{ marginTop: 3 }}>{v.body}</Txt>
                </View>
              </View>
            </FadeInUp>
          );
        })}
      </View>

      <View style={{ marginTop: 22, gap: 10 }}>
        <Button label="Browse events" full size="lg" onPress={() => router.push("/(user)/events")} iconRight={<ArrowUpRight size={17} color={c.onAccent} />} />
        <Button label="Contact us" variant="outline" full onPress={() => router.push("/(more)/contact")} />
      </View>
    </SubScreen>
  );
}
