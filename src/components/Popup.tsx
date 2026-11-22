import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { View, Pressable, Animated, Easing } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";
import { TONE_GRAD, type MsgTone } from "@/theme/tokens";
import { playNavFeedback } from "@/lib/sound";

export type PopupTone = MsgTone;
type State = { tone: PopupTone; title: string; msg?: string; id: number } | null;

const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };

type ShowFn = (tone: PopupTone, title: string, msg?: string) => void;

const Ctx = createContext<ShowFn>(() => {});
let external: ShowFn | null = null;

/**
 * One popup host for the whole app, mounted at the root. Screens just call
 * `useAlert()` — no overlay to wire up, and every message in the app gets the
 * same surface.
 */
export function PopupProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>(null);
  const show = useCallback<ShowFn>((tone, title, msg) => {
    playNavFeedback();
    setState({ tone, title, msg, id: Date.now() });
  }, []);

  useEffect(() => {
    external = show;
    return () => { external = null; };
  }, [show]);

  return (
    <Ctx.Provider value={show}>
      {children}
      <PopupView state={state} onHide={() => setState(null)} />
    </Ctx.Provider>
  );
}

/** Fire a popup from anywhere inside the tree. */
export const useAlert = () => useContext(Ctx);

/** Same, for code that is not a component (api helpers, listeners). */
export const showPopup: ShowFn = (tone, title, msg) => external?.(tone, title, msg);

/**
 * Kept so screens written against the local popup keep working — it now feeds
 * the single global host, so `node` has nothing left to render.
 */
export function usePopup() {
  const show = useAlert();
  return { show, node: null as React.ReactNode, hide: () => {} };
}

function PopupView({ state, onHide }: { state: State; onHide: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const a = useRef(new Animated.Value(0)).current;
  const timer = useRef<any>(null);

  useEffect(() => {
    if (!state) return;
    a.setValue(0);
    Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 9 }).start();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(a, { toValue: 0, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => finished && onHide());
    }, 3800);
    return () => clearTimeout(timer.current);
  }, [state?.id]);

  if (!state) return null;
  const [g1, g2] = TONE_GRAD[state.tone];
  const Icon = ICONS[state.tone];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute", top: insets.top + 8, left: 16, right: 16, zIndex: 999,
        opacity: a,
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-70, 0] }) }, { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
      }}
    >
      <Pressable onPress={() => { playNavFeedback(); onHide(); }}>
        <View style={{ borderRadius: 20, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, shadowColor: g2, shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 14, flexDirection: "row" }}>
          <LinearGradient colors={[g1, g2] as any} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ width: 5 }} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, flex: 1 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
              <LinearGradient colors={[g1, g2] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", width: "100%", height: "100%" }} />
              <Icon size={19} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={14.5} font="sansExt" numberOfLines={1}>{state.title}</Txt>
              {state.msg ? <Txt size={12.5} tone="muted" lh={17} numberOfLines={3} style={{ marginTop: 2 }}>{state.msg}</Txt> : null}
            </View>
            <X size={16} color={c.fgSubtle} />
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}
