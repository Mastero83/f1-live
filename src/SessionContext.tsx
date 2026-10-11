import React, { createContext, useContext } from 'react';
import { Session, Driver, sessionStatus } from './api';
import { useSession, useDrivers } from './hooks';

/** live = keep polling (latest or not-yet-finished session); past sessions load once. */
interface Ctx { session?: Session; drivers: Driver[]; error?: string; live: boolean; refresh: () => void }
const C = createContext<Ctx>({ drivers: [], live: true, refresh: () => {} });
export function SessionProvider({ target, children }: { target: number | 'latest'; children: React.ReactNode }) {
  const s = useSession(target);
  const live = target === 'latest' || !s.data || sessionStatus(s.data) !== 'Afgerond';
  const d = useDrivers(s.data?.session_key);
  return <C.Provider value={{ session: s.data, drivers: d.data ?? [], error: s.error ?? d.error, live, refresh: () => { s.refresh(); d.refresh(); } }}>{children}</C.Provider>;
}
export const useSessionCtx = () => useContext(C);
