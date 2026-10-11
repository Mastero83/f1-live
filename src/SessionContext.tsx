import React, { createContext, useContext } from 'react';
import { Session, Driver } from './api';
import { useSession, useDrivers } from './hooks';

interface Ctx { session?: Session; drivers: Driver[]; error?: string }
const C = createContext<Ctx>({ drivers: [] });
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const s = useSession();
  const d = useDrivers(s.data?.session_key);
  return <C.Provider value={{ session: s.data, drivers: d.data ?? [], error: s.error }}>{children}</C.Provider>;
}
export const useSessionCtx = () => useContext(C);
