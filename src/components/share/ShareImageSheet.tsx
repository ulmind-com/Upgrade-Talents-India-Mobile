import React, { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, View, StyleSheet } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import { X, Share2 } from "lucide-react-native";
import { Txt } from "@/components/ui";
import { useAlert } from "@/components/Popup";

/* ──────────────────────────────────────────────────────────────────────────
   "Share as image" — District's Share Seat Map, generalised. Shows the
   branded card full-screen, and the button turns that exact card into a PNG
   (react-native-view-shot) and hands it to the system share sheet.
   ────────────────────────────────────────────────────────────────────────── */

export function ShareImageSheet({
  visible,
  onClose,
  cta,
  dialogTitle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  /** Button label, e.g. "Share seat map". */
  cta: string;
  dialogTitle?: string;
  /** The card that becomes the image. */
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const alert = useAlert();
  const card = useRef<any>(null);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (!card.current || busy) return;
    setBusy(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const uri = await captureRef(card, { format: "png", quality: 1, result: "tmpfile" });
      if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this device.");
      await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: dialogTitle || cta, UTI: "public.png" });
    } catch (e: any) {
      alert("error", "Couldn't share", e?.message || "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(4,5,9,0.94)" }}>
        <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 16, alignItems: "flex-end" }}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" style={({ pressed }) => [s.close, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
            <X size={19} color="#fff" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 20, paddingVertical: 16 }} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(380).easing(Easing.out(Easing.cubic))}>
            {/* collapsable={false} keeps this a real native view, so it can be captured */}
            <View ref={card} collapsable={false} style={{ backgroundColor: "transparent" }}>
              {children}
            </View>
          </Animated.View>
        </ScrollView>

        <Animated.View entering={FadeIn.delay(150).duration(300)} style={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 16, paddingTop: 8 }}>
          <Pressable
            onPress={share}
            disabled={busy}
            accessibilityRole="button"
            style={({ pressed }) => [s.cta, { opacity: busy ? 0.6 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
          >
            <Share2 size={18} color="#0B0C10" />
            <Txt size={16} font="sansBold" style={{ color: "#0B0C10" }}>{busy ? "Preparing…" : cta}</Txt>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  close: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  cta: {
    height: 56,
    borderRadius: 999,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
});
