import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  X,
  Users,
  Search,
  MapPin,
  Clock,
  Radio,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Flame,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { publicCompetitionsApi } from "@/lib/api";
import { Txt, Badge, Skeleton, EmptyState } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { VerifiedTick } from "@/components/VerifiedBadge";
import { Pulse } from "@/components/motion";
import { playNavFeedback } from "@/lib/sound";

const { height: SCREEN_H } = Dimensions.get("window");

export function LiveStageLineupModal({
  visible,
  stageData,
  competitionId,
  competitionTitle,
  compTitle,
  onClose,
}: {
  visible: boolean;
  stageData?: any | null;
  competitionId?: string;
  competitionTitle?: string;
  compTitle?: string;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useSession();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PRESENT" | "WAITING">("ALL");
  const [fetchedStage, setFetchedStage] = useState<any | null>(null);
  const scrollViewRef = useRef<any>(null);
  const myRowOffsetRef = useRef<number>(0);

  useEffect(() => {
    if (!visible || !competitionId || stageData) return;
    let cancelled = false;
    publicCompetitionsApi
      .liveStage(competitionId)
      .then((res) => {
        if (!cancelled && res) setFetchedStage(res);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [visible, competitionId, stageData]);

  const effectiveStage = stageData || fetchedStage;
  const title = compTitle || competitionTitle || effectiveStage?.competition_title || "Live Stage";

  const lineup: any[] = Array.isArray(effectiveStage?.lineup) ? effectiveStage.lineup : [];
  const current = effectiveStage?.current_performer;
  const currentEmail = (current?.user_email || "").toLowerCase().trim();

  // Unique categories for division filter
  const categories = useMemo(() => {
    const cats = new Set<string>();
    lineup.forEach((p) => {
      const cat = p.category || p.division || p.category_name;
      if (cat) cats.add(String(cat));
    });
    return ["ALL", ...Array.from(cats)];
  }, [lineup]);

  // User's own position in queue
  const myQueue = useMemo(() => {
    if (!user?.email || !lineup.length) return null;
    const uEmail = user.email.toLowerCase().trim();
    const meIdx = lineup.findIndex(
      (p) => (p.user_email || "").toLowerCase().trim() === uEmail
    );
    if (meIdx < 0) return null;

    const me = lineup[meIdx];
    const isCurrent = currentEmail ? (me.user_email || "").toLowerCase().trim() === currentEmail : false;
    const currIdx = currentEmail
      ? lineup.findIndex((p) => (p.user_email || "").toLowerCase().trim() === currentEmail)
      : -1;
    const ahead = currIdx >= 0 ? Math.max(0, meIdx - currIdx) : meIdx;
    const isPresent = Boolean(me.is_present || me.attendance_status === "PRESENT");

    return {
      order: me.order || meIdx + 1,
      total: lineup.length,
      ahead,
      onStage: isCurrent,
      isNextUp: !isCurrent && ahead === 1,
      isPresent,
      idx: meIdx,
    };
  }, [user?.email, lineup, currentEmail]);

  // Filtered rows
  const filtered = useMemo(() => {
    return lineup.filter((p) => {
      if (categoryFilter !== "ALL") {
        const cat = p.category || p.division || p.category_name;
        if (cat !== categoryFilter) return false;
      }
      if (statusFilter === "PRESENT" && !p.is_present && p.attendance_status !== "PRESENT") {
        return false;
      }
      if (statusFilter === "WAITING" && (p.is_present || p.attendance_status === "PRESENT")) {
        return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = (p.participant_name || p.user_name || p.name || "").toLowerCase();
        const ref = (p.registration_reference || p.bib_number || "").toLowerCase();
        if (!name.includes(q) && !ref.includes(q)) return false;
      }
      return true;
    });
  }, [lineup, categoryFilter, statusFilter, search]);

  const scrollToMySpot = () => {
    playNavFeedback();
    setCategoryFilter("ALL");
    setStatusFilter("ALL");
    setSearch("");
    setTimeout(() => {
      if (myRowOffsetRef.current > 0) {
        scrollViewRef.current?.scrollTo({ y: Math.max(0, myRowOffsetRef.current - 100), animated: true });
      }
    }, 120);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.8)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <View
          style={{
            backgroundColor: "#13151f",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderTopWidth: 1,
            borderTopColor: "rgba(255, 255, 255, 0.12)",
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom, 20),
            maxHeight: SCREEN_H * 0.88,
          }}
        >
          {/* Handle */}
          <View
            style={{
              width: 38,
              height: 4,
              borderRadius: 2,
              backgroundColor: "rgba(255,255,255,0.22)",
              alignSelf: "center",
              marginBottom: 16,
            }}
          />

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <View style={{ flex: 1 }}>
              <Txt size={18} font="sansBold" style={{ color: "#ffffff" }}>
                Live Stage Lineup & Queue
              </Txt>
              <Txt size={12} tone="muted" style={{ color: "#9ea3b8", marginTop: 2 }}>
                {title} • Real-time Arrival Order
              </Txt>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                backgroundColor: "rgba(255, 255, 255, 0.08)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} color="#ffffff" />
            </Pressable>
          </View>

          {/* User's Personalized Queue Position Banner */}
          {myQueue ? (
            <View
              style={{
                borderRadius: 16,
                backgroundColor: "rgba(255, 56, 92, 0.12)",
                borderWidth: 1,
                borderColor: "rgba(255, 56, 92, 0.3)",
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <View style={{ flex: 1, paddingRight: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <MapPin size={14} color="#ff385c" />
                  <Txt size={11} font="monoMed" uppercase tracking={1.5} style={{ color: "#ff385c" }}>
                    Your Queue Status
                  </Txt>
                </View>
                <Txt size={13.5} font="sansBold" style={{ color: "#ffffff", marginTop: 3 }}>
                  {myQueue.onStage
                    ? "You are ON STAGE right now!"
                    : myQueue.isNextUp
                    ? "You're up NEXT — head backstage!"
                    : `You are #${myQueue.order} of ${myQueue.total} (${myQueue.ahead} ahead)`}
                </Txt>
                <Txt size={11.5} style={{ color: "#ff829b", marginTop: 2 }}>
                  {myQueue.isPresent ? "✓ Venue check-in verified" : "⚠️ Waiting for venue check-in"}
                </Txt>
              </View>

              <Pressable
                onPress={scrollToMySpot}
                style={{
                  paddingHorizontal: 11,
                  paddingVertical: 6,
                  borderRadius: 999,
                  backgroundColor: "#ff385c",
                }}
              >
                <Txt size={11.5} font="sansBold" style={{ color: "#ffffff" }}>
                  Jump to me
                </Txt>
              </Pressable>
            </View>
          ) : null}

          {/* Search Bar */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: "#191c24",
              borderRadius: 12,
              paddingHorizontal: 12,
              height: 42,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              marginBottom: 10,
            }}
          >
            <Search size={15} color="#9ea3b8" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search competitor name or bib ID…"
              placeholderTextColor="#6b728a"
              style={{ flex: 1, color: "#ffffff", fontSize: 13.5 }}
            />
            {search.length > 0 ? (
              <Pressable onPress={() => setSearch("")} hitSlop={6}>
                <X size={14} color="#9ea3b8" />
              </Pressable>
            ) : null}
          </View>

          {/* Category Division Pills */}
          {categories.length > 2 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, marginBottom: 10 }}
            >
              {categories.map((cat) => {
                const active = categoryFilter === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => {
                      playNavFeedback();
                      setCategoryFilter(cat);
                    }}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 4.5,
                      borderRadius: 999,
                      backgroundColor: active ? "rgba(255, 255, 255, 0.15)" : "#181a24",
                      borderWidth: 1,
                      borderColor: active ? "rgba(255, 255, 255, 0.25)" : "transparent",
                    }}
                  >
                    <Txt size={11} font={active ? "sansBold" : "sansMed"} style={{ color: active ? "#fff" : "#8e93a8" }}>
                      {cat}
                    </Txt>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {/* Lineup List */}
          <ScrollView
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: SCREEN_H * 0.52 }}
          >
            {filtered.length === 0 ? (
              <EmptyState
                icon={<Users size={24} color="#6b728a" />}
                title="No competitors match"
                subtitle="Try clearing the search or category filter."
              />
            ) : (
              <View style={{ gap: 8, paddingBottom: 16 }}>
                {filtered.map((item, index) => {
                  const pEmail = (item.user_email || "").toLowerCase().trim();
                  const isCurrent = currentEmail ? pEmail === currentEmail : false;
                  const isMe = user?.email && pEmail === user.email.toLowerCase().trim();
                  const isPresent = Boolean(item.is_present || item.attendance_status === "PRESENT");
                  const isCompleted = item.stage_status === "COMPLETED";

                  return (
                    <View
                      key={item.participant_id || item.user_email || index}
                      onLayout={(e) => {
                        if (isMe) myRowOffsetRef.current = e.nativeEvent.layout.y;
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        padding: 10,
                        borderRadius: 14,
                        backgroundColor: isCurrent
                          ? "rgba(139, 92, 246, 0.16)"
                          : isMe
                          ? "rgba(255, 56, 92, 0.1)"
                          : "#161822",
                        borderWidth: 1,
                        borderColor: isCurrent
                          ? "rgba(139, 92, 246, 0.4)"
                          : isMe
                          ? "rgba(255, 56, 92, 0.3)"
                          : "rgba(255, 255, 255, 0.06)",
                      }}
                    >
                      {/* Queue Number */}
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          backgroundColor: isCurrent ? "#8b5cf6" : "#222533",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Txt
                          size={11.5}
                          font="sansBold"
                          style={{ color: isCurrent ? "#ffffff" : "#9ea3b8" }}
                        >
                          {item.order || index + 1}
                        </Txt>
                      </View>

                      {/* Avatar */}
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 999,
                          overflow: "hidden",
                          backgroundColor: "#202330",
                        }}
                      >
                        <AppImage
                          uri={item.avatar || item.profile_photo || item.user_photo}
                          seed={index}
                          style={{ width: "100%", height: "100%" }}
                        />
                      </View>

                      {/* Info */}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          <Txt
                            size={14}
                            font="sansBold"
                            numberOfLines={1}
                            style={{ color: isMe ? "#ff5e7a" : "#ffffff", flexShrink: 1 }}
                          >
                            {item.participant_name || item.user_name || item.name || "Contestant"}
                          </Txt>
                          <VerifiedTick row={item} size={13} />
                          {isMe ? (
                            <View
                              style={{
                                paddingHorizontal: 5,
                                paddingVertical: 1,
                                borderRadius: 4,
                                backgroundColor: "#ff385c",
                              }}
                            >
                              <Txt size={9} font="sansBold" style={{ color: "#fff" }}>
                                YOU
                              </Txt>
                            </View>
                          ) : null}
                        </View>

                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
                          {item.category || item.division ? (
                            <Txt size={11} style={{ color: "#8b91a7" }}>
                              {item.category || item.division}
                            </Txt>
                          ) : null}
                          <Txt size={10} style={{ color: isPresent ? "#22c55e" : "#eab308" }}>
                            {isPresent ? "• Present" : "• Waiting"}
                          </Txt>
                        </View>
                      </View>

                      {/* Status Tag */}
                      {isCurrent ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 999,
                            backgroundColor: "rgba(139, 92, 246, 0.25)",
                            borderWidth: 1,
                            borderColor: "#8b5cf6",
                          }}
                        >
                          <Pulse min={0.3} period={1000}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#c084fc" }} />
                          </Pulse>
                          <Txt size={10.5} font="sansBold" style={{ color: "#c084fc" }}>
                            ON STAGE
                          </Txt>
                        </View>
                      ) : isCompleted ? (
                        <View
                          style={{
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 999,
                            backgroundColor: "rgba(255, 255, 255, 0.08)",
                          }}
                        >
                          <Txt size={10.5} style={{ color: "#8e93a8" }}>
                            Done
                          </Txt>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
