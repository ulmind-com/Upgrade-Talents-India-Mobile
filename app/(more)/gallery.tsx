import React, { useMemo, useState } from "react";
import { View, Dimensions, Pressable, Modal } from "react-native";
import { ImageOff, X, Sparkles } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { publicApi, safe } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { AppImage } from "@/components/AppImage";
import { GalleryCollage } from "@/components/GalleryCollage";
import { Skeleton, Txt } from "@/components/ui";
import { isUsableImageUrl } from "@/lib/format";

const GAP = 10;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

type Shot = {
  id: string;
  src?: string | null;
  caption?: string;
  seed: number;
};

export default function Gallery() {
  const { c } = useTheme();
  const col = (SCREEN_W - 40 - GAP) / 2;
  const [selected, setSelected] = useState<Shot | null>(null);

  const { data, loading, refreshing, refresh } = useAsync(
    () => Promise.all([safe(publicApi.banners(), []), safe(publicApi.upcomingEvents({ limit: 30 }), [])]),
    []
  );

  const shots: Shot[] = useMemo(() => {
    const [banners, events] = data || [[], []];
    const items: Shot[] = [];
    events.forEach((e: any, i: number) => {
      items.push({
        id: `e-${e._id || i}`,
        src: isUsableImageUrl(e.image_url) ? e.image_url : null,
        caption: e.title || "Live Stage Performance",
        seed: i,
      });
    });
    banners.forEach((b: any, i: number) => {
      items.push({
        id: `b-${b._id || i}`,
        src: isUsableImageUrl(b.image_url) ? b.image_url : null,
        caption: b.title || "Stage Moment",
        seed: i + 30,
      });
    });
    return items;
  }, [data]);

  const tiles: Shot[] = shots.length ? shots : Array.from({ length: 8 }).map((_, i) => ({
    id: `seed-${i}`,
    src: null,
    caption: "Upgrade Talents India",
    seed: i,
  }));

  const events = (data?.[1] as any[]) || [];

  return (
    <SubScreen eyebrow="Moments on stage" title="Gallery" refreshing={refreshing} onRefresh={refresh}>
      {!loading && events.length ? (
        <View style={{ marginHorizontal: -20, marginBottom: 8 }}>
          <GalleryCollage events={events} showCta={false} />
        </View>
      ) : null}

      {loading ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} h={col * 1.3} w={col} radius={18} />)}
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
          <Txt size={13} font="monoMed" tone="subtle" tracking={2} uppercase style={{ width: "100%", marginBottom: 6 }}>
            All moments
          </Txt>
          {tiles.map((t, i) => (
            <Pressable
              key={t.id || i}
              onPress={() => setSelected(t)}
              style={({ pressed }) => ({
                width: col,
                height: i % 3 === 0 ? col * 1.35 : col,
                borderRadius: 18,
                overflow: "hidden",
                borderWidth: 1,
                borderColor: c.border,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <AppImage uri={t.src} seed={t.seed} style={{ width: "100%", height: "100%" }} />
              <View
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  padding: 8,
                  backgroundColor: "rgba(8, 9, 12, 0.65)",
                }}
              >
                <Txt size={11} font="sansBold" style={{ color: "#ffffff" }} numberOfLines={1}>
                  {t.caption}
                </Txt>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {/* Lightbox Viewer matching website */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.94)", justifyContent: "center", alignItems: "center", padding: 16 }}>
          <Pressable
            onPress={() => setSelected(null)}
            style={{
              position: "absolute",
              top: 50,
              right: 20,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: "rgba(255, 255, 255, 0.15)",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            <X size={20} color="#ffffff" />
          </Pressable>

          {selected ? (
            <View style={{ width: "100%", maxHeight: SCREEN_H * 0.75, borderRadius: 20, overflow: "hidden" }}>
              <AppImage
                uri={selected.src}
                seed={selected.seed}
                style={{ width: "100%", height: SCREEN_H * 0.55 }}
                contentFit="contain"
              />
              <View style={{ padding: 16, backgroundColor: "#14161E", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" }}>
                <Txt size={16} font="sansBold" style={{ color: "#ffffff" }}>
                  {selected.caption}
                </Txt>
                <Txt size={12} style={{ color: "#9ea3b8", marginTop: 4 }}>
                  Upgrade Talents India Official Stage Archive
                </Txt>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </SubScreen>
  );
}
