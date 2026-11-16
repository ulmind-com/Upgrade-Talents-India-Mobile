import React, { useMemo } from "react";
import { View, Dimensions } from "react-native";
import { ImageOff } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { publicApi, safe } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { AppImage } from "@/components/AppImage";
import { GalleryCollage } from "@/components/GalleryCollage";
import { Skeleton, Txt } from "@/components/ui";
import { isUsableImageUrl } from "@/lib/format";

const GAP = 10;

export default function Gallery() {
  const { c } = useTheme();
  const col = (Dimensions.get("window").width - 40 - GAP) / 2;
  const { data, loading, refreshing, refresh } = useAsync(
    () => Promise.all([safe(publicApi.banners(), []), safe(publicApi.upcomingEvents({ limit: 30 }), [])]),
    []
  );

  const images = useMemo(() => {
    const [banners, events] = data || [[], []];
    const urls: string[] = [];
    banners.forEach((b: any) => isUsableImageUrl(b.image_url) && urls.push(b.image_url));
    events.forEach((e: any) => isUsableImageUrl(e.image_url) && urls.push(e.image_url!));
    return urls;
  }, [data]);

  // Always fill with fallbacks so the grid looks alive even when CMS is empty.
  const tiles = images.length ? images : Array.from({ length: 6 }).map((_, i) => `seed-${i}`);

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
          <Txt size={13} font="monoMed" tone="subtle" tracking={2} uppercase style={{ width: "100%", marginBottom: 6 }}>All moments</Txt>
          {tiles.map((t, i) => (
            <View key={i} style={{ width: col, height: i % 3 === 0 ? col * 1.35 : col, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: c.border }}>
              <AppImage uri={t.startsWith("seed-") ? null : t} seed={i} style={{ width: "100%", height: "100%" }} />
            </View>
          ))}
        </View>
      )}
    </SubScreen>
  );
}
