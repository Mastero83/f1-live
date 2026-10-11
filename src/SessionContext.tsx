import React, { createContext, useContext, useRef } from 'react';
import { Session, Driver, sessionStatus, getProxyState, getArchiveState, ProxyState } from './api';
import { useSession, useDrivers, usePolling } from './hooks';

/**
 * live = keep polling (latest or not-yet-finished session); past sessions load once.
 * mode 'proxy' = data comes from our own F1 live-timing proxy (used when OpenF1 is blocked/unavailable
 * during a live session and the proxy is streaming the requested session).
 */
interface Ctx { session?: Session; drivers: Driver[]; error?: string; live: boolean; refresh: () => void; mode: 'openf1' | 'proxy'; proxy?: ProxyState; finished: boolean; archive: boolean }
const C = createContext<Ctx>({ drivers: [], live: true, refresh: () => {}, mode: 'openf1', finished: false, archive: false });
export function SessionProvider({ target, children }: { target: number | 'latest'; children: React.ReactNode }) {
  const archivedRef = useRef(false);
  const s = useSession(target, () => archivedRef.current);
  const driversRef = useRef(false);
  const openLive = target === 'latest' || ((!s.data || sessionStatus(s.data) !== 'Afgerond') && !archivedRef.current);
  // Proxy is only relevant for live/latest sessions
  const p = usePolling(async () => (openLive ? getProxyState() : undefined), openLive ? 3000 : 0, [openLive]);
  const px = p.data;
  const proxyMatches = !!px?.session && (target === 'latest' || target === px.session.session_key || s.data?.session_key === px.session.session_key);
  const openf1Failing = !!s.error || (!!s.data && !driversRef.current);
  const useProxy = proxyMatches && px!.drivers.length > 0 && (openf1Failing || (s.data?.session_key === px!.session!.session_key && sessionStatus(s.data!) === 'Live'));
  // Finished session picked from the calendar: load ONCE from the official F1 archive (via proxy).
  const wantArchive = typeof target === 'number' && !(px?.session?.session_key === target && sessionStatus(px.session) !== 'Afgerond' && px.session_status !== 'Finalised' && px.session_status !== 'Ends')
    && (!s.data || sessionStatus(s.data) === 'Afgerond');
  const a = usePolling(async () => (wantArchive ? getArchiveState(target as number, s.data?.year) : undefined), 0, [wantArchive, target]);
  archivedRef.current = typeof target === 'number' && !!a.data?.drivers?.length;
  const d = useDrivers(wantArchive && a.data ? undefined : s.data?.session_key, openLive ? 120_000 : 0);
  driversRef.current = !!d.data?.length && !d.error;
  if (useProxy && !(wantArchive && a.data)) {
    const fin = px!.session_status === 'Finalised' || px!.session_status === 'Ends';
    return <C.Provider value={{ session: px!.session!, drivers: px!.drivers, live: !fin, mode: 'proxy', proxy: px, refresh: p.refresh, finished: fin, archive: false }}>{children}</C.Provider>;
  }
  if (wantArchive && a.data?.drivers?.length) {
    return <C.Provider value={{ session: { ...(s.data ?? {}), ...a.data.session! } as Session, drivers: a.data.drivers, live: false, mode: 'proxy', proxy: a.data, refresh: a.refresh, finished: true, archive: true }}>{children}</C.Provider>;
  }
  const fin = !!s.data && sessionStatus(s.data) === 'Afgerond';
  return <C.Provider value={{ session: s.data, drivers: d.data ?? [], error: s.error ?? d.error, live: openLive, mode: 'openf1', proxy: px, finished: fin, archive: false, refresh: () => { s.refresh(); d.refresh(); p.refresh(); a.refresh(); } }}>{children}</C.Provider>;
}
export const useSessionCtx = () => useContext(C);
