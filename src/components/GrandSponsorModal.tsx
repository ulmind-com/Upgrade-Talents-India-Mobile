import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Modal,
  Pressable,
  Dimensions,
  Linking,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as SecureStore from "expo-secure-store";
import * as Haptics from "expo-haptics";
import { X, Sparkles, ExternalLink, ArrowRight } from "lucide-react-native";
import { Txt, Button } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { playNavFeedback } from "@/lib/sound";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export type GrandSponsorConfig = {
  is_enabled?: boolean;
  title?: string;
  subtitle?: string;
  description?: string;
  banner_image_url?: string;
  mobile_image_url?: string;
  cta_label?: string;
  cta_link?: string;
  auto_close_seconds?: number;
  show_mode?: "once_per_session" | "once_per_day" | "every_time";
};

const SEEN_DAY_KEY = "uti_grand_sponsor_seen_day";
let sessionSeen = false;

export function GrandSponsorModal({
  popup,
}: {
  popup?: GrandSponsorConfig | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!popup || !popup.is_enabled) return;

    const checkFrequency = async () => {
      const mode = popup.show_mode || "once_per_session";
      if (mode === "once_per_session") {
        if (sessionSeen) return;
      } else if (mode === "once_per_day") {
        const today = new Date().toISOString().split("T")[0];
        try {
          const lastSeen = await SecureStore.getItemAsync(SEEN_DAY_KEY);
          if (lastSeen === today) return;
        } catch {}
      }

      // Small delay for entrance
      const timer = setTimeout(() => {
        playNavFeedback();
        setOpen(true);
        const autoSec = Number(popup.auto_close_seconds) || 0;
        if (autoSec > 0) {
          setCountdown(autoSec);
          Animated.timing(progressAnim, {
            toValue: 0,
            duration: autoSec * 1000,
            useNativeDriver: false,
          }).start();
        }
      }, 900);

      return () => clearTimeout(timer);
    };

    checkFrequency();
  }, [popup]);

  const handleClose = async () => {
    playNavFeedback();
    setOpen(false);
    sessionSeen = true;
    if (popup?.show_mode === "once_per_day") {
      const today = new Date().toISOString().split("T")[0];
      try {
        await SecureStore.setItemAsync(SEEN_DAY_KEY, today);
      } catch {}
    }
  };

  useEffect(() => {
    if (!open || countdown === null) return;
    if (countdown <= 0) {
      handleClose();
      return;
    }
    const t = setInterval(() => {
      setCountdown((c) => (c !== null ? c - 1 : null));
    }, 1000);
    return () => clearInterval(t);
  }, [open, countdown]);

  if (!popup || !popup.is_enabled) return null;

  const image = popup.mobile_image_url || popup.banner_image_url;
  const isExternal =
    popup.cta_link?.startsWith("http://") || popup.cta_link?.startsWith("https://");

  const onCtaPress = () => {
    playNavFeedback();
    handleClose();
    if (!popup.cta_link) return;
    if (isExternal) {
      Linking.openURL(popup.cta_link).catch(() => {});
    } else {
      router.push(popup.cta_link as any);
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.85)",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 20,
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 380,
            borderRadius: 26,
            overflow: "hidden",
            backgroundColor: "#13151f",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.14)",
            shadowColor: "#000",
            shadowOpacity: 0.6,
            shadowRadius: 24,
            elevation: 20,
          }}
        >
          {/* Close button */}
          <Pressable
            onPress={handleClose}
            hitSlop={10}
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              zIndex: 20,
              width: 32,
              height: 32,
              borderRadius: 999,
              backgroundColor: "rgba(0,0,0,0.65)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.2)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={16} color="#ffffff" />
          </Pressable>

          {/* Banner Graphic */}
          {image ? (
            <View style={{ width: "100%", height: 210 }}>
              <AppImage uri={image} style={{ width: "100%", height: "100%" }} />
              <LinearGradient
                colors={["transparent", "rgba(19, 21, 31, 0.8)", "#13151f"]}
                locations={[0, 0.7, 1]}
                style={{ position: "absolute", width: "100%", height: "100%" }}
              />
            </View>
          ) : (
            <View
              style={{
                height: 100,
                backgroundColor: "#1c1430",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={32} color="#c084fc" />
            </View>
          )}

          {/* Content Body */}
          <View style={{ padding: 20, paddingTop: image ? 4 : 20 }}>
            {popup.subtitle ? (
              <Txt
                size={11}
                font="monoMed"
                tracking={2}
                uppercase
                style={{ color: "#c084fc", marginBottom: 4 }}
              >
                {popup.subtitle}
              </Txt>
            ) : null}

            <Txt
              size={20}
              font="sansBold"
              lh={24}
              style={{ color: "#ffffff", letterSpacing: -0.3 }}
            >
              {popup.title || "Special Announcement"}
            </Txt>

            {popup.description ? (
              <Txt
                size={13.5}
                lh={19}
                style={{ color: "#9ea3b8", marginTop: 8 }}
              >
                {popup.description}
              </Txt>
            ) : null}

            {/* CTA Button */}
            <Pressable
              onPress={onCtaPress}
              style={({ pressed }) => ({
                marginTop: 18,
                height: 48,
                borderRadius: 14,
                overflow: "hidden",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              <LinearGradient
                colors={["#ff5e7a", "#ff385c", "#e0264b"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ position: "absolute", width: "100%", height: "100%" }}
              />
              <Txt size={14.5} font="sansBold" style={{ color: "#ffffff" }}>
                {popup.cta_label || "Explore now"}
              </Txt>
              {isExternal ? (
                <ExternalLink size={16} color="#ffffff" />
              ) : (
                <ArrowRight size={16} color="#ffffff" />
              )}
            </Pressable>

            {/* Countdown timer & progress bar */}
            {countdown !== null && countdown > 0 ? (
              <View style={{ marginTop: 14, gap: 6 }}>
                <View
                  style={{
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                    overflow: "hidden",
                  }}
                >
                  <Animated.View
                    style={{
                      height: "100%",
                      backgroundColor: "#ff385c",
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0%", "100%"],
                      }),
                    }}
                  />
                </View>
                <Txt
                  size={10.5}
                  align="center"
                  style={{ color: "#6b728a" }}
                >
                  Closing in {countdown}s
                </Txt>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}
