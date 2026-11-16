import { Redirect } from "expo-router";
import { useSession } from "@/context/Session";

/** Boot router — send to the last-used mode, or the mode picker. */
export default function Index() {
  const { mode } = useSession();
  if (mode === "admin") return <Redirect href="/(admin)" />;
  if (mode === "user") return <Redirect href="/(user)" />;
  return <Redirect href="/mode-select" />;
}
