import React, { useState } from "react";
import { View, Linking, Pressable, TextInput } from "react-native";
import { Mail, Phone, MapPin, ChevronRight, Send, ShieldCheck, FileText } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import * as Haptics from "expo-haptics";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { publicApi, safe } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Card, Divider, Skeleton, Button, Field, Input } from "@/components/ui";
import { useAlert } from "@/components/Popup";
import { useSession } from "@/context/Session";
import { InstagramCard } from "@/components/InstagramCard";

export default function Contact() {
  const { c } = useTheme();
  const alert = useAlert();
  const { user } = useSession();
  const { data, loading, refreshing, refresh } = useAsync(
    () => safe(publicApi.contactInfo(), {} as any),
    []
  );
  const contact = data || {};
  const open = (url?: string) => url && Linking.openURL(url).catch(() => {});

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const sendMessage = () => {
    if (!name.trim()) { alert("warning", "Name required", "Please tell us your name."); return; }
    if (!email.trim() || !email.includes("@")) { alert("warning", "Valid email required", "Please enter a valid email address."); return; }
    if (message.trim().length < 10) { alert("warning", "Message too short", "Please provide a few more details (at least 10 characters)."); return; }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const targetEmail = contact?.contact_email || "support@upgradetalents.com";
    const subj = encodeURIComponent(subject.trim() || `Enquiry from ${name.trim()}`);
    const body = encodeURIComponent(`${message.trim()}\n\n—\nName: ${name.trim()}\nEmail: ${email.trim()}`);

    Linking.openURL(`mailto:${targetEmail}?subject=${subj}&body=${body}`).catch(() => {
      alert("error", "Email client error", "Could not open your default email app.");
    });
    alert("success", "Email draft ready", "Your email app is open with the prefilled message.");
  };

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

          {/* Instagram 3D Community Card (District Style) */}
          <InstagramCard />

          {/* Send a message form */}
          <Card style={{ padding: 18, gap: 14 }}>
            <View>
              <Txt size={11} font="monoMed" tone="accent" tracking={2} uppercase>
                Direct Message
              </Txt>
              <Txt size={20} font="sansBold" style={{ color: "#ffffff", marginTop: 2 }}>
                Send us a message
              </Txt>
            </View>

            <Field label="Your name" required>
              <Input value={name} onChangeText={setName} placeholder="Full name" />
            </Field>

            <Field label="Your email" required>
              <Input value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" />
            </Field>

            <Field label="Subject">
              <Input value={subject} onChangeText={setSubject} placeholder="What is this regarding?" />
            </Field>

            <Field label="Message" required>
              <TextInput
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={4}
                placeholder="Tell us a little about your enquiry…"
                placeholderTextColor={c.fgSubtle}
                style={{
                  backgroundColor: "#0d0f15",
                  color: "#ffffff",
                  fontSize: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.1)",
                  padding: 12,
                  minHeight: 90,
                  textAlignVertical: "top",
                }}
              />
            </Field>

            <Button
              label="Send message"
              onPress={sendMessage}
              icon={<Send size={16} color="#ffffff" />}
              full
            />
          </Card>

          {/* Legal — opens in an in-app browser sheet */}
          <View>
            <Txt size={13} font="monoMed" tone="subtle" tracking={2} uppercase style={{ marginBottom: 10 }}>Legal</Txt>
            <Card padding={0}>
              {LEGAL.map((l, i) => (
                <View key={l.url}>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      WebBrowser.openBrowserAsync(l.url, { toolbarColor: "#08090C", controlsColor: "#FF385C" }).catch(() => { open(l.url); });
                    }}
                    accessibilityRole="link"
                    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 15, opacity: pressed ? 0.7 : 1 })}
                  >
                    {l.icon === "privacy" ? <ShieldCheck size={17} color={c.fgMuted} /> : <FileText size={17} color={c.fgMuted} />}
                    <Txt size={14.5} font="sansMed" style={{ flex: 1 }}>{l.title}</Txt>
                    <ChevronRight size={17} color={c.fgSubtle} />
                  </Pressable>
                  {i < LEGAL.length - 1 ? <Divider style={{ marginLeft: 44 }} /> : null}
                </View>
              ))}
            </Card>
          </View>
        </View>
      )}
    </SubScreen>
  );
}

const LEGAL = [
  { title: "Privacy Policy", url: "https://www.upgradetalentsindia.in/privacy-policy", icon: "privacy" },
  { title: "Terms & Conditions", url: "https://upgrade-talents-india-frontend.vercel.app/terms-and-conditions", icon: "terms" },
] as const;

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
