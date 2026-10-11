export const BASE = 'https://api.openf1.org/v1';

export interface Session { session_key: number; session_name: string; session_type: string; circuit_short_name: string; country_name: string; location: string; date_start: string; date_end: string; meeting_key: number; year?: number; }
export interface Driver { driver_number: number; name_acronym: string; full_name: string; broadcast_name: string; team_name: string | null; team_colour: string | null; }
export interface Position { date: string; driver_number: number; position: number; }
export interface Interval { date: string; driver_number: number; gap_to_leader: number | string | null; interval: number | string | null; }
export interface Lap { driver_number: number; lap_number: number; lap_duration: number | null; date_start: string | null; }
export interface TeamRadio { date: string; driver_number: number; recording_url: string; }
export interface RaceControl { date: string; driver_number: number | null; lap_number: number | null; category: string; flag: string | null; scope: string | null; sector: number | null; message: string; }

// ---- Network layer: throttled queue, backoff, persistent cache, status ----
export type ApiState = 'ok' | 'blocked' | 'error';
let apiState: ApiState = 'ok';
const listeners = new Set<(s: ApiState) => void>();
export const getApiState = () => apiState;
export function onApiState(fn: (s: ApiState) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function setApiState(s: ApiState) { if (s !== apiState) { apiState = s; listeners.forEach(f => f(s)); } }

const MAX_CONCURRENT = 2, MIN_GAP_MS = 350; // ~3 req/s
let active = 0, lastStart = 0;
const queue: (() => void)[] = [];
function pump() {
  if (active >= MAX_CONCURRENT || !queue.length) return;
  const wait = lastStart + MIN_GAP_MS - Date.now();
  if (wait > 0) { setTimeout(pump, wait); return; }
  lastStart = Date.now(); active++; queue.shift()!();
}
function throttled<R>(fn: () => Promise<R>): Promise<R> {
  return new Promise<R>((resolve, reject) => {
    queue.push(() => fn().then(resolve, reject).finally(() => { active--; pump(); }));
    pump();
  });
}

const store: { getItem(k: string): string | null; setItem(k: string, v: string): void } | undefined = (globalThis as any).localStorage;
const mem = new Map<string, string>();
function cacheGet(url: string): unknown[] | undefined {
  try { const v = mem.get(url) ?? store?.getItem('f1c:' + url); return v ? JSON.parse(v) : undefined; } catch { return undefined; }
}
function cachePut(url: string, data: unknown[]) {
  const v = JSON.stringify(data); mem.set(url, v);
  if (v.length < 400_000) try { store?.setItem('f1c:' + url, v); } catch { /* quota */ }
}

/** Free OpenF1 returns 401 (without CORS headers -> Safari "Load failed") for ALL data while a session is live. */
export class ApiError extends Error { constructor(public kind: 'blocked' | 'network' | 'http', msg: string) { super(msg); } }
export function friendlyError(e: unknown): string {
  if (e instanceof ApiError && e.kind === 'blocked') return 'OpenF1 blokkeert de gratis API tijdens een live F1-sessie (ook oude data). Na afloop van de sessie werkt alles weer. Je ziet de laatst opgeslagen gegevens.';
  if (e instanceof ApiError && e.kind === 'http') return `OpenF1 gaf een fout (${e.message}). We proberen het automatisch opnieuw.`;
  return 'OpenF1 weigert momenteel de verbinding. Tijdens een live F1-sessie is álle OpenF1-data (ook oude races) alleen voor betalende gebruikers; na afloop van de sessie werkt de app weer. Anders: controleer je internetverbinding. We proberen het automatisch opnieuw.';
}

export async function get<T>(endpoint: string, params: Record<string, string | number>): Promise<T[]> {
  const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  const url = `${BASE}/${endpoint}?${qs}`;
  const cacheable = !Object.keys(params).some(k => k.endsWith('>')); // incremental queries aren't cached
  try {
    const data = await throttled(async () => {
      let res: Response | undefined;
      for (let i = 0; i < 3; i++) {
        try { res = await fetch(url); } catch { throw new ApiError('network', 'Load failed'); }
        if (res.status !== 429) break;
        await new Promise(r => setTimeout(r, 1500 * (i + 1)));
      }
      if (!res) throw new ApiError('network', 'no response');
      if (res.status === 404) return [];
      if (res.status === 401 || res.status === 403) throw new ApiError('blocked', `HTTP ${res.status}`);
      if (!res.ok) throw new ApiError('http', `HTTP ${res.status}`);
      const j = await res.json();
      return Array.isArray(j) ? j : [];
    });
    setApiState('ok');
    if (cacheable) cachePut(url, data);
    return data as T[];
  } catch (e) {
    setApiState(e instanceof ApiError && e.kind === 'http' ? 'error' : 'blocked');
    const cached = cacheable ? cacheGet(url) : undefined;
    if (cached) return cached as T[];
    throw e;
  }
}

export type SessionStatus = 'Gepland' | 'Live' | 'Afgerond';
export function sessionStatus(s: Session, now = Date.now()): SessionStatus {
  const start = Date.parse(s.date_start), end = Date.parse(s.date_end);
  if (now < start) return 'Gepland';
  if (now <= end + 15 * 60_000) return 'Live';
  return 'Afgerond';
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

export interface Stint { driver_number: number; stint_number: number; lap_start: number | null; lap_end: number | null; compound: string | null; tyre_age_at_start: number | null; }
export interface Pit { date: string; driver_number: number; lap_number: number; pit_duration: number | null; stop_duration?: number | null; lane_duration?: number | null; }

export interface Meeting { meeting_key: number; meeting_name: string; meeting_official_name?: string; location: string; country_name: string; country_code: string; country_flag?: string | null; circuit_short_name: string; circuit_image?: string | null; date_start: string; date_end?: string | null; year: number; is_cancelled?: boolean; }
export const SESSION_NL: Record<string, string> = {
  'Practice 1': 'Vrije training 1', 'Practice 2': 'Vrije training 2', 'Practice 3': 'Vrije training 3',
  'Sprint Qualifying': 'Sprintkwalificatie', 'Sprint Shootout': 'Sprintkwalificatie', Sprint: 'Sprint', Qualifying: 'Kwalificatie', Race: 'Race',
  'Day 1': 'Testdag 1', 'Day 2': 'Testdag 2', 'Day 3': 'Testdag 3',
};
const TZ = 'Europe/Amsterdam';
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('nl-NL', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('nl-NL', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
export const fmtRange = (a: string, b?: string | null) => {
  const o: Intl.DateTimeFormatOptions = { timeZone: TZ, day: 'numeric', month: 'short' };
  return b ? `${new Date(a).toLocaleDateString('nl-NL', o)} – ${new Date(b).toLocaleDateString('nl-NL', o)}` : new Date(a).toLocaleDateString('nl-NL', o);
};

// ---- F1 live-timing proxy (own server on the box, see /workspace/f1-proxy) ----
const DEFAULT_PROXY = 'https://fv0h4oa-anonymous-8081.exp.direct/proxy';
export function proxyUrl(): string {
  const g = globalThis as any;
  try {
    const q = g.location?.search ? new URLSearchParams(g.location.search).get('proxy') : null;
    if (q) { g.localStorage?.setItem('f1proxy', q); return q.replace(/\/$/, ''); }
    return (g.localStorage?.getItem('f1proxy') as string | null) ?? DEFAULT_PROXY;
  } catch { return DEFAULT_PROXY; }
}
export interface ProxyState {
  source: string; connected: boolean; last_message: string | null; session: Session | null; session_status: string | null;
  track_status: { Status: string; Message: string } | null; lap_count: { CurrentLap: number; TotalLaps: number } | null;
  overtake?: { enabled: boolean; since: string | null; lap: number | null } | null;
  timing_extra?: { driver_number: number; retired?: boolean; stopped?: boolean; in_pit?: boolean; speed_trap: number | null; speed_trap_fastest: boolean; speed?: number | null; rpm?: number | null; gear?: number | null; overtake_state?: number | null }[];
  drivers: Driver[]; positions: Position[]; intervals: Interval[]; laps: Lap[]; stints: Stint[]; race_control: RaceControl[]; team_radio: (TeamRadio & Partial<Transcript>)[];
}
export interface Transcript { transcript: string | null; transcript_status: 'pending' | 'done' | 'error' }
/** Ask the proxy to transcribe clips (cached server-side); returns current status per URL. */
export async function getTranscripts(urls: string[]): Promise<Record<string, { status: Transcript['transcript_status']; text: string | null }>> {
  if (!urls.length) return {};
  const res = await fetch(`${proxyUrl()}/transcribe?${urls.map(u => 'url=' + encodeURIComponent(u)).join('&')}`);
  if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
  return res.json();
}
export async function getProxyState(): Promise<ProxyState> {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const t = setTimeout(() => ctl?.abort(), 10_000);
  try {
    const res = await fetch(`${proxyUrl()}/state`, { signal: ctl?.signal });
    if (!res.ok) throw new Error(`proxy HTTP ${res.status}`);
    return (await res.json()) as ProxyState;
  } finally { clearTimeout(t); }
}
