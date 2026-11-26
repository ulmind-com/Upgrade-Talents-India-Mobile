import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

/**
 * A slanted streak of light that glides across its parent every few seconds —
 * the "this is the button" glint. Put it inside a view with `overflow: hidden`
 * (it fills that view absolutely and ignores touches). Runs on the UI thread.
 */
export function Shine({ every = 2600, duration = 900, opacity = 0.42 }: { every?: number; duration?: number; opacity?: number }) {
  const [w, setW] = useState(0);
  const p = useSharedValue(0);

  useEffect(() => {
    if (!w) return;
    p.set(
      withRepeat(
        withSequence(
          withDelay(every, withTiming(1, { duration, easing: Easing.inOut(Easing.quad) })),
          withTiming(0, { duration: 0 })
        ),
        -1
      )
    );
  }, [w, every, duration, p]);

  const STREAK = 46;
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -STREAK * 2 + p.value * (w + STREAK * 4) }, { rotate: "18deg" }],
  }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w ? (
        <Animated.View style={[{ position: "absolute", top: -30, bottom: -30, width: STREAK }, style]}>
          <LinearGradient
            colors={["rgba(255,255,255,0)", `rgba(255,255,255,${opacity})`, "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}
