import React, { useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useSessionCtx } from '../SessionContext';
import { useLive } from '../LiveData';
import SessionHeader from '../components/SessionHeader';
import ErrorBanner from '../components/ErrorBanner';
import { predictOrder, PIT_LOSS_SINGAPORE } from '../forecastOrder';
import { T, TYRE, teamColour } from '../theme';

export default function ForecastScreen() {
  const { drivers, proxy: proxyRaw, mode, session, finished } = useSessionCtx();
  const proxy = mode === 'proxy' ? proxyRaw : undefined;
  const live = useLive();
  const curLap = proxy?.lap_count?.CurrentLap ?? Math.max(0, ...live.laps.map(l => l.lap_number));
  const total = proxy?.lap_count?.TotalLaps ?? Math.max(curLap, 1);

  const rows = useMemo(
    () => predictOrder(drivers, live.stints, live.positions, live.intervals, curLap, total, session?.circuit_short_name, undefined, proxy?.timing_extra ?? [], live.laps),
    [drivers, live.stints, live.positions, live.intervals, live.laps, curLap, total, session?.circuit_short_name, proxy?.timing_extra],
  );

  if (finished) return <ActualResult />;
  return (
    <View style={s.c}>
      <ScrollView>
        <SessionHeader updated={live.updated} />
        <ErrorBanner msg={live.error} onRetry={live.refresh} hasData={live.positions.length > 0} />
        <View style={s.card}>
          <Text style={s.h}>VOORSPELDE EINDUITSLAG</Text>
          <Text style={s.hint}>Ronde {curLap}/{total}. Op basis van huidige posities, achterstanden, verplichte pitstops (~{PIT_LOSS_SINGAPORE}s verlies in Singapore) en bandenleeftijd. Geen strategie-simulatie — indicatief.</Text>
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
                    {r.dnf ? 'Uitgevallen (DNF)' : `${r.pitsLeft > 0 ? `nog ${r.pitsLeft} stop` : 'stops klaar'} · ${TYRE[r.compound ?? '']?.l ?? '?'} ${r.age} rd`}
                  </Text>
                </View>
                <Text style={s.now}>{r.dnf ? 'DNF' : `P${r.curPos}`}</Text>
                <Text style={[s.delta, { color: r.dnf ? T.dim : aCol }]}>{r.dnf ? '' : arrow}</Text>
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

/** Finished session: real classification (no prediction). */
function ActualResult() {
  const { drivers, proxy: proxyRaw, mode, session } = useSessionCtx();
  const proxy = mode === 'proxy' ? proxyRaw : undefined;
  const live = useLive();
  const isRace = /race|sprint/i.test(session?.session_type ?? '') && !/qualifying|shootout/i.test(session?.session_name ?? '');
  const ex = new Map((proxy?.timing_extra ?? []).map(x => [x.driver_number, x]));
  const gap = new Map(live.intervals.map(i => [i.driver_number, i.gap_to_leader]));
  const last = new Map<number, number>(); for (const p of live.positions) last.set(p.driver_number, p.position);
  const dm = new Map(drivers.map(d => [d.driver_number, d]));
  const order = [...last.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n).filter(n => dm.has(n));
  const comp = new Map<number, string | null>(); for (const st of [...live.stints].sort((a, b) => a.stint_number - b.stint_number)) comp.set(st.driver_number, st.compound);
  const fmtGap = (g: unknown, i: number) => i === 0 ? (isRace ? 'Winnaar' : '') : g == null || g === '' ? '' : typeof g === 'number' ? `+${g.toFixed(3)}` : String(g).replace(/^\+?(\d+)\s*L.*$/i, '+$1 rd');
  return (
    <View style={s.c}>
      <ScrollView>
        <SessionHeader updated={live.updated} />
        <ErrorBanner msg={live.error} onRetry={live.refresh} hasData={live.positions.length > 0} />
        <View style={s.card}>
          <Text style={s.h}>WERKELIJKE UITSLAG</Text>
          <Text style={s.hint}>Sessie afgerond — dit is de officiële eindstand, geen voorspelling.{isRace ? ' +/− = verschil met startpositie.' : ''}</Text>
          <View style={s.head}>
            <Text style={[s.th, { width: 36 }]}>POS</Text>
            <Text style={[s.th, { flex: 1 }]}>COUREUR</Text>
            <Text style={[s.th, { width: 44, textAlign: 'center' }]}>{isRace ? 'GRID' : ''}</Text>
            <Text style={[s.th, { width: 48, textAlign: 'right' }]}>{isRace ? '+/−' : ''}</Text>
            <Text style={[s.th, { width: 70, textAlign: 'right' }]}>{isRace ? 'GAP' : 'BESTE'}</Text>
          </View>
          {order.length === 0 && <Text style={s.empty}>Geen uitslag beschikbaar.</Text>}
          {order.map((n, i) => {
            const d = dm.get(n)!; const x = ex.get(n);
            const dnf = isRace && !!(x?.retired || x?.stopped);
            const grid = x?.grid_pos ?? null; const delta = grid ? grid - (i + 1) : 0;
            const aCol = delta > 0 ? T.green : delta < 0 ? '#ff5a5a' : T.sub;
            const c = comp.get(n) ?? null;
            const best = x?.best_lap != null ? `${Math.floor(x.best_lap / 60)}:${(x.best_lap % 60).toFixed(3).padStart(6, '0')}` : '–';
            return (
              <View key={n} style={s.row}>
                <View style={[s.predBox, i === 0 && !dnf && { backgroundColor: T.red }]}><Text style={s.pred}>{dnf ? '–' : i + 1}</Text></View>
                <View style={[s.bar, { backgroundColor: teamColour(d.team_colour) }]} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.acr}>{d.name_acronym}</Text>
                    {c && <View style={[s.tyre, { borderColor: TYRE[c]?.c ?? '#777' }]}><Text style={[s.tyreT, { color: TYRE[c]?.c ?? '#777' }]}>{TYRE[c]?.l ?? '?'}</Text></View>}
                  </View>
                  <Text style={s.sub} numberOfLines={1}>{dnf ? 'Uitgevallen (DNF)' : `${d.team_name ?? ''}${isRace && x?.number_of_pit_stops != null ? ` · ${x.number_of_pit_stops} stop${x.number_of_pit_stops === 1 ? '' : 's'}` : ''}`}</Text>
                </View>
                <Text style={s.now}>{isRace ? (grid ? `P${grid}` : 'pit') : ''}</Text>
                <Text style={[s.delta, { color: dnf ? T.dim : aCol }]}>{isRace && grid && !dnf ? (delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : '–') : ''}</Text>
                <Text style={[s.conf, { color: T.sub }]}>{dnf ? 'DNF' : isRace ? fmtGap(gap.get(n), i) : best}</Text>
              </View>
            );
          })}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}
