import React, { useEffect, useRef, useState } from "react";
import { View, Modal, Pressable, Animated, Easing, Linking, Share as RNShare } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import Svg, { Path } from "react-native-svg";
import { Link2, FileDown, MoreHorizontal, Check, X } from "lucide-react-native";
import { Image } from "expo-image";
import { useTheme } from "@/theme/ThemeProvider";
import { assetUrl, type ShareSocialLinks } from "@/lib/api";
import { Txt } from "@/components/ui";
import { playNavFeedback } from "@/lib/sound";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/* The real marks, so a destination is recognised before the label is read.
   Paths are the public-domain simple-icons glyphs, drawn in white. */
const GLYPH = {
  whatsapp:
    "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488",
  telegram:
    "M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",
  x:
    "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  facebook:
    "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  instagram:
    "M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.788.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.788-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 01-2.88 0 1.44 1.44 0 012.88 0z",
  linkedin:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 4.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452z",
} as const;

const Brand = ({ d, size = 24 }: { d: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d={d} fill="#ffffff" />
  </Svg>
);

export type ShareTarget = {
  key: string;
  label: string;
  /** Brand mark path, drawn white inside the tile. */
  glyph: string;
  /** Two or more stops — Instagram needs three to read as itself. */
  colors: string[];
  run: (ctx: ShareCtx) => Promise<void> | void;
};

type ShareCtx = {
  text: string;
  url?: string;
  file?: { uri: string; mimeType?: string };
  /** Ready-made share URLs from the backend's share resolver, when we have them. */
  links?: ShareSocialLinks;
  note: (msg: string) => void;
};

/** Open a deep link, falling back to the service's web share when the app is absent. */
async function openWithFallback(appUrl: string, webUrl: string) {
  try {
    await Linking.openURL(appUrl);
  } catch {
    await Linking.openURL(webUrl).catch(() => {});
  }
}

/** Message + link — the backend's share_text already ends with the link, so don't add it twice. */
const joined = (ctx: ShareCtx) => (ctx.url && !ctx.text.includes(ctx.url) ? `${ctx.text}\n${ctx.url}` : ctx.text);

const TARGETS: ShareTarget[] = [
  {
    key: "whatsapp", label: "WhatsApp", glyph: GLYPH.whatsapp, colors: ["#5BF08A", "#25D366", "#0E8A5F"],
    run: (ctx) => openWithFallback(
      `whatsapp://send?text=${encodeURIComponent(joined(ctx))}`,
      ctx.links?.whatsapp || `https://wa.me/?text=${encodeURIComponent(joined(ctx))}`
    ),
  },
  {
    key: "telegram", label: "Telegram", glyph: GLYPH.telegram, colors: ["#53D3FB", "#2AABEE", "#1278B8"],
    run: (ctx) => openWithFallback(
      `tg://msg?text=${encodeURIComponent(joined(ctx))}`,
      ctx.links?.telegram || `https://t.me/share/url?url=${encodeURIComponent(ctx.url || "")}&text=${encodeURIComponent(ctx.text)}`
    ),
  },
  {
    key: "x", label: "X", glyph: GLYPH.x, colors: ["#3F3F46", "#18181B", "#000000"],
    run: (ctx) => openWithFallback(
      `twitter://post?message=${encodeURIComponent(joined(ctx))}`,
      ctx.links?.x || ctx.links?.twitter || `https://x.com/intent/post?text=${encodeURIComponent(joined(ctx))}`
    ),
  },
  {
    key: "facebook", label: "Facebook", glyph: GLYPH.facebook, colors: ["#4293FF", "#1877F2", "#0B4FB8"],
    run: (ctx) => Linking.openURL(
      ctx.links?.facebook ||
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(ctx.url || "https://upgradetalentsindia.in")}&quote=${encodeURIComponent(ctx.text)}`
    ).catch(() => {}),
  },
  {
    key: "linkedin", label: "LinkedIn", glyph: GLYPH.linkedin, colors: ["#2F8FE0", "#0A66C2", "#064A8F"],
    run: (ctx) => Linking.openURL(
      ctx.links?.linkedin ||
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(ctx.url || "https://upgradetalentsindia.in")}`
    ).catch(() => {}),
  },
  {
    key: "instagram", label: "Instagram", glyph: GLYPH.instagram, colors: ["#FEDA75", "#F58529", "#DD2A7B", "#8134AF", "#515BD4"],
    // Instagram has no text-share entry point, so copy first and say so plainly.
    run: async (ctx) => {
      await Clipboard.setStringAsync(joined(ctx));
      ctx.note("Copied — paste it into your story or DM.");
      await openWithFallback("instagram://app", "https://instagram.com");
    },
  },
];

/**
 * The app's own share sheet.
 *
 * Picking a destination here sends **text** (and the link, if there is one).
 * A file can only be attached through the system sheet, so an attachment gets
 * its own clearly-labelled action rather than being silently dropped.
 */
export function ShareSheet({
  visible, onClose, title = "Share", subtitle, message, url, file, preview, links, card,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  message: string;
  url?: string;
  file?: { uri: string; mimeType?: string; label?: string };
  preview?: React.ReactNode;
  /** Backend social share URLs (share resolver). Only pass them when they point at `url`. */
  links?: ShareSocialLinks;
  /** Link-preview card: what the recipient will see. */
  card?: { image?: string | null; title: string; meta?: string | null };
}) {
  const { c, name } = useTheme();
  const insets = useSafeAreaInsets();
  const a = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const [note, setNote] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (visible) {
      playNavFeedback();
      setMounted(true);
      setNote(null);
      setCopied(false);
      Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 6 }).start();
    } else if (mounted) {
      Animated.timing(a, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true })
        .start(({ finished }) => finished && setMounted(false));
    }
  }, [visible]);

  const ctx: ShareCtx = { text: message, url, file, links, note: setNote };

  const pick = async (t: ShareTarget) => {
    playNavFeedback();
    try { await t.run(ctx); } catch { setNote("Couldn't open that app."); return; }
    if (t.key !== "instagram") onClose();
  };

  const copy = async () => {
    await Clipboard.setStringAsync(url || message);
    playNavFeedback();
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const sendFile = async () => {
    if (!file) return;
    playNavFeedback();
    try {
      if (!(await Sharing.isAvailableAsync())) throw new Error();
      // expo-sharing decodes the path, so Expo Go's %-escaped sandbox needs
      // its own '%' escaped first.
      const i = file.uri.indexOf("://");
      const esc = i < 0 ? file.uri : file.uri.slice(0, i + 3) + file.uri.slice(i + 3).replace(/%/g, "%25");
      try { await Sharing.shareAsync(esc, { mimeType: file.mimeType || "application/pdf", UTI: "com.adobe.pdf", dialogTitle: title }); }
      catch { await Sharing.shareAsync(file.uri, { mimeType: file.mimeType || "application/pdf", UTI: "com.adobe.pdf", dialogTitle: title }); }
      onClose();
    } catch {
      setNote("Sharing isn't available on this device.");
    }
  };

  const more = async () => {
    playNavFeedback();
    try { await RNShare.share({ title, message: joined(ctx), url }); onClose(); } catch {}
  };

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        {/* backdrop */}
        <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: a }}>
          <Pressable onPress={() => { playNavFeedback(); onClose(); }} style={{ flex: 1 }}>
            <BlurView intensity={22} tint={name === "dark" ? "dark" : "light"} style={{ flex: 1, backgroundColor: "rgba(6,7,15,0.45)" }} />
          </Pressable>
        </Animated.View>

        <Animated.View
          style={{
            backgroundColor: c.bgElevated,
            borderTopLeftRadius: 30, borderTopRightRadius: 30,
            borderTopWidth: 1, borderColor: c.border,
            paddingBottom: insets.bottom + 16,
            transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }],
          }}
        >
          {/* grab handle */}
          <View style={{ alignSelf: "center", width: 44, height: 5, borderRadius: 999, backgroundColor: c.border, marginTop: 10 }} />

          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 22, paddingTop: 16 }}>
            <View style={{ flex: 1 }}>
              <Txt size={19} font="sansExt">{title}</Txt>
              {subtitle ? <Txt size={12.5} tone="muted" lh={18} numberOfLines={2} style={{ marginTop: 3 }}>{subtitle}</Txt> : null}
            </View>
            <Pressable onPress={() => { playNavFeedback(); onClose(); }} style={{ width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2 }}>
              <X size={16} color={c.fgMuted} />
            </Pressable>
          </View>

          {preview || card ? (
            <View style={{ paddingHorizontal: 22, marginTop: 14 }}>
              {preview || (card ? <LinkCard card={card} url={url} c={c} /> : null)}
            </View>
          ) : null}

          {/* destinations */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14, paddingTop: 20, rowGap: 18 }}>
            {TARGETS.map((t, i) => (
              <Tile key={t.key} a={a} index={i} label={t.label} colors={t.colors} onPress={() => pick(t)}>
                <Brand d={t.glyph} size={t.key === "x" ? 22 : 25} />
              </Tile>
            ))}
            <Tile a={a} index={TARGETS.length} label="More" colors={[c.fgMuted, c.fgSubtle]} onPress={more}>
              <MoreHorizontal size={23} color="#fff" />
            </Tile>
          </View>

          {/* link + file row */}
          <View style={{ paddingHorizontal: 22, paddingTop: 20, gap: 10 }}>
            <Row
              Icon={copied ? Check : Link2}
              tint={copied ? c.success : c.accent}
              label={copied ? "Copied to clipboard" : url ? "Copy link" : "Copy message"}
              onPress={copy}
              c={c}
            />
            {file ? (
              <Row
                Icon={FileDown}
                tint={c.accent}
                label={file.label || "Send the PDF file"}
                hint="Opens your phone's sheet — the only way to attach a file"
                onPress={sendFile}
                c={c}
              />
            ) : null}
          </View>

          {note ? (
            <View style={{ marginHorizontal: 22, marginTop: 14, borderRadius: 14, backgroundColor: c.accent + "16", paddingHorizontal: 14, paddingVertical: 10 }}>
              <Txt size={12.5} tone="accent" lh={18}>{note}</Txt>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

/** One destination — pops in after the sheet, each a beat behind the last. */
function Tile({
  a, index, label, colors, onPress, children,
}: {
  a: Animated.Value; index: number; label: string; colors: string[];
  onPress: () => void; children: React.ReactNode;
}) {
  const from = Math.min(0.25 + index * 0.08, 0.8);
  const grow = a.interpolate({ inputRange: [from, Math.min(from + 0.3, 1)], outputRange: [0, 1], extrapolate: "clamp" });
  return (
    <Animated.View
      style={{
        width: "25%", alignItems: "center", gap: 8,
        opacity: grow,
        transform: [
          { translateY: grow.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
          { scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
        ],
      }}
    >
      <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.9 : 1 }] })}>
        <LinearGradient
          colors={colors as any}
          // Instagram's ramp runs bottom-left to top-right; the rest read well
          // on the same diagonal, so every tile shares one light direction.
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={{
            width: 58, height: 58, borderRadius: 20, alignItems: "center", justifyContent: "center",
            overflow: "hidden",
            shadowColor: colors[Math.min(1, colors.length - 1)],
            shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 7,
          }}
        >
          {/* A soft sheen across the top half lifts the square off the sheet. */}
          <LinearGradient
            colors={["rgba(255,255,255,0.34)", "rgba(255,255,255,0.06)", "rgba(0,0,0,0.12)"]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            pointerEvents="none"
          />
          {/* Hairline ring — keeps dark tiles (X) from dissolving into the sheet. */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
              borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
            }}
          />
          {children}
        </LinearGradient>
      </Pressable>
      <Txt size={11.5} font="sansSemi" tone="muted" numberOfLines={1}>{label}</Txt>
    </Animated.View>
  );
}

const hostOf = (u?: string) => {
  const m = u ? /^https?:\/\/([^/?#]+)/i.exec(u) : null;
  return m ? m[1].replace(/^www\./, "") : null;
};

/** How the link will land in a chat — image, title, one line of context, the domain. */
function LinkCard({ card, url, c }: { card: { image?: string | null; title: string; meta?: string | null }; url?: string; c: any }) {
  const host = hostOf(url);
  const img = card.image ? assetUrl(card.image) : undefined;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 10 }}>
      <View style={{ width: 64, height: 64, borderRadius: 12, overflow: "hidden", backgroundColor: c.surface2, alignItems: "center", justifyContent: "center" }}>
        {img ? (
          <Image source={{ uri: img }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} />
        ) : (
          <Link2 size={20} color={c.fgSubtle} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt size={14} font="sansBold" numberOfLines={2} lh={18}>{card.title}</Txt>
        {card.meta ? <Txt size={12} tone="muted" numberOfLines={1}>{card.meta}</Txt> : null}
        {host ? <Txt size={11} tone="subtle" numberOfLines={1} style={{ marginTop: 2 }}>{host}</Txt> : null}
      </View>
    </View>
  );
}

function Row({ Icon, tint, label, hint, onPress, c }: {
  Icon: any; tint: string; label: string; hint?: string; onPress: () => void; c: any;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 13, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 14 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: tint + "1f" }}>
          <Icon size={18} color={tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt size={14} font="sansSemi">{label}</Txt>
          {hint ? <Txt size={11.5} tone="subtle" lh={16} style={{ marginTop: 2 }}>{hint}</Txt> : null}
        </View>
      </View>
    </Pressable>
  );
}
