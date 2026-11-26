import React from "react";
import { View } from "react-native";
import Animated, { Easing, FadeIn } from "react-native-reanimated";
import { Image } from "expo-image";
import { activitiesApi, safe } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";

/* "Booked by David, Helen & 5 others" — real confirmed bookings only
   (first name + photo, nothing else leaves the server). Hidden until at
   least one person has booked, so a new event never shows an empty claim. */

const RING = ["#FF385C", "#F9862B", "#C084FC", "#38BDF8", "#34D399"];

export function BookedBy({ eventId }: { eventId: string }) {
  const { c } = useTheme();
  const { data } = useAsync(() => safe(activitiesApi.bookedBy(eventId, 3), null), [eventId]);
  const people = data?.people || [];
  const count = data?.count || 0;
  if (!count || !people.length) return null;

  const names = people.slice(0, 2).map((p) => p.first_name);
  const others = Math.max(0, count - names.length);
  const line =
    others > 0
      ? `${names.join(", ")} & ${others} ${others === 1 ? "other" : "others"}`
      : names.length === 2
        ? `${names[0]} & ${names[1]}`
        : names[0];

  return (
    <Animated.View
      entering={FadeIn.duration(450)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 18,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
      }}
    >
      <View style={{ flexDirection: "row" }}>
        {people.slice(0, 3).map((p, i) => (
          <Animated.View
            key={`${p.first_name}-${i}`}
            entering={FadeIn.delay(80 + i * 80).duration(320).easing(Easing.out(Easing.cubic))}
            style={{
              width: 40,
              height: 40,
              borderRadius: 999,
              marginLeft: i ? -14 : 0,
              borderWidth: 2.5,
              borderColor: c.surface,
              backgroundColor: RING[i % RING.length],
              overflow: "hidden",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 3 - i,
            }}
          >
            {p.avatar_url ? (
              <Image source={{ uri: p.avatar_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} />
            ) : (
              <Txt size={15} font="sansBold" style={{ color: "#fff" }}>{(p.first_name || "?").charAt(0).toUpperCase()}</Txt>
            )}
          </Animated.View>
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <Txt size={15} font="sansBold">Booked by</Txt>
        <Txt size={13} tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>{line}</Txt>
      </View>
    </Animated.View>
  );
}
