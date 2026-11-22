import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowRight, Eye, EyeOff, Ticket, ShieldCheck, Sparkles, Fingerprint } from "lucide-react-native";
import { AuthShell } from "@/components/AuthShell";
import { Alert, Button, Field, Input, Txt } from "@/components/ui";
import { useAlert } from "@/components/Popup";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { ApiError, tokenStore } from "@/lib/api";
import { useGoogleAuth, googleConfigured } from "@/lib/googleAuth";
import { passkeyAvailable, signInWithPasskey, PasskeyUnavailable } from "@/lib/passkey";

export default function Login() {
  const { c } = useTheme();
  const router = useRouter();
  const { loginUser, refreshUser } = useSession();
  const google = useGoogleAuth(async (tok) => {
    await tokenStore.setUser(tok);
    await refreshUser();
    if (next) router.replace(next as any);
    else if (router.canGoBack()) router.back();
    else router.replace("/(user)");
  });
  const { next } = useLocalSearchParams<{ next?: string }>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const alert = useAlert();
  const setFormError = (m: string | null) => { if (m) alert("error", "Sign in failed", m); };
  const [loading, setLoading] = useState(false);
  const [pkBusy, setPkBusy] = useState(false);

  const passkeySignIn = async () => {
    setPkBusy(true);
    try {
      await signInWithPasskey();
      await refreshUser();
      if (next) router.replace(next as any);
      else if (router.canGoBack()) router.back();
      else router.replace("/(user)");
    } catch (err) {
      if (err instanceof PasskeyUnavailable) alert("info", "Passkeys coming soon", err.message);
      else alert("error", "Passkey sign-in failed", err instanceof ApiError ? err.message : "Try another method.");
    } finally {
      setPkBusy(false);
    }
  };

  const submit = async () => {
    setFormError(null);
    const e: typeof errors = {};
    if (!email.trim()) e.email = "Enter the email you registered with.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "That doesn't look like a valid email.";
    if (!password) e.password = "Enter your password.";
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    try {
      await loginUser(email.trim(), password);
      if (next) router.replace(next as any);
      else if (router.canGoBack()) router.back();
      else router.replace("/(user)");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not sign you in. Check your details and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell eyebrow="Welcome back" title="Sign in" subtitle="Access your tickets, bookings and certificates." seed={1}>
      <View style={{ gap: 18 }}>

        <Field label="Email address" error={errors.email} required>
          <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@example.com" invalid={!!errors.email} />
        </Field>

        <Field label="Password" error={errors.password} required>
          <View>
            <Input value={password} onChangeText={setPassword} secureTextEntry={!show} placeholder="••••••••" invalid={!!errors.password} style={{ paddingRight: 52 }} />
            <Pressable onPress={() => setShow((s) => !s)} style={{ position: "absolute", right: 8, top: 8, width: 36, height: 36, alignItems: "center", justifyContent: "center" }}>
              {show ? <EyeOff size={18} color={c.fgSubtle} /> : <Eye size={18} color={c.fgSubtle} />}
            </Pressable>
          </View>
        </Field>

        <Pressable onPress={() => router.push("/(auth)/forgot-password")} style={{ alignSelf: "flex-end", marginTop: -8 }} hitSlop={8}>
          <Txt size={13} font="sansSemi" tone="accent">Forgot password?</Txt>
        </Pressable>

        <Button label="Sign in" onPress={submit} loading={loading} size="lg" full iconRight={<ArrowRight size={18} color={c.onAccent} />} />

        {passkeyAvailable() ? (
          <Button label="Sign in with a passkey" variant="outline" full size="lg" loading={pkBusy} onPress={passkeySignIn} icon={<Fingerprint size={18} color={c.fg} />} />
        ) : null}

        {googleConfigured ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
              <Txt size={11.5} font="monoMed" tone="subtle" tracking={2}>OR</Txt>
              <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
            </View>
            <Button label="Continue with Google" variant="outline" full size="lg" loading={google.busy} onPress={google.signIn} />
            {google.error ? <Alert tone="error">{google.error}</Alert> : null}
          </>
        ) : null}

        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 2 }}>
          <Txt size={13.5} tone="muted">New here?</Txt>
          <Link href="/(auth)/register" asChild>
            <Pressable>
              <Txt size={13.5} font="sansBold" tone="accent">Create an account</Txt>
            </Pressable>
          </Link>
        </View>

        <View style={{ gap: 12, marginTop: 14 }}>
          {[
            { Icon: Ticket, t: "All your QR passes in one place" },
            { Icon: ShieldCheck, t: "Secure, verified bookings" },
            { Icon: Sparkles, t: "Early access to new drops" },
          ].map((f) => (
            <View key={f.t} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2 }}>
                <f.Icon size={16} color={c.accent} />
              </View>
              <Txt size={13.5} tone="muted">{f.t}</Txt>
            </View>
          ))}
        </View>
      </View>
    </AuthShell>
  );
}
