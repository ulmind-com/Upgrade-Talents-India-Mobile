import React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Ticket, ShieldCheck, ChevronRight, Sparkles } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { Txt, GradientText, Glow } from "@/components/ui";

export default function ModeSelect() {
  const { c, fonts } = useTheme();
  const router = useRouter();
  const { setMode } = useSession();

  const choose = (m: "user" | "admin") => {
    setMode(m);
    router.replace(m === "admin" ? "/(admin)" : "/(user)");
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="light" />
      <LinearGradient colors={c.stageGrad as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.9 }} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 440 }} />
      <Glow color={c.stageBloom} size={420} top={-60} right={-120} />
      <LinearGradient colors={["transparent", c.bg] as any} style={{ position: "absolute", top: 220, left: 0, right: 0, height: 260 }} />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: "space-between", paddingBottom: 28 }}>
          <View style={{ paddingTop: 48 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                <LinearGradient colors={c.gradBrand as any} style={{ position: "absolute", width: "100%", height: "100%" }} />
                <Sparkles size={20} color="#fff" />
              </View>
              <Txt size={13} font="sansBold" tracking={2} uppercase style={{ color: "#fff" }}>
                Upgrade Talents{"\n"}
                <Txt size={9} tracking={5} style={{ color: "rgba(255,255,255,0.7)" }}>INDIA</Txt>
              </Txt>
            </View>

            <View style={{ marginTop: 56 }}>
              <Txt size={13} font="monoMed" tracking={3} uppercase style={{ color: "rgba(255,255,255,0.85)" }}>
                The stage is yours
              </Txt>
              <Txt size={44} font="display" lh={46} tracking={-1} style={{ color: "#fff", marginTop: 14 }}>
                Dance events,{"\n"}competitions &{"\n"}workshops.
              </Txt>
              <Txt size={15} lh={23} style={{ color: "rgba(255,255,255,0.82)", marginTop: 16, maxWidth: 320 }}>
                Book tickets, enter competitions, collect certificates — all from one app.
              </Txt>
            </View>
          </View>

          <View style={{ gap: 14 }}>
            <ModeCard
              title="Enter as attendee"
              subtitle="Browse events, book tickets & track your passes"
              icon={<Ticket size={22} color={c.onAccent} />}
              primary
              onPress={() => choose("user")}
            />
            <ModeCard
              title="Staff & Admin"
              subtitle="Control room — manage events, check-in & more"
              icon={<ShieldCheck size={22} color={c.fg} />}
              onPress={() => choose("admin")}
            />
            <Txt size={12} tone="subtle" align="center" style={{ marginTop: 4 }}>
              You can switch modes anytime from the menu.
            </Txt>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function ModeCard({
  title,
  subtitle,
  icon,
  onPress,
  primary,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onPress: () => void;
  primary?: boolean;
}) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          padding: 16,
          borderRadius: 22,
          borderWidth: 1,
          borderColor: primary ? "transparent" : c.borderStrong,
          backgroundColor: primary ? "transparent" : c.surface,
          overflow: "hidden",
        }}
      >
        {primary && <LinearGradient colors={c.gradBrand as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", width: "100%", height: "100%" }} />}
        <View style={{ width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: primary ? "rgba(255,255,255,0.2)" : c.surface2 }}>
          {icon}
        </View>
        <View style={{ flex: 1 }}>
          <Txt size={16} font="sansBold" style={{ color: primary ? c.onAccent : c.fg }}>{title}</Txt>
          <Txt size={12.5} style={{ color: primary ? "rgba(255,255,255,0.85)" : c.fgMuted, marginTop: 2 }}>{subtitle}</Txt>
        </View>
        <ChevronRight size={20} color={primary ? "rgba(255,255,255,0.9)" : c.fgSubtle} />
      </View>
    </Pressable>
  );
}
