import React, { useState } from "react";
import { View, Pressable, Share, Linking } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Award, Download, ShieldCheck, Share2, Sparkles, ChevronRight, ExternalLink } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { extrasApi, getApiBase, tokenStore, safe, toRows } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAlert } from "@/components/Popup";
import { Txt, Card, Badge, Skeleton, EmptyState, Button } from "@/components/ui";
import { SignInPrompt } from "@/components/SignInPrompt";
import { formatEventDate, titleCase } from "@/lib/format";

const certIdOf = (cert: any) => cert.certificate_id || cert._id || cert.id || cert.certificate_number;

export default function Certificates() {
  const { c } = useTheme();
  const router = useRouter();
  const alert = useAlert();
  const { user } = useSession();
  const { data, loading, refreshing, refresh } = useAsync(() => (user ? safe(extrasApi.myCertificates(), null) : Promise.resolve(null)), [user?.email]);
  const rows = toRows(data);
  const [downloading, setDownloading] = useState<string | null>(null);

  const shareCert = async (cert: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const id = certIdOf(cert);
    const token = cert.verification_token || cert.certificate_id || cert.certificate_number || cert._id;
    const certTitle = cert.title || cert.competition_title || cert.activity_title || "Official Certificate";
    let shareUrl = `https://upgradetalentsindia.in/verify/${encodeURIComponent(String(token))}`;
    let message = `🏆 Check out my verified ${certTitle} from Upgrade Talents India! Authenticity verified here: ${shareUrl}`;
    try {
      const meta = await extrasApi.certificateShare(String(id));
      shareUrl = meta?.share_url || meta?.preview_url || meta?.url || shareUrl;
      if (meta?.share_text || meta?.message) message = `${meta.share_text || meta.message} ${shareUrl}`.trim();
    } catch {}
    try {
      await Share.share({ title: `${certTitle} — Upgrade Talents India`, message, url: shareUrl });
    } catch {}
  };

  const downloadCert = async (cert: any) => {
    const id = certIdOf(cert);
    if (!id) return;
    setDownloading(String(id));
    Haptics.selectionAsync().catch(() => {});
    try {
      const token = tokenStore.getUser();
      const target = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}certificate-${id}.pdf`;
      const res = await FileSystem.downloadAsync(extrasApi.certificateDownloadUrl(String(id)), target, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (res.status >= 400) throw new Error(`Couldn't generate the certificate (${res.status}).`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(res.uri, { mimeType: "application/pdf", dialogTitle: "Certificate", UTI: "com.adobe.pdf" });
      } else {
        alert("success", "Certificate ready", "Your certificate PDF has been saved.");
      }
    } catch (e: any) {
      if (cert.pdf_url || cert.download_url) {
        Linking.openURL(cert.pdf_url || cert.download_url).catch(() => {});
      } else {
        alert("error", "Couldn't download", e?.message || "Please try again in a moment.");
      }
    } finally {
      setDownloading(null);
    }
  };

  const verifyCert = (cert: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const token = cert.verification_token || cert.certificate_id || cert.certificate_number;
    router.push({
      pathname: "/(more)/verify",
      params: { token: encodeURIComponent(String(token)) },
    });
  };

  return (
    <SubScreen eyebrow="Your achievements" title="Certificates" refreshing={refreshing} onRefresh={user ? refresh : undefined}>
      {!user ? (
        <SignInPrompt message="Sign in to view, verify and download your certificates." />
      ) : loading ? (
        <View style={{ gap: 12 }}>{[0, 1].map((i) => <Skeleton key={i} h={140} radius={20} />)}</View>
      ) : (
        <View style={{ gap: 16 }}>
          {/* Quick link to Badges banner */}
          <Pressable
            onPress={() => router.push("/(more)/badges")}
            style={({ pressed }) => ({
              padding: 14,
              borderRadius: 18,
              backgroundColor: "#14161E",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.08)",
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            })}
          >
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(201, 242, 74, 0.15)", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={20} color="#C9F24A" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={14} font="sansBold" style={{ color: "#ffffff" }}>My Achievement Badges</Txt>
              <Txt size={12} style={{ color: "#9ea3b8" }}>View milestones and rewards earned on stage</Txt>
            </View>
            <ChevronRight size={18} color="#9ea3b8" />
          </Pressable>

          {rows.length ? (
            rows.map((cert: any, i: number) => {
              const token = cert.verification_token || cert.certificate_id || cert.certificate_number;
              const certTitle = cert.title || cert.competition_title || cert.activity_title || cert.name || "Certificate";
              const certId = cert.certificate_id || cert.certificate_number || cert.number;

              return (
                <Card key={cert._id || cert.id || i} padding={0} style={{ overflow: "hidden", backgroundColor: "#14161E", borderColor: "rgba(255, 255, 255, 0.08)" }}>
                  <View style={{ padding: 18 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: "rgba(255, 56, 92, 0.15)", alignItems: "center", justifyContent: "center" }}>
                        <Award size={22} color="#FF385C" />
                      </View>
                      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                        {cert.status ? (
                          <Badge label={titleCase(cert.status)} tone={cert.status === "VALID" ? "success" : "brand"} />
                        ) : null}
                      </View>
                    </View>

                    <Txt size={18} font="sansBold" style={{ color: "#ffffff", marginTop: 14 }} numberOfLines={2}>
                      {certTitle}
                    </Txt>
                    <Txt size={12.5} style={{ color: "#9ea3b8", marginTop: 4 }}>
                      Issued {formatEventDate(cert.issued_at || cert.created_at)}
                    </Txt>
                    {certId ? (
                      <Txt size={11.5} font="mono" style={{ color: "#C9F24A", marginTop: 6 }}>
                        {certId}
                      </Txt>
                    ) : null}

                    {/* Action buttons matching website */}
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 16, borderTopWidth: 1, borderTopColor: "rgba(255, 255, 255, 0.06)", paddingTop: 14 }}>
                      <Pressable
                        onPress={() => verifyCert(cert)}
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          height: 38,
                          borderRadius: 10,
                          backgroundColor: "rgba(201, 242, 74, 0.12)",
                          borderWidth: 1,
                          borderColor: "rgba(201, 242, 74, 0.3)",
                        }}
                      >
                        <ShieldCheck size={15} color="#C9F24A" />
                        <Txt size={12} font="sansBold" style={{ color: "#C9F24A" }}>Verify</Txt>
                      </Pressable>

                      <Pressable
                        onPress={() => shareCert(cert)}
                        style={{
                          flex: 1,
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          height: 38,
                          borderRadius: 10,
                          backgroundColor: "rgba(255, 255, 255, 0.06)",
                          borderWidth: 1,
                          borderColor: "rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        <Share2 size={15} color="#ffffff" />
                        <Txt size={12} font="sansBold" style={{ color: "#ffffff" }}>Share</Txt>
                      </Pressable>

                      <Pressable
                        onPress={() => downloadCert(cert)}
                        disabled={downloading === String(certIdOf(cert))}
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          backgroundColor: "rgba(255, 255, 255, 0.06)",
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: "rgba(255, 255, 255, 0.1)",
                          opacity: downloading === String(certIdOf(cert)) ? 0.5 : 1,
                        }}
                      >
                        <Download size={16} color="#ffffff" />
                      </Pressable>
                    </View>
                  </View>
                </Card>
              );
            })
          ) : (
            <EmptyState icon={<Award size={26} color={c.fgMuted} />} title="No certificates yet" subtitle="Compete and complete courses to earn verifiable certificates." />
          )}
        </View>
      )}
    </SubScreen>
  );
}
