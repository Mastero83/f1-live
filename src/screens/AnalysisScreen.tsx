import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import Svg, { Polyline, Line, Text as SvgText, Circle } from 'react-native-svg';
import { useSessionCtx } from '../SessionContext';
import { useLive } from '../LiveData';
import { fmtLap, Lap, Position } from '../api';
import SessionHeader from '../components/SessionHeader';
import { T, teamColour } from '../theme';

const median = (a: number[]) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

export default function AnalysisScreen() {
  const { drivers } = useSessionCtx();
  const live = useLive();
  const { width } = useWindowDimensions();
  const [sel, setSel] = useState<number[]>([]);

  const stats = useMemo(() => {
    const byDriver = new Map<number, Lap[]>();
    for (const l of live.laps) { if (!byDriver.has(l.driver_number)) byDriver.set(l.driver_number, []); byDriver.get(l.driver_number)!.push(l); }
    const all = live.laps.map(l => l.lap_duration).filter((x): x is number => x != null);
    const cutoff = Math.min(median(all), ...all) * 1.07; // drop pit/SC/out/cool-down laps
    const posHist = new Map<number, Position[]>();
    for (const p of live.posHistory) { if (!posHist.has(p.driver_number)) posHist.set(p.driver_number, []); posHist.get(p.driver_number)!.push(p); }
    const res = drivers.map(d => {
      const laps = (byDriver.get(d.driver_number) ?? []).sort((a, b) => a.lap_number - b.lap_number);
      const clean = laps.filter(l => l.lap_duration != null && l.lap_duration <= cutoff);
      const times = clean.map(l => l.lap_duration!);
      const ph = (posHist.get(d.driver_number) ?? []).sort((a, b) => a.date.localeCompare(b.date));
      const start = ph[0]?.position, now = ph[ph.length - 1]?.position;
      return { d, clean, best: times.length ? Math.min(...times) : null, avg: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
        start, now, gained: start != null && now != null ? start - now : 0, ph };
    });
    return res.sort((a, b) => (a.now ?? 99) - (b.now ?? 99));
  }, [live.laps, live.posHistory, drivers]);

  const shown = sel.length ? stats.filter(s => sel.includes(s.d.driver_number)) : stats.slice(0, 3);
  const toggle = (n: number) => setSel(cur => cur.includes(n) ? cur.filter(x => x !== n) : [...cur, n].slice(-4));
  const fastest = stats.filter(s => s.best != null).sort((a, b) => a.best! - b.best!);
  const W = Math.min(width, 700) - 20, H = 200, P = 34;

  // lap chart scales
  const pts = shown.flatMap(s => s.clean);
  const maxLap = Math.max(1, ...pts.map(l => l.lap_number));
  const tMin = Math.min(...pts.map(l => l.lap_duration!)), tMax = Math.max(...pts.map(l => l.lap_duration!));
  const x = (lap: number) => P + ((lap - 1) / Math.max(1, maxLap - 1)) * (W - P - 8);
  const y = (t: number) => 8 + ((t - tMin) / Math.max(0.001, tMax - tMin)) * (H - 28);

  // position chart (sampled per update)
  const nDrivers = Math.max(20, drivers.length);
  const allT = shown.flatMap(s => s.ph.map(p => Date.parse(p.date)));
  const t0 = Math.min(...allT), t1 = Math.max(...allT);
  const px = (t: number) => P + ((t - t0) / Math.max(1, t1 - t0)) * (W - P - 8);
  const py = (p: number) => 8 + ((p - 1) / (nDrivers - 1)) * (H - 28);

  return (
    <View style={s.c}>
      <ScrollView horizontal style={{ flexGrow: 0, flexShrink: 0, minHeight: 46 }} contentContainerStyle={{ padding: 8, gap: 6 }} showsHorizontalScrollIndicator={false}>
        {drivers.map(d => {
          const on = shown.some(x => x.d.driver_number === d.driver_number);
          return <Pressable key={d.driver_number} onPress={() => toggle(d.driver_number)} style={[s.chip, { borderColor: teamColour(d.team_colour) }, on && { backgroundColor: teamColour(d.team_colour) }]}><Text style={s.chipT}>{d.name_acronym}</Text></Pressable>;
        })}
      </ScrollView>
      <ScrollView>
        <SessionHeader updated={live.updated} />
        <View style={s.card}>
          <Text style={s.h}>RONDETIJDEN</Text>
          <Text style={s.hint}>Tik coureurs aan om te vergelijken (max 4). Pit-/SC-ronden weggefilterd.</Text>
          {pts.length < 2 ? <Text style={s.empty}>Nog onvoldoende rondetijden.</Text> : (
            <Svg width={W - 24} height={H}>
              {[0, 0.5, 1].map(f => { const t = tMin + f * (tMax - tMin); return <React.Fragment key={f}><Line x1={P} x2={W} y1={y(t)} y2={y(t)} stroke={T.border} strokeWidth={1} /><SvgText x={2} y={y(t) + 3} fill={T.dim} fontSize={9}>{fmtLap(t)}</SvgText></React.Fragment>; })}
              <SvgText x={P} y={H - 4} fill={T.dim} fontSize={9}>R1</SvgText><SvgText x={W - 50} y={H - 4} fill={T.dim} fontSize={9}>R{maxLap}</SvgText>
              {shown.map(st => <Polyline key={st.d.driver_number} fill="none" stroke={teamColour(st.d.team_colour)} strokeWidth={2} points={st.clean.map(l => `${x(l.lap_number)},${y(l.lap_duration!)}`).join(' ')} />)}
              {shown.map(st => st.best != null && st.clean.filter(l => l.lap_duration === st.best).map(l => <Circle key={`b${st.d.driver_number}`} cx={x(l.lap_number)} cy={y(l.lap_duration!)} r={4} fill={T.purple} />))}
            </Svg>
          )}
          <View style={s.legend}>{shown.map(st => <Text key={st.d.driver_number} style={[s.leg, { color: teamColour(st.d.team_colour) }]}>● {st.d.name_acronym}  <Text style={s.legSub}>snelste {fmtLap(st.best)} · gem. {fmtLap(st.avg)}</Text></Text>)}</View>
        </View>

        <View style={s.card}>
          <Text style={s.h}>POSITIEVERLOOP</Text>
          {allT.length < 2 ? <Text style={s.empty}>Nog geen positiedata.</Text> : (
            <Svg width={W - 24} height={H}>
              {[1, 5, 10, 15, 20].map(p => <React.Fragment key={p}><Line x1={P} x2={W} y1={py(p)} y2={py(p)} stroke={T.border} strokeWidth={1} /><SvgText x={6} y={py(p) + 3} fill={T.dim} fontSize={9}>P{p}</SvgText></React.Fragment>)}
              {shown.map(st => {
                const pts2: string[] = []; let last: number | undefined;
                for (const p of st.ph) { const tx = px(Date.parse(p.date)); if (last != null) pts2.push(`${tx},${py(last)}`); pts2.push(`${tx},${py(p.position)}`); last = p.position; }
                if (last != null) pts2.push(`${px(t1)},${py(last)}`);
                return <Polyline key={st.d.driver_number} fill="none" stroke={teamColour(st.d.team_colour)} strokeWidth={2} points={pts2.join(' ')} />;
              })}
            </Svg>
          )}
        </View>

        <View style={s.card}>
          <Text style={s.h}>SNELSTE RONDES & TEMPO</Text>
          <View style={s.tr}><Text style={[s.th, { width: 24 }]}>#</Text><Text style={[s.th, { flex: 1 }]}>COUREUR</Text><Text style={[s.th, s.tn]}>SNELSTE</Text><Text style={[s.th, s.tn]}>GEM.</Text><Text style={[s.th, { width: 52, textAlign: 'right' }]}>+/− POS</Text></View>
          {fastest.map((st, i) => (
            <View key={st.d.driver_number} style={s.tr}>
              <Text style={[s.td, { width: 24, color: i === 0 ? T.purple : T.sub }]}>{i + 1}</Text>
              <Text style={[s.td, { flex: 1, fontWeight: '800' }]}><Text style={{ color: teamColour(st.d.team_colour) }}>▍</Text>{st.d.name_acronym}</Text>
              <Text style={[s.td, s.tn, i === 0 && { color: T.purple, fontWeight: '800' }]}>{fmtLap(st.best)}</Text>
              <Text style={[s.td, s.tn]}>{fmtLap(st.avg)}</Text>
              <Text style={[s.td, { width: 52, textAlign: 'right', fontWeight: '700', color: st.gained > 0 ? T.green : st.gained < 0 ? '#ff5a5a' : T.sub }]}>{st.gained > 0 ? `▲${st.gained}` : st.gained < 0 ? `▼${-st.gained}` : '–'}</Text>
            </View>
          ))}
        </View>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: T.bg },
  chip: { borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: T.card }, chipT: { color: T.text, fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: T.card, marginHorizontal: 10, marginVertical: 5, borderRadius: T.radius, padding: 12 },
  h: { color: T.red, fontWeight: '800', fontSize: 12, letterSpacing: 1.5, marginBottom: 4 }, hint: { color: T.dim, fontSize: 11, marginBottom: 6 },
  legend: { marginTop: 6, gap: 2 }, leg: { fontWeight: '800', fontSize: 12 }, legSub: { color: T.sub, fontWeight: '400' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border },
  th: { color: T.dim, fontSize: 10, fontWeight: '800' }, td: { color: T.text, fontSize: 13, fontVariant: ['tabular-nums'] }, tn: { width: 70, textAlign: 'right' },
  empty: { color: T.dim, padding: 16, textAlign: 'center' },
});
