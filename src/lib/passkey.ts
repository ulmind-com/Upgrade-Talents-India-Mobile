import type * as PasskeysModule from "react-native-passkeys";
import { requireOptionalNativeModule } from "expo-modules-core";
import { passkeyApi, tokenStore } from "@/lib/api";

/**
 * Passkey (WebAuthn) sign-in for the app.
 *
 * The ceremony (turning the server challenge into a signed assertion) runs on a
 * NATIVE authenticator via `react-native-passkeys`. That native module only
 * exists in a dev/production build with associated-domains config — never in
 * Expo Go — so the module is loaded lazily and guarded: if it is absent, or the
 * device can't do passkeys, `passkeyAvailable()` returns false and the UI hides
 * passkey sign-in instead of crashing or showing a dead control.
 *
 * The backend derives its rp_id from the Origin header the app sends (see
 * WEBAUTHN_ORIGIN in config), so the passkey must have been created under that
 * same host and the host must be in the backend's WEBAUTHN_ORIGINS allowlist.
 */
/**
 * Passkeys are switched off for now: the app's rp domain, Android
 * assetlinks.json and the backend's Android origin aren't set up yet, so a
 * passkey button would only fail. Flip to true once those are in place —
 * every passkey entry point (login, settings, profile) follows this flag.
 */
export const PASSKEYS_ENABLED = false;

export class PasskeyUnavailable extends Error {
  constructor(msg = "Passkey sign-in isn't available in this build yet.") {
    super(msg);
    this.name = "PasskeyUnavailable";
  }
}

let mod: typeof PasskeysModule | null | undefined;
function pk(): typeof PasskeysModule | null {
  if (mod !== undefined) return mod;
  try {
    // The library's module file calls requireNativeModule() at import time,
    // which THROWS in Expo Go. Check for the native module the non-throwing way
    // first, and only pull the library in when it's actually present.
    if (requireOptionalNativeModule("ReactNativePasskeys")) {
      mod = require("react-native-passkeys") as typeof PasskeysModule;
    } else {
      mod = null; // native module not in this build (e.g. Expo Go)
    }
  } catch {
    mod = null;
  }
  return mod;
}

/** True only when this build can actually run the passkey authenticator. */
export function passkeyAvailable(): boolean {
  if (!PASSKEYS_ENABLED) return false;
  const m = pk();
  try {
    return !!m && typeof m.isSupported === "function" && m.isSupported();
  } catch {
    return false;
  }
}

/** Register a new passkey on this device for the signed-in user. */
export async function registerPasskey(): Promise<void> {
  const m = pk();
  if (!m || !passkeyAvailable()) throw new PasskeyUnavailable();

  const options = await passkeyApi.registerOptions();
  const credential = await m.create(options);
  if (!credential) throw new Error("Passkey setup was cancelled.");
  await passkeyApi.registerVerify(credential as unknown as Record<string, any>);
}

/** Run the passkey login ceremony end-to-end and return an access token. */
export async function signInWithPasskey(): Promise<string> {
  const m = pk();
  if (!m || !passkeyAvailable()) throw new PasskeyUnavailable();

  // 1) Ask the backend for a challenge (PublicKeyCredentialRequestOptionsJSON).
  const options = await passkeyApi.loginOptions();
  // 2) Let the OS authenticator (Face ID / fingerprint) sign it.
  const assertion = await m.get(options);
  if (!assertion) throw new Error("Passkey sign-in was cancelled.");
  // 3) Hand the signed assertion back for verification → access token.
  const res = await passkeyApi.loginVerify(assertion as unknown as Record<string, any>);

  const token = res?.access_token;
  if (!token) throw new Error("Passkey sign-in failed. Try another method.");
  await tokenStore.setUser(token);
  return token;
}
