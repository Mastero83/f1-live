import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Driver, Stint, Position, Lap } from '../api';
import { T, TYRE, teamColour } from '../theme';

// Typical stint lengths in laps (total tyre age). Singapore is a low-deg street circuit -> slightly longer.
const BASE: Record<string, [number, number]> = { SOFT: [18, 25], MEDIUM: [25, 35], HARD: [35, 45], INTERMEDIATE: [20, 35], WET: [15, 30] };
const DRY = new Set(['SOFT', 'MEDIUM', 'HARD']);

export interface Forecast { driver: Driver; stints: Stint[]; pits: number; mustStop: boolean; window?: [number, number]; maybe?: [number, number]; age: number; compound: string | null }

export function forecast(drivers: Driver[], stints: Stint[], positions: Position[], curLap: number, total: number, circuit?: string): Forecast[] {
  const factor = /singapore/i.test(circuit ?? '') ? 1.05 : 1;
  const byD = new Map<number, Stint[]>();
  for (const s of stints) { if (!byD.has(s.driver_number)) byD.set(s.driver_number, []); byD.get(s.driver_number)!.push(s); }
  byD.forEach(l => l.sort((a, b) => a.stint_number - b.stint_number));
  // observed completed stint lengths (total tyre age at pit) per compound
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

export default function PitForecast({ drivers, stints, positions, laps, curLap, total, circuit }: { drivers: Driver[]; stints: Stint[]; positions: Position[]; laps: Lap[]; curLap?: number; total?: number; circuit?: string }) {
  const maxLap = Math.max(0, ...laps.map(l => l.lap_number), ...stints.map(s => s.lap_end ?? 0));
  const cl = curLap ?? maxLap;
  const tot = Math.max(total ?? 0, maxLap, cl, 1);
  const rows = forecast(drivers, stints, positions, cl, tot, circuit);
  if (!rows.length) return <Text style={s.empty}>Nog geen bandeninformatie.</Text>;
  const pct = (lap: number) => `${Math.min(100, Math.max(0, (lap / tot) * 100))}%` as const;
  return (
    <View>
      <View style={s.legend}>
        {['SOFT', 'MEDIUM', 'HARD', 'INTERMEDIATE', 'WET'].map(c => <Text key={c} style={[s.lg, { color: TYRE[c].c }]}>● {TYRE[c].nl}</Text>)}
        <Text style={[s.lg, { color: '#ffc04d' }]}>▮ verwacht stopvenster</Text>
      </View>
      <Text style={s.hint}>Ronde {cl}/{tot}. Voorspelling o.b.v. bandenleeftijd, typische stintlengtes en de stints van andere coureurs.</Text>
      {rows.map((r, i) => (
        <View key={r.driver.driver_number} style={s.row}>
          <View style={s.name}>
            <Text style={s.pos}>{i + 1}</Text>
            <Text style={[s.acr, { borderLeftColor: teamColour(r.driver.team_colour) }]}>{r.driver.name_acronym}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.track}>
              {r.stints.map(st => {
                const a = (st.lap_start ?? 1) - 1, b = Math.min(st.lap_end ?? cl, cl);
                return <View key={st.stint_number} style={[s.seg, { left: pct(a), width: pct(Math.max(0.5, b - a)), backgroundColor: TYRE[st.compound ?? '']?.c ?? '#777' }]} />;
              })}
              {(r.window ?? r.maybe) && <View style={[s.win, !r.window && s.winMaybe, { left: pct((r.window ?? r.maybe)![0] - 1), width: pct(Math.max(1, (r.window ?? r.maybe)![1] - (r.window ?? r.maybe)![0] + 1)) }]} />}
              <View style={[s.now, { left: pct(cl) }]} />
            </View>
            <Text style={[s.lbl, r.mustStop && { color: '#ffc04d' }]} numberOfLines={1}>
              {r.mustStop
                ? `Moet nog stoppen · verwacht R${r.window![0]}–${r.window![1]}`
                : `Al gestopt (${r.pits}×)${r.maybe ? ` · mogelijk extra stop R${r.maybe[0]}–${r.maybe[1]}` : ''}`}
              <Text style={s.dim}>  · {TYRE[r.compound ?? '']?.l ?? '?'} {r.age} rd</Text>
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
const s = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }, lg: { fontSize: 10, fontWeight: '700' },
  hint: { color: T.dim, fontSize: 11, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border },
  name: { width: 62, flexDirection: 'row', alignItems: 'center' },
  pos: { color: T.dim, width: 18, fontSize: 11, fontWeight: '700' }, acr: { color: T.text, fontWeight: '800', fontSize: 13, borderLeftWidth: 3, paddingLeft: 4 },
  track: { height: 12, backgroundColor: T.card2, borderRadius: 6, overflow: 'hidden', position: 'relative' },
  seg: { position: 'absolute', top: 2, bottom: 2, borderRadius: 4, opacity: 0.9 },
  win: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(255,192,77,0.45)', borderWidth: 1, borderColor: '#ffc04d', borderRadius: 3 },
  winMaybe: { backgroundColor: 'rgba(255,192,77,0.15)', borderStyle: 'dashed' },
  now: { position: 'absolute', top: -2, bottom: -2, width: 2, backgroundColor: '#fff' },
  lbl: { color: T.sub, fontSize: 11, marginTop: 2 }, dim: { color: T.dim },
  empty: { color: T.dim, padding: 16, textAlign: 'center' },
});
