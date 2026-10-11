import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useSessionCtx } from '../SessionContext';
import { useLive } from '../LiveData';
import SessionHeader from '../components/SessionHeader';
import DriverChips from '../components/DriverChips';
import { T, teamColour, TYRE } from '../theme';

export function TyreIcon({ compound, size = 30 }: { compound: string | null; size?: number }) {
  const t = compound ? TYRE[compound] : undefined;
  const c = t?.c ?? '#777';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: size * 0.16, borderColor: c, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: c, fontWeight: '900', fontSize: size * 0.42 }}>{t?.l ?? '?'}</Text>
    </View>
  );
}

export default function TyresScreen() {
  const { drivers } = useSessionCtx();
  const live = useLive();
  const [sel, setSel] = useState<number | null>(null);
  const posOf = new Map(live.positions.map(p => [p.driver_number, p.position]));
  const lapsDone = new Map<number, number>();
  for (const l of live.laps) lapsDone.set(l.driver_number, Math.max(lapsDone.get(l.driver_number) ?? 0, l.lap_number));
  const list = drivers.filter(d => sel == null || d.driver_number === sel)
    .sort((a, b) => (posOf.get(a.driver_number) ?? 99) - (posOf.get(b.driver_number) ?? 99));
  return (
    <View style={s.c}>
      <DriverChips drivers={drivers} selected={sel} onSelect={setSel} allowAll />
      <ScrollView>
        <SessionHeader updated={live.updated} />
        {live.stints.length === 0 && <Text style={s.empty}>Nog geen bandeninformatie.</Text>}
        {list.map(d => {
          const st = live.stints.filter(x => x.driver_number === d.driver_number).sort((a, b) => a.stint_number - b.stint_number);
          if (!st.length) return null;
          const cur = st[st.length - 1];
          const lap = lapsDone.get(d.driver_number) ?? cur.lap_end ?? cur.lap_start ?? 0;
          const age = (cur.tyre_age_at_start ?? 0) + Math.max(0, lap - (cur.lap_start ?? lap) + 1);
          const pits = live.pits.filter(p => p.driver_number === d.driver_number).sort((a, b) => a.lap_number - b.lap_number);
          const total = Math.max(lap, ...st.map(x => x.lap_end ?? 0), 1);
          return (
            <View key={d.driver_number} style={[s.card, { borderLeftColor: teamColour(d.team_colour) }]}>
              <View style={s.row}>
                <Text style={s.pos}>{posOf.get(d.driver_number) ?? '–'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.acr}>{d.name_acronym} <Text style={s.team}>{d.team_name}</Text></Text>
                  <Text style={s.sub}>{TYRE[cur.compound ?? '']?.nl ?? cur.compound ?? 'Onbekend'} · {age} ronden oud · stint {cur.stint_number}</Text>
                </View>
                <TyreIcon compound={cur.compound} />
              </View>
              <View style={s.strip}>
                {st.map(x => {
                  const len = Math.max(1, (x.lap_end ?? lap) - (x.lap_start ?? 1) + 1);
                  return <View key={x.stint_number} style={{ flex: len / total, backgroundColor: TYRE[x.compound ?? '']?.c ?? '#777', height: 8, borderRadius: 4, marginRight: 2 }} />;
                })}
              </View>
              <Text style={s.hist}>{st.map(x => `${TYRE[x.compound ?? '']?.l ?? '?'} R${x.lap_start ?? '?'}–${x.lap_end ?? '…'}${x.tyre_age_at_start ? ` (${x.tyre_age_at_start} oud)` : ''}`).join('  →  ')}</Text>
              {pits.length > 0 && <Text style={s.pit}>Pitstops: {pits.map(p => `R${p.lap_number} ${p.stop_duration != null ? `${p.stop_duration.toFixed(1)}s stil` : ''}${p.pit_duration != null ? ` (${p.pit_duration.toFixed(1)}s pitlane)` : ''}`).join(' · ')}</Text>}
            </View>
          );
        })}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: T.bg },
  card: { backgroundColor: T.card, marginHorizontal: 10, marginVertical: 4, borderRadius: T.radius, padding: 12, borderLeftWidth: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pos: { color: T.text, fontWeight: '800', fontSize: 16, width: 24, textAlign: 'center' },
  acr: { color: T.text, fontWeight: '800', fontSize: 16 }, team: { color: T.sub, fontWeight: '400', fontSize: 12 },
  sub: { color: T.sub, fontSize: 12, marginTop: 2 },
  strip: { flexDirection: 'row', marginTop: 10 },
  hist: { color: T.dim, fontSize: 11, marginTop: 6 }, pit: { color: T.text, fontSize: 11, marginTop: 4 },
  empty: { color: T.dim, padding: 20, textAlign: 'center' },
});
