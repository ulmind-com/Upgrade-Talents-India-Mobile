import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  Bell, BellOff, CheckCheck, Undo2, SlidersHorizontal, AlertTriangle, Inbox, ArrowLeft,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { extrasApi, safe, toRows } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAlert } from "@/components/Popup";
import { Txt, Card, Badge, Skeleton, EmptyState, Button, Dot } from "@/components/ui";
import { SignInPrompt } from "@/components/SignInPrompt";
import { FadeInUp } from "@/components/FadeInUp";
import { formatDateTime, titleCase } from "@/lib/format";

type Tab = "all" | "unread";

/** The website's notification panel, as a screen: filter, read state, prefs. */
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
    } finally { setBusy(null); }
  };

  const markAll = async () => {
    setBusy("all");
    try { await extrasApi.markAllRead(); alert("success", "All caught up", "Everything is marked as read."); q.reload(); }
    catch (e: any) { alert("error", "Couldn't update", e?.message || "Please try again."); }
    finally { setBusy(null); }
  };

  const open = (n: any) => {
    if (!n.is_read) toggleRead(n);
    const url: string = n.action_url || "";
    // Map the website's deep links onto the app's own routes.
    const m = url.match(/^\/(events|courses|workshops|competitions|shop)\/([^/?#]+)/);
    if (m) {
      const [, kind, id] = m;
      if (kind === "events") router.push(`/(user)/events/${id}`);
      else if (kind === "competitions") router.push(`/(more)/competitions/${id}`);
      else if (kind === "shop") router.push(`/(more)/shop/${id}`);
      else router.push(`/(more)/learn/${id}?kind=${kind === "workshops" ? "workshop" : "course"}`);
    }
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
          style={{ width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}
        >
          <SlidersHorizontal size={18} color={c.fg} />
        </Pressable>
      }
    >
      {/* filter + mark all */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 }}>
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
        <View style={{ gap: 12 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={84} radius={20} />)}</View>
      ) : !rows.length ? (
        <EmptyState
          icon={<Inbox size={26} color={c.fgMuted} />}
          title={tab === "unread" ? "You're all caught up" : "Nothing here yet"}
          subtitle={tab === "unread" ? "No unread notifications." : "Bookings, results and announcements land here."}
        />
      ) : (
        <View style={{ gap: 12 }}>
          {rows.map((n: any, i: number) => {
            const id = idOf(n);
            const urgent = n.priority === "URGENT" || n.priority === "HIGH";
            return (
              <FadeInUp key={id || i} delay={Math.min(i, 8) * 45}>
                <Pressable onPress={() => open(n)}>
                  <Card style={{ borderColor: n.is_read ? c.border : c.accent + "55", backgroundColor: n.is_read ? c.surface : c.accent + "0d" }}>
                    <View style={{ flexDirection: "row", gap: 11 }}>
                      <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: urgent ? c.danger + "1f" : c.accent + "1a" }}>
                        {urgent ? <AlertTriangle size={18} color={c.danger} /> : <Bell size={18} color={c.accent} />}
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                          <Txt size={14.5} font={n.is_read ? "sansMed" : "sansBold"} tone={n.is_read ? "muted" : "fg"} numberOfLines={2} style={{ flex: 1 }}>
                            {n.title}
                          </Txt>
                          {!n.is_read ? <Dot color={c.accent} /> : null}
                        </View>

                        {n.message ? (
                          <Txt size={12.5} tone="muted" lh={18} numberOfLines={2} style={{ marginTop: 3 }}>{n.message}</Txt>
                        ) : null}

                        {/* wraps, so a long type name never pushes the row off-screen */}
                        <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7, rowGap: 6, marginTop: 8 }}>
                          <Txt size={11} font="monoMed" tone="subtle" tracking={1}>{formatDateTime(n.created_at)}</Txt>
                          {urgent ? <Badge label={n.priority === "URGENT" ? "Urgent" : "Important"} tone="danger" /> : null}
                          {n.notification_type ? (
                            <View style={{ maxWidth: "100%" }}>
                              <Badge label={titleCase(String(n.notification_type).replace(/_/g, " "))} tone="neutral" />
                            </View>
                          ) : null}
                        </View>
                      </View>

                      <Pressable
                        onPress={() => toggleRead(n)}
                        hitSlop={8}
                        style={{ width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, opacity: busy === id ? 0.5 : 1 }}
                      >
                        {n.is_read ? <Undo2 size={14} color={c.fgMuted} /> : <CheckCheck size={14} color={c.accent} />}
                      </Pressable>
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
