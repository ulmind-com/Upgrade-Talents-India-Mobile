import React, { useEffect, useRef } from "react";
import { View, Pressable, Animated, StyleSheet, Linking } from "react-native";
import { Image } from "expo-image";
import * as Application from "expo-application";
import Constants from "expo-constants";
import LottieView from "lottie-react-native";
import { Heart, ArrowUpRight } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";
import { playNavFeedback } from "@/lib/sound";

/* Read from the installed build, so it moves with every release on its own:
   version name from app.json "version", build number from EAS's
   auto-incremented versionCode. Expo Go has no build of ours, so there it
   falls back to the configured version. */
const APP_VERSION = (() => {
  const name = Application.nativeApplicationVersion && Constants.executionEnvironment !== "storeClient"
    ? Application.nativeApplicationVersion
    : Constants.expoConfig?.version;
  const build = Constants.executionEnvironment !== "storeClient" ? Application.nativeBuildVersion : null;
  return name ? `v${name}${build ? ` (${build})` : ""}` : "";
})();

export type BrandFooterProps = {
  tagline?: string;
};

export function BrandFooter({ tagline = "Own\nthe stage!" }: BrandFooterProps) {
  const { c } = useTheme();

  // Double-beat heartbeat animation
  const heartScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(heartScale, {
          toValue: 1.28,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(heartScale, {
          toValue: 1,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(heartScale, {
          toValue: 1.2,
          duration: 140,
          useNativeDriver: true,
        }),
        Animated.timing(heartScale, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.delay(1200),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [heartScale]);

  const handleOpenUlmind = () => {
    playNavFeedback();
    Linking.openURL("https://www.ulmind.com");
  };

  return (
    <View style={styles.container}>
      {/* Giant signature watermark with tight, balanced spacing & protected descenders */}
      <View style={styles.watermarkContainer}>
        {tagline.split("\n").map((line, idx, arr) => {
          const isLast = idx === arr.length - 1;
          return (
            <Txt
              key={idx}
              size={56}
              font="display"
              lh={isLast ? 58 : 54}
              tracking={-1.5}
              style={[
                styles.watermarkText,
                {
                  color: c.barStyle === "light" ? "rgba(255, 255, 255, 0.22)" : "rgba(0, 0, 0, 0.18)",
                  paddingBottom: isLast ? 12 : 0,
                  marginTop: idx > 0 ? -6 : 0,
                  overflow: "visible",
                },
              ]}
            >
              {line}
            </Txt>
          );
        })}
      </View>

      {/* Crafted with love in Kolkata, India + Indian Flag Lottie */}
      <View style={styles.metaRow}>
        <View style={styles.craftedBadge}>
          <Txt size={13} font="sansMed" tone="muted">
            Crafted with
          </Txt>

          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Heart size={14} color="#FF385C" fill="#FF385C" />
          </Animated.View>

          <Txt size={13} font="sansMed" tone="muted">
            in Kolkata, India
          </Txt>

          {/* Compact Waving Indian Flag Lottie */}
          <View style={styles.flagWrap}>
            <LottieView
              source={require("../../assets/Lottie/Indian Flag.json")}
              autoPlay
              loop
              style={styles.flagLottie}
            />
          </View>
        </View>

        {/* Designed & Developed by ULMIND */}
        <Pressable
          onPress={handleOpenUlmind}
          style={({ pressed }) => [
            styles.devRow,
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Txt size={11.5} tone="subtle" font="sansMed">
            Designed & Developed by
          </Txt>
          <View style={styles.devLogoWrap}>
            <Image
              source={require("../../assets/Logo/ulmind.png")}
              style={styles.devLogo}
              contentFit="contain"
            />
          </View>
          <ArrowUpRight size={13} color={c.fgSubtle} />
        </Pressable>

        {/* Brand identity caption */}
        <Txt
          size={10.5}
          font="monoMed"
          tone="subtle"
          style={{ letterSpacing: 1.8, marginTop: 4 }}
          uppercase
        >
          Upgrade Talents India{APP_VERSION ? ` • ${APP_VERSION}` : ""}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 36,
    paddingBottom: 40,
    alignItems: "flex-start",
    overflow: "visible",
  },
  watermarkContainer: {
    marginBottom: 4,
    paddingBottom: 0,
    overflow: "visible",
  },
  watermarkText: {
    textTransform: "none",
    fontWeight: "900",
  },
  metaRow: {
    gap: 8,
  },
  craftedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
  },
  flagWrap: {
    width: 22,
    height: 15,
    borderRadius: 3,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  flagLottie: {
    width: 28,
    height: 28,
  },
  devRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 2,
  },
  devLogoWrap: {
    height: 18,
    width: 60,
    justifyContent: "center",
  },
  devLogo: {
    width: "100%",
    height: "100%",
  },
});
