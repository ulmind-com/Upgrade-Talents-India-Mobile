import { Redirect } from "expo-router";
import { useSession } from "@/context/Session";

/**
 * Boot router. The app is for attendees, so it opens straight into the user
 * app — no mode picker. Staff who switched to admin from the menu keep
 * landing in admin until they switch back.
 */
export default function Index() {
  const { mode } = useSession();
  if (mode === "admin") return <Redirect href="/(admin)" />;
  return <Redirect href="/(user)" />;
}
