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
