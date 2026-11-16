import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Crown, Ban, Ticket, CheckCircle2, Users as Plus, ScanLine } from "lucide-react-native";
import { AdminShell } from "@/components/admin/Shell";
import { AAction, AButton, ACard, AEmpty, AField, AGauge, AGrid, AInput, ALoading, APanel, ARecord, AScope, AStatTile, ATabs, ATag, T } from "@/components/admin/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { vipApi, cmsApi, safe, toRows } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAlert } from "@/components/Popup";
import { formatEventDate, titleCase } from "@/lib/format";

type Tab = "passes" | "bookings" | "checkins" | "insights";

export default function AdminVip() {
  const { c } = useTheme();
  const alert = useAlert();
  const [tab, setTab] = useState<Tab>("passes");
  const [eventId, setEventId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", tier: "" });

  const events = useAsync(() => safe(cmsApi.listEvents({ limit: 100 }), [] as any), []);
  const eventRows = toRows(events.data);

  // Everything on this page is scoped to one event, so default to the first.
  useEffect(() => {
    if (!eventId && eventRows.length) setEventId(eventRows[0]._id || eventRows[0].id);
  }, [eventRows.length]);

  const scoped = <T,>(fn: (id: string) => Promise<T>, fallback: T) =>
    eventId ? safe(fn(eventId), fallback) : Promise.resolve(fallback);

  const passes = useAsync(() => scoped((id) => vipApi.listPasses(id, { limit: 200 }), [] as any), [eventId]);
  const bookings = useAsync(() => scoped((id) => vipApi.listBookings(id, { limit: 200 }), [] as any), [eventId]);
  const checkins = useAsync(() => scoped((id) => vipApi.checkins(id, { limit: 200 }), [] as any), [eventId]);
  const capacity = useAsync(() => scoped((id) => vipApi.capacity(id), null as any), [eventId]);
  const analytics = useAsync(() => scoped((id) => vipApi.analytics(id), null as any), [eventId]);

  const passRows = toRows(passes.data);
  const bookingRows = toRows(bookings.data);
  const checkinRows = toRows(checkins.data);
  const cap = capacity.data || {};
  const an = analytics.data || {};

  const capTotal = Number(cap.total_capacity ?? cap.capacity ?? 0);
  const capUsed = Number(cap.issued ?? cap.used ?? passRows.length);
  const pct = capTotal ? (capUsed / capTotal) * 100 : 0;

  const run = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key);
    try {
      await fn();
      alert("success", "Done", ok);
      passes.reload(); bookings.reload(); capacity.reload(); analytics.reload();
    } catch (e: any) { alert("error", "Action failed", e?.message || "Please try again."); }
    finally { setBusy(null); }
  };

  const issue = async () => {
    if (!eventId) return;
    if (!form.email.trim()) return alert("warning", "Email needed", "Enter the guest's email address.");
    setBusy("issue");
    try {
      await vipApi.issuePass(eventId, {
        user_email: form.email.trim(),
        guest_name: form.name.trim() || undefined,
        tier: form.tier.trim() || undefined,
      });
      alert("success", "Pass issued", `${form.email.trim()} now has a VIP pass.`);
      setForm({ email: "", name: "", tier: "" });
      setIssuing(false);
      passes.reload(); capacity.reload();
    } catch (e: any) { alert("error", "Couldn't issue", e?.message || "Please try again."); }
    finally { setBusy(null); }
  };

  const active = tab === "passes" ? passes : tab === "bookings" ? bookings : tab === "checkins" ? checkins : analytics;

  return (
    <AdminShell
      title="VIP Passes"
      refreshing={active.refreshing}
      onRefresh={active.refresh}
      action={tab === "passes" && eventId ? <AButton label="Issue" size="sm" icon={<Plus size={15} color={"#fff"} />} onPress={() => setIssuing((v) => !v)} /> : undefined}
    >
      <AScope
        items={eventRows.map((e: any) => ({ id: e._id || e.id, label: e.title || "Event" }))}
        value={eventId}
        onChange={setEventId}
        placeholder="Pick an event"
      />

      {!eventId ? (
        <AEmpty icon={<Crown size={26} color={c.fgMuted} />} title="Choose an event" subtitle="VIP passes are managed per event." />
      ) : (
        <>
          <ATabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "passes", label: "Passes" },
              { key: "bookings", label: "Bookings" },
              { key: "checkins", label: "Check-ins" },
              { key: "insights", label: "Insights" },
            ]}
          />

          {issuing && tab === "passes" ? (
            <APanel title="Issue a pass" subtitle="The guest gets their pass and QR straight away.">
              <AField label="Guest email" required>
                <AInput value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} placeholder="guest@example.com" autoCapitalize="none" keyboardType="email-address" />
              </AField>
              <AField label="Guest name">
                <AInput value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} placeholder="Optional" />
              </AField>
              <AField label="Tier">
                <AInput value={form.tier} onChangeText={(v) => setForm((f) => ({ ...f, tier: v }))} placeholder="Optional — e.g. Gold" />
              </AField>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                <View style={{ flex: 1 }}><AButton label="Issue pass" full loading={busy === "issue"} onPress={issue} /></View>
                <AButton label="Cancel" variant="secondary" onPress={() => setIssuing(false)} />
              </View>
            </APanel>
          ) : null}

          {tab === "insights" ? (
            analytics.loading ? <ALoading rows={2} /> : (
              <>
                <AGrid>
                  <AStatTile label="Passes issued" value={Number(an.total_passes ?? capUsed)} Icon={Crown} />
                  <AStatTile label="Checked in" value={Number(an.checked_in ?? checkinRows.length)} Icon={CheckCircle2} tone={c.success} />
                  <AStatTile label="Bookings" value={Number(an.total_bookings ?? bookingRows.length)} Icon={Ticket} />
                  <AStatTile label="Revoked" value={Number(an.revoked ?? passRows.filter((p: any) => p.is_revoked || p.status === "REVOKED").length)} Icon={Ban} tone={c.danger} />
                </AGrid>
                {capTotal ? (
                  <APanel title="Capacity">
                    <AGauge percent={pct} caption={`${capUsed} of ${capTotal} VIP places taken`} />
                  </APanel>
                ) : null}
              </>
            )
          ) : tab === "bookings" ? (
            bookings.loading ? <ALoading /> : !bookingRows.length ? (
              <AEmpty icon={<Ticket size={26} color={c.fgMuted} />} title="No VIP bookings" />
            ) : (
              <View style={{ gap: 12 }}>
                {bookingRows.map((b: any, i: number) => {
                  const id = b._id || b.id;
                  const cancelled = b.status === "CANCELLED" || b.is_cancelled;
                  return (
                    <ACard key={id || i}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <T size={14.5} font="bold" numberOfLines={1}>{b.guest_name || b.user_name || b.user_email || "Guest"}</T>
                          <T size={12.5} mut numberOfLines={1} style={{ marginTop: 2 }}>{b.user_email || b.booking_ref || ""}</T>
                        </View>
                        <ATag label={titleCase(b.status) || "Booked"} tone={cancelled ? "danger" : "success"} />
                      </View>
                      {!cancelled && id ? (
                        <AAction
                          label="Cancel booking"
                          cta="Cancel"
                          tone="danger"
                          Icon={Ban}
                          busy={busy === id}
                          onPress={() => run(id, () => vipApi.cancelBooking(id), "Booking cancelled.")}
                        />
                      ) : null}
                    </ACard>
                  );
                })}
              </View>
            )
          ) : tab === "checkins" ? (
            checkins.loading ? <ALoading /> : !checkinRows.length ? (
              <AEmpty icon={<ScanLine size={26} color={c.fgMuted} />} title="Nobody checked in yet" subtitle="Scans appear here as guests arrive." />
            ) : (
              <View style={{ gap: 12 }}>
                {checkinRows.map((r: any, i: number) => (
                  <ARecord
                    key={r._id || i}
                    title={r.guest_name || r.user_name || r.pass_ref || "Guest"}
                    subtitle={r.user_email}
                    meta={[{ label: "Scanned", value: formatEventDate(r.checked_in_at || r.created_at) }]}
                    right={<ATag label="In" tone="success" />}
                  />
                ))}
              </View>
            )
          ) : (
            passes.loading ? <ALoading /> : !passRows.length ? (
              <AEmpty icon={<Crown size={26} color={c.fgMuted} />} title="No passes issued" subtitle="Use Issue to create the first one." />
            ) : (
              <View style={{ gap: 12 }}>
                {passRows.map((p: any, i: number) => {
                  const id = p._id || p.id;
                  const isRevoked = p.is_revoked || p.status === "REVOKED";
                  return (
                    <ACard key={id || i}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                        <View style={{ flex: 1 }}>
                          <T size={14.5} font="bold" numberOfLines={1}>{p.guest_name || p.user_name || p.user_email || "Guest"}</T>
                          <T size={12.5} mut numberOfLines={1} style={{ marginTop: 2 }}>{p.pass_ref || p.user_email || ""}</T>
                        </View>
                        <ATag label={isRevoked ? "Revoked" : p.tier ? titleCase(p.tier) : "Active"} tone={isRevoked ? "danger" : "brand"} />
                      </View>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 10 }}>
                        <View>
                          <T size={10} font="monoMed" sub track={1.5} upper>Issued</T>
                          <T size={13} font="semi" style={{ marginTop: 1 }}>{formatEventDate(p.issued_at || p.created_at)}</T>
                        </View>
                        <View>
                          <T size={10} font="monoMed" sub track={1.5} upper>Checked in</T>
                          <T size={13} font="semi" style={{ marginTop: 1 }}>{p.is_checked_in ? "Yes" : "No"}</T>
                        </View>
                      </View>
                      {!isRevoked && id ? (
                        <AAction
                          label="Revoke pass"
                          hint="The QR stops working immediately."
                          cta="Revoke"
                          tone="danger"
                          Icon={Ban}
                          busy={busy === id}
                          onPress={() => run(id, () => vipApi.revokePass(id), "Pass revoked.")}
                        />
                      ) : null}
                    </ACard>
                  );
                })}
              </View>
            )
          )}
        </>
      )}
    </AdminShell>
  );
}
