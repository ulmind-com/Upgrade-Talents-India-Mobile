import { useCallback, useState } from "react";
import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import { authApi, ApiError } from "@/lib/api";

/* ──────────────────────────────────────────────────────────────────────────
   Google sign-in — native (Play Services account picker), release-build ready.

   1. @react-native-google-signin shows the system account sheet and returns a
      Google ID token for the project's *Web* OAuth client (webClientId).
   2. That token is exchanged for a Firebase ID token (Identity Toolkit
      `signInWithIdp`) — the same Firebase project and user the website uses,
      which the backend verifies strictly with the Firebase Admin SDK.
   3. POST /api/auth/google-login → our JWT.

   If the Firebase exchange is unavailable we fall back to sending the Google
   ID token itself (the backend also accepts those), so sign-in never hard-fails
   on configuration.

   Config (app.config.js fills these from google-services.json automatically):
     extra.google.webClientId   Web OAuth client id (…apps.googleusercontent.com)
     extra.firebase.apiKey      Firebase Web API key
   Needs a development/production build — the native module isn't in Expo Go.
   ────────────────────────────────────────────────────────────────────────── */

const extra = (Constants.expoConfig?.extra as any) || {};
const webClientId: string = extra.google?.webClientId || "";
const firebaseApiKey: string = extra.firebase?.apiKey || "";

let GS: typeof import("@react-native-google-signin/google-signin") | null = null;
if (!isRunningInExpoGo()) {
  try {
    // native module — absent in Expo Go; Google sign-in is then simply hidden
    GS = require("@react-native-google-signin/google-signin");
  } catch {
    GS = null;
  }
}

const inExpoGo = isRunningInExpoGo();
/** Google sign-in can actually run here (installed build with the native module). */
export const googleConfigured = !!webClientId && !!GS && !inExpoGo;
/** Show the button: configured for the app — in Expo Go it explains it needs the installed build. */
export const googleVisible = !!webClientId;

let configured = false;
function ensureConfigured() {
  if (configured || !GS) return;
  GS.GoogleSignin.configure({ webClientId, offlineAccess: false, scopes: ["email", "profile"] });
  configured = true;
}

/** Google ID token → Firebase ID token for the same project; null if it can't be done. */
async function toFirebaseToken(googleIdToken: string): Promise<string | null> {
  if (!firebaseApiKey) return null;
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(firebaseApiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postBody: `id_token=${encodeURIComponent(googleIdToken)}&providerId=google.com`,
        requestUri: "http://localhost",
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    return typeof j?.idToken === "string" ? j.idToken : null;
  } catch {
    return null;
  }
}

/** Human message for the sign-in error codes worth explaining. */
function explain(e: any): string | null {
  const code = String(e?.code ?? "");
  const s = GS?.statusCodes;
  if (s && code === String(s.SIGN_IN_CANCELLED)) return null; // user backed out
  if (s && code === String(s.IN_PROGRESS)) return "Sign-in is already in progress.";
  if (s && code === String(s.PLAY_SERVICES_NOT_AVAILABLE)) return "Google Play services is missing or out of date on this device.";
  // DEVELOPER_ERROR (10): Play App Signing SHA-1 or Web Client ID isn't matched in Firebase/Google Cloud
  if (code === "10" || /DEVELOPER_ERROR/i.test(String(e?.message))) {
    return "Google sign-in isn't set up for this app build yet (Play signing SHA-1 not matched, code 10).";
  }
  // SIGN_IN_FAILED (12500): Firebase support email / OAuth consent screen not published
  if (code === "12500" || /12500|SIGN_IN_FAILED/i.test(String(e?.message))) {
    return "Google sign-in could not start (code 12500 — check Firebase Support email & OAuth Consent Screen status).";
  }
  if (e instanceof ApiError) return e.message;
  const msg = e?.message || "Could not sign in with Google.";
  return code ? `${msg} (${code})` : msg;
}

type GoogleAuth = { signIn: () => void; busy: boolean; error: string | null; ready: boolean };

/**
 * `onToken(accessToken, requiresProfile)` is called with our JWT once the
 * backend accepts the Google identity.
 */
export function useGoogleAuth(
  onToken: (accessToken: string, requiresProfile: boolean) => Promise<void> | void,
  /** Referral code to credit on a first Google sign-up (Create account screen). */
  getReferralCode?: () => string | undefined
): GoogleAuth {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = useCallback(async () => {
    if (busy) return;
    if (!googleConfigured || !GS) {
      setError(
        inExpoGo
          ? "Google sign-in works in the installed app (APK / Play Store build) — it can't run inside Expo Go."
          : "Google sign-in isn't available in this build."
      );
      return;
    }
    setError(null);
    setBusy(true);
    try {
      ensureConfigured();
      await GS.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const res = await GS.GoogleSignin.signIn();
      if (!GS.isSuccessResponse(res)) return; // cancelled
      const googleIdToken = res.data.idToken;
      if (!googleIdToken) throw new Error("Google didn't return an ID token. Check the web client id.");

      const token = (await toFirebaseToken(googleIdToken)) || googleIdToken;
      const out: any = await authApi.googleLogin(token, getReferralCode?.()?.trim() || undefined);
      await onToken(out.access_token, !!(out.requires_profile_completion ?? out.prompt_profile_form));
    } catch (e: any) {
      const msg = explain(e);
      if (msg) setError(msg);
    } finally {
      setBusy(false);
    }
  }, [busy, onToken, getReferralCode]);

  return { signIn, busy, error, ready: googleVisible };
}

/** Forget the Google account on this device (so the next sign-in shows the picker). */
export async function googleSignOut() {
  if (!googleConfigured || !GS) return;
  try {
    ensureConfigured();
    await GS.GoogleSignin.signOut();
  } catch {}
}
