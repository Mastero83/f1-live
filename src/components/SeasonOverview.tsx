import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator } from 'react-native';
import { getSeason, Season } from '../api';
import { usePolling } from '../hooks';
import { T, teamColour } from '../theme';

function countdown(iso: string | null, now: number) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now; if (ms <= 0) return 'nu';
  const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
  return d > 0 ? `${d}d ${h}u ${m}m` : `${h}u ${m}m`;
}
const short = (n: string) => n.replace(/ Grand Prix$/, '').replace('Mexico City', 'Mexico').replace('United States', 'VS');

export default function SeasonOverview({ year, onPick }: { year: number; onPick?: (meetingKey: number) => void }) {
  const { data, error } = usePolling<Season>(() => getSeason(year), 30 * 60_000, [year]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  if (!data) return error ? <Text style={s.err}>Seizoensoverzicht tijdelijk niet beschikbaar.</Text> : <ActivityIndicator color={T.red} style={{ margin: 16 }} />;
  if (!data.rounds.length) return null;
  const pct = data.total_rounds ? data.done_rounds / data.total_rounds : 0;
  const top = data.driver_standings.slice(0, 10); const maxP = Math.max(1, ...top.map(d => d.points));
  const teams = data.team_standings; const maxT = Math.max(1, ...teams.map(t => t.points));
  const winners = data.driver_standings.filter(d => d.wins > 0).sort((a, b) => b.wins - a.wins);
  const pods = data.driver_standings.filter(d => d.podiums > 0).sort((a, b) => b.podiums - a.podiums).slice(0, 6);
  const unknown = data.rounds.filter(r => r.status === 'unknown').length;
  const cd = countdown(data.next?.race_start ?? null, now);
  return (
    <View>
      {/* 1. progress */}
      <View style={s.card}>
        <View style={s.rowB}>
          <Text style={s.h}>SEIZOEN {year}</Text>
          <Text style={s.big}>{data.done_rounds}<Text style={s.of}>/{data.total_rounds} races</Text></Text>
        </View>
        <View style={s.prog}><View style={[s.progF, { width: `${pct * 100}%` }]} /></View>
        {data.next ? (
          <Pressable onPress={() => onPick?.(data.next!.meeting_key)} style={s.next}>
            {data.next.flag && <Image source={{ uri: data.next.flag }} style={s.flagL} />}
            <View style={{ flex: 1 }}>
              <Text style={s.nextK}>VOLGENDE · RONDE {data.next.round}{data.next.sprint ? ' · SPRINT' : ''}</Text>
              <Text style={s.nextT}>{data.next.name}</Text>
            </View>
            {cd && <View style={s.cd}><Text style={s.cdT}>{cd}</Text><Text style={s.cdL}>tot de race</Text></View>}
          </Pressable>
        ) : <Text style={s.sub}>Seizoen afgelopen.</Text>}
      </View>

      {/* 2. timeline */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tl}>
        {data.rounds.filter(r => !r.cancelled).map(r => {
          const isNext = data.next?.meeting_key === r.meeting_key;
          const col = r.winner ? teamColour(r.winner.team_colour) : T.border;
          return (
            <Pressable key={r.meeting_key} onPress={() => onPick?.(r.meeting_key)} style={[s.tlItem, { borderTopColor: r.status === 'done' ? col : 'transparent' }, isNext && s.tlNext]}>
              <Text style={s.tlR}>R{r.round}</Text>
              {r.flag ? <Image source={{ uri: r.flag }} style={s.flag} /> : <View style={s.flag} />}
              <Text style={s.tlN} numberOfLines={1}>{short(r.name)}</Text>
              {r.status === 'done' && r.winner ? <View style={[s.win, { backgroundColor: col }]}><Text style={s.winT}>{r.winner.name_acronym}</Text></View>
                : r.status === 'unknown' ? <Text style={s.tlU}>onbekend</Text>
                : <Text style={[s.tlU, isNext && { color: T.red, fontWeight: '800' }]}>{isNext ? 'VOLGENDE' : new Date(r.race_start ?? r.date_start).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</Text>}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 4. stat chips */}
      <View style={s.card}>
        <Text style={s.h}>OVERWINNINGEN</Text>
        <View style={s.chips}>
          {winners.map(d => <View key={d.driver_number} style={[s.chip, { borderColor: teamColour(d.team_colour) }]}><Text style={s.chipA}>{d.name_acronym}</Text><Text style={s.chipV}>{d.wins}×</Text></View>)}
          {winners.length === 0 && <Text style={s.sub}>Nog geen races verreden.</Text>}
        </View>
        {pods.length > 0 && <>
          <Text style={[s.h, { marginTop: 10 }]}>PODIUMS</Text>
          <View style={s.chips}>{pods.map(d => <View key={d.driver_number} style={[s.chip, s.chipP]}><Text style={s.chipA}>{d.name_acronym}</Text><Text style={s.chipV}>{d.podiums}</Text></View>)}</View>
        </>}
      </View>

      {/* 3. standings */}
      <View style={s.card}>
        <Text style={s.h}>WK COUREURS · TOP 10</Text>
        {top.map(d => (
          <View key={d.driver_number} style={s.bRow}>
            <Text style={s.bPos}>{d.position}</Text>
            <Text style={s.bName}>{d.name_acronym}</Text>
            <View style={s.bTrack}><View style={[s.bFill, { width: `${(d.points / maxP) * 100}%`, backgroundColor: teamColour(d.team_colour) }]} /></View>
            <Text style={s.bPts}>{d.points}</Text>
          </View>
        ))}
        <Text style={[s.h, { marginTop: 14 }]}>WK CONSTRUCTEURS</Text>
        {teams.map(t => (
          <View key={t.team_name} style={s.bRow}>
            <Text style={s.bPos}>{t.position}</Text>
            <Text style={[s.bName, { width: 96 }]} numberOfLines={1}>{t.team_name.replace(' F1 Team', '').replace('Red Bull Racing', 'Red Bull')}</Text>
            <View style={s.bTrack}><View style={[s.bFill, { width: `${Math.max(0.5, (t.points / maxT) * 100)}%`, backgroundColor: teamColour(t.team_colour) }]} /></View>
            <Text style={s.bPts}>{t.points}</Text>
          </View>
        ))}
        <Text style={s.srcT}>Bron: officiële uitslagen & stand (OpenF1){unknown ? ` · ${unknown} race(s) zonder data: onbekend` : ''} · {new Date(data.generated).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  card: { backgroundColor: T.card, marginHorizontal: 10, marginVertical: 5, borderRadius: T.radius, padding: 12 },
  rowB: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  h: { color: T.red, fontWeight: '800', fontSize: 12, letterSpacing: 1.5, marginBottom: 6 },
  big: { color: T.text, fontSize: 26, fontWeight: '900' }, of: { color: T.sub, fontSize: 13, fontWeight: '700' },
  prog: { height: 8, backgroundColor: T.card2, borderRadius: 4, overflow: 'hidden', marginTop: 4 },
  progF: { height: 8, backgroundColor: T.red, borderRadius: 4 },
  next: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
  flagL: { width: 36, height: 24, borderRadius: 3 },
  nextK: { color: T.sub, fontSize: 10, fontWeight: '800', letterSpacing: 1 }, nextT: { color: T.text, fontSize: 15, fontWeight: '800' },
  cd: { backgroundColor: T.red, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center' },
  cdT: { color: '#fff', fontWeight: '900', fontSize: 14 }, cdL: { color: '#ffd6d4', fontSize: 9, fontWeight: '700' },
  sub: { color: T.sub, fontSize: 12 }, err: { color: T.dim, fontSize: 12, textAlign: 'center', margin: 10 },
  tl: { paddingHorizontal: 10, paddingVertical: 5, gap: 6 },
  tlItem: { width: 66, backgroundColor: T.card, borderRadius: 10, padding: 6, alignItems: 'center', borderTopWidth: 3 },
  tlNext: { borderWidth: 2, borderColor: T.red, borderTopWidth: 3, borderTopColor: T.red },
  tlR: { color: T.dim, fontSize: 10, fontWeight: '800' },
  flag: { width: 30, height: 20, borderRadius: 2, marginVertical: 4, backgroundColor: T.card2 },
  tlN: { color: T.text, fontSize: 10, fontWeight: '700', maxWidth: 58 },
  win: { marginTop: 4, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }, winT: { color: '#fff', fontSize: 11, fontWeight: '900', textShadowColor: '#0008', textShadowRadius: 2 },
  tlU: { color: T.dim, fontSize: 10, marginTop: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: T.card2 },
  chipP: { borderColor: T.border }, chipA: { color: T.text, fontWeight: '800', fontSize: 12 }, chipV: { color: '#ffc04d', fontWeight: '900', fontSize: 12 },
  bRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3 },
  bPos: { color: T.dim, width: 20, fontSize: 11, fontWeight: '800' }, bName: { color: T.text, width: 40, fontSize: 12, fontWeight: '800' },
  bTrack: { flex: 1, height: 12, backgroundColor: T.card2, borderRadius: 6, overflow: 'hidden', marginHorizontal: 6 },
  bFill: { height: 12, borderRadius: 6 },
  bPts: { color: T.text, width: 34, textAlign: 'right', fontSize: 12, fontWeight: '800' },
  srcT: { color: T.dim, fontSize: 10, marginTop: 10 },
});
