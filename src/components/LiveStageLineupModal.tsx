import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Modal, Pressable, ScrollView, TextInput, Dimensions, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Users, Search, MapPin, Clock, Check, LocateFixed } from "lucide-react-native";
import { useSession } from "@/context/Session";
import { publicCompetitionsApi, type LiveStageData, type FinalLineup, type StagePerformer } from "@/lib/api";
import { Txt, EmptyState } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { VerifiedTick } from "@/components/VerifiedBadge";
import { Pulse } from "@/components/motion";
import { playNavFeedback } from "@/lib/sound";

const { height: SCREEN_H } = Dimensions.get("window");
const SPOT = "#FF385C";
const OK = "#22C55E";
const WAIT = "#F5B544";
const MUTED = "#8E93A8";

type Tab = "ALL" | "PRESENT" | "WAITING" | "DONE";

const email = (s: any) => String(s ?? "").toLowerCase().trim();
const nameOf = (p: StagePerformer) => p.participant_name || p.user_name || "Contestant";
const present = (p: StagePerformer) => !!(p.is_present || p.attendance_status === "PRESENT");
const catOf = (p: StagePerformer) => p.category || p.division || "";

/**
 * The whole running order as a sheet. Fed by the live-stage payload while the
 * show runs, or by the final (checked-in) lineup before it starts; given only a
 * competition id it fetches the live stage itself.
 */
export function LiveStageLineupModal({
  visible,
  stageData,
  finalData,
  competitionId,
  competitionTitle,
  compTitle,
  onClose,
}: {
  visible: boolean;
  stageData?: LiveStageData | null;
  finalData?: FinalLineup | null;
  competitionId?: string;
  competitionTitle?: string;
  compTitle?: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("ALL");
  const [tab, setTab] = useState<Tab>("ALL");
  const [fetched, setFetched] = useState<LiveStageData | null>(null);
  const scrollRef = useRef<any>(null);
  const myY = useRef(0);

  useEffect(() => {
    if (!visible || !competitionId || stageData || finalData) return;
    let cancelled = false;
    publicCompetitionsApi
      .liveStage(competitionId)
      .then((res) => !cancelled && res && setFetched(res))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, competitionId, stageData, finalData]);

  const stage = stageData || fetched;
  const lineup: StagePerformer[] = stage?.lineup?.length ? stage.lineup : finalData?.final_participants ?? [];
  const title = compTitle || competitionTitle || stage?.competition_title || finalData?.competition_title || "Live stage";
  const venue = stage?.venue || finalData?.venue;
  const curEmail = email(stage?.has_active_performer ? stage?.current_performer?.user_email : "");

  const categories = useMemo(() => {
    const set = new Set<string>(stage?.categories ?? []);
    lineup.forEach((p) => catOf(p) && set.add(catOf(p)));
    return ["ALL", ...Array.from(set)];
  }, [lineup, stage?.categories]);

  const counts = useMemo(
    () => ({
      ALL: lineup.length,
      PRESENT: lineup.filter((p) => present(p) && p.stage_status !== "COMPLETED").length,
      WAITING: lineup.filter((p) => !present(p)).length,
      DONE: lineup.filter((p) => p.stage_status === "COMPLETED").length,
    }),
    [lineup]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return lineup.filter((p) => {
      if (cat !== "ALL" && catOf(p) !== cat) return false;
      if (tab === "PRESENT" && (!present(p) || p.stage_status === "COMPLETED")) return false;
      if (tab === "WAITING" && present(p)) return false;
      if (tab === "DONE" && p.stage_status !== "COMPLETED") return false;
      if (q && !nameOf(p).toLowerCase().includes(q) && !String(p.registration_reference || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [lineup, cat, tab, search]);

  const me = user?.email ? email(user.email) : "";
  const inLineup = !!me && lineup.some((p) => email(p.user_email) === me);

  const jumpToMe = () => {
    playNavFeedback();
    setCat("ALL");
    setTab("ALL");
    setSearch("");
    setTimeout(() => scrollRef.current?.scrollTo({ y: Math.max(0, myY.current - 80), animated: true }), 120);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "ALL", label: "All" },
    { key: "PRESENT", label: "Checked in" },
    { key: "WAITING", label: "Waiting" },
    { key: "DONE", label: "Performed" },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={s.handle} />

          {/* header */}
          <View style={s.head}>
            <View style={{ flex: 1 }}>
              <Txt size={19} font="sansExt" style={{ color: "#fff" }}>Running order</Txt>
              <Txt size={12.5} numberOfLines={1} style={{ color: MUTED, marginTop: 2 }}>
                {title}
              </Txt>
              {venue ? (
                <View style={[s.inline, { marginTop: 4 }]}>
                  <MapPin size={12} color={MUTED} />
                  <Txt size={12} numberOfLines={1} style={{ color: MUTED }}>{venue}</Txt>
                </View>
              ) : null}
            </View>
            <Pressable onPress={onClose} hitSlop={8} style={s.close}>
              <X size={16} color="#fff" />
            </Pressable>
          </View>

          {/* status tabs — counts come straight off the lineup */}
          <View style={s.tabs}>
            {tabs.map((t) => {
              const on = tab === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => {
                    playNavFeedback();
                    setTab(t.key);
                  }}
                  style={[s.tab, on && s.tabOn]}
                >
                  <Txt size={15} font="sansExt" style={{ color: on ? "#fff" : "#D5D8E2" }}>{counts[t.key]}</Txt>
                  <Txt size={11} font="sansSemi" numberOfLines={1} style={{ color: on ? "#fff" : MUTED }}>{t.label}</Txt>
                </Pressable>
              );
            })}
          </View>

          {/* search */}
          <View style={s.search}>
            <Search size={15} color={MUTED} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search name or registration ID"
              placeholderTextColor="#6B728A"
              style={s.searchInput}
            />
            {search ? (
              <Pressable onPress={() => setSearch("")} hitSlop={6}>
                <X size={14} color={MUTED} />
              </Pressable>
            ) : null}
          </View>

          {categories.length > 2 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cats}>
              {categories.map((c) => {
                const on = cat === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      playNavFeedback();
                      setCat(c);
                    }}
                    style={[s.cat, on && s.catOn]}
                  >
                    <Txt size={12} font="sansBold" style={{ color: on ? SPOT : MUTED }}>{c === "ALL" ? "All divisions" : c}</Txt>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {/* the list */}
          <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} style={{ maxHeight: SCREEN_H * 0.5 }}>
            {rows.length === 0 ? (
              <EmptyState
                icon={<Users size={24} color="#6B728A" />}
                title={lineup.length ? "No one matches" : "Lineup not out yet"}
                subtitle={lineup.length ? "Clear the search or pick another filter." : "Contestants appear here as they check in at the venue."}
              />
            ) : (
              <View style={{ gap: 8, paddingBottom: 8 }}>
                {rows.map((p, i) => {
                  const isMe = !!me && email(p.user_email) === me;
                  const onStage = !!curEmail && email(p.user_email) === curEmail;
                  const doneP = p.stage_status === "COMPLETED";
                  const here = present(p);
                  const meta = [catOf(p), p.venue_entry_number ? `Entry #${p.venue_entry_number}` : null].filter(Boolean).join(" · ");
                  return (
                    <View
                      key={p.registration_id || p.user_email || i}
                      onLayout={(e) => {
                        if (isMe) myY.current = e.nativeEvent.layout.y;
                      }}
                      style={[s.row, onStage && s.rowLive, isMe && !onStage && s.rowMine]}
                    >
                      <View style={[s.num, onStage && { backgroundColor: SPOT }]}>
                        <Txt size={12} font="sansExt" style={{ color: onStage ? "#fff" : MUTED }}>{p.order ?? p.stage_order ?? i + 1}</Txt>
                      </View>
                      <Avatar name={nameOf(p)} photo={p.avatar || p.user_photo} size={40} />
                      <View style={{ flex: 1 }}>
                        <View style={s.inline}>
                          <Txt size={14} font="sansBold" lh={18} style={{ color: "#fff", flexShrink: 1 }}>
                            {nameOf(p)}
                          </Txt>
                          <VerifiedTick row={p} size={12} />
                          {isMe ? (
                            <View style={s.you}>
                              <Txt size={9.5} font="sansExt" style={{ color: "#fff" }}>YOU</Txt>
                            </View>
                          ) : null}
                        </View>
                        {meta ? <Txt size={11.5} style={{ color: MUTED, marginTop: 2 }}>{meta}</Txt> : null}
                      </View>
                      {onStage ? (
                        <View style={[s.status, { backgroundColor: SPOT + "22" }]}>
                          <Pulse min={0.3} period={1000}>
                            <View style={[s.dot, { backgroundColor: SPOT }]} />
                          </Pulse>
                          <Txt size={11} font="sansBold" style={{ color: SPOT }}>On stage</Txt>
                        </View>
                      ) : doneP ? (
                        <View style={[s.status, { backgroundColor: OK + "1A" }]}>
                          <Check size={11} color={OK} strokeWidth={3} />
                          <Txt size={11} font="sansBold" style={{ color: OK }}>Done</Txt>
                        </View>
                      ) : here ? (
                        <View style={[s.status, { backgroundColor: "rgba(255,255,255,0.07)" }]}>
                          <View style={[s.dot, { backgroundColor: OK }]} />
                          <Txt size={11} font="sansBold" style={{ color: "#D5D8E2" }}>Here</Txt>
                        </View>
                      ) : (
                        <View style={[s.status, { backgroundColor: WAIT + "1A" }]}>
                          <Clock size={11} color={WAIT} />
                          <Txt size={11} font="sansBold" style={{ color: WAIT }}>Waiting</Txt>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>

          {inLineup ? (
            <Pressable onPress={jumpToMe} style={({ pressed }) => [s.jump, { opacity: pressed ? 0.85 : 1 }]}>
              <LocateFixed size={16} color="#fff" />
              <Txt size={14} font="sansBold" style={{ color: "#fff" }}>Find my spot</Txt>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#111319",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: SCREEN_H * 0.9,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 16 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  close: { width: 34, height: 34, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  inline: { flexDirection: "row", alignItems: "center", gap: 4 },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  tabOn: { backgroundColor: SPOT, borderColor: SPOT },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 12,
  },
  searchInput: { flex: 1, color: "#fff", fontSize: 13.5, paddingVertical: 0 },
  cats: { gap: 8, paddingBottom: 12 },
  cat: {
    paddingHorizontal: 12,
    height: 30,
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  catOn: { backgroundColor: SPOT + "22", borderColor: SPOT },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  rowLive: { backgroundColor: SPOT + "14", borderColor: SPOT + "66" },
  rowMine: { borderColor: SPOT + "55" },
  num: { width: 28, height: 28, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" },
  you: { paddingHorizontal: 6, height: 16, justifyContent: "center", borderRadius: 4, backgroundColor: SPOT, marginLeft: 2 },
  status: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, height: 24, borderRadius: 999 },
  dot: { width: 6, height: 6, borderRadius: 999 },
  jump: {
    marginTop: 12,
    height: 48,
    borderRadius: 14,
    backgroundColor: SPOT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
