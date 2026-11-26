import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, ScrollView, Dimensions, Animated, Easing, StyleSheet, Linking, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import QRCode from "react-native-qrcode-svg";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft, CalendarDays, MapPin, User as UserIcon, Download,
  CheckCircle2, Share2, Ticket as TicketIcon, Ban, CalendarX, ChevronRight,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { bookingsApi, ApiError, type MyTicket } from "@/lib/api";
import { getEventById } from "@/lib/events";
import { useAsync } from "@/lib/useAsync";
import { Txt, Skeleton, Glow } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { usePopup } from "@/components/Popup";
import { ShareSheet } from "@/components/ShareSheet";
import { GoogleWalletButtonArt } from "@/components/GoogleWalletButton";
import { tierWay } from "@/components/TicketPass";
import { DottedGrid } from "@/components/patterns";
import { parseDate, isEventExpired, endedAgo, formatEventDate, formatINR, imageFor } from "@/lib/format";

const SCREEN = Dimensions.get("window").width;
const CARD = SCREEN - 40;
const QR = 196;

export default function TicketDetail() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = useLocalSearchParams<{
    ref: string;
    type?: string;
    holder?: string;
    issued?: string;
    checked?: string;
    event_id?: string;
    event_title?: string;
    event_date?: string;
    event_time?: string;
    event_venue?: string;
    event_cover?: string;
    price?: string;
  }>();

  const { data: ev, loading } = useAsync(
    () => (p.event_id && p.event_id !== "undefined" ? getEventById(String(p.event_id)) : Promise.resolve(null)),
    [p.event_id]
  );

  const tq = useAsync(() => bookingsApi.myTickets(), [p.ref]);
  const myTicket = useMemo(
    () => (Array.isArray(tq.data) ? tq.data.find((t) => t.ticket_ref === p.ref) : null),
    [tq.data, p.ref]
  );

  const eventTitle = p.event_title || ev?.title || myTicket?.event_title || "Event";
  const eventDate = p.event_date || ev?.date || myTicket?.event_date;
  const eventTime = p.event_time || ev?.time || myTicket?.event_time;
  const eventVenue = p.event_venue || ev?.venue || myTicket?.event_venue || "Venue to be announced";
  const holderName = myTicket?.holder_name || p.holder || "Guest";
  // everyone this QR admits (the gate scanner shows the same list)
  const holders = (myTicket?.holder_names || []).map((n) => String(n).trim()).filter(Boolean);
  const holderList = holders.length > 1 ? holders.join("\n") : holderName;
  const tierType = (myTicket?.ticket_type || p.type || "General").toUpperCase();
  // what was actually paid for this pass (the whole booking when it admits several people);
  // null when unknown — then no price is printed rather than an invented one
  const paid = myTicket?.total_amount ?? myTicket?.price ?? (p.price != null && p.price !== "" && !isNaN(Number(p.price)) ? Number(p.price) : null);
  const priceVal = paid == null ? null : Number(paid);
  // the event's own artwork — the same image on screen and in the PDF
  const cover = myTicket?.event_cover || p.event_cover || (ev as any)?.card_image_url || ev?.image_url;
  const bgImg = imageFor(cover, p.event_id || p.ref || 0);

  const checked = p.checked === "1" || myTicket?.is_checked_in;
  const expired = !checked && isEventExpired(eventDate, eventTime);
  const ended = expired ? endedAgo(eventDate, eventTime) : null;
  const DEAD = "#ff8e8e";
  const qrRef = useRef<any>(null);
  const [qrB64, setQrB64] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const popup = usePopup();

  const WALLET_ENABLED = false;
  const walletEligible = WALLET_ENABLED && Platform.OS === "android" && !checked && !expired && !!p.ref;
  const [wallet, setWallet] = useState<{ url?: string; why?: string } | null>(null);
  useEffect(() => {
    if (!walletEligible) return;
    let live = true;
    bookingsApi
      .googleWallet(String(p.ref))
      .then((r) => live && setWallet({ url: r?.save_url }))
      .catch((e) => live && setWallet({ why: e instanceof ApiError ? e.message : "Google Wallet isn't available right now." }));
    return () => { live = false; };
  }, [walletEligible, p.ref]);
  const showWallet = walletEligible && (!!wallet?.url || (__DEV__ && !!wallet?.why));
  const addToWallet = () => {
    Haptics.selectionAsync().catch(() => {});
    if (wallet?.url) Linking.openURL(wallet.url).catch(() => popup.show("error", "Couldn't open Google Wallet", "Please try again."));
    else popup.show("info", "Google Wallet", wallet?.why || "Not available yet.");
  };

  const way = tierWay(myTicket?.ticket_type || p.type, p.ref || p.event_id || "x");
  const STUB_INK = way.ink || "rgba(255, 255, 255, 0.95)";
  const [A, B] = way.grad;
  const LITE = way.stub[0];

  const intro = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(intro, { toValue: 1, duration: 820, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { try { qrRef.current?.toDataURL?.((d: string) => setQrB64(d)); } catch {} }, 350);
    return () => clearTimeout(t);
  }, [eventDate, p.ref]);

  const dt = (() => {
    const d = parseDate(eventDate);
    if (!d) return eventDate || "TBA";
    const date = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    return eventTime ? `${date} · ${eventTime}` : date;
  })();

  const issued = (() => {
    const d = parseDate(p.issued || myTicket?.issued_at);
    return d ? d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "Recently";
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

  /**
   * Generates the EXACT horizontal digital ticket pass from the Tickets tab (SS 4)
   * with full text, zero cut-off, matching colors, perforation notches, and QR stub!
   */
  const buildHtml = (qr: string | null) => {
    const qrImg = qr ? `<img src="data:image/png;base64,${qr}" style="width:78px;height:78px;display:block;" />` : "";
    const esc = (s?: string) => String(s || "").replace(/</g, "&lt;");
    const priceStr = priceVal == null ? "" : priceVal > 0 ? "₹" + priceVal.toLocaleString("en-IN") : "FREE";
    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Digital Entry Pass - ${esc(p.ref)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #08090C;
      color: #ffffff;
      padding: 30px 16px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .ticket-card {
      width: 100%;
      max-width: 580px;
      height: 218px;
      border-radius: 22px;
      overflow: hidden;
      display: flex;
      flex-direction: row;
      background: radial-gradient(circle at 70% 30%, rgba(255,255,255,0.14) 0%, transparent 60%), linear-gradient(135deg, ${A}, ${B});
      position: relative;
      box-shadow: 0 16px 40px rgba(0,0,0,0.65);
    }
    .ticket-main {
      flex: 1;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      z-index: 2;
      background: linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.50) 100%);
    }
    .tier-badge {
      display: inline-block;
      width: auto;
      max-width: fit-content;
      background: rgba(255, 255, 255, 0.26);
      border-radius: 999px;
      padding: 4px 12px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #ffffff;
      line-height: 1.2;
    }
    .event-title {
      font-size: 19px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1.22;
      margin-top: 8px;
      letter-spacing: -0.3px;
      word-wrap: break-word;
    }
    .event-meta {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.88);
      margin-top: 4px;
      font-weight: 500;
      line-height: 1.35;
      word-wrap: break-word;
    }
    .bottom-row {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: flex-end;
    }
    .holder-label {
      font-size: 8.5px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.65);
      font-weight: 700;
    }
    .holder-name {
      font-size: 14px;
      font-weight: 800;
      color: #ffffff;
      margin-top: 2px;
    }
    .price-pill {
      background: #ffffff;
      border-radius: 999px;
      padding: 4px 14px;
      font-size: 13.5px;
      font-weight: 800;
      color: ${way.grad[1]};
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .perforation-wrap {
      position: relative;
      width: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 5;
    }
    .perf-line {
      position: absolute;
      top: 12px;
      bottom: 12px;
      width: 2px;
      border-right: 2px dashed rgba(255, 255, 255, 0.7);
    }
    .notch-top {
      position: absolute;
      top: -10px;
      left: -10px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #08090C;
    }
    .notch-bottom {
      position: absolute;
      bottom: -10px;
      left: -10px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #08090C;
    }
    .ticket-stub {
      width: 124px;
      background: linear-gradient(135deg, ${LITE}, ${B});
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 10px;
      position: relative;
      z-index: 2;
    }
    .qr-box {
      background: #ffffff;
      padding: 7px;
      border-radius: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(0,0,0,0.18);
    }
    .stub-sub {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 1.2px;
      color: ${STUB_INK};
      text-transform: uppercase;
      margin-top: 7px;
    }
    .ref-code {
      font-family: monospace;
      font-size: 9.5px;
      font-weight: 700;
      color: ${STUB_INK};
      opacity: 0.85;
      letter-spacing: 1px;
      margin-top: 3px;
    }
    .footer-note {
      margin-top: 18px;
      font-size: 11px;
      color: #8E92A0;
      text-align: center;
      letter-spacing: 0.4px;
    }
  </style>
</head>
<body>
  <div class="ticket-card">
    <div class="ticket-main">
      <!-- Background Performer Artwork & Overlay matching in-app TicketPass -->
      <img src="${esc(bgImg)}" style="position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;opacity:0.38;z-index:1;" />
      <div style="position:absolute;left:0;top:0;width:100%;height:100%;background:linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.52) 100%);z-index:2;"></div>

      <div style="position:relative;z-index:3;">
        <div style="display:flex;align-items:flex-start;">
          <span class="tier-badge">${esc(tierType)}</span>
        </div>
        <div class="event-title">${esc(eventTitle)}</div>
        <div class="event-meta">${esc(dt)}${eventVenue ? ' · ' + esc(eventVenue) : ''}</div>
      </div>
      <div class="bottom-row" style="position:relative;z-index:3;">
        <div>
          <div class="holder-label">HOLDER</div>
          <div class="holder-name">${esc(holderName)}</div>
        </div>
        ${priceStr ? `<div class="price-pill">${priceStr}</div>` : ""}
      </div>
    </div>

    <div class="perforation-wrap">
      <div class="notch-top"></div>
      <div class="perf-line"></div>
      <div class="notch-bottom"></div>
    </div>

    <div class="ticket-stub">
      <div class="qr-box">
        ${qrImg}
      </div>
      <div class="stub-sub">VIEW &gt;</div>
      <div class="ref-code">${esc(p.ref)}</div>
    </div>
  </div>

  <div class="footer-note">
    Official Digital Entry Pass · Upgrade Talents India · One scan per pass at the gate
  </div>
</body>
</html>`;
  };

  const pdfRef = useRef<string | null>(null);
  const building = useRef<Promise<string> | null>(null);
  const gen = useRef(0);

  const sig = [eventTitle, eventDate, eventTime, eventVenue, p.ref, holderName, tierType, issued, checked, expired, priceVal].join("|");
  useEffect(() => { gen.current += 1; pdfRef.current = null; building.current = null; }, [sig]);

  const writePdf = async (): Promise<string> => {
    const qr = await captureQr();
    const res = await Print.printToFileAsync({ html: buildHtml(qr), base64: true });
    const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
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

  useEffect(() => { if (qrB64 && !loading) buildPdf().catch(() => {}); }, [qrB64, loading, sig]);

  const reasonOf = (e: any) => (String(e?.message || "").split(/Caused by:\s*/).pop() || "").trim();
  const isCancelled = (e: any) => /dismiss|cancel|did not complete|rejected/i.test(String(e?.message || ""));

  const download = async () => {
    setBusy(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      const uri = await buildPdf();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `Ticket Pass - ${p.ref}`,
        });
      } else {
        popup.show("success", "Ticket downloaded", "Pass is ready in your files.");
      }
    } catch (e: any) {
      if (!isCancelled(e)) popup.show("error", "Couldn't download", reasonOf(e) || "Could not generate the ticket PDF.");
    } finally { setBusy(false); }
  };

  const [shareOpen, setShareOpen] = useState(false);
  const [sharePdf, setSharePdf] = useState<string | null>(null);

  const shareTicket = async () => {
    const warm = !!pdfRef.current;
    if (!warm) setBusy(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      setSharePdf(await buildPdf());
    } catch (e: any) {
      if (!isCancelled(e)) popup.show("error", "Couldn't prepare the ticket", reasonOf(e) || "Please try again.");
      return;
    } finally { if (!warm) setBusy(false); }
    setShareOpen(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={c.barStyle === "light" ? "light" : "dark"} />

      <Glow color={A} size={400} top={-150} right={-130} />
      <Glow color={B} size={330} top={260} left={-150} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 64, paddingHorizontal: 20, paddingBottom: showWallet ? 190 : 130 }}>
        <Rise v={intro} delay={0}>
          <Txt size={11} font="monoMed" tracking={3} uppercase style={{ color: LITE }}>Your pass</Txt>
          <Txt size={30} font="display" tracking={-1.2} style={{ marginTop: 6 }}>Admit One</Txt>
        </Rise>

        {/* ───────────────── THE PASS ───────────────── */}
        <Rise v={intro} delay={0.1} style={{ marginTop: 20 }}>
          <View style={{ borderRadius: 30, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, shadowColor: B, shadowOpacity: 0.45, shadowRadius: 26, shadowOffset: { width: 0, height: 16 }, elevation: 14 }}>
            {/* ── hero: the event's own artwork under the colourway ── */}
            <View style={{ minHeight: 168 }}>
              <AppImage uri={cover} seed={p.event_id || p.ref} style={{ position: "absolute", width: "100%", height: "100%" }} />
              <LinearGradient colors={[A + "d9", B + "f2"] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", width: "100%", height: "100%" }} />
              <View style={{ flex: 1, padding: 20, justifyContent: "flex-end" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", backgroundColor: "rgba(0,0,0,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, marginBottom: 9 }}>
                  <TicketIcon size={12} color="#fff" />
                  <Txt size={10} font="sansBold" tracking={1.5} uppercase style={{ color: "#fff" }}>{tierType}</Txt>
                </View>
                <Txt size={24} font="display" tracking={-0.6} lh={29} style={{ color: "#fff" }}>
                  {eventTitle}
                </Txt>
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

            {/* ── stub: boarding-pass style blocks (Status removed as per user request, Entry expanded to prevent truncation) ── */}
            <View style={{ flexDirection: "row", paddingHorizontal: 20, paddingTop: 16 }}>
              <View style={{ flex: 1.4, paddingRight: 10 }}>
                <Txt size={9.5} font="monoMed" tone="subtle" tracking={2} uppercase>Entry</Txt>
                <Txt size={14} font="sansBold" tracking={0.3} style={{ marginTop: 4, color: LITE }}>{tierType}</Txt>
              </View>
              <Divider />
              <View style={{ flex: 1, paddingLeft: 10 }}>
                <Txt size={9.5} font="monoMed" tone="subtle" tracking={2} uppercase>Issued</Txt>
                <Txt size={14} font="sansBold" tracking={0.3} style={{ marginTop: 4, color: LITE }}>{issued}</Txt>
              </View>
            </View>

            {/* ── details (full venue & date, no truncation) ── */}
            <View style={{ padding: 20, paddingTop: 18, gap: 15 }}>
              <Detail v={intro} delay={0.24} tone={LITE} icon={<UserIcon size={18} color={LITE} />} label={holders.length > 1 ? `Admits ${holders.length}` : "Holder"} value={holderList} />
              <Detail v={intro} delay={0.3} tone={LITE} icon={<CalendarDays size={18} color={LITE} />} label="Date & Time" value={dt} />
              <Detail v={intro} delay={0.36} tone={LITE} icon={<MapPin size={18} color={LITE} />} label="Location" value={eventVenue} />

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
          <Pressable
            onPress={() => {
              const target =
                myTicket?.booking_reference ||
                myTicket?.booking_ref ||
                myTicket?.booking_id ||
                p.ref;
              router.push({ pathname: "/(more)/bookings/[id]", params: { id: target } });
            }}
            style={({ pressed }) => ({
              alignSelf: "center",
              marginTop: 14,
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: "rgba(255, 255, 255, 0.06)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.1)",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Txt size={12} font="sansBold" style={{ color: "#ffffff" }}>
              View order details & bill summary
            </Txt>
            <ChevronRight size={14} color="#9EA3B8" />
          </Pressable>
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
        subtitle={eventTitle}
        message={`My ticket for ${eventTitle} — ${dt}${eventVenue ? ` at ${eventVenue}` : ""}. Ref ${p.ref}.`}
        file={sharePdf ? { uri: sharePdf, mimeType: "application/pdf", label: "Send the ticket PDF" } : undefined}
      />

      {popup.node}

      {/* Action bar — tinted to the ticket, never flat orange */}
      <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: insets.bottom + 12, backgroundColor: c.bgElevated, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border, gap: 10 }}>
        {showWallet ? (
          <Pressable onPress={addToWallet} accessibilityRole="button" accessibilityLabel="Add to Google Wallet" style={({ pressed }) => ({ alignSelf: "center", opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
            <GoogleWalletButtonArt height={40} />
          </Pressable>
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable onPress={download} disabled={busy} style={({ pressed }) => ({ flex: 1, transform: [{ scale: pressed ? 0.97 : 1 }], opacity: busy ? 0.65 : 1 })}>
            <LinearGradient colors={way.stub as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 48, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Download size={16} color={way.ink || "#fff"} />
              <Txt size={14} font="sansSemi" style={{ color: way.ink || "#fff" }}>{busy ? "Preparing…" : "Download ticket"}</Txt>
            </LinearGradient>
          </Pressable>
          <Pressable onPress={shareTicket} disabled={busy} accessibilityLabel="Share ticket" style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: LITE + "55", backgroundColor: LITE + "12", transform: [{ scale: pressed ? 0.94 : 1 }] })}>
            <Share2 size={18} color={LITE} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/* ───────────────────────── pieces ───────────────────────── */

function Rise({ v, delay = 0, children, style }: { v: Animated.Value; delay?: number; children: React.ReactNode; style?: any }) {
  const o = v.interpolate({ inputRange: [delay, Math.min(0.999, delay + 0.4)], outputRange: [0, 1], extrapolate: "clamp" });
  const ty = o.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });
  return <Animated.View style={[style, { opacity: o, transform: [{ translateY: ty }] }]}>{children}</Animated.View>;
}

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
  const card = size - 8;
  const BAND = 34;
  const ty = y.interpolate({ inputRange: [0, 1], outputRange: [-BAND / 2 + 6, card - BAND / 2 - 6] });
  const arm = 26;
  const corner = (s: any) => ({ position: "absolute" as const, width: arm, height: arm, borderColor: color, ...s });

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={corner({ top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 14 })} />
      <View style={corner({ top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 14 })} />
      <View style={corner({ bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 14 })} />
      <View style={corner({ bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 14 })} />
      {children}
      <View pointerEvents="none" style={{ position: "absolute", top: 4, left: 4, width: card, height: card, borderRadius: 18, overflow: "hidden" }}>
        <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, height: BAND, justifyContent: "center", transform: [{ translateY: ty }] }}>
          <LinearGradient
            colors={["transparent", color + "33", "transparent"] as any}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={["transparent", color, color, "transparent"] as any}
            locations={[0, 0.2, 0.8, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 2.5, marginHorizontal: 10, borderRadius: 2 }}
          />
        </Animated.View>
      </View>
    </View>
  );
}

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
          <Txt size={15} font="sansBold" style={{ marginTop: 2, color: c.fg, lineHeight: 21 }}>{value}</Txt>
        </View>
      </View>
    </Rise>
  );
}
