import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useSessionCtx } from '../SessionContext';
import { useLive } from '../LiveData';
import ErrorBanner from '../components/ErrorBanner';
import PitForecast from '../components/PitForecast';
import SessionHeader from '../components/SessionHeader';
import { T } from '../theme';
import { summarize } from '../summary';

export default function AnalysisScreen() {
  const { drivers, proxy: proxyRaw, mode, session, finished, archive } = useSessionCtx();
  const proxy = mode === 'proxy' ? proxyRaw : undefined;
  const live = useLive();
  const summary = React.useMemo(() => (finished && archive && proxy ? summarize(proxy) : []), [finished, archive, proxy]);
  return (
    <View style={s.c}>
      <ScrollView>
        <SessionHeader updated={live.updated} />
        <ErrorBanner msg={live.error} onRetry={live.refresh} hasData={live.laps.length > 0 || live.stints.length > 0} />
        {finished && (
          <View style={[s.card, { borderLeftWidth: 3, borderLeftColor: T.red }]}>
            <Text style={s.h}>SAMENVATTING</Text>
            {summary.length ? summary.map((p, i) => <Text key={i} style={s.p}>{p}</Text>)
              : <Text style={s.p}>{archive ? 'Te weinig data voor een samenvatting.' : 'Samenvatting is beschikbaar zodra het officiële F1-archief (via de proxy) bereikbaar is.'}</Text>}
            {summary.length > 0 && <Text style={s.src}>Automatisch samengesteld uit officiële timingdata — geen interpretatie.</Text>}
          </View>
        )}
        <View style={s.card}>
          <Text style={s.h}>{finished ? 'WERKELIJKE STRATEGIE' : 'PITSTOP-VOORSPELLING'}</Text>
          <PitForecast drivers={drivers} stints={live.stints} positions={live.positions} laps={live.laps}
            curLap={proxy?.lap_count?.CurrentLap} total={proxy?.lap_count?.TotalLaps} circuit={session?.circuit_short_name} actual={finished} />
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: T.bg },
  card: { backgroundColor: T.card, marginHorizontal: 10, marginVertical: 5, borderRadius: T.radius, padding: 12 },
  p: { color: T.text, fontSize: 13, lineHeight: 19, marginTop: 6 },
  src: { color: T.dim, fontSize: 10, marginTop: 8 },
  h: { color: T.red, fontWeight: '800', fontSize: 12, letterSpacing: 1.5, marginBottom: 4 },
});
