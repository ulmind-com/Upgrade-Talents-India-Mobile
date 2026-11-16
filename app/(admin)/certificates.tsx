import React, { useMemo, useState } from "react";
import { View, TextInput } from "react-native";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Search, Award, Ban, Download, CheckCircle2, Trophy } from "lucide-react-native";
import { AdminShell } from "@/components/admin/Shell";
import { AAction, ACard, AEmpty, AGrid, AHatchBars, ALoading, APanel, AScope, AStatTile, ATabs, ATag, T } from "@/components/admin/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { certificatesApi, competitionsApi, safe, toRows, totalOf, tokenStore, getApiBase } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAlert } from "@/components/Popup";
import { formatEventDate, titleCase } from "@/lib/format";

type Tab = "issued" | "issue" | "insights";

export default function AdminCertificates() {
  const { c } = useTheme();
  const alert = useAlert();
  const [tab, setTab] = useState<Tab>("issued");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [comp, setComp] = useState<string | null>(null);

  const list = useAsync(() => safe(certificatesApi.list({ limit: 200 }), [] as any), []);
  const stats = useAsync(() => safe(certificatesApi.analytics(), null as any), []);
  const comps = useAsync(() => safe(competitionsApi.list({ limit: 100 }), [] as any), []);
  const eligible = useAsync(() => (comp ? safe(certificatesApi.eligibility(comp), null as any) : Promise.resolve(null)), [comp]);

  const rows = toRows(list.data);
  const total = totalOf(list.data, rows);
  const an = stats.data || {};
  const compRows = toRows(comps.data);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r: any) => [r.title, r.recipient_name, r.user_name, r.certificate_number].some((v) => String(v || "").toLowerCase().includes(s)));
  }, [rows, q]);

  const revoked = rows.filter((r: any) => r.status === "REVOKED").length;

  const breakdown: { label: string; value: number }[] = (() => {
    const src = an.by_type || an.by_competition || an.breakdown || an.by_status;
    if (Array.isArray(src)) return src.map((x: any) => ({ label: titleCase(x.name || x.label || x.type || "—"), value: Number(x.count ?? x.total ?? 0) }));
    if (src && typeof src === "object") return Object.entries(src).map(([k, v]) => ({ label: titleCase(k), value: Number(v) || 0 }));
    return [];
  })();

  const run = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key);
    try { await fn(); alert("success", "Done", ok); list.reload(); stats.reload(); eligible.reload(); }
    catch (e: any) { alert("error", "Action failed", e?.message || "Please try again."); }
    finally { setBusy(null); }
  };

  /* The download endpoint needs the admin token, so fetch it with auth and
     hand the saved file to the share sheet rather than opening a bare URL. */
  const download = async (id: string, name: string) => {
    setBusy(`dl${id}`);
    try {
      const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      if (!dir) throw new Error("No writable folder on this device.");
      const dest = `${dir}certificate-${String(name || id).replace(/[^a-zA-Z0-9-]/g, "")}.pdf`;
      const res = await FileSystem.downloadAsync(`${getApiBase()}/api/admin/certificates/${id}/download`, dest, {
        headers: { Authorization: `Bearer ${tokenStore.getAdmin() || ""}` },
      });
      if (res.status >= 400) throw new Error(`Server returned ${res.status}.`);
      if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing isn't available on this device.");
      const esc = dest.slice(0, dest.indexOf("://") + 3) + dest.slice(dest.indexOf("://") + 3).replace(/%/g, "%25");
      try { await Sharing.shareAsync(esc, { mimeType: "application/pdf", UTI: "com.adobe.pdf" }); }
      catch { await Sharing.shareAsync(dest, { mimeType: "application/pdf", UTI: "com.adobe.pdf" }); }
    } catch (e: any) {
      alert("error", "Couldn't download", e?.message || "Please try again.");
    } finally { setBusy(null); }
  };

  const el = eligible.data || {};
  const elRows = toRows(eligible.data);

  return (
    <AdminShell  title="Certificates" refreshing={list.refreshing} onRefresh={list.refresh}>
      <ATabs
        value={tab}
        onChange={setTab}
        tabs={[{ key: "issued", label: "Issued" }, { key: "issue", label: "Generate" }, { key: "insights", label: "Insights" }]}
      />

      {tab === "insights" ? (
        stats.loading ? <ALoading rows={2} /> : (
          <>
            <AGrid>
              <AStatTile label="Issued" value={Number(an.total ?? an.total_issued ?? total ?? rows.length)} Icon={Award} />
              <AStatTile label="Revoked" value={Number(an.revoked ?? revoked)} Icon={Ban} tone={c.danger} />
            </AGrid>
            {breakdown.length ? <APanel title="Breakdown"><AHatchBars data={breakdown} /></APanel> : null}
          </>
        )
      ) : tab === "issue" ? (
        <>
          <T size={13} mut lh={19} style={{ marginBottom: 12 }}>
            Pick a competition to see who qualifies, then issue every certificate in one go.
          </T>
          <AScope
            items={compRows.map((x: any) => ({ id: x._id || x.id, label: x.title || x.name || "Competition" }))}
            value={comp}
            onChange={setComp}
            placeholder="Choose one"
          />

          {!comp ? (
            <AEmpty icon={<Trophy size={26} color={c.fgMuted} />} title="No competition selected" subtitle="Choose one above to continue." />
          ) : eligible.loading ? (
            <ALoading rows={2} />
          ) : (
            <>
              <AGrid>
                <AStatTile label="Eligible" value={Number(el.eligible_count ?? el.total ?? elRows.length)} Icon={CheckCircle2} tone={c.success} />
                <AStatTile label="Already issued" value={Number(el.issued_count ?? el.issued ?? 0)} Icon={Award} />
              </AGrid>

              <APanel title="Issue certificates" subtitle="Generates for everyone who qualifies and has not been issued one yet.">
                <AAction
                  label="Generate now"
                  hint="Members are notified once their certificate is ready."
                  cta="Generate"
                  tone="success"
                  Icon={Award}
                  busy={busy === "gen"}
                  onPress={() => run("gen", () => certificatesApi.generate(comp), "Certificates generated.")}
                />
              </APanel>

              {elRows.length ? (
                <APanel title="Qualifying entries">
                  <View style={{ gap: 10 }}>
                    {elRows.slice(0, 30).map((r: any, i: number) => (
                      <View key={r._id || i} style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                        <T size={13} numberOfLines={1} style={{ flex: 1 }}>{r.participant_name || r.user_name || r.name || r.email || "Participant"}</T>
                        <T size={12.5} mut>{r.rank ? `#${r.rank}` : r.position || ""}</T>
                      </View>
                    ))}
                  </View>
                </APanel>
              ) : null}
            </>
          )}
        </>
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.bgElevated, borderRadius: 14, borderWidth: 1, borderColor: c.borderStrong, paddingHorizontal: 14, height: 46, marginBottom: 16 }}>
            <Search size={17} color={c.fgSubtle} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search recipient or number" placeholderTextColor={c.fgSubtle} style={{ flex: 1, color: c.fg, fontSize: 14.5 }} />
          </View>

          {list.loading ? (
            <ALoading />
          ) : !filtered.length ? (
            <AEmpty icon={<Award size={26} color={c.fgMuted} />} title="No certificates yet" subtitle="Generate them from the Generate tab." />
          ) : (
            <View style={{ gap: 12 }}>
              {filtered.map((r: any, i: number) => {
                const id = r._id || r.id;
                const isRevoked = r.status === "REVOKED";
                return (
                  <ACard key={id || i}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <T size={15} font="bold" numberOfLines={1}>{r.title || r.competition_title || r.certificate_number || "Certificate"}</T>
                        <T size={12.5} mut numberOfLines={1} style={{ marginTop: 2 }}>{r.recipient_name || r.user_name || r.certificate_number}</T>
                      </View>
                      <ATag label={titleCase(r.status) || "Issued"} tone={isRevoked ? "danger" : "success"} />
                    </View>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 10 }}>
                      <View>
                        <T size={10} font="monoMed" sub track={1.5} upper>Issued</T>
                        <T size={13} font="semi" style={{ marginTop: 1 }}>{formatEventDate(r.issued_at || r.created_at)}</T>
                      </View>
                      {r.certificate_number ? (
                        <View>
                          <T size={10} font="monoMed" sub track={1.5} upper>Number</T>
                          <T size={13} font="semi" style={{ marginTop: 1 }}>{r.certificate_number}</T>
                        </View>
                      ) : null}
                    </View>

                    {id ? (
                      <AAction
                        label="Download PDF"
                        hint="Opens the share sheet with the certificate."
                        cta="Download"
                        Icon={Download}
                        busy={busy === `dl${id}`}
                        onPress={() => download(id, r.certificate_number || r.recipient_name)}
                      />
                    ) : null}
                    {!isRevoked && id ? (
                      <AAction
                        label="Revoke"
                        hint="Marks the certificate invalid on the public verifier."
                        cta="Revoke"
                        tone="danger"
                        Icon={Ban}
                        busy={busy === id}
                        onPress={() => run(id, () => certificatesApi.revoke(id), "Certificate revoked.")}
                      />
                    ) : null}
                  </ACard>
                );
              })}
            </View>
          )}
        </>
      )}
    </AdminShell>
  );
}
