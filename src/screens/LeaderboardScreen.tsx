import React, { useRef } from 'react';
import { FlatList, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useSessionCtx } from '../SessionContext';
import { usePolling } from '../hooks';
import { get, buildLeaderboard, Position, Interval, Lap, Row } from '../api';
import SessionHeader from '../components/SessionHeader';

export default function LeaderboardScreen() {
  const { session, drivers } = useSessionCtx();
  const key = session?.session_key;
  // Incremental cache: only fetch records newer than what we already have.
  const cache = useRef<{ key?: number; positions: Map<number, Position>; intervals: Map<number, Interval>; laps: Map<string, Lap>; lastPos?: string; lastInt?: string; maxLap: number }>({ positions: new Map(), intervals: new Map(), laps: new Map(), maxLap: 0 });
  const { data, error, updated, refresh } = usePolling(async () => {
    const c = cache.current;
    if (c.key !== key) Object.assign(c, { key, positions: new Map(), intervals: new Map(), laps: new Map(), lastPos: undefined, lastInt: undefined, maxLap: 0 });
    if (key) {
      const since = (d?: string): Record<string, string> => (d ? { 'date>': d } : {});
      const [positions, intervals, laps] = await Promise.all([
        get<Position>('position', { session_key: key, ...since(c.lastPos) }),
        get<Interval>('intervals', { session_key: key, ...since(c.lastInt) }),
        // laps get updated after completion, so re-fetch the last 2 laps
        get<Lap>('laps', { session_key: key, ...(c.maxLap > 1 ? { 'lap_number>': c.maxLap - 1 } : {}) }),
      ]);
      for (const p of positions) { const o = c.positions.get(p.driver_number); if (!o || p.date >= o.date) c.positions.set(p.driver_number, p); if (!c.lastPos || p.date > c.lastPos) c.lastPos = p.date; }
      for (const i of intervals) { const o = c.intervals.get(i.driver_number); if (!o || i.date >= o.date) c.intervals.set(i.driver_number, i); if (!c.lastInt || i.date > c.lastInt) c.lastInt = i.date; }
      for (const l of laps) { c.laps.set(`${l.driver_number}-${l.lap_number}`, l); if (l.lap_number > c.maxLap) c.maxLap = l.lap_number; }
    }
    return { positions: [...c.positions.values()], intervals: [...c.intervals.values()], laps: [...c.laps.values()] };
  }, 5000, [key]);
  const rows = data ? buildLeaderboard(drivers, data.positions, data.intervals, data.laps) : [];
  const isRace = (data?.intervals.length ?? 0) > 0;
  return (
    <View style={s.c}>
      <SessionHeader updated={updated} />
      {error && <Text style={s.err}>Fout: {error}</Text>}
      <View style={[s.row, s.head]}>
        <Text style={[s.pos, s.h]}>P</Text><Text style={[s.name, s.h]}>Coureur</Text>
        <Text style={[s.num, s.h]}>{isRace ? 'Achterstand' : 'Snelste / Δ'}</Text>
        <Text style={[s.num, s.h]}>{isRace ? 'Interval' : 'Δ voorganger'}</Text>
      </View>
      <FlatList data={rows} keyExtractor={r => String(r.driver_number)}
        refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor="#fff" />}
        ListEmptyComponent={<Text style={s.empty}>Nog geen posities beschikbaar.</Text>}
        renderItem={({ item }) => <RowView r={item} />} />
    </View>
  );
}
function RowView({ r }: { r: Row }) {
  const colour = r.driver?.team_colour ? `#${r.driver.team_colour}` : '#666';
  return (
    <View style={s.row}>
      <Text style={s.pos}>{r.position}</Text>
      <View style={[s.bar, { backgroundColor: colour }]} />
      <View style={s.name}>
        <Text style={s.acr}>{r.driver?.name_acronym ?? `#${r.driver_number}`}</Text>
        <Text style={s.small} numberOfLines={1}>{r.driver?.full_name ?? ''} · {r.driver?.team_name ?? ''}</Text>
        <Text style={s.small}>Ronde {r.laps} · laatste {r.lastLap}</Text>
      </View>
      <Text style={s.num}>{r.position === 1 && r.gap.startsWith('+') ? 'Leider' : r.gap || (r.position === 1 ? 'Leider' : '–')}</Text>
      <Text style={s.num}>{r.position === 1 ? '' : r.interval}</Text>
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#0b0b10' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#333' },
  head: { backgroundColor: '#1d1d27' }, h: { color: '#aaa', fontSize: 11, fontWeight: '600' },
  pos: { width: 26, color: '#fff', fontWeight: '700', fontSize: 16, textAlign: 'center' },
  bar: { width: 4, height: 36, borderRadius: 2, marginHorizontal: 6 },
  name: { flex: 1 }, acr: { color: '#fff', fontWeight: '700', fontSize: 16 },
  small: { color: '#999', fontSize: 11 },
  num: { width: 82, color: '#eee', textAlign: 'right', fontVariant: ['tabular-nums'], fontSize: 13 },
  err: { color: '#ff6b6b', padding: 8 }, empty: { color: '#888', padding: 20, textAlign: 'center' },
});
