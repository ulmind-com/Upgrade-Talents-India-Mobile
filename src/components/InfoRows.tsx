import React from "react";
import { View, Pressable } from "react-native";
import { ChevronRight } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";

/** Calendar-style date tile — month strip over a big day number. */
export function DateChip({ day, month }: { day: string | number; month: string }) {
  const { c } = useTheme();
  return (
    <View style={{ width: 46, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.bgElevated, overflow: "hidden", alignItems: "center" }}>
      <View style={{ width: "100%", alignItems: "center", backgroundColor: c.accent + "26", paddingVertical: 2.5 }}>
        <Txt size={9} font="sansExt" tracking={1.2} style={{ color: c.accent }}>{String(month).toUpperCase()}</Txt>
      </View>
      <Txt size={19} font="sansExt" lh={23} style={{ paddingVertical: 4 }}>{day}</Txt>
    </View>
  );
}

type RowProps = {
  icon?: React.ReactNode;
  dateChip?: React.ReactNode;
  label?: string;
  value: string;
  sub?: string;
  valueColor?: string;
  onPress?: () => void;
};

/** One clean info line: a tile (icon or date chip) + label/value/sub. */
export function InfoRow({ icon, dateChip, label, value, sub, valueColor, onPress }: RowProps) {
  const { c } = useTheme();
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 16 }}>
      {dateChip ? (
        dateChip
      ) : (
        <View style={{ width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: c.bgElevated, borderWidth: 1, borderColor: c.border }}>
          {icon}
        </View>
      )}
      <View style={{ flex: 1 }}>
        {label ? <Txt size={10.5} font="monoMed" tone="subtle" tracking={1.5} uppercase>{label}</Txt> : null}
        <Txt size={15.5} font="sansBold" numberOfLines={2} style={[{ marginTop: label ? 2 : 0 }, valueColor ? { color: valueColor } : null]}>{value}</Txt>
        {sub ? <Txt size={12.5} tone="muted" numberOfLines={2} style={{ marginTop: 2 }}>{sub}</Txt> : null}
      </View>
      {onPress ? <ChevronRight size={18} color={c.fgSubtle} /> : null}
    </View>
  );
  if (onPress) {
    return <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>{body}</Pressable>;
  }
  return body;
}

/** Groups InfoRows into one bordered card with hairline dividers. */
export function InfoCard({ children, style }: { children: React.ReactNode; style?: any }) {
  const { c } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ borderRadius: 20, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: "hidden" }, style]}>
      {items.map((ch, i) => (
        <View key={i}>
          {i ? <View style={{ height: 1, backgroundColor: c.border, marginLeft: 16 }} /> : null}
          {ch}
        </View>
      ))}
    </View>
  );
}
