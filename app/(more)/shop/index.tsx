import React, { useMemo, useState } from "react";
import { View, Pressable, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ShoppingBag, ShoppingCart, Sparkles } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { shopApi, safe, toRows } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useCart } from "@/context/Cart";
import { Txt, Card, Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { FadeInUp } from "@/components/FadeInUp";
import { DottedGrid } from "@/components/patterns";
import { genz } from "@/theme/tokens";
import { formatINR, titleCase } from "@/lib/format";

const COL = (Dimensions.get("window").width - 40 - 14) / 2;

export default function Shop() {
  const { c } = useTheme();
  const router = useRouter();
  const { count } = useCart();
  const [cat, setCat] = useState<string>("all");

  const products = useAsync(() => shopApi.products({ limit: 60 }), []);
  const categories = useAsync(() => safe(shopApi.categories(), []), []);
  const rows = toRows(products.data);
  const cats = ["all", ...toRows(categories.data).map((x: any) => (typeof x === "string" ? x : x.name || x.slug)).filter(Boolean)];

  const filtered = useMemo(() => (cat === "all" ? rows : rows.filter((p: any) => (p.category || "").toLowerCase() === cat.toLowerCase())), [rows, cat]);

  return (
    <SubScreen
      eyebrow="Official merch"
      title="Shop"
      refreshing={products.refreshing}
      onRefresh={products.refresh}
      right={
        <Pressable onPress={() => router.push("/(more)/cart")} style={{ width: 44, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
          <ShoppingCart size={19} color={c.fg} />
          {count > 0 ? (
            <View style={{ position: "absolute", top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 999, backgroundColor: "#f0407e", alignItems: "center", justifyContent: "center" }}>
              <Txt size={10.5} font="sansBold" style={{ color: "#fff" }}>{count}</Txt>
            </View>
          ) : null}
        </Pressable>
      }
    >
      {/* Drop hero — violet/pink sectional colour */}
      <FadeInUp>
        <View style={{ borderRadius: 24, overflow: "hidden", marginBottom: 20 }}>
          <LinearGradient colors={["#b36bff", "#7c3aed", "#5b21b6"] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20 }}>
            <DottedGrid color="rgba(255,255,255,0.25)" opacity={0.5} gap={18} />
            <Txt size={72} font="display" style={{ position: "absolute", top: -4, right: -6, color: "rgba(255,255,255,0.14)", letterSpacing: -3 }}>DROP</Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Sparkles size={14} color="#fff" />
              <Txt size={10.5} font="monoMed" tracking={2.5} uppercase style={{ color: "rgba(255,255,255,0.92)" }}>Season drop</Txt>
            </View>
            <Txt size={25} font="display" tracking={-0.5} lh={28} style={{ color: "#fff", marginTop: 12 }}>Wear the{"\n"}movement.</Txt>
            <Txt size={13} lh={19} style={{ color: "rgba(255,255,255,0.9)", marginTop: 8, maxWidth: 240 }}>Official tees, hoodies & gear from the floor.</Txt>
          </LinearGradient>
        </View>
      </FadeInUp>

      {cats.length > 1 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {cats.map((x, i) => {
            const on = cat === x;
            const [g1] = genz(i);
            return (
              <Pressable key={x} onPress={() => setCat(x)} style={{ paddingHorizontal: 14, height: 38, justifyContent: "center", borderRadius: 999, borderWidth: on ? 0 : 1, borderColor: c.border, backgroundColor: on ? g1 : c.surface }}>
                <Txt size={12.5} font="sansBold" style={{ color: on ? "#fff" : c.fgMuted }}>{titleCase(x)}</Txt>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {products.loading ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={COL * 1.4} w={COL} radius={20} />)}</View>
      ) : products.error && !rows.length ? (
        <ErrorState message={products.error} onRetry={products.reload} />
      ) : filtered.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {filtered.map((p: any, i: number) => {
            const [g1, g2] = genz(i);
            return (
              <FadeInUp key={p._id || p.id || i} delay={Math.min(i, 8) * 45} style={{ width: COL }}>
                <Pressable onPress={() => router.push(`/(more)/shop/${p._id || p.id}`)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                  <View style={{ borderRadius: 22, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
                    <View style={{ height: COL * 1.02, backgroundColor: g1 + "22" }}>
                      <AppImage uri={p.image_url || p.images?.[0]} seed={p._id || i} style={{ width: "100%", height: "100%" }} />
                      {/* colour-coded price pill */}
                      <View style={{ position: "absolute", bottom: 8, left: 8, borderRadius: 999, overflow: "hidden" }}>
                        <LinearGradient colors={[g1, g2] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ paddingHorizontal: 11, paddingVertical: 5 }}>
                          <Txt size={13} font="sansExt" style={{ color: "#fff" }}>{formatINR(p.price)}</Txt>
                        </LinearGradient>
                      </View>
                      {/* stock, straight from the catalogue */}
                      {typeof p.stock === "number" ? (
                        <View style={{ position: "absolute", top: 8, right: 8, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: p.stock <= 0 ? c.danger : p.stock <= 5 ? c.warning : "rgba(0,0,0,0.55)" }}>
                          <Txt size={10} font="sansBold" style={{ color: "#fff" }}>
                            {p.stock <= 0 ? "SOLD OUT" : p.stock <= 5 ? `ONLY ${p.stock}` : "IN STOCK"}
                          </Txt>
                        </View>
                      ) : null}
                    </View>
                    <View style={{ padding: 11, gap: 3 }}>
                      <Txt size={13.5} font="sansBold" numberOfLines={1}>{p.name}</Txt>
                      {p.category ? <Txt size={10.5} font="sansSemi" style={{ color: g1 }} numberOfLines={1} uppercase>{titleCase(p.category)}</Txt> : null}
                    </View>
                  </View>
                </Pressable>
              </FadeInUp>
            );
          })}
        </View>
      ) : (
        <EmptyState icon={<ShoppingBag size={26} color={c.fgMuted} />} title="No products yet" subtitle="New merch drops soon." />
      )}
    </SubScreen>
  );
}
