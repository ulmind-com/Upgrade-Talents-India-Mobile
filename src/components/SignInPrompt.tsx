import React from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { LogIn } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt, Card, Button } from "@/components/ui";

export function SignInPrompt({ message }: { message: string }) {
  const { c } = useTheme();
  const router = useRouter();
  return (
    <Card style={{ alignItems: "center", gap: 14, paddingVertical: 32, marginTop: 8 }}>
      <View style={{ width: 60, height: 60, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2 }}>
        <LogIn size={24} color={c.accent} />
      </View>
      <Txt size={16} font="sansBold" align="center">Sign in required</Txt>
      <Txt size={14} tone="muted" align="center" style={{ maxWidth: 280 }}>{message}</Txt>
      <Button label="Sign in" onPress={() => router.push("/(auth)/login")} />
    </Card>
  );
}
