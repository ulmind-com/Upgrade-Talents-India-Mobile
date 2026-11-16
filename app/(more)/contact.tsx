import React from "react";
import { View, Linking, Pressable } from "react-native";
import { Mail, Phone, MapPin, Instagram, Facebook, Youtube, Twitter, Linkedin, ExternalLink, ChevronRight } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { publicApi, safe } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Card, Divider, Skeleton } from "@/components/ui";

export default function Contact() {
  const { c } = useTheme();
  const { data, loading, refreshing, refresh } = useAsync(
    () => Promise.all([safe(publicApi.contactInfo(), {} as any), safe(publicApi.importantLinks(), [] as any[])]),
    []
  );
  const [contact, links] = data || [{}, []];
  const social = contact?.social_media || {};
  const open = (url?: string) => url && Linking.openURL(url).catch(() => {});

  const socials = [
    { k: "instagram", Icon: Instagram, url: social.instagram },
    { k: "facebook", Icon: Facebook, url: social.facebook },
    { k: "youtube", Icon: Youtube, url: social.youtube },
    { k: "twitter", Icon: Twitter, url: social.twitter },
    { k: "linkedin", Icon: Linkedin, url: social.linkedin },
  ].filter((s) => s.url);

  return (
    <SubScreen eyebrow="We're here" title="Contact us" refreshing={refreshing} onRefresh={refresh}>
      {loading ? (
        <View style={{ gap: 12 }}><Skeleton h={160} radius={20} /><Skeleton h={100} radius={20} /></View>
      ) : (
        <View style={{ gap: 16 }}>
          <Card padding={0}>
            {contact?.contact_email ? <ContactRow icon={<Mail size={19} color={c.accent} />} label="Email" value={contact.contact_email} onPress={() => open(`mailto:${contact.contact_email}`)} /> : null}
            {contact?.contact_phone ? <><Divider style={{ marginLeft: 50 }} /><ContactRow icon={<Phone size={19} color={c.accent} />} label="Phone" value={contact.contact_phone} onPress={() => open(`tel:${contact.contact_phone}`)} /></> : null}
            {contact?.office_address ? <><Divider style={{ marginLeft: 50 }} /><ContactRow icon={<MapPin size={19} color={c.accent} />} label="Address" value={contact.office_address} /></> : null}
            {!contact?.contact_email && !contact?.contact_phone && !contact?.office_address ? (
              <View style={{ padding: 16 }}><Txt size={14} tone="muted">Contact details will be available soon.</Txt></View>
            ) : null}
          </Card>

          {socials.length ? (
            <View>
              <Txt size={13} font="monoMed" tone="subtle" tracking={2} uppercase style={{ marginBottom: 10 }}>Follow us</Txt>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {socials.map((s) => (
                  <Pressable key={s.k} onPress={() => open(s.url)} style={{ width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
                    <s.Icon size={21} color={c.fg} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {links?.length ? (
            <View>
              <Txt size={13} font="monoMed" tone="subtle" tracking={2} uppercase style={{ marginBottom: 10 }}>Important links</Txt>
              <Card padding={0}>
                {links.map((l: any, i: number) => (
                  <View key={l._id || i}>
                    <Pressable onPress={() => open(l.url)} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 15 }}>
                      <ExternalLink size={17} color={c.fgMuted} />
                      <Txt size={14.5} font="sansMed" style={{ flex: 1 }} numberOfLines={1}>{l.title || l.label || l.url}</Txt>
                      <ChevronRight size={17} color={c.fgSubtle} />
                    </Pressable>
                    {i < links.length - 1 ? <Divider style={{ marginLeft: 44 }} /> : null}
                  </View>
                ))}
              </Card>
            </View>
          ) : null}
        </View>
      )}
    </SubScreen>
  );
}

function ContactRow({ icon, label, value, onPress }: { icon: React.ReactNode; label: string; value: string; onPress?: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: 16 }}>
      <View style={{ width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2 }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Txt size={11} font="monoMed" tone="subtle" tracking={1.5} uppercase>{label}</Txt>
        <Txt size={14.5} font="sansMed" style={{ marginTop: 2 }}>{value}</Txt>
      </View>
      {onPress ? <ChevronRight size={17} color={c.fgSubtle} /> : null}
    </Pressable>
  );
}
