import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Pressable,
  Modal,
  ScrollView,
  Dimensions,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  Calendar,
  CalendarDays,
  ChevronDown,
  X,
  Sparkles,
  Cake,
  Check,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt, Button } from "@/components/ui";
import { playNavFeedback } from "@/lib/sound";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const MONTH_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function calculateAge(dobStr?: string): number | null {
  if (!dobStr || !/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) return null;
  const [y, m, d] = dobStr.split("-").map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  const mDiff = today.getMonth() + 1 - m;
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < d)) {
    age--;
  }
  return Math.max(0, age);
}

function formatDobDisplay(dobStr?: string): string | null {
  if (!dobStr || !/^\d{4}-\d{2}-\d{2}$/.test(dobStr)) return null;
  const [y, m, d] = dobStr.split("-").map(Number);
  const mName = MONTH_NAMES[m - 1] || "Jan";
  return `${d} ${mName} ${y}`;
}

export type DobPickerProps = {
  value?: string; // YYYY-MM-DD
  onChange: (dateString: string) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
};

export function DobPicker({
  value,
  onChange,
  placeholder = "Select your birth date",
  invalid,
  disabled,
}: DobPickerProps) {
  const { c, fonts, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  // Parse initial state or fallback to young adult ~2004
  const parsed = useMemo(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-").map(Number);
      return { y, m, d };
    }
    const currentYear = new Date().getFullYear();
    return { y: currentYear - 18, m: 1, d: 1 };
  }, [value]);

  const [selYear, setSelYear] = useState(parsed.y);
  const [selMonth, setSelMonth] = useState(parsed.m);
  const [selDay, setSelDay] = useState(parsed.d);

  // Sync when value prop changes or modal opens
  useEffect(() => {
    if (open) {
      setSelYear(parsed.y);
      setSelMonth(parsed.m);
      setSelDay(parsed.d);
    }
  }, [open, parsed]);

  // Adjust day if month has fewer days (e.g. Feb)
  const maxDays = useMemo(() => getDaysInMonth(selYear, selMonth), [selYear, selMonth]);
  useEffect(() => {
    if (selDay > maxDays) {
      setSelDay(maxDays);
    }
  }, [maxDays, selDay]);

  // Available ranges
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear - 4; y >= 1940; y--) {
      list.push(y);
    }
    return list;
  }, [currentYear]);

  const days = useMemo(() => {
    const list: number[] = [];
    for (let d = 1; d <= maxDays; d++) {
      list.push(d);
    }
    return list;
  }, [maxDays]);

  const months = useMemo(() => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], []);

  // Temporary formatted string during selection
  const tempDateStr = `${selYear}-${String(selMonth).padStart(2, "0")}-${String(selDay).padStart(2, "0")}`;
  const tempAge = calculateAge(tempDateStr);
  const displayFormatted = formatDobDisplay(value);
  const actualAge = calculateAge(value);

  const confirm = () => {
    playNavFeedback();
    onChange(tempDateStr);
    setOpen(false);
  };

  const handleOpen = () => {
    if (disabled) return;
    playNavFeedback();
    setOpen(true);
  };

  const handleClose = () => {
    playNavFeedback();
    setOpen(false);
  };

  // Quick decade buttons for super fast jumping
  const DECADES = [
    { label: "2010s", year: 2012 },
    { label: "2000s", year: 2004 },
    { label: "1990s", year: 1995 },
    { label: "1980s", year: 1985 },
    { label: "1970s", year: 1975 },
  ];

  return (
    <>
      {/* ── The Field Trigger ── */}
      <Pressable
        onPress={handleOpen}
        disabled={disabled}
        style={({ pressed }) => [
          {
            minHeight: 52,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor: invalid ? c.danger : open ? c.accent : c.borderStrong,
            backgroundColor: c.bgElevated,
            paddingHorizontal: 14,
            paddingVertical: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            opacity: disabled ? 0.5 : 1,
            transform: [{ scale: pressed && !disabled ? 0.985 : 1 }],
          },
        ]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
          {/* Calendar icon tile */}
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              backgroundColor: "rgba(255, 56, 92, 0.12)",
              borderWidth: 1,
              borderColor: "rgba(255, 56, 92, 0.3)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Calendar size={18} color="#FF385C" />
          </View>

          {/* Label / Selected date */}
          <View style={{ flex: 1, minWidth: 0 }}>
            {displayFormatted ? (
              <>
                <Txt size={15} font="sansSemi" style={{ color: c.fg }} numberOfLines={1}>
                  {displayFormatted}
                </Txt>
                <Txt size={11.5} style={{ color: "#9ea3b8", marginTop: 1 }}>
                  {actualAge !== null ? `${actualAge} years old · ` : ""}{value}
                </Txt>
              </>
            ) : (
              <Txt size={14.5} style={{ color: c.fgSubtle }}>
                {placeholder}
              </Txt>
            )}
          </View>
        </View>

        {/* Right chevron indicator */}
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            backgroundColor: "rgba(255, 255, 255, 0.06)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronDown size={16} color={c.fgSubtle} />
        </View>
      </Pressable>

      {/* ── The Bottom Sheet Modal ── */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.76)", justifyContent: "flex-end" }}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

          <View
            style={{
              backgroundColor: "#13151D",
              borderTopLeftRadius: 30,
              borderTopRightRadius: 30,
              borderTopWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.12)",
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom + 14, 26),
              shadowColor: "#000",
              shadowOpacity: 0.6,
              shadowRadius: 28,
              elevation: 24,
            }}
          >
            {/* Grab handle */}
            <View
              style={{
                width: 44,
                height: 5,
                borderRadius: 999,
                backgroundColor: "rgba(255, 255, 255, 0.18)",
                alignSelf: "center",
                marginBottom: 16,
              }}
            />

            {/* Header row */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: "rgba(255, 56, 92, 0.15)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Cake size={18} color="#FF385C" />
                </View>
                <View>
                  <Txt size={17} font="sansBold" style={{ color: "#ffffff" }}>
                    Date of Birth
                  </Txt>
                  <Txt size={12} style={{ color: "#9ea3b8", marginTop: 1 }}>
                    Pick your day, month & birth year
                  </Txt>
                </View>
              </View>

              <Pressable
                onPress={handleClose}
                hitSlop={8}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={17} color="#ffffff" />
              </Pressable>
            </View>

            {/* Live selected date preview pill */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                backgroundColor: "rgba(255, 56, 92, 0.09)",
                borderWidth: 1,
                borderColor: "rgba(255, 56, 92, 0.28)",
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 10,
                marginBottom: 14,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Sparkles size={16} color="#FF385C" />
                <Txt size={15} font="sansBold" style={{ color: "#ffffff" }}>
                  {selDay} {MONTH_FULL[selMonth - 1]} {selYear}
                </Txt>
              </View>

              <View
                style={{
                  backgroundColor: tempAge !== null && tempAge < 18 ? "rgba(201, 242, 74, 0.14)" : "rgba(255, 255, 255, 0.12)",
                  paddingHorizontal: 9,
                  paddingVertical: 3.5,
                  borderRadius: 999,
                }}
              >
                <Txt
                  size={11}
                  font="sansBold"
                  style={{ color: tempAge !== null && tempAge < 18 ? "#C9F24A" : "#ffffff" }}
                >
                  {tempAge !== null ? `${tempAge} YRS OLD` : ""}
                  {tempAge !== null && tempAge < 18 ? " · MINOR" : ""}
                </Txt>
              </View>
            </View>

            {/* Quick Decade Jumpers */}
            <View style={{ marginBottom: 12 }}>
              <Txt size={10.5} font="monoMed" style={{ color: "#6b728a", letterSpacing: 1.2, marginBottom: 7 }} uppercase>
                Quick decade jump
              </Txt>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {DECADES.map((dec) => {
                  const active = Math.floor(selYear / 10) * 10 === Math.floor(dec.year / 10) * 10;
                  return (
                    <Pressable
                      key={dec.label}
                      onPress={() => {
                        playNavFeedback();
                        setSelYear(dec.year);
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 7,
                        borderRadius: 10,
                        alignItems: "center",
                        backgroundColor: active ? "rgba(255, 56, 92, 0.22)" : "#181a24",
                        borderWidth: 1,
                        borderColor: active ? "#FF385C" : "rgba(255, 255, 255, 0.08)",
                      }}
                    >
                      <Txt size={12} font={active ? "sansBold" : "sansMed"} style={{ color: active ? "#ffffff" : "#9ea3b8" }}>
                        {dec.label}
                      </Txt>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 3-Column Wheels Card */}
            <View
              style={{
                backgroundColor: "#0B0C10",
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.08)",
                padding: 10,
                marginBottom: 16,
              }}
            >
              {/* Column labels */}
              <View style={{ flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "rgba(255, 255, 255, 0.06)" }}>
                <Txt size={10.5} font="monoMed" style={{ flex: 1, textAlign: "center", color: "#6b728a", letterSpacing: 1 }} uppercase>
                  Day
                </Txt>
                <Txt size={10.5} font="monoMed" style={{ flex: 1.2, textAlign: "center", color: "#6b728a", letterSpacing: 1 }} uppercase>
                  Month
                </Txt>
                <Txt size={10.5} font="monoMed" style={{ flex: 1.2, textAlign: "center", color: "#6b728a", letterSpacing: 1 }} uppercase>
                  Year
                </Txt>
              </View>

              <View style={{ flexDirection: "row", height: 180 }}>
                {/* 1. Day Column */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={{ flex: 1, paddingHorizontal: 4 }}
                  contentContainerStyle={{ paddingVertical: 6, gap: 4 }}
                >
                  {days.map((d) => {
                    const active = d === selDay;
                    return (
                      <Pressable
                        key={d}
                        onPress={() => {
                          playNavFeedback();
                          setSelDay(d);
                        }}
                        style={{
                          height: 38,
                          borderRadius: 10,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: active ? "#FF385C" : "transparent",
                        }}
                      >
                        <Txt
                          size={15}
                          font={active ? "sansBold" : "sansMed"}
                          style={{ color: active ? "#ffffff" : "#8e95ac" }}
                        >
                          {String(d).padStart(2, "0")}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Vertical Divider */}
                <View style={{ width: 1, backgroundColor: "rgba(255, 255, 255, 0.06)", marginVertical: 4 }} />

                {/* 2. Month Column */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={{ flex: 1.2, paddingHorizontal: 4 }}
                  contentContainerStyle={{ paddingVertical: 6, gap: 4 }}
                >
                  {months.map((m) => {
                    const active = m === selMonth;
                    return (
                      <Pressable
                        key={m}
                        onPress={() => {
                          playNavFeedback();
                          setSelMonth(m);
                        }}
                        style={{
                          height: 38,
                          borderRadius: 10,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: active ? "#FF385C" : "transparent",
                        }}
                      >
                        <Txt
                          size={14.5}
                          font={active ? "sansBold" : "sansMed"}
                          style={{ color: active ? "#ffffff" : "#8e95ac" }}
                        >
                          {MONTH_NAMES[m - 1]}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Vertical Divider */}
                <View style={{ width: 1, backgroundColor: "rgba(255, 255, 255, 0.06)", marginVertical: 4 }} />

                {/* 3. Year Column */}
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={{ flex: 1.2, paddingHorizontal: 4 }}
                  contentContainerStyle={{ paddingVertical: 6, gap: 4 }}
                >
                  {years.map((y) => {
                    const active = y === selYear;
                    return (
                      <Pressable
                        key={y}
                        onPress={() => {
                          playNavFeedback();
                          setSelYear(y);
                        }}
                        style={{
                          height: 38,
                          borderRadius: 10,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: active ? "#FF385C" : "transparent",
                        }}
                      >
                        <Txt
                          size={15}
                          font={active ? "sansBold" : "sansMed"}
                          style={{ color: active ? "#ffffff" : "#8e95ac" }}
                        >
                          {y}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Confirm CTA */}
            <Button
              label="Confirm Date of Birth"
              variant="primary"
              full
              size="lg"
              onPress={confirm}
              icon={<Check size={18} color="#ffffff" />}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
