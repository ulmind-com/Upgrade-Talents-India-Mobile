import React, { useState } from "react";
import { View, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { ShieldCheck, Eye, EyeOff, ArrowRight, Lock, Repeat } from "lucide-react-native";
import { useSession } from "@/context/Session";
import { useAlert } from "@/components/Popup";
import { ApiError, getApiBase, pingBackend } from "@/lib/api";
import { AdminTheme, useAdmin, T, AButton, AField, AInput } from "@/components/admin/ui";

export default function AdminLogin() {
  return (
    <AdminTheme>
      <LoginBody />
    </AdminTheme>
  );
}

function LoginBody() {
  const c = useAdmin();
  const router = useRouter();
  const { loginAdmin, setMode } = useSession();
  const alert = useAlert();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conn, setConn] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);

  const test = async () => {
    setTesting(true);
    const r = await pingBackend();
    setConn({ ok: r.ok, message: r.message });
    setTesting(false);
  };

  const submit = async () => {
    if (!email.trim() || !password) return alert("error", "Sign in failed", "Enter your admin email and password.");
    setBusy(true);
    try {
      await loginAdmin(email.trim(), password);
      router.replace("/(admin)");
    } catch (err) {
      alert("error", "Sign in failed", err instanceof ApiError ? err.message : "Could not sign in. Check your credentials.");
    } finally {
      setBusy(false);
    }
  };

  const toUser = () => { setMode("user"); router.replace("/(user)"); };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={c.barStyle === "light" ? "light" : "dark"} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 48 }} keyboardShouldPersistTaps="handled">
            <View style={{ width: "100%", maxWidth: 400, alignSelf: "center" }}>
              <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.brand }}>
                <ShieldCheck size={24} color="#fff" />
              </View>

              <T size={28} font="bold" lh={34} style={{ marginTop: 28 }}>Control Room</T>
              <T size={13.5} mut style={{ marginTop: 8 }}>
                Sign in with your administrator account to manage events, tickets and the public site.
              </T>

              <View style={{ marginTop: 36 }}>
                <AField label="Email address" required>
                  <AInput value={email} onChangeText={setEmail} placeholder="admin@upgradetalents.in" autoCapitalize="none" keyboardType="email-address" />
                </AField>

                <AField label="Password" required>
                  <View>
                    <AInput value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry={!show} autoCapitalize="none" style={{ paddingRight: 48 }} />
                    <Pressable
                      onPress={() => setShow((s) => !s)}
                      style={{ position: "absolute", right: 6, top: 6, width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" }}
                    >
                      {show ? <EyeOff size={16} color={c.fgSubtle} /> : <Eye size={16} color={c.fgSubtle} />}
                    </Pressable>
                  </View>
                </AField>

                <AButton label="Sign in" full loading={busy} onPress={submit} iconRight={<ArrowRight size={16} color="#fff" />} style={{ marginTop: 8 }} />
              </View>

              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 28 }}>
                <Lock size={14} color={c.fgSubtle} style={{ marginTop: 2 }} />
                <T size={11.5} sub lh={17} style={{ flex: 1 }}>
                  Admin sessions are separate from the public app and expire on sign out.
                </T>
              </View>

              {/* Connection check — mobile needs to know which backend it is talking to */}
              <View style={{ marginTop: 28, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 20 }}>
                <T size={11} font="bold" sub upper track={0.8}>Backend</T>
                <T size={11.5} font="mono" mut style={{ marginTop: 4 }} numberOfLines={1}>{getApiBase()}</T>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <AButton label={testing ? "Testing…" : "Test connection"} size="sm" variant="secondary" onPress={test} />
                  <AButton label="Open app" size="sm" variant="ghost" icon={<Repeat size={14} color={c.fgMuted} />} onPress={toUser} />
                </View>
                {conn ? (
                  <View style={{ marginTop: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: conn.ok ? c.successSoft : c.dangerSoft }}>
                    <T size={12.5} font="medium" color={conn.ok ? c.success : c.danger}>{conn.message}</T>
                  </View>
                ) : null}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
