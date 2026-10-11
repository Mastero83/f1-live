import { Driver, Stint, Position } from './api';

const BASE: Record<string, [number, number]> = { SOFT: [18, 25], MEDIUM: [25, 35], HARD: [35, 45], INTERMEDIATE: [20, 35], WET: [15, 30] };
const DRY = new Set(['SOFT', 'MEDIUM', 'HARD']);

export interface Forecast { driver: Driver; stints: Stint[]; pits: number; mustStop: boolean; window?: [number, number]; maybe?: [number, number]; age: number; compound: string | null }

export function forecast(drivers: Driver[], stints: Stint[], positions: Position[], curLap: number, total: number, circuit?: string): Forecast[] {
  const factor = /singapore/i.test(circuit ?? '') ? 1.05 : 1;
  const byD = new Map<number, Stint[]>();
  for (const s of stints) { if (!byD.has(s.driver_number)) byD.set(s.driver_number, []); byD.get(s.driver_number)!.push(s); }
  byD.forEach(l => l.sort((a, b) => a.stint_number - b.stint_number));
  const obs = new Map<string, number[]>();
  byD.forEach(l => l.slice(0, -1).forEach(s => {
    if (!s.compound || s.lap_start == null || s.lap_end == null) return;
    const len = (s.tyre_age_at_start ?? 0) + (s.lap_end - s.lap_start + 1);
    if (!obs.has(s.compound)) obs.set(s.compound, []); obs.get(s.compound)!.push(len);
  }));
  const range = (c: string | null): [number, number] => {
    const b = BASE[c ?? ''] ?? [20, 35];
    let [lo, hi] = [b[0] * factor, b[1] * factor];
    const o = obs.get(c ?? '');
    if (o && o.length >= 2) { const avg = o.reduce((a, x) => a + x, 0) / o.length; lo = (lo + avg * 0.85) / 2; hi = (hi + avg * 1.1) / 2; }
    return [Math.round(lo), Math.round(hi)];
  };
  const order = new Map(positions.map(p => [p.driver_number, p.position]));
  return drivers.filter(d => byD.has(d.driver_number)).sort((a, b) => (order.get(a.driver_number) ?? 99) - (order.get(b.driver_number) ?? 99)).map(d => {
    const l = byD.get(d.driver_number)!; const cur = l[l.length - 1];
    const used = new Set(l.map(s => s.compound).filter((c): c is string => !!c));
    const wet = [...used].some(c => !DRY.has(c));
    const dryCount = [...used].filter(c => DRY.has(c)).length;
    const pits = l.length - 1;
    const mustStop = !wet && dryCount < 2;
    const age = (cur.tyre_age_at_start ?? 0) + Math.max(0, curLap - (cur.lap_start ?? curLap));
    const [lo, hi] = range(cur.compound);
    const clamp = (x: number) => Math.min(total - 1, Math.max(curLap, x));
    const w: [number, number] = [clamp(curLap + lo - age), clamp(curLap + hi - age)];
    const remaining = total - curLap;
    return { driver: d, stints: l, pits, age, compound: cur.compound,
      mustStop, window: mustStop ? w : undefined, maybe: !mustStop && remaining > hi - age + 3 ? w : undefined };
  });
}
