import React, { useRef, useState } from "react";
import { View, Modal, Pressable, ActivityIndicator } from "react-native";
import { WebView, type WebViewInstance } from "@/components/vendor";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, Lock, RotateCw } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";

/**
 * A browser that stays inside the app.
 *
 * Used for consent flows (DigiLocker) where handing the user off to Chrome
 * loses the thread. `doneUrlPattern` tells us the flow has finished — the
 * sheet closes itself the moment the provider redirects back to us.
 */
export function InAppBrowser({
  visible,
  url,
  title = "Secure",
  doneUrlPattern,
  onDone,
  onClose,
}: {
  visible: boolean;
  url: string | null;
  title?: string;
  /** Any URL matching this means the flow completed. */
  doneUrlPattern?: RegExp;
  onDone: () => void;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState("");
  const settled = useRef(false);
  const webRef = useRef<WebViewInstance>(null);

  const handleNav = (navState: { url: string }) => {
    const u = navState.url || "";
    try { setHost(new URL(u).host); } catch {}
    if (!settled.current && doneUrlPattern && doneUrlPattern.test(u)) {
      settled.current = true;
      onDone();
    }
  };

  const close = () => {
    if (settled.current) return;
    settled.current = true;
    onClose();
  };

  // ready for the next open
  if (visible && settled.current && loading) settled.current = false;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.border }}>
          <View style={{ width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: c.success + "1f" }}>
            <Lock size={16} color={c.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt size={14.5} font="sansBold" numberOfLines={1}>{title}</Txt>
            {host ? <Txt size={11.5} tone="muted" numberOfLines={1}>{host}</Txt> : null}
          </View>
          <Pressable onPress={() => webRef.current?.reload()} style={{ width: 38, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border }}>
            <RotateCw size={16} color={c.fgMuted} />
          </Pressable>
          <Pressable onPress={close} style={{ width: 38, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border }}>
            <X size={18} color={c.fg} />
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          {url ? (
            <WebView
              ref={webRef}
              source={{ uri: url }}
              onNavigationStateChange={handleNav}
              onLoadEnd={() => setLoading(false)}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              setSupportMultipleWindows={false}
              style={{ flex: 1, backgroundColor: "transparent" }}
            />
          ) : null}

          {loading ? (
            <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: c.bg, gap: 14 }}>
              <ActivityIndicator size="large" color={c.accent} />
              <Txt size={13} tone="muted">Opening securely…</Txt>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
