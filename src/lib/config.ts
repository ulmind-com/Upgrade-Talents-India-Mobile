import Constants from "expo-constants";

/**
 * Base URL of the FastAPI backend. Override per-environment via app.json
 * `expo.extra.apiBaseUrl`, or the EXPO_PUBLIC_API_BASE_URL env var.
 *
 * NOTE: a physical device cannot reach "localhost" — that points at the phone
 * itself. On a real device set this to your machine's LAN IP, e.g.
 * http://192.168.1.5:8000. The in-app Settings screen can also change it live.
 */
const fromExtra = (Constants.expoConfig?.extra as any)?.apiBaseUrl as string | undefined;
const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;

const RENDER_API = "https://event-management-backend-nijj.onrender.com";

export const DEFAULT_API_BASE = (fromEnv || fromExtra || RENDER_API).replace(/\/$/, "");

/**
 * The WebAuthn origin the app presents for passkey sign-in. The backend derives
 * the rp_id from this (host of the Origin), so it MUST:
 *   1. be listed in the backend's WEBAUTHN_ORIGINS env allowlist, and
 *   2. match the iOS associatedDomains entry (webcredentials:<host>) and the
 *      domain that serves /.well-known/apple-app-site-association + assetlinks.
 * A passkey is bound to the rp_id it was created under, so this host must be the
 * same one the user registered their passkey on.
 */
export const WEBAUTHN_ORIGIN = (process.env.EXPO_PUBLIC_WEBAUTHN_ORIGIN || "https://app.upgradetalentsindia.in").replace(/\/$/, "");
export const WEBAUTHN_RP_ID = WEBAUTHN_ORIGIN.replace(/^https?:\/\//, "");
