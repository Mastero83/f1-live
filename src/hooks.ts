import { useCallback, useEffect, useRef, useState } from 'react';
import { get, Session, Driver } from './api';

export function usePolling<T>(fn: () => Promise<T>, intervalMs: number, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [updated, setUpdated] = useState<Date | undefined>();
  const fnRef = useRef(fn); fnRef.current = fn;
  const run = useCallback(async () => {
    try { setData(await fnRef.current()); setError(undefined); setUpdated(new Date()); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { run(); const id = setInterval(run, intervalMs); return () => clearInterval(id); }, [run, intervalMs, ...deps]);
  return { data, error, updated, refresh: run };
}

export function useSession() {
  // Web test override: ?session=9839 pins a past session.
  const loc = (globalThis as any).location as { search?: string } | undefined;
  const pinned = loc?.search ? new URLSearchParams(loc.search).get('session') : null;
  return usePolling(async () => (await get<Session>('sessions', { session_key: pinned ?? 'latest' }))[0], 60_000);
}

export function useDrivers(sessionKey?: number) {
  return usePolling(async () => sessionKey ? get<Driver>('drivers', { session_key: sessionKey }) : [], 120_000, [sessionKey]);
}
