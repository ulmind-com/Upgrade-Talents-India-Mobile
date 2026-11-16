import React, { useState, useEffect } from "react";
import { View, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Link, useRouter, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Upload, Check, Mail, KeyRound, UserRound, MapPin, ShieldCheck, X, Gift } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { authApi, extrasApi, tokenStore, ApiError } from "@/lib/api";
import { Alert, Button, Field, Input, Txt, Glow } from "@/components/ui";
import { useAlert } from "@/components/Popup";
import { OtpVerify } from "@/components/OtpVerify";

type Asset = { uri: string; name: string; type: string };
const TOTAL = 5;
const STEP_META = [
  { Icon: Mail, eyebrow: "Create account", title: "What's your email?", sub: "We'll send a 6-digit code to verify it." },
  { Icon: KeyRound, eyebrow: "Verify email", title: "Enter the code", sub: "" },
  { Icon: UserRound, eyebrow: "About you", title: "Tell us about you", sub: "This appears on your tickets and certificates." },
  { Icon: MapPin, eyebrow: "Security", title: "Address & password", sub: "Keep your account safe." },
  { Icon: ShieldCheck, eyebrow: "Almost there", title: "One last step", sub: "Add a photo so we recognise you. Verify your ID anytime with DigiLocker." },
];

export default function Register() {
  const { c } = useTheme();
  const router = useRouter();
  const { setUserToken } = useSession();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const alert = useAlert();
  const setFormError = (m: string | null) => { if (m) alert("error", "Can't continue", m); };
  const [notice, setNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [email, setEmail] = useState("");
  const params = useLocalSearchParams<{ ref?: string }>();
  const [referral, setReferral] = useState(params.ref ? String(params.ref) : "");
  const [refPreview, setRefPreview] = useState<any | null>(null);

  // Preview the inviter when a code is entered — debounced so it doesn't fire
  // on every keystroke. Mirrors the website's referral landing.
  useEffect(() => {
    const code = referral.trim();
    if (code.length < 3) { setRefPreview(null); return; }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await extrasApi.validateReferral(code);
        if (alive) setRefPreview(r?.valid ? r : null);
      } catch { if (alive) setRefPreview(null); }
    }, 500);
    return () => { alive = false; clearTimeout(t); };
  }, [referral]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [photo, setPhoto] = useState<Asset | null>(null);

  const meta = STEP_META[step];

  const pick = async (setter: (a: Asset) => void) => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) {
      const a = res.assets[0];
      setter({ uri: a.uri, name: a.fileName || a.uri.split("/").pop() || "upload.jpg", type: a.mimeType || "image/jpeg" });
    }
  };

  const next = async () => {
    setFormError(null); setNotice(null); setErrors({});
    const e: Record<string, string> = {};

    if (step === 0) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Enter a valid email address.";
      if (Object.keys(e).length) return setErrors(e);
      setLoading(true);
      try { await authApi.registerStep1(email.trim(), referral.trim() || undefined); setNotice(`Code sent to ${email}.`); setStep(1); }
      catch (err) { setFormError(err instanceof ApiError ? err.message : "Could not start registration."); }
      finally { setLoading(false); }
      return;
    }
    if (step === 2) {
      if (!name.trim()) e.name = "Enter your full name.";
      if (!/^\d{10,15}$/.test(phone.replace(/\D/g, ""))) e.phone = "Enter a valid phone number.";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) e.dob = "Use the format YYYY-MM-DD.";
      if (Object.keys(e).length) return setErrors(e);
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!address.trim()) e.address = "Enter your address.";
      if (password.length < 6) e.password = "Use at least 6 characters.";
      if (password !== confirm) e.confirm = "Passwords don't match.";
      if (Object.keys(e).length) return setErrors(e);
      setStep(4);
      return;
    }
    // step 4 — submit
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("password", password);
      fd.append("confirm_password", confirm);
      fd.append("name", name.trim());
      fd.append("phone_number", phone.replace(/\D/g, ""));
      fd.append("date_of_birth", dob);
      fd.append("address", address.trim());
      if (parentPhone.trim()) fd.append("parent_phone_number", parentPhone.replace(/\D/g, ""));
      if (photo) fd.append("profile_photo", { uri: photo.uri, name: photo.name, type: photo.type } as any);
      const res = await authApi.registerStep3(fd);
      await tokenStore.setReg(null);
      if (res?.access_token) { await setUserToken(res.access_token); router.replace("/(user)/profile"); }
      else router.replace("/(auth)/login");
    } catch (err) { setFormError(err instanceof ApiError ? err.message : "Could not complete registration."); }
    finally { setLoading(false); }
  };

  const back = () => {
    setFormError(null); setErrors({});
    if (step === 0) router.canGoBack() ? router.back() : router.replace("/(user)");
    else setStep((s) => s - 1);
  };

  const ctaLabel = step === 0 ? "Send code" : step === 1 ? "Verify" : step === 4 ? "Create account" : "Continue";

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={c.barStyle === "light" ? "light" : "dark"} />
      <Glow color={c.spot1} size={320} top={-130} right={-90} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        {/* Header: back + progress */}
        <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Pressable onPress={back} style={{ width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
              {step === 0 ? <X size={20} color={c.fg} /> : <ArrowLeft size={20} color={c.fg} />}
            </Pressable>
            <View style={{ flex: 1, flexDirection: "row", gap: 6 }}>
              {Array.from({ length: TOTAL }).map((_, i) => (
                <View key={i} style={{ flex: 1, height: 5, borderRadius: 999, overflow: "hidden", backgroundColor: c.surface2 }}>
                  {i <= step ? <LinearGradient colors={c.gradBrand as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: "100%", height: "100%" }} /> : null}
                </View>
              ))}
            </View>
          </View>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 28, paddingBottom: 40 }}>
            <View style={{ width: 54, height: 54, borderRadius: 16, overflow: "hidden", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
              <LinearGradient colors={c.gradBrand as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", width: "100%", height: "100%" }} />
              <meta.Icon size={26} color="#fff" />
            </View>
            <Txt size={12} font="monoMed" tone="accent" tracking={3} uppercase>{meta.eyebrow} · {step + 1}/{TOTAL}</Txt>
            <Txt size={30} font="display" tracking={-0.8} lh={34} style={{ marginTop: 8 }}>{meta.title}</Txt>
            {(meta.sub || step === 1) ? <Txt size={14.5} tone="muted" lh={21} style={{ marginTop: 8 }}>{step === 1 ? `Sent to ${email}` : meta.sub}</Txt> : null}

            <View style={{ marginTop: 26, gap: 18 }}>
              {notice ? <Alert tone="success">{notice}</Alert> : null}

              {step === 0 && (
                <>
                  <Field label="Email address" error={errors.email} required>
                    <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" invalid={!!errors.email} />
                  </Field>
                  <Field label="Referral code" hint="Optional — if a friend invited you.">
                    <Input value={referral} onChangeText={setReferral} autoCapitalize="characters" placeholder="e.g. UTI2026" />
                  </Field>
                  {refPreview ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 16, borderWidth: 1, borderColor: c.success + "55", backgroundColor: c.success + "12", padding: 12 }}>
                      <View style={{ width: 38, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.success + "22" }}>
                        <Gift size={18} color={c.success} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt size={13.5} font="sansBold" numberOfLines={1}>
                          {refPreview.inviter_full_name || refPreview.inviter_name || "A friend"} invited you
                        </Txt>
                        <Txt size={12} tone="muted" style={{ marginTop: 1 }}>
                          Sign up to get <Txt size={12} font="sansBold" tone="success">{refPreview.welcome_coins ?? 50} coins</Txt>
                          {refPreview.welcome_coins_value_inr ? ` (₹${refPreview.welcome_coins_value_inr})` : ""} free.
                        </Txt>
                      </View>
                      <Check size={16} color={c.success} />
                    </View>
                  ) : null}
                </>
              )}

              {step === 1 && (
                <OtpVerify
                  length={6}
                  title="Enter the code"
                  subtitle={`Sent to ${email}`}
                  successTitle="Email Verified"
                  successSubtitle="Now let's set up your profile…"
                  onVerify={async (code) => {
                    const res = await authApi.registerStep2(email.trim(), code);
                    const t = res?.access_token || res?.registration_token || res?.token;
                    if (t) await tokenStore.setReg(t);
                  }}
                  onSuccess={() => setStep(2)}
                  onResend={async () => {
                    try { await authApi.registerStep1(email.trim(), referral.trim() || undefined); setNotice("New code sent."); } catch {}
                  }}
                />
              )}

              {step === 2 && (
                <>
                  <Field label="Full name" error={errors.name} required>
                    <Input value={name} onChangeText={setName} placeholder="Your full name" invalid={!!errors.name} />
                  </Field>
                  <Field label="Phone number" error={errors.phone} required>
                    <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="9876543210" invalid={!!errors.phone} />
                  </Field>
                  <Field label="Parent's phone" hint="Required for minors.">
                    <Input value={parentPhone} onChangeText={setParentPhone} keyboardType="phone-pad" placeholder="Optional" />
                  </Field>
                  <Field label="Date of birth" error={errors.dob} required>
                    <Input value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" invalid={!!errors.dob} />
                  </Field>
                </>
              )}

              {step === 3 && (
                <>
                  <Field label="Address" error={errors.address} required>
                    <Input value={address} onChangeText={setAddress} placeholder="City, state, pincode" invalid={!!errors.address} />
                  </Field>
                  <Field label="Password" error={errors.password} required>
                    <View>
                      <Input value={password} onChangeText={setPassword} secureTextEntry={!showPw} placeholder="At least 6 characters" invalid={!!errors.password} style={{ paddingRight: 52 }} />
                      <Pressable onPress={() => setShowPw((s) => !s)} style={{ position: "absolute", right: 8, top: 8, width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
                        {showPw ? <EyeOff size={18} color={c.fgSubtle} /> : <Eye size={18} color={c.fgSubtle} />}
                      </Pressable>
                    </View>
                  </Field>
                  <Field label="Confirm password" error={errors.confirm} required>
                    <Input value={confirm} onChangeText={setConfirm} secureTextEntry={!showPw} placeholder="Re-enter password" invalid={!!errors.confirm} />
                  </Field>
                </>
              )}

              {step === 4 && (
                <>
                  <UploadField label="Profile photo" hint="Optional — helps us recognise you." fileName={photo?.name} onPress={() => pick(setPhoto)} />
                </>
              )}
            </View>
          </ScrollView>

          {/* Sticky CTA */}
          <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20, borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.bg }}>
            {step !== 1 ? <Button label={ctaLabel} onPress={next} loading={loading} size="lg" full iconRight={step === 4 ? <Check size={18} color={c.onAccent} /> : <ArrowRight size={18} color={c.onAccent} />} /> : null}
            {step === 0 ? (
              <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 }}>
                <Txt size={13.5} tone="muted">Already registered?</Txt>
                <Link href="/(auth)/login" asChild><Pressable><Txt size={13.5} font="sansBold" tone="accent">Sign in</Txt></Pressable></Link>
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function UploadField({ label, hint, fileName, onPress, required }: { label: string; hint?: string; fileName?: string; onPress: () => void; required?: boolean }) {
  const { c } = useTheme();
  return (
    <Field label={label} hint={hint} required={required}>
      <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 64, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", borderColor: fileName ? c.accent : c.borderStrong, paddingHorizontal: 16, backgroundColor: c.bgElevated }}>
        <View style={{ width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2 }}>
          {fileName ? <Check size={18} color={c.success} /> : <Upload size={18} color={c.accent} />}
        </View>
        <Txt size={14} tone={fileName ? "fg" : "muted"} numberOfLines={1} style={{ flex: 1 }}>{fileName || "Tap to choose a file"}</Txt>
      </Pressable>
    </Field>
  );
}
