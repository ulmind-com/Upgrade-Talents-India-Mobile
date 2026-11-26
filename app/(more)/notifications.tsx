import React, { useMemo, useRef, useState } from "react";
import { View, Pressable, PanResponder, Animated, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import {
  Bell, BellOff, CheckCheck, SlidersHorizontal, Inbox, Trash2,
  Ticket, CreditCard, Trophy, Award, Megaphone, Clock, Coins, GraduationCap, Package, BarChart3, Vote, CheckCircle2,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { extrasApi, safe, toRows } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAlert } from "@/components/Popup";
import { Txt, Card, Skeleton, EmptyState, Button } from "@/components/ui";
import { SignInPrompt } from "@/components/SignInPrompt";
import { routeForNotification } from "@/lib/push";

type Tab = "all" | "unread";

/* ──────────────────────────────────────────────────────────────────────────
   Notifications — a calm inbox. One row per notification: an icon for its
   kind, the title, one line of message, how long ago. Unread rows sit on a
   lifted tint with a dot. Split into Recent (last 24h) and Earlier.

   Same API as the website: list (all / unread), open → mark read and jump to
   the screen it's about, long-press toggles read, swipe left to delete,
   "…" for mark-all-read and preferences.
   ────────────────────────────────────────────────────────────────────────── */

/** The backend's notification types → an icon that says what it's about. */
function TypeIcon({ n, color }: { n: any; color: string }) {
  const t = String(n?.notification_type || n?.type || "").toUpperCase();
  const p = { size: 19, color, strokeWidth: 1.9 };
  if (t.includes("TICKET") || t.includes("REGISTRATION")) return <Ticket {...p} />;
  if (t.includes("PAYMENT")) return <CreditCard {...p} />;
  if (t.includes("VOTING")) return <Vote {...p} />;
  if (t.includes("LEADERBOARD")) return <BarChart3 {...p} />;
  if (t.includes("RESULT")) return <Trophy {...p} />;
  if (t.includes("CERTIFICATE")) return <Award {...p} />;
  if (t.includes("COIN") || t.includes("REWARD")) return <Coins {...p} />;
  if (t.includes("COURSE") || t.includes("WORKSHOP")) return <GraduationCap {...p} />;
  if (t.includes("ORDER")) return <Package {...p} />;
  if (t.includes("ANNOUNCEMENT")) return <Megaphone {...p} />;
  if (t.includes("REMINDER")) return <Clock {...p} />;
  if (t.includes("CONFIRM")) return <CheckCircle2 {...p} />;
  return <Bell {...p} />;
}

/** "23m ago", "1h ago", "3d ago", then a date. */
function ago(iso?: string) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function Notifications() {
  const { c } = useTheme();
  const router = useRouter();
  const { user } = useSession();
  const alert = useAlert();
  const [tab, setTab] = useState<Tab>("all");
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const q = useAsync(
    () => (user ? safe(extrasApi.notificationList(tab === "unread" ? { is_read: false } : {}), null as any) : Promise.resolve(null)),
    [user?.email, tab],
    { refetchOnFocus: true }
  );

  const rows = toRows(q.data);
  const unreadCount = Number(q.data?.unread_count ?? rows.filter((n: any) => !n.is_read).length);
  const idOf = (n: any) => String(n.id ?? n._id ?? "");

  const [openedAt] = useState(() => Date.now());
  const sections = useMemo(() => {
    const dayAgo = openedAt - 86400 * 1000;
    const recent: any[] = [];
    const earlier: any[] = [];
    rows.forEach((n: any) => (new Date(n.created_at).getTime() >= dayAgo ? recent : earlier).push(n));
    return [
      { title: "Recent", items: recent },
      { title: "Earlier", items: earlier },
    ].filter((x) => x.items.length);
  }, [rows, openedAt]);

  const toggleRead = async (n: any) => {
    const id = idOf(n);
    if (!id) return;
    setBusy(id);
    Haptics.selectionAsync().catch(() => {});
    try {
      if (n.is_read) await extrasApi.markUnread(id);
      else await extrasApi.markRead(id);
      q.reload();
    } catch (e: any) {
      alert("error", "Couldn't update", e?.message || "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (n: any) => {
    const id = idOf(n);
    if (!id) return;
    setBusy(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      await extrasApi.deleteNotification(id);
      q.reload();
    } catch (e: any) {
      alert("error", "Couldn't delete", e?.message || "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const markAll = async () => {
    setBusy("all");
    try {
      await extrasApi.markAllRead();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      q.reload();
    } catch (e: any) {
      alert("error", "Couldn't update", e?.message || "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const open = (n: any) => {
    if (!n.is_read) extrasApi.markRead(idOf(n)).then(() => q.reload()).catch(() => {});
    const to = routeForNotification(n);
    // an inbox item with nowhere to go just gets marked read
    if (to && to !== "/(more)/notifications") router.push(to as any);
  };

  if (!user) {
    return (
      <SubScreen eyebrow="Inbox" title="Notifications">
        <SignInPrompt message="Sign in to see your notifications." />
      </SubScreen>
    );
  }

  if (prefsOpen) return <Prefs onBack={() => setPrefsOpen(false)} />;

  return (
    <SubScreen
      eyebrow="Inbox"
      title="Notifications"
      refreshing={q.refreshing}
      onRefresh={q.refresh}
      right={
        <Pressable
          onPress={() => setPrefsOpen(true)}
          accessibilityLabel="Notification settings"
          style={{ width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}
        >
          <SlidersHorizontal size={18} color={c.fg} />
        </Pressable>
      }
    >
      {/* filter + mark all */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
        {(["all", "unread"] as const).map((t) => {
          const on = tab === t;
          return (
            <Pressable
              key={t}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setTab(t); }}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accent : c.surface }}
            >
              <Txt size={12.5} font="sansBold" style={{ color: on ? c.onAccent : c.fgMuted }}>{t === "all" ? "All" : "Unread"}</Txt>
              {t === "unread" && unreadCount ? (
                <View style={{ minWidth: 18, height: 18, borderRadius: 999, paddingHorizontal: 5, alignItems: "center", justifyContent: "center", backgroundColor: on ? "rgba(255,255,255,0.28)" : c.accent }}>
                  <Txt size={10} font="sansBold" style={{ color: "#fff" }}>{unreadCount}</Txt>
                </View>
              ) : null}
            </Pressable>
          );
        })}
        <View style={{ flex: 1 }} />
        {unreadCount ? (
          <Button label="Mark all" size="sm" variant="ghost" loading={busy === "all"} onPress={markAll} icon={<CheckCheck size={14} color={c.accent} />} />
        ) : null}
      </View>

      {q.loading ? (
        <View style={{ paddingTop: 8, gap: 14 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
              <Skeleton h={46} w={46} radius={999} />
              <View style={{ flex: 1, gap: 6 }}><Skeleton h={14} w="60%" /><Skeleton h={12} w="85%" /></View>
            </View>
          ))}
        </View>
      ) : !rows.length ? (
        <EmptyState
          icon={<Inbox size={26} color={c.fgMuted} />}
          title={tab === "unread" ? "You're all caught up" : "Nothing here yet"}
          subtitle={tab === "unread" ? "No unread notifications." : "Bookings, results and announcements land here."}
        />
      ) : (
        // rows sit as rounded tiles, a touch wider than the page padding
        <View style={{ marginHorizontal: -8 }}>
          {sections.map((sec, si) => (
            <View key={sec.title} style={{ marginTop: si ? 12 : 8 }}>
              <Txt size={15} font="sansBold" style={{ color: "#fff", paddingHorizontal: 8, marginTop: si ? 12 : 0, marginBottom: 8 }}>{sec.title}</Txt>
              {sec.items.map((n: any) => (
                <Row
                  key={idOf(n)}
                  n={n}
                  busy={busy === idOf(n)}
                  onOpen={() => open(n)}
                  onToggleRead={() => toggleRead(n)}
                  onDelete={() => remove(n)}
                />
              ))}
            </View>
          ))}
        </View>
      )}
    </SubScreen>
  );
}

/** One notification. Tap opens, long-press toggles read, swipe left to delete. */
function Row({ n, busy, onOpen, onToggleRead, onDelete }: { n: any; busy: boolean; onOpen: () => void; onToggleRead: () => void; onDelete: () => void }) {
  const { c } = useTheme();
  const [x] = useState(() => new Animated.Value(0));
  const opened = useRef(false);
  const unread = !n.is_read;
  const urgent = /URGENT|HIGH/i.test(String(n.priority || ""));

  const glide = (to: number, done?: () => void) =>
    Animated.timing(x, { toValue: to, duration: 220, useNativeDriver: true }).start(() => {
      opened.current = to < 0;
      done?.();
    });

  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => x.setValue(Math.min(0, Math.max(-220, (opened.current ? -88 : 0) + g.dx))),
      onPanResponderRelease: (_, g) => {
        const at = (opened.current ? -88 : 0) + g.dx;
        if (at < -170) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
          Animated.timing(x, { toValue: -420, duration: 200, useNativeDriver: true }).start(onDelete);
        } else if (at < -44) glide(-88);
        else glide(0);
      },
      onPanResponderTerminate: () => glide(opened.current ? -88 : 0),
    })
  );

  return (
    <View style={{ borderRadius: 18, overflow: "hidden", marginBottom: 6 }}>
      {/* delete, revealed on swipe — sits under the tile's rounded edge */}
      <Pressable
        onPress={() => glide(0, onDelete)}
        accessibilityLabel="Delete notification"
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, left: 0, borderRadius: 18, alignItems: "flex-end", justifyContent: "center", paddingRight: 26, backgroundColor: "#E5484D" }}
      >
        <View style={{ alignItems: "center", gap: 3 }}>
          <Trash2 size={18} color="#fff" />
          <Txt size={11} font="sansBold" style={{ color: "#fff" }}>Delete</Txt>
        </View>
      </Pressable>

      <Animated.View {...pan.panHandlers} style={{ transform: [{ translateX: x }], borderRadius: 18, overflow: "hidden", backgroundColor: unread ? "#15161D" : "#0E0F15" }}>
        <Pressable
          onPress={() => (opened.current ? glide(0) : onOpen())}
          onLongPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onToggleRead(); }}
          delayLongPress={350}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 14,
            paddingHorizontal: 14,
            paddingVertical: 13,
            backgroundColor: pressed ? "rgba(255,255,255,0.05)" : "transparent",
            opacity: busy ? 0.5 : 1,
          })}
        >
          <View style={{ width: 46, height: 46 }}>
            <View style={{ flex: 1, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: urgent ? c.accent + "22" : "rgba(255,255,255,0.07)" }}>
              <TypeIcon n={n} color={urgent ? c.accent : "#fff"} />
            </View>
            {unread ? <View style={{ position: "absolute", top: 1, right: 1, width: 10, height: 10, borderRadius: 999, backgroundColor: c.accent, borderWidth: 2, borderColor: "#15161D" }} /> : null}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Txt size={15} font={unread ? "sansBold" : "sansSemi"} lh={20} style={{ color: unread ? "#fff" : "rgba(255,255,255,0.85)" }}>{n.title || "Notification"}</Txt>
            {n.message ? (
              <Txt size={13} lh={19} style={{ marginTop: 3, color: "rgba(255,255,255,0.55)" }}>{n.message}</Txt>
            ) : null}
          </View>
          <Txt size={12} style={{ color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{ago(n.created_at)}</Txt>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  round: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
});

const PREF_ROWS: { key: string; label: string; hint?: string }[] = [
  { key: "in_app_enabled", label: "In-app notifications" },
  { key: "push_enabled", label: "Push notifications", hint: "Alerts on your device." },
  { key: "email_enabled", label: "Email" },
  { key: "sound_enabled", label: "Sound" },
  { key: "event_reminders", label: "Event reminders" },
  { key: "voting_reminders", label: "Voting reminders" },
  { key: "leaderboard_updates", label: "Leaderboard updates" },
  { key: "competition_results", label: "Competition results" },
];

function Prefs({ onBack }: { onBack: () => void }) {
  const { c } = useTheme();
  const alert = useAlert();
  const [draft, setDraft] = useState<Record<string, boolean> | null>(null);
  const [busy, setBusy] = useState(false);

  const q = useAsync(() => safe(extrasApi.notificationPrefs(), null as any), []);
  const prefs = draft ?? q.data ?? {};

  const set = (k: string, v: boolean) => setDraft({ ...(draft ?? q.data ?? {}), [k]: v });

  const save = async () => {
    if (!draft) return onBack();
    setBusy(true);
    try { await extrasApi.updateNotificationPrefs(draft); alert("success", "Saved", "Notification settings updated."); onBack(); }
    catch (e: any) { alert("error", "Couldn't save", e?.message || "Please try again."); }
    finally { setBusy(false); }
  };

  return (
    <SubScreen eyebrow="Notifications" title="Preferences" onBack={onBack}>
      {q.loading ? (
        <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={62} radius={18} />)}</View>
      ) : (
        <>
          <Card padding={0}>
            {PREF_ROWS.map((r, i) => (
              <Pressable
                key={r.key}
                onPress={() => { Haptics.selectionAsync().catch(() => {}); set(r.key, !prefs[r.key]); }}
                style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 15, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}
              >
                <View style={{ flex: 1 }}>
                  <Txt size={14} font="sansSemi">{r.label}</Txt>
                  {r.hint ? <Txt size={11.5} tone="subtle" style={{ marginTop: 2 }}>{r.hint}</Txt> : null}
                </View>
                <View style={{ width: 46, height: 27, borderRadius: 999, padding: 3, backgroundColor: prefs[r.key] ? c.accent : c.surface2, justifyContent: "center" }}>
                  <View style={{ width: 21, height: 21, borderRadius: 999, backgroundColor: "#fff", alignSelf: prefs[r.key] ? "flex-end" : "flex-start" }} />
                </View>
              </Pressable>
            ))}
          </Card>

          <View style={{ marginTop: 18 }}>
            <Button label="Save preferences" full size="lg" loading={busy} onPress={save} icon={<BellOff size={17} color={c.onAccent} />} />
          </View>
        </>
      )}
    </SubScreen>
  );
}
