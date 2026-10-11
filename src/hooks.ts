import { useCallback, useEffect, useRef, useState } from 'react';
import { get, Session, Driver, friendlyError } from './api';

/** Polls fn; keeps last good data on error; exponential backoff (max 60s) while failing. intervalMs <= 0: fetch once (+ retries on failure). */
export function usePolling<T>(fn: () => Promise<T>, intervalMs: number, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [updated, setUpdated] = useState<Date | undefined>();
  const fnRef = useRef(fn); fnRef.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fails = useRef(0);
  const gen = useRef(0);
  const run = useCallback(async () => {
    const my = gen.current;
    clearTimeout(timer.current);
    let ok = false;
    try { const d = await fnRef.current(); if (my !== gen.current) return; setData(d); setError(undefined); setUpdated(new Date()); ok = true; fails.current = 0; }
    catch (e) { if (my !== gen.current) return; fails.current++; setError(friendlyError(e)); }
    const base = intervalMs > 0 ? intervalMs : 0;
    const next = ok ? base : Math.min(60_000, Math.max(base, 5000) * 2 ** Math.min(fails.current - 1, 4));
    if (next > 0) timer.current = setTimeout(run, next);
  }, [intervalMs]);
  useEffect(() => { gen.current++; fails.current = 0; run(); return () => { gen.current++; clearTimeout(timer.current); }; }, [run, ...deps]);
  return { data, error, updated, refresh: run };
}

export function useSession(target: number | 'latest', skip?: () => boolean) {
  return usePolling(async () => (skip?.() ? undefined : (await get<Session>('sessions', { session_key: target }))[0]), target === 'latest' ? 60_000 : 0, [target]);
}

export function useDrivers(sessionKey?: number, intervalMs = 120_000) {
  return usePolling(async () => sessionKey ? get<Driver>('drivers', { session_key: sessionKey }) : [], intervalMs, [sessionKey, intervalMs]);
}
