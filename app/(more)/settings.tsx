import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { Server, Check, Sun, Moon, Repeat, Wifi, Fingerprint, ChevronRight } from "lucide-react-native";
import { useRouter } from "expo-router";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { getApiBase, setApiBase, pingBackend } from "@/lib/api";
import { Txt, Card, Field, Input, Button, Divider, Alert } from "@/components/ui";

export default function Settings() {
  const { c, name, setTheme } = useTheme();
  const router = useRouter();
  const { setMode } = useSession();
  const [base, setBase] = useState(getApiBase());
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const save = () => {
    setApiBase(base.trim());
    setSaved(true);
    setTestResult(null);
    setTimeout(() => setSaved(false), 2000);
  };

  const test = async () => {
    setApiBase(base.trim());
    setTesting(true);
    setTestResult(null);
    const r = await pingBackend();
    setTestResult({ ok: r.ok, message: r.message });
    setTesting(false);
  };

  return (
    <SubScreen eyebrow="Preferences" title="App settings">
      <View style={{ gap: 20 }}>
        {saved ? <Alert tone="success">API address saved. Pull to refresh any screen to reload.</Alert> : null}

        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Server size={18} color={c.accent} />
            <Txt size={15} font="sansBold">Backend API address</Txt>
          </View>
          <Field label="Base URL" hint="On a real device use your machine's LAN IP, e.g. http://192.168.1.5:8000">
            <Input value={base} onChangeText={setBase} autoCapitalize="none" keyboardType="url" placeholder="http://localhost:8000" />
          </Field>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <Button label={saved ? "Saved" : "Save"} onPress={save} icon={saved ? <Check size={16} color={c.onAccent} /> : undefined} />
            <Button label="Test connection" variant="outline" loading={testing} onPress={test} icon={<Wifi size={16} color={c.fg} />} />
          </View>
          {testResult ? <View style={{ marginTop: 14 }}><Alert tone={testResult.ok ? "success" : "error"}>{testResult.message}</Alert></View> : null}
        </Card>

        <Card padding={0}>
          <View style={{ padding: 16 }}>
            <Txt size={13} font="monoMed" tone="subtle" tracking={2} uppercase>Appearance</Txt>
          </View>
          <Divider />
          <ThemeRow active={true} label="Zomato District AMOLED Dark (Active)" icon={<Moon size={18} color="#C9F24A" />} onPress={() => setTheme("dark")} />
        </Card>

        <Card padding={0}>
          <View style={{ padding: 16 }}>
            <Txt size={13} font="monoMed" tone="subtle" tracking={2} uppercase>Security</Txt>
          </View>
          <Divider />
          <Pressable
            onPress={() => router.push("/(more)/passkeys")}
            style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 14, padding: 16, opacity: pressed ? 0.7 : 1 })}
          >
            <Fingerprint size={18} color={c.accent} />
            <View style={{ flex: 1 }}>
              <Txt size={15} font="sansMed">Passkeys</Txt>
              <Txt size={12.5} tone="subtle">Sign in with Face ID or fingerprint</Txt>
            </View>
            <ChevronRight size={18} color={c.fgSubtle} />
          </Pressable>
        </Card>

        <Button
          label="Switch to Admin mode"
          variant="outline"
          full
          icon={<Repeat size={17} color={c.fg} />}
          onPress={() => { setMode("admin"); router.replace("/(admin)"); }}
        />
      </View>
    </SubScreen>
  );
}

function ThemeRow({ active, label, icon, onPress }: { active: boolean; label: string; icon: React.ReactNode; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }}>
        {icon}
        <Txt size={15} font="sansMed" style={{ flex: 1 }}>{label}</Txt>
        <Button label={active ? "Active" : "Use"} variant={active ? "ghost" : "outline"} size="sm" onPress={onPress} icon={active ? <Check size={15} color={c.fgMuted} /> : undefined} />
      </View>
    </View>
  );
}
