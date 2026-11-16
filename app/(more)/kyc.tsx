import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, TextInput, Animated, Easing } from "react-native";
import { ShieldCheck, Lock, Check, Fingerprint, RefreshCw, AlertTriangle, ExternalLink } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { kycApi, safe, ApiError } from "@/lib/api";
import { InAppBrowser } from "@/components/InAppBrowser";
import { useAsync } from "@/lib/useAsync";
import { useAlert } from "@/components/Popup";
import { Txt, Button, Card, Badge, Skeleton, EmptyState, Field } from "@/components/ui";
import { OtpVerify } from "@/components/OtpVerify";
import { FadeInUp } from "@/components/FadeInUp";
import { formatEventDate } from "@/lib/format";

type Step = "aadhaar" | "otp" | "done";
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

/** Aadhaar verification through DigiLocker — the website's KYC panel. */
export default function Kyc() {
  const { c } = useTheme();
  const { user } = useSession();
  const alert = useAlert();

  const q = useAsync(() => (user ? safe(kycApi.status(), null as any) : Promise.resolve(null)), [user?.email]);
  const kyc = q.data || {};
  const verified = kyc.is_verified || kyc.status === "VERIFIED";

  const [step, setStep] = useState<Step>("aadhaar");
  const [aadhaar, setAadhaar] = useState("");
  const [otp, setOtp] = useState("");
  const [reference, setReference] = useState("");
  const [maskedMobile, setMaskedMobile] = useState("");
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // OTPs expire; show the window rather than letting people guess.
  useEffect(() => {
    if (step !== "otp") return;
    setSeconds(120);
    const t = setInterval(() => setSeconds((s) => (s <= 1 ? (clearInterval(t), 0) : s - 1)), 1000);
    return () => clearInterval(t);
  }, [step, reference]);

  const raw = digits(aadhaar);
  const pretty = raw.replace(/(\d{4})(?=\d)/g, "$1 ").trim();

  const send = async () => {
    if (raw.length !== 12) return alert("warning", "Check the number", "An Aadhaar number is 12 digits.");
    setBusy(true);
    try {
      const res = await kycApi.sendOtp(raw);
      setReference(res.reference_id);
      setMaskedMobile(res.masked_mobile || "");
      setStep("otp");
      alert("success", "OTP sent", res.message || `Sent to the mobile linked with this Aadhaar${res.masked_mobile ? ` (${res.masked_mobile})` : ""}.`);
    } catch (e) {
      alert("error", "Could not send OTP", e instanceof ApiError ? e.message : "Please try again.");
    } finally { setBusy(false); }
  };

  const verify = async (code: string) => {
    await kycApi.verifyOtp(reference, digits(code));
  };

  /* DigiLocker's own consent screen — opened in a browser, then re-checked. */
  const [dlBusy, setDlBusy] = useState(false);
  const [dlUrl, setDlUrl] = useState<string | null>(null);

  const digilocker = async () => {
    setDlBusy(true);
    try {
      const res = await kycApi.digilockerAuthorize();
      if (!res?.authorization_url) throw new Error(res?.message || "DigiLocker is not available right now.");
      setDlUrl(res.authorization_url);
    } catch (e) {
      alert("error", "DigiLocker failed", e instanceof ApiError ? e.message : "Could not start DigiLocker. Use the OTP route instead.");
    } finally { setDlBusy(false); }
  };

  /* Consent finished inside the sheet — confirm with the backend. */
  const digilockerDone = async () => {
    setDlUrl(null);
    const st = await safe(kycApi.digilockerStatus(), null as any);
    q.reload();
    if (st?.is_verified || st?.status === "VERIFIED") {
      setStep("done");
      alert("success", "Aadhaar verified", "DigiLocker confirmed your identity.");
    } else {
      alert("info", "Almost there", "DigiLocker is still processing — pull to refresh in a moment.");
    }
  };

  const restart = () => { setStep("aadhaar"); setOtp(""); setReference(""); setMaskedMobile(""); };

  if (!user) {
    return (
      <SubScreen eyebrow="Identity" title="Aadhaar KYC">
        <EmptyState icon={<ShieldCheck size={26} color={c.fgMuted} />} title="Sign in to verify" subtitle="KYC is tied to your account." />
      </SubScreen>
    );
  }

  return (
    <SubScreen
      eyebrow="Identity"
      title="Aadhaar KYC"
      refreshing={q.refreshing}
      onRefresh={q.refresh}
      overlay={
        <InAppBrowser
          visible={!!dlUrl}
          url={dlUrl}
          title="DigiLocker"
          doneUrlPattern={/\/api\/digilocker\/callback|digilocker\/(success|complete)/i}
          onDone={digilockerDone}
          onClose={() => setDlUrl(null)}
        />
      }
    >
      {q.loading ? (
        <View style={{ gap: 14 }}>{[0, 1].map((i) => <Skeleton key={i} h={120} radius={20} />)}</View>
      ) : verified || step === "done" ? (
        <FadeInUp>
          <Card style={{ alignItems: "center", gap: 14, paddingVertical: 28 }}>
            <View style={{ width: 62, height: 62, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.success + "1f" }}>
              <Check size={30} color={c.success} strokeWidth={3} />
            </View>
            <Txt size={19} font="sansExt">Identity verified</Txt>
            <Badge label="KYC complete" tone="success" />
            <View style={{ width: "100%", marginTop: 8, gap: 12 }}>
              {kyc.aadhaar_masked ? <Row label="Aadhaar" value={kyc.aadhaar_masked} mono /> : null}
              {kyc.verified_name ? <Row label="Name" value={kyc.verified_name} /> : null}
              {kyc.verified_dob ? <Row label="Date of birth" value={kyc.verified_dob} /> : null}
              {kyc.verified_at ? <Row label="Verified on" value={formatEventDate(kyc.verified_at)} /> : null}
              {kyc.source ? <Row label="Source" value={kyc.source} /> : null}
            </View>
          </Card>
        </FadeInUp>
      ) : (
        <>
          <FadeInUp>
            <Steps step={step} />
          </FadeInUp>

          {kyc.status === "REJECTED" ? (
            <FadeInUp delay={40}>
              <View style={{ flexDirection: "row", gap: 10, backgroundColor: c.danger + "16", borderWidth: 1, borderColor: c.danger + "44", borderRadius: 16, padding: 14, marginBottom: 16 }}>
                <AlertTriangle size={17} color={c.danger} />
                <Txt size={13} lh={19} style={{ flex: 1 }}>Your last attempt was rejected. Check the number and try again.</Txt>
              </View>
            </FadeInUp>
          ) : null}

          {step === "aadhaar" ? (
            <FadeInUp delay={60}>
              <Card style={{ gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: c.accent + "1f" }}>
                    <Fingerprint size={19} color={c.accent} />
                  </View>
                  <Txt size={16} font="sansBold" style={{ flex: 1 }}>Aadhaar number</Txt>
                </View>

                <Field label="12-digit Aadhaar" hint="An OTP goes to the mobile linked with it.">
                  <TextInput
                    value={pretty}
                    onChangeText={(t) => setAadhaar(digits(t).slice(0, 12))}
                    keyboardType="number-pad"
                    placeholder="XXXX XXXX XXXX"
                    placeholderTextColor={c.fgSubtle}
                    maxLength={14}
                    style={{ height: 52, borderRadius: 14, borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.bgElevated, paddingHorizontal: 16, color: c.fg, fontSize: 19, letterSpacing: 3, fontWeight: "700" }}
                  />
                </Field>

                <Button label="Send OTP" full size="lg" loading={busy} disabled={raw.length !== 12} onPress={send} icon={<ShieldCheck size={17} color={c.onAccent} />} />

                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
                  <Txt size={11} font="monoMed" tone="subtle" tracking={2}>OR</Txt>
                  <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
                </View>

                <Button
                  label="Verify with DigiLocker"
                  full
                  size="lg"
                  variant="outline"
                  loading={dlBusy}
                  onPress={digilocker}
                  icon={<ExternalLink size={17} color={c.fg} />}
                />
              </Card>
            </FadeInUp>
          ) : (
            <FadeInUp delay={60}>
              <OtpVerify
                length={6}
                title="Enter the OTP"
                subtitle={`Sent to the mobile linked with this Aadhaar${maskedMobile ? ` (${maskedMobile})` : ""}${seconds > 0 ? ` · valid ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : ""}`}
                successTitle="Aadhaar Verified"
                successSubtitle="Your identity is confirmed."
                onVerify={verify}
                onSuccess={() => { setStep("done"); q.reload(); }}
                onResend={restart}
              />
            </FadeInUp>
          )}

          <FadeInUp delay={120}>
            <View style={{ marginTop: 18, gap: 10 }}>
              {[
                { Icon: Lock, text: "Only a masked number (XXXX XXXX 1234) is kept on record" },
                { Icon: ShieldCheck, text: "Verified through DigiLocker — we never see your full Aadhaar" },
              ].map((r) => (
                <View key={r.text} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <r.Icon size={14} color={c.fgSubtle} />
                  <Txt size={12.5} tone="subtle" lh={18} style={{ flex: 1 }}>{r.text}</Txt>
                </View>
              ))}
            </View>
          </FadeInUp>
        </>
      )}
    </SubScreen>
  );
}

function Steps({ step }: { step: Step }) {
  const { c } = useTheme();
  const order: Step[] = ["aadhaar", "otp", "done"];
  const at = order.indexOf(step);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18 }}>
      {order.map((s, i) => {
        const on = i <= at;
        return (
          <React.Fragment key={s}>
            <View style={{ width: 26, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.accent : c.surface2, borderWidth: 1, borderColor: on ? c.accent : c.border }}>
              <Txt size={11.5} font="sansBold" style={{ color: on ? c.onAccent : c.fgSubtle }}>{i + 1}</Txt>
            </View>
            {i < order.length - 1 ? <View style={{ flex: 1, height: 2, borderRadius: 2, backgroundColor: i < at ? c.accent : c.border }} /> : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: c.border }}>
      <Txt size={11} font="monoMed" tone="subtle" tracking={1.5} uppercase>{label}</Txt>
      <Txt size={13.5} font={mono ? "mono" : "sansSemi"} numberOfLines={1} style={{ flex: 1, textAlign: "right" }}>{value}</Txt>
    </View>
  );
}
