import React, { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ArrowRight, UploadCloud, Check, UserRound, Phone, MapPin, Users, ShieldCheck, LogOut } from "lucide-react-native";
import { AuthShell } from "@/components/AuthShell";
import { Button, Field, Input, Txt } from "@/components/ui";
import { DobPicker } from "@/components/DobPicker";
import { Avatar } from "@/components/Avatar";
import { useAlert } from "@/components/Popup";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { ApiError, authApi } from "@/lib/api";

type Asset = { uri: string; name: string; type: string };
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

/**
 * The mandatory onboarding wizard. Shown to any signed-in member still missing
 * phone / date of birth / address / guardian phone — chiefly Google sign-ins,
 * who skip the in-app register steps that already collect these.
 */
export default function CompleteProfile() {
  const { c } = useTheme();
  const router = useRouter();
  const alert = useAlert();
  const { user, refreshUser, logoutUser } = useSession();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone_number ? String(user.phone_number) : "");
  const [dob, setDob] = useState(user?.date_of_birth ? String(user.date_of_birth).slice(0, 10) : "");
  const [address, setAddress] = useState(user?.address || "");
  const [parentPhone, setParentPhone] = useState(user?.parent_phone_number ? String(user.parent_phone_number) : "");
  const [photo, setPhoto] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});

  const existingPhoto = user?.profile_photo;

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!res.canceled && res.assets?.[0]) {
      const a = res.assets[0];
      setPhoto({ uri: a.uri, name: a.fileName || a.uri.split("/").pop() || "photo.jpg", type: a.mimeType || "image/jpeg" });
    }
  };

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Enter your full name.";
    if (digits(phone).length < 10) e.phone = "Enter a valid 10-digit mobile number.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) e.dob = "Use the format YYYY-MM-DD.";
    if (!address.trim()) e.address = "Enter your residential address.";
    if (digits(parentPhone).length < 10) e.parentPhone = "Enter a valid 10-digit guardian number.";
    setErr(e);
    if (Object.keys(e).length) { alert("error", "Almost there", "Please fill the highlighted fields."); return; }

    setLoading(true);
    try {
      if (photo) {
        const fd = new FormData();
        fd.append("name", name.trim());
        fd.append("phone_number", digits(phone));
        fd.append("date_of_birth", dob);
        fd.append("address", address.trim());
        fd.append("parent_phone_number", digits(parentPhone));
        fd.append("profile_photo", { uri: photo.uri, name: photo.name, type: photo.type } as any);
        await authApi.completeProfileForm(fd);
      } else {
        await authApi.completeProfile({
          name: name.trim(),
          phone_number: digits(phone),
          date_of_birth: dob,
          address: address.trim(),
          parent_phone_number: digits(parentPhone),
        });
      }
      await refreshUser();
      alert("success", "You're all set", "Welcome aboard!");
      if (router.canGoBack()) router.back();
      else router.replace("/(user)");
    } catch (ex) {
      alert("error", "Couldn't save", ex instanceof ApiError ? ex.message : "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await logoutUser();
    router.replace("/(auth)/login");
  };

  return (
    <AuthShell eyebrow="One last step" title="Complete your profile" subtitle="A few mandatory details before you can book and compete." seed={3}>
      <View style={{ gap: 18 }}>
        {/* photo */}
        <View style={{ alignItems: "center", gap: 10 }}>
          <Pressable onPress={pick} style={{ position: "relative" }}>
            <Avatar name={name || user?.name} photo={photo?.uri || existingPhoto} size={92} />
            <View style={{ position: "absolute", right: -2, bottom: -2, width: 32, height: 32, borderRadius: 999, backgroundColor: c.accent, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: c.bg }}>
              <UploadCloud size={15} color={c.onAccent} />
            </View>
          </Pressable>
          <Txt size={11.5} tone="subtle">{photo ? "Photo selected" : "Tap to add a photo (optional)"}</Txt>
        </View>

        <Field label="Full name" error={err.name} required>
          <View>
            <Input value={name} onChangeText={setName} placeholder="Your name" invalid={!!err.name} style={{ paddingLeft: 44 }} />
            <LeftIcon><UserRound size={17} color={c.fgSubtle} /></LeftIcon>
          </View>
        </Field>

        <Field label="Mobile number" error={err.phone} required>
          <View>
            <Input value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="10-digit mobile" invalid={!!err.phone} style={{ paddingLeft: 44 }} />
            <LeftIcon><Phone size={16} color={c.fgSubtle} /></LeftIcon>
          </View>
        </Field>

        <Field label="Date of birth" error={err.dob} required>
          <DobPicker value={dob} onChange={setDob} invalid={!!err.dob} />
        </Field>

        <Field label="Residential address" error={err.address} required>
          <View>
            <Input value={address} onChangeText={setAddress} placeholder="City, state, pincode" invalid={!!err.address} style={{ paddingLeft: 44 }} />
            <LeftIcon><MapPin size={16} color={c.fgSubtle} /></LeftIcon>
          </View>
        </Field>

        <Field label="Parent / guardian number" error={err.parentPhone} required>
          <View>
            <Input value={parentPhone} onChangeText={setParentPhone} keyboardType="phone-pad" placeholder="10-digit mobile" invalid={!!err.parentPhone} style={{ paddingLeft: 44 }} />
            <LeftIcon><Users size={16} color={c.fgSubtle} /></LeftIcon>
          </View>
        </Field>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 14, backgroundColor: c.surface2, padding: 12 }}>
          <ShieldCheck size={15} color={c.accent} />
          <Txt size={11.5} tone="muted" lh={16} style={{ flex: 1 }}>Your details stay private and are used only for bookings, tickets and certificates.</Txt>
        </View>

        <Button label="Save & continue" onPress={submit} loading={loading} size="lg" full iconRight={<ArrowRight size={18} color={c.onAccent} />} />

        <Pressable onPress={signOut} style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }} hitSlop={8}>
          <LogOut size={14} color={c.fgSubtle} />
          <Txt size={13} tone="subtle">Sign out instead</Txt>
        </Pressable>
      </View>
    </AuthShell>
  );
}

function LeftIcon({ children }: { children: React.ReactNode }) {
  return <View style={{ position: "absolute", left: 14, top: 0, bottom: 0, justifyContent: "center" }}>{children}</View>;
}
