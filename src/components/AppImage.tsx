import React, { useState } from "react";
import { View, StyleProp, ImageStyle, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { imageFor, isUsableImageUrl } from "@/lib/format";
import { assetUrl } from "@/lib/api";

/**
 * Image with CMS-aware fallback. Resolves relative backend paths to absolute
 * URLs, falls back to curated stage imagery when the source is missing/broken.
 */
export function AppImage({
  uri,
  seed = 0,
  style,
  contentFit = "cover",
  blurRadius,
}: {
  uri?: string | null;
  seed?: string | number;
  style?: StyleProp<ImageStyle>;
  contentFit?: "cover" | "contain";
  blurRadius?: number;
}) {
  const [failed, setFailed] = useState(false);
  const resolved = assetUrl(uri ?? undefined);
  const src = failed ? imageFor(null, seed) : imageFor(resolved, seed);
  return (
    <Image
      source={{ uri: src }}
      style={style}
      contentFit={contentFit}
      blurRadius={blurRadius}
      transition={250}
      onError={() => setFailed(true)}
      cachePolicy="memory-disk"
    />
  );
}

/**
 * Shows the WHOLE artwork — never a crop.
 *
 * Posters arrive in whatever ratio the organiser uploaded, so a fixed-height
 * `cover` box silently ate the top and bottom of tall ones (the title, the
 * date, the sponsor strip). This fills the frame with a blurred, dimmed copy
 * and lays the complete image on top with `contain`, so nothing is lost and
 * there are no dead letterbox bars.
 */
const FILL: ViewStyle = { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 };

export function PosterFill({ uri, seed = 0 }: { uri?: string | null; seed?: string | number }) {
  return (
    <View style={FILL}>
      <AppImage uri={uri} seed={seed} blurRadius={32} style={FILL as StyleProp<ImageStyle>} />
      <View style={[FILL, { backgroundColor: "rgba(0,0,0,0.45)" }]} />
      <AppImage uri={uri} seed={seed} contentFit="contain" style={FILL as StyleProp<ImageStyle>} />
    </View>
  );
}

/**
 * The whole poster at its own proportions: the box takes the image's real
 * width:height once it loads (nothing cropped, no letterbox), so a card grows
 * to fit whatever the organiser uploaded. Before it loads — or with no image —
 * it holds `fallbackRatio`. Very tall/wide uploads are clamped to stay sane.
 */
export function RatioImage({
  uri,
  seed = 0,
  fallbackRatio = 16 / 10,
  min = 0.62,
  max = 2.2,
  children,
}: {
  uri?: string | null;
  seed?: string | number;
  fallbackRatio?: number;
  min?: number;
  max?: number;
  children?: React.ReactNode;
}) {
  const resolved = assetUrl(uri ?? undefined);
  const real = isUsableImageUrl(resolved);
  const [ratio, setRatio] = useState(fallbackRatio);
  const [failed, setFailed] = useState(false);
  return (
    <View style={{ aspectRatio: ratio }}>
      {real && !failed ? (
        <Image
          source={{ uri: resolved }}
          style={FILL as StyleProp<ImageStyle>}
          contentFit="cover"
          transition={250}
          cachePolicy="memory-disk"
          onLoad={(e) => {
            const w = e?.source?.width;
            const h = e?.source?.height;
            if (w && h) setRatio(Math.min(max, Math.max(min, w / h)));
          }}
          onError={() => setFailed(true)}
        />
      ) : (
        <AppImage uri={null} seed={seed} style={FILL as StyleProp<ImageStyle>} />
      )}
      {children}
    </View>
  );
}
