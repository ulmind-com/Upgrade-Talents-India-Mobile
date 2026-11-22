import React, { useState, useMemo } from "react";
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import { Sparkles, Check, X } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt, Button } from "@/components/ui";
import { playNavFeedback } from "@/lib/sound";

export type AssetFile = { uri: string; name: string; type: string };

export type AvatarItem = {
  id: string;
  name: string;
  gender: "male" | "female" | "artist";
  tag: string;
  bg: string;
  source: any;
};

export const AVATAR_CATALOG: AvatarItem[] = [
  // ── Male Avatars ──
  { id: "m1", name: "Aarav", gender: "male", tag: "Beatmaker", bg: "#B6E3F4", source: require("../../assets/avatars/m1.png") },
  { id: "m2", name: "Kabir", gender: "male", tag: "Rockstar", bg: "#FFDFBF", source: require("../../assets/avatars/m2.png") },
  { id: "m3", name: "Rohan", gender: "male", tag: "Street Indie", bg: "#C4F4CB", source: require("../../assets/avatars/m3.png") },
  { id: "m4", name: "Dev", gender: "male", tag: "Vocalist", bg: "#C0AEDE", source: require("../../assets/avatars/m4.png") },
  { id: "m5", name: "Samir", gender: "male", tag: "Acoustic", bg: "#FFD5DC", source: require("../../assets/avatars/m5.png") },
  { id: "m6", name: "Vikram", gender: "male", tag: "Performer", bg: "#FDE68A", source: require("../../assets/avatars/m6.png") },

  // ── Female Avatars ──
  { id: "f1", name: "Ananya", gender: "female", tag: "Pop Diva", bg: "#FFD5DC", source: require("../../assets/avatars/f1.png") },
  { id: "f2", name: "Rhea", gender: "female", tag: "Soul Singer", bg: "#C0AEDE", source: require("../../assets/avatars/f2.png") },
  { id: "f3", name: "Priya", gender: "female", tag: "Dancer", bg: "#B6E3F4", source: require("../../assets/avatars/f3.png") },
  { id: "f4", name: "Meera", gender: "female", tag: "Classical", bg: "#FDE68A", source: require("../../assets/avatars/f4.png") },
  { id: "f5", name: "Zara", gender: "female", tag: "Cyber Glam", bg: "#FFDFBF", source: require("../../assets/avatars/f5.png") },
  { id: "f6", name: "Tara", gender: "female", tag: "Indie Pop", bg: "#C4F4CB", source: require("../../assets/avatars/f6.png") },

  // ── Creative / Artist Avatars ──
  { id: "c1", name: "Felix", gender: "artist", tag: "EDM Maestro", bg: "#D1D4F9", source: require("../../assets/avatars/c1.png") },
  { id: "c2", name: "Leo", gender: "artist", tag: "Stage Prodigy", bg: "#B6E3F4", source: require("../../assets/avatars/c2.png") },
  { id: "c3", name: "Nova", gender: "artist", tag: "Synthwave", bg: "#FFD5DC", source: require("../../assets/avatars/c3.png") },
  { id: "c4", name: "Milo", gender: "artist", tag: "Headliner", bg: "#FDE68A", source: require("../../assets/avatars/c4.png") },
];

/**
 * Resolves a local bundled avatar asset into a filesystem-accessible file URI
 * that React Native's FormData can upload reliably to the backend.
 */
export async function getAvatarAssetFile(item: AvatarItem): Promise<AssetFile> {
  const asset = Asset.fromModule(item.source);
  await asset.downloadAsync();
  const localUri = asset.localUri || asset.uri;

  if (localUri && localUri.startsWith("file://")) {
    return {
      uri: localUri,
      name: `${item.id}_${item.name.toLowerCase()}.png`,
      type: "image/png",
    };
  }

  // Ensure file is in cache directory for native multipart/form-data upload
  const dest = `${FileSystem.cacheDirectory}${item.id}_${item.name.toLowerCase()}.png`;
  try {
    if (localUri && (localUri.startsWith("http://") || localUri.startsWith("https://"))) {
      const dl = await FileSystem.downloadAsync(localUri, dest);
      return { uri: dl.uri, name: `${item.id}.png`, type: "image/png" };
    }
  } catch {
    // fallback to original uri
  }
  return { uri: localUri, name: `${item.id}.png`, type: "image/png" };
}

export type AvatarPickerModalProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (assetFile: AssetFile, item: AvatarItem) => void;
  selectedId?: string | null;
};

export function AvatarPickerModal({
  visible,
  onClose,
  onSelect,
  selectedId,
}: AvatarPickerModalProps) {
  const { c, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"all" | "male" | "female" | "artist">("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const filteredAvatars = useMemo(() => {
    if (activeTab === "all") return AVATAR_CATALOG;
    return AVATAR_CATALOG.filter((a) => a.gender === activeTab);
  }, [activeTab]);

  const handlePick = async (item: AvatarItem) => {
    playNavFeedback();
    setBusyId(item.id);
    try {
      const file = await getAvatarAssetFile(item);
      onSelect(file, item);
      onClose();
    } catch (err) {
      console.warn("Avatar selection error:", err);
      try {
        const a = Asset.fromModule(item.source);
        onSelect({ uri: a.uri, name: `${item.id}.png`, type: "image/png" }, item);
        onClose();
      } catch {
        // no-op
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: c.bgElevated,
              borderColor: c.borderStrong,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
        >
          {/* Handle */}
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: c.borderStrong }]} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Sparkles size={16} color={c.accent} />
                <Txt size={17} font="display">Choose an Avatar</Txt>
              </View>
              <Txt size={12} tone="muted">
                Pick a creative look for passes, leaderboards & stage.
              </Txt>
            </View>
            <Pressable
              onPress={() => {
                playNavFeedback();
                onClose();
              }}
              hitSlop={12}
              style={[styles.closeBtn, { backgroundColor: c.surface2 }]}
            >
              <X size={17} color={c.fg} />
            </Pressable>
          </View>

          {/* Filter Tabs */}
          <View style={styles.tabsRow}>
            {(
              [
                { id: "all", label: "All (16)" },
                { id: "male", label: "Male (6)" },
                { id: "female", label: "Female (6)" },
                { id: "artist", label: "Artists (4)" },
              ] as const
            ).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => {
                    playNavFeedback();
                    setActiveTab(tab.id);
                  }}
                  style={[
                    styles.tabPill,
                    {
                      backgroundColor: active ? c.accent : c.surface2,
                      borderColor: active ? c.accent : c.border,
                    },
                  ]}
                >
                  <Txt
                    size={11.5}
                    font={active ? "sansBold" : "sansMed"}
                    style={{ color: active ? c.onAccent : c.fgMuted }}
                  >
                    {tab.label}
                  </Txt>
                </Pressable>
              );
            })}
          </View>

          {/* Grid of Avatars */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <View style={styles.grid}>
              {filteredAvatars.map((item) => {
                const isSelected = selectedId === item.id;
                const isItemBusy = busyId === item.id;

                return (
                  <View key={item.id} style={styles.col}>
                    <Pressable
                      onPress={() => handlePick(item)}
                      style={({ pressed }) => [
                        styles.avatarCard,
                        { transform: [{ scale: pressed ? 0.92 : 1 }] },
                      ]}
                    >
                      {/* Avatar Circle */}
                      <View
                        style={[
                          styles.avatarCircle,
                          {
                            backgroundColor: isSelected ? "#C9F24A" : c.border,
                            shadowColor: isSelected ? "#C9F24A" : "#000",
                          },
                        ]}
                      >
                        <View style={[styles.avatarInner, { backgroundColor: item.bg }]}>
                          <Image
                            source={item.source}
                            style={styles.avatarImg}
                            contentFit="cover"
                            transition={150}
                          />
                        </View>

                        {/* Selected Check Badge */}
                        {isSelected && (
                          <View style={[styles.checkBadge, { borderColor: c.bg }]}>
                            <Check size={12} color="#000" strokeWidth={3} />
                          </View>
                        )}

                        {isItemBusy && (
                          <View style={[StyleSheet.absoluteFill, styles.busyOverlay]}>
                            <ActivityIndicator size="small" color="#fff" />
                          </View>
                        )}
                      </View>

                      {/* Name & Vibe */}
                      <Txt
                        size={12}
                        font={isSelected ? "sansBold" : "sansMed"}
                        numberOfLines={1}
                        style={{
                          marginTop: 6,
                          color: isSelected ? "#C9F24A" : c.fg,
                          textAlign: "center",
                        }}
                      >
                        {item.name}
                      </Txt>
                      <Txt
                        size={10}
                        tone="muted"
                        numberOfLines={1}
                        style={{ textAlign: "center" }}
                      >
                        {item.tag}
                      </Txt>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    maxHeight: Dimensions.get("window").height * 0.76,
  },
  handleWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 44,
    height: 4.5,
    borderRadius: 999,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -6,
  },
  col: {
    width: "25%",
    paddingHorizontal: 6,
    marginBottom: 16,
    alignItems: "center",
  },
  avatarCard: {
    alignItems: "center",
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 999,
    padding: 2.5,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarInner: {
    flex: 1,
    borderRadius: 999,
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  checkBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: "#C9F24A",
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  busyOverlay: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
});
