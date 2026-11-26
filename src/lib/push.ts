import { useEffect } from "react";
import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import type * as NotificationsModule from "expo-notifications";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { router } from "expo-router";
import { extrasApi } from "@/lib/api";

/* ──────────────────────────────────────────────────────────────────────────
   Push notifications — FCM, as the backend sends them.

   The backend's dispatcher (notification_dispatcher.py) sends an FCM message
   with a notification (title/body) and a data payload:
     notification_id · type · resource_type · resource_id · action_url · sound_category
   to every active device token registered for the user
   (POST /api/notifications/devices).

   So this module:
   • creates the Android channel the system shows them on,
   • asks for permission (Android 13+), gets the *native FCM token*
     (getDevicePushTokenAsync — not an Expo push token) and registers it,
   • re-registers when FCM rotates the token,
   • shows pushes while the app is open,
   • opens the right screen when one is tapped (cold start included),
   • unregisters the device on logout.

   The small status-bar icon is assets/notification-icon.png (white silhouette
   of the logo, tinted with the brand colour) — set in app.json's
   expo-notifications plugin. Android only for now: the backend's iOS path
   (APNs) is still a mock, and FCM can't take raw APNs tokens.
   ────────────────────────────────────────────────────────────────────────── */

const DEVICE_KEY = "uti_push_device";
export const PUSH_CHANNEL = "default";

/* Expo Go has had no remote push since SDK 53, and expo-notifications throws
   for the push APIs there — so in Expo Go the module is never even loaded and
   everything below is a no-op. (Same check the library itself uses.) */
const inExpoGo = isRunningInExpoGo();
const Notifications: typeof NotificationsModule | null = inExpoGo ? null : require("expo-notifications");

/** Real Android build on a real phone. */
export const pushSupported = !!Notifications && Platform.OS === "android" && Device.isDevice;

// a push that arrives while the app is open still shows as a banner
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function ensureChannel() {
  if (!Notifications || Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(PUSH_CHANNEL, {
    name: "Updates",
    description: "Bookings, competitions, results and announcements",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    vibrationPattern: [0, 220, 120, 220],
    lightColor: "#F9862B",
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

type Stored = { id: string; token: string };
const readStored = async (): Promise<Stored | null> => {
  try {
    const v = await SecureStore.getItemAsync(DEVICE_KEY);
    return v ? (JSON.parse(v) as Stored) : null;
  } catch {
    return null;
  }
};

let registering: Promise<void> | null = null;

/** Ask (once) for permission and register this phone's FCM token with the backend. */
export function registerForPush(opts: { ask?: boolean } = {}): Promise<void> {
  if (!pushSupported || !Notifications) return Promise.resolve();
  if (registering) return registering;
  registering = (async () => {
    try {
      await ensureChannel();
      let perm = await Notifications.getPermissionsAsync();
      if (!perm.granted && perm.canAskAgain && opts.ask !== false) perm = await Notifications.requestPermissionsAsync();
      if (!perm.granted) return;

      // fails until google-services.json is in the build — then we simply skip
      const tok = await Notifications.getDevicePushTokenAsync();
      const token = String(tok?.data || "");
      if (token.length < 10) return;

      const res = await extrasApi.registerDevice({
        provider_token: token,
        platform: "ANDROID",
        app_identifier: Constants.expoConfig?.android?.package || "in.upgradetalents.app",
        device_label: [Device.manufacturer, Device.modelName].filter(Boolean).join(" ").slice(0, 100) || undefined,
      });
      if (res?.id) await SecureStore.setItemAsync(DEVICE_KEY, JSON.stringify({ id: res.id, token } satisfies Stored));
    } catch {
      // no Firebase config / offline / backend down — try again next launch
    } finally {
      registering = null;
    }
  })();
  return registering;
}

/** Stop pushes to this phone (call before the session token is cleared). */
export async function unregisterPush() {
  const stored = await readStored();
  if (stored?.id) await extrasApi.unregisterDevice(stored.id).catch(() => {});
  await SecureStore.deleteItemAsync(DEVICE_KEY).catch(() => {});
}

/* ── where a tapped notification should land ── */

/** Map the backend's website-style `action_url` (or resource) to an app route. */
export function routeForNotification(data: Record<string, any> | undefined): string {
  const d = data || {};
  const raw = String(d.action_url || "").trim();
  const path = raw.replace(/^https?:\/\/[^/]+/i, "") || "";
  const [p] = path.split(/[?#]/);
  const comp = /[?&](?:competition|comp_id|id)=([^&#]+)/i.exec(path)?.[1];
  let m: RegExpMatchArray | null;

  if ((m = p.match(/^\/competitions\/([^/]+)\/results/i))) return `/(more)/competitions/${m[1]}/results`;
  if ((m = p.match(/^\/competitions\/([^/]+)/i))) return `/(more)/competitions/${m[1]}`;
  if (/^\/competitions\/?$/i.test(p)) return "/(more)/competitions";
  if (/^\/leaderboard/i.test(p)) return comp ? `/(more)/leaderboard?competition=${comp}` : "/(more)/leaderboard";
  if ((m = p.match(/^\/events\/([^/]+)/i))) return `/(user)/events/${m[1]}`;
  if (/^\/events\/?$/i.test(p)) return "/(user)/events";
  if (/^\/live/i.test(p)) return "/(more)/live";
  if (/^\/vip/i.test(p)) return "/(more)/vip";
  if (/^\/(tickets|bookings|dashboard\/tickets)/i.test(p)) return "/(user)/tickets";
  if (/^\/certificates/i.test(p)) return "/(more)/certificates";
  if ((m = p.match(/^\/verify\/([^/]+)/i))) return `/(more)/verify?token=${m[1]}`;
  if (/^\/(rewards|referrals)/i.test(p)) return "/(more)/rewards";
  if (/^\/shop/i.test(p)) return "/(more)/shop";

  const rid = String(d.resource_id || "");
  const rt = String(d.resource_type || "");
  if (rid && /competition/i.test(rt)) return `/(more)/competitions/${rid}`;
  if (rid && /event/i.test(rt)) return `/(user)/events/${rid}`;
  return "/(more)/notifications";
}

function openFromNotification(resp: NotificationsModule.NotificationResponse | null) {
  if (!resp) return;
  const data = (resp.notification.request.content.data || {}) as Record<string, any>;
  if (data.notification_id) extrasApi.markRead(String(data.notification_id)).catch(() => {});
  const to = routeForNotification(data);
  setTimeout(() => {
    try {
      router.push(to as any);
    } catch {}
  }, 300);
}

/**
 * Mount once inside the session: registers when signed in, keeps the token
 * fresh, and routes taps (including the tap that launched the app).
 */
export function usePushSetup(signedIn: boolean) {
  useEffect(() => {
    if (signedIn) registerForPush();
  }, [signedIn]);

  useEffect(() => {
    if (!pushSupported || !Notifications) return;
    const sub = Notifications.addPushTokenListener(() => {
      if (signedIn) registerForPush({ ask: false });
    });
    return () => sub.remove();
  }, [signedIn]);

  useEffect(() => {
    if (!Notifications) return;
    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (r) {
          openFromNotification(r);
          Notifications?.clearLastNotificationResponseAsync().catch(() => {});
        }
      })
      .catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(openFromNotification);
    return () => sub.remove();
  }, []);
}
