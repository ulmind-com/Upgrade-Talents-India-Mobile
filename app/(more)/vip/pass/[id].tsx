import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Image } from "expo-image";
import QRCode from "react-native-qrcode-svg";
import { Crown, Check, CalendarRange, DoorOpen, ShieldOff } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { Txt, Skeleton, EmptyState } from "@/components/ui";
import { Chip } from "@/components/vip/VipCard";
import { userVipApi, safe } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatEventDate } from "@/lib/format";
import { areaLabel, entryPolicyLabel, passTone, VIP_GOLD, MUTED, BAD } from "@/lib/vip";

const W = Dimensions.get("window").width;
const SURFACE = "#11131A";
const HAIR = "rgba(255,255,255,0.08)";

const when = (iso?: string | null) =>
  iso ? `${formatEventDate(iso)} · ${new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : null;

/**
 * One VIP pass, ready for the gate: the secure QR (`/qr`) front and centre,
 * then where it gets you in, when it's valid, and how many entries are used.
 */
export default function VipPassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useAsync(async () => {
    const [pass, qr] = await Promise.all([userVipApi.myPass(String(id)), safe(userVipApi.passQr(String(id)), null)]);
    return { pass, qr };
  }, [id]);

  const p = q.data?.pass;
  const qr = q.data?.qr;
  const t = p ? passTone(p) : null;
  const img = qr?.qr_image_base64 || p?.qr_image_base64;
  const token = qr?.qr_token || p?.qr_token;
  const imgUri = img ? (img.startsWith("data:") ? img : `data:image/png;base64,${img}`) : null;
  const areas = qr?.access_areas || p?.access_areas || [];
  const qrSize = Math.min(240, W - 120);

  return (
    <SubScreen eyebrow="VIP pass" title={p?.pass_name || (q.loading ? "Loading…" : "VIP pass")} refreshing={q.refreshing} onRefresh={q.refresh}>
      {q.loading ? (
        <View style={{ gap: 12 }}>
          <Skeleton h={qrSize + 120} radius={24} />
          <Skeleton h={160} radius={20} />
        </View>
      ) : !p || !t ? (
        <EmptyState icon={<Crown size={26} color={MUTED} />} title="Pass not found" subtitle={q.error || "It may have been cancelled."} />
      ) : (
        <View style={{ gap: 16 }}>
          {/* the gate card */}
          <View style={[s.ticket, !t.usable && { borderColor: HAIR }]}>
            <View style={s.ticketHead}>
              <View style={{ flex: 1 }}>
                <Txt size={11} font="sansExt" tracking={1.4} style={{ color: VIP_GOLD }}>{String(p.category || "VIP").toUpperCase()}</Txt>
                <Txt size={13} numberOfLines={1} style={{ color: MUTED, marginTop: 2 }}>{p.event_title}</Txt>
              </View>
              <Chip label={t.label} color={t.color} />
            </View>

            <View style={s.qrWrap}>
              {t.usable && (imgUri || token) ? (
                <View style={s.qrBox}>
                  {imgUri ? (
                    <Image source={{ uri: imgUri }} style={{ width: qrSize, height: qrSize }} contentFit="contain" />
                  ) : (
                    <QRCode value={String(token)} size={qrSize} backgroundColor="#fff" color="#0B0B0E" />
                  )}
                </View>
              ) : (
                <View style={[s.qrBox, s.qrOff, { width: qrSize + 24, height: qrSize + 24 }]}>
                  <ShieldOff size={30} color={MUTED} />
                  <Txt size={13} font="sansSemi" style={{ color: MUTED, marginTop: 8, textAlign: "center" }}>
                    {t.label === "Revoked" ? "This pass was revoked" : `This pass is ${t.label.toLowerCase()}`}
                  </Txt>
                </View>
              )}
              <Txt size={12.5} font="sansBold" tracking={2} style={{ color: "#fff", marginTop: 14 }}>{p.pass_reference}</Txt>
              {t.usable ? <Txt size={11.5} style={{ color: MUTED, marginTop: 4 }}>Show this at the gate · brightness up</Txt> : null}
            </View>

            <View style={s.perf}>
              <View style={[s.notch, { left: -10 }]} />
              <View style={s.dash} />
              <View style={[s.notch, { right: -10 }]} />
            </View>

            <View style={s.holder}>
              <Txt size={11} font="sansBold" tracking={1.4} style={{ color: MUTED }}>PASS HOLDER</Txt>
              <Txt size={20} font="display" style={{ color: "#fff", marginTop: 4 }}>{p.holder_name}</Txt>
            </View>
          </View>

          {p.revocation_reason ? (
            <View style={s.revoked}>
              <Txt size={12.5} lh={18} style={{ color: "#FFB3C0" }}>
                <Txt size={12.5} font="sansBold" style={{ color: BAD }}>Revoked{p.revoked_at ? ` ${formatEventDate(p.revoked_at)}` : ""}. </Txt>
                {p.revocation_reason}
              </Txt>
            </View>
          ) : null}

          {/* where it gets you in */}
          {areas.length ? (
            <View style={s.card}>
              <Txt size={11} font="sansBold" tracking={1.4} style={{ color: MUTED, marginBottom: 10 }}>ACCESS</Txt>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {areas.map((a) => (
                  <View key={a} style={s.area}>
                    <Check size={12} color={VIP_GOLD} strokeWidth={3} />
                    <Txt size={12.5} font="sansSemi" style={{ color: "#E2E8F0" }}>{areaLabel(a)}</Txt>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* validity + entries */}
          <View style={[s.card, { gap: 12 }]}>
            {p.validity_start || p.validity_end ? (
              <Row icon={<CalendarRange size={16} color={MUTED} />} label="Valid" value={[when(p.validity_start), when(p.validity_end)].filter(Boolean).join("\nto ")} />
            ) : null}
            <Row
              icon={<DoorOpen size={16} color={MUTED} />}
              label="Entry"
              value={`${entryPolicyLabel(p.entry_policy, p.max_entries)}${
                p.entries_count != null ? ` · ${p.entries_count}${p.max_entries ? ` of ${p.max_entries}` : ""} used` : ""
              }`}
            />
            {p.last_entry_at ? <Row icon={<DoorOpen size={16} color={MUTED} />} label="Last in" value={when(p.last_entry_at)!} /> : null}
          </View>

          {/* references */}
          <View style={[s.card, { gap: 10 }]}>
            <Ref label="Pass" value={p.pass_reference} />
            {p.booking_reference ? <Ref label="Booking" value={p.booking_reference} /> : null}
            <Ref label="Issued" value={formatEventDate(p.issued_at)} />
          </View>
        </View>
      )}
    </SubScreen>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      <View style={{ marginTop: 1 }}>{icon}</View>
      <Txt size={13} style={{ color: MUTED, width: 56 }}>{label}</Txt>
      <Txt size={13.5} font="sansSemi" lh={19} style={{ color: "#fff", flex: 1 }}>{value}</Txt>
    </View>
  );
}

function Ref({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Txt size={12.5} style={{ color: MUTED }}>{label}</Txt>
      <Txt size={12.5} font="sansBold" style={{ color: "#fff", flexShrink: 1, textAlign: "right" }}>{value}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  ticket: { borderRadius: 24, backgroundColor: SURFACE, borderWidth: 1, borderColor: "rgba(245,197,66,0.28)", overflow: "hidden" },
  ticketHead: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  qrWrap: { alignItems: "center", paddingBottom: 18 },
  qrBox: { padding: 12, borderRadius: 18, backgroundColor: "#fff" },
  qrOff: { backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: HAIR },
  perf: { height: 20, justifyContent: "center" },
  notch: { position: "absolute", width: 20, height: 20, borderRadius: 999, backgroundColor: "#08090C", borderWidth: 1, borderColor: "rgba(245,197,66,0.28)" },
  dash: { marginHorizontal: 18, borderTopWidth: 1, borderStyle: "dashed", borderColor: HAIR },
  holder: { padding: 16, paddingTop: 8 },
  revoked: { padding: 12, borderRadius: 14, backgroundColor: "rgba(255,56,92,0.1)", borderWidth: 1, borderColor: "rgba(255,56,92,0.3)" },
  card: { padding: 16, borderRadius: 20, backgroundColor: SURFACE, borderWidth: 1, borderColor: HAIR },
  area: { flexDirection: "row", alignItems: "center", gap: 6, height: 30, paddingHorizontal: 11, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.05)" },
});
