import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Crown, ChevronRight } from "lucide-react-native";
import { Txt } from "@/components/ui";
import { useSession } from "@/context/Session";
import { userVipApi, safe, type VipConfig } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useRealtime } from "@/lib/realtime";
import { VipCard } from "@/components/vip/VipCard";
import { VipBookSheet } from "@/components/vip/VipBookSheet";
import { VIP_GOLD, MUTED, type VipResult } from "@/lib/vip";

/**
 * "VIP access" on an event page — that event's enabled tiers with live
 * capacity, bookable in place. Capacity refreshes the moment someone books
 * (realtime `event:{id}`). Renders nothing when the event has no VIP tiers.
 */
export function EventVipSection({ eventId, eventTitle }: { eventId: string; eventTitle?: string }) {
  const router = useRouter();
  const { user } = useSession();
  const q = useAsync(() => safe(userVipApi.forEvent(eventId), [] as VipConfig[]), [eventId]);
  const [cfg, setCfg] = useState<VipConfig | null>(null);

  // someone else booked → seats moved; refresh quietly
  useRealtime([`event:${eventId}`], () => q.refresh());

  const rows = q.data || [];
  if (!rows.length) return null;

  const onConfirmed = (r: VipResult) => {
    q.refresh();
    if (r.passIds.length === 1) router.push(`/(more)/vip/pass/${r.passIds[0]}`);
    else router.push({ pathname: "/(more)/vip", params: { tab: "passes" } });
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: "rgba(245,197,66,0.14)", alignItems: "center", justifyContent: "center" }}>
          <Crown size={16} color={VIP_GOLD} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt size={20} font="display" tracking={-0.5} uppercase>VIP access</Txt>
          <Txt size={12.5} style={{ color: MUTED }}>Lounges, backstage and the best views</Txt>
        </View>
      </View>

      {rows.map((c) => {
        const full = { ...c, event_title: c.event_title || eventTitle };
        return (
          <VipCard
            key={String(c._id || c.id)}
            cfg={full}
            compact
            onBook={() => (user ? setCfg(full) : router.push("/(auth)/login"))}
          />
        );
      })}

      <Pressable
        onPress={() => router.push({ pathname: "/(more)/vip", params: { event: eventId } })}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", opacity: pressed ? 0.7 : 1 })}
      >
        <Txt size={13} font="sansBold" style={{ color: VIP_GOLD }}>Full details & my passes</Txt>
        <ChevronRight size={15} color={VIP_GOLD} />
      </Pressable>

      <VipBookSheet cfg={cfg} onClose={() => setCfg(null)} onConfirmed={onConfirmed} />
    </View>
  );
}
