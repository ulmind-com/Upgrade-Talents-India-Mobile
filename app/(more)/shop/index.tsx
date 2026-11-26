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
import { Txt, Card, Skeleton, EmptyState, ErrorState, SearchField } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { FadeInUp } from "@/components/FadeInUp";
import { PromoHeroBanner } from "@/components/PromoHeroBanner";
import { DottedGrid } from "@/components/patterns";
import { genz } from "@/theme/tokens";
import { formatINR, titleCase } from "@/lib/format";

const COL = (Dimensions.get("window").width - 40 - 14) / 2;

export default function Shop() {
  const { c } = useTheme();
  const router = useRouter();
  const { count } = useCart();
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");

  const products = useAsync(() => shopApi.products({ limit: 60 }), []);
  const categories = useAsync(() => safe(shopApi.categories(), []), []);
  const rows = toRows(products.data);
  const cats = ["all", ...toRows(categories.data).map((x: any) => (typeof x === "string" ? x : x.name || x.slug)).filter(Boolean)];

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((p: any) => {
      if (cat !== "all" && (p.category || "").toLowerCase() !== cat.toLowerCase()) return false;
      if (!s) return true;
      return [p.name, p.category, p.description].filter(Boolean).some((v: any) => String(v).toLowerCase().includes(s));
    });
  }, [rows, cat, q]);

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
            <View style={{ position: "absolute", top: -4, right: -4, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 999, backgroundColor: "#FF385C", alignItems: "center", justifyContent: "center" }}>
              <Txt size={10.5} font="sansBold" style={{ color: "#fff" }}>{count}</Txt>
            </View>
          ) : null}
        </Pressable>
      }
    >
      {/* 3D Character Promo Banner — Zomato District Style */}
      <FadeInUp>
        <PromoHeroBanner
          tag="Official Merch Drop"
          title="Wear the Movement"
          subtitle="Exclusive performer tees, hoodies & official gear"
          characterSource={require("../../../assets/banners/3d_shop_char.png")}
          glowColor="rgba(220, 50, 240, 0.16)"
        />
      </FadeInUp>

      <View style={{ marginBottom: 14 }}>
        <SearchField value={q} onChangeText={setQ} placeholder="Search merch" />
      </View>

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
      ) : rows.length ? (
        <EmptyState icon={<ShoppingBag size={26} color={c.fgMuted} />} title="Nothing matches" subtitle="Try a different search or category." />
      ) : (
        <EmptyState icon={<ShoppingBag size={26} color={c.fgMuted} />} title="No products yet" subtitle="New merch drops soon." />
      )}
    </SubScreen>
  );
}
