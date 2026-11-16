import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ShieldCheck, CheckCircle2, XCircle, Search } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { publicApi, ApiError } from "@/lib/api";
import { Txt, Card, Field, Input, Button, Divider, Badge } from "@/components/ui";
import { formatEventDate, titleCase } from "@/lib/format";

export default function Verify() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token ? decodeURIComponent(String(params.token)) : "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    if (!token.trim()) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await publicApi.verifyCertificate(token.trim());
      setResult(res);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not verify this certificate.");
    } finally { setBusy(false); }
  };

  // Opened from a certificate QR / shared link — verify without a second tap.
  const auto = useRef(false);
  useEffect(() => {
    if (auto.current || !params.token) return;
    auto.current = true;
    check();
  }, [params.token]);

  const valid = result && (result.valid ?? result.is_valid ?? result.status === "VALID") && result.status !== "REVOKED";
  const r = result || {};

  return (
    <SubScreen eyebrow="Authenticity check" title="Verify certificate">
      <Txt size={13.5} tone="muted" lh={20} style={{ marginBottom: 16 }}>Enter a certificate number or verification code to confirm it's genuine.</Txt>

      <Field label="Certificate code / number" required>
        <Input value={token} onChangeText={setToken} autoCapitalize="characters" placeholder="e.g. UTI-CERT-2026-0001" onSubmitEditing={check} />
      </Field>
      <View style={{ marginTop: 14 }}>
        <Button label="Verify" full size="lg" loading={busy} onPress={check} icon={<Search size={17} color={c.onAccent} />} />
      </View>

      {error ? (
        <Card style={{ marginTop: 18, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <XCircle size={24} color={c.danger} />
          <Txt size={14} font="sansSemi" style={{ flex: 1 }}>{error}</Txt>
        </Card>
      ) : null}

      {result ? (
        <Card style={{ marginTop: 18 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {valid ? <CheckCircle2 size={24} color={c.success} /> : <XCircle size={24} color={c.danger} />}
            <Txt size={18} font="sansBold">{valid ? "Genuine certificate" : "Not valid"}</Txt>
            {r.status ? <Badge label={titleCase(r.status)} tone={valid ? "success" : "danger"} /> : null}
          </View>
          <Divider style={{ marginVertical: 14 }} />
          <View style={{ gap: 10 }}>
            {r.recipient_name || r.holder_name ? <Row label="Recipient" value={r.recipient_name || r.holder_name} /> : null}
            {r.title || r.competition_title || r.course_title ? <Row label="For" value={r.title || r.competition_title || r.course_title} /> : null}
            {r.certificate_number || r.number ? <Row label="Number" value={r.certificate_number || r.number} mono /> : null}
            {r.issued_at || r.created_at ? <Row label="Issued" value={formatEventDate(r.issued_at || r.created_at)} /> : null}
          </View>
        </Card>
      ) : null}
    </SubScreen>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Txt size={12.5} tone="subtle" font="monoMed" tracking={1} uppercase>{label}</Txt>
      <Txt size={13.5} font={mono ? "mono" : "sansSemi"} style={{ flex: 1, textAlign: "right" }} numberOfLines={2}>{value}</Txt>
    </View>
  );
}
