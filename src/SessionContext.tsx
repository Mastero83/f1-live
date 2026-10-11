import React, { createContext, useContext } from 'react';
import { Session, Driver, sessionStatus, getProxyState, ProxyState } from './api';
import { useSession, useDrivers, usePolling } from './hooks';

/**
 * live = keep polling (latest or not-yet-finished session); past sessions load once.
 * mode 'proxy' = data comes from our own F1 live-timing proxy (used when OpenF1 is blocked/unavailable
 * during a live session and the proxy is streaming the requested session).
 */
interface Ctx { session?: Session; drivers: Driver[]; error?: string; live: boolean; refresh: () => void; mode: 'openf1' | 'proxy'; proxy?: ProxyState }
const C = createContext<Ctx>({ drivers: [], live: true, refresh: () => {}, mode: 'openf1' });
export function SessionProvider({ target, children }: { target: number | 'latest'; children: React.ReactNode }) {
  const s = useSession(target);
  const openLive = target === 'latest' || !s.data || sessionStatus(s.data) !== 'Afgerond';
  const d = useDrivers(s.data?.session_key);
  // Proxy is only relevant for live/latest sessions
  const p = usePolling(async () => (openLive ? getProxyState() : undefined), openLive ? 3000 : 0, [openLive]);
  const px = p.data;
  const proxyMatches = !!px?.session && (target === 'latest' || target === px.session.session_key || s.data?.session_key === px.session.session_key);
  const openf1Failing = !!s.error || !!d.error || (!!s.data && !d.data?.length);
  const useProxy = proxyMatches && px!.drivers.length > 0 && (openf1Failing || (s.data?.session_key === px!.session!.session_key && sessionStatus(s.data!) === 'Live'));
  if (useProxy) {
    return <C.Provider value={{ session: px!.session!, drivers: px!.drivers, live: true, mode: 'proxy', proxy: px, refresh: p.refresh }}>{children}</C.Provider>;
  }
  return <C.Provider value={{ session: s.data, drivers: d.data ?? [], error: s.error ?? d.error, live: openLive, mode: 'openf1', proxy: px, refresh: () => { s.refresh(); d.refresh(); p.refresh(); } }}>{children}</C.Provider>;
}
export const useSessionCtx = () => useContext(C);
