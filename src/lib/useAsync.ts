import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

type State<T> = { data: T | null; loading: boolean; error: string | null };

/** Minimal data hook with manual refetch + pull-to-refresh support. */
export function useAsync<T>(fn: () => Promise<T>, deps: any[] = [], opts: { refetchOnFocus?: boolean } = {}) {
  const [state, setState] = useState<State<T>>({ data: null, loading: true, error: null });
  const [refreshing, setRefreshing] = useState(false);

  const run = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      setState({ data, loading: false, error: null });
    } catch (e: any) {
      setState((s) => ({ data: s.data, loading: false, error: e?.message || "Something went wrong." }));
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  }, deps);

  useEffect(() => {
    run(false);
  }, [run]);

  // Re-pull when the screen regains focus (e.g. back from a booking) so data
  // is never stale and no manual reload is needed.
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (!opts.refetchOnFocus) return;
      if (first.current) { first.current = false; return; }
      run(true);
    }, [run])
  );

  return { ...state, refreshing, refresh: () => run(true), reload: () => run(false) };
}
