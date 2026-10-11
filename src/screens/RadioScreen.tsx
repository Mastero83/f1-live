import React, { useEffect, useState } from 'react';
import { FlatList, View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { play, stop } from '../player';
import { useSessionCtx } from '../SessionContext';
import { usePolling } from '../hooks';
import { get, TeamRadio } from '../api';
import ErrorBanner from '../components/ErrorBanner';
import SessionHeader from '../components/SessionHeader';

export default function RadioScreen() {
  const { session, drivers, live, mode, proxy } = useSessionCtx();
  const key = session?.session_key;
  const [filter, setFilter] = useState<number | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const { data, error, updated, refresh } = usePolling(async () => key && mode !== 'proxy' ? get<TeamRadio>('team_radio', { session_key: key }) : [], mode === 'proxy' ? 0 : live ? 10_000 : 0, [key, live, mode]);

  useEffect(() => () => { stop(); }, []);

  const toggle = async (url: string) => {
    if (playing === url) { await stop(); setPlaying(null); return; }
    setPlaying(url);
    try { await play(url, () => setPlaying(p => (p === url ? null : p))); } catch { setPlaying(null); }
  };

  const dmap = new Map(drivers.map(d => [d.driver_number, d]));
  const items = [...(mode === 'proxy' ? proxy?.team_radio ?? [] : data ?? [])].filter(r => filter == null || r.driver_number === filter).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100);
  return (
    <View style={s.c}>
      <SessionHeader updated={updated} />
      <ScrollView horizontal style={s.chips} contentContainerStyle={{ padding: 6 }} showsHorizontalScrollIndicator={false}>
        <Chip label="Alle" active={filter == null} onPress={() => setFilter(null)} />
        {drivers.map(d => <Chip key={d.driver_number} label={d.name_acronym} colour={d.team_colour} active={filter === d.driver_number} onPress={() => setFilter(d.driver_number)} />)}
      </ScrollView>
      <ErrorBanner msg={mode === 'proxy' ? undefined : error} onRetry={refresh} hasData={!!data?.length} />
      <FlatList data={items} keyExtractor={r => r.recording_url}
        ListEmptyComponent={<Text style={s.empty}>Geen teamradioberichten.</Text>}
        renderItem={({ item }) => {
          const d = dmap.get(item.driver_number);
          const on = playing === item.recording_url;
          return (
            <Pressable style={s.row} onPress={() => toggle(item.recording_url)}>
              <View style={[s.bar, { backgroundColor: d?.team_colour ? `#${d.team_colour}` : '#666' }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.acr}>{d?.name_acronym ?? `#${item.driver_number}`} <Text style={s.small}>{d?.team_name ?? ''}</Text></Text>
                <Text style={s.small}>{new Date(item.date).toLocaleTimeString('nl-NL')}</Text>
              </View>
              <Text style={s.play}>{on ? '■ Stop' : '▶ Afspelen'}</Text>
            </Pressable>
          );
        }} />
    </View>
  );
}
function Chip({ label, active, onPress, colour }: { label: string; active: boolean; onPress: () => void; colour?: string | null }) {
  return <Pressable onPress={onPress} style={[s.chip, active && s.chipOn, colour ? { borderColor: `#${colour}` } : null]}><Text style={s.chipT}>{label}</Text></Pressable>;
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#0b0b10' },
  chips: { flexGrow: 0, backgroundColor: '#15151e' },
  chip: { borderWidth: 1, borderColor: '#555', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, marginRight: 6 },
  chipOn: { backgroundColor: '#e10600' }, chipT: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#333' },
  bar: { width: 4, height: 32, borderRadius: 2, marginRight: 10 },
  acr: { color: '#fff', fontWeight: '700', fontSize: 16 }, small: { color: '#999', fontSize: 12, fontWeight: '400' },
  play: { color: '#e10600', fontWeight: '700' },
  err: { color: '#ff6b6b', padding: 8 }, empty: { color: '#888', padding: 20, textAlign: 'center' },
});
