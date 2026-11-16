import React, { useState, useEffect } from "react";
import {
  View,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as SecureStore from "expo-secure-store";
import { MapPin, Search, Check, X, Navigation } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";

export type LocationInfo = {
  area: string;
  city: string;
};

const DEFAULT_LOC: LocationInfo = {
  area: "Gandhi Nagar",
  city: "Haldia",
};

const POPULAR_CITIES: LocationInfo[] = [
  { area: "Gandhi Nagar", city: "Haldia" },
  { area: "Salt Lake, Sector V", city: "Kolkata" },
  { area: "Park Street", city: "Kolkata" },
  { area: "New Town", city: "Kolkata" },
  { area: "City Centre", city: "Durgapur" },
  { area: "Sevoke Road", city: "Siliguri" },
  { area: "Bandra West", city: "Mumbai" },
  { area: "Connaught Place", city: "New Delhi" },
  { area: "Indiranagar", city: "Bengaluru" },
];

const LOC_STORAGE_KEY = "uti_user_location";

export function useUserLocation() {
  const [location, setLocation] = useState<LocationInfo>(DEFAULT_LOC);

  useEffect(() => {
    SecureStore.getItemAsync(LOC_STORAGE_KEY)
      .then((saved) => {
        if (saved) {
          try {
            setLocation(JSON.parse(saved));
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const saveLocation = async (loc: LocationInfo) => {
    setLocation(loc);
    try {
      await SecureStore.setItemAsync(LOC_STORAGE_KEY, JSON.stringify(loc));
    } catch {}
  };

  return { location, saveLocation };
}

export function LocationPickerModal({
  visible,
  current,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: LocationInfo;
  onSelect: (loc: LocationInfo) => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");

  const filtered = POPULAR_CITIES.filter(
    (item) =>
      item.area.toLowerCase().includes(query.toLowerCase()) ||
      item.city.toLowerCase().includes(query.toLowerCase())
  );

  const pick = (loc: LocationInfo) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onSelect(loc);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.72)",
          justifyContent: "flex-end",
        }}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <View
          style={{
            backgroundColor: "#12141a",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.12)",
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom, 20),
            maxHeight: Dimensions.get("window").height * 0.75,
          }}
        >
          {/* Handle bar */}
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

          {/* Title Row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <View>
              <Txt size={19} font="sansBold" style={{ color: "#ffffff" }}>
                Select your location
              </Txt>
              <Txt size={12.5} tone="muted" style={{ color: "#9ea3b8", marginTop: 2 }}>
                Find competitions & events near you
              </Txt>
            </View>

            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.08)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={18} color="#ffffff" />
            </Pressable>
          </View>

          {/* Search Input */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              backgroundColor: "#191c24",
              borderRadius: 14,
              paddingHorizontal: 14,
              height: 46,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.08)",
              marginBottom: 16,
            }}
          >
            <Search size={17} color="#9ea3b8" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search area, city or venue…"
              placeholderTextColor="#6b728a"
              style={{
                flex: 1,
                color: "#ffffff",
                fontSize: 14,
              }}
            />
            {query.length > 0 ? (
              <Pressable onPress={() => setQuery("")} hitSlop={6}>
                <X size={15} color="#9ea3b8" />
              </Pressable>
            ) : null}
          </View>

          {/* Current / GPS Option */}
          <Pressable
            onPress={() => pick(DEFAULT_LOC)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 14,
              backgroundColor: "rgba(255, 56, 92, 0.1)",
              borderWidth: 1,
              borderColor: "rgba(255, 56, 92, 0.25)",
              marginBottom: 14,
            }}
          >
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                backgroundColor: "#ff385c",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Navigation size={17} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={14} font="sansBold" style={{ color: "#ffffff" }}>
                Use current location
              </Txt>
              <Txt size={11.5} style={{ color: "#ff829b" }}>
                Gandhi Nagar, Haldia
              </Txt>
            </View>
          </Pressable>

          <Txt
            size={11.5}
            font="monoMed"
            tracking={1.5}
            uppercase
            style={{ color: "#6b728a", marginVertical: 8 }}
          >
            Popular locations
          </Txt>

          {/* Location List */}
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 280 }}>
            <View style={{ gap: 6 }}>
              {filtered.map((item, idx) => {
                const isSelected =
                  current.area === item.area && current.city === item.city;
                return (
                  <Pressable
                    key={idx}
                    onPress={() => pick(item)}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      borderRadius: 14,
                      backgroundColor: isSelected
                        ? "rgba(255,255,255,0.08)"
                        : pressed
                        ? "rgba(255,255,255,0.04)"
                        : "transparent",
                    })}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <MapPin
                        size={17}
                        color={isSelected ? "#ff385c" : "#9ea3b8"}
                      />
                      <View>
                        <Txt
                          size={14}
                          font={isSelected ? "sansBold" : "sansMed"}
                          style={{ color: isSelected ? "#ffffff" : "#d8dbe6" }}
                        >
                          {item.area}
                        </Txt>
                        <Txt size={11.5} style={{ color: "#8b91a7" }}>
                          {item.city}
                        </Txt>
                      </View>
                    </View>

                    {isSelected ? <Check size={17} color="#ff385c" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
