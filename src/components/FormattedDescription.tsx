import React, { useMemo } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Trophy } from "lucide-react-native";
import { Txt } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

/* ──────────────────────────────────────────────────────────────────────────
   The website's FormattedDescription, for the app. Same reading of the
   organiser's plain text — nothing is hard-coded:

     • a line with "CASH PRIZE" / "PRIZE POOL" and an amount (₹ / INR / Lakh /
       Rs) becomes the Prize Pool card
     • ALL-CAPS or *starred* short lines become section headings
     • lines starting with • - * 1. a) or an emoji become bullets
     • "LABEL: value" lines become meta rows
     • ━━━ / ─── lines become dividers
     • *bold* _italic_ ~strike~, links and 10-digit numbers (→ WhatsApp)
     • the whole text always shows (no "see more")
   Drawn in the app's own style.
   ────────────────────────────────────────────────────────────────────────── */

const GOLD = "#F5C542";

export function isPrizePoolLine(text: string) {
  const u = text.toUpperCase();
  return (u.includes("TOTAL CASH PRIZE") || u.includes("CASH PRIZE") || u.includes("PRIZE POOL")) &&
    (u.includes("₹") || u.includes("INR") || u.includes("LAKH") || u.includes("RS"));
}

const BULLET = /^([•\-*]|\d+\.|\(?[a-zA-Z]\)|[🔹👉✅🏆🥇🥈🥉👑🌟🎭😍🩰💥🎖️🎓🗓️📍📌💳🚨📲📞📱📩📢💃🕺])\s+(.*)$/u;

/** *bold* / **bold**, _italic_ / __italic__, ~strike~, links, phone numbers. */
function Inline({ text, color, size, bold }: { text: string; color: string; size: number; bold?: boolean }) {
  const { c } = useTheme();
  const parts: React.ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|__([^_]+)__|_(.*?)_|~([^~]+)~|https?:\/\/[^\s]+|(?:\+?91[\s-]?)?[6-9]\d{9})/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const s = m[0];
    if (m[1] && (m[2] || m[3])) parts.push(<Text key={k++} style={{ fontWeight: "800", color: "#fff" }}>{m[2] || m[3]}</Text>);
    else if (m[4] || m[5]) parts.push(<Text key={k++} style={{ fontStyle: "italic", opacity: 0.85 }}>{m[4] || m[5]}</Text>);
    else if (m[6]) parts.push(<Text key={k++} style={{ textDecorationLine: "line-through", opacity: 0.6 }}>{m[6]}</Text>);
    else if (/^https?:\/\//.test(s))
      parts.push(<Text key={k++} onPress={() => Linking.openURL(s).catch(() => {})} style={{ color: c.accent, fontWeight: "700" }}>{s}</Text>);
    else if (/^\+?[0-9\s-]{10,14}$/.test(s.trim())) {
      const digits = s.replace(/\D/g, "");
      const wa = digits.length === 10 ? `91${digits}` : digits;
      parts.push(<Text key={k++} onPress={() => Linking.openURL(`https://wa.me/${wa}`).catch(() => {})} style={{ color: "#3DD68C", fontWeight: "700" }}>{s}</Text>);
    } else parts.push(s);
    last = m.index + s.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <Txt size={size} font={bold ? "sansBold" : "sans"} lh={Math.round(size * 1.55)} style={{ color, textAlign: bold ? "left" : "justify" }}>
      {parts}
    </Txt>
  );
}

/** The organiser's prize line in a description ("💰 TOTAL CASH PRIZE: ₹1,15,000"), if any. */
export function findPrizeLine(content?: string | null): string | null {
  const line = String(content || "").split(/\r?\n/).map((l) => l.trim()).find(isPrizePoolLine);
  return line || null;
}

/** The highlighted prize — one compact row: trophy, "Prize pool", the amount. */
export function PrizeCard({ text }: { text: string }) {
  // "💰 TOTAL CASH PRIZE: ₹1,15,000" → label stays small, the amount carries the weight
  const clean = text.replace(/[━─—_\-=]/g, "").replace(/^[^A-Za-z0-9₹]+/, "").trim();
  const at = clean.search(/(₹|INR|RS\.?\s*\d|\d)/i);
  const amount = at > 0 ? clean.slice(at).trim() : clean;
  return (
    <Animated.View entering={FadeIn.duration(350).easing(Easing.out(Easing.cubic))} style={s.prize}>
      <LinearGradient colors={["rgba(245,197,66,0.16)", "rgba(245,197,66,0.04)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <View style={s.trophy}>
        <Trophy size={18} color={GOLD} strokeWidth={2.2} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt size={10} font="monoMed" tracking={1.4} uppercase style={{ color: "rgba(245,197,66,0.8)" }}>Prize pool</Txt>
        <Txt size={16} font="sansBold" style={{ color: "#FFE7A3", marginTop: 1 }}>{amount}</Txt>
      </View>
    </Animated.View>
  );
}

function Line({ line }: { line: string }) {
  const { c } = useTheme();
  const t = line.trim();

  if (/^[━─—_\-=]{3,}$/.test(t)) return <View style={s.rule} />;
  // the prize gets its own card above the info rows; here it stays plain text
  if (isPrizePoolLine(t)) return <Inline text={t} color={c.fg} size={14.5} />;

  const header =
    (t.startsWith("*") && t.endsWith("*") && t.length < 70) ||
    (t.toUpperCase() === t && t.length > 4 && t.length < 60 && /[A-Z]/.test(t)) ||
    /^(?:🏆|🏅|📅|🗓️|📍|🔥|🚨|✨|👑)\s*\*[^*]+\*/u.test(t);
  if (header) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9, paddingTop: 10, paddingBottom: 2 }}>
        <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: GOLD }} />
        <View style={{ flex: 1 }}>
          <Inline text={t.replace(/^\*|\*$/g, "")} color="#fff" size={15} bold />
        </View>
      </View>
    );
  }

  const b = t.match(BULLET);
  if (b) {
    return (
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <Txt size={14.5} font="sansBold" style={{ color: GOLD, minWidth: 14 }}>{b[1] === "-" || b[1] === "*" ? "•" : b[1]}</Txt>
        <View style={{ flex: 1 }}>
          <Inline text={b[2]} color={c.fg} size={14.5} />
        </View>
      </View>
    );
  }

  if (/^\*[A-Z\s&]+:\*\s+/.test(t) || /^[A-Z\s&]{3,25}:\s+/.test(t)) {
    return (
      <View style={s.meta}>
        <Inline text={t} color={c.fg} size={14} />
      </View>
    );
  }

  return <Inline text={t} color={c.fg} size={14.5} />;
}

/** Always the whole text — no "see more". `collapsible` is accepted and ignored. */
export function FormattedDescription({ content }: { content?: string | null; collapsible?: boolean }) {

  const blocks = useMemo(() => {
    const n = String(content || "").replace(/\r\n?/g, "\n").trim();
    if (!n) return [] as string[][];
    return n
      .split(/\n{2,}/)
      .map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean))
      .filter((l) => l.length);
  }, [content]);

  if (!blocks.length) return null;

  const render = (list: string[][], base: number) =>
    list.map((lines, i) => {
      if (lines.every((l) => /^[━─—_\-=*#✨🏆💎💰🔥\s]{4,}$/u.test(l))) {
        return (
          <View key={base + i} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 6 }}>
            <View style={[s.rule, { flex: 1, marginVertical: 0 }]} />
            <Txt size={11} style={{ color: "rgba(245,197,66,0.8)", letterSpacing: 4 }}>✦ ✦ ✦</Txt>
            <View style={[s.rule, { flex: 1, marginVertical: 0 }]} />
          </View>
        );
      }
      return (
        <View key={base + i} style={{ gap: 8 }}>
          {lines.map((l, j) => (
            <Line key={j} line={l} />
          ))}
        </View>
      );
    });

  return (
    <View style={{ gap: 16 }}>{render(blocks, 0)}</View>
  );
}

const s = StyleSheet.create({
  prize: {
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(245,197,66,0.3)",
    backgroundColor: "#15130D",
  },
  trophy: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,197,66,0.16)",
    borderWidth: 1,
    borderColor: "rgba(245,197,66,0.4)",
  },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.14)", marginVertical: 6 },
  meta: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
});
