import React, { useEffect, useState, useRef } from "react";
import {
  View,
  TextInput,
  ScrollView,
  Pressable,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  Search as SearchIcon,
  X,
  Calendar,
  MapPin,
  Trophy,
  ShoppingBag,
  Sparkles,
  Ticket,
  ChevronRight,
  Flame,
} from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { publicApi, shopApi, safe, toRows, type EventItem } from "@/lib/api";
import { Txt, Card, Badge, Skeleton, EmptyState } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { formatINR, splitDate } from "@/lib/format";

const TRENDING = [
  "Hip Hop",
  "Choreography",
  "Contemporary",
  "Battle",
  "Workshops",
  "Solo",
  "Duet",
  "Merch",
];

type TabKey = "all" | "events" | "competitions" | "shop";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "events", label: "Events" },
  { key: "competitions", label: "Contests" },
  { key: "shop", label: "Shop" },
];

export default function UniversalSearch() {
  const { c } = useTheme();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  const [events, setEvents] = useState<EventItem[]>([]);
  const [competitions, setCompetitions] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<any>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(query.trim());
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [evs, comps, prods] = await Promise.all([
          safe(publicApi.upcomingEvents({ search: debounced || undefined, limit: 20 }), []),
          safe(publicApi.competitions({ search: debounced || undefined, limit: 20 }), []),
          safe(shopApi.products({ limit: 30 }), []),
        ]);
        if (!cancelled) {
          setEvents(toRows(evs));
          setCompetitions(toRows(comps));
          const allProds = toRows(prods);
          if (debounced) {
            const q = debounced.toLowerCase();
            setProducts(
              allProds.filter(
                (p: any) =>
                  p?.name?.toLowerCase().includes(q) ||
                  p?.description?.toLowerCase().includes(q) ||
                  p?.category?.toLowerCase().includes(q)
              )
            );
          } else {
            setProducts(allProds);
          }
        }
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const selectTrending = (tag: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setQuery(tag);
  };

  const clearQuery = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  const showEvents = activeTab === "all" || activeTab === "events";
  const showCompetitions = activeTab === "all" || activeTab === "competitions";
  const showShop = activeTab === "all" || activeTab === "shop";

  const totalHits =
    (showEvents ? events.length : 0) +
    (showCompetitions ? competitions.length : 0) +
    (showShop ? products.length : 0);

  return (
    <SubScreen eyebrow="Discovery" title="Search">
      {/* Search Input Bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: "#111114",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.12)",
          paddingHorizontal: 14,
          height: 50,
          marginBottom: 14,
        }}
      >
        <SearchIcon size={18} color="#9ea3b8" />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={setQuery}
          placeholder="Search events, competitions, merch…"
          placeholderTextColor="#6b728a"
          style={{ flex: 1, color: "#ffffff", fontSize: 15 }}
          autoFocus
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable onPress={clearQuery} hitSlop={8}>
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                backgroundColor: "rgba(255, 255, 255, 0.12)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={14} color="#ffffff" />
            </View>
          </Pressable>
        ) : null}
      </View>

      {/* Trending Tags */}
      <View style={{ marginBottom: 14 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {TRENDING.map((tag) => {
            const isSelected = query.toLowerCase() === tag.toLowerCase();
            return (
              <Pressable
                key={tag}
                onPress={() => selectTrending(tag)}
                style={({ pressed }) => ({
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 999,
                  backgroundColor: isSelected ? "#ff385c" : "#191c26",
                  borderWidth: 1,
                  borderColor: isSelected
                    ? "#ff385c"
                    : "rgba(255, 255, 255, 0.08)",
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                })}
              >
                <Txt
                  size={12}
                  font={isSelected ? "sansBold" : "sansMed"}
                  style={{ color: isSelected ? "#ffffff" : "#9ea3b8" }}
                >
                  {tag}
                </Txt>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Tabs */}
      <View
        style={{
          flexDirection: "row",
          gap: 8,
          marginBottom: 18,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255, 255, 255, 0.08)",
          paddingBottom: 10,
        }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setActiveTab(tab.key);
              }}
              style={{
                paddingHorizontal: 13,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: isActive
                  ? "rgba(255, 255, 255, 0.12)"
                  : "transparent",
              }}
            >
              <Txt
                size={13}
                font={isActive ? "sansBold" : "sansMed"}
                style={{ color: isActive ? "#ffffff" : "#8e93a8" }}
              >
                {tab.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      {loading ? (
        <View style={{ gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} h={96} radius={18} />
          ))}
        </View>
      ) : totalHits === 0 ? (
        <EmptyState
          icon={<SearchIcon size={28} color="#6b728a" />}
          title="No results found"
          subtitle={
            debounced
              ? `No matches for "${debounced}". Try searching for dance styles, tour names or prizes.`
              : "Type in the search bar or tap a trending tag above."
          }
        />
      ) : (
        <View style={{ gap: 20 }}>
          {/* Competitions Section */}
          {showCompetitions && competitions.length > 0 ? (
            <View style={{ gap: 10 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <Trophy size={16} color="#c084fc" />
                  <Txt size={15} font="sansBold" style={{ color: "#ffffff" }}>
                    Competitions ({competitions.length})
                  </Txt>
                </View>
              </View>

              {competitions.slice(0, 6).map((comp: any) => (
                <Pressable
                  key={comp._id || comp.id}
                  onPress={() =>
                    router.push(`/(more)/competitions/${comp._id || comp.id}`)
                  }
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    backgroundColor: "#13151f",
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    padding: 10,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}
                >
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 14,
                      overflow: "hidden",
                      backgroundColor: "#1e202c",
                    }}
                  >
                    <AppImage
                      uri={comp.image_url || comp.banner_url}
                      style={{ width: "100%", height: "100%" }}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Txt
                      size={15}
                      font="sansBold"
                      numberOfLines={1}
                      style={{ color: "#ffffff" }}
                    >
                      {comp.title || comp.name}
                    </Txt>
                    <Txt
                      size={12}
                      style={{ color: "#9ea3b8", marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {comp.category || "Open Contest"}
                      {comp.prize ? ` • Prize: ${comp.prize}` : ""}
                    </Txt>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 4,
                      }}
                    >
                      <Badge
                        label={
                          comp.participation_fee
                            ? formatINR(comp.participation_fee)
                            : "Free entry"
                        }
                        tone="brand"
                      />
                    </View>
                  </View>

                  <ChevronRight size={18} color="#6b728a" />
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Events Section */}
          {showEvents && events.length > 0 ? (
            <View style={{ gap: 10 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <Calendar size={16} color="#fbbf24" />
                  <Txt size={15} font="sansBold" style={{ color: "#ffffff" }}>
                    Events ({events.length})
                  </Txt>
                </View>
              </View>

              {events.slice(0, 6).map((ev: any) => {
                const d = splitDate(ev.date);
                return (
                  <Pressable
                    key={ev._id}
                    onPress={() => router.push(`/(user)/events/${ev._id}`)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      backgroundColor: "#13151f",
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.08)",
                      padding: 10,
                      transform: [{ scale: pressed ? 0.98 : 1 }],
                    })}
                  >
                    <View
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 14,
                        overflow: "hidden",
                        backgroundColor: "#1e202c",
                      }}
                    >
                      <AppImage
                        uri={ev.image_url}
                        style={{ width: "100%", height: "100%" }}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Txt
                        size={15}
                        font="sansBold"
                        numberOfLines={1}
                        style={{ color: "#ffffff" }}
                      >
                        {ev.title}
                      </Txt>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          marginTop: 3,
                        }}
                      >
                        <Calendar size={12} color="#9ea3b8" />
                        <Txt size={12} style={{ color: "#9ea3b8" }}>
                          {d.day} {d.month}
                        </Txt>
                        {ev.venue ? (
                          <>
                            <Txt size={10} style={{ color: "#6b728a" }}>
                              •
                            </Txt>
                            <Txt
                              size={12}
                              numberOfLines={1}
                              style={{ color: "#9ea3b8", maxWidth: 120 }}
                            >
                              {ev.venue}
                            </Txt>
                          </>
                        ) : null}
                      </View>
                    </View>

                    {ev.price != null ? (
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 5,
                          borderRadius: 999,
                          backgroundColor: "rgba(255, 255, 255, 0.1)",
                        }}
                      >
                        <Txt
                          size={12.5}
                          font="sansBold"
                          style={{ color: "#ffffff" }}
                        >
                          {formatINR(ev.price)}
                        </Txt>
                      </View>
                    ) : null}

                    <ChevronRight size={18} color="#6b728a" />
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Shop / Merchandise Section */}
          {showShop && products.length > 0 ? (
            <View style={{ gap: 10 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <ShoppingBag size={16} color="#f472b6" />
                  <Txt size={15} font="sansBold" style={{ color: "#ffffff" }}>
                    Merchandise ({products.length})
                  </Txt>
                </View>
              </View>

              {products.slice(0, 6).map((prod: any) => (
                <Pressable
                  key={prod._id || prod.id}
                  onPress={() =>
                    router.push(`/(more)/shop/${prod._id || prod.id}`)
                  }
                  style={({ pressed }) => ({
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    backgroundColor: "#13151f",
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.08)",
                    padding: 10,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  })}
                >
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 14,
                      overflow: "hidden",
                      backgroundColor: "#1e202c",
                    }}
                  >
                    <AppImage
                      uri={prod.images?.[0] || prod.image_url}
                      style={{ width: "100%", height: "100%" }}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Txt
                      size={15}
                      font="sansBold"
                      numberOfLines={1}
                      style={{ color: "#ffffff" }}
                    >
                      {prod.name}
                    </Txt>
                    <Txt
                      size={12}
                      style={{ color: "#9ea3b8", marginTop: 2 }}
                      numberOfLines={1}
                    >
                      {prod.category || "Official Merch"}
                    </Txt>
                    <Txt
                      size={13}
                      font="sansBold"
                      style={{ color: "#ff385c", marginTop: 3 }}
                    >
                      {formatINR(prod.price)}
                    </Txt>
                  </View>

                  <ChevronRight size={18} color="#6b728a" />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </SubScreen>
  );
}
