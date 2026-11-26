import React from "react";
import { View, useWindowDimensions } from "react-native";
import LottieView from "lottie-react-native";

/**
 * A festive Lottie strip for the home screen (Republic Day, Independence Day…).
 *
 * Festive animations usually draw in a thin band of a big canvas, so showing
 * the whole canvas leaves a tall empty block. `crop` keeps only the band that
 * has artwork — [top, bottom] as fractions of the canvas height — so the strip
 * sits snug between the search bar and Explore. Width follows the screen, the
 * aspect comes from the file's own `w`/`h`, nothing is stretched.
 */
export function FestiveLottie({ source, crop = [0, 1], maxWidth = 520 }: { source: any; crop?: [number, number]; maxWidth?: number }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width - 32, maxWidth);
  const ratio = source?.w && source?.h ? source.w / source.h : 16 / 9;
  const h = Math.round(w / ratio); // full canvas height at this width
  const [top, bottom] = crop;
  const bandH = Math.round(h * (bottom - top));
  return (
    <View pointerEvents="none" style={{ height: bandH, overflow: "hidden", alignItems: "center" }}>
      <LottieView source={source} autoPlay loop resizeMode="contain" style={{ width: w, height: h, marginTop: -Math.round(h * top) }} />
    </View>
  );
}

/* ── Which festival is on, by date ────────────────────────────────────────── */

type Festival = { key: string; month: number; day: number; source: any; crop: [number, number]; maxWidth?: number };

/** Each strip shows from DAYS_BEFORE days ahead of the day through DAYS_AFTER days after it. */
const DAYS_BEFORE = 3;
const DAYS_AFTER = 1;

const FESTIVALS: Festival[] = [
  // 26 January — Republic Day (wide canvas; artwork in ~15–45% of its height)
  { key: "republic", month: 1, day: 26, source: require("../../assets/Lottie/Republic Day.json"), crop: [0.145, 0.45] },
  // 15 August — Independence Day (recoloured, Android-safe copy; artwork in ~30–71%)
  { key: "independence", month: 8, day: 15, source: require("../../assets/Lottie/independence-day.json"), crop: [0.25, 0.77], maxWidth: 195 },
];

/**
 * Force one for testing: set to "republic" or "independence" (dev builds
 * only — release builds always go by the date).
 */
const PREVIEW: string | null = null;

/** The festival whose window includes `now` (phone's local date), if any. */
export function festivalFor(now: Date = new Date()): Festival | null {
  if (__DEV__ && PREVIEW) return FESTIVALS.find((f) => f.key === PREVIEW) || null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const DAY = 86400000;
  for (const f of FESTIVALS) {
    // check this year and the neighbouring ones so late-Dec / early-Jan windows still work
    for (const y of [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]) {
      const at = new Date(y, f.month - 1, f.day).getTime();
      if (today >= at - DAYS_BEFORE * DAY && today <= at + DAYS_AFTER * DAY) return f;
    }
  }
  return null;
}

/**
 * The home screen's festive strip: Republic Day around 26 Jan, Independence
 * Day around 15 Aug, nothing the rest of the year. Pulled snug to Explore.
 */
export function FestiveStrip() {
  const f = festivalFor();
  if (!f) return null;
  return (
    <View style={{ marginBottom: -14 }}>
      <FestiveLottie source={f.source} crop={f.crop} maxWidth={f.maxWidth} />
    </View>
  );
}
