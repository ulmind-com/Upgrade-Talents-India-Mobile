import React, { useState } from "react";
import { useAdmin, AAction, AButton, AGauge, AGrid, AKeyValues, ALoading, APanel, AStatTile, T } from "@/components/admin/ui";
import { View, ScrollView } from "react-native";
import { Eye, EyeOff, SlidersHorizontal, Gavel, Lock, RefreshCw, Trophy, Send, X, Users as UsersIcon, Star } from "lucide-react-native";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { competitionsApi, safe } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAlert } from "@/components/Popup";
import { rowId, titleCase } from "@/lib/format";

export default function AdminCompetitions() {
  const c = useAdmin();
  const [runner, setRunner] = useState<any | null>(null);
  return (
    <>
    <AdminCrud
      config={{
        title: "Competitions",
        singular: "Competition",
        subtitle: "Run competitions, judging and results.",
        load: () => competitionsApi.list({ limit: 100 }),
        create: (b) => competitionsApi.create(b),
        update: (id, b) => competitionsApi.update(id, b),
        remove: (id) => competitionsApi.remove(id),
        searchKeys: ["title", "category"],
        primary: (r) => r.title,
        secondary: (r) => r.category || r.description,
        badge: (r) => ({ label: r.is_published ? "Published" : "Draft", tone: r.is_published ? "success" : "neutral" }),
        meta: (r) => [
          { label: "Status", value: titleCase(r.status || r.state) || "—" },
          { label: "Max", value: String(r.max_participants ?? "—") },
        ],
        rowActions: (row, { reload }) => (
          <>
            <AButton
              label={row.is_published ? "Unpublish" : "Publish"}
              size="sm"
              variant={row.is_published ? "secondary" : "primary"}
              icon={row.is_published ? <EyeOff size={14} color={c.fg} /> : <Eye size={14} color={"#fff"} />}
              onPress={async () => { try { row.is_published ? await competitionsApi.unpublish(rowId(row)) : await competitionsApi.publish(rowId(row)); reload(); } catch {} }}
            />
            <AButton label="Run" size="sm" variant="ghost" icon={<SlidersHorizontal size={14} color={c.accent} />} onPress={() => setRunner(row)} />
          </>
        ),
        toBody: (v) => ({
          title: v.title, description: v.description || undefined, category: v.category || undefined,
          max_participants: v.max_participants === "" ? undefined : Number(v.max_participants),
          start_date: v.start_date || undefined, end_date: v.end_date || undefined,
          voting_enabled: !!v.voting_enabled, is_published: !!v.is_published,
        }),
        fields: [
          { name: "title", label: "Title", required: true },
          { name: "description", label: "Description", type: "textarea" },
          { name: "category", label: "Category", placeholder: "Solo / Group / Freestyle" },
          { name: "max_participants", label: "Max participants", type: "number" },
          { name: "start_date", label: "Starts", type: "datetime" },
          { name: "end_date", label: "Ends", type: "datetime" },
          { name: "voting_enabled", label: "Audience voting enabled", type: "toggle", defaultValue: true },
          { name: "is_published", label: "Published", type: "toggle", defaultValue: false },
        ],
      }}
    />
    {runner ? <RunnerSheet comp={runner} onClose={() => setRunner(null)} /> : null}
    </>
  );
}

/**
 * Judging, voting and result controls. The web admin shows these in a wide
 * modal beside the table; on a phone it takes the screen, with the workflow
 * in the order it actually happens.
 */
function RunnerSheet({ comp, onClose }: { comp: any; onClose: () => void }) {
  const c = useAdmin();
  const alert = useAlert();
  const id = rowId(comp);
  const [busy, setBusy] = useState<string | null>(null);

  const overview = useAsync(() => safe(competitionsApi.overview(id), null as any), [id]);
  const progress = useAsync(() => safe(competitionsApi.judgingProgress(id), null as any), [id]);

  const ov = overview.data || {};
  const pr = progress.data || {};
  const scored = Number(pr.scored ?? pr.completed ?? 0);
  const expected = Number(pr.expected ?? pr.total ?? 0);
  const pct = Number(pr.percent ?? pr.progress ?? (expected ? (scored / expected) * 100 : 0));

  const run = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key);
    try { await fn(); alert("success", "Done", ok); overview.reload(); progress.reload(); }
    catch (e: any) { alert("error", "Action failed", e?.message || "Please try again."); }
    finally { setBusy(null); }
  };

  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.bg }}>
      <View style={{ flex: 1, paddingTop: 54, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <T size={11} font="monoMed" color={c.brand} track={3} upper>Run competition</T>
            <T size={23} font="bold" track={-1} numberOfLines={2} style={{ marginTop: 4 }}>{comp.title || comp.name}</T>
          </View>
          <AButton label="" variant="secondary" icon={<X size={19} color={c.fg} />} onPress={onClose} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
          {overview.loading ? <ALoading rows={2} /> : (
            <>
              <AGrid>
                <AStatTile label="Entries" value={Number(ov.total_participants ?? ov.participants ?? 0)} Icon={UsersIcon} />
                <AStatTile label="Audience votes" value={Number(ov.total_votes ?? ov.votes ?? 0)} Icon={Star} tone={c.success} />
              </AGrid>

              {expected || pct ? (
                <APanel title="Judging progress">
                  <AGauge percent={pct} caption={expected ? `${scored} of ${expected} scorecards in` : "Scoring underway"} />
                </APanel>
              ) : null}

              <APanel title="State">
                <AKeyValues
                  items={[
                    { k: "Status", v: titleCase(ov.status || comp.status) || "—" },
                    { k: "Judging", v: ov.judging_locked ? "Locked" : ov.session_open ? "Session open" : "Closed" },
                    { k: "Audience voting", v: ov.voting_closed ? "Closed" : comp.voting_enabled ? "Open" : "Off" },
                    { k: "Results", v: ov.results_published ? "Published" : ov.results_approved ? "Approved" : "Not ready" },
                  ]}
                />
              </APanel>

              <APanel title="Workflow" subtitle="Each step in the order it happens. Later steps need the earlier ones.">
                <AAction label="Open judging session" cta="Open" Icon={Gavel} busy={busy === "open"}
                  onPress={() => run("open", () => competitionsApi.openSession(id), "Judging session opened.")} />
                <AAction label="Close judging session" cta="Close" Icon={Gavel} busy={busy === "close"}
                  onPress={() => run("close", () => competitionsApi.closeSession(id), "Judging session closed.")} />
                <AAction label="Close audience voting" hint="Voting cannot be reopened from here." cta="Close" tone="danger" Icon={Lock} busy={busy === "cv"}
                  onPress={() => run("cv", () => competitionsApi.closeVoting(id), "Audience voting closed.")} />
                <AAction label="Lock judging" hint="Judges can no longer change their scores." cta="Lock" tone="danger" Icon={Lock} busy={busy === "lock"}
                  onPress={() => run("lock", () => competitionsApi.lockJudging(id), "Judging locked.")} />
                <AAction label="Recalculate rankings" cta="Recalculate" Icon={RefreshCw} busy={busy === "recalc"}
                  onPress={() => run("recalc", () => competitionsApi.recalculate(id), "Rankings recalculated.")} />
                <AAction label="Start finalization" cta="Start" Icon={Trophy} busy={busy === "fin"}
                  onPress={() => run("fin", () => competitionsApi.startFinalization(id), "Finalization started.")} />
                <AAction label="Approve results" hint="Approved results become eligible for publishing." cta="Approve" tone="success" Icon={Trophy} busy={busy === "appr"}
                  onPress={() => run("appr", () => competitionsApi.approveResults(id), "Results approved.")} />
                <AAction label="Publish results" hint="Results go live on the public leaderboard." cta="Publish" tone="success" Icon={Send} busy={busy === "pub"}
                  onPress={() => run("pub", () => competitionsApi.publishResults(id), "Results published.")} />
              </APanel>
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
