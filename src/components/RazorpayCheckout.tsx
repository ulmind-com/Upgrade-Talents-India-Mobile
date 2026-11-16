import React, { useMemo, useRef, useState } from "react";
import { View, Modal, Pressable, ActivityIndicator, Linking } from "react-native";
import { WebView } from "@/components/vendor";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, ShieldCheck } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";

/** Default fallback test key matching the Next.js website (BookingFlow / CartProvider). */
export const DEFAULT_RAZORPAY_KEY =
  process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_TBRo7AUeaKIhKB";

/**
 * Validates whether an order id is a genuine Razorpay Orders API order id.
 * Mock/dummy order ids like "order_rzp_..." will cause checkout.js to fail with:
 * "The order_id provided is invalid". Standard checkout works seamlessly when
 * order_id is omitted.
 */
export function isValidRazorpayOrderId(orderId?: string | null): boolean {
  if (!orderId || typeof orderId !== "string") return false;
  if (orderId.startsWith("order_rzp_")) return false;
  return /^order_[A-Za-z0-9]{14,}$/.test(orderId);
}

export type RazorpayOptions = {
  key?: string;
  /** Amount in paise, as Razorpay expects. */
  amount: number;
  currency?: string;
  name?: string;
  description?: string;
  order_id?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
};

export type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
};

/**
 * Razorpay's hosted checkout, run inside a WebView.
 *
 * This is the same `checkout.js` the website loads, so the payment methods,
 * 3-D Secure step and test-mode behaviour are identical — and because it is
 * the hosted page, card details never touch our code. It also keeps working
 * in Expo Go, which a native Razorpay SDK would not.
 *
 * The result is only ever a claim from the client, so nothing is trusted here:
 * the caller sends the signature to the backend, which verifies it before the
 * booking is confirmed.
 */
export function RazorpayCheckout({
  visible, options, onSuccess, onFailure, onDismiss,
}: {
  visible: boolean;
  options: RazorpayOptions | null;
  onSuccess: (r: RazorpaySuccess) => void;
  onFailure: (message: string) => void;
  onDismiss: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const settled = useRef(false);

  // A fresh page per attempt, so a retry never reuses a closed checkout.
  const html = useMemo(() => (options ? buildHtml(options) : ""), [options?.order_id, options?.amount, options?.key]);

  const handle = (raw: string) => {
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg?.event === "ready") { setLoading(false); return; }
    if (settled.current) return;

    if (msg?.event === "success") {
      settled.current = true;
      onSuccess(msg.payload as RazorpaySuccess);
    } else if (msg?.event === "failed") {
      settled.current = true;
      onFailure(msg?.payload?.description || "Payment failed. No amount was charged — please try again.");
    } else if (msg?.event === "dismissed") {
      settled.current = true;
      onDismiss();
    }
  };

  const close = () => {
    if (settled.current) return;
    settled.current = true;
    onDismiss();
  };

  // reset for the next attempt whenever the sheet is reopened
  if (visible && settled.current && loading) settled.current = false;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <View style={{ width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: c.accent + "1f" }}>
            <ShieldCheck size={17} color={c.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={14.5} font="sansBold">Secure payment</Txt>
            <Txt size={11.5} tone="muted">Processed by Razorpay</Txt>
          </View>
          <Pressable onPress={close} style={{ width: 38, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border }}>
            <X size={18} color={c.fg} />
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          {options ? (
            <WebView
              originWhitelist={["*"]}
              source={{ html, baseUrl: "https://upgradetalentsindia.in" }}
              onMessage={(e) => handle(e.nativeEvent.data)}
              javaScriptEnabled
              domStorageEnabled
              setSupportMultipleWindows={false}
              startInLoadingState={false}
              onShouldStartLoadWithRequest={(request) => {
                const url = request.url;
                if (
                  !url ||
                  url.startsWith("about:") ||
                  url.startsWith("data:") ||
                  url.startsWith("http://") ||
                  url.startsWith("https://")
                ) {
                  return true;
                }
                // External deep-links (upi://, intent://, paytmmp://, phonepe://, tez://)
                Linking.canOpenURL(url)
                  .then((supported) => {
                    if (supported) {
                      Linking.openURL(url).catch(() => {});
                    }
                  })
                  .catch(() => {});
                return false;
              }}
              onError={(syntheticEvent) => {
                const desc = syntheticEvent?.nativeEvent?.description || "";
                if (
                  desc.includes("net::ERR_UNKNOWN_URL_SCHEME") ||
                  desc.includes("ERR_UNKNOWN_URL_SCHEME")
                ) {
                  return;
                }
                if (!settled.current) {
                  settled.current = true;
                  onFailure("Could not reach the payment gateway. Check your connection and retry.");
                }
              }}
              style={{ flex: 1, backgroundColor: "transparent" }}
            />
          ) : null}

          {loading ? (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: c.bg, gap: 14 }}>
              <ActivityIndicator size="large" color={c.accent} />
              <Txt size={13} tone="muted">Opening secure checkout…</Txt>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

/** The checkout page. Every outcome is posted back to the app as one message. */
function buildHtml(o: RazorpayOptions) {
  const cleanOrderId = isValidRazorpayOrderId(o.order_id) ? o.order_id : undefined;
  const opts: Record<string, any> = {
    key: o.key || DEFAULT_RAZORPAY_KEY,
    amount: o.amount,
    currency: o.currency || "INR",
    name: o.name || "Upgrade Talents India",
    description: o.description || "Ticket purchase",
    prefill: o.prefill || {},
    notes: o.notes || {},
    theme: { color: o.theme?.color || "#FF385C" },
  };
  if (cleanOrderId) {
    opts.order_id = cleanOrderId;
  }

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <style>
    html,body{margin:0;padding:0;height:100%;background:transparent;font-family:-apple-system,Helvetica,Arial,sans-serif}
  </style>
</head>
<body>
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <script>
    var post = function (event, payload) {
      try { window.ReactNativeWebView.postMessage(JSON.stringify({ event: event, payload: payload || null })); } catch (e) {}
    };

    function start() {
      if (!window.Razorpay) {
        post("failed", { description: "Could not load the payment gateway." });
        return;
      }
      var options = ${JSON.stringify(opts)};

      options.handler = function (response) {
        post("success", {
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id || "",
          razorpay_signature: response.razorpay_signature || ""
        });
      };
      options.modal = {
        escape: true,
        ondismiss: function () { post("dismissed"); }
      };

      var rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (r) {
        post("failed", { description: (r && r.error && r.error.description) || "Payment failed." });
      });
      post("ready");
      rzp.open();
    }

    // checkout.js may still be loading when this runs
    if (window.Razorpay) start();
    else {
      var tries = 0;
      var t = setInterval(function () {
        tries++;
        if (window.Razorpay) { clearInterval(t); start(); }
        else if (tries > 100) { clearInterval(t); post("failed", { description: "The payment gateway did not respond. Check your connection and retry." }); }
      }, 100);
    }
  </script>
</body>
</html>`;
}
