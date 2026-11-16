import { useEffect } from "react";
import { usePathname, useRouter } from "expo-router";
import { useSession } from "@/context/Session";
import { profileComplete } from "@/lib/profile";

/* Auth screens the gate must never bounce away from — the member may be mid
   sign-up, resetting a password, or already on the wizard itself. */
const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/complete-profile", "/mode-select", "/staff"];

/**
 * Keeps a signed-in member out of the app until the mandatory profile is done.
 *
 * Mounted once at the root. It watches the session and the current path, and
 * sends an incomplete user to the onboarding wizard — chiefly Google sign-ins,
 * who skip the register steps that already collect these details. Admins and
 * signed-out visitors are never gated.
 */
export function OnboardingGate() {
  const { user, userLoading, mode, ready } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!ready || userLoading) return;
    if (!user || mode === "admin") return;
    if (profileComplete(user)) return;
    if (AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(p))) return;
    router.replace("/(auth)/complete-profile");
  }, [user, userLoading, mode, ready, pathname]);

  return null;
}
