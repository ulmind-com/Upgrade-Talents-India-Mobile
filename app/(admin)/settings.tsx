import React, { useEffect, useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { Save, Vote, Monitor, Smartphone, Coins, KeyRound, Mail, Webhook, Copy, Check, RefreshCw } from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import { AdminShell } from "@/components/admin/Shell";
import {
  useAdmin, T, AButton, APanel, AField, AInput, ALoading, AKeyValues,
} from "@/components/admin/ui";
import { useSession } from "@/context/Session";
import { useAlert } from "@/components/Popup";
import { adminAuthApi, cmsApi, safe, getApiBase, razorpayWebhookApi, ApiError, type WebhookStatus } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";

const POWERS = [
  { k: "voting_power_website", label: "Website vote", hint: "Votes cast from the public website.", Icon: Monitor, fb: 1 },
  { k: "voting_power_mobile", label: "Mobile app vote", hint: "Higher weight encourages app installs.", Icon: Smartphone, fb: 5 },
  { k: "voting_power_paid", label: "Paid vote pack", hint: "Votes bought in a pack.", Icon: Coins, fb: 10 },
];

export default function AdminSettings() {
  const c = useAdmin();
  const alert = useAlert();
  const { admin } = useSession();

  const voting = useAsync(() => safe(cmsApi.getVotingSettings(), null as any), []);
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (voting.data) setDraft({ ...voting.data }); }, [voting.data]);
  const v = (k: string, fb: number) => (draft[k] ?? voting.data?.[k] ?? fb);

  const save = async () => {
    setBusy(true);
    try {
      await cmsApi.updateVotingSettings({
        voting_power_website: Number(v("voting_power_website", 1)),
        voting_power_mobile: Number(v("voting_power_mobile", 5)),
        voting_power_paid: Number(v("voting_power_paid", 10)),
      });
      alert("success", "Saved", "Voting rules saved.");
      voting.reload();
    } catch (e: any) {
      alert("error", "Couldn't save", e?.message || "Please try again.");
    } finally { setBusy(false); }
  };

  const ratio = Number(v("voting_power_mobile", 5)) / Math.max(1, Number(v("voting_power_website", 1)));

  return (
    <AdminShell refreshing={voting.refreshing} onRefresh={voting.refresh}>
      <APanel
        title="Voting power"
        subtitle="How much a single vote counts, per channel. Changeable any time — never hard-coded."
        action={<AButton label="Save" size="sm" loading={busy} icon={<Save size={13} color="#fff" />} onPress={save} />}
      >
        {voting.loading ? (
          <ALoading rows={3} />
        ) : (
          <View>
            {POWERS.map((p) => (
              <AField key={p.k} label={p.label} hint={p.hint}>
                <View>
                  <AInput
                    value={String(v(p.k, p.fb))}
                    onChangeText={(t) => setDraft((d) => ({ ...d, [p.k]: t }))}
                    keyboardType="numeric"
                    style={{ paddingLeft: 40 }}
                  />
                  <View pointerEvents="none" style={{ position: "absolute", left: 14, top: 14 }}>
                    <p.Icon size={16} color={c.fgSubtle} />
                  </View>
                </View>
              </AField>
            ))}

            <View style={{ borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Vote size={16} color={c.brand} />
                <T size={12.5} font="semi">Current weighting</T>
              </View>
              <T size={12.5} mut style={{ marginTop: 8 }}>1 app vote = {ratio}× a website vote.</T>
            </View>
          </View>
        )}
      </APanel>

      <APanel title="Session & environment" subtitle="Read-only details about this admin session">
        <AKeyValues
          items={[
            { k: "Signed in as", v: admin?.email || "—" },
            { k: "Role", v: admin?.role || "Administrator" },
            { k: "Backend", v: <T size={12} font="mono" numberOfLines={1}>{getApiBase()}</T> },
          ]}
        />
        <View style={{ marginTop: 20, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, padding: 16 }}>
          <T size={12.5} mut lh={19}>
            Admin sessions are separate from the public app and are signed out from the menu. Changing your email signs you out on every other device.
          </T>
        </View>
      </APanel>

      <WebhookPanel />

      <PasswordPanel />
      <EmailPanel />
    </AdminShell>
  );
}

/* ── Razorpay webhook health ──
   The app never POSTs to the webhook (that's signed by Razorpay with a secret
   that must stay on the server). It only pings the GET status endpoints so an
   admin can confirm the URL pasted into Razorpay → Webhooks is live. */
type Probe = { state: "checking" | "up" | "down"; status?: WebhookStatus; error?: string; ms?: number };

function WebhookPanel() {
  const c = useAdmin();
  const urls = razorpayWebhookApi.urls();
  const [root, setRoot] = useState<Probe>({ state: "checking" });
  const [api, setApi] = useState<Probe>({ state: "checking" });
  const [copied, setCopied] = useState<string | null>(null);

  const probe = async (fn: () => Promise<WebhookStatus>, set: (p: Probe) => void) => {
    set({ state: "checking" });
    const t0 = Date.now();
    try {
      const st = await fn();
      set({ state: String(st?.status).toLowerCase() === "active" ? "up" : "down", status: st, ms: Date.now() - t0 });
    } catch (e) {
      set({ state: "down", error: e instanceof ApiError ? e.message : "Not reachable", ms: Date.now() - t0 });
    }
  };
  const check = () => {
    probe(razorpayWebhookApi.statusRoot, setRoot);
    probe(razorpayWebhookApi.statusApi, setApi);
  };
  useEffect(check, []);

  const copy = async (u: string) => {
    await Clipboard.setStringAsync(u);
    setCopied(u);
    setTimeout(() => setCopied(null), 1500);
  };

  const Row = ({ label, url, p }: { label: string; url: string; p: Probe }) => {
    const color = p.state === "up" ? c.success : p.state === "down" ? c.danger : c.fgSubtle;
    return (
      <View style={{ borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, padding: 14, marginBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {p.state === "checking" ? (
            <ActivityIndicator size="small" color={c.fgSubtle} />
          ) : (
            <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: color }} />
          )}
          <T size={12.5} font="semi" style={{ flex: 1 }}>{label}</T>
          <T size={11.5} font="semi" style={{ color }}>
            {p.state === "checking" ? "Checking…" : p.state === "up" ? `Active${p.ms != null ? ` · ${p.ms} ms` : ""}` : "Unreachable"}
          </T>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 }}>
          <T size={11.5} font="mono" numberOfLines={1} style={{ flex: 1 }}>{url}</T>
          <Pressable onPress={() => copy(url)} hitSlop={8} accessibilityLabel={`Copy ${label} URL`} style={{ padding: 4 }}>
            {copied === url ? <Check size={15} color={c.success} /> : <Copy size={15} color={c.fgSubtle} />}
          </Pressable>
        </View>
        {p.status?.message || p.error ? (
          <T size={11.5} mut lh={16} style={{ marginTop: 6 }}>{p.status?.message || p.error}</T>
        ) : null}
      </View>
    );
  };

  return (
    <APanel
      title="Payments webhook"
      subtitle="Paste one of these into Razorpay → Settings → Webhooks. Razorpay signs every event; the server verifies it."
      action={<AButton label="Check" size="sm" icon={<RefreshCw size={13} color="#fff" />} onPress={check} />}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Webhook size={16} color={c.brand} />
        <T size={12.5} mut>Health pings only — the app never sends webhook events itself.</T>
      </View>
      <Row label="Root endpoint" url={urls.root} p={root} />
      <Row label="API endpoint" url={urls.api} p={api} />
    </APanel>
  );
}

function PasswordPanel() {
  const c = useAdmin();
  const alert = useAlert();
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!pw.current || !pw.next) return alert("warning", "Almost there", "Fill in both password fields.");
    if (pw.next.length < 8) return alert("warning", "Too short", "Use at least 8 characters.");
    if (pw.next !== pw.confirm) return alert("error", "Passwords differ", "The confirmation does not match.");
    setBusy(true);
    try {
      await adminAuthApi.changePassword(pw.current, pw.next);
      alert("success", "Saved", "Password updated.");
      setPw({ current: "", next: "", confirm: "" });
    } catch (e: any) {
      alert("error", "Couldn't update", e?.message || "Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <APanel
      title={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <KeyRound size={16} color={c.brand} />
          <T size={15} font="bold">Change password</T>
        </View>
      }
    >
      <AField label="Current password"><AInput value={pw.current} onChangeText={(t) => setPw((s) => ({ ...s, current: t }))} secureTextEntry autoCapitalize="none" /></AField>
      <AField label="New password" hint="At least 8 characters."><AInput value={pw.next} onChangeText={(t) => setPw((s) => ({ ...s, next: t }))} secureTextEntry autoCapitalize="none" /></AField>
      <AField label="Confirm new password"><AInput value={pw.confirm} onChangeText={(t) => setPw((s) => ({ ...s, confirm: t }))} secureTextEntry autoCapitalize="none" /></AField>
      <AButton label="Update password" size="sm" loading={busy} onPress={submit} />
    </APanel>
  );
}

function EmailPanel() {
  const c = useAdmin();
  const alert = useAlert();
  const [em, setEm] = useState({ current: "", next: "", password: "" });
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!em.next.trim() || !em.password) return alert("warning", "Almost there", "Enter the new email and your password.");
    setBusy(true);
    try {
      await adminAuthApi.changeEmail(em.password, em.next.trim());
      alert("success", "Saved", "Login email updated.");
      setEm({ current: "", next: "", password: "" });
    } catch (e: any) {
      alert("error", "Couldn't update", e?.message || "Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <APanel
      title={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Mail size={16} color={c.brand} />
          <T size={15} font="bold">Change login email</T>
        </View>
      }
    >
      <AField label="New email"><AInput value={em.next} onChangeText={(t) => setEm((s) => ({ ...s, next: t }))} autoCapitalize="none" keyboardType="email-address" /></AField>
      <AField label="Current password" hint="Required to confirm this change."><AInput value={em.password} onChangeText={(t) => setEm((s) => ({ ...s, password: t }))} secureTextEntry autoCapitalize="none" /></AField>
      <AButton label="Update email" size="sm" loading={busy} onPress={submit} />
    </APanel>
  );
}
