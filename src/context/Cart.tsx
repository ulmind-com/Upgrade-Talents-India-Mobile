import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";

export type CartItem = {
  key: string; // productId + variantId
  productId: string;
  variantId?: string;
  name: string;
  price: number;
  image?: string;
  size?: string;
  color?: string;
  qty: number;
};

type CartCtx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, "key" | "qty">, qty?: number) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "uti_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(KEY)
      .then((v) => { if (v) setItems(JSON.parse(v)); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    SecureStore.setItemAsync(KEY, JSON.stringify(items)).catch(() => {});
  }, [items, ready]);

  const add: CartCtx["add"] = (item, qty = 1) => {
    const key = `${item.productId}::${item.variantId || ""}`;
    setItems((cur) => {
      const found = cur.find((i) => i.key === key);
      if (found) return cur.map((i) => (i.key === key ? { ...i, qty: Math.min(20, i.qty + qty) } : i));
      return [...cur, { ...item, key, qty }];
    });
  };
  const setQty = (key: string, qty: number) =>
    setItems((cur) => (qty <= 0 ? cur.filter((i) => i.key !== key) : cur.map((i) => (i.key === key ? { ...i, qty } : i))));
  const remove = (key: string) => setItems((cur) => cur.filter((i) => i.key !== key));
  const clear = () => setItems([]);

  const value = useMemo<CartCtx>(() => {
    const count = items.reduce((a, x) => a + x.qty, 0);
    const subtotal = items.reduce((a, x) => a + x.price * x.qty, 0);
    return { items, count, subtotal, add, setQty, remove, clear };
  }, [items]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
