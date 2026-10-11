import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSessionCtx } from '../SessionContext';
import { sessionStatus } from '../api';
import { T } from '../theme';
import ErrorBanner from './ErrorBanner';

export default function SessionHeader({ updated }: { updated?: Date }) {
  const { session, error, refresh, mode, proxy, archive } = useSessionCtx();
  if (!session) return error ? <ErrorBanner msg={error} onRetry={refresh} /> : <View style={s.box}><Text style={s.sub}>Sessie laden…</Text></View>;
  const pst = proxy?.session_status;
  const st = mode === 'proxy' && pst ? (pst === 'Started' || pst === 'Aborted' ? 'Live' : pst === 'Finished' || pst === 'Finalised' || pst === 'Ends' ? 'Afgerond' : 'Gepland') : sessionStatus(session);
  const color = st === 'Live' ? T.red : st === 'Gepland' ? '#f5a623' : '#44444f';
  return (
    <View style={s.box}>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>{session.country_name.toUpperCase()} · {session.year ?? ''}</Text>
          <Text style={s.title}>{session.session_name}</Text>
          <Text style={s.sub}>{session.circuit_short_name} · {session.location}</Text>
        </View>
        <View style={[s.badge, { backgroundColor: color }]}>
          {st === 'Live' && <View style={s.dot} />}
          <Text style={s.badgeT}>{st.toUpperCase()}</Text>
        </View>
      </View>
      {archive && <Text style={s.src}>● Bron: officieel F1 live-timing-archief (eindstand){proxy?.lap_count ? `  ·  ${proxy.lap_count.CurrentLap} ronden` : ''}</Text>}
      {mode === 'proxy' && !archive && <Text style={s.src}>● Bron: officiële F1 live timing{proxy?.lap_count ? `  ·  Ronde ${proxy.lap_count.CurrentLap}/${proxy.lap_count.TotalLaps}` : ''}{proxy?.track_status ? `  ·  ${TRACK[proxy.track_status.Status] ?? proxy.track_status.Message}` : ''}</Text>}
      <Text style={s.note}>ⓘ {archive ? 'Afgeronde sessie — eenmalig geladen, geen live-updates.' : mode === 'proxy' ? 'Live timing via eigen proxy (enkele seconden vertraging).' : 'Gratis OpenF1-data loopt enkele seconden tot minuten achter.'}{updated ? `  ·  ${updated.toLocaleTimeString('nl-NL')}` : ''}</Text>
    </View>
  );
}
const TRACK: Record<string, string> = { '1': 'Groen', '2': 'Geel', '4': 'Safety car', '5': 'Rode vlag', '6': 'VSC', '7': 'VSC eindigt' };
const s = StyleSheet.create({
  src: { color: '#4cd964', fontSize: 12, fontWeight: '700', marginTop: 8 },
  box: { margin: 10, marginBottom: 4, padding: 14, backgroundColor: T.card, borderRadius: T.radius, borderLeftWidth: 4, borderLeftColor: T.red },
  row: { flexDirection: 'row', alignItems: 'center' },
  kicker: { color: T.red, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: T.text, fontSize: 22, fontWeight: '800', marginTop: 2 },
  sub: { color: T.sub, marginTop: 2, fontSize: 13 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff', marginRight: 6 },
  badgeT: { color: '#fff', fontWeight: '800', fontSize: 11, letterSpacing: 1 },
  note: { color: T.dim, fontSize: 11, marginTop: 8 },
});
