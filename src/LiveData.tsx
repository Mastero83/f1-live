import React, { createContext, useContext, useRef } from 'react';
import { get, Position, Interval, Lap, Stint, Pit } from './api';
import { usePolling } from './hooks';
import { useSessionCtx } from './SessionContext';

export interface Live { positions: Position[]; posHistory: Position[]; intervals: Interval[]; laps: Lap[]; stints: Stint[]; pits: Pit[]; updated?: Date; error?: string; refresh: () => void; }
const C = createContext<Live>({ positions: [], posHistory: [], intervals: [], laps: [], stints: [], pits: [], refresh: () => {} });

interface Cache { key?: number; posLatest: Map<number, Position>; posHist: Position[]; ints: Map<number, Interval>; laps: Map<string, Lap>; pits: Map<string, Pit>; stints: Stint[]; lastPos?: string; lastInt?: string; lastPit?: string; maxLap: number; tick: number; }
const fresh = (key?: number): Cache => ({ key, posLatest: new Map(), posHist: [], ints: new Map(), laps: new Map(), pits: new Map(), stints: [], maxLap: 0, tick: 0 });
const since = (field: string, d?: string): Record<string, string> => (d ? { [`${field}>`]: d } : {});

/** One shared poller for all tabs; every request after the first only asks for new records. */
export function LiveDataProvider({ children }: { children: React.ReactNode }) {
  const { session } = useSessionCtx();
  const key = session?.session_key;
  const cache = useRef<Cache>(fresh());
  const { data, error, updated, refresh } = usePolling(async () => {
    if (cache.current.key !== key) cache.current = fresh(key);
    const c = cache.current;
    if (key) {
      const slow = c.tick++ % 3 === 0; // stints/pit every ~15s
      const [pos, ints, laps, stints, pits] = await Promise.all([
        get<Position>('position', { session_key: key, ...since('date', c.lastPos) }),
        get<Interval>('intervals', { session_key: key, ...since('date', c.lastInt) }),
        get<Lap>('laps', { session_key: key, ...(c.maxLap > 1 ? { 'lap_number>': c.maxLap - 1 } : {}) }),
        slow ? get<Stint>('stints', { session_key: key }) : Promise.resolve(null),
        slow ? get<Pit>('pit', { session_key: key, ...since('date', c.lastPit) }) : Promise.resolve([] as Pit[]),
      ]);
      const seen = new Set(c.posHist.slice(-200).map(p => `${p.driver_number}${p.date}`));
      for (const p of pos) {
        const o = c.posLatest.get(p.driver_number); if (!o || p.date >= o.date) c.posLatest.set(p.driver_number, p);
        if (!seen.has(`${p.driver_number}${p.date}`)) c.posHist.push(p);
        if (!c.lastPos || p.date > c.lastPos) c.lastPos = p.date;
      }
      for (const i of ints) { const o = c.ints.get(i.driver_number); if (!o || i.date >= o.date) c.ints.set(i.driver_number, o && i.gap_to_leader == null ? { ...i, gap_to_leader: o.gap_to_leader, interval: i.interval ?? o.interval } : i); if (!c.lastInt || i.date > c.lastInt) c.lastInt = i.date; }
      for (const l of laps) { c.laps.set(`${l.driver_number}-${l.lap_number}`, l); if (l.lap_number > c.maxLap) c.maxLap = l.lap_number; }
      if (stints) c.stints = stints;
      for (const p of pits) { c.pits.set(`${p.driver_number}-${p.lap_number}`, p); if (!c.lastPit || p.date > c.lastPit) c.lastPit = p.date; }
    }
    return { positions: [...c.posLatest.values()], posHistory: c.posHist, intervals: [...c.ints.values()], laps: [...c.laps.values()], stints: c.stints, pits: [...c.pits.values()] };
  }, 5000, [key]);
  const v: Live = { positions: [], posHistory: [], intervals: [], laps: [], stints: [], pits: [], ...data, updated, error, refresh };
  return <C.Provider value={v}>{children}</C.Provider>;
}
export const useLive = () => useContext(C);
