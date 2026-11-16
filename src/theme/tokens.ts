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
  bg: "#08090c",
  bgElevated: "#0e1016",
  surface: "#14161e",
  surface2: "#1b1d28",
  surfaceGlass: "rgba(20,22,30,0.88)",
  border: "rgba(255,255,255,0.08)",
  borderStrong: "rgba(255,255,255,0.16)",

  fg: "#ffffff",
  fgMuted: "#9ea3b8",
  fgSubtle: "#6b728a",

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
  scrim: "rgba(4,5,8,0.85)",

  gradBrand: ["#8b5cf6", "#ff385c", "#e0264b", "#c41a3d"],

  spot1: "rgba(139,92,246,0.30)",
  spot2: "rgba(255,56,92,0.18)",
  spot3: "rgba(201,242,74,0.14)",

  stageGrad: ["#2d184d", "#22113d", "#180c2e", "#100820", "#08090c"],
  stageBloom: "rgba(139,92,246,0.38)",

  acid: "#c9f24a",
  acidInk: "#08090c",
  streetBg: "#08090c",
  streetCard: "#14161e",
  streetLine: "rgba(255,255,255,0.22)",
  streetRed: "#ff385c",

  theaterBg: "#120a22",
  theaterDeep: "#080410",
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

/* Loaded font family keys (see theme/fonts.ts). */
export const fonts = {
  display: "ArchivoBlack",     // hero / headings
  hero: "Poppins_700Bold",
  heroSemi: "Poppins_600SemiBold",
  sans: "Inter_400Regular",
  sansMed: "Inter_500Medium",
  sansSemi: "Inter_600SemiBold",
  sansBold: "Inter_700Bold",
  sansExt: "Inter_800ExtraBold",
  mono: "JetBrainsMono_400Regular",
  monoMed: "JetBrainsMono_500Medium",
  cond: "Oswald_600SemiBold",
  condBold: "Oswald_700Bold",
  street: "Anton_400Regular",
  serif: "PlayfairDisplay_600SemiBold",
  serifItalic: "PlayfairDisplay_400Regular_Italic",
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
