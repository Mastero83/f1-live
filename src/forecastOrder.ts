import { Driver, Interval, Position, Stint } from './api';
import { forecast, Forecast } from './forecastLogic';

export const PIT_LOSS_SINGAPORE = 28;
/** Approximate race-lap duration used to convert "+N LAP" into a time offset. */
export const LAP_TIME_ASSUMED = 98;

/** Parse gap_to_leader into seconds behind the leader. Leader (P1 or null while leading) → 0. */
export function gapSeconds(gap: number | string | null | undefined, curPos: number): number {
  if (curPos === 1) return 0;
  if (typeof gap === 'number' && Number.isFinite(gap)) return Math.max(0, gap);
  if (gap == null || gap === '') return curPos * 2; // missing: stay near current order
  const s = String(gap).trim().toUpperCase();
  // F1 sends "1 L", "+1 LAP", "+2 LAPS", "LAP 3" (leader marker — treat as 0 if somehow still here)
  if (/^LAP\s*\d+$/i.test(s)) return 0;
  const m = s.match(/^\+?\s*(\d+)\s*L(?:AP)?S?$/i) || s.match(/^(\d+)\s*L$/i);
  if (m) return Number(m[1]) * LAP_TIME_ASSUMED + curPos; // lapped: ~N laps behind, keep order among them
  const n = Number(s.replace(/^\+/, ''));
  if (Number.isFinite(n)) return Math.max(0, n);
  return curPos * 2;
}

export interface PredRow extends Forecast {
  curPos: number; proj: number; pitsLeft: number; pred: number; delta: number; conf: 'Laag' | 'Gemiddeld' | 'Hoog'; dnf: boolean;
}
export interface DriverFlags { driver_number: number; retired?: boolean; stopped?: boolean; in_pit?: boolean }
export interface LapInfo { driver_number: number; lap_number: number }
/** Max positions a driver may move without a pending stop justifying it. */
export const MAX_SHIFT = 3;

export function predictOrder(
  drivers: Driver[], stints: Stint[], positions: Position[], intervals: Interval[],
  curLap: number, total: number, circuit?: string, pitLoss = PIT_LOSS_SINGAPORE,
  flags: DriverFlags[] = [], laps: LapInfo[] = [],
): PredRow[] {
  const pf = forecast(drivers, stints, positions, curLap, total, circuit);
  const pos = new Map(positions.map(p => [p.driver_number, p.position]));
  const gapMap = new Map(intervals.map(i => [i.driver_number, i.gap_to_leader]));
  const remaining = Math.max(0, total - curLap);

  const flagMap = new Map(flags.map(f => [f.driver_number, f]));
  const lapMap = new Map(laps.map(l => [l.driver_number, l.lap_number]));
  const leaderLaps = Math.max(0, ...laps.map(l => l.lap_number));

  const scored = pf.map(r => {
    const dn = r.driver.driver_number;
    const curPos = pos.get(dn) ?? 99;
    const f = flagMap.get(dn);
    const done = lapMap.get(dn);
    // DNF: retired/stopped, or many laps down with no gap (car parked)
    const dnf = !!(f?.retired || f?.stopped) || (done != null && leaderLaps - done >= 5 && gapMap.get(dn) == null && curPos !== 1);
    let gap = gapSeconds(gapMap.get(dn), curPos);
    // Missing gap for a non-leader: derive from laps deficit so they can't leapfrog cars on the road
    if (gapMap.get(dn) == null && curPos !== 1 && done != null && leaderLaps > done) gap = (leaderLaps - done) * LAP_TIME_ASSUMED + curPos;
    const pitsLeft = dnf ? 0 : r.mustStop ? 1 : 0;
    const agePenalty = r.compound === 'SOFT' && r.age > 20 ? (r.age - 20) * 0.15
      : r.compound === 'MEDIUM' && r.age > 30 ? (r.age - 30) * 0.1 : 0;
    return { ...r, curPos, pitsLeft, dnf, proj: dnf ? 1e6 + curPos : gap + pitsLeft * pitLoss + agePenalty };
  });

  // 1) Raw order by projected gap; DNFs last
  const raw = [...scored].sort((a, b) => a.proj - b.proj || a.curPos - b.curPos);
  // 2) Strong prior: without a pending stop, a driver can move at most MAX_SHIFT places
  const running = raw.filter(r => !r.dnf);
  const target = new Map<number, number>();
  running.forEach((r, i) => {
    const rawPos = i + 1;
    const lo = r.curPos - MAX_SHIFT, hi = r.curPos + (r.pitsLeft > 0 ? 99 : MAX_SHIFT);
    target.set(r.driver.driver_number, Math.min(hi, Math.max(lo, rawPos)));
  });
  const ordered = [
    ...running.sort((a, b) => (target.get(a.driver.driver_number)! - target.get(b.driver.driver_number)!) || a.proj - b.proj),
    ...raw.filter(r => r.dnf).sort((a, b) => a.curPos - b.curPos),
  ];

  const stopsLeft = ordered.filter(x => x.pitsLeft > 0).length;
  return ordered.map((r, i) => {
    const pred = i + 1;
    let conf: PredRow['conf'] = 'Gemiddeld';
    if (remaining > total * 0.55 || stopsLeft > drivers.length * 0.5) conf = 'Laag';
    else if (remaining < total * 0.25 && stopsLeft <= 3) conf = 'Hoog';
    return { ...r, pred, delta: r.curPos - pred, conf };
  });
}
