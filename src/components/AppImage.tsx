import React, { useState } from "react";
import { StyleProp, ImageStyle } from "react-native";
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
}: {
  uri?: string | null;
  seed?: string | number;
  style?: StyleProp<ImageStyle>;
  contentFit?: "cover" | "contain";
}) {
  const [failed, setFailed] = useState(false);
  const resolved = assetUrl(uri ?? undefined);
  const src = failed ? imageFor(null, seed) : imageFor(resolved, seed);
  return (
    <Image
      source={{ uri: src }}
      style={style}
      contentFit={contentFit}
      transition={250}
      onError={() => setFailed(true)}
      cachePolicy="memory-disk"
    />
  );
}
