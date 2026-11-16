import React from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Award, Download } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { extrasApi, safe, toRows } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Card, Badge, Skeleton, EmptyState } from "@/components/ui";
import { SignInPrompt } from "@/components/SignInPrompt";
import { formatEventDate, titleCase } from "@/lib/format";

export default function Certificates() {
  const { c } = useTheme();
  const { user } = useSession();
  const { data, loading, refreshing, refresh } = useAsync(() => (user ? safe(extrasApi.myCertificates(), null) : Promise.resolve(null)), [user?.email]);
  const rows = toRows(data);

  return (
    <SubScreen eyebrow="Your achievements" title="Certificates" refreshing={refreshing} onRefresh={user ? refresh : undefined}>
      {!user ? (
        <SignInPrompt message="Sign in to view and download your certificates." />
      ) : loading ? (
        <View style={{ gap: 12 }}>{[0, 1].map((i) => <Skeleton key={i} h={130} radius={20} />)}</View>
      ) : rows.length ? (
        <View style={{ gap: 14 }}>
          {rows.map((cert: any, i: number) => (
            <Card key={cert._id || cert.id || i} padding={0} style={{ overflow: "hidden" }}>
              <LinearGradient colors={[c.surface2, c.surface] as any} style={{ padding: 18 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ width: 46, height: 46, borderRadius: 12, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
                    <LinearGradient colors={c.gradBrand as any} style={{ position: "absolute", width: "100%", height: "100%" }} />
                    <Award size={22} color="#fff" />
                  </View>
                  {cert.status ? <Badge label={titleCase(cert.status)} tone="brand" /> : null}
                </View>
                <Txt size={17} font="sansBold" style={{ marginTop: 14 }} numberOfLines={2}>{cert.title || cert.competition_title || cert.name || "Certificate"}</Txt>
                <Txt size={12.5} tone="muted" style={{ marginTop: 4 }}>Issued {formatEventDate(cert.issued_at || cert.created_at)}</Txt>
                {cert.certificate_number || cert.number ? (
                  <Txt size={11.5} font="mono" tone="subtle" style={{ marginTop: 6 }}>{cert.certificate_number || cert.number}</Txt>
                ) : null}
              </LinearGradient>
            </Card>
          ))}
        </View>
      ) : (
        <EmptyState icon={<Award size={26} color={c.fgMuted} />} title="No certificates yet" subtitle="Compete and complete courses to earn verifiable certificates." />
      )}
    </SubScreen>
  );
}
