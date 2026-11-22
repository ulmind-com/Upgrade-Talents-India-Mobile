# Passkeys (WebAuthn) — setup

The **app side is fully wired**: `react-native-passkeys` is installed and
autolinked, the ceremony + API client + Passkeys screen + gated login button are
done, and `app.json` declares the iOS associated domain. Passkeys stay hidden in
Expo Go (`passkeyAvailable()` → false) and light up automatically in a native
build. To make sign-in actually work, three things outside app code are needed.

## 1. Backend env (no code change)
The backend derives its `rp_id` from the request `Origin`, which must be in its
allowlist. Add the app's origin:

```
WEBAUTHN_ORIGINS=https://upgrade-talents-admin.vercel.app,https://upgrade-talents-india-frontend.vercel.app,https://app.upgradetalentsindia.in
```

The app sends `Origin: https://app.upgradetalentsindia.in` on passkey calls
(set via `EXPO_PUBLIC_WEBAUTHN_ORIGIN`, default in `src/lib/config.ts`). This
host is the `rp_id`; a passkey is bound to it, so create and sign in on the same host.

## 2. Host well-known files on `app.upgradetalentsindia.in`
Served as `application/json`, HTTPS, no redirects.

- `/.well-known/apple-app-site-association`
  ```json
  { "webcredentials": { "apps": ["<APPLE_TEAM_ID>.in.upgradetalents.app"] } }
  ```
- `/.well-known/assetlinks.json` (Android)
  ```json
  [{ "relation": ["delegate_permission/common.get_login_creds"],
     "target": { "namespace": "android_app", "package_name": "in.upgradetalents.app",
       "sha256_cert_fingerprints": ["<YOUR_SIGNING_CERT_SHA256>"] } }]
  ```

## 3. Build a real build (not Expo Go)
```bash
npx expo run:ios
```
or `npx expo run:android` / `eas build`. Continuous Native Generation applies
`ios.associatedDomains` and autolinks the native module. Needs iOS 16+ / Android 9+
with a device screen lock. Then: Settings → Security → Passkeys → **Add a passkey**,
and the **Sign in with a passkey** button appears on the login screen.

## Known limit — Android + this backend
The backend computes `rp_id = urlparse(origin).hostname` and checks the signed
assertion's origin against the request `Origin`. iOS presents
`https://app.upgradetalentsindia.in` (matches). Android presents
`android:apk-key-hash:<hash>`, which has no hostname → the current backend would
reject it. **iOS works as-is; Android needs the backend to accept the
`android:apk-key-hash` origin** (a backend change, intentionally not made here).
