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
  curPos: number; proj: number; pitsLeft: number; pred: number; delta: number; conf: 'Laag' | 'Gemiddeld' | 'Hoog';
}

export function predictOrder(
  drivers: Driver[], stints: Stint[], positions: Position[], intervals: Interval[],
  curLap: number, total: number, circuit?: string, pitLoss = PIT_LOSS_SINGAPORE,
): PredRow[] {
  const pf = forecast(drivers, stints, positions, curLap, total, circuit);
  const pos = new Map(positions.map(p => [p.driver_number, p.position]));
  const gapMap = new Map(intervals.map(i => [i.driver_number, i.gap_to_leader]));
  const remaining = Math.max(0, total - curLap);

  const scored = pf.map(r => {
    const curPos = pos.get(r.driver.driver_number) ?? 99;
    const pitsLeft = r.mustStop ? 1 : 0;
    const gap = gapSeconds(gapMap.get(r.driver.driver_number), curPos);
    const agePenalty = r.compound === 'SOFT' && r.age > 20 ? (r.age - 20) * 0.15
      : r.compound === 'MEDIUM' && r.age > 30 ? (r.age - 30) * 0.1 : 0;
    return { ...r, curPos, pitsLeft, proj: gap + pitsLeft * pitLoss + agePenalty };
  }).sort((a, b) => a.proj - b.proj || a.curPos - b.curPos);

  const stopsLeft = scored.filter(x => x.pitsLeft > 0).length;
  return scored.map((r, i) => {
    const pred = i + 1;
    let conf: PredRow['conf'] = 'Gemiddeld';
    if (remaining > total * 0.55 || stopsLeft > drivers.length * 0.5) conf = 'Laag';
    else if (remaining < total * 0.25 && stopsLeft <= 3) conf = 'Hoog';
    return { ...r, pred, delta: r.curPos - pred, conf };
  });
}
