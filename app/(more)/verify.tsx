import React, { useEffect, useRef, useState } from "react";
import { View, Pressable } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ShieldCheck, CheckCircle2, XCircle, Search, QrCode, Award, Calendar, Hash, Trophy, Sparkles, X } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { publicApi, ApiError } from "@/lib/api";
import { Txt, Card, Field, Input, Button, Divider, Badge } from "@/components/ui";
import { QRScanner } from "@/components/QRScanner";
import { formatEventDate, titleCase } from "@/lib/format";

export default function Verify() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ? decodeURIComponent(String(params.token)) : "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const check = async (inputToken?: string) => {
    const raw = (inputToken ?? token).trim();
    if (!raw) return;
    if (inputToken) setToken(raw);
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      // Clean token in case user pasted or scanned a full URL
      const cleanToken = raw.includes("/") ? raw.split("/").filter(Boolean).pop()! : raw;
      const res = await publicApi.verifyCertificate(cleanToken);
      setResult(res);
      if (res?.verification_status === "NOT_FOUND") {
        setError(res?.message || "Invalid certificate ID. Record not found.");
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not verify this certificate.");
    } finally {
      setBusy(false);
    }
  };

  // Opened from a certificate QR / shared link — verify without a second tap.
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || !params.token) return;
    auto.current = true;
    check(decodeURIComponent(String(params.token)));
  }, [params.token]);

  const status = result?.verification_status || result?.status;
  const valid = result && (status === "VALID" || result?.is_valid === true) && status !== "REVOKED";
  const revoked = status === "REVOKED";
  const r = result || {};

  const name = r.participant_name || r.recipient_name || r.holder_name;
  const activity = r.activity_title || r.title || r.competition_title || r.course_title;
  const certId = r.certificate_id || r.certificate_number || r.number || token;
  const issueDate = r.issue_date || r.issued_at || r.created_at;

  return (
    <SubScreen eyebrow="Authenticity check" title="Verify certificate">
      <Txt size={13.5} tone="muted" lh={20} style={{ marginBottom: 16 }}>
        Enter a certificate number or scan its QR code to confirm it was genuinely issued by Upgrade Talents.
      </Txt>

      <Field label="Certificate code / number" required>
        <Input
          value={token}
          onChangeText={setToken}
          autoCapitalize="characters"
          placeholder="e.g. UTI-CERT-2026-0001"
          onSubmitEditing={() => check()}
        />
      </Field>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
        <View style={{ flex: 1 }}>
          <Button
            label="Verify"
            full
            size="lg"
            loading={busy}
            onPress={() => check()}
            icon={<Search size={17} color={c.onAccent} />}
          />
        </View>
        <Pressable
          onPress={() => setScanning(true)}
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <QrCode size={22} color={c.fg} />
        </Pressable>
      </View>

      {/* Camera QR scanner modal */}
      <QRScanner
        visible={scanning}
        onClose={() => setScanning(false)}
        onScan={(data) => {
          setScanning(false);
          setToken(data);
          check(data);
        }}
      />

      {error ? (
        <Card style={{ marginTop: 18, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#1f1518", borderColor: c.danger + "44" }}>
          <XCircle size={24} color={c.danger} />
          <Txt size={14} font="sansSemi" style={{ flex: 1, color: "#ff8e8e" }}>{error}</Txt>
        </Card>
      ) : null}

      {result && !error ? (
        <Card
          style={{
            marginTop: 20,
            padding: 20,
            borderWidth: 1.5,
            borderColor: valid ? "#C9F24A" : revoked ? c.danger : c.border,
            backgroundColor: "#14161E",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              {valid ? <CheckCircle2 size={22} color="#C9F24A" /> : <XCircle size={22} color={c.danger} />}
              <Txt size={16} font="sansBold" style={{ color: valid ? "#C9F24A" : c.danger }}>
                {valid ? "Verified & Authentic" : revoked ? "Certificate Revoked" : "Not Valid"}
              </Txt>
            </View>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: "rgba(201,242,74,0.12)", alignItems: "center", justifyContent: "center" }}>
              <Award size={20} color="#C9F24A" />
            </View>
          </View>

          <Divider style={{ marginVertical: 14 }} />

          {valid && name ? (
            <View style={{ marginBottom: 14 }}>
              <Txt size={11} font="monoMed" tracking={1.5} uppercase style={{ color: "#9ea3b8" }}>
                This certifies that
              </Txt>
              <Txt size={22} font="display" style={{ color: "#ffffff", marginTop: 4 }}>
                {name}
              </Txt>
              {activity ? (
                <Txt size={13.5} style={{ color: "#9ea3b8", marginTop: 4 }}>
                  {r.certificate_type === "ACHIEVEMENT" || r.rank ? "Achieved distinction in" : "Participated in"}{" "}
                  <Txt size={13.5} font="sansBold" style={{ color: "#ffffff" }}>{activity}</Txt>
                </Txt>
              ) : null}
            </View>
          ) : null}

          {r.award_title || r.rank ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 14, backgroundColor: "rgba(255, 56, 92, 0.12)", marginBottom: 14 }}>
              <Trophy size={18} color="#FF385C" />
              <Txt size={13.5} font="sansBold" style={{ color: "#FF385C" }}>
                {r.award_title || `Rank #${r.rank}`}
              </Txt>
            </View>
          ) : null}

          <View style={{ gap: 10 }}>
            {certId ? <Row label="Certificate ID" value={certId} mono /> : null}
            {r.certificate_type ? <Row label="Type" value={titleCase(r.certificate_type)} /> : null}
            {issueDate ? <Row label="Issue date" value={formatEventDate(issueDate)} /> : null}
            {r.revocation_reason ? <Row label="Reason" value={r.revocation_reason} /> : null}
          </View>
        </Card>
      ) : null}
    </SubScreen>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Txt size={12} tone="subtle" font="monoMed" tracking={1} uppercase>{label}</Txt>
      <Txt size={13} font={mono ? "mono" : "sansSemi"} style={{ flex: 1, textAlign: "right", color: "#ffffff" }} numberOfLines={2}>{value}</Txt>
    </View>
  );
}
