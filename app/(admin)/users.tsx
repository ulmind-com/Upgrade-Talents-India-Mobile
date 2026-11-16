import React, { useMemo, useState } from "react";
import { View, Pressable, TextInput } from "react-native";
import { Search, Users as UsersIcon, Trash2, RotateCcw, ShieldCheck, Trophy, Award, Ticket, GraduationCap, X } from "lucide-react-native";
import { AdminShell } from "@/components/admin/Shell";
import { useAdmin, AAction, ACard, AEmpty, AGrid, AKeyValues, ALoading, APanel, AStatTile, ATabs, ATag, T } from "@/components/admin/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { usersApi, safe, toRows, totalOf } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAlert } from "@/components/Popup";
import { formatEventDate } from "@/lib/format";

type Tab = "all" | "bin";

export default function AdminUsers() {
  const { c } = useTheme();
  const alert = useAlert();
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<any | null>(null);

  const list = useAsync(() => safe(usersApi.list({ limit: 200 }), [] as any), [tab === "all"]);
  const bin = useAsync(() => safe(usersApi.recycleBin({ limit: 200 }), [] as any), [tab === "bin"]);

  const active = tab === "all" ? list : bin;
  const rows = toRows(active.data);
  const total = totalOf(active.data, rows);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r: any) => [r.name, r.email, r.phone_number].some((v) => String(v || "").toLowerCase().includes(s)));
  }, [rows, q]);

  const verified = rows.filter((r: any) => r.is_verified).length;

  const run = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key);
    try { await fn(); alert("success", "Done", ok); list.reload(); bin.reload(); }
    catch (e: any) { alert("error", "Action failed", e?.message || "Please try again."); }
    finally { setBusy(null); }
  };

  return (
    <AdminShell
      title="Users"
      refreshing={active.refreshing}
      onRefresh={active.refresh}
    >
      <ATabs
        value={tab}
        onChange={setTab}
        tabs={[{ key: "all", label: "All users" }, { key: "bin", label: "Recycle bin" }]}
      />

      {tab === "all" ? (
        <AGrid>
          <AStatTile label="Registered" value={total || rows.length} Icon={UsersIcon} />
          <AStatTile label="Verified" value={verified} Icon={ShieldCheck} tone={c.success} />
        </AGrid>
      ) : (
        <T size={13} mut lh={19} style={{ marginBottom: 14 }}>
          Deleted accounts wait here. Restoring brings everything back; deleting forever cannot be undone.
        </T>
      )}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.bgElevated, borderRadius: 14, borderWidth: 1, borderColor: c.borderStrong, paddingHorizontal: 14, height: 46, marginBottom: 16 }}>
        <Search size={17} color={c.fgSubtle} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search name, email or phone" placeholderTextColor={c.fgSubtle} style={{ flex: 1, color: c.fg, fontSize: 14.5 }} />
      </View>

      {active.loading ? (
        <ALoading />
      ) : !filtered.length ? (
        <AEmpty icon={<UsersIcon size={26} color={c.fgMuted} />} title={tab === "bin" ? "Recycle bin is empty" : "No users found"} subtitle={q ? "Try a different search." : undefined} />
      ) : (
        <View style={{ gap: 12 }}>
          {filtered.map((u: any, i: number) => {
            const id = u._id || u.id || u.email;
            return (
              <ACard key={id || i}>
                <Pressable onPress={() => tab === "all" && setOpen(u)}>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <T size={15} font="bold" numberOfLines={1}>{u.name || u.email}</T>
                      <T size={12.5} mut numberOfLines={1} style={{ marginTop: 2 }}>{u.email}</T>
                    </View>
                    <ATag label={u.is_verified ? "Verified" : "Unverified"} tone={u.is_verified ? "success" : "warning"} />
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 10 }}>
                    <Meta label="Phone" value={u.phone_number || "—"} />
                    <Meta label={tab === "bin" ? "Deleted" : "Joined"} value={formatEventDate(tab === "bin" ? u.deleted_at : u.created_at)} />
                  </View>
                </Pressable>

                {tab === "all" ? (
                  <>
                    <AAction
                      label={u.is_verified ? "Revoke verified status" : "Verify user (Grant blue tick)"}
                      hint={u.is_verified ? "Removes the official verified badge from this profile." : "Gives this contestant the official blue tick badge."}
                      cta={u.is_verified ? "Unverify" : "Verify"}
                      tone={u.is_verified ? "danger" : "success"}
                      Icon={ShieldCheck}
                      busy={busy === `ver${id}`}
                      onPress={() =>
                        run(
                          `ver${id}`,
                          () => (u.is_verified ? usersApi.unverify(u.email || id) : usersApi.verify(u.email || id)),
                          u.is_verified ? `${u.name || u.email} is now unverified.` : `${u.name || u.email} verified with blue tick!`
                        )
                      }
                    />
                    <AAction
                      label="Delete account"
                      hint="Moves the user to the recycle bin."
                      cta="Delete"
                      tone="danger"
                      Icon={Trash2}
                      busy={busy === `del${id}`}
                      onPress={() => run(`del${id}`, () => usersApi.remove(u.email), `${u.name || u.email} moved to the recycle bin.`)}
                    />
                  </>
                ) : (
                  <>
                    <AAction
                      label="Restore"
                      hint="Bring this account back with its history."
                      cta="Restore"
                      tone="success"
                      Icon={RotateCcw}
                      busy={busy === `res${id}`}
                      onPress={() => run(`res${id}`, () => usersApi.restore(id), "Account restored.")}
                    />
                    <AAction
                      label="Delete forever"
                      hint="Permanent. This cannot be undone."
                      cta="Erase"
                      tone="danger"
                      Icon={Trash2}
                      busy={busy === `fd${id}`}
                      onPress={() => run(`fd${id}`, () => usersApi.forceDelete(id), "Account permanently deleted.")}
                    />
                  </>
                )}
              </ACard>
            );
          })}
        </View>
      )}
      {open ? <UserSheet user={open} onClose={() => setOpen(null)} /> : null}
    </AdminShell>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <T size={10} font="monoMed" sub track={1.5} upper>{label}</T>
      <T size={13} font="semi" style={{ marginTop: 1 }}>{value}</T>
    </View>
  );
}

/** Full profile the web shows in a side drawer — here it slides over the list. */
function UserSheet({ user, onClose }: { user: any; onClose: () => void }) {
  const c = useAdmin();
  const id = user._id || user.id || user.email;

  const summary = useAsync(() => safe(usersApi.profileSummary(id), null as any), [id]);
  const activity = useAsync(() => safe(usersApi.activitySummary(id), null as any), [id]);
  const achievements = useAsync(() => safe(usersApi.achievements(id), null as any), [id]);

  const s = summary.data || {};
  const act = activity.data || {};
  const ach = achievements.data || {};
  const num = (...keys: string[]) => {
    for (const k of keys) {
      const v = s[k] ?? act[k] ?? ach[k];
      if (typeof v === "number") return v;
      if (Array.isArray(v)) return v.length;
    }
    return 0;
  };

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.bg }}>
      <View style={{ flex: 1, paddingTop: 54, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <T size={11} font="monoMed" color={c.brand} track={3} upper>Profile</T>
            <T size={24} font="bold" track={-1} numberOfLines={1} style={{ marginTop: 4 }}>{user.name || user.email}</T>
          </View>
          <Pressable onPress={onClose} style={{ width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
            <X size={19} color={c.fg} />
          </Pressable>
        </View>

        {summary.loading ? (
          <ALoading rows={2} />
        ) : (
          <>
            <AGrid>
              <AStatTile label="Events" value={num("events_count", "total_events", "events")} Icon={Ticket} />
              <AStatTile label="Competitions" value={num("competitions_count", "total_competitions", "competitions")} Icon={Trophy} />
              <AStatTile label="Courses" value={num("courses_count", "total_courses", "courses")} Icon={GraduationCap} />
              <AStatTile label="Badges" value={num("badges_count", "total_badges", "badges")} Icon={Award} tone={c.success} />
            </AGrid>

            <APanel title="Account">
              <AKeyValues
                items={[
                  { k: "Email", v: user.email || "—" },
                  { k: "Phone", v: user.phone_number || "—" },
                  { k: "Verified", v: user.is_verified ? "Yes" : "No" },
                  { k: "Joined", v: formatEventDate(user.created_at) },
                  { k: "Reward points", v: String(s.reward_points ?? s.points ?? 0) },
                  { k: "Referrals", v: String(s.referral_count ?? s.referrals ?? 0) },
                ]}
              />
            </APanel>
          </>
        )}
      </View>
    </View>
  );
}
