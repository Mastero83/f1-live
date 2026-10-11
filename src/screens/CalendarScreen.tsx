import React, { useMemo, useRef, useState, useEffect } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Image, ActivityIndicator } from 'react-native';
import { usePolling } from '../hooks';
import { get, Meeting, Session, sessionStatus, SESSION_NL, fmtDay, fmtTime, fmtRange } from '../api';
import { T } from '../theme';
import ErrorBanner from '../components/ErrorBanner';

const BADGE = { Live: { bg: T.red, t: 'LIVE' }, Gepland: { bg: '#2d2d3a', t: 'GEPLAND' }, Afgerond: { bg: '#1f3a2a', t: 'AFGEROND' } } as const;

export default function CalendarScreen({ onOpen }: { onOpen: (target: number | 'latest') => void }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, error, refresh } = usePolling(async () => {
    const [meetings, sessions] = await Promise.all([get<Meeting>('meetings', { year }), get<Session>('sessions', { year })]);
    return { meetings, sessions };
  }, 60_000, [year]);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const scroll = useRef<ScrollView>(null);
  const ys = useRef(new Map<number, number>());
  const scrolledFor = useRef<number | null>(null);
  const now = Date.now();

  const { meetings, liveSessions, focusKey } = useMemo(() => {
    const ms = [...(data?.meetings ?? [])].filter(m => m.year === year).sort((a, b) => a.date_start.localeCompare(b.date_start));
    const byM = new Map<number, Session[]>();
    for (const s of data?.sessions ?? []) { if (!byM.has(s.meeting_key)) byM.set(s.meeting_key, []); byM.get(s.meeting_key)!.push(s); }
    byM.forEach(l => l.sort((a, b) => a.date_start.localeCompare(b.date_start)));
    const meetings = ms.map(m => ({ m, sessions: byM.get(m.meeting_key) ?? [] }));
    const liveSessions = (data?.sessions ?? []).filter(s => sessionStatus(s, now) === 'Live');
    const endOf = (x: { m: Meeting; sessions: Session[] }) => Date.parse(x.sessions[x.sessions.length - 1]?.date_end ?? x.m.date_end ?? x.m.date_start);
    const focus = meetings.find(x => !x.m.is_cancelled && endOf(x) + 6 * 3600_000 >= now);
    return { meetings, liveSessions, focusKey: focus?.m.meeting_key };
  }, [data, year]);

  // auto-expand current/next weekend once per year load
  useEffect(() => { if (focusKey != null) setOpen(o => new Set(o).add(focusKey)); }, [focusKey]);
  const onLayoutMeeting = (key: number, y: number) => { ys.current.set(key, y); tryScroll(); };
  const tryScroll = () => {
    if (focusKey == null || scrolledFor.current === focusKey) return;
    const y = ys.current.get(focusKey);
    if (y == null || y === 0) return;
    scrolledFor.current = focusKey;
    scroll.current?.scrollTo({ y: Math.max(0, y - 8), animated: false });
  };
  useEffect(() => { const ids = [100, 400, 1000].map(t => setTimeout(tryScroll, t)); return () => ids.forEach(clearTimeout); }, [focusKey, data]);
  const toggle = (k: number) => setOpen(o => { const n = new Set(o); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <View style={s.c}>
      <View style={s.top}>
        {liveSessions.length > 0 ? liveSessions.map(ls => (
          <Pressable key={ls.session_key} style={s.liveBtn} onPress={() => onOpen(ls.session_key)}>
            <View style={s.dot} /><View style={{ flex: 1 }}>
              <Text style={s.liveK}>NU LIVE</Text>
              <Text style={s.liveT}>{SESSION_NL[ls.session_name] ?? ls.session_name} · {ls.circuit_short_name}</Text>
            </View><Text style={s.liveArrow}>›</Text>
          </Pressable>
        )) : (
          <Pressable style={s.latestBtn} onPress={() => onOpen('latest')}>
            <Text style={s.latestT}>Laatste sessie openen</Text><Text style={s.liveArrow}>›</Text>
          </Pressable>
        )}
        <View style={s.yearRow}>
          <Pressable onPress={() => { scrolledFor.current = null; setYear(y => y - 1); }} hitSlop={10}><Text style={s.yArrow}>‹</Text></Pressable>
          <Text style={s.year}>Seizoen {year}</Text>
          <Pressable onPress={() => { scrolledFor.current = null; setYear(y => y + 1); }} hitSlop={10}><Text style={s.yArrow}>›</Text></Pressable>
        </View>
      </View>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: 30 }}>
        <ErrorBanner msg={error} onRetry={refresh} hasData={!!data} />
        {!data && !error && <ActivityIndicator color={T.red} style={{ marginTop: 40 }} />}
        {data && meetings.length === 0 && <Text style={s.empty}>Geen kalender voor {year}.</Text>}
        {meetings.map(({ m, sessions }) => {
          const isTest = /test/i.test(m.meeting_name);
          const idx = meetings.filter(x => !/test/i.test(x.m.meeting_name) && x.m.date_start < m.date_start).length;
          const isFocus = m.meeting_key === focusKey;
          const hasLive = sessions.some(x => sessionStatus(x, now) === 'Live');
          const done = sessions.length > 0 && sessions.every(x => sessionStatus(x, now) === 'Afgerond');
          const expanded = open.has(m.meeting_key);
          return (
            <View key={m.meeting_key} onLayout={e => onLayoutMeeting(m.meeting_key, e.nativeEvent.layout.y)}
              style={[s.card, isFocus && s.focus, hasLive && { borderColor: T.red }, done && !isFocus && { opacity: 0.75 }]}>
              <Pressable style={s.mRow} onPress={() => toggle(m.meeting_key)}>
                <Text style={s.round}>{isTest ? 'T' : String(idx + 1).padStart(2, '0')}</Text>
                {m.country_flag ? <Image source={{ uri: m.country_flag }} style={s.flag} /> : <View style={s.flag} />}
                <View style={{ flex: 1 }}>
                  <Text style={s.mName} numberOfLines={1}>{m.meeting_name.replace('Grand Prix', 'GP')}</Text>
                  <Text style={s.mSub} numberOfLines={1}>{m.circuit_short_name} · {m.country_name}</Text>
                  <Text style={s.mDate}>{fmtRange(m.date_start, m.date_end)}{m.is_cancelled ? ' · GEANNULEERD' : ''}</Text>
                </View>
                {hasLive ? <Text style={[s.badge, { backgroundColor: T.red }]}>LIVE</Text> : isFocus ? <Text style={[s.badge, { backgroundColor: '#3a2d10', color: '#ffc04d' }]}>{done ? 'NET GEWEEST' : Date.parse(m.date_start) <= now ? 'DIT WEEKEND' : 'VOLGENDE'}</Text> : null}
                <Text style={s.chev}>{expanded ? '▾' : '▸'}</Text>
              </Pressable>
              {expanded && sessions.map(x => {
                const st = sessionStatus(x, now);
                const b = BADGE[st];
                return (
                  <Pressable key={x.session_key} style={s.sRow} onPress={() => onOpen(x.session_key)}>
                    <View style={{ width: 92 }}><Text style={s.sDay}>{fmtDay(x.date_start)}</Text><Text style={s.sTime}>{fmtTime(x.date_start)}</Text></View>
                    <Text style={s.sName}>{SESSION_NL[x.session_name] ?? x.session_name}</Text>
                    <Text style={[s.badge, { backgroundColor: b.bg }]}>{b.t}</Text>
                    <Text style={s.chev}>›</Text>
                  </Pressable>
                );
              })}
              {expanded && sessions.length === 0 && <Text style={s.empty}>Nog geen sessies bekend.</Text>}
            </View>
          );
        })}
        <Text style={s.foot}>Tijden in Nederlandse tijd (Europe/Amsterdam). Data: OpenF1.</Text>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: T.bg },
  top: { padding: 10, paddingBottom: 4, gap: 8 },
  liveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.red, borderRadius: T.radius, padding: 14, gap: 12 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff' },
  liveK: { color: '#fff', fontWeight: '900', letterSpacing: 2, fontSize: 12 }, liveT: { color: '#fff', fontWeight: '700', fontSize: 16 },
  liveArrow: { color: '#fff', fontSize: 28, fontWeight: '300' },
  latestBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: T.card, borderRadius: T.radius, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: T.border },
  latestT: { color: T.text, fontWeight: '700' },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
  year: { color: T.text, fontWeight: '800', fontSize: 16, letterSpacing: 0.5 }, yArrow: { color: T.red, fontSize: 28, fontWeight: '700', paddingHorizontal: 8 },
  card: { backgroundColor: T.card, marginHorizontal: 10, marginVertical: 4, borderRadius: T.radius, borderWidth: 1, borderColor: 'transparent', overflow: 'hidden' },
  focus: { borderColor: '#ffc04d' },
  mRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  round: { color: T.dim, fontWeight: '800', width: 22 },
  flag: { width: 36, height: 24, borderRadius: 3, backgroundColor: T.card2 },
  mName: { color: T.text, fontWeight: '800', fontSize: 16 }, mSub: { color: T.sub, fontSize: 12 }, mDate: { color: T.red, fontSize: 12, fontWeight: '700', marginTop: 2 },
  badge: { color: '#fff', fontWeight: '800', fontSize: 10, letterSpacing: 0.8, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, overflow: 'hidden' },
  chev: { color: T.dim, fontSize: 18, width: 14, textAlign: 'center' },
  sRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border, gap: 8, backgroundColor: '#13131a' },
  sDay: { color: T.sub, fontSize: 12, textTransform: 'capitalize' }, sTime: { color: T.text, fontWeight: '800', fontSize: 15, fontVariant: ['tabular-nums'] },
  sName: { flex: 1, color: T.text, fontWeight: '600', fontSize: 14 },
  err: { color: '#ff6b6b', padding: 12 }, empty: { color: T.dim, padding: 16, textAlign: 'center' },
  foot: { color: T.dim, fontSize: 11, textAlign: 'center', marginTop: 12 },
});
