import React, { useRef, useState } from "react";
import { View, TextInput, type TextInputInstance, type TextInputKeyPressEvent } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

/** Segmented OTP input — one box per digit, auto-advance + backspace. */
export function OtpInput({ value, onChange, length = 6 }: { value: string; onChange: (v: string) => void; length?: number }) {
  const { c, fonts } = useTheme();
  const refs = useRef<Array<TextInputInstance | null>>([]);
  const [focus, setFocus] = useState(-1);

  const handle = (i: number, text: string) => {
    const d = text.replace(/\D/g, "");
    if (d.length > 1) {
      const next = (value.slice(0, i) + d).slice(0, length);
      onChange(next);
      refs.current[Math.min(next.length, length - 1)]?.focus();
      return;
    }
    const arr = value.padEnd(length, " ").split("");
    arr[i] = d || " ";
    onChange(arr.join("").replace(/\s+$/g, "").replace(/\s/g, ""));
    if (d && i < length - 1) refs.current[i + 1]?.focus();
  };

  const onKey = (i: number, e: TextInputKeyPressEvent) => {
    if (e.nativeEvent.key === "Backspace" && !value[i] && i > 0) {
      refs.current[i - 1]?.focus();
      const arr = value.split("");
      arr[i - 1] = "";
      onChange(arr.join(""));
    }
  };

  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
      {Array.from({ length }).map((_, i) => {
        const filled = !!value[i];
        const active = focus === i;
        return (
          <TextInput
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            value={value[i] || ""}
            onChangeText={(t) => handle(i, t)}
            onKeyPress={(e) => onKey(i, e)}
            onFocus={() => setFocus(i)}
            onBlur={() => setFocus(-1)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            style={{
              flex: 1,
              aspectRatio: 0.82,
              maxWidth: 52,
              textAlign: "center",
              borderRadius: 14,
              borderWidth: 2,
              borderColor: active ? c.accent : filled ? c.borderStrong : c.border,
              backgroundColor: filled ? c.surface2 : c.bgElevated,
              color: c.fg,
              fontFamily: fonts.display,
              fontSize: 24,
            }}
          />
        );
      })}
    </View>
  );
}
