import React from 'react';
import { FlatList, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useSessionCtx } from '../SessionContext';
import { useLive } from '../LiveData';
import { buildLeaderboard, Row } from '../api';
import ErrorBanner from '../components/ErrorBanner';
import SessionHeader from '../components/SessionHeader';
import { T, teamColour, TYRE } from '../theme';

export default function LeaderboardScreen() {
  const { drivers, mode, proxy } = useSessionCtx();
  const px = mode === 'proxy' ? proxy : undefined;
  const trap = new Map((px?.timing_extra ?? []).map(e => [e.driver_number, e]));
  const live = useLive();
  const rows = buildLeaderboard(drivers, live.positions, live.intervals, live.laps);
  const isRace = live.intervals.length > 0;
  const tyre = new Map<number, string | null>();
  for (const st of [...live.stints].sort((a, b) => a.stint_number - b.stint_number)) tyre.set(st.driver_number, st.compound);
  return (
    <View style={s.c}>
      <FlatList data={rows} keyExtractor={r => String(r.driver_number)}
        ListHeaderComponent={<>
          <SessionHeader updated={live.updated} />
          <ErrorBanner msg={live.error} onRetry={live.refresh} hasData={rows.length > 0} />
          {px?.overtake && (
            <View style={[s.ot, { borderColor: px.overtake.enabled ? '#4cd964' : T.border }]}>
              <Text style={[s.otT, { color: px.overtake.enabled ? '#4cd964' : T.sub }]}>⚡ Overtake-modus {px.overtake.enabled ? 'INGESCHAKELD' : 'UITGESCHAKELD'}</Text>
              <Text style={s.otS}>Bron: wedstrijdleiding{px.overtake.lap ? ` · sinds ronde ${px.overtake.lap}` : ''}. Per-coureur OvertakeState is nu overal 'beschikbaar' (1); actief (2) nog niet gezien. Batterij%/ERS staat niet in de feed.</Text>
            </View>
          )}
          <View style={s.head}>
            <Text style={[s.h, { width: 34 }]}>POS</Text><Text style={[s.h, { flex: 1 }]}>COUREUR</Text>
            <Text style={[s.h, s.hn]}>{isRace ? 'LEIDER' : 'SNELSTE'}</Text><Text style={[s.h, s.hn]}>{isRace ? 'INTERVAL' : 'Δ VOOR'}</Text>
          </View>
        </>}
        refreshControl={<RefreshControl refreshing={false} onRefresh={live.refresh} tintColor="#fff" />}
        ListEmptyComponent={<Text style={s.empty}>Nog geen posities beschikbaar.</Text>}
        renderItem={({ item }) => <RowView r={item} tyre={tyre.get(item.driver_number)} telem={trap.get(item.driver_number)} />} />
    </View>
  );
}
function RowView({ r, tyre, telem }: { r: Row; tyre?: string | null; telem?: { speed_trap: number | null; speed_trap_fastest: boolean; speed?: number | null; rpm?: number | null; gear?: number | null; overtake_state?: number | null } }) {
  const colour = teamColour(r.driver?.team_colour);
  const t = tyre ? TYRE[tyre] : undefined;
  const p1 = r.position === 1;
  return (
    <View style={s.card}>
      <View style={[s.posBox, p1 && { backgroundColor: T.red }]}><Text style={s.pos}>{r.position}</Text></View>
      <View style={[s.bar, { backgroundColor: colour }]} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={s.acr}>{r.driver?.name_acronym ?? `#${r.driver_number}`}</Text>
          {t && <View style={[s.tyre, { borderColor: t.c }]}><Text style={[s.tyreT, { color: t.c }]}>{t.l}</Text></View>}
        </View>
        <Text style={s.small} numberOfLines={1}>{r.driver?.team_name ?? ''}</Text>
        {(() => {
          const liveSpd = telem?.speed != null && telem.speed > 0;
          const spd = liveSpd ? telem!.speed! : telem?.speed_trap;
          const ot = telem?.overtake_state === 2; // 1=available, 2=active (observed)
          return (
            <Text style={s.small}>
              Ronde {r.laps} · {r.lastLap}
              {spd != null ? <Text style={!liveSpd && telem?.speed_trap_fastest ? { color: T.purple, fontWeight: '700' } : null}>{` · ${spd} km/u`}</Text> : null}
              {liveSpd && telem?.rpm != null ? ` · ${telem.rpm} tpm` : ''}
              {liveSpd && telem?.gear != null && telem.gear > 0 ? ` · V${telem.gear}` : ''}
              {ot ? <Text style={{ color: '#4cd964', fontWeight: '800' }}>{' · ⚡'}</Text> : null}
            </Text>
          );
        })()}
      </View>
      <Text style={[s.num, p1 && { color: T.red, fontWeight: '800' }]}>{p1 && (r.gap === '+0.000' || r.gap === '' || r.gap === '–') ? 'Leider' : r.gap || '–'}</Text>
      <Text style={s.num}>{p1 ? '' : r.interval}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: T.bg },
  head: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  h: { color: T.dim, fontSize: 10, fontWeight: '800', letterSpacing: 1 }, hn: { width: 76, textAlign: 'right' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.card, marginHorizontal: 10, marginVertical: 3, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 8 },
  posBox: { width: 28, height: 28, borderRadius: 6, backgroundColor: T.card2, alignItems: 'center', justifyContent: 'center' },
  pos: { color: T.text, fontWeight: '800', fontSize: 14 },
  bar: { width: 4, height: 34, borderRadius: 2, marginHorizontal: 8 },
  acr: { color: T.text, fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  tyre: { width: 18, height: 18, borderRadius: 9, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' }, tyreT: { fontSize: 9, fontWeight: '900' },
  small: { color: T.sub, fontSize: 11 },
  num: { width: 76, color: T.text, textAlign: 'right', fontVariant: ['tabular-nums'], fontSize: 13, fontWeight: '600' },
  ot: { marginHorizontal: 10, marginTop: 4, padding: 10, borderRadius: 10, borderWidth: 1, backgroundColor: T.card },
  otT: { fontWeight: '800', fontSize: 13 }, otS: { color: T.dim, fontSize: 10, marginTop: 2 },
  err: { color: '#ff6b6b', paddingHorizontal: 12 }, empty: { color: T.dim, padding: 20, textAlign: 'center' },
});
