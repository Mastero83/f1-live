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
  // intervalMs <= 0: fetch once (past sessions)
  useEffect(() => { run(); if (intervalMs <= 0) return; const id = setInterval(run, intervalMs); return () => clearInterval(id); }, [run, intervalMs, ...deps]);
  return { data, error, updated, refresh: run };
}

export function useSession(target: number | 'latest') {
  return usePolling(async () => (await get<Session>('sessions', { session_key: target }))[0], target === 'latest' ? 60_000 : 0, [target]);
}

export function useDrivers(sessionKey?: number) {
  return usePolling(async () => sessionKey ? get<Driver>('drivers', { session_key: sessionKey }) : [], 120_000, [sessionKey]);
}
