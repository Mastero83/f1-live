import React from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { useSessionCtx } from '../SessionContext';
import { usePolling } from '../hooks';
import { get, RaceControl } from '../api';
import SessionHeader from '../components/SessionHeader';

const FLAG: Record<string, { c: string; nl: string }> = {
  GREEN: { c: '#2ecc40', nl: 'Groen' }, YELLOW: { c: '#ffdc00', nl: 'Geel' }, 'DOUBLE YELLOW': { c: '#ffb700', nl: 'Dubbel geel' },
  RED: { c: '#ff4136', nl: 'Rood' }, BLUE: { c: '#0074d9', nl: 'Blauw' }, CHEQUERED: { c: '#fff', nl: 'Geblokt' },
  CLEAR: { c: '#2ecc40', nl: 'Vrij' }, 'BLACK AND WHITE': { c: '#aaa', nl: 'Zwart-wit' }, BLACK: { c: '#000', nl: 'Zwart' },
};
const CAT: Record<string, string> = { Flag: 'Vlag', SafetyCar: 'Safety car', Drs: 'DRS', CarEvent: 'Auto', Other: 'Overig', SessionStatus: 'Sessiestatus' };

export default function RaceControlScreen() {
  const { session, live } = useSessionCtx();
  const key = session?.session_key;
  const { data, error, updated } = usePolling(async () => key ? get<RaceControl>('race_control', { session_key: key }) : [], live ? 5000 : 0, [key, live]);
  const items = [...(data ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <View style={s.c}>
      <SessionHeader updated={updated} />
      {error && <Text style={s.err}>Fout: {error}</Text>}
      <FlatList data={items} keyExtractor={(r, i) => `${r.date}-${i}`}
        ListEmptyComponent={<Text style={s.empty}>Geen wedstrijdleidingsberichten.</Text>}
        renderItem={({ item }) => {
          const f = item.flag ? FLAG[item.flag] : undefined;
          const penalty = /PENALTY|INVESTIGATION|NOTED|DELETED/i.test(item.message);
          return (
            <View style={s.row}>
              <View style={[s.flag, { backgroundColor: f?.c ?? (penalty ? '#ff851b' : '#333') }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.meta}>{new Date(item.date).toLocaleTimeString('nl-NL')} · {CAT[item.category] ?? item.category}{f ? ` · ${f.nl}` : ''}{item.lap_number ? ` · Ronde ${item.lap_number}` : ''}{item.sector ? ` · Sector ${item.sector}` : ''}{penalty ? ' · Straf/onderzoek' : ''}</Text>
                <Text style={s.msg}>{item.message}</Text>
              </View>
            </View>
          );
        }} />
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#0b0b10' },
  row: { flexDirection: 'row', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#333' },
  flag: { width: 6, borderRadius: 3, marginRight: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: '#555' },
  meta: { color: '#999', fontSize: 11 }, msg: { color: '#fff', fontSize: 14, marginTop: 2 },
  err: { color: '#ff6b6b', padding: 8 }, empty: { color: '#888', padding: 20, textAlign: 'center' },
});
