import React, { useEffect, useRef, useState } from "react";
import { View, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { Coins, Minus, Plus } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { extrasApi } from "@/lib/api";
import { Txt, Skeleton } from "@/components/ui";
import { formatINR } from "@/lib/format";

type Quote = {
  is_eligible?: boolean;
  coins_applied?: number;
  discount_amount?: number;
  final_payable_amount?: number;
  ineligible_reason?: string;
};

/**
 * Apply reward coins to a course or workshop fee.
 *
 * Every figure comes from the backend's own quote — the component never does
 * its own arithmetic, so what is shown is exactly what will be charged.
 */
export function CoinRedeem({
  itemId,
  itemType,
  disabled,
  onChange,
}: {
  itemId: string;
  itemType: "course" | "workshop";
  disabled?: boolean;
  /** Reports the coin count and the price the backend says you'd pay. */
  onChange: (coins: number, payable: number | null) => void;
}) {
  const { c } = useTheme();
  const [max, setMax] = useState(0);
  const [coins, setCoins] = useState(0);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoting, setQuoting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Opening quote with no amount = the most the backend will allow. */
  useEffect(() => {
    let alive = true;
    extrasApi
      .calculateDiscount({ item_id: itemId, item_type: itemType })
      .then((q: Quote) => {
        if (!alive) return;
        setQuote(q);
        const cap = Number(q?.coins_applied || 0);
        setMax(cap);
        setCoins(cap);
        onChange(q?.is_eligible ? cap : 0, q?.is_eligible ? Number(q?.final_payable_amount ?? 0) : null);
      })
      .catch(() => { if (alive) setQuote({ is_eligible: false }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; if (timer.current) clearTimeout(timer.current); };
  }, [itemId, itemType]);

  /* Re-quote as the slider settles, never on every tap. */
  const requote = (n: number) => {
    setCoins(n);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setQuoting(true);
      try {
        const q = await extrasApi.calculateDiscount({ item_id: itemId, item_type: itemType, coins_to_use: n });
        setQuote(q);
        onChange(q?.is_eligible ? n : 0, q?.is_eligible ? Number(q?.final_payable_amount ?? 0) : null);
      } catch {
        onChange(0, null);
      } finally { setQuoting(false); }
    }, 320);
  };

  const step = (delta: number) => {
    if (disabled) return;
    const n = Math.max(0, Math.min(max, coins + delta));
    if (n === coins) return;
    Haptics.selectionAsync().catch(() => {});
    requote(n);
  };

  if (loading) return <Skeleton h={92} radius={18} />;
  if (!quote?.is_eligible || max <= 0) return null;

  const discount = Number(quote.discount_amount || 0);
  const payable = Number(quote.final_payable_amount ?? 0);
  const pct = max ? (coins / max) * 100 : 0;

  return (
    <View style={{ borderRadius: 18, borderWidth: 1, borderColor: c.accent + "44", backgroundColor: c.accent + "0d", padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <View style={{ width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: c.accent + "22" }}>
          <Coins size={16} color={c.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt size={14} font="sansBold">Use your coins</Txt>
          <Txt size={11.5} tone="muted" style={{ marginTop: 1 }}>Up to {max} coins on this {itemType}</Txt>
        </View>
      </View>

      {/* stepper + fill bar */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <StepBtn icon={<Minus size={15} color={c.fg} />} onPress={() => step(-Math.max(1, Math.round(max / 10)))} disabled={disabled || coins <= 0} />
        <View style={{ flex: 1 }}>
          <View style={{ height: 8, borderRadius: 999, backgroundColor: c.surface2, overflow: "hidden" }}>
            <View style={{ width: `${pct}%`, height: "100%", borderRadius: 999, backgroundColor: c.accent }} />
          </View>
          <Txt size={13} font="sansBold" align="center" style={{ marginTop: 6 }}>{coins} coins</Txt>
        </View>
        <StepBtn icon={<Plus size={15} color={c.fg} />} onPress={() => step(Math.max(1, Math.round(max / 10)))} disabled={disabled || coins >= max} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 }}>
        <Txt size={12.5} tone="muted">{quoting ? "Checking…" : `You save ${formatINR(discount)}`}</Txt>
        <Txt size={15} font="sansExt" tone="accent">Pay {formatINR(payable)}</Txt>
      </View>
    </View>
  );
}

function StepBtn({ icon, onPress, disabled }: { icon: React.ReactNode; onPress: () => void; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => !disabled && onPress()}
      style={{ width: 38, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, opacity: disabled ? 0.4 : 1 }}
    >
      {icon}
    </Pressable>
  );
}
