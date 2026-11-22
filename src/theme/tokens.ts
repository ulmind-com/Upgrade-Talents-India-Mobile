/**
 * Upgrade Talents India — design tokens, ported 1:1 from the website design system
 * (globals.css). Two themes: "dark" (near-black navy stage + orange) and
 * "blue" (warm daylight counterpart). The app keeps the exact same palette.
 */

export type ThemeName = "dark" | "blue";

export type Palette = {
  bg: string;
  bgElevated: string;
  surface: string;
  surface2: string;
  surfaceGlass: string;
  border: string;
  borderStrong: string;

  fg: string;
  fgMuted: string;
  fgSubtle: string;

  primary: string;
  primaryHover: string;
  onPrimary: string;

  accent: string;
  accentHover: string;
  onAccent: string;

  cyan: string;
  lime: string;

  success: string;
  warning: string;
  danger: string;

  ring: string;
  scrim: string;

  /* brand gradient stops */
  gradBrand: [string, string, string, string];

  /* ambient spotlights */
  spot1: string;
  spot2: string;
  spot3: string;

  /* signature stage gradient (hero) */
  stageGrad: [string, string, string, string, string];
  stageBloom: string;

  /* street / ticket system */
  acid: string;
  acidInk: string;
  streetBg: string;
  streetCard: string;
  streetLine: string;
  streetRed: string;

  /* theater sections */
  theaterBg: string;
  theaterDeep: string;
  theaterPink: string;

  /* status bar content */
  barStyle: "light" | "dark";
};

export const DARK: Palette = {
  /* True-black AMOLED canvas (District/Zomato dark) with neutral, non-tinted greys. */
  bg: "#000000",
  bgElevated: "#0b0b0e",
  surface: "#111114",
  surface2: "#1a1a1f",
  surfaceGlass: "rgba(12,12,14,0.92)",
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.14)",

  fg: "#ffffff",
  fgMuted: "#9b9ba6",
  fgSubtle: "#6a6a74",

  primary: "#ff385c",
  primaryHover: "#ff5271",
  onPrimary: "#ffffff",

  accent: "#ff385c",
  accentHover: "#ff5271",
  onAccent: "#ffffff",

  cyan: "#38bdf8",
  lime: "#c9f24a",

  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",

  ring: "#ff385c",
  scrim: "rgba(0,0,0,0.88)",

  /* Clean single-hue red gradient — no more violet→red rainbow. */
  gradBrand: ["#ff5271", "#ff385c", "#e0264b", "#c41a3d"],

  spot1: "rgba(255,56,92,0.20)",
  spot2: "rgba(255,56,92,0.14)",
  spot3: "rgba(255,82,113,0.10)",

  stageGrad: ["#2a0f1c", "#200a16", "#160610", "#0c0309", "#000000"],
  stageBloom: "rgba(255,56,92,0.30)",

  acid: "#c9f24a",
  acidInk: "#000000",
  streetBg: "#000000",
  streetCard: "#111114",
  streetLine: "rgba(255,255,255,0.18)",
  streetRed: "#ff385c",

  theaterBg: "#120610",
  theaterDeep: "#000000",
  theaterPink: "#ff385c",

  barStyle: "light",
};

export const BLUE: Palette = {
  ...DARK,
};

export const PALETTES: Record<ThemeName, Palette> = { dark: DARK, blue: DARK };

/* ── Scale (ported from the design system) ─────────────── */
export const radius = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32, "2xl": 44, full: 9999 };
export const space = { 1: 4, 2: 8, 3: 16, 4: 24, 5: 40, 6: 64, 7: 96, 8: 140 };

/**
 * Clean District type system — one restrained family set everywhere.
 * Poppins (geometric) for display/headings, Inter for body & UI. All the old
 * loud keys (street/serif/cond/mono) are remapped onto this clean pair so the
 * whole app reads calm and premium without touching a single screen.
 */
export const fonts = {
  display: "Poppins_800ExtraBold", // hero / big headings
  hero: "Poppins_700Bold",
  heroSemi: "Poppins_600SemiBold",
  sans: "Inter_400Regular",
  sansMed: "Inter_500Medium",
  sansSemi: "Inter_600SemiBold",
  sansBold: "Inter_700Bold",
  sansExt: "Inter_800ExtraBold",
  mono: "Inter_600SemiBold",        // eyebrows → clean caps, not techy mono
  monoMed: "Inter_600SemiBold",
  cond: "Poppins_600SemiBold",      // was Oswald
  condBold: "Poppins_700Bold",
  street: "Poppins_800ExtraBold",   // was Anton
  serif: "Inter_600SemiBold",       // serif removed for a clean look
  serifItalic: "Inter_500Medium",
};

/* Gen-Z accent pairs — used for sectional colour so screens aren't all orange. */
export const GENZ: [string, string][] = [
  ["#b36bff", "#7c3aed"], // violet
  ["#3ec6f5", "#1178c8"], // cyan
  ["#f0407e", "#b0205a"], // pink
  ["#ff9a3d", "#ff5e1f"], // orange (brand)
  ["#5ce1a6", "#13a06a"], // mint
  ["#ffd56b", "#f0a000"], // amber
];
export const genz = (i: number): [string, string] => GENZ[Math.abs(Math.round(i)) % GENZ.length];

/** One tone palette for every message surface in the app. */
export type MsgTone = "success" | "error" | "warning" | "info";
export const TONE_GRAD: Record<MsgTone, [string, string]> = {
  success: ["#5ce1a6", "#13a06a"],
  error: ["#ff6b6b", "#c01b1b"],
  warning: ["#ffd56b", "#f0a000"],
  info: ["#3ec6f5", "#1178c8"],
};
