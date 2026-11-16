import React, { useCallback, useEffect, useState } from "react";
import { View, Pressable, ScrollView, Modal, ActivityIndicator, Alert as RNAlert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  X,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  UserCheck,
  CalendarDays,
  Sparkles,
  Upload,
  FileText,
  Image as ImageIcon,
  Camera,
  FolderOpen,
} from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { kycApi, safe, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Button, Card } from "@/components/ui";
import { SignInPrompt } from "@/components/SignInPrompt";
import { FadeInUp } from "@/components/FadeInUp";
import { formatEventDate } from "@/lib/format";

/* ═══════════════════════════════════════════════════════════════════
   AADHAAR KYC PANEL — 1:1 Parity with Website (AadhaarKyc.tsx)
   Document Upload & UIDAI Verhoeff Checksum Verification
   ═══════════════════════════════════════════════════════════════════ */

export default function Kyc() {
  const { c } = useTheme();
  const { user } = useSession();
  const [modalOpen, setModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const q = useAsync(
    () => (user ? safe(kycApi.status(), null as any) : Promise.resolve(null)),
    [user?.email],
    { refetchOnFocus: true }
  );

  const kyc = q.data;
  const verified = Boolean(
    kyc?.is_verified ||
    kyc?.status === "VERIFIED" ||
    kyc?.kyc_status === "VERIFIED" ||
    kyc?.verified === true
  );

  if (!user) {
    return (
      <SubScreen eyebrow="Identity" title="Aadhaar KYC">
        <SignInPrompt message="Sign in to view and verify your government Aadhaar ID." />
      </SubScreen>
    );
  }

  return (
    <SubScreen
      eyebrow="Identity"
      title="Aadhaar KYC"
      refreshing={q.refreshing}
      onRefresh={q.refresh}
    >
      {/* Verification Notice Banner */}
      {notice ? (
        <FadeInUp>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 9,
              borderRadius: 14,
              backgroundColor: "rgba(201, 242, 74, 0.12)",
              borderWidth: 1,
              borderColor: "rgba(201, 242, 74, 0.3)",
              paddingHorizontal: 16,
              paddingVertical: 12,
              marginBottom: 16,
            }}
          >
            <Sparkles size={16} color="#C9F24A" />
            <Txt size={13} font="sansSemi" style={{ color: "#C9F24A", flex: 1 }}>
              {notice}
            </Txt>
          </View>
        </FadeInUp>
      ) : null}

      <FadeInUp>
        <Card
          padding={0}
          style={{
            overflow: "hidden",
            backgroundColor: "#14161E",
            borderColor: "rgba(255, 255, 255, 0.08)",
            borderRadius: 22,
          }}
        >
          {/* Header Bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 18,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: "#1b1d28",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {verified ? (
                  <ShieldCheck size={20} color="#22C55E" />
                ) : (
                  <ShieldAlert size={20} color="#FF385C" />
                )}
              </View>
              <View>
                <Txt size={15} font="sansBold" uppercase tracking={0.5} style={{ color: "#ffffff" }}>
                  Aadhaar ID Verification
                </Txt>
                <Txt size={10} font="monoMed" uppercase tracking={1} tone="subtle" style={{ marginTop: 2 }}>
                  Government Identity Verification
                </Txt>
              </View>
            </View>

            {verified ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  backgroundColor: "rgba(34, 197, 94, 0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(34, 197, 94, 0.3)",
                  paddingHorizontal: 11,
                  paddingVertical: 5,
                  borderRadius: 999,
                }}
              >
                <CheckCircle2 size={13} color="#22C55E" />
                <Txt size={11} font="sansBold" style={{ color: "#22C55E" }}>
                  Verified
                </Txt>
              </View>
            ) : (
              <View
                style={{
                  backgroundColor: "#1b1d28",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                }}
              >
                <Txt size={10} font="monoMed" uppercase tracking={1} tone="subtle">
                  Not verified
                </Txt>
              </View>
            )}
          </View>

          {/* Card Body */}
          {q.loading ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 22 }}>
              <ActivityIndicator size="small" color="#FF385C" />
              <Txt size={13.5} tone="muted">
                Checking Aadhaar verification status…
              </Txt>
            </View>
          ) : verified ? (
            /* Verified Details View */
            <View>
              {[
                { k: "Masked Aadhaar", v: kyc?.aadhaar_masked, Icon: Lock, mono: true },
                { k: "Verified Name", v: kyc?.verified_name || user?.name, Icon: UserCheck },
                { k: "Date of Birth", v: kyc?.verified_dob ? formatEventDate(kyc.verified_dob) : null, Icon: CalendarDays },
                { k: "Verification Source", v: kyc?.source || kyc?.verification_source || "Aadhaar Document", Icon: FileCheck2 },
                { k: "Verified On", v: kyc?.verified_at ? formatEventDate(kyc.verified_at) : null, Icon: FileCheck2 },
              ]
                .filter((row) => row.v)
                .map((row, idx, arr) => (
                  <View
                    key={row.k}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingHorizontal: 20,
                      paddingVertical: 14,
                      borderBottomWidth: idx < arr.length - 1 ? 1 : 0,
                      borderBottomColor: "rgba(255, 255, 255, 0.06)",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <row.Icon size={14} color="#22C55E" />
                      <Txt size={11} font="monoMed" tone="subtle" uppercase tracking={1}>
                        {row.k}
                      </Txt>
                    </View>
                    <Txt
                      size={14}
                      font={row.mono ? "mono" : "sansSemi"}
                      style={{
                        color: "#ffffff",
                        letterSpacing: row.mono ? 2 : 0,
                      }}
                    >
                      {row.v}
                    </Txt>
                  </View>
                ))}

              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "rgba(255, 255, 255, 0.08)",
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                  backgroundColor: "rgba(0, 0, 0, 0.2)",
                }}
              >
                <Txt size={11.5} tone="subtle" lh={17}>
                  Verified securely using Aadhaar document checksum verification. Raw Aadhaar numbers are never stored in plain text.
                </Txt>
              </View>
            </View>
          ) : (
            /* Not Verified Explanatory View */
            <View style={{ padding: 20 }}>
              <Txt size={13.5} tone="muted" lh={21}>
                Verify your government ID to unlock prize disbursements, verified contestant certificates, and official competition eligibility.
              </Txt>

              <View style={{ gap: 14, marginTop: 18 }}>
                {[
                  { Icon: FileCheck2, text: "Upload your Aadhaar card photo (JPG, PNG) or e-Aadhaar PDF document" },
                  { Icon: Lock, text: "Only a permanently masked identity (XXXX-XXXX-1234) is retained for duplicate prevention" },
                  { Icon: ShieldCheck, text: "Strict UIDAI Verhoeff algorithm ensures valid and secure authentication" },
                ].map((row, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                    <row.Icon size={17} color="#FF385C" style={{ marginTop: 2 }} />
                    <Txt size={13} tone="muted" lh={19} style={{ flex: 1 }}>
                      {row.text}
                    </Txt>
                  </View>
                ))}
              </View>

              <View style={{ marginTop: 24 }}>
                <Button
                  label="Verify Aadhaar ID"
                  onPress={() => setModalOpen(true)}
                  icon={<Upload size={17} color="#ffffff" />}
                  full
                  size="lg"
                />
              </View>
            </View>
          )}
        </Card>
      </FadeInUp>

      {/* Aadhaar Document Upload Modal */}
      <AadhaarUploadModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onVerified={async () => {
          setModalOpen(false);
          setNotice("Aadhaar KYC verified successfully!");
          await q.reload();
          setTimeout(() => setNotice(null), 5000);
        }}
      />
    </SubScreen>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AADHAAR UPLOAD MODAL — Document Upload & Verhoeff Check
   ═══════════════════════════════════════════════════════════════════ */

type SelectedFile = {
  uri: string;
  name: string;
  type: string;
  size?: number;
};

function AadhaarUploadModal({
  visible,
  onClose,
  onVerified,
}: {
  visible: boolean;
  onClose: () => void;
  onVerified: () => void;
}) {
  const { c } = useTheme();
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setSelectedFile(null);
      setErr(null);
      setSuccessMsg(null);
      setBusy(false);
    }
  }, [visible]);

  if (!visible) return null;

  const pickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets?.[0]) {
        const a = res.assets[0];
        if (a.size && a.size > 15 * 1024 * 1024) {
          setErr("File size exceeds 15MB limit.");
          return;
        }
        setSelectedFile({
          uri: a.uri,
          name: a.name,
          type: a.mimeType || (a.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
          size: a.size,
        });
        setErr(null);
      }
    } catch {
      setErr("Could not pick document. Please try again.");
    }
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        RNAlert.alert("Camera permission", "Please grant camera permission to capture your Aadhaar card.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        quality: 0.9,
      });
      if (!res.canceled && res.assets?.[0]) {
        const a = res.assets[0];
        const name = a.fileName || `aadhaar_cam_${Date.now()}.jpg`;
        setSelectedFile({
          uri: a.uri,
          name,
          type: a.mimeType || "image/jpeg",
          size: a.fileSize,
        });
        setErr(null);
      }
    } catch {
      setErr("Could not launch camera.");
    }
  };

  const pickGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        RNAlert.alert("Gallery permission", "Please grant photo gallery permission to choose your Aadhaar card photo.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
      });
      if (!res.canceled && res.assets?.[0]) {
        const a = res.assets[0];
        const name = a.fileName || `aadhaar_pic_${Date.now()}.jpg`;
        setSelectedFile({
          uri: a.uri,
          name,
          type: a.mimeType || "image/jpeg",
          size: a.fileSize,
        });
        setErr(null);
      }
    } catch {
      setErr("Could not select photo.");
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      setErr("Please select your Aadhaar document first.");
      return;
    }

    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("govt_id_proof", {
        uri: selectedFile.uri,
        name: selectedFile.name,
        type: selectedFile.type,
      } as any);

      const res = await kycApi.verifyDocument(fd);
      setSuccessMsg(res.message || "Aadhaar verified successfully!");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => {
        onVerified();
      }, 1200);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setErr(e?.message || "Verification failed. Please make sure the Aadhaar card number is clearly legible.");
    } finally {
      setBusy(false);
    }
  };

  const isPdf = selectedFile?.name?.toLowerCase().endsWith(".pdf");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(4, 5, 8, 0.85)",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onClose}
        />

        <View
          style={{
            width: "100%",
            maxWidth: 440,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.12)",
            backgroundColor: "#14161E",
            overflow: "hidden",
            zIndex: 10,
          }}
        >
          {/* Modal Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingVertical: 18,
              borderBottomWidth: 1,
              borderBottomColor: "rgba(255, 255, 255, 0.08)",
            }}
          >
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <ShieldCheck size={18} color="#FF385C" />
                <Txt size={16} font="sansBold" uppercase tracking={0.5} style={{ color: "#ffffff" }}>
                  Aadhaar Verification
                </Txt>
              </View>
              <Txt size={10} font="monoMed" uppercase tracking={1} tone="subtle" style={{ marginTop: 2 }}>
                Document Upload & Verhoeff Check
              </Txt>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255, 255, 255, 0.06)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.1)",
              }}
            >
              <X size={17} color="#ffffff" />
            </Pressable>
          </View>

          {/* Modal Body */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 20, gap: 16 }}
          >
            {/* Error Banner */}
            {err ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 10,
                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(239, 68, 68, 0.3)",
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <AlertCircle size={16} color="#EF4444" style={{ marginTop: 2 }} />
                <Txt size={12.5} style={{ color: "#FCA5A5", flex: 1 }} lh={18}>
                  {err}
                </Txt>
              </View>
            ) : null}

            {/* Success Banner */}
            {successMsg ? (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  backgroundColor: "rgba(34, 197, 94, 0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(34, 197, 94, 0.3)",
                  borderRadius: 14,
                  padding: 12,
                }}
              >
                <CheckCircle2 size={16} color="#22C55E" />
                <Txt size={13} font="sansSemi" style={{ color: "#86EFAC", flex: 1 }}>
                  {successMsg}
                </Txt>
              </View>
            ) : null}

            <Txt size={13} tone="muted" lh={19}>
              Upload your original Aadhaar card image (front side showing 12-digit number) or downloaded e-Aadhaar PDF.
            </Txt>

            {/* Selected File Box OR Pick Buttons */}
            {selectedFile ? (
              <Pressable
                onPress={pickDocument}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  padding: 16,
                  borderRadius: 18,
                  borderWidth: 1.5,
                  borderColor: "rgba(34, 197, 94, 0.5)",
                  backgroundColor: "rgba(34, 197, 94, 0.08)",
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    backgroundColor: "rgba(34, 197, 94, 0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isPdf ? (
                    <FileText size={24} color="#22C55E" />
                  ) : (
                    <ImageIcon size={24} color="#22C55E" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Txt size={14} font="sansBold" style={{ color: "#ffffff" }} numberOfLines={1}>
                    {selectedFile.name}
                  </Txt>
                  <Txt size={11} tone="subtle" style={{ marginTop: 2 }}>
                    {selectedFile.size ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · ` : ""}
                    Tap to change file
                  </Txt>
                </View>
              </Pressable>
            ) : (
              <View style={{ gap: 10 }}>
                {/* Option 1: File / PDF Document */}
                <Pressable
                  onPress={pickDocument}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    padding: 14,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    backgroundColor: pressed ? "rgba(255, 255, 255, 0.06)" : "#0d0f15",
                  })}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: "rgba(201, 242, 74, 0.12)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <FolderOpen size={20} color="#C9F24A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt size={13.5} font="sansBold" style={{ color: "#ffffff" }}>
                      Browse PDF or Image File
                    </Txt>
                    <Txt size={11} tone="subtle" style={{ marginTop: 1 }}>
                      PDF, JPG, PNG or WEBP (Max 15MB)
                    </Txt>
                  </View>
                </Pressable>

                {/* Option 2: Camera Photo */}
                <Pressable
                  onPress={takePhoto}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    padding: 14,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    backgroundColor: pressed ? "rgba(255, 255, 255, 0.06)" : "#0d0f15",
                  })}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: "rgba(255, 56, 92, 0.12)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Camera size={20} color="#FF385C" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt size={13.5} font="sansBold" style={{ color: "#ffffff" }}>
                      Take Photo with Camera
                    </Txt>
                    <Txt size={11} tone="subtle" style={{ marginTop: 1 }}>
                      Front side showing Aadhaar number
                    </Txt>
                  </View>
                </Pressable>

                {/* Option 3: Choose from Gallery */}
                <Pressable
                  onPress={pickGallery}
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    padding: 14,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    backgroundColor: pressed ? "rgba(255, 255, 255, 0.06)" : "#0d0f15",
                  })}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: "rgba(56, 189, 248, 0.12)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ImageIcon size={20} color="#38BDF8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt size={13.5} font="sansBold" style={{ color: "#ffffff" }}>
                      Choose from Photo Gallery
                    </Txt>
                    <Txt size={11} tone="subtle" style={{ marginTop: 1 }}>
                      Select saved card image
                    </Txt>
                  </View>
                </Pressable>
              </View>
            )}

            {/* Security Footnote */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 4 }}>
              <Lock size={13} color="#6b728a" />
              <Txt size={11} tone="subtle" style={{ flex: 1 }}>
                Secure 256-bit encryption. Raw Aadhaar numbers are never stored in database.
              </Txt>
            </View>

            {/* Submit Action */}
            <View style={{ marginTop: 8 }}>
              <Button
                label="Verify Document"
                disabled={!selectedFile || busy}
                loading={busy}
                onPress={handleSubmit}
                iconRight={<ArrowRight size={16} color="#ffffff" />}
                full
                size="lg"
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
