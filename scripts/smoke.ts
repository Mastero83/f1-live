import { get, buildLeaderboard, Driver, Position, Interval, Lap, TeamRadio, RaceControl, Session, sessionStatus } from '../src/api';
async function run(key: number | 'latest') {
  const [s] = await get<Session>('sessions', { session_key: key });
  const k = s.session_key;
  const [d, p, i, l, r, rc] = await Promise.all([get<Driver>('drivers',{session_key:k}), get<Position>('position',{session_key:k}), get<Interval>('intervals',{session_key:k}), get<Lap>('laps',{session_key:k}), get<TeamRadio>('team_radio',{session_key:k}), get<RaceControl>('race_control',{session_key:k})]);
  console.log(`\n${s.session_name} ${s.circuit_short_name} ${s.year ?? ''} [${sessionStatus(s)}] drivers=${d.length} pos=${p.length} int=${i.length} laps=${l.length} radio=${r.length} rc=${rc.length}`);
  buildLeaderboard(d,p,i,l).slice(0,5).forEach(x=>console.log(x.position, x.driver?.name_acronym, x.driver?.team_colour, x.gap, x.interval, x.lastLap, x.laps));
  console.log('rc last:', rc[rc.length-1]?.message);
}
(async()=>{ const races = await get<Session>('sessions',{year:2025,session_name:'Race'}); await run(races[races.length-1].session_key); })();
