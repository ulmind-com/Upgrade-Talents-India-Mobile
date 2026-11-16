import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, Mail, KeyRound, Lock, Eye, EyeOff } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { tokenStore, ApiError } from "@/lib/api";
import { Txt, Button, Field, Input, Alert } from "@/components/ui";
import { useAlert } from "@/components/Popup";
import { OtpVerify } from "@/components/OtpVerify";
import { DottedGrid } from "@/components/patterns";

type StaffToken = { access_token: string; must_set_password?: boolean };
type Api = {
  loginStep1: (email: string) => Promise<any>;
  loginStep2: (email: string, otp: string) => Promise<StaffToken>;
  loginPassword?: (email: string, password: string) => Promise<StaffToken>;
  setPassword?: (password: string) => Promise<any>;
};

/** OTP or password sign-in for the Judge and Volunteer panels. */
export function StaffLogin({ api, role, tint, blurb, onDone }: { api: Api; role: string; tint: [string, string]; blurb: string; onDone: (email: string) => void }) {
  const { c } = useTheme();
  // 0 = credentials, 1 = OTP act, 2 = set a first password
  const [step, setStep] = useState(0);
  const [pwMode, setPwMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPw, setNewPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const alert = useAlert();
  const setErr = (m: string | null) => { if (m) alert("error", "Sign in failed", m); };
  const [note, setNote] = useState<string | null>(null);

  const canPw = !!api.loginPassword;

  const send = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("Enter a valid email address."); return; }
    setErr(null); setBusy(true);
    try { await api.loginStep1(email.trim()); setNote(`Code sent to ${email}`); setStep(1); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Could not send the code."); }
    finally { setBusy(false); }
  };

  const finish = async (res: StaffToken) => {
    await tokenStore.setStaff(res.access_token);
    if (res.must_set_password && api.setPassword) { setNote("Set a password so you can sign in faster next time."); setStep(2); return; }
    onDone(email.trim());
  };

  const passwordLogin = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("Enter a valid email address."); return; }
    if (!password) { setErr("Enter your password."); return; }
    setErr(null); setBusy(true);
    try { await finish(await api.loginPassword!(email.trim(), password)); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Wrong email or password."); }
    finally { setBusy(false); }
  };

  const saveNewPassword = async () => {
    if (newPw.length < 6) { setErr("Use at least 6 characters."); return; }
    setErr(null); setBusy(true);
    try { await api.setPassword!(newPw); onDone(email.trim()); }
    catch (e) { setErr(e instanceof ApiError ? e.message : "Could not set password."); }
    finally { setBusy(false); }
  };

  const otpRes = React.useRef<StaffToken | null>(null);
  const verify = async (code: string) => {
    const res = await api.loginStep2(email.trim(), code.trim());
    await tokenStore.setStaff(res.access_token);
    otpRes.current = res;
  };
  const afterOtp = () => {
    if (otpRes.current?.must_set_password && api.setPassword) { setNote("Set a password so you can sign in faster next time."); setStep(2); }
    else onDone(email.trim());
  };

  return (
    <View style={{ gap: 18 }}>
      <View style={{ borderRadius: 24, overflow: "hidden" }}>
        <LinearGradient colors={tint as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20 }}>
          <DottedGrid color="rgba(255,255,255,0.25)" opacity={0.5} gap={18} />
          <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.26)", alignItems: "center", justifyContent: "center" }}>
            {step === 0 ? <Mail size={22} color="#fff" /> : <KeyRound size={22} color="#fff" />}
          </View>
          <Txt size={24} font="display" tracking={-0.5} style={{ color: "#fff", marginTop: 12 }}>{role} access</Txt>
          <Txt size={13} lh={19} style={{ color: "rgba(255,255,255,0.9)", marginTop: 6, maxWidth: 280 }}>{blurb}</Txt>
        </LinearGradient>
      </View>

      {note ? <Alert tone="success">{note}</Alert> : null}

      {step === 0 ? (
        <>
          <Field label="Registered email" required>
            <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
          </Field>

          {pwMode ? (
            <>
              <Field label="Password" required>
                <View>
                  <Input value={password} onChangeText={setPassword} secureTextEntry={!showPw} placeholder="••••••••" style={{ paddingRight: 52 }} />
                  <Pressable onPress={() => setShowPw((s) => !s)} style={{ position: "absolute", right: 8, top: 8, width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                    {showPw ? <EyeOff size={18} color={c.fgSubtle} /> : <Eye size={18} color={c.fgSubtle} />}
                  </Pressable>
                </View>
              </Field>
              <Button label="Sign in" full size="lg" loading={busy} onPress={passwordLogin} iconRight={<ArrowRight size={18} color={c.onAccent} />} />
            </>
          ) : (
            <Button label="Send code" full size="lg" loading={busy} onPress={send} iconRight={<ArrowRight size={18} color={c.onAccent} />} />
          )}

          {canPw ? (
            <Pressable onPress={() => { setPwMode((m) => !m); setNote(null); }} style={{ alignSelf: "center", marginTop: 2 }} hitSlop={8}>
              <Txt size={13} font="sansBold" tone="accent">{pwMode ? "Use a one-time code instead" : "Sign in with a password"}</Txt>
            </Pressable>
          ) : null}
        </>
      ) : step === 1 ? (
        <>
          <OtpVerify
            length={6}
            title="Enter the code"
            subtitle={`Sent to ${email}`}
            successTitle="Access Granted"
            successSubtitle={`Welcome back. Opening the ${role.toLowerCase()} console…`}
            onVerify={verify}
            onSuccess={afterOtp}
            onResend={send}
          />
          <Pressable onPress={() => { setStep(0); setNote(null); }} style={{ alignSelf: "center" }}>
            <Txt size={13} font="sansBold" tone="accent">Change email</Txt>
          </Pressable>
        </>
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <Lock size={18} color={tint[0]} />
            <Txt size={16} font="sansBold" style={{ flex: 1 }}>Create a password</Txt>
          </View>
          <Field label="New password" hint="You'll use this to sign in next time." required>
            <View>
              <Input value={newPw} onChangeText={setNewPw} secureTextEntry={!showPw} placeholder="At least 6 characters" style={{ paddingRight: 52 }} />
              <Pressable onPress={() => setShowPw((s) => !s)} style={{ position: "absolute", right: 8, top: 8, width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                {showPw ? <EyeOff size={18} color={c.fgSubtle} /> : <Eye size={18} color={c.fgSubtle} />}
              </Pressable>
            </View>
          </Field>
          <Button label="Save & continue" full size="lg" loading={busy} onPress={saveNewPassword} iconRight={<ArrowRight size={18} color={c.onAccent} />} />
          <Pressable onPress={() => onDone(email.trim())} style={{ alignSelf: "center" }} hitSlop={8}>
            <Txt size={13} tone="subtle">Skip for now</Txt>
          </Pressable>
        </>
      )}
    </View>
  );
}
