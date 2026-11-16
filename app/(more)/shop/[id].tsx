import React, { useMemo, useRef, useState } from "react";
import { View, Pressable, ScrollView, Dimensions, Animated, Easing } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ArrowLeft, ShoppingCart, Minus, Plus, Check, Truck, RefreshCcw, ShieldCheck } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { shopApi } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useCart } from "@/context/Cart";
import { Txt, Button, Skeleton, Divider } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { formatINR, titleCase } from "@/lib/format";

const W = Dimensions.get("window").width;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export default function Product() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { add, count } = useCart();
  const { data: p, loading } = useAsync(() => shopApi.product(String(id)), [id]);

  const [imgIdx, setImgIdx] = useState(0);
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  // The product image flies into the cart icon on add — a quick confirmation
  // that the tap landed, without a dialog.
  const fly = useRef(new Animated.Value(0)).current;
  const [flying, setFlying] = useState(false);

  const images: string[] = useMemo(() => {
    if (!p) return [];
    return (p.images?.length ? p.images : [p.image_url]).filter(Boolean);
  }, [p]);
  const variants: any[] = p?.variants || [];
  const sizes = Array.from(new Set(variants.map((v) => v.size).filter(Boolean)));
  const colors = Array.from(new Set(variants.map((v) => v.color).filter(Boolean)));
  const variant = variants.find((v) => (!sizes.length || v.size === size) && (!colors.length || v.color === color));
  const price = variant?.price_override ?? p?.price ?? 0;

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 60, paddingHorizontal: 20, gap: 14 }}>
        <Skeleton h={320} radius={20} /><Skeleton h={24} w="60%" /><Skeleton h={80} radius={12} />
      </View>
    );
  }
  if (!p) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, alignItems: "center", justifyContent: "center", gap: 14 }}>
        <Txt size={18} font="sansBold">Product not found</Txt>
        <Button label="Back to shop" onPress={() => router.replace("/(more)/shop")} />
      </View>
    );
  }

  const canAdd = (!sizes.length || size) && (!colors.length || color);
  const addToCart = () => {
    if (!canAdd) return;
    add({ productId: p._id || p.id, variantId: variant?.variant_id, name: p.name, price, image: images[0], size: size || undefined, color: color || undefined }, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);

    setFlying(true);
    fly.setValue(0);
    Animated.timing(fly, { toValue: 1, duration: 620, easing: Easing.bezier(0.16, 1, 0.3, 1), useNativeDriver: true })
      .start(() => setFlying(false));
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={c.barStyle === "light" ? "light" : "dark"} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 130 }}>
        {/* Gallery */}
        <View style={{ height: W, backgroundColor: c.surface2 }}>
          <AppImage uri={images[imgIdx]} seed={p._id} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        </View>
        {images.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, padding: 14 }}>
            {images.map((im, i) => (
              <Pressable key={i} onPress={() => setImgIdx(i)} style={{ width: 60, height: 60, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: i === imgIdx ? c.accent : c.border }}>
                <AppImage uri={im} seed={i} style={{ width: "100%", height: "100%" }} />
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        <View style={{ paddingHorizontal: 20, paddingTop: images.length > 1 ? 4 : 18, gap: 16 }}>
          <View>
            {p.category ? <Txt size={11} font="monoMed" tone="subtle" tracking={2} uppercase>{titleCase(p.category)}</Txt> : null}
            <Txt size={24} font="display" tracking={-0.5} style={{ marginTop: 4 }}>{p.name}</Txt>
            <Txt size={22} font="display" style={{ color: "#FF385C", marginTop: 6 }}>{formatINR(price)}</Txt>
          </View>

          {colors.length ? (
            <View style={{ gap: 10 }}>
              <Txt size={12.5} font="sansBold" tone="muted">Colour{color ? ` · ${color}` : ""}</Txt>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {colors.map((cl) => (
                  <Pressable key={cl} onPress={() => setColor(cl)} style={{ width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: color === cl ? c.accent : c.border }}>
                    <View style={{ width: 26, height: 26, borderRadius: 999, backgroundColor: String(cl).toLowerCase(), borderWidth: 1, borderColor: c.border }} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {sizes.length ? (
            <View style={{ gap: 10 }}>
              <Txt size={12.5} font="sansBold" tone="muted">Size{size ? ` · ${size}` : ""}</Txt>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {sizes.map((s) => (
                  <Pressable key={s} onPress={() => setSize(s)} style={{ minWidth: 52, height: 44, paddingHorizontal: 14, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: size === s ? "transparent" : c.border, backgroundColor: size === s ? c.accent : c.surface }}>
                    <Txt size={13.5} font="sansBold" style={{ color: size === s ? c.onAccent : c.fg }}>{s}</Txt>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Txt size={12.5} font="sansBold" tone="muted">Qty</Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingHorizontal: 6, height: 44 }}>
              <Pressable onPress={() => setQty((q) => Math.max(1, q - 1))} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}><Minus size={16} color={c.fg} /></Pressable>
              <Txt size={16} font="sansBold">{qty}</Txt>
              <Pressable onPress={() => setQty((q) => Math.min(20, q + 1))} style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}><Plus size={16} color={c.fg} /></Pressable>
            </View>
          </View>

          {p.description ? (
            <View style={{ gap: 8 }}>
              <Txt size={15} font="sansBold">Details</Txt>
              <Txt size={14} tone="muted" lh={22}>{p.description}</Txt>
            </View>
          ) : null}

          <Divider />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {[[Truck, "Free shipping", "Over ₹999"], [RefreshCcw, "Easy returns", "7-day policy"], [ShieldCheck, "Secure", "100% safe"]].map(([Ic, t, d]: any, i) => (
              <View key={i} style={{ flex: 1, alignItems: "center", gap: 5 }}>
                <Ic size={18} color={c.accent} />
                <Txt size={11.5} font="sansBold" align="center">{t}</Txt>
                <Txt size={10.5} tone="subtle" align="center">{d}</Txt>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {flying ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: SCREEN_H * 0.3, left: SCREEN_W / 2 - 40,
            width: 80, height: 80, borderRadius: 18, overflow: "hidden",
            opacity: fly.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 0.9, 0] }),
            transform: [
              { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [0, SCREEN_W / 2 - 58] }) },
              { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [0, -(SCREEN_H * 0.3) + insets.top + 8] }) },
              { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [1, 0.26] }) },
              { rotate: fly.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "18deg"] }) },
            ],
          }}
        >
          <AppImage uri={images[imgIdx] || images[0]} seed={p?._id} style={{ width: "100%", height: "100%" }} />
        </Animated.View>
      ) : null}

      {/* Back + cart */}
      <View style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, flexDirection: "row", justifyContent: "space-between" }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(more)/shop"))} style={{ width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceGlass, borderWidth: 1, borderColor: c.border }}><ArrowLeft size={20} color={c.fg} /></Pressable>
        <Pressable onPress={() => router.push("/(more)/cart")} style={{ width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceGlass, borderWidth: 1, borderColor: c.border }}>
          <Animated.View style={{ transform: [{ scale: flying ? fly.interpolate({ inputRange: [0, 0.8, 0.92, 1], outputRange: [1, 1, 1.3, 1] }) : 1 }] }}>
            <ShoppingCart size={18} color={c.fg} />
          </Animated.View>
          {count > 0 ? <View style={{ position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" }}><Txt size={10} font="sansBold" style={{ color: c.onAccent }}>{count}</Txt></View> : null}
        </Pressable>
      </View>

      {/* District Floating Add to cart bar */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 14, paddingBottom: insets.bottom + 14, backgroundColor: "rgba(20, 22, 30, 0.96)", borderTopWidth: 1, borderTopColor: "rgba(255, 255, 255, 0.1)" }}>
        {(() => {
          const stock = variant?.stock ?? p?.stock;
          const out = typeof stock === "number" && stock <= 0;
          const low = typeof stock === "number" && stock > 0 && stock <= 5;
          return (
            <>
              {typeof stock === "number" ? (
                <Txt size={12} font="sansSemi" tone={out ? "danger" : low ? "warning" : "subtle"} style={{ marginBottom: 8 }}>
                  {out ? "Out of stock" : low ? `Only ${stock} left` : `${stock} in stock`}
                </Txt>
              ) : null}
              <Button
                label={out ? "Out of stock" : added ? "Added to cart" : canAdd ? "Add to cart" : "Select options"}
                disabled={!canAdd || out}
                full size="lg" onPress={addToCart}
                icon={added ? <Check size={17} color={c.onAccent} /> : <ShoppingCart size={17} color={c.onAccent} />}
              />
            </>
          );
        })()}
      </View>
    </View>
  );
}
