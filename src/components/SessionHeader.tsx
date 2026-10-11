import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSessionCtx } from '../SessionContext';
import { sessionStatus } from '../api';

export default function SessionHeader({ updated }: { updated?: Date }) {
  const { session, error } = useSessionCtx();
  if (!session) return <View style={s.box}><Text style={s.sub}>{error ? `Fout: ${error}` : 'Sessie laden…'}</Text></View>;
  const st = sessionStatus(session);
  const color = st === 'Live' ? '#e10600' : st === 'Gepland' ? '#f5a623' : '#888';
  return (
    <View style={s.box}>
      <View style={s.row}>
        <Text style={s.title}>{session.session_name}</Text>
        <Text style={[s.badge, { backgroundColor: color }]}>{st}</Text>
      </View>
      <Text style={s.sub}>{session.circuit_short_name} · {session.location}, {session.country_name}</Text>
      <Text style={s.note}>Let op: de gratis OpenF1-data loopt enkele seconden tot minuten achter.{updated ? `  Bijgewerkt ${updated.toLocaleTimeString('nl-NL')}` : ''}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  box: { padding: 12, backgroundColor: '#15151e', borderBottomWidth: 1, borderBottomColor: '#333' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  badge: { color: '#fff', fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  sub: { color: '#ccc', marginTop: 2 },
  note: { color: '#888', fontSize: 11, marginTop: 4 },
});
