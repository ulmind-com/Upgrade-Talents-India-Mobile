import React, { useEffect } from "react";
import { Modal, ScrollView, View, StyleSheet, useWindowDimensions } from "react-native";
import Animated, { Easing, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import ConfettiCannon from "react-native-confetti-cannon";
import LottieView from "lottie-react-native";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { Upload } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt, Button, GradientText, Glow } from "@/components/ui";
import { formatINR } from "@/lib/format";

/* The "you're in" moment after a competition registration — the same
   celebration the event booking ends on: confetti, the success Lottie and
   the chime, then a summary card with how the entry fee stands. */

export type RegistrationResult = {
  title: string;
  category?: string | null;
  reference?: string | null;
  fee: number;
  method: "ONLINE" | "CASH" | "FREE";
  /** false when Razorpay took the money but our verify call didn't come back clean. */
  verified?: boolean;
};

export function RegistrationSuccess({
  result,
  needsEntry,
  onSubmitEntry,
  onClose,
}: {
  result: RegistrationResult | null;
  /** The competition wants an entry uploaded next. */
  needsEntry: boolean;
  onSubmitEntry: () => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const player = useAudioPlayer(require("../../assets/sounds/success.wav"));

  useEffect(() => {
    if (!result) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      player.seekTo(0);
      player.play();
    } catch {}
  }, [result, player]);

  if (!result) return null;

  const status =
    result.method === "CASH"
      ? { text: `Pay ${formatINR(result.fee)} in cash at the venue counter`, color: "#F5C542" }
      : result.method === "FREE"
        ? { text: "Free entry · confirmed", color: "#34D399" }
        : result.verified === false
          ? { text: "Payment received · confirming", color: "#F5C542" }
          : { text: `Entry fee ${formatINR(result.fee)} paid`, color: "#34D399" };

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#07080E" }}>
        <StatusBar style="light" />
        <Glow color={c.spot1} size={360} top={-60} left={-80} />
        <Glow color={c.spot2} size={300} top={140} right={-100} />
        <ConfettiCannon
          count={130}
          origin={{ x: width / 2, y: -20 }}
          autoStart
          fadeOut
          explosionSpeed={360}
          fallSpeed={2900}
          colors={["#FF385C", "#F9862B", "#F5C542", "#ffffff", "#C084FC"]}
        />
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}
        >
          <LottieView source={require("../../assets/Lottie/Success.json")} autoPlay loop={false} style={{ width: 190, height: 190 }} />
          <GradientText size={40} tracking={-1} style={{ textAlign: "center" }}>{"YOU'RE IN!"}</GradientText>
          <Txt size={14.5} tone="muted" align="center" lh={21} style={{ marginTop: 8, maxWidth: 300 }}>
            {needsEntry ? "You're registered. Upload your entry to compete." : "You're registered for the competition."}
          </Txt>

          <Animated.View entering={FadeInDown.delay(250).duration(420).easing(Easing.out(Easing.cubic))} style={s.card}>
            {result.reference ? (
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt size={11} font="monoMed" tone="subtle" tracking={1.6} uppercase>Registration</Txt>
                <Txt size={13} font="monoMed" style={{ color: "#fff" }}>{result.reference}</Txt>
              </View>
            ) : null}
            <Txt size={17} font="sansBold" numberOfLines={2} style={{ color: "#fff" }}>{result.title}</Txt>
            {result.category ? (
              <View style={{ alignSelf: "flex-start", paddingHorizontal: 10, height: 28, borderRadius: 999, justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)" }}>
                <Txt size={12} font="sansSemi" style={{ color: "#fff" }}>{result.category}</Txt>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: status.color }} />
              <Txt size={13} font="sansSemi" style={{ color: status.color, flex: 1 }}>{status.text}</Txt>
            </View>
          </Animated.View>

          <View style={{ width: "100%", gap: 10, marginTop: 24 }}>
            {needsEntry ? (
              <Button label="Submit your entry" full size="lg" onPress={onSubmitEntry} icon={<Upload size={17} color={c.onAccent} />} />
            ) : null}
            <Button label={needsEntry ? "Later" : "Done"} variant={needsEntry ? "ghost" : "primary"} full size={needsEntry ? undefined : "lg"} onPress={onClose} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  card: {
    width: "100%",
    marginTop: 26,
    gap: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#11121A",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
});
