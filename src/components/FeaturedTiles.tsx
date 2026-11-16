import React from "react";
import { View, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Trophy, CalendarDays, ShoppingBag, GraduationCap, Ticket, Sparkles, Star, Gift, ArrowUpRight,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { genz } from "@/theme/tokens";

const ICONS: Record<string, any> = {
  Trophy, CalendarDays, ShoppingBag, GraduationCap, Ticket, Sparkles, Star, Gift,
};

/* The admin writes web paths; map the ones the app owns to in-app routes, and
   send anything else (a real URL) to the browser. */
const ROUTE: Record<string, string> = {
  "/competitions": "/(more)/competitions",
  "/events": "/(user)/events",
  "/shop": "/(more)/shop",
  "/courses": "/(user)/learn",
  "/workshops": "/(user)/learn",
  "/leaderboard": "/(more)/leaderboard",
  "/tickets": "/(user)/tickets",
  "/gallery": "/(more)/gallery",
};

export type FeaturedTile = {
  id?: string; title?: string; subtitle?: string; action_text?: string;
  image_url?: string; target_url?: string; icon_name?: string; display_order?: number;
};

/**
 * Admin-curated promo tiles. A 2-column grid of image cards, each borrowing a
 * Gen-Z colourway and routing to the in-app screen the admin pointed it at.
 */
export function FeaturedTiles({ tiles }: { tiles: FeaturedTile[] }) {
  const { c } = useTheme();
  const router = useRouter();
  if (!tiles?.length) return null;

  const go = (t: FeaturedTile) => {
    const url = (t.target_url || "").trim();
    if (!url) return;
    if (/^https?:/i.test(url)) { Linking.openURL(url).catch(() => {}); return; }
    const key = url.replace(/\/+$/, "").toLowerCase();
    const mapped = ROUTE[key] || ROUTE["/" + key.replace(/^\//, "")];
    router.push((mapped || "/(more)/competitions") as any);
  };

  return (
    <View style={{ marginTop: 30 }}>
      <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Star size={13} color={c.accent} fill={c.accent} />
          <Txt size={11} font="monoMed" tracking={2.5} uppercase tone="accent">Spotlight</Txt>
        </View>
        <Txt size={23} font="display" tracking={-0.5} style={{ marginTop: 8 }}>Jump back in</Txt>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 14, gap: 12 }}>
        {tiles.map((t, i) => {
          const [g1, g2] = genz(i + 1);
          const Icon = ICONS[t.icon_name || ""] || Sparkles;
          return (
            <Pressable
              key={t.id || i}
              onPress={() => go(t)}
              style={({ pressed }) => ({ width: "47.5%", flexGrow: 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}
            >
              <View style={{ height: 136, borderRadius: 22, overflow: "hidden", shadowColor: g2, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 6 }}>
                {t.image_url ? (
                  <AppImage uri={t.image_url} seed={t.id || i} style={{ position: "absolute", width: "100%", height: "100%" }} />
                ) : null}
                <LinearGradient
                  colors={[g1 + (t.image_url ? "cc" : "ff"), g2 + (t.image_url ? "f2" : "ff")] as any}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={{ position: "absolute", width: "100%", height: "100%", opacity: t.image_url ? 0.82 : 1 }}
                />
                <View style={{ flex: 1, padding: 14, justifyContent: "space-between" }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.24)", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={19} color="#fff" />
                  </View>
                  <View>
                    {t.subtitle ? <Txt size={10.5} font="monoMed" tracking={1} uppercase style={{ color: "rgba(255,255,255,0.85)" }} numberOfLines={1}>{t.subtitle}</Txt> : null}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 }}>
                      <Txt size={17} font="display" tracking={-0.4} style={{ color: "#fff", flex: 1 }} numberOfLines={1}>{t.title}</Txt>
                      <ArrowUpRight size={16} color="#fff" />
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
