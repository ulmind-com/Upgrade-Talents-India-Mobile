import React, { useEffect, useState } from "react";
import { View, Pressable } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, Save, User as UserIcon, Phone, MapPin, CalendarDays, Mail, Lock } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { profileApi, safe, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAlert } from "@/components/Popup";
import { Txt, Button, Card, Field, Input, Skeleton, EmptyState } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { FadeInUp } from "@/components/FadeInUp";
import { toDateInput } from "@/lib/format";

// The backend sometimes returns phone numbers as numbers, so coerce before
// touching string methods.
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

/** The website's "edit profile" form, as its own screen. */
export default function ProfileEdit() {
  const { c } = useTheme();
  const { user, refreshUser } = useSession();
  const alert = useAlert();

  const q = useAsync(() => (user ? safe(profileApi.get(), null as any) : Promise.resolve(null)), [user?.email]);
  const me = q.data || user || {};

  const [form, setForm] = useState({ name: "", phone: "", dob: "", address: "", parentPhone: "" });
  const [photo, setPhoto] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!q.data && !user) return;
    setForm({
      name: me.name || "",
      phone: digits(me.phone_number || ""),
      dob: toDateInput(me.date_of_birth) || "",
      address: me.address || "",
      parentPhone: digits(me.parent_phone_number || ""),
    });
  }, [q.data, user?.email]);

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return alert("warning", "Permission needed", "Allow photo access to change your picture.");
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    setPhoto({ uri: a.uri, name: a.fileName || "profile.jpg", type: a.mimeType || "image/jpeg" });
  };

  const save = async () => {
    if (!form.name.trim()) return alert("warning", "Name needed", "Your name cannot be empty.");
    if (form.phone && form.phone.length !== 10) return alert("warning", "Check the number", "A mobile number is 10 digits.");
    setBusy(true);
    try {
      // Multipart, because the photo rides along with the rest of the form.
      const fd = new FormData();
      if (form.name.trim()) fd.append("name", form.name.trim());
      if (form.phone.trim()) fd.append("phone_number", form.phone.trim());
      if (form.dob) fd.append("date_of_birth", form.dob);
      if (form.address.trim()) fd.append("address", form.address.trim());
      if (form.parentPhone.trim()) fd.append("parent_phone_number", form.parentPhone.trim());
      if (photo) fd.append("profile_photo", { uri: photo.uri, name: photo.name, type: photo.type } as any);

      await profileApi.updateForm(fd);
      await refreshUser();
      q.reload();
      setPhoto(null);
      alert("success", "Saved", "Your profile is up to date.");
    } catch (e) {
      alert("error", "Couldn't save", e instanceof ApiError ? e.message : "Please try again.");
    } finally { setBusy(false); }
  };

  if (!user) {
    return (
      <SubScreen eyebrow="Account" title="Edit profile">
        <EmptyState icon={<UserIcon size={26} color={c.fgMuted} />} title="Sign in first" subtitle="Your profile lives with your account." />
      </SubScreen>
    );
  }

  return (
    <SubScreen eyebrow="Account" title="Edit profile" refreshing={q.refreshing} onRefresh={q.refresh}>
      {q.loading ? (
        <View style={{ gap: 14 }}>{[0, 1].map((i) => <Skeleton key={i} h={140} radius={20} />)}</View>
      ) : (
        <>
          {/* Photo */}
          <FadeInUp>
            <View style={{ alignItems: "center", marginBottom: 22 }}>
              <Pressable onPress={pick} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
                <Avatar
                  name={me.name || me.email}
                  photo={photo?.uri || me.profile_photo}
                  size={104}
                  fontSize={34}
                  gradient={false}
                  textColor={c.accent}
                  border={{ width: 2, color: c.accent + "55" }}
                />
                <View style={{ position: "absolute", right: -2, bottom: -2, width: 34, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.accent, borderWidth: 3, borderColor: c.bg }}>
                  <Camera size={15} color={c.onAccent} />
                </View>
              </Pressable>
              <Txt size={12.5} tone="subtle" style={{ marginTop: 10 }}>Tap to change your photo</Txt>
            </View>
          </FadeInUp>

          <FadeInUp delay={60}>
            <Card style={{ gap: 2 }}>
              {/* Email is the account key — shown, never editable */}
              <Field label="Email address" hint="Your sign-in address cannot be changed here.">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 52, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, paddingHorizontal: 14 }}>
                  <Mail size={16} color={c.fgSubtle} />
                  <Txt size={14.5} tone="muted" numberOfLines={1} style={{ flex: 1 }}>{me.email}</Txt>
                  <Lock size={14} color={c.fgSubtle} />
                </View>
              </Field>

              <Field label="Full name" required>
                <Input value={form.name} onChangeText={(v) => setForm((s) => ({ ...s, name: v }))} placeholder="Your name" />
              </Field>

              <Field label="Mobile number" hint="10 digits, without the country code.">
                <Input value={form.phone} onChangeText={(v) => setForm((s) => ({ ...s, phone: digits(v).slice(0, 10) }))} placeholder="9876543210" keyboardType="number-pad" />
              </Field>

              <Field label="Date of birth" hint="YYYY-MM-DD">
                <Input value={form.dob} onChangeText={(v) => setForm((s) => ({ ...s, dob: v }))} placeholder="2000-01-31" />
              </Field>

              <Field label="Residential address">
                <Input value={form.address} onChangeText={(v) => setForm((s) => ({ ...s, address: v }))} placeholder="Street, city, PIN" multiline style={{ minHeight: 88, textAlignVertical: "top", paddingTop: 12 }} />
              </Field>

              <Field label="Parent / emergency contact" hint="Used only if we need to reach someone during an event.">
                <Input value={form.parentPhone} onChangeText={(v) => setForm((s) => ({ ...s, parentPhone: digits(v).slice(0, 10) }))} placeholder="9876543210" keyboardType="number-pad" />
              </Field>

              <Button label="Save changes" full size="lg" loading={busy} onPress={save} icon={<Save size={17} color={c.onAccent} />} />
            </Card>
          </FadeInUp>
        </>
      )}
    </SubScreen>
  );
}
