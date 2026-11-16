import { useEffect, useState } from "react";
import Constants from "expo-constants";
import { authApi } from "@/lib/api";

const cfg = (Constants.expoConfig?.extra as any)?.google || {};

/**
 * Google SSO is OFF until OAuth client IDs are filled into
 * app.json → expo.extra.google. Until then a stub hook is used so nothing
 * renders (and nothing throws) — expo-auth-session's Google hook raises if the
 * platform's client id is missing, which would crash the login screen.
 *
 * Also note: Google OAuth needs a dev/production build; it cannot work in Expo Go.
 */
export const googleConfigured = !!(cfg.webClientId && cfg.androidClientId && cfg.iosClientId);

type GoogleAuth = { signIn: () => void; busy: boolean; error: string | null; ready: boolean };

function useGoogleAuthStub(_onToken: (t: string) => Promise<void> | void): GoogleAuth {
  return { signIn: () => {}, busy: false, error: null, ready: false };
}

function useGoogleAuthReal(onToken: (accessToken: string) => Promise<void> | void): GoogleAuth {
  // Imported lazily so the module isn't evaluated when SSO is disabled.
  const Google = require("expo-auth-session/providers/google");
  const WebBrowser = require("expo-web-browser");
  WebBrowser.maybeCompleteAuthSession();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: cfg.webClientId,
    androidClientId: cfg.androidClientId,
    iosClientId: cfg.iosClientId,
  });

  useEffect(() => {
    if (response?.type !== "success") {
      if (response?.type === "error") { setError("Google sign-in failed."); setBusy(false); }
      return;
    }
    const idToken = response.params?.id_token || response.authentication?.idToken;
    if (!idToken) { setError("No Google token received."); setBusy(false); return; }
    (async () => {
      try {
        const res = await authApi.googleLogin(idToken);
        await onToken(res.access_token);
      } catch (e: any) {
        setError(e?.message || "Could not sign in with Google.");
      } finally { setBusy(false); }
    })();
  }, [response]);

  const signIn = async () => {
    setError(null); setBusy(true);
    try { await promptAsync(); } catch { setBusy(false); }
  };

  return { signIn, busy, error, ready: !!request };
}

// Chosen once at module load — the condition never changes, so hook order is stable.
export const useGoogleAuth: (onToken: (t: string) => Promise<void> | void) => GoogleAuth =
  googleConfigured ? useGoogleAuthReal : useGoogleAuthStub;
