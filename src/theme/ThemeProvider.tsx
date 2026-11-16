import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { PALETTES, type Palette, type ThemeName, radius, space, fonts } from "./tokens";

const THEME_KEY = "uti_theme";

type ThemeCtx = {
  name: ThemeName;
  c: Palette;
  radius: typeof radius;
  space: typeof space;
  fonts: typeof fonts;
  toggle: () => void;
  setTheme: (t: ThemeName) => void;
};

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState<ThemeName>("dark");

  useEffect(() => {
    // Permanently enforce Zomato District Dark mode and clean any legacy light mode preference
    SecureStore.setItemAsync(THEME_KEY, "dark").catch(() => {});
    setName("dark");
  }, []);

  const setTheme = (_t: ThemeName) => {
    setName("dark");
    SecureStore.setItemAsync(THEME_KEY, "dark").catch(() => {});
  };
  const toggle = () => setTheme("dark");

  const value = useMemo<ThemeCtx>(
    () => ({ name, c: PALETTES[name], radius, space, fonts, toggle, setTheme }),
    [name]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
