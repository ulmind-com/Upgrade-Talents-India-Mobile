import React, { useState } from "react";
import { View, Pressable, Share as RNShare } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Gift, Share2, Check, Link2, Crown, Coins, QrCode as QrIcon } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";
import { ShareSheet } from "@/components/ShareSheet";
import { referralLink } from "@/lib/api";

/**
 * The referral hub — invite code, canonical link, a scannable QR, and one tap
 * to the app's share sheet. Mirrors the website's ShareReferralModal, reusing
 * the app's own ShareSheet rather than a second modal.
 */
export function ReferralHub({
  code, link, referrerCoins = 100, welcomeCoins = 50, onVip,
}: {
  code: string;
  link?: string | null;
  referrerCoins?: number;
  welcomeCoins?: number;
  onVip?: () => void;
}) {
  const { c } = useTheme();
  const url = referralLink(link || code);
  const [showQr, setShowQr] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareText =
    `Join me on Upgrade Talents India! Sign up with my invite link and grab ${welcomeCoins} free UTI Coins — instant discounts on events, workshops & courses.\n\n${url}\n\nInvite code: ${code}`;

  const copy = async () => {
    await Clipboard.setStringAsync(url);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <View style={{ gap: 12 }}>
      {/* Invite card */}
      <View style={{ borderRadius: 22, overflow: "hidden" }}>
        <LinearGradient colors={c.gradBrand as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Gift size={16} color="#fff" />
            <Txt size={11} font="monoMed" tracking={2} uppercase style={{ color: "rgba(255,255,255,0.9)" }}>Invite & earn</Txt>
          </View>
          <Txt size={16.5} font="sansBold" lh={22} style={{ color: "#fff", marginTop: 10 }}>
            You get {referrerCoins} coins, they get {welcomeCoins} — every time a friend joins.
          </Txt>

          {/* code pill */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.22)", padding: 12 }}>
            <View style={{ flex: 1 }}>
              <Txt size={9.5} font="monoMed" tracking={1.5} uppercase style={{ color: "rgba(255,255,255,0.7)" }}>Your code</Txt>
              <Txt size={18} font="display" tracking={1} style={{ color: "#fff", marginTop: 1 }}>{code}</Txt>
            </View>
            <Pressable onPress={copy} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, backgroundColor: "#fff", paddingHorizontal: 13, height: 36 }}>
              {copied ? <Check size={15} color="#111" /> : <Link2 size={15} color="#111" />}
              <Txt size={12.5} font="sansBold" style={{ color: "#111" }}>{copied ? "Copied" : "Copy link"}</Txt>
            </Pressable>
          </View>

          {/* actions */}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <Pressable onPress={() => { Haptics.selectionAsync().catch(() => {}); setSheet(true); }} style={{ flex: 1 }}>
              <View style={{ height: 46, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.22)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}>
                <Share2 size={16} color="#fff" />
                <Txt size={13.5} font="sansBold" style={{ color: "#fff" }}>Share invite</Txt>
              </View>
            </Pressable>
            <Pressable onPress={() => setShowQr((s) => !s)} style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" }}>
              <QrIcon size={18} color="#fff" />
            </Pressable>
          </View>
        </LinearGradient>
      </View>

      {/* QR card — toggled */}
      {showQr ? (
        <View style={{ alignItems: "center", gap: 10, borderRadius: 22, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 20 }}>
          <View style={{ backgroundColor: "#fff", padding: 14, borderRadius: 18 }}>
            <QRCode value={url} size={168} backgroundColor="#fff" color="#0b0f19" />
          </View>
          <Txt size={12.5} tone="muted" align="center" style={{ maxWidth: 240 }}>
            Let a friend scan this to open your invite and claim {welcomeCoins} free coins.
          </Txt>
        </View>
      ) : null}

      {/* VIP invite banner */}
      {onVip ? (
        <Pressable onPress={onVip} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
          <View style={{ borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: "#e8c15a55" }}>
            <LinearGradient colors={["#2a2410", "#1a1608"] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: "#e8c15a22", alignItems: "center", justifyContent: "center" }}>
                <Crown size={20} color="#e8c15a" />
              </View>
              <View style={{ flex: 1 }}>
                <Txt size={14} font="sansBold" style={{ color: "#f0dca0" }}>Invite more, unlock VIP</Txt>
                <Txt size={11.5} style={{ color: "rgba(240,220,160,0.7)", marginTop: 1 }}>Top referrers get early access & perks.</Txt>
              </View>
              <Coins size={16} color="#e8c15a" />
            </LinearGradient>
          </View>
        </Pressable>
      ) : null}

      <ShareSheet
        visible={sheet}
        onClose={() => setSheet(false)}
        title="Share your invite"
        subtitle={`Code ${code}`}
        message={shareText}
        url={url}
      />
    </View>
  );
}
