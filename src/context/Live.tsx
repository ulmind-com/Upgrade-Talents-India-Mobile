import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { publicApi, safe, type LiveEventItem } from "@/lib/api";
import { airState, publishedInOrder } from "@/lib/live";

/**
 * Global "is anything on air right now" signal for the whole user shell — read
 * by the tab dock's live beacon. Kept deliberately cheap: the homepage payload
 * is fetched once, refreshed only every few minutes (and on app foreground),
 * and the clock is re-checked on a light tick so an event that *crosses* its
 * start time flips to live without another network call.
 */
type LiveCtx = { hasLive: boolean; liveCount: number; firstLiveId: string | null };

const Ctx = createContext<LiveCtx>({ hasLive: false, liveCount: 0, firstLiveId: null });

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const rows = useRef<LiveEventItem[]>([]);
  const [live, setLive] = useState<LiveEventItem[]>([]);

  const evaluate = useCallback(() => {
    const on = rows.current.filter((e) => airState(e.start_time, e.end_time) === "live");
    setLive((prev) => (prev.length === on.length && prev[0]?._id === on[0]?._id ? prev : on));
  }, []);

  const load = useCallback(async () => {
    const hp = await safe(publicApi.homepage(), null as any);
    if (hp && Array.isArray(hp.live_events)) {
      rows.current = publishedInOrder(hp.live_events);
      evaluate();
    }
  }, [evaluate]);

  useEffect(() => {
    load();
    const poll = setInterval(load, 180_000); // refetch every 3 min
    const tick = setInterval(evaluate, 30_000); // re-check the clock every 30s
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") load(); });
    return () => { clearInterval(poll); clearInterval(tick); sub.remove(); };
  }, [load, evaluate]);

  return (
    <Ctx.Provider value={{ hasLive: live.length > 0, liveCount: live.length, firstLiveId: live[0]?._id ?? null }}>
      {children}
    </Ctx.Provider>
  );
}

export const useLive = () => useContext(Ctx);
