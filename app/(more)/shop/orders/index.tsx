import React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ShoppingBag, ChevronRight } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { shopApi, safe, toRows } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Card, Badge, Skeleton, EmptyState } from "@/components/ui";
import { SignInPrompt } from "@/components/SignInPrompt";
import { FadeInUp } from "@/components/FadeInUp";
import { formatINR, formatDateTime, titleCase } from "@/lib/format";

/** Every merch order, newest first — the entry point to tracking. */
export default function MyOrders() {
  const { c } = useTheme();
  const router = useRouter();
  const { user } = useSession();

  const q = useAsync(
    () => (user ? safe(shopApi.myOrders(), null as any) : Promise.resolve(null)),
    [user?.email],
    { refetchOnFocus: true }
  );
  const rows = toRows(q.data);

  if (!user) {
    return (
      <SubScreen eyebrow="Shop" title="My orders">
        <SignInPrompt message="Sign in to see your merch orders." />
      </SubScreen>
    );
  }

  return (
    <SubScreen eyebrow="Shop" title="My orders" refreshing={q.refreshing} onRefresh={q.refresh}>
      {q.loading ? (
        <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={96} radius={20} />)}</View>
      ) : !rows.length ? (
        <EmptyState icon={<ShoppingBag size={26} color={c.fgMuted} />} title="No orders yet" subtitle="Anything you buy from the shop shows up here with live tracking." />
      ) : (
        <View style={{ gap: 12 }}>
          {rows.map((o: any, i: number) => {
            const id = o._id || o.id || o.order_reference;
            const status = String(o.status || o.order_status || "").toUpperCase();
            const cancelled = ["CANCELLED", "REFUNDED", "REFUND_PENDING"].includes(status);
            const delivered = status === "DELIVERED";
            return (
              <FadeInUp key={id || i} delay={Math.min(i, 8) * 50}>
                <Pressable onPress={() => router.push(`/(more)/shop/orders/${id}`)}>
                  <Card>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Txt size={14.5} font="sansBold" numberOfLines={1}>{o.order_reference || `Order ${i + 1}`}</Txt>
                        <Txt size={12} tone="muted" style={{ marginTop: 2 }}>{formatDateTime(o.created_at)}</Txt>
                      </View>
                      <Badge
                        label={titleCase(status.replace(/_/g, " ")) || "Pending"}
                        tone={cancelled ? "danger" : delivered ? "success" : "warning"}
                      />
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
                      <Txt size={17} font="sansExt" tone="accent">{formatINR(o.total_amount ?? o.amount ?? 0)}</Txt>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                        <Txt size={12.5} font="sansBold" tone="accent">Track</Txt>
                        <ChevronRight size={15} color={c.accent} />
                      </View>
                    </View>
                  </Card>
                </Pressable>
              </FadeInUp>
            );
          })}
        </View>
      )}
    </SubScreen>
  );
}
