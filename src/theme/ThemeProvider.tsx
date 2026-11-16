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
    SecureStore.getItemAsync(THEME_KEY)
      .then((v) => {
        if (v === "blue" || v === "dark") setName(v);
      })
      .catch(() => {});
  }, []);

  const setTheme = (t: ThemeName) => {
    setName(t);
    SecureStore.setItemAsync(THEME_KEY, t).catch(() => {});
  };
  const toggle = () => setTheme(name === "dark" ? "blue" : "dark");

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
