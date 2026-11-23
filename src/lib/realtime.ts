import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { fetch as streamFetch } from "expo/fetch";
import { getApiBase } from "@/lib/api";

/* ──────────────────────────────────────────────────────────────────────────
   Realtime — `GET /api/realtime/stream?channels=…` (Server-Sent Events).

   React Native has no EventSource, so this reads the stream with expo/fetch
   (which exposes the response body as a ReadableStream) and parses SSE frames
   by hand. ONE connection is shared by the whole app: every screen registers
   the channels it cares about, and the connection is re-opened with the union
   whenever that set changes. It backs off on failure, and closes while the
   app is in the background.

   Channels the backend publishes to:
     competition:<id>   votes, round changes, stage updates
     event:<id>         bookings (capacity moved), check-ins, volunteers
     user:<email>       your own ticket checked in, cash collected
   Frame payload: { channel, event, data, timestamp }
   ────────────────────────────────────────────────────────────────────────── */

export type RealtimeEvent = { channel: string; event: string; data: any; timestamp?: string };
type Listener = { channels: Set<string>; fn: (e: RealtimeEvent) => void };

const listeners = new Set<Listener>();
let controller: AbortController | null = null;
let openKey = "";
let retry = 0;
let reopenTimer: ReturnType<typeof setTimeout> | null = null;
let appActive = AppState.currentState === "active";

const wanted = () => {
  const s = new Set<string>();
  listeners.forEach((l) => l.channels.forEach((c) => s.add(c)));
  return Array.from(s).sort();
};

function dispatch(evt: RealtimeEvent) {
  listeners.forEach((l) => {
    if (l.channels.has(evt.channel)) {
      try {
        l.fn(evt);
      } catch {}
    }
  });
}

/** Parse one SSE block ("event: x\ndata: {...}"); comments (": keepalive") are dropped. */
function parseBlock(block: string): RealtimeEvent | null {
  let name = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const i = line.indexOf(":");
    const field = i < 0 ? line : line.slice(0, i);
    const value = i < 0 ? "" : line.slice(i + 1).replace(/^ /, "");
    if (field === "event") name = value;
    else if (field === "data") data.push(value);
  }
  if (!data.length || name === "connected") return null;
  try {
    const p = JSON.parse(data.join("\n"));
    return { channel: p.channel ?? "", event: p.event ?? name, data: p.data ?? p, timestamp: p.timestamp };
  } catch {
    return null;
  }
}

async function run(channels: string[], ctrl: AbortController) {
  const url = `${getApiBase()}/api/realtime/stream?channels=${encodeURIComponent(channels.join(","))}`;
  const res = await streamFetch(url, { headers: { Accept: "text/event-stream" }, signal: ctrl.signal });
  if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
  retry = 0; // connected
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let cut: number;
    while ((cut = buf.indexOf("\n\n")) >= 0) {
      const evt = parseBlock(buf.slice(0, cut));
      buf = buf.slice(cut + 2);
      if (evt) dispatch(evt);
    }
  }
}

function close() {
  controller?.abort();
  controller = null;
  openKey = "";
}

/** (Re)open the shared stream for the current channel set — or close it. */
function sync() {
  if (reopenTimer) clearTimeout(reopenTimer);
  reopenTimer = setTimeout(() => {
    reopenTimer = null;
    const channels = wanted();
    const key = channels.join(",");
    if (!channels.length || !appActive) return close();
    if (key === openKey && controller) return;
    close();
    const ctrl = new AbortController();
    controller = ctrl;
    openKey = key;
    run(channels, ctrl)
      .catch(() => {})
      .finally(() => {
        if (controller !== ctrl) return; // superseded
        controller = null;
        openKey = "";
        // the server closes idle streams and proxies drop them — come back, gently
        retry = Math.min(retry + 1, 6);
        const delay = Math.min(30000, 1000 * 2 ** retry);
        setTimeout(sync, delay);
      });
  }, 250); // batch a screen's mount-time subscriptions into one connection
}

AppState.addEventListener("change", (st: AppStateStatus) => {
  appActive = st === "active";
  sync();
});

/**
 * Subscribe to realtime channels for as long as the component is mounted.
 * `onEvent` is throttled (default 1.5s) so a burst of votes is one refresh.
 */
export function useRealtime(channels: (string | null | undefined | false)[], onEvent: (e: RealtimeEvent) => void, throttleMs = 1500) {
  const fn = useRef(onEvent);
  fn.current = onEvent;
  const key = channels.filter(Boolean).join("|");

  useEffect(() => {
    const list = channels.filter(Boolean) as string[];
    if (!list.length) return;
    let last = 0;
    let pending: ReturnType<typeof setTimeout> | null = null;
    let latest: RealtimeEvent | null = null;
    const l: Listener = {
      channels: new Set(list),
      fn: (e) => {
        latest = e;
        const now = Date.now();
        if (now - last >= throttleMs) {
          last = now;
          fn.current(e);
        } else if (!pending) {
          pending = setTimeout(() => {
            pending = null;
            last = Date.now();
            if (latest) fn.current(latest);
          }, throttleMs - (now - last));
        }
      },
    };
    listeners.add(l);
    sync();
    return () => {
      if (pending) clearTimeout(pending);
      listeners.delete(l);
      sync();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, throttleMs]);
}
