import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Driver, Stint, Position, Lap } from '../api';
import { T, TYRE, teamColour } from '../theme';

import { forecast, type Forecast } from '../forecastLogic';
export { forecast, type Forecast } from '../forecastLogic';



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
