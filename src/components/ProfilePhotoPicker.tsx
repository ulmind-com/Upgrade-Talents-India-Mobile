import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Modal,
  ScrollView,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system/legacy";
import {
  Camera,
  Image as ImageIcon,
  Sparkles,
  Check,
  X,
  User,
  ArrowLeft,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt, Button } from "@/components/ui";
import { useAlert } from "@/components/Popup";
import { playNavFeedback } from "@/lib/sound";
import { initials } from "@/lib/format";
import {
  AVATAR_CATALOG,
  AvatarItem,
  AssetFile,
  getAvatarAssetFile,
} from "@/components/AvatarPickerModal";

export type { AssetFile, AvatarItem };
export { AVATAR_CATALOG };

export type ProfilePhotoPickerProps = {
  photo: AssetFile | null;
  onChange: (photo: AssetFile | null) => void;
  userName?: string;
};

export function ProfilePhotoPicker({
  photo,
  onChange,
  userName = "You",
}: ProfilePhotoPickerProps) {
  const { c, fonts } = useTheme();
  const alert = useAlert();

  const [activeTab, setActiveTab] = useState<"all" | "male" | "female" | "artist">("all");
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Filter avatars
  const filteredAvatars = useMemo(() => {
    if (activeTab === "all") return AVATAR_CATALOG;
    return AVATAR_CATALOG.filter((a) => a.gender === activeTab);
  }, [activeTab]);

  // Selected avatar object if any
  const currentAvatar = useMemo(() => {
    if (!selectedAvatarId) return null;
    return AVATAR_CATALOG.find((a) => a.id === selectedAvatarId) || null;
  }, [selectedAvatarId]);

  // Select an avatar from the catalog
  const handleSelectAvatar = async (item: AvatarItem) => {
    playNavFeedback();
    setSelectedAvatarId(item.id);
    setBusy(true);

    try {
      const file = await getAvatarAssetFile(item);
      onChange(file);
    } catch (err) {
      console.warn("Avatar select error:", err);
      try {
        const a = Asset.fromModule(item.source);
        onChange({ uri: a.uri, name: `${item.id}.png`, type: "image/png" });
      } catch {
        // no-op
      }
    } finally {
      setBusy(false);
    }
  };

  // Launch camera with 1:1 square crop
  const handleCamera = async () => {
    playNavFeedback();
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        alert("error", "Camera Permission", "Please grant camera access in system settings to take a profile picture.");
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (!res.canceled && res.assets?.[0]) {
        const a = res.assets[0];
        setSelectedAvatarId(null);
        onChange({
          uri: a.uri,
          name: a.fileName || `photo_${Date.now()}.jpg`,
          type: a.mimeType || "image/jpeg",
        });
      }
    } catch {
      alert("error", "Camera", "Unable to open camera.");
    }
  };

  // Launch gallery picker with 1:1 square crop
  const handleGallery = async () => {
    playNavFeedback();
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (!res.canceled && res.assets?.[0]) {
        const a = res.assets[0];
        setSelectedAvatarId(null);
        onChange({
          uri: a.uri,
          name: a.fileName || a.uri.split("/").pop() || `gallery_${Date.now()}.jpg`,
          type: a.mimeType || "image/jpeg",
        });
      }
    } catch {
      alert("error", "Gallery", "Unable to open photo library.");
    }
  };

  // Clear photo / avatar
  const handleClear = () => {
    playNavFeedback();
    setSelectedAvatarId(null);
    onChange(null);
  };

  return (
    <View style={{ gap: 24, paddingVertical: 4 }}>
      {/* ── HERO PREVIEW ── */}
      <View style={{ alignItems: "center" }}>
        {/* Glow ambient background behind the avatar */}
        <View
          style={{
            position: "absolute",
            width: 150,
            height: 150,
            borderRadius: 999,
            backgroundColor: selectedAvatarId ? c.accent : "#8A2BE2",
            opacity: 0.16,
            top: -15,
          }}
        />

        {/* Outer Ring */}
        <View
          style={{
            width: 124,
            height: 124,
            borderRadius: 999,
            padding: 3,
            backgroundColor: photo ? (selectedAvatarId ? "#C9F24A" : c.accent) : c.borderStrong,
            shadowColor: photo ? (selectedAvatarId ? "#C9F24A" : c.accent) : "#000",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 14,
            elevation: 8,
          }}
        >
          <View
            style={{
              flex: 1,
              borderRadius: 999,
              overflow: "hidden",
              backgroundColor: currentAvatar?.bg || c.surface2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {photo?.uri ? (
              <Image
                source={{ uri: photo.uri }}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <LinearGradient
                colors={c.gradBrand as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: "100%",
                  height: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Txt size={42} font="display" style={{ color: "#fff" }}>
                  {initials(userName)}
                </Txt>
              </LinearGradient>
            )}

            {busy && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: "rgba(0,0,0,0.5)",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                ]}
              >
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}
          </View>

          {/* Floating Action Badge */}
          <View
            style={{
              position: "absolute",
              bottom: 2,
              right: 2,
              width: 34,
              height: 34,
              borderRadius: 999,
              backgroundColor: selectedAvatarId ? "#C9F24A" : photo ? c.accent : c.surface2,
              borderWidth: 2.5,
              borderColor: c.bg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {selectedAvatarId ? (
              <Sparkles size={16} color="#000" />
            ) : photo ? (
              <Camera size={15} color="#fff" />
            ) : (
              <User size={15} color={c.fgSubtle} />
            )}
          </View>
        </View>

        {/* Status & Label */}
        <View style={{ alignItems: "center", marginTop: 14, gap: 4 }}>
          {currentAvatar ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "rgba(201, 242, 74, 0.12)",
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "rgba(201, 242, 74, 0.3)",
              }}
            >
              <Sparkles size={13} color="#C9F24A" />
              <Txt size={12.5} font="sansBold" style={{ color: "#C9F24A" }}>
                {currentAvatar.name} ({currentAvatar.tag})
              </Txt>
            </View>
          ) : photo ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "rgba(255, 56, 92, 0.12)",
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: "rgba(255, 56, 92, 0.3)",
              }}
            >
              <Check size={13} color={c.accent} />
              <Txt size={12.5} font="sansBold" tone="accent">
                Custom photo attached
              </Txt>
            </View>
          ) : (
            <Txt size={13} tone="muted">
              Choose your look below (or skip to use initials)
            </Txt>
          )}

          {photo && (
            <Pressable
              onPress={handleClear}
              hitSlop={8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                marginTop: 4,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
              }}
            >
              <X size={13} color={c.fgSubtle} />
              <Txt size={12} tone="muted" style={{ textDecorationLine: "underline" }}>
                Remove photo
              </Txt>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── PHOTO UPLOAD ACTION BUTTONS ── */}
      <View style={{ flexDirection: "row", gap: 12 }}>
        {/* Camera Button */}
        <Pressable
          onPress={handleCamera}
          style={({ pressed }) => [
            {
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 14,
              borderRadius: 16,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.border,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              backgroundColor: "rgba(255, 56, 92, 0.14)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Camera size={19} color={c.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={13.5} font="sansBold">Take selfie</Txt>
            <Txt size={11.5} tone="muted">Open camera</Txt>
          </View>
        </Pressable>

        {/* Gallery Button */}
        <Pressable
          onPress={handleGallery}
          style={({ pressed }) => [
            {
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 14,
              paddingHorizontal: 14,
              borderRadius: 16,
              backgroundColor: c.surface,
              borderWidth: 1,
              borderColor: c.border,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              backgroundColor: "rgba(201, 242, 74, 0.14)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ImageIcon size={19} color="#C9F24A" />
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={13.5} font="sansBold">Gallery</Txt>
            <Txt size={11.5} tone="muted">Choose file</Txt>
          </View>
        </Pressable>
      </View>

      {/* ── SECTION DIVIDER ── */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 2 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: c.surface2,
          }}
        >
          <Sparkles size={12} color={c.accent} />
          <Txt size={11} font="mono" tone="muted" style={{ letterSpacing: 0.8 }}>
            OR CHOOSE AN ARTIST AVATAR
          </Txt>
        </View>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      </View>

      {/* ── CATEGORY FILTER TABS ── */}
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "center" }}>
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
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: active ? c.accent : c.surface2,
                borderWidth: 1,
                borderColor: active ? c.accent : c.border,
              }}
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

      {/* ── AVATARS GRID (4 COLUMNS) ── */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          marginHorizontal: -6,
          justifyContent: "flex-start",
        }}
      >
        {filteredAvatars.map((item) => {
          const isSelected = selectedAvatarId === item.id;
          return (
            <View
              key={item.id}
              style={{
                width: "25%",
                paddingHorizontal: 6,
                marginBottom: 16,
                alignItems: "center",
              }}
            >
              <Pressable
                onPress={() => handleSelectAvatar(item)}
                style={({ pressed }) => [
                  {
                    alignItems: "center",
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                  },
                ]}
              >
                {/* Avatar Circle */}
                <View
                  style={{
                    width: 66,
                    height: 66,
                    borderRadius: 999,
                    padding: 2.5,
                    backgroundColor: isSelected ? "#C9F24A" : c.border,
                    shadowColor: isSelected ? "#C9F24A" : "#000",
                    shadowOffset: { width: 0, height: 3 },
                    shadowOpacity: isSelected ? 0.45 : 0.15,
                    shadowRadius: isSelected ? 8 : 4,
                    elevation: isSelected ? 6 : 2,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      borderRadius: 999,
                      overflow: "hidden",
                      backgroundColor: item.bg,
                    }}
                  >
                    <Image
                      source={item.source}
                      style={{ width: "100%", height: "100%" }}
                      contentFit="cover"
                      transition={150}
                    />
                  </View>

                  {/* Selected check badge */}
                  {isSelected && (
                    <View
                      style={{
                        position: "absolute",
                        top: -2,
                        right: -2,
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        backgroundColor: "#C9F24A",
                        borderWidth: 1.5,
                        borderColor: c.bg,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Check size={12} color="#000" strokeWidth={3} />
                    </View>
                  )}
                </View>

                {/* Avatar Name & Tag */}
                <Txt
                  size={11.5}
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
                  size={9.5}
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

      {/* Helpful Hint Footer */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 9,
          borderRadius: 14,
          backgroundColor: c.surface2,
          padding: 12,
        }}
      >
        <Sparkles size={16} color={c.accent} />
        <Txt size={11.5} tone="muted" lh={16} style={{ flex: 1 }}>
          Your avatar appears on your passes, leaderboards, and stage lineup. You can change it anytime in settings.
        </Txt>
      </View>
    </View>
  );
}

export type ProfilePhotoModalProps = {
  visible: boolean;
  onClose: () => void;
  photo: AssetFile | null;
  onChange: (photo: AssetFile | null) => void;
  userName?: string;
};

export function ProfilePhotoModal({
  visible,
  onClose,
  photo,
  onChange,
  userName,
}: ProfilePhotoModalProps) {
  const { c } = useTheme();
  const [draft, setDraft] = useState<AssetFile | null>(photo);

  useEffect(() => {
    if (visible) setDraft(photo);
  }, [visible, photo]);

  const handleApply = () => {
    playNavFeedback();
    onChange(draft);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: c.bg }}>
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          {/* Full Screen Top Navigation Bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: c.border,
            }}
          >
            <Pressable
              onPress={() => {
                playNavFeedback();
                onClose();
              }}
              hitSlop={10}
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: c.surface2,
                borderWidth: 1,
                borderColor: c.border,
              }}
            >
              <ArrowLeft size={19} color={c.fg} />
            </Pressable>

            <View style={{ flex: 1, alignItems: "center", marginHorizontal: 10 }}>
              <Txt size={17} font="display">Choose Your Look</Txt>
              <Txt size={11.5} tone="muted">Selfie, gallery, or artist avatar</Txt>
            </View>

            <Pressable
              onPress={handleApply}
              hitSlop={10}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: "rgba(201, 242, 74, 0.15)",
                borderWidth: 1,
                borderColor: "rgba(201, 242, 74, 0.35)",
              }}
            >
              <Txt size={13} font="sansBold" style={{ color: "#C9F24A" }}>Done</Txt>
            </Pressable>
          </View>

          {/* Full Height Scrollable Content */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 }}
          >
            <ProfilePhotoPicker
              photo={draft}
              onChange={setDraft}
              userName={userName}
            />
          </ScrollView>

          {/* Sticky Bottom Action CTA */}
          <View
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: Platform.OS === "ios" ? 8 : 14,
              borderTopWidth: 1,
              borderTopColor: c.border,
              backgroundColor: c.bg,
            }}
          >
            <Button
              label="Save & Apply Look"
              size="lg"
              full
              onPress={handleApply}
              iconRight={<Check size={18} color={c.onAccent} />}
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    maxHeight: Dimensions.get("window").height * 0.88,
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
});
