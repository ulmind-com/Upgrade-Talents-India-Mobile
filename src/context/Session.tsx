import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { adminAuthApi, authApi, loadApiBase, tokenStore, getApiBase, setUnauthorizedHandler } from "@/lib/api";

export type AppMode = "user" | "admin";
const MODE_KEY = "uti_app_mode";

type Session = {
  ready: boolean;
  mode: AppMode | null;
  setMode: (m: AppMode | null) => void;

  // user side
  user: any | null;
  userLoading: boolean;
  loginUser: (email: string, password: string) => Promise<void>;
  setUserToken: (t: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  logoutUser: () => Promise<void>;

  // admin side
  admin: any | null;
  adminLoading: boolean;
  loginAdmin: (email: string, password: string) => Promise<void>;
  refreshAdmin: () => Promise<void>;
  logoutAdmin: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [mode, setModeState] = useState<AppMode | null>(null);

  const [user, setUser] = useState<any | null>(null);
  const [userLoading, setUserLoading] = useState(false);

  const [admin, setAdmin] = useState<any | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  const setMode = useCallback((m: AppMode | null) => {
    setModeState(m);
    if (m) SecureStore.setItemAsync(MODE_KEY, m).catch(() => {});
    else SecureStore.deleteItemAsync(MODE_KEY).catch(() => {});
  }, []);

  const refreshUser = useCallback(async () => {
    if (!tokenStore.getUser()) {
      setUser(null);
      return;
    }
    setUserLoading(true);
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      await tokenStore.setUser(null);
      setUser(null);
    } finally {
      setUserLoading(false);
    }
  }, []);

  const refreshAdmin = useCallback(async () => {
    if (!tokenStore.getAdmin()) {
      setAdmin(null);
      return;
    }
    setAdminLoading(true);
    try {
      const me = await adminAuthApi.me();
      setAdmin(me);
    } catch {
      await tokenStore.setAdmin(null);
      setAdmin(null);
    } finally {
      setAdminLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadApiBase();
      // Fire-and-forget warm-up so the (sleepy) backend starts waking immediately.
      fetch(`${getApiBase()}/api/v1/homepage`).catch(() => {});
      await tokenStore.hydrate();
      try {
        const m = await SecureStore.getItemAsync(MODE_KEY);
        if (m === "user" || m === "admin") setModeState(m);
      } catch {}
      await Promise.all([refreshUser(), refreshAdmin()]);
      setReady(true);
    })();
  }, [refreshUser, refreshAdmin]);

  const loginUser = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email, password);
      await tokenStore.setUser(res.access_token);
      await refreshUser();
    },
    [refreshUser]
  );

  const setUserToken = useCallback(
    async (t: string) => {
      await tokenStore.setUser(t);
      await refreshUser();
    },
    [refreshUser]
  );

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  const logoutUser = useCallback(async () => {
    await tokenStore.setUser(null);
    setUser(null);
  }, []);

  const loginAdmin = useCallback(
    async (email: string, password: string) => {
      const res = await adminAuthApi.login(email, password);
      await tokenStore.setAdmin(res.access_token);
      await refreshAdmin();
    },
    [refreshAdmin]
  );

  const logoutAdmin = useCallback(async () => {
    try {
      await adminAuthApi.logout();
    } catch {}
    await tokenStore.setAdmin(null);
    setAdmin(null);
  }, []);

  return (
    <Ctx.Provider
      value={{
        ready,
        mode,
        setMode,
        user,
        userLoading,
        loginUser,
        setUserToken,
        refreshUser,
        logoutUser,
        admin,
        adminLoading,
        loginAdmin,
        refreshAdmin,
        logoutAdmin,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSession() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
