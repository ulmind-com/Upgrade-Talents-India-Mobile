import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleProp, ViewStyle } from "react-native";

/**
 * Lightweight mount animation (fade + slight rise). Native-driver only, so it
 * stays smooth without Reanimated. Use `delay` to stagger lists.
 */
export function FadeInUp({
  children,
  delay = 0,
  offset = 14,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  offset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={[
        { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
