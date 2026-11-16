import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ArrowRight, Eye, EyeOff, Mail, Check, ShieldQuestion } from "lucide-react-native";
import { AuthShell } from "@/components/AuthShell";
import { Button, Field, Input, Txt } from "@/components/ui";
import { OtpVerify } from "@/components/OtpVerify";
import { useAlert } from "@/components/Popup";
import { useTheme } from "@/theme/ThemeProvider";
import { ApiError, authApi } from "@/lib/api";

type Step = "email" | "otp" | "reset" | "done";

export default function ForgotPassword() {
  const { c } = useTheme();
  const router = useRouter();
  const alert = useAlert();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<{ email?: string; pw?: string; pw2?: string }>({});

  const requestOtp = async () => {
    const e: typeof err = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Enter the email you registered with.";
    setErr(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      await authApi.forgotRequest(email.trim());
      setStep("otp");
    } catch (ex) {
      alert("error", "Couldn't send the code", ex instanceof ApiError ? ex.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const reset = async () => {
    const e: typeof err = {};
    if (pw.length < 6) e.pw = "Use at least 6 characters.";
    if (pw2 !== pw) e.pw2 = "Passwords don't match.";
    setErr(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    try {
      // One-shot confirm (email + OTP + new password) — the flow the website
      // ships; falls back to the token-based reset if the OTP was already
      // exchanged for a reset token.
      await authApi.forgotConfirm(email.trim(), otp, pw, pw2);
      setStep("done");
    } catch (ex) {
      alert("error", "Couldn't reset", ex instanceof ApiError ? ex.message : "The code may have expired — start again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: the OTP act, reusing the shared verify animation ──
  if (step === "otp") {
    return (
      <AuthShell eyebrow="Check your inbox" title="Verify it's you" subtitle={`We sent a 6-digit code to ${email}.`} seed={4}>
        <OtpVerify
          title="Enter the reset code"
          subtitle="The code is valid for a few minutes."
          successTitle="Verified"
          successSubtitle="Now choose a new password…"
          onVerify={async (code) => {
            // Confirm the code is right up front so a wrong one shakes here,
            // then carry it to the one-shot reset on the next step.
            await authApi.forgotVerifyOtp(email.trim(), code);
            setOtp(code);
          }}
          onSuccess={() => setStep("reset")}
          onResend={async () => {
            try { await authApi.forgotRequest(email.trim()); alert("success", "Code resent", "Check your inbox again."); }
            catch { alert("error", "Couldn't resend", "Please try again in a moment."); }
          }}
        />
        <Pressable onPress={() => setStep("email")} style={{ marginTop: 18, alignSelf: "center" }}>
          <Txt size={13.5} tone="muted">Wrong email? <Txt size={13.5} font="sansBold" tone="accent">Go back</Txt></Txt>
        </Pressable>
      </AuthShell>
    );
  }

  // ── Step 3: new password ──
  if (step === "reset") {
    return (
      <AuthShell eyebrow="Almost done" title="Set a new password" subtitle="Make it something you'll remember." seed={4}>
        <View style={{ gap: 18 }}>
          <Field label="New password" error={err.pw} required>
            <View>
              <Input value={pw} onChangeText={setPw} secureTextEntry={!show} placeholder="••••••••" invalid={!!err.pw} style={{ paddingRight: 52 }} />
              <Pressable onPress={() => setShow((s) => !s)} style={{ position: "absolute", right: 8, top: 8, width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                {show ? <EyeOff size={18} color={c.fgSubtle} /> : <Eye size={18} color={c.fgSubtle} />}
              </Pressable>
            </View>
          </Field>
          <Field label="Confirm new password" error={err.pw2} required>
            <Input value={pw2} onChangeText={setPw2} secureTextEntry={!show} placeholder="••••••••" invalid={!!err.pw2} />
          </Field>
          <Button label="Reset password" onPress={reset} loading={loading} size="lg" full iconRight={<Check size={18} color={c.onAccent} />} />
        </View>
      </AuthShell>
    );
  }

  // ── Step 4: success ──
  if (step === "done") {
    return (
      <AuthShell eyebrow="All set" title="Password updated" subtitle="You can sign in with your new password now." seed={4}>
        <View style={{ gap: 20, alignItems: "center", paddingVertical: 10 }}>
          <View style={{ width: 76, height: 76, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.success + "1f" }}>
            <Check size={34} color={c.success} />
          </View>
          <Txt size={14} tone="muted" align="center" style={{ maxWidth: 280 }}>
            Your password has been changed. Head back and sign in.
          </Txt>
          <Button label="Back to sign in" onPress={() => router.replace("/(auth)/login")} size="lg" full iconRight={<ArrowRight size={18} color={c.onAccent} />} />
        </View>
      </AuthShell>
    );
  }

  // ── Step 1: email ──
  return (
    <AuthShell eyebrow="Forgot password" title="Reset your password" subtitle="We'll email you a code to get back in." seed={4}>
      <View style={{ gap: 18 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 14 }}>
          <View style={{ width: 38, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.accent + "1c" }}>
            <ShieldQuestion size={18} color={c.accent} />
          </View>
          <Txt size={13} tone="muted" lh={18} style={{ flex: 1 }}>
            Enter your account email and we'll send a one-time code to verify it's you.
          </Txt>
        </View>

        <Field label="Email address" error={err.email} required>
          <View>
            <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@example.com" invalid={!!err.email} style={{ paddingLeft: 44 }} />
            <View style={{ position: "absolute", left: 14, top: 0, bottom: 0, justifyContent: "center" }}>
              <Mail size={17} color={c.fgSubtle} />
            </View>
          </View>
        </Field>

        <Button label="Send reset code" onPress={requestOtp} loading={loading} size="lg" full iconRight={<ArrowRight size={18} color={c.onAccent} />} />

        <Pressable onPress={() => router.replace("/(auth)/login")} style={{ alignSelf: "center", marginTop: 2 }}>
          <Txt size={13.5} tone="muted">Remembered it? <Txt size={13.5} font="sansBold" tone="accent">Sign in</Txt></Txt>
        </Pressable>
      </View>
    </AuthShell>
  );
}
