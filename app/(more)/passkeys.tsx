import React, { useState } from "react";
import { View, Alert as RNAlert } from "react-native";
import { KeyRound, Trash2, ShieldCheck, Globe, Fingerprint, Plus } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt, Card, Button, Skeleton, EmptyState, ErrorState, Badge } from "@/components/ui";
import { passkeyApi, safe, type PasskeyCredential } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAlert } from "@/components/Popup";
import { formatDateTime } from "@/lib/format";
import { registerPasskey, passkeyAvailable, PasskeyUnavailable } from "@/lib/passkey";

const credId = (c: PasskeyCredential) => c.id || c.credential_id || c._id || "";
const credName = (c: PasskeyCredential) => c.name || c.device_name || c.device || "Passkey";

export default function Passkeys() {
  const { c } = useTheme();
  const alert = useAlert();
  const { data, loading, error, refresh } = useAsync(() => safe(passkeyApi.listCredentials(), [] as PasskeyCredential[]), []);
  const items = Array.isArray(data) ? data : [];
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const canAdd = passkeyAvailable();

  const addPasskey = async () => {
    setAdding(true);
    try {
      await registerPasskey();
      alert("success", "Passkey added", "You can now sign in with Face ID or your fingerprint.");
      refresh();
    } catch (e: any) {
      if (e instanceof PasskeyUnavailable) alert("info", "Passkeys coming soon", e.message);
      else alert("error", "Couldn't add passkey", e?.message || "Try again in a moment.");
    } finally {
      setAdding(false);
    }
  };

  const remove = (cred: PasskeyCredential) => {
    const id = credId(cred);
    if (!id) return;
    RNAlert.alert(
      "Remove this passkey?",
      `${credName(cred)} will no longer sign you in. This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setBusyId(id);
            try {
              await passkeyApi.deleteCredential(id);
              alert("success", "Passkey removed", `${credName(cred)} was revoked.`);
              refresh();
            } catch (e: any) {
              alert("error", "Couldn't remove", e?.message || "Try again in a moment.");
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <SubScreen eyebrow="Security" title="Passkeys">
      <View style={{ gap: 18 }}>
        {/* intro */}
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 10 }}>
            <View style={{ width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2 }}>
              <Fingerprint size={20} color={c.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={15} font="sansBold">Sign in without a password</Txt>
              <Txt size={12.5} tone="muted" style={{ marginTop: 2 }}>Face ID, fingerprint or device PIN — nothing to remember.</Txt>
            </View>
          </View>
          {canAdd ? (
            <Button label="Add a passkey" full icon={<Plus size={17} color={c.onAccent} />} loading={adding} onPress={addPasskey} style={{ marginTop: 6 }} />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
              <Globe size={14} color={c.fgSubtle} />
              <Txt size={12.5} tone="subtle" style={{ flex: 1 }}>
                Create a passkey on the Upgrade Talents website, then manage your devices here.
              </Txt>
            </View>
          )}
        </Card>

        {/* your passkeys */}
        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Txt size={13} font="monoMed" tone="subtle" tracking={2} uppercase>Your passkeys</Txt>
            {items.length ? <Badge label={`${items.length}`} tone="brand" /> : null}
          </View>

          {loading ? (
            <View style={{ gap: 12 }}>
              {[0, 1].map((i) => <Skeleton key={i} h={72} radius={20} />)}
            </View>
          ) : error ? (
            <ErrorState message={error} onRetry={refresh} />
          ) : !items.length ? (
            <EmptyState
              icon={<KeyRound size={26} color={c.fgMuted} />}
              title="No passkeys yet"
              subtitle="Set one up on the website to sign in instantly on this device."
            />
          ) : (
            items.map((cred, i) => {
              const id = credId(cred);
              const created = formatDateTime(cred.created_at);
              const used = formatDateTime(cred.last_used_at);
              return (
                <Card key={id || i} padding={14}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }}>
                      <KeyRound size={19} color={c.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt size={14.5} font="sansBold" numberOfLines={1}>{credName(cred)}</Txt>
                      <Txt size={12} tone="subtle" style={{ marginTop: 2 }}>
                        {used ? `Last used ${used}` : created ? `Added ${created}` : "Registered passkey"}
                      </Txt>
                    </View>
                    <Button
                      label="Remove"
                      variant="outline"
                      size="sm"
                      loading={busyId === id}
                      onPress={() => remove(cred)}
                      icon={<Trash2 size={15} color={c.danger} />}
                    />
                  </View>
                </Card>
              );
            })
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
          <ShieldCheck size={14} color={c.success} />
          <Txt size={12} tone="subtle" style={{ flex: 1 }}>Passkeys are phishing-resistant and never leave your device.</Txt>
        </View>
      </View>
    </SubScreen>
  );
}
