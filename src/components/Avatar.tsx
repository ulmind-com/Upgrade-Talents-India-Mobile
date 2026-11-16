import React, { useState } from "react";
import { View, StyleProp, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";
import { assetUrl } from "@/lib/api";
import { initials } from "@/lib/format";

/**
 * Profile avatar. Shows the uploaded photo when there is one and it loads,
 * and falls back to the member's initials otherwise — never a stock image,
 * which would look wrong where a face is expected.
 */
export function Avatar({
  name,
  photo,
  size = 44,
  fontSize,
  textColor = "#fff",
  border,
  gradient = true,
  style,
}: {
  name?: string | null;
  photo?: string | null;
  size?: number;
  fontSize?: number;
  textColor?: string;
  border?: { width: number; color: string };
  /** Fill the initials background with the brand gradient. */
  gradient?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const [failed, setFailed] = useState(false);
  const src = !failed && photo ? assetUrl(photo) : undefined;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: 999,
          overflow: "hidden",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: c.surface2,
          ...(border ? { borderWidth: border.width, borderColor: border.color } : null),
        },
        style,
      ]}
    >
      {src ? (
        <Image
          source={{ uri: src }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={200}
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          {gradient ? (
            <LinearGradient colors={c.gradBrand as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", width: "100%", height: "100%" }} />
          ) : null}
          <Txt size={fontSize ?? Math.round(size * 0.38)} font="display" style={{ color: textColor }}>
            {initials(name)}
          </Txt>
        </>
      )}
    </View>
  );
}
