import React from "react";
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { X, Star, Quote, BadgeCheck, Sparkles } from "lucide-react-native";
import { Txt, Button } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { initials } from "@/lib/format";
import type { TestimonialItem } from "@/lib/api";
import { playNavFeedback } from "@/lib/sound";
import { parseReviewData } from "@/components/HomeSections";

/* ──────────────────────────────────────────────────────────────────────────
   Full-Screen Performer Review Detail Modal
   - Shows unabridged review text without truncation
   - Displays 3D Mascot Character with studio spotlight
   - Verified performer credentials, dynamic star rating & role
   - 100% dynamic from TestimonialItem
   ────────────────────────────────────────────────────────────────────────── */

const CHARACTER_SRC = require("../../assets/banners/3d_avatar_character_cutout.png");

export function ReviewDetailModal({
  item,
  onClose,
}: {
  item: TestimonialItem | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!item) return null;

  const { rating, cleanMessage } = parseReviewData(item);

  const handleClose = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    playNavFeedback();
    onClose();
  };

  return (
    <Modal
      visible={Boolean(item)}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        {/* Ambient Top Glow */}
        <LinearGradient
          colors={["rgba(255, 56, 92, 0.22)", "rgba(139, 92, 246, 0.12)", "transparent"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.topGlow}
          pointerEvents="none"
        />

        {/* Top Navigation Bar */}
        <View style={styles.topBar}>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={({ pressed }) => [
              styles.closeBtn,
              { transform: [{ scale: pressed ? 0.92 : 1 }] },
            ]}
          >
            <X size={18} color="#ffffff" strokeWidth={2.4} />
          </Pressable>

          <View style={styles.topBadge}>
            <Sparkles size={12} color="#ff385c" />
            <Txt size={11} font="monoMed" tracking={1.5} uppercase style={{ color: "#ff385c" }}>
              Performer Story
            </Txt>
          </View>

          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* 3D Mascot Avatar Hero Card */}
          <View style={styles.heroCard}>
            <LinearGradient
              colors={["#161722", "#13141c"]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroTextCol}>
              <View style={styles.verifiedRow}>
                <BadgeCheck size={16} color="#22c55e" />
                <Txt size={12} font="sansBold" style={{ color: "#22c55e" }}>
                  Verified Performer
                </Txt>
              </View>
              <Txt size={18} font="sansBold" style={{ color: "#ffffff", marginTop: 4, letterSpacing: -0.3 }}>
                Live Stage Voice
              </Txt>
              <Txt size={12} font="sansMed" style={{ color: "#9ea3b8", marginTop: 2 }}>
                Real review from our platform
              </Txt>
            </View>

            <Image
              source={CHARACTER_SRC}
              style={styles.mascotImage}
              contentFit="contain"
              pointerEvents="none"
            />
          </View>

          {/* Reviewer Profile Card */}
          <View style={styles.reviewerCard}>
            <View style={styles.profileRow}>
              <View style={styles.avatarWrap}>
                {item.profile_image ? (
                  <AppImage uri={item.profile_image} seed={item._id} style={styles.avatarImage} />
                ) : (
                  <Txt size={18} font="sansExt" tone="accent">
                    {initials(item.person_name)}
                  </Txt>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Txt size={18} font="sansBold" style={{ color: "#ffffff", letterSpacing: -0.3 }}>
                  {item.person_name}
                </Txt>
                <Txt size={13} tone="subtle" style={{ marginTop: 2 }}>
                  {item.role || "Stage Performer"}
                </Txt>
              </View>
            </View>

            {/* Dynamic Star Rating Row: ONLY if rating was provided */}
            {rating !== null ? (
              <View style={styles.ratingRow}>
                <View style={styles.starsGroup}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star
                      key={i}
                      size={14}
                      color={i < Math.round(rating) ? "#fbbf24" : "rgba(255,255,255,0.22)"}
                      fill={i < Math.round(rating) ? "#fbbf24" : "transparent"}
                    />
                  ))}
                </View>
                <Txt size={13.5} font="sansExt" style={{ color: "#ffffff" }}>
                  {rating.toFixed(1)} / 5.0
                </Txt>
                <View style={styles.experiencePill}>
                  <Txt size={11} font="sansBold" tone="muted">
                    Stage Experience
                  </Txt>
                </View>
              </View>
            ) : (
              <View style={styles.ratingRow}>
                <View style={styles.experiencePill}>
                  <Txt size={11} font="sansBold" tone="muted">
                    Verified Performer Story
                  </Txt>
                </View>
              </View>
            )}
          </View>

          {/* Full Unabridged Review Body */}
          <View style={styles.reviewBodyCard}>
            <View style={styles.quoteIconWrap}>
              <Quote size={24} color="#ff385c" />
            </View>

            <Txt size={16.5} font="sansMed" lh={26} style={styles.fullMessage}>
              {cleanMessage}
            </Txt>
          </View>

          {/* Community Stamp */}
          <View style={styles.footnote}>
            <Txt size={12} font="monoMed" tone="subtle" style={{ textAlign: "center", letterSpacing: 0.5 }}>
              UPGRADE TALENTS INDIA • VERIFIED PERFORMER COMMUNITY
            </Txt>
          </View>
        </ScrollView>

        {/* Bottom Done Button */}
        <View style={styles.bottomBar}>
          <Button
            label="Back to stages"
            variant="primary"
            full
            onPress={handleClose}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0a0b10",
  },
  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 260,
  },
  topBar: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255, 56, 92, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 56, 92, 0.28)",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    gap: 16,
  },
  heroCard: {
    height: 120,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 20,
    position: "relative",
  },
  heroTextCol: {
    flex: 1,
    zIndex: 2,
    paddingRight: 100,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  mascotImage: {
    position: "absolute",
    right: 10,
    bottom: 0,
    width: 105,
    height: 120,
    zIndex: 1,
  },
  reviewerCard: {
    borderRadius: 24,
    backgroundColor: "#13141c",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 18,
    gap: 14,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#1b1d28",
    borderWidth: 2,
    borderColor: "rgba(255, 56, 92, 0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  starsGroup: {
    flexDirection: "row",
    gap: 2,
  },
  experiencePill: {
    marginLeft: "auto",
    paddingHorizontal: 10,
    paddingVertical: 3.5,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  reviewBodyCard: {
    borderRadius: 24,
    backgroundColor: "#13141c",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    padding: 22,
    gap: 14,
  },
  quoteIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 56, 92, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullMessage: {
    color: "rgba(255, 255, 255, 0.92)",
    letterSpacing: -0.2,
  },
  footnote: {
    paddingVertical: 10,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
});
