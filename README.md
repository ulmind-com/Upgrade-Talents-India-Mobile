# Upgrade Talents India — Mobile App

Native **React Native (Expo + expo-router)** app for the Upgrade Talents India
platform. It ports the website's full design system and talks to the **same
FastAPI backend** — no backend, frontend or admin-panel code was changed.

One app, two modes (chosen on launch, switchable anytime):

- **Attendee** — home feed, events, ticket booking (QR passes), courses &
  workshops, competitions, bookings, rewards, certificates, notifications,
  gallery, contact, profile.
- **Admin / control room** — dashboard + 17 sections: events, tickets, gate
  check-in, VIP passes, competitions, judges, volunteers, certificates, badges,
  courses, workshops, merchandise, rewards, users, notifications, website
  content (CMS), and audit log.

Theme matches the site exactly: the **dark stage** theme and the **daylight**
theme, orange brand gradient, glass surfaces, and the acid-green "street"
ticket language in the booking flow. Icons only (lucide), no emojis.

## Run it

```bash
cd Upgrade-Talents-India-App
npm install
npx expo start
```

Then:
- **Expo Go** (quickest): install Expo Go on your phone and scan the QR. Your
  phone and computer must be on the same Wi-Fi.
- **iOS Simulator**: press `i` (needs a full Xcode install on macOS).
- **Android emulator**: press `a` (needs Android Studio).

## Point it at the backend

A phone/emulator cannot reach `localhost` — that's the device itself. Set the
API address one of these ways:

1. In-app: **Profile → App settings → Backend API address** (saved on device).
2. Env var before `expo start`:
   ```bash
   EXPO_PUBLIC_API_BASE_URL="http://<your-LAN-ip>:8000" npx expo start
   ```
3. `app.json` → `expo.extra.apiBaseUrl`.

Find your LAN IP with `ipconfig getifaddr en0` (macOS). Run the backend with
`uv run uvicorn app.main:app --host 0.0.0.0 --reload` so the device can reach it.

## Notes

- Tokens are stored in `expo-secure-store`; user and admin sessions are kept
  separate (separate endpoints + tokens), exactly like the two websites.
- Paid bookings confirm via the backend's server-side verification path. A real
  Razorpay **native** checkout needs a custom dev build (`react-native-razorpay`);
  the hook for it is in `app/(user)/events/[id]/book.tsx`.
- Project layout: routes in `app/`, everything else in `src/`
  (`theme/`, `lib/`, `components/`, `context/`).
