import React, { useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useSessionCtx } from '../SessionContext';
import { useLive } from '../LiveData';
import { forecast } from '../components/PitForecast';
import SessionHeader from '../components/SessionHeader';
import ErrorBanner from '../components/ErrorBanner';
import { T, TYRE, teamColour } from '../theme';

// Typical total pit loss (pit lane + stop) in seconds — Singapore street circuit
const PIT_LOSS = 28;

export default function ForecastScreen() {
  const { drivers, proxy: proxyRaw, mode, session } = useSessionCtx();
  const proxy = mode === 'proxy' ? proxyRaw : undefined;
  const live = useLive();
  const curLap = proxy?.lap_count?.CurrentLap ?? Math.max(0, ...live.laps.map(l => l.lap_number));
  const total = proxy?.lap_count?.TotalLaps ?? Math.max(curLap, 1);
  const remaining = Math.max(0, total - curLap);

  const rows = useMemo(() => {
    const pf = forecast(drivers, live.stints, live.positions, curLap, total, session?.circuit_short_name);
    const pos = new Map(live.positions.map(p => [p.driver_number, p.position]));
    const gap = new Map(live.intervals.map(i => [i.driver_number, typeof i.gap_to_leader === 'number' ? i.gap_to_leader : 0]));
    const leaderGap = (n: number) => gap.get(n) ?? 0;
    // Projected race time offset vs leader: current gap + remaining pit losses
    const scored = pf.map(r => {
      const pitsLeft = r.mustStop ? 1 : 0;
      const proj = leaderGap(r.driver.driver_number) + pitsLeft * PIT_LOSS;
      // Soft tyre late in race: small pace penalty if very old
      const agePenalty = r.compound === 'SOFT' && r.age > 20 ? (r.age - 20) * 0.15 : r.compound === 'MEDIUM' && r.age > 30 ? (r.age - 30) * 0.1 : 0;
      return { ...r, curPos: pos.get(r.driver.driver_number) ?? 99, proj: proj + agePenalty, pitsLeft };
    }).sort((a, b) => a.proj - b.proj || a.curPos - b.curPos);
    return scored.map((r, i) => {
      const pred = i + 1;
      const delta = r.curPos - pred;
      // Confidence: early race / many must-stop → low; late race with few stops left → high
      const stopsLeft = scored.filter(x => x.pitsLeft > 0).length;
      let conf: 'Laag' | 'Gemiddeld' | 'Hoog' = 'Gemiddeld';
      if (remaining > total * 0.55 || stopsLeft > drivers.length * 0.5) conf = 'Laag';
      else if (remaining < total * 0.25 && stopsLeft <= 3) conf = 'Hoog';
      return { ...r, pred, delta, conf };
    });
  }, [drivers, live.stints, live.positions, live.intervals, live.laps, curLap, total, session?.circuit_short_name]);

  return (
    <View style={s.c}>
      <ScrollView>
        <SessionHeader updated={live.updated} />
        <ErrorBanner msg={live.error} onRetry={live.refresh} hasData={live.positions.length > 0} />
        <View style={s.card}>
          <Text style={s.h}>VOORSPELDE EINDUITSLAG</Text>
          <Text style={s.hint}>Ronde {curLap}/{total}. Op basis van huidige posities, achterstanden, verplichte pitstops (~{PIT_LOSS}s verlies in Singapore) en bandenleeftijd. Geen strategie-simulatie — indicatief.</Text>
          <View style={s.head}>
            <Text style={[s.th, { width: 36 }]}>PRED</Text>
            <Text style={[s.th, { flex: 1 }]}>COUREUR</Text>
            <Text style={[s.th, { width: 44, textAlign: 'center' }]}>NU</Text>
            <Text style={[s.th, { width: 48, textAlign: 'right' }]}>+/−</Text>
            <Text style={[s.th, { width: 70, textAlign: 'right' }]}>ZEKER</Text>
          </View>
          {rows.length === 0 && <Text style={s.empty}>Nog niet genoeg data voor een voorspelling.</Text>}
          {rows.map(r => {
            const colour = teamColour(r.driver.team_colour);
            const arrow = r.delta > 0 ? `▲${r.delta}` : r.delta < 0 ? `▼${-r.delta}` : '–';
            const aCol = r.delta > 0 ? T.green : r.delta < 0 ? '#ff5a5a' : T.sub;
            const confCol = r.conf === 'Hoog' ? T.green : r.conf === 'Laag' ? '#ffc04d' : T.sub;
            return (
              <View key={r.driver.driver_number} style={s.row}>
                <View style={[s.predBox, r.pred === 1 && { backgroundColor: T.red }]}><Text style={s.pred}>{r.pred}</Text></View>
                <View style={[s.bar, { backgroundColor: colour }]} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.acr}>{r.driver.name_acronym}</Text>
                    {r.compound && <View style={[s.tyre, { borderColor: TYRE[r.compound]?.c ?? '#777' }]}><Text style={[s.tyreT, { color: TYRE[r.compound]?.c ?? '#777' }]}>{TYRE[r.compound]?.l ?? '?'}</Text></View>}
                  </View>
                  <Text style={s.sub} numberOfLines={1}>
                    {r.pitsLeft > 0 ? `nog ${r.pitsLeft} stop` : 'stops klaar'} · {TYRE[r.compound ?? '']?.l ?? '?'} {r.age} rd
                  </Text>
                </View>
                <Text style={s.now}>P{r.curPos}</Text>
                <Text style={[s.delta, { color: aCol }]}>{arrow}</Text>
                <Text style={[s.conf, { color: confCol }]}>{r.conf}</Text>
              </View>
            );
          })}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: T.bg },
  card: { backgroundColor: T.card, marginHorizontal: 10, marginVertical: 5, borderRadius: T.radius, padding: 12 },
  h: { color: T.red, fontWeight: '800', fontSize: 12, letterSpacing: 1.5, marginBottom: 4 },
  hint: { color: T.dim, fontSize: 11, marginBottom: 8, lineHeight: 15 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingHorizontal: 2 },
  th: { color: T.dim, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border },
  predBox: { width: 28, height: 28, borderRadius: 6, backgroundColor: T.card2, alignItems: 'center', justifyContent: 'center' },
  pred: { color: T.text, fontWeight: '800', fontSize: 14 },
  bar: { width: 4, height: 32, borderRadius: 2, marginHorizontal: 8 },
  acr: { color: T.text, fontWeight: '800', fontSize: 15 },
  tyre: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }, tyreT: { fontSize: 8, fontWeight: '900' },
  sub: { color: T.sub, fontSize: 11, marginTop: 1 },
  now: { width: 44, textAlign: 'center', color: T.sub, fontWeight: '700', fontSize: 13 },
  delta: { width: 48, textAlign: 'right', fontWeight: '800', fontSize: 14 },
  conf: { width: 70, textAlign: 'right', fontWeight: '700', fontSize: 12 },
  empty: { color: T.dim, padding: 16, textAlign: 'center' },
});
