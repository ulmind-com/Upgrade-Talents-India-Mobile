import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, ScrollView, Dimensions, Animated, Easing } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import QRCode from "react-native-qrcode-svg";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { ArrowLeft, CalendarDays, MapPin, User as UserIcon, Download, CheckCircle2, Share2, Ticket as TicketIcon, Ban, CalendarX } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { getEventById } from "@/lib/events";
import { useAsync } from "@/lib/useAsync";
import { Txt, Skeleton, Glow } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { usePopup } from "@/components/Popup";
import { ShareSheet } from "@/components/ShareSheet";
import { ticketWay } from "@/components/TicketPass";
import { DottedGrid } from "@/components/patterns";
import { parseDate, isEventExpired, endedAgo } from "@/lib/format";

const SCREEN = Dimensions.get("window").width;
const CARD = SCREEN - 40;
const QR = 196;

export default function TicketDetail() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = useLocalSearchParams<{ ref: string; type: string; holder: string; issued: string; checked: string; event_id: string }>();
  const { data: ev, loading } = useAsync(() => getEventById(String(p.event_id)), [p.event_id]);

  const checked = p.checked === "1";
  /* The event's own date decides whether this pass can still get anyone in —
     the backend never flips a flag when the night simply ends. */
  const expired = !checked && isEventExpired(ev?.date, ev?.time);
  const ended = expired ? endedAgo(ev?.date, ev?.time) : null;
  const DEAD = "#ff8e8e";
  const qrRef = useRef<any>(null);
  const [qrB64, setQrB64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const popup = usePopup();

  /* Same deterministic colourway as the pass in the list — a ticket keeps its
     identity from shelf to detail, and the screen is never flat orange. */
  const way = ticketWay(p.ref || p.event_id || "x");
  const [A, B] = way.grad;
  const LITE = way.stub[0];

  const intro = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 820, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { try { qrRef.current?.toDataURL?.((d: string) => setQrB64(d)); } catch {} }, 350);
    return () => clearTimeout(t);
  }, [ev]);

  const dt = (() => {
    const d = parseDate(ev?.date);
    if (!d) return ev?.date || "TBA";
    const date = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    return ev?.time ? `${date} · ${ev.time}` : date;
  })();

  const issued = (() => {
    const d = parseDate(p.issued);
    return d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—";
  })();

  const captureQr = () =>
    new Promise<string | null>((resolve) => {
      if (qrB64) return resolve(qrB64);
      try {
        if (qrRef.current?.toDataURL) {
          qrRef.current.toDataURL((d: string) => resolve(d || null));
          setTimeout(() => resolve(qrB64), 900);
        } else resolve(null);
      } catch { resolve(null); }
    });

  const buildHtml = (qr: string | null) => {
    const qrImg = qr ? `<img src="data:image/png;base64,${qr}" style="width:230px;height:230px" />` : "";
    const esc = (s?: string) => String(s || "").replace(/</g, "&lt;");
    return `
<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *{box-sizing:border-box;font-family:-apple-system,Helvetica,Arial,sans-serif;margin:0}
  body{padding:30px 24px;background:#f3f3f5}
  .t{max-width:440px;margin:0 auto;background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 14px 44px rgba(0,0,0,.14)}
  .h{background:linear-gradient(120deg,${A},${B});padding:22px 24px;color:#fff}
  .eye{font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.92}
  .ti{font-size:25px;font-weight:800;margin-top:6px;line-height:1.1}
  .qrw{text-align:center;padding:28px 24px 22px}
  .qrw img{border:1px solid #eee;border-radius:14px;padding:12px}
  .ref{font-family:monospace;font-size:12px;color:#8a8a8a;margin-top:12px;letter-spacing:1px}
  .perf{position:relative;height:2px;margin:6px 0}
  .perf .line{border-top:2px dashed #cfcfcf;margin:0 20px}
  .perf .nl,.perf .nr{position:absolute;top:-12px;width:24px;height:24px;border-radius:50%;background:#f3f3f5}
  .perf .nl{left:-12px}.perf .nr{right:-12px}
  .rows{padding:22px 24px 10px}
  .row{display:flex;align-items:flex-start;gap:12px;margin-bottom:16px}
  .ic{width:36px;height:36px;border-radius:10px;background:${B}1f;flex:0 0 auto}
  .lbl{font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#9a9a9a}
  .val{font-size:15px;font-weight:700;color:#161616;margin-top:3px}
  .blocks{display:flex;padding:18px 24px 2px}
  .b{flex:1}
  .b.mid{border-left:1px solid #ededed;border-right:1px solid #ededed;padding:0 14px;margin:0 14px}
  .bv{font-size:13px;font-weight:800;color:${B};margin-top:4px;letter-spacing:.3px}
  .pill{display:inline-block;background:${B}1f;color:${B};font-size:11px;font-weight:800;padding:6px 13px;border-radius:999px;letter-spacing:1px;margin:0 24px 8px}
  .foot{text-align:center;font-size:11px;color:#aeaeae;padding:16px}
</style></head><body>
  <div class="t">
    <div class="h"><div class="eye">Upgrade Talents · ${esc(p.type) || "Ticket"}</div><div class="ti">${esc(ev?.title) || "Event"}</div></div>
    <div class="qrw">${qrImg}<div class="ref">${esc(p.ref)}</div></div>
    <div class="perf"><div class="line"></div><div class="nl"></div><div class="nr"></div></div>
    <div class="blocks">
      <div class="b"><div class="lbl">Entry</div><div class="bv">${esc((p.type || "General").toUpperCase())}</div></div>
      <div class="b mid"><div class="lbl">Issued</div><div class="bv">${esc(issued)}</div></div>
      <div class="b"><div class="lbl">Status</div><div class="bv">${checked ? "USED" : expired ? "EXPIRED" : "VALID"}</div></div>
    </div>
    <div class="rows">
      <div class="row"><div class="ic"></div><div><div class="lbl">Holder</div><div class="val">${esc(p.holder) || "Guest"}</div></div></div>
      <div class="row"><div class="ic"></div><div><div class="lbl">Date &amp; Time</div><div class="val">${esc(dt)}</div></div></div>
      <div class="row"><div class="ic"></div><div><div class="lbl">Location</div><div class="val">${esc(ev?.venue) || "TBA"}</div></div></div>
    </div>
    <span class="pill">${checked ? "CHECKED IN" : expired ? "EXPIRED" : "VALID PASS"}</span>
    <div class="foot">Show this QR at the gate · one scan per pass</div>
  </div>
</body></html>`;
  };

  /**
   * Build the PDF once and keep it. Print writes into Expo Go's *unscoped*
   * cache, which the scoped file-permission service refuses to read — so we
   * never touch that file: we take the bytes back as base64 and write them
   * into our own sandbox, which is both readable and shareable.
   */
  const pdfRef = useRef<string | null>(null);
  const building = useRef<Promise<string> | null>(null);
  const gen = useRef(0);

  // Everything the PDF renders. The event arrives after first paint, so a PDF
  // built before that would be frozen with "Event / TBA" — bump the generation
  // on any change and throw the cached file away.
  const sig = [ev?._id, ev?.title, ev?.date, ev?.time, ev?.venue, p.ref, p.holder, p.type, issued, checked, expired].join("|");
  useEffect(() => { gen.current += 1; pdfRef.current = null; building.current = null; }, [sig]);

  const writePdf = async (): Promise<string> => {
    const qr = await captureQr();
    const res = await Print.printToFileAsync({ html: buildHtml(qr), base64: true });
    const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
    if (dir && res.base64) {
      const safeRef = (p.ref || "pass").replace(/[^a-zA-Z0-9-]/g, "");
      const dest = `${dir}UpgradeTalents-Ticket-${safeRef}.pdf`;
      await FileSystem.writeAsStringAsync(dest, res.base64, { encoding: "base64" });
      return dest;
    }
    return res.uri;
  };

  const buildPdf = (): Promise<string> => {
    if (pdfRef.current) return Promise.resolve(pdfRef.current);
    if (!building.current) {
      const g = gen.current;
      building.current = writePdf().then(
        (u) => { if (gen.current === g) { pdfRef.current = u; building.current = null; } return u; },
        (e) => { if (gen.current === g) building.current = null; throw e; }
      );
    }
    return building.current;
  };

  // Warm it up the moment the QR is drawable, so Share opens instantly.
  useEffect(() => { if (qrB64 && !loading) buildPdf().catch(() => {}); }, [qrB64, loading, sig]);

  const reasonOf = (e: any) => (String(e?.message || "").split(/Caused by:\s*/).pop() || "").trim();
  const cancelled = (e: any) => /dismiss|cancel|did not complete/i.test(String(e?.message || ""));

  const download = async () => {
    setBusy(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      const qr = await captureQr();
      // printAsync opens the native "Save as PDF" sheet — the reliable way to
      // land a file in the user's own storage on both platforms.
      await Print.printAsync({ html: buildHtml(qr) });
    } catch (e: any) {
      if (!cancelled(e)) popup.show("error", "Couldn't download", reasonOf(e) || "Could not generate the ticket PDF.");
    } finally { setBusy(false); }
  };

  /**
   * expo-sharing runs `Uri.parse(url).path`, which URL-decodes the path, while
   * Expo Go's sandbox lives at …/ExperienceData/%40anonymous%2Fslug/…. Escaping
   * our own '%' makes that decode land back on the real path; a standalone
   * build has no '%' in its path, so this is a no-op there.
   */
  const escaped = (u: string) => {
    const i = u.indexOf("://");
    return i < 0 ? u : u.slice(0, i + 3) + u.slice(i + 3).replace(/%/g, "%25");
  };

  /** Open our own sheet with the PDF already in hand. */
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePdf, setSharePdf] = useState<string | null>(null);

  const shareTicket = async () => {
    const warm = !!pdfRef.current;
    if (!warm) setBusy(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      setSharePdf(await buildPdf());
    } catch (e: any) {
      if (!cancelled(e)) popup.show("error", "Couldn't prepare the ticket", reasonOf(e) || "Please try again.");
      return;
    } finally { if (!warm) setBusy(false); }
    setShareOpen(true);
  };

  const statusTone = checked ? c.success : expired ? DEAD : LITE;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={c.barStyle === "light" ? "light" : "dark"} />

      {/* ambient colourway wash — the screen takes the ticket's own tone */}
      <Glow color={A} size={400} top={-150} right={-130} />
      <Glow color={B} size={330} top={260} left={-150} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 64, paddingHorizontal: 20, paddingBottom: 140 }}>
        <Rise v={intro} delay={0}>
          <Txt size={11} font="monoMed" tracking={3} uppercase style={{ color: LITE }}>Your pass</Txt>
          <Txt size={30} font="display" tracking={-1.2} style={{ marginTop: 6 }}>Admit One</Txt>
        </Rise>

        {/* ───────────────── THE PASS ───────────────── */}
        <Rise v={intro} delay={0.1} style={{ marginTop: 20 }}>
          <View style={{ borderRadius: 30, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, shadowColor: B, shadowOpacity: 0.45, shadowRadius: 26, shadowOffset: { width: 0, height: 16 }, elevation: 14 }}>
            {/* ── hero: the event's own artwork under the colourway ── */}
            <View style={{ height: 158 }}>
              <AppImage uri={ev?.image_url} seed={p.event_id || p.ref} style={{ position: "absolute", width: "100%", height: "100%" }} />
              <LinearGradient colors={[A + "d9", B + "f2"] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", width: "100%", height: "100%" }} />
              <View style={{ flex: 1, padding: 20, justifyContent: "flex-end" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, marginBottom: 9 }}>
                  <TicketIcon size={12} color="#fff" />
                  <Txt size={10} font="sansBold" tracking={1.5} uppercase style={{ color: "#fff" }}>{p.type || "Ticket"}</Txt>
                </View>
                {loading ? (
                  <Skeleton h={26} w="72%" />
                ) : (
                  <Txt size={25} font="display" tracking={-0.6} lh={28} numberOfLines={2} style={{ color: "#fff" }}>{ev?.title || "Event"}</Txt>
                )}
              </View>
              {expired ? (
                <View style={{ position: "absolute", top: 18, right: 16, backgroundColor: "rgba(239, 68, 68, 0.25)", borderWidth: 1, borderColor: "rgba(239, 68, 68, 0.5)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
                  <Txt size={10} font="sansBold" tracking={1} style={{ color: DEAD }}>EXPIRED</Txt>
                </View>
              ) : null}
            </View>

            {/* ── District Accent Bar ── */}
            <View style={{ height: 28, backgroundColor: "rgba(0,0,0,0.35)", borderTopWidth: 1, borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.08)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20 }}>
              <Txt size={10} font="monoMed" tracking={2} uppercase style={{ color: LITE }}>VERIFIED PASS</Txt>
              <Txt size={10} font="sansBold" tracking={1.5} uppercase style={{ color: "rgba(255,255,255,0.6)" }}>ADMIT ONE</Txt>
            </View>

            {/* ── QR, inside a live scanner frame ── */}
            <View style={{ alignItems: "center", paddingTop: 26, paddingBottom: 20 }}>
              <DottedGrid color={c.fgSubtle} opacity={0.12} gap={20} r={1.1} />
              <ScanFrame color={LITE} size={QR + 36}>
                <View style={{ backgroundColor: "#fff", padding: 14, borderRadius: 18 }}>
                  <QRCode value={p.ref || "UTI"} size={QR} backgroundColor="#fff" color={expired ? "#aeb4c0" : "#0b0b10"} getRef={(cv: any) => (qrRef.current = cv)} />
                  {expired ? (
                    <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderRadius: 18, backgroundColor: "rgba(15,17,27,0.76)", alignItems: "center", justifyContent: "center", gap: 8 }}>
                      <Ban size={46} color={DEAD} />
                      <Txt size={10.5} font="sansBold" tracking={2} style={{ color: DEAD }}>WON'T SCAN</Txt>
                    </View>
                  ) : null}
                </View>
              </ScanFrame>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 15 }}>
                <View style={{ width: 16, height: 1.5, backgroundColor: c.border }} />
                <Txt size={12.5} font="monoMed" tracking={2} style={{ color: c.fgMuted }}>{p.ref}</Txt>
                <View style={{ width: 16, height: 1.5, backgroundColor: c.border }} />
              </View>
            </View>

            {/* ── perforation (edge notches + manual dashes, Android-safe) ── */}
            <View style={{ height: 24, justifyContent: "center" }}>
              <View style={{ position: "absolute", left: -12, top: 0, width: 24, height: 24, borderRadius: 999, backgroundColor: c.bg }} />
              <View style={{ position: "absolute", right: -12, top: 0, width: 24, height: 24, borderRadius: 999, backgroundColor: c.bg }} />
              <View style={{ flexDirection: "row", marginHorizontal: 20, gap: 6, alignItems: "center" }}>
                {Array.from({ length: 22 }).map((_, i) => (
                  <View key={i} style={{ flex: 1, height: 2, borderRadius: 2, backgroundColor: c.border }} />
                ))}
              </View>
            </View>

            {/* ── stub: boarding-pass style blocks ── */}
            <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingTop: 16 }}>
              <Block label="Entry" value={(p.type || "General").toUpperCase()} tone={LITE} />
              <Divider />
              <Block label="Issued" value={issued} tone={LITE} />
              <Divider />
              <Block label="Status" value={checked ? "USED" : expired ? "EXPIRED" : "VALID"} tone={statusTone} />
            </View>

            {/* ── details ── */}
            <View style={{ padding: 20, paddingTop: 18, gap: 15 }}>
              <Detail v={intro} delay={0.24} tone={LITE} icon={<UserIcon size={18} color={LITE} />} label="Holder" value={p.holder || "Guest"} />
              <Detail v={intro} delay={0.3} tone={LITE} icon={<CalendarDays size={18} color={LITE} />} label="Date & Time" value={dt} />
              <Detail v={intro} delay={0.36} tone={LITE} icon={<MapPin size={18} color={LITE} />} label="Location" value={ev?.venue || "TBA"} />

              {checked ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.success + "1f", alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }}>
                  <CheckCircle2 size={15} color={c.success} />
                  <Txt size={11.5} font="sansBold" tone="success" tracking={1}>CHECKED IN</Txt>
                </View>
              ) : expired ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: DEAD + "1f", borderWidth: 1, borderColor: DEAD + "4d", borderRadius: 16, paddingHorizontal: 13, paddingVertical: 11 }}>
                  <CalendarX size={16} color={DEAD} />
                  <View style={{ flex: 1 }}>
                    <Txt size={11.5} font="sansBold" tracking={1} style={{ color: DEAD }}>EXPIRED PASS</Txt>
                    <Txt size={12.5} tone="muted" lh={17} style={{ marginTop: 3 }}>
                      {ended || "This event is over"} — the code no longer scans. Kept for your records.
                    </Txt>
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: LITE + "1f", alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 }}>
                  <PulseDot color={LITE} />
                  <Txt size={11.5} font="sansBold" tracking={1} style={{ color: LITE }}>VALID PASS</Txt>
                </View>
              )}
            </View>

            {/* holographic foil sweep across the whole pass */}
            <Shimmer width={CARD} />
          </View>
        </Rise>

        <Rise v={intro} delay={0.42}>
          <Txt size={12} tone="subtle" align="center" style={{ marginTop: 18, lineHeight: 18 }}>Show this QR at the gate — one scan per pass.</Txt>
        </Rise>
      </ScrollView>

      {/* Back */}
      <View style={{ position: "absolute", top: insets.top + 8, left: 16 }}>
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/(user)/tickets"))} style={{ width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.surfaceGlass, borderWidth: 1, borderColor: c.border }}>
          <ArrowLeft size={20} color={c.fg} />
        </Pressable>
      </View>

      <ShareSheet
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share your ticket"
        subtitle={ev?.title || "Event"}
        message={`My ticket for ${ev?.title || "the event"} — ${dt}${ev?.venue ? ` at ${ev.venue}` : ""}. Ref ${p.ref}.`}
        file={sharePdf ? { uri: sharePdf, mimeType: "application/pdf", label: "Send the ticket PDF" } : undefined}
      />

      {popup.node}

      {/* Action bar — tinted to the ticket, never flat orange */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 14, paddingBottom: insets.bottom + 14, backgroundColor: c.bgElevated, borderTopWidth: 1, borderTopColor: c.border, flexDirection: "row", gap: 12 }}>
        <Pressable onPress={download} disabled={busy} style={({ pressed }) => ({ flex: 1, transform: [{ scale: pressed ? 0.97 : 1 }], opacity: busy ? 0.65 : 1 })}>
          <LinearGradient colors={way.stub as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 56, borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, shadowColor: B, shadowOpacity: 0.5, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 8 }}>
            <Download size={17} color="#fff" />
            <Txt size={14.5} font="sansBold" tracking={0.4} style={{ color: "#fff" }}>{busy ? "Preparing…" : "Download ticket"}</Txt>
          </LinearGradient>
        </Pressable>
        <Pressable onPress={shareTicket} disabled={busy} style={({ pressed }) => ({ width: 56, height: 56, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: LITE + "66", backgroundColor: LITE + "14", transform: [{ scale: pressed ? 0.95 : 1 }] })}>
          <Share2 size={19} color={LITE} />
        </Pressable>
      </View>
    </View>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

/** Staggered rise-in driven by a single 0→1 progress value. */
function Rise({ v, delay = 0, children, style }: { v: Animated.Value; delay?: number; children: React.ReactNode; style?: any }) {
  const o = v.interpolate({ inputRange: [delay, Math.min(0.999, delay + 0.4)], outputRange: [0, 1], extrapolate: "clamp" });
  const ty = o.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });
  return <Animated.View style={[style, { opacity: o, transform: [{ translateY: ty }] }]}>{children}</Animated.View>;
}

/** Scanner brackets with a beam that keeps sweeping the QR. */
function ScanFrame({ color, size, children }: { color: string; size: number; children: React.ReactNode }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const ty = y.interpolate({ inputRange: [0, 1], outputRange: [10, size - 12] });
  const arm = 26;
  const corner = (s: any) => ({ position: "absolute" as const, width: arm, height: arm, borderColor: color, ...s });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={corner({ top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 14 })} />
      <View style={corner({ top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 14 })} />
      <View style={corner({ bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 14 })} />
      <View style={corner({ bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 14 })} />
      {children}
      <Animated.View pointerEvents="none" style={{ position: "absolute", left: 14, right: 14, height: 2, transform: [{ translateY: ty }] }}>
        <LinearGradient colors={["transparent", color, "transparent"] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, borderRadius: 2 }} />
      </Animated.View>
    </View>
  );
}

/** Foil shimmer that travels across the pass every few seconds. */
function Shimmer({ width }: { width: number }) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1100),
        Animated.timing(x, { toValue: 1, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const tx = x.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.5, width * 1.2] });
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", top: -60, bottom: -60, width: 110, transform: [{ translateX: tx }, { rotate: "16deg" }] }}>
      <LinearGradient colors={["rgba(255,255,255,0)", "rgba(255,255,255,0.20)", "rgba(255,255,255,0)"] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
    </Animated.View>
  );
}

/** Breathing dot for the live "valid" state. */
function PulseDot({ color }: { color: string }) {
  const s = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(s, { toValue: 1, duration: 1500, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={{ width: 9, height: 9, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute", width: 9, height: 9, borderRadius: 999, backgroundColor: color,
          opacity: s.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
          transform: [{ scale: s.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
        }}
      />
      <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: color }} />
    </View>
  );
}

function Block({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Txt size={9.5} font="monoMed" tone="subtle" tracking={2} uppercase>{label}</Txt>
      <Txt size={13} font="sansBold" tracking={0.3} numberOfLines={1} style={{ marginTop: 4, color: tone }}>{value}</Txt>
    </View>
  );
}

function Divider() {
  const { c } = useTheme();
  return <View style={{ width: 1, alignSelf: "stretch", backgroundColor: c.border, marginHorizontal: 14 }} />;
}

function Detail({ v, delay, icon, label, value, tone }: { v: Animated.Value; delay: number; icon: React.ReactNode; label: string; value: string; tone: string }) {
  const { c } = useTheme();
  return (
    <Rise v={v} delay={delay}>
      <View style={{ flexDirection: "row", gap: 13, alignItems: "flex-start" }}>
        <View style={{ width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: tone + "1c", borderWidth: 1, borderColor: tone + "33" }}>{icon}</View>
        <View style={{ flex: 1 }}>
          <Txt size={10.5} font="monoMed" tone="subtle" tracking={2} uppercase>{label}</Txt>
          <Txt size={15} font="sansBold" style={{ marginTop: 2, color: c.fg }} numberOfLines={2}>{value}</Txt>
        </View>
      </View>
    </Rise>
  );
}
