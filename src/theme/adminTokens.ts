/**
 * The admin control room has its own design language — green brand, Inter +
 * JetBrains Mono, light-first and data-dense. These values are a direct port
 * of the admin site's `globals.css` custom properties; keep them in step with
 * that file rather than with the public app's palette.
 */

export type AdminPalette = {
  bg: string;
  page: string;
  surface: string;
  surface2: string;
  surface3: string;
  border: string;
  borderStrong: string;

  fg: string;
  fgMuted: string;
  fgSubtle: string;

  brand: string;
  brandHover: string;
  brandSoft: string;
  onBrand: string;
  brandBright: string;
  accent: string;

  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;

  ring: string;
  scrim: string;
  hatch: string;

  /** Shadow colour + opacity approximating --shadow-card / --shadow-pop. */
  shadowCard: { color: string; opacity: number; radius: number; offsetY: number; elevation: number };
  shadowPop: { color: string; opacity: number; radius: number; offsetY: number; elevation: number };

  barStyle: "light" | "dark";
};

export const ADMIN_LIGHT: AdminPalette = {
  bg: "#f4f5f7",
  page: "#eceff1",
  surface: "#ffffff",
  surface2: "#f8f9fb",
  surface3: "#eef0f4",
  border: "#e6e8ee",
  borderStrong: "#d4d8e2",

  fg: "#121623",
  fgMuted: "#5b6477",
  fgSubtle: "#8b93a7",

  brand: "#0d6b43",
  brandHover: "#0a5836",
  brandSoft: "#e6f4ec",
  onBrand: "#ffffff",
  brandBright: "#1f9d61",
  accent: "#1f9d61",

  success: "#128a52",
  successSoft: "#e4f6ec",
  warning: "#9a6200",
  warningSoft: "#fdf2dd",
  danger: "#c7281f",
  dangerSoft: "#fdeceb",
  info: "#0b6fa4",
  infoSoft: "#e6f2fa",

  ring: "#0d6b43",
  scrim: "rgba(18, 22, 35, 0.45)",
  hatch: "rgba(13, 107, 67, 0.12)",

  shadowCard: { color: "#121623", opacity: 0.12, radius: 14, offsetY: 6, elevation: 2 },
  shadowPop: { color: "#121623", opacity: 0.3, radius: 32, offsetY: 18, elevation: 14 },

  barStyle: "dark",
};

export const ADMIN_DARK: AdminPalette = {
  bg: "#0b0e17",
  page: "#070a12",
  surface: "#141926",
  surface2: "#1a2030",
  surface3: "#212838",
  border: "#252c3d",
  borderStrong: "#353e55",

  fg: "#f2f4f9",
  fgMuted: "#9aa3bb",
  fgSubtle: "#6f7893",

  brand: "#2fbd78",
  brandHover: "#43cf8a",
  brandSoft: "#0f2a1e",
  onBrand: "#04170e",
  brandBright: "#43cf8a",
  accent: "#2fbd78",

  success: "#3ddc8a",
  successSoft: "#0f2a1e",
  warning: "#f5b544",
  warningSoft: "#2e2211",
  danger: "#ff6b61",
  dangerSoft: "#2e1512",
  info: "#5ab7e8",
  infoSoft: "#11242e",

  ring: "#2fbd78",
  scrim: "rgba(3, 5, 12, 0.7)",
  hatch: "rgba(47, 189, 120, 0.16)",

  shadowCard: { color: "#000000", opacity: 0.5, radius: 16, offsetY: 8, elevation: 3 },
  shadowPop: { color: "#000000", opacity: 0.85, radius: 36, offsetY: 20, elevation: 16 },

  barStyle: "light",
};

/** Inter for everything, JetBrains Mono for figures and labels. */
export const adminFonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semi: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  extra: "Inter_800ExtraBold",
  mono: "JetBrainsMono_400Regular",
  monoMed: "JetBrainsMono_500Medium",
};

/** The site's single easing curve: cubic-bezier(0.16, 1, 0.3, 1). */
export const ADMIN_EASE = { x1: 0.16, y1: 1, x2: 0.3, y2: 1 };

/** Radii used by the web kit (rounded-lg / -xl / -2xl, and `.card`). */
export const adminRadius = { lg: 8, xl: 12, card: 16, "2xl": 16, pill: 999 };
