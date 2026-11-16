import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { QrCode, ScanLine, CheckCircle2, XCircle, LogOut, HandHeart } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { volunteerAuthApi, volunteerScannerApi, tokenStore, ApiError, type TicketScanVerifyResult } from "@/lib/api";
import { Txt, Card, Button, Field, Input, Divider, Badge } from "@/components/ui";
import { useAlert } from "@/components/Popup";
import { StaffLogin } from "@/components/StaffLogin";
import { QRScanner } from "@/components/QRScanner";
import { DottedGrid } from "@/components/patterns";
import { formatDateTime } from "@/lib/format";

const TINT: [string, string] = ["#5ce1a6", "#13a06a"]; // mint = gate

export default function VolunteerGate() {
  const { c } = useTheme();
  const [authed, setAuthed] = useState(!!tokenStore.getStaff());
  const [token, setToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TicketScanVerifyResult | null>(null);
  const alert = useAlert();
  const setError = (m: string | null) => { if (m) alert("error", "Scan failed", m); };
  const setDone = (m: string | null) => { if (m) alert("success", "Checked in", m); };

  const verify = async (tok?: string) => {
    const t = (tok ?? token).trim();
    if (!t) return;
    if (tok) setToken(tok);
    setError(null); setDone(null); setResult(null); setBusy(true);
    try {
      const res = await volunteerScannerApi.verifyTicket(t);
      setResult(res);
      Haptics.notificationAsync(res.is_valid ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error).catch(() => {});
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not verify this code.");
    } finally { setBusy(false); }
  };

  const checkIn = async () => {
    setBusy(true); setError(null);
    try {
      const res = await volunteerScannerApi.checkInTicket(token.trim());
      setDone(res?.message || "Checked in successfully.");
      setResult((r) => (r ? { ...r, ticket: { ...r.ticket, is_checked_in: true } } : r));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Check-in failed.");
    } finally { setBusy(false); }
  };

  const logout = async () => { await tokenStore.setStaff(null); setAuthed(false); };

  if (!authed) {
    return (
      <SubScreen eyebrow="Gate" title="Volunteer">
        <StaffLogin api={volunteerAuthApi} role="Volunteer" tint={TINT} blurb="Sign in with your registered email to scan and admit guests at the gate." onDone={() => setAuthed(true)} />
      </SubScreen>
    );
  }

  const t = result?.ticket;
  const alreadyIn = t?.is_checked_in;

  return (
    <SubScreen
      eyebrow="Gate scanner" title="Volunteer"
      right={<Pressable onPress={logout} style={{ width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}><LogOut size={18} color={c.fgMuted} /></Pressable>}
    >
      {/* mint hero */}
      <View style={{ borderRadius: 24, overflow: "hidden", marginBottom: 18 }}>
        <LinearGradient colors={TINT as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20 }}>
          <DottedGrid color="rgba(255,255,255,0.28)" opacity={0.5} gap={18} />
          <Txt size={66} font="display" style={{ position: "absolute", top: -2, right: -4, color: "rgba(255,255,255,0.18)", letterSpacing: -3 }}>GATE</Txt>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.28)", alignItems: "center", justifyContent: "center" }}>
            <HandHeart size={21} color="#fff" />
          </View>
          <Txt size={24} font="display" tracking={-0.5} lh={27} style={{ color: "#fff", marginTop: 12 }}>Scan. Verify.{"\n"}Let them in.</Txt>
        </LinearGradient>
      </View>

      <Button label="Scan QR code" full size="lg" onPress={() => setScanning(true)} icon={<QrCode size={18} color={c.onAccent} />} />

      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 16 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        <Txt size={11.5} font="monoMed" tone="subtle" tracking={2}>OR ENTER MANUALLY</Txt>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      </View>

      <Field label="QR token / reference" required>
        <Input value={token} onChangeText={setToken} autoCapitalize="none" placeholder="Paste the scanned code" onSubmitEditing={() => verify()} />
      </Field>
      <View style={{ marginTop: 14 }}>
        <Button label="Verify" full variant="outline" loading={busy && !result} onPress={() => verify()} icon={<ScanLine size={17} color={c.fg} />} />
      </View>


      {result ? (
        <Card style={{ marginTop: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {result.is_valid ? <CheckCircle2 size={22} color={c.success} /> : <XCircle size={22} color={c.danger} />}
            <Txt size={17} font="sansBold" style={{ flex: 1 }}>{result.is_valid ? "Valid ticket" : "Invalid ticket"}</Txt>
            {alreadyIn ? <Badge label="Already in" tone="warning" /> : null}
          </View>
          <Divider style={{ marginVertical: 14 }} />
          <View style={{ gap: 10 }}>
            {t?.holder_name ? <Row label="Holder" value={t.holder_name} /> : null}
            {t?.holder_email ? <Row label="Email" value={t.holder_email} /> : null}
            {t?.ticket_ref ? <Row label="Reference" value={t.ticket_ref} mono /> : null}
            {result.booking_status ? <Row label="Booking" value={result.booking_status} /> : null}
            {t?.check_in_time ? <Row label="Checked in" value={formatDateTime(t.check_in_time)} /> : null}
          </View>
          {result.is_valid && !alreadyIn ? (
            <View style={{ marginTop: 16 }}>
              <Button label="Check in" full loading={busy} onPress={checkIn} icon={<CheckCircle2 size={16} color={c.onAccent} />} />
            </View>
          ) : null}
        </Card>
      ) : null}

      <QRScanner visible={scanning} onClose={() => setScanning(false)} onScan={(d) => verify(d)} />
    </SubScreen>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Txt size={12.5} tone="subtle" font="monoMed" tracking={1} uppercase>{label}</Txt>
      <Txt size={13.5} font={mono ? "mono" : "sansSemi"} style={{ flex: 1, textAlign: "right" }} numberOfLines={1}>{value}</Txt>
    </View>
  );
}
