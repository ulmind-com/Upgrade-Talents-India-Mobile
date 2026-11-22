import React, { useState } from "react";
import { View, Pressable, Alert as RNAlert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { CalendarDays, Trophy, Trash2 } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt, Card, Badge, Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { profileApi, registrationsApi, safe } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAlert } from "@/components/Popup";
import { genz } from "@/theme/tokens";
import { formatEventDate } from "@/lib/format";

type Tab = "events" | "competitions";

/** The activity to open (never the registration's own id). */
const pickNavId = (x: any) => x?.activity_id || x?.competition_id || x?.event_id || x?.id || x?._id || "";
/** The registration document id — what cancellation needs. */
const pickRegId = (x: any) => x?.registration_id || x?._id || x?.id || "";
const pickTitle = (x: any) => x?.title || x?.activity_title || x?.name || x?.event_title || "Untitled";
const pickDate = (x: any) => x?.date || x?.event_date || x?.start_time || x?.start_date;
const pickCat = (x: any) => x?.category || x?.category_name || x?.type;
const pickStatus = (x: any) => String(x?.status || x?.event_status || x?.registration_status || "");

/** The payload carries "both flat list and category-wise grouping" — read either. */
function parse(data: any): { flat: any[]; groups: Record<string, any[]> | null } {
  if (!data) return { flat: [], groups: null };
  const flat = data.flat || data.events || data.competitions || data.items || data.registered || (Array.isArray(data) ? data : []);
  const g = data.by_category || data.categories || data.grouped || data.category_wise || data.categorized || null;
  const groups = g && typeof g === "object" && !Array.isArray(g) ? (g as Record<string, any[]>) : null;
  return { flat: Array.isArray(flat) ? flat : [], groups };
}

function statusTone(s: string): "success" | "warning" | "danger" | "neutral" | "brand" {
  const v = s.toLowerCase();
  if (/win|champ|1st|gold/.test(v)) return "brand";
  if (/live|confirm|register|approve|book|active|paid/.test(v)) return "success";
  if (/pend|await|process|hold/.test(v)) return "warning";
  if (/cancel|reject|fail|expire/.test(v)) return "danger";
  return "neutral";
}

function ActivityCard({ item, tab, idx, onPress, onCancel, canceling }: { item: any; tab: Tab; idx: number; onPress: () => void; onCancel?: () => void; canceling?: boolean }) {
  const { c } = useTheme();
  const [g1, g2] = genz(idx);
  const Icon = tab === "events" ? CalendarDays : Trophy;
  const status = pickStatus(item);
  const cancelled = /cancel/i.test(status);
  const cat = pickCat(item);
  const date = pickDate(item);
  return (
    <Card onPress={onPress} padding={12} style={cancelled ? { opacity: 0.55 } : undefined}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <LinearGradient colors={[g1, g2] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" }}>
          <Icon size={20} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Txt size={14.5} font="sansBold" numberOfLines={1}>{pickTitle(item)}</Txt>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginTop: 3 }}>
            {date ? <Txt size={12} tone="subtle">{formatEventDate(date)}</Txt> : null}
            {date && cat ? <View style={{ width: 3, height: 3, borderRadius: 3, backgroundColor: c.fgSubtle }} /> : null}
            {cat ? <Txt size={12} tone="subtle" numberOfLines={1}>{cat}</Txt> : null}
          </View>
        </View>
        {status ? <Badge label={status} tone={statusTone(status)} /> : null}
        {onCancel && !cancelled ? (
          <Pressable
            onPress={onCancel}
            disabled={canceling}
            hitSlop={8}
            style={{ width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, opacity: canceling ? 0.5 : 1 }}
          >
            <Trash2 size={15} color={c.danger} />
          </Pressable>
        ) : null}
      </View>
    </Card>
  );
}

export default function MyActivity() {
  const { c } = useTheme();
  const router = useRouter();
  const alert = useAlert();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === "competitions" ? "competitions" : "events");
  const [canceling, setCanceling] = useState<string | null>(null);

  const ev = useAsync(() => safe(profileApi.myEvents(), null), []);
  const cm = useAsync(() => safe(profileApi.myCompetitions(), null), []);
  const active = tab === "events" ? ev : cm;
  const { flat, groups } = parse(active.data);

  const open = (item: any) => {
    const id = pickNavId(item);
    if (!id) return;
    Haptics.selectionAsync().catch(() => {});
    router.push((tab === "events" ? `/(user)/events/${id}` : `/(more)/competitions/${id}`) as any);
  };

  const cancel = (item: any) => {
    const rid = pickRegId(item);
    if (!rid) { alert("info", "Can't cancel", "This registration can't be cancelled from here."); return; }
    RNAlert.alert(
      "Cancel registration?",
      `${pickTitle(item)} will be removed from your ${tab === "events" ? "events" : "competitions"}. This can't be undone.`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Cancel registration",
          style: "destructive",
          onPress: async () => {
            setCanceling(rid);
            try {
              await registrationsApi.remove(rid);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              alert("success", "Registration cancelled", `${pickTitle(item)} was removed.`);
              active.refresh();
            } catch (e: any) {
              alert("error", "Couldn't cancel", e?.message || "Try again in a moment.");
            } finally {
              setCanceling(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SubScreen eyebrow="Your journey" title="My activity">
      <View style={{ gap: 16 }}>
        {/* segmented control */}
        <View style={{ flexDirection: "row", backgroundColor: c.surface, borderRadius: 999, borderWidth: 1, borderColor: c.border, padding: 4 }}>
          {(["events", "competitions"] as Tab[]).map((t) => {
            const on = t === tab;
            const label = t === "events" ? "Events" : "Competitions";
            const Icon = t === "events" ? CalendarDays : Trophy;
            return (
              <Pressable key={t} onPress={() => { Haptics.selectionAsync().catch(() => {}); setTab(t); }} style={{ flex: 1 }}>
                {on ? (
                  <LinearGradient colors={c.gradBrand as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", height: 40, borderRadius: 999 }}>
                    <Icon size={15} color={c.onAccent} />
                    <Txt size={13} font="sansBold" style={{ color: c.onAccent }}>{label}</Txt>
                  </LinearGradient>
                ) : (
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", height: 40 }}>
                    <Icon size={15} color={c.fgMuted} />
                    <Txt size={13} font="sansSemi" tone="muted">{label}</Txt>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {active.loading ? (
          <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={70} radius={18} />)}</View>
        ) : active.error ? (
          <ErrorState message={active.error} onRetry={active.refresh} />
        ) : !flat.length ? (
          <EmptyState
            icon={tab === "events" ? <CalendarDays size={26} color={c.fgMuted} /> : <Trophy size={26} color={c.fgMuted} />}
            title={tab === "events" ? "No events yet" : "No competitions yet"}
            subtitle={tab === "events" ? "Book or register for an event and it shows up here." : "Enter a competition to track it here."}
          />
        ) : groups ? (
          Object.entries(groups).map(([cat, list]) =>
            Array.isArray(list) && list.length ? (
              <View key={cat} style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Txt size={13} font="sansBold">{cat}</Txt>
                  <Badge label={`${list.length}`} tone="neutral" />
                </View>
                <View style={{ gap: 10 }}>
                  {list.map((it, i) => <ActivityCard key={pickRegId(it) || i} item={it} tab={tab} idx={i} onPress={() => open(it)} onCancel={() => cancel(it)} canceling={canceling === pickRegId(it)} />)}
                </View>
              </View>
            ) : null
          )
        ) : (
          <View style={{ gap: 10 }}>
            {flat.map((it, i) => <ActivityCard key={pickRegId(it) || i} item={it} tab={tab} idx={i} onPress={() => open(it)} onCancel={() => cancel(it)} canceling={canceling === pickRegId(it)} />)}
          </View>
        )}
      </View>
    </SubScreen>
  );
}
