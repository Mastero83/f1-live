import type { ProxyState, Driver } from './api';

/** Deterministic Dutch summary from real archive data only. Returns paragraphs; [] if data is insufficient. */
const COMP: Record<string, string> = { SOFT: 'Soft', MEDIUM: 'Medium', HARD: 'Hard', INTERMEDIATE: 'Inter', WET: 'Wet' };
export function fmtLap(sec?: number | null): string {
  if (sec == null || !isFinite(sec)) return '–';
  const m = Math.floor(sec / 60), r = sec - m * 60;
  return `${m}:${r.toFixed(3).padStart(6, '0')}`;
}
const gapTxt = (g: unknown): string | null => {
  if (g == null || g === '') return null;
  if (typeof g === 'number') return `+${g.toFixed(3)}s`;
  const s = String(g);
  const lm = s.match(/^\+?(\d+)\s*L/i);
  if (lm) return `+${lm[1]} ${lm[1] === '1' ? 'ronde' : 'ronden'}`;
  const n = parseFloat(s.replace('+', ''));
  return isFinite(n) ? `+${n.toFixed(3)}s` : null;
};
const list = (a: string[]) => a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} en ${a[a.length - 1]}`;

export function summarize(st: ProxyState): string[] {
  const dm = new Map<number, Driver>(st.drivers.map(d => [d.driver_number, d]));
  const name = (n: number) => { const d = dm.get(n); return d ? (d.full_name ? `${d.full_name.split(' ').map(w => w[0] + w.slice(1).toLowerCase()).join(' ')}` : d.name_acronym) : `#${n}`; };
  const short = (n: number) => dm.get(n)?.name_acronym ?? `#${n}`;
  const team = (n: number) => dm.get(n)?.team_name ?? '';
  const ex = new Map((st.timing_extra ?? []).map(x => [x.driver_number, x]));
  const order = [...st.positions].sort((a, b) => a.position - b.position).map(p => p.driver_number).filter(n => dm.has(n));
  const gap = new Map(st.intervals.map(i => [i.driver_number, i.gap_to_leader]));
  const type = (st.session?.session_type || st.session?.session_name || '').toLowerCase();
  const sname = (st.session?.session_name || '').toLowerCase();
  if (!order.length) return [];
  const out: string[] = [];

  if (type.includes('race') || sname === 'sprint') {
    const laps = st.lap_count?.TotalLaps;
    const dnf = order.filter(n => ex.get(n)?.retired || ex.get(n)?.stopped);
    const fin = order.filter(n => !dnf.includes(n));
    const [w, p2, p3] = fin;
    out.push(`${name(w)} (${team(w)}) won de ${sname === 'sprint' ? 'sprint' : 'race'}${laps ? ` over ${laps} ronden` : ''}${p2 ? `, ${gapTxt(gap.get(p2)) ? `${gapTxt(gap.get(p2))} voor` : 'voor'} ${name(p2)}` : ''}${p3 ? `; ${name(p3)} completeerde het podium${gapTxt(gap.get(p3)) ? ` (${gapTxt(gap.get(p3))})` : ''}` : ''}.`);
    if (st.fastest?.driver_number) out.push(`Snelste ronde: ${name(st.fastest.driver_number)} met ${fmtLap(st.fastest.time)}${st.fastest.lap ? ` in ronde ${st.fastest.lap}` : ''}.`);
    const moves = fin.map((n, i) => ({ n, grid: ex.get(n)?.grid_pos ?? null, fin: i + 1 })).filter(m => m.grid && m.grid > 0).map(m => ({ ...m, d: m.grid! - m.fin }));
    const up = [...moves].sort((a, b) => b.d - a.d).filter(m => m.d > 0).slice(0, 3);
    const down = [...moves].sort((a, b) => a.d - b.d).filter(m => m.d < 0).slice(0, 2);
    if (up.length) out.push(`Grootste stijgers t.o.v. de grid: ${list(up.map(m => `${short(m.n)} (P${m.grid} → P${m.fin}, +${m.d})`))}.${down.length ? ` Grootste verliezers: ${list(down.map(m => `${short(m.n)} (P${m.grid} → P${m.fin}, ${m.d})`))}.` : ''}`);
    out.push(dnf.length ? `Uitgevallen (${dnf.length}): ${list(dnf.map(short))}.` : 'Alle gestarte coureurs werden geklasseerd.');
    // strategies from real stints
    const byDrv = new Map<number, string[]>();
    for (const s of [...st.stints].sort((a, b) => a.stint_number - b.stint_number)) {
      if (!byDrv.has(s.driver_number)) byDrv.set(s.driver_number, []);
      byDrv.get(s.driver_number)!.push(COMP[s.compound ?? ''] ?? '?');
    }
    const stops = fin.map(n => Math.max(0, (byDrv.get(n)?.length ?? 1) - 1));
    const total = order.reduce((t, n) => t + (ex.get(n)?.number_of_pit_stops ?? Math.max(0, (byDrv.get(n)?.length ?? 1) - 1)), 0);
    const cnt = new Map<number, number>(); stops.forEach(s => cnt.set(s, (cnt.get(s) ?? 0) + 1));
    const stopsTxt = [...cnt.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}× ${k}-stop`).join(', ');
    const strat = new Map<string, number>(); fin.forEach(n => { const k = (byDrv.get(n) ?? []).join('–'); if (k) strat.set(k, (strat.get(k) ?? 0) + 1); });
    const top = [...strat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${k} (${v}×)`);
    out.push(`In totaal ${total} pitstops. Geklasseerde coureurs: ${stopsTxt}. Meest gebruikte strategieën: ${list(top)}. Winnaar ${short(w)}: ${(byDrv.get(w) ?? []).join('–') || 'onbekend'}.`);
    // neutralisations from race control
    const rc = st.race_control;
    const sc = rc.filter(r => /^SAFETY CAR DEPLOYED/i.test(r.message)).length;
    const vsc = rc.filter(r => /^(VSC|VIRTUAL SAFETY CAR) DEPLOYED/i.test(r.message)).length;
    const red = rc.filter(r => r.flag === 'RED').length;
    const parts = [sc && `${sc}× safety car`, vsc && `${vsc}× virtual safety car`, red && `${red}× rode vlag`].filter(Boolean) as string[];
    out.push(parts.length ? `Neutralisaties volgens wedstrijdleiding: ${list(parts)}.` : 'Geen safety car, VSC of rode vlag volgens de wedstrijdleiding.');
    return out;
  }

  if (type.includes('qualifying') || sname.includes('qualifying') || sname.includes('shootout')) {
    const bt = (n: number) => ex.get(n)?.best_lap_times ?? [];
    const best = (n: number) => { const b = bt(n).filter((x): x is number => x != null); return b.length ? b[b.length - 1] : ex.get(n)?.best_lap ?? null; };
    const [p1, p2, p3] = order;
    const pole = bt(p1)[2] ?? best(p1);
    const d = (n: number, q: number) => { const a = bt(n)[q], b = bt(p1)[q]; return a != null && b != null ? `+${(a - b).toFixed(3)}s` : null; };
    out.push(`Pole position voor ${name(p1)} (${team(p1)}) met ${fmtLap(pole)}.${p2 ? ` ${name(p2)} start als tweede${d(p2, 2) ? ` (${d(p2, 2)})` : ''}` : ''}${p3 ? `, ${name(p3)} als derde${d(p3, 2) ? ` (${d(p3, 2)})` : ''}.` : '.'}`);
    const reached = (n: number) => bt(n).reduce((m, x, i) => (x != null ? i + 1 : m), 0);
    const outQ1 = order.filter(n => reached(n) === 1), outQ2 = order.filter(n => reached(n) === 2);
    if (outQ2.length) out.push(`Uitgeschakeld in Q2: ${list(outQ2.map(short))}.`);
    if (outQ1.length) out.push(`Uitgeschakeld in Q1: ${list(outQ1.map(short))}.`);
    const none = order.filter(n => reached(n) === 0);
    if (none.length) out.push(`Geen tijd gezet: ${list(none.map(short))}.`);
    if (st.fastest?.driver_number && st.fastest.driver_number !== p1) out.push(`Snelste ronde van de sessie: ${name(st.fastest.driver_number)}, ${fmtLap(st.fastest.time)}.`);
    return out;
  }

  // practice
  const timed = order.filter(n => ex.get(n)?.best_lap != null);
  const top = timed.slice(0, 3);
  const b0 = ex.get(top[0])?.best_lap ?? null;
  out.push(`Snelste tijd: ${name(top[0])} (${team(top[0])}) met ${fmtLap(b0)}.${top.length > 1 ? ` Daarachter ${list(top.slice(1).map(n => `${short(n)} (+${((ex.get(n)!.best_lap! - b0!)).toFixed(3)}s)`))}.` : ''}`);
  const runs = st.stints.map(s => ({ n: s.driver_number, c: s.compound, len: (s.lap_end ?? 0) - (s.lap_start ?? 0) + 1 })).filter(r => r.len > 0 && dm.has(r.n)).sort((a, b) => b.len - a.len);
  if (runs.length) {
    const longs = runs.filter(r => r.len >= 8);
    const seen = new Set<number>(); const lr = longs.filter(r => !seen.has(r.n) && seen.add(r.n)).slice(0, 3);
    out.push(lr.length ? `Long runs (≥8 ronden op één set): ${list(lr.map(r => `${short(r.n)} ${r.len} rd op ${COMP[r.c ?? ''] ?? '?'}`))}${longs.length > 3 ? ` (in totaal ${new Set(longs.map(r => r.n)).size} coureurs met een long run)` : ''}.` : `Geen long runs van 8+ ronden; langste stint ${runs[0].len} rd (${short(runs[0].n)}).`);
  }
  const noTime = order.filter(n => ex.get(n)?.best_lap == null);
  if (noTime.length) out.push(`Geen tijd gezet: ${list(noTime.map(short))}.`);
  return out;
}
