import React, { useState } from "react";
import { View } from "react-native";
import { ScanLine, CheckCircle2, XCircle, Ticket, Crown, QrCode } from "lucide-react-native";
import { AdminShell } from "@/components/admin/Shell";
import { useAdmin, AButton, ACard, AField, AInput, AScope, ATag, T } from "@/components/admin/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { checkinApi, vipApi, cmsApi, safe, toRows, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAlert } from "@/components/Popup";
import { QRScanner } from "@/components/QRScanner";

export default function AdminCheckIn() {
  const { c } = useTheme();
  const [mode, setMode] = useState<"ticket" | "vip">("ticket");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const alert = useAlert();
  const setError = (m: string | null) => { if (m) alert("error", "Scan failed", m); };
  const setDone = (m: string | null) => { if (m) alert("success", "Checked in", m); };
  const [scanning, setScanning] = useState(false);
  // A VIP pass is scoped to one event, so the gate picks which one it is on.
  const [eventId, setEventId] = useState<string | null>(null);
  const events = useAsync(() => safe(cmsApi.listEvents({ limit: 200 }), [] as any), []);

  const verify = async (tok?: string) => {
    const t = (tok ?? token).trim();
    if (!t) return;
    if (tok) setToken(tok);
    setError(null); setDone(null); setResult(null); setBusy(true);
    try {
      const res = mode === "ticket"
        ? await checkinApi.verify({ qr_token: t })
        : await vipApi.verifyPass({ qr_token: t, event_id: eventId || undefined });
      setResult(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not verify this code.");
    } finally { setBusy(false); }
  };

  const checkIn = async () => {
    setBusy(true); setError(null);
    try {
      await checkinApi.checkIn({ qr_token: token.trim() });
      setDone("Checked in successfully.");
      setResult((r: any) => ({ ...r, is_checked_in: true }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Check-in failed.");
    } finally { setBusy(false); }
  };

  const valid = result && (result.valid !== false) && !result.error;
  const ref = result?.pass_reference || result?.ticket_ref || result?.ticket?.ticket_ref;
  const holder = result?.holder_name || result?.ticket?.holder_name || result?.user_name;
  const alreadyIn = result?.is_checked_in || result?.ticket?.is_checked_in;

  return (
    <AdminShell title="Check-in">
      <T size={13.5} mut style={{ marginBottom: 16 }}>Enter the QR token printed on the pass to verify and admit.</T>

      <View style={{ flexDirection: "row", backgroundColor: c.surface, borderRadius: 999, padding: 4, borderWidth: 1, borderColor: c.border, marginBottom: 18 }}>
        {([["ticket", "Ticket", Ticket], ["vip", "VIP Pass", Crown]] as const).map(([k, label, Icon]) => {
          const on = mode === k;
          return (
            <AButton key={k} label={label} variant={on ? "primary" : "ghost"} size="sm" onPress={() => { setMode(k as any); setResult(null); }} icon={<Icon size={14} color={on ? "#fff" : c.fgMuted} />} style={{ flex: 1 }} full />
          );
        })}
      </View>

      {mode === "vip" ? (
        <>
          <T size={10.5} font="monoMed" sub track={2} upper style={{ marginBottom: 8 }}>Gate</T>
          <AScope
            items={toRows(events.data).map((e: any) => ({ id: e._id || e.id, label: e.title || "Event" }))}
            value={eventId}
            onChange={setEventId}
            placeholder="Any event"
          />
        </>
      ) : null}

      <View style={{ marginBottom: 14 }}>
        <AButton label="Scan QR code" full size="md" onPress={() => setScanning(true)} icon={<QrCode size={18} color={"#fff"} />} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        <T size={11.5} font="monoMed" sub track={2}>OR ENTER MANUALLY</T>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      </View>

      <AField label="QR token / reference" required>
        <AInput value={token} onChangeText={setToken} autoCapitalize="none" placeholder="Paste the scanned code" onSubmitEditing={() => verify()} />
      </AField>
      <View style={{ marginTop: 14 }}>
        <AButton label="Verify" full variant="secondary" loading={busy && !result} onPress={() => verify()} icon={<ScanLine size={17} color={c.fg} />} />
      </View>

      <QRScanner visible={scanning} onClose={() => setScanning(false)} onScan={(data) => verify(data)} />


      {result ? (
        <ACard style={{ marginTop: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {valid ? <CheckCircle2 size={22} color={c.success} /> : <XCircle size={22} color={c.danger} />}
            <T size={17} font="bold">{valid ? "Valid pass" : "Invalid pass"}</T>
            {alreadyIn ? <ATag label="Already in" tone="warning" /> : null}
          </View>
          <View style={{ height: 1, backgroundColor: c.border, marginVertical: 14 }} />
          <View style={{ gap: 10 }}>
            {holder ? <Row label="Holder" value={holder} /> : null}
            {ref ? <Row label="Reference" value={ref} mono /> : null}
            {result?.ticket_type || result?.pass_type ? <Row label="Type" value={result.ticket_type || result.pass_type} /> : null}
            {result?.event_title ? <Row label="Event" value={result.event_title} /> : null}
          </View>
          {valid && !alreadyIn ? (
            <View style={{ marginTop: 16 }}>
              <AButton label="Check in" full onPress={checkIn} loading={busy} icon={<CheckCircle2 size={16} color={"#fff"} />} />
            </View>
          ) : null}
        </ACard>
      ) : null}
    </AdminShell>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const c = useAdmin();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <T size={12.5} sub font="monoMed" track={1} upper>{label}</T>
      <T size={13.5} font={mono ? "mono" : "semi"} style={{ flex: 1, textAlign: "right" }} numberOfLines={1}>{value}</T>
    </View>
  );
}
