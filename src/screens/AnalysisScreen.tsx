import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useSessionCtx } from '../SessionContext';
import { useLive } from '../LiveData';
import ErrorBanner from '../components/ErrorBanner';
import PitForecast from '../components/PitForecast';
import SessionHeader from '../components/SessionHeader';
import { T } from '../theme';

export default function AnalysisScreen() {
  const { drivers, proxy: proxyRaw, mode, session } = useSessionCtx();
  const proxy = mode === 'proxy' ? proxyRaw : undefined;
  const live = useLive();
  return (
    <View style={s.c}>
      <ScrollView>
        <SessionHeader updated={live.updated} />
        <ErrorBanner msg={live.error} onRetry={live.refresh} hasData={live.laps.length > 0 || live.stints.length > 0} />
        <View style={s.card}>
          <Text style={s.h}>PITSTOP-VOORSPELLING</Text>
          <PitForecast drivers={drivers} stints={live.stints} positions={live.positions} laps={live.laps}
            curLap={proxy?.lap_count?.CurrentLap} total={proxy?.lap_count?.TotalLaps} circuit={session?.circuit_short_name} />
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
});
