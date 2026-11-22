import React, { useState, useEffect } from "react";
import { View, Pressable, ScrollView, Switch, Modal } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  QrCode,
  ScanLine,
  CheckCircle2,
  XCircle,
  LogOut,
  KeyRound,
  HandHeart,
  History,
  Zap,
  Users,
  Check,
  AlertTriangle,
} from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import {
  volunteerAuthApi,
  volunteerScannerApi,
  tokenStore,
  ApiError,
  type TicketScanVerifyResult,
} from "@/lib/api";
import { Txt, Card, Button, Field, Input, Divider, Badge } from "@/components/ui";
import { useAlert } from "@/components/Popup";
import { StaffLogin } from "@/components/StaffLogin";
import { QRScanner } from "@/components/QRScanner";
import { DottedGrid } from "@/components/patterns";
import { formatDateTime } from "@/lib/format";

const TINT: [string, string] = ["#5ce1a6", "#13a06a"]; // mint = gate

interface ScanLog {
  id: string;
  ref: string;
  name: string;
  time: string;
  valid: boolean;
  alreadyIn: boolean;
}

export default function VolunteerGate() {
  const { c } = useTheme();
  const [authed, setAuthed] = useState(!!tokenStore.getStaff());
  const [token, setToken] = useState("");
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TicketScanVerifyResult | null>(null);
  const [history, setHistory] = useState<ScanLog[]>([]);
  const [autoCheckIn, setAutoCheckIn] = useState(true);
  const [admittedCount, setAdmittedCount] = useState(0);
  const [stats, setStats] = useState<any>(null);

  const loadStats = () => { volunteerScannerApi.stats().then(setStats).catch(() => {}); };
  useEffect(() => { if (authed) loadStats(); }, [authed]);

  const alert = useAlert();
  const setError = (m: string | null) => {
    if (m) alert("error", "Scan failed", m);
  };
  const setDone = (m: string | null) => {
    if (m) alert("success", "Checked in", m);
  };

  const executeCheckIn = async (tok: string) => {
    try {
      const cashAmt = Number(result?.cash_amount ?? 0);
      const isCash = Boolean(result?.is_cash || result?.cash_payment || (result?.cash_status && String(result.cash_status).toUpperCase() !== "COLLECTED" && cashAmt > 0));
      const res = await volunteerScannerApi.checkInTicket(tok, isCash ? { collect_cash: true, cash_collected: true, cash_amount: cashAmt || undefined } : {});
      setDone(res?.message || (isCash && cashAmt ? `Checked in — ₹${cashAmt} cash collected.` : "Checked in successfully."));
      setResult((r) => (r ? { ...r, ticket: { ...r.ticket, is_checked_in: true }, cash_status: isCash ? "COLLECTED" : r.cash_status } : r));
      setAdmittedCount((cnt) => cnt + 1);
      loadStats();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Check-in failed.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const verify = async (tok?: string) => {
    const t = (tok ?? token).trim();
    if (!t) return;
    if (tok) setToken(tok);
    setError(null);
    setDone(null);
    setResult(null);
    setBusy(true);

    try {
      const res = await volunteerScannerApi.verifyTicket(t);
      setResult(res);

      const isAlreadyIn = Boolean(res.ticket?.is_checked_in);
      const isValid = Boolean(res.is_valid);

      // Log to history
      setHistory((prev) => [
        {
          id: String(Date.now()),
          ref: res.ticket?.ticket_ref || t.slice(0, 10),
          name: res.ticket?.holder_name || "Guest",
          time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
          valid: isValid,
          alreadyIn: isAlreadyIn,
        },
        ...prev.slice(0, 24),
      ]);

      if (isValid && !isAlreadyIn) {
        if (autoCheckIn) {
          await executeCheckIn(t);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not verify this code.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await tokenStore.setStaff(null);
    setAuthed(false);
  };

  const [pwOpen, setPwOpen] = useState(false);
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confPw, setConfPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const changePw = async () => {
    if (!curPw || !newPw) return alert("warning", "Fill all fields", "Enter your current and new password.");
    if (newPw.length < 8) return alert("warning", "Too short", "New password must be at least 8 characters.");
    if (newPw !== confPw) return alert("warning", "Doesn't match", "New password and confirmation don't match.");
    setPwBusy(true);
    try {
      await volunteerAuthApi.changePassword(curPw, newPw);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      alert("success", "Password updated", "Use your new password next time you sign in.");
      setPwOpen(false); setCurPw(""); setNewPw(""); setConfPw("");
    } catch (e: any) {
      alert("error", "Couldn't change password", e instanceof ApiError ? e.message : "Check your current password and try again.");
    } finally {
      setPwBusy(false);
    }
  };

  if (!authed) {
    return (
      <SubScreen eyebrow="Gate" title="Volunteer">
        <StaffLogin
          api={volunteerAuthApi}
          role="Volunteer"
          tint={TINT}
          blurb="Sign in with your registered email to scan and admit guests at the gate."
          onDone={() => setAuthed(true)}
        />
      </SubScreen>
    );
  }

  const t = result?.ticket;
  const alreadyIn = t?.is_checked_in;

  return (
    <SubScreen
      eyebrow="Gate scanner"
      title="Volunteer"
      right={
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => setPwOpen(true)}
            style={{ width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}
          >
            <KeyRound size={18} color={c.fgMuted} />
          </Pressable>
          <Pressable
            onPress={logout}
            style={{ width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}
          >
            <LogOut size={18} color={c.fgMuted} />
          </Pressable>
        </View>
      }
    >
      {/* Mint Hero Header */}
      <View style={{ borderRadius: 24, overflow: "hidden", marginBottom: 18 }}>
        <LinearGradient
          colors={TINT as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 20 }}
        >
          <DottedGrid color="rgba(255,255,255,0.28)" opacity={0.5} gap={18} />
          <Txt
            size={66}
            font="display"
            style={{
              position: "absolute",
              top: -2,
              right: -4,
              color: "rgba(255,255,255,0.18)",
              letterSpacing: -3,
            }}
          >
            GATE
          </Txt>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: "rgba(255,255,255,0.28)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <HandHeart size={21} color="#fff" />
          </View>
          <Txt size={24} font="display" tracking={-0.5} lh={27} style={{ color: "#fff", marginTop: 12 }}>
            Scan. Verify.{"\n"}Let them in.
          </Txt>

          {/* Quick Stats Counter */}
          <View
            style={{
              flexDirection: "row",
              gap: 12,
              marginTop: 16,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: "rgba(255,255,255,0.2)",
            }}
          >
            <View>
              <Txt size={11} font="monoMed" uppercase tracking={1.5} style={{ color: "rgba(255,255,255,0.8)" }}>
                Check-ins
              </Txt>
              <Txt size={20} font="sansBold" style={{ color: "#fff", marginTop: 2 }}>
                {Number(stats?.total_checkins ?? admittedCount)}
              </Txt>
            </View>
            {stats && (stats.total_cash_collected != null || stats.cash_collected_count != null) ? (
              <View>
                <Txt size={11} font="monoMed" uppercase tracking={1.5} style={{ color: "rgba(255,255,255,0.8)" }}>
                  Cash collected
                </Txt>
                <Txt size={20} font="sansBold" style={{ color: "#fff", marginTop: 2 }}>
                  ₹{Number(stats.total_cash_collected ?? 0)}
                </Txt>
              </View>
            ) : null}
          </View>
        </LinearGradient>
      </View>

      {/* Auto Check-in Toggle Card */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 14,
          borderRadius: 16,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
          marginBottom: 16,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Zap size={18} color={autoCheckIn ? "#13a06a" : c.fgMuted} />
          <View>
            <Txt size={14} font="sansBold" style={{ color: "#ffffff" }}>
              Instant Auto Check-in
            </Txt>
            <Txt size={11.5} tone="muted">
              Auto-admits upon valid scan
            </Txt>
          </View>
        </View>
        <Switch
          value={autoCheckIn}
          onValueChange={setAutoCheckIn}
          trackColor={{ false: "#262938", true: "#13a06a" }}
          thumbColor="#ffffff"
        />
      </View>

      {/* Main Scan Trigger */}
      <Button
        label="Open Camera Scanner"
        full
        size="lg"
        onPress={() => setScanning(true)}
        icon={<QrCode size={19} color={c.onAccent} />}
      />

      {/* Manual Input Divider */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 16 }}>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
        <Txt size={11} font="monoMed" tone="subtle" tracking={2}>
          OR ENTER MANUALLY
        </Txt>
        <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      </View>

      <Field label="QR token / Reference" required>
        <Input
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
          placeholder="Paste or enter reference code"
          onSubmitEditing={() => verify()}
        />
      </Field>

      <View style={{ marginTop: 12 }}>
        <Button
          label="Verify Token"
          full
          variant="outline"
          loading={busy && !result}
          onPress={() => verify()}
          icon={<ScanLine size={17} color={c.fg} />}
        />
      </View>

      {/* Current Result Details */}
      {result ? (
        <Card style={{ marginTop: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {result.is_valid ? (
              <CheckCircle2 size={22} color={c.success} />
            ) : (
              <XCircle size={22} color={c.danger} />
            )}
            <Txt size={17} font="sansBold" style={{ flex: 1 }}>
              {result.is_valid ? "Valid ticket" : "Invalid ticket"}
            </Txt>
            {alreadyIn ? <Badge label="Already admitted" tone="warning" /> : null}
          </View>
          <Divider style={{ marginVertical: 14 }} />
          <View style={{ gap: 10 }}>
            {t?.holder_name ? <Row label="Holder" value={t.holder_name} /> : null}
            {t?.holder_email ? <Row label="Email" value={t.holder_email} /> : null}
            {t?.ticket_ref ? <Row label="Reference" value={t.ticket_ref} mono /> : null}
            {result.booking_status ? <Row label="Booking" value={result.booking_status} /> : null}
            {(result.is_cash || result.cash_payment || Number(result.cash_amount) > 0) ? (
              <Row label="Cash" value={`₹${Number(result.cash_amount ?? 0)}${result.cash_status ? ` · ${result.cash_status}` : " · collect at gate"}`} />
            ) : null}
            {t?.check_in_time ? (
              <Row label="Checked in" value={formatDateTime(t.check_in_time)} />
            ) : null}
          </View>
          {result.is_valid && !alreadyIn && !autoCheckIn ? (
            <View style={{ marginTop: 16 }}>
              <Button
                label="Admit Guest"
                full
                loading={busy}
                onPress={() => executeCheckIn(token.trim())}
                icon={<CheckCircle2 size={16} color={c.onAccent} />}
              />
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* Recent Scan History */}
      {history.length > 0 ? (
        <View style={{ marginTop: 22 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              marginBottom: 10,
            }}
          >
            <History size={15} color="#9ea3b8" />
            <Txt size={12} font="monoMed" uppercase tracking={1.5} style={{ color: "#9ea3b8" }}>
              Recent Scans ({history.length})
            </Txt>
          </View>

          <View style={{ gap: 8 }}>
            {history.map((log) => (
              <View
                key={log.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 12,
                  borderRadius: 14,
                  backgroundColor: "#111114",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.06)",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      backgroundColor: log.valid
                        ? "rgba(34, 197, 94, 0.2)"
                        : "rgba(239, 68, 68, 0.2)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {log.valid ? (
                      <Check size={14} color="#22c55e" />
                    ) : (
                      <XCircle size={14} color="#ef4444" />
                    )}
                  </View>
                  <View>
                    <Txt size={13.5} font="sansBold" style={{ color: "#ffffff" }}>
                      {log.name}
                    </Txt>
                    <Txt size={11} font="mono" style={{ color: "#8e93a8" }}>
                      {log.ref} • {log.time}
                    </Txt>
                  </View>
                </View>

                <Badge
                  label={
                    !log.valid ? "Invalid" : log.alreadyIn ? "Already In" : "Admitted"
                  }
                  tone={!log.valid ? "danger" : log.alreadyIn ? "warning" : "success"}
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <QRScanner
        visible={scanning}
        onClose={() => setScanning(false)}
        onScan={(d) => verify(d)}
      />

      <Modal visible={pwOpen} transparent animationType="fade" onRequestClose={() => setPwOpen(false)}>
        <Pressable onPress={() => setPwOpen(false)} style={{ flex: 1, backgroundColor: c.scrim, justifyContent: "flex-end" }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: c.bgElevated, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: 40, gap: 16, borderWidth: 1, borderColor: c.border }}>
            <View style={{ alignSelf: "center", width: 42, height: 5, borderRadius: 999, backgroundColor: c.border }} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: c.accent + "1f", alignItems: "center", justifyContent: "center" }}>
                <KeyRound size={20} color={c.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Txt size={17} font="sansBold">Change password</Txt>
                <Txt size={12.5} tone="muted" style={{ marginTop: 1 }}>Verify your current password, then set a new one.</Txt>
              </View>
            </View>
            <Field label="Current password" required>
              <Input value={curPw} onChangeText={setCurPw} secureTextEntry autoCapitalize="none" placeholder="••••••••" />
            </Field>
            <Field label="New password" required hint="At least 8 characters">
              <Input value={newPw} onChangeText={setNewPw} secureTextEntry autoCapitalize="none" placeholder="••••••••" />
            </Field>
            <Field label="Confirm new password" required>
              <Input value={confPw} onChangeText={setConfPw} secureTextEntry autoCapitalize="none" placeholder="••••••••" />
            </Field>
            <Button label="Update password" full size="lg" loading={pwBusy} onPress={changePw} icon={<Check size={16} color={c.onAccent} />} />
          </Pressable>
        </Pressable>
      </Modal>
    </SubScreen>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Txt size={12.5} tone="subtle" font="monoMed" tracking={1} uppercase>
        {label}
      </Txt>
      <Txt
        size={13.5}
        font={mono ? "mono" : "sansSemi"}
        style={{ flex: 1, textAlign: "right" }}
        numberOfLines={1}
      >
        {value}
      </Txt>
    </View>
  );
}
