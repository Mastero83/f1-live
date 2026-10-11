import React, { createContext, useContext } from 'react';
import { Session, Driver, sessionStatus } from './api';
import { useSession, useDrivers } from './hooks';

/** live = keep polling (latest or not-yet-finished session); past sessions load once. */
interface Ctx { session?: Session; drivers: Driver[]; error?: string; live: boolean }
const C = createContext<Ctx>({ drivers: [], live: true });
export function SessionProvider({ target, children }: { target: number | 'latest'; children: React.ReactNode }) {
  const s = useSession(target);
  const live = target === 'latest' || !s.data || sessionStatus(s.data) !== 'Afgerond';
  const d = useDrivers(s.data?.session_key);
  return <C.Provider value={{ session: s.data, drivers: d.data ?? [], error: s.error, live }}>{children}</C.Provider>;
}
export const useSessionCtx = () => useContext(C);
