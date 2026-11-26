import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { View, Pressable, Animated, Easing } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, AlertTriangle, Info, X } from "lucide-react-native";
import { Txt } from "@/components/ui";
import { type MsgTone } from "@/theme/tokens";
import { playNavFeedback } from "@/lib/sound";

export type PopupTone = MsgTone;
type State = { tone: PopupTone; title: string; msg?: string; id: number } | null;

// glyphs that read inside a small solid chip (reference: ✓ · ! · i)
const ICONS = { success: Check, error: AlertTriangle, warning: AlertTriangle, info: Info };

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

/* Tone colours for the dark toast: the icon chip is the colour, the circle
   behind it is a soft wash of it, and the second line is written in it. */
const TONE: Record<PopupTone, string> = {
  success: "#3DD68C",
  error: "#FF5A5F",
  warning: "#F5B83D",
  info: "#5B8CFF",
};

/** The toast: a dark pill sliding down from the top — icon, title, message, close. */
function PopupView({ state, onHide }: { state: State; onHide: () => void }) {
  const insets = useSafeAreaInsets();
  const [a] = useState(() => new Animated.Value(0));
  const timer = useRef<any>(null);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    Animated.timing(a, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => finished && onHide());
  }, [a, onHide]);

  useEffect(() => {
    if (!state) return;
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    clearTimeout(timer.current);
    // longer messages stay a little longer
    timer.current = setTimeout(hide, 3200 + Math.min(2500, (state.msg?.length || 0) * 25));
    return () => clearTimeout(timer.current);
  }, [state?.id]);

  if (!state) return null;
  const color = TONE[state.tone];
  const Icon = ICONS[state.tone];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: insets.top + 8,
        left: 14,
        right: 14,
        zIndex: 999,
        opacity: a,
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) }],
      }}
    >
      <Pressable
        onPress={() => { playNavFeedback(); hide(); }}
        accessibilityRole="alert"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          paddingVertical: 10,
          paddingLeft: 10,
          paddingRight: 8,
          borderRadius: 40,
          backgroundColor: "#16171F",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.07)",
          shadowColor: "#000",
          shadowOpacity: 0.55,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 12 },
          elevation: 16,
        }}
      >
        {/* tinted circle with a solid rounded chip */}
        <View style={{ width: 52, height: 52, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: color + "22" }}>
          <View style={{ width: 30, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: color }}>
            <Icon size={18} color="#fff" strokeWidth={2.6} />
          </View>
        </View>

        <View style={{ flex: 1, paddingVertical: 2 }}>
          <Txt size={15} font="sansSemi" lh={20} style={{ color: "#F2F3F7" }}>{state.title}</Txt>
          {state.msg ? (
            <Txt size={13.5} font="sansSemi" lh={19} style={{ color, marginTop: 1 }}>{state.msg}</Txt>
          ) : null}
        </View>

        <Pressable onPress={() => { playNavFeedback(); hide(); }} hitSlop={10} accessibilityLabel="Dismiss" style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
          <X size={20} color="rgba(255,255,255,0.45)" strokeWidth={2.4} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}
