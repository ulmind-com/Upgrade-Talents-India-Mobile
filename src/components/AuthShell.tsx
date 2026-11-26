import React, { useCallback, useEffect, useRef } from "react";
import { View, Pressable, KeyboardAvoidingView, Platform, ScrollView, Animated, StyleSheet, Dimensions, AppState } from "react-native";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect } from "expo-router";
import { X } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt, Glow } from "@/components/ui";
import { AppImage } from "@/components/AppImage";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  seed = 1,
  parallax = false,
  video,
  poster,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  seed?: number;
  /** Hero drifts at half speed behind the form and stretches on pull-down. */
  parallax?: boolean;
  /** Looping, muted hero video (require(...)) — parallax mode only. */
  video?: number;
  /** Still frame shown until the video's first frame is ready. */
  poster?: number;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { c } = useTheme();
  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;

  if (parallax) {
    /* The photo sits behind the scroll view; a transparent spacer reveals it
       above the sheet. Scrolling up moves it at half speed (and fades it as
       the sheet covers it); pulling down scales it from the top edge so no
       gap ever opens. All on the native driver. */
    // the video keeps its own 16:9 frame (full width, nothing cropped), just
    // below the status bar; the sheet begins where the frame ends
    const VIDEO_H = Math.round((Dimensions.get("window").width * 9) / 16);
    const HERO = insets.top + VIDEO_H;
    const PEEK = HERO - 4;
    const translateY = scrollY.interpolate({
      inputRange: [-250, 0, HERO],
      outputRange: [125, 0, -HERO / 2],
      extrapolateLeft: "extend",
      extrapolateRight: "clamp",
    });
    const scale = scrollY.interpolate({ inputRange: [-250, 0], outputRange: [1 + 250 / HERO, 1], extrapolateRight: "clamp" });
    const fade = scrollY.interpolate({ inputRange: [0, PEEK + 60], outputRange: [1, 0.35], extrapolate: "clamp" });

    return (
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <StatusBar style="light" />
        <Animated.View
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: HERO, opacity: fade, transform: [{ translateY }, { scale }] }}
        >
          {/* video runs edge to edge, under the status bar too */}
          {video ? <HeroVideo source={video} poster={poster} /> : <AppImage seed={seed} style={StyleSheet.absoluteFill as any} />}
          {/* a soft scrim only behind the status bar so the clock/icons stay readable */}
          <LinearGradient
            colors={["rgba(0,0,0,0.45)", "rgba(0,0,0,0)"] as any}
            style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 48 }}
          />
        </Animated.View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Animated.ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 48 }}
            scrollEventThrottle={16}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
          >
            <View style={{ height: PEEK }} />
            <View
              style={{
                backgroundColor: c.bg,
                borderTopLeftRadius: 32,
                borderTopRightRadius: 32,
                paddingHorizontal: 24,
                paddingTop: 28,
                // at least a screen tall, so there's always room to scroll the photo away
                minHeight: Dimensions.get("window").height - 40,
                shadowColor: "#000",
                shadowOpacity: 0.45,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: -6 },
                elevation: 12,
              }}
            >
              <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.14)", marginTop: -14, marginBottom: 22 }} />
              <Txt size={11.5} font="sansBold" tracking={2.5} uppercase style={{ color: c.accent }}>{eyebrow}</Txt>
              <Txt size={34} font="display" tracking={-1} style={{ marginTop: 6, color: "#fff" }}>{title}</Txt>
              <Txt size={14.5} tone="muted" lh={21} style={{ marginTop: 6, marginBottom: 28 }}>{subtitle}</Txt>
              {children}
            </View>
          </Animated.ScrollView>
        </KeyboardAvoidingView>

        <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, left: 0, right: 0 }} pointerEvents="box-none">
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8 }} pointerEvents="box-none">
            <View />
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(user)"))}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(10, 11, 16, 0.55)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.16)",
                transform: [{ scale: pressed ? 0.92 : 1 }],
              })}
            >
              <X size={19} color="#fff" />
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["rgba(124, 58, 237, 0.32)", "rgba(255, 56, 92, 0.08)", "transparent"]}
        locations={[0, 0.5, 1]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 260 }}
        pointerEvents="none"
      />
      <View style={{ height: 230 }}>
        <AppImage seed={seed} style={{ width: "100%", height: "100%" }} />
        <LinearGradient colors={["rgba(4,5,12,0.45)", "rgba(4,5,12,0.3)", c.bg] as any} style={{ position: "absolute", width: "100%", height: "100%" }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, marginTop: -70 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 48 }}>
          <View
            style={{
              backgroundColor: c.bg,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              paddingHorizontal: 24,
              paddingTop: 28,
              minHeight: 600,
            }}
          >
            <Txt size={11.5} font="sansBold" tracking={2.5} uppercase style={{ color: "#C9F24A" }}>{eyebrow}</Txt>
            <Txt size={32} font="display" tracking={-1} style={{ marginTop: 8, color: "#fff" }}>{title}</Txt>
            <Txt size={14.5} tone="muted" lh={21} style={{ marginTop: 8, marginBottom: 26 }}>{subtitle}</Txt>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, right: 0 }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(user)"))}
          style={{ margin: 16, width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(20, 22, 30, 0.8)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.14)" }}
        >
          <X size={20} color="#fff" />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

/**
 * Muted, looping hero video. The poster shows instantly; the video fades in
 * on its first rendered frame. Pauses when the screen loses focus or the app
 * goes to the background, and never interrupts the user's own audio.
 */
function HeroVideo({ source, poster }: { source: number; poster?: number }) {
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
    const sub = AppState.addEventListener("change", (st) => (st === "active" ? player.play() : player.pause()));
    return () => sub.remove();
  }, [player]);

  return (
    <>
      {poster ? <Image source={poster} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          allowsPictureInPicture={false}
          surfaceType="textureView"
          onFirstFrameRender={() => Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }).start()}
        />
      </Animated.View>
    </>
  );
}
