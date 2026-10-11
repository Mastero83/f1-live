export const BASE = 'https://api.openf1.org/v1';

export interface Session { session_key: number; session_name: string; session_type: string; circuit_short_name: string; country_name: string; location: string; date_start: string; date_end: string; meeting_key: number; year?: number; }
export interface Driver { driver_number: number; name_acronym: string; full_name: string; broadcast_name: string; team_name: string | null; team_colour: string | null; }
export interface Position { date: string; driver_number: number; position: number; }
export interface Interval { date: string; driver_number: number; gap_to_leader: number | string | null; interval: number | string | null; }
export interface Lap { driver_number: number; lap_number: number; lap_duration: number | null; date_start: string | null; }
export interface TeamRadio { date: string; driver_number: number; recording_url: string; }
export interface RaceControl { date: string; driver_number: number | null; lap_number: number | null; category: string; flag: string | null; scope: string | null; sector: number | null; message: string; }

export async function get<T>(endpoint: string, params: Record<string, string | number>): Promise<T[]> {
  const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  let res = await fetch(`${BASE}/${endpoint}?${qs}`);
  for (let i = 0; res.status === 429 && i < 3; i++) { // free tier rate limit
    await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    res = await fetch(`${BASE}/${endpoint}?${qs}`);
  }
  if (res.status === 404) return []; // OpenF1: "No results found."
  if (!res.ok) throw new Error(`HTTP ${res.status} (${endpoint})`);
  const data = await res.json();
  return Array.isArray(data) ? (data as T[]) : [];
}

export type SessionStatus = 'Gepland' | 'Live' | 'Afgelopen';
export function sessionStatus(s: Session, now = Date.now()): SessionStatus {
  const start = Date.parse(s.date_start), end = Date.parse(s.date_end);
  if (now < start) return 'Gepland';
  if (now <= end + 15 * 60_000) return 'Live';
  return 'Afgelopen';
}

/** Latest record per driver (data is chronological). */
export function latestByDriver<T extends { driver_number: number; date?: string | null }>(rows: T[]): Map<number, T> {
  const m = new Map<number, T>();
  for (const r of rows) {
    const prev = m.get(r.driver_number);
    if (!prev || (r.date ?? '') >= (prev.date ?? '')) m.set(r.driver_number, r);
  }
  return m;
}

export interface Row { position: number; driver: Driver | undefined; driver_number: number; gap: string; interval: string; lastLap: string; laps: number; }

export function fmtGap(v: number | string | null | undefined): string {
  if (v == null) return '–';
  if (typeof v === 'string') return v; // e.g. "+1 LAP"
  return `+${v.toFixed(3)}`;
}
export function fmtLap(sec: number | null | undefined): string {
  if (sec == null) return '–';
  const m = Math.floor(sec / 60), s = sec - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

export function buildLeaderboard(drivers: Driver[], positions: Position[], intervals: Interval[], laps: Lap[]): Row[] {
  const dmap = new Map(drivers.map(d => [d.driver_number, d]));
  const pos = latestByDriver(positions);
  const ints = latestByDriver(intervals);
  const lapCount = new Map<number, number>(), lastLap = new Map<number, number | null>(), best = new Map<number, number>();
  for (const l of laps) {
    if (l.lap_number >= (lapCount.get(l.driver_number) ?? 0)) { lapCount.set(l.driver_number, l.lap_number); if (l.lap_duration != null) lastLap.set(l.driver_number, l.lap_duration); }
    if (l.lap_duration != null && l.lap_duration < (best.get(l.driver_number) ?? Infinity)) best.set(l.driver_number, l.lap_duration);
  }
  const rows: Row[] = [...pos.values()].sort((a, b) => a.position - b.position).map(p => {
    const i = ints.get(p.driver_number);
    return { position: p.position, driver_number: p.driver_number, driver: dmap.get(p.driver_number),
      gap: i ? fmtGap(i.gap_to_leader) : '', interval: i ? fmtGap(i.interval) : '',
      lastLap: fmtLap(lastLap.get(p.driver_number)), laps: lapCount.get(p.driver_number) ?? 0 };
  });
  // No intervals (practice/qualifying): use best-lap delta to P1
  if (intervals.length === 0 && rows.length) {
    const leaderBest = best.get(rows[0].driver_number);
    let prev = leaderBest;
    rows.forEach((r, idx) => {
      const b = best.get(r.driver_number);
      r.gap = idx === 0 ? (b != null ? fmtLap(b) : '–') : b != null && leaderBest != null ? fmtGap(b - leaderBest) : '–';
      r.interval = idx === 0 ? '' : b != null && prev != null ? fmtGap(b - prev) : '–';
      if (b != null) prev = b;
    });
  }
  return rows;
}
