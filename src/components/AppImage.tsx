import React, { useState } from "react";
import { View, StyleProp, ImageStyle, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { imageFor } from "@/lib/format";
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
