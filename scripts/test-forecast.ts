/** Forecast sanity tests: unit gap parsing + real Singapore 2026 snapshot (lap 48) + optional live /state. */
import { readFileSync } from 'fs';
import { gapSeconds, predictOrder, MAX_SHIFT } from '../src/forecastOrder';

function assert(c: unknown, m: string) { if (!c) throw new Error('FAIL: ' + m); }

assert(gapSeconds(null, 1) === 0, 'leader null → 0');
assert(gapSeconds(12.5, 2) === 12.5, 'numeric gap');
assert(gapSeconds('1 L', 10) === 98 + 10, '1 L');
assert(gapSeconds('+2 LAPS', 15) === 196 + 15, '+2 LAPS');
console.log('gapSeconds OK');

function check(label: string, d: any) {
  const cur = d.lap_count?.CurrentLap ?? 1, tot = d.lap_count?.TotalLaps ?? 62;
  const rows = predictOrder(d.drivers, d.stints, d.positions, d.intervals, cur, tot, d.session?.circuit_short_name, undefined, d.timing_extra ?? [], d.laps ?? []);
  const flags = new Map((d.timing_extra ?? []).map((e: any) => [e.driver_number, e]));
  const running = rows.filter(r => !r.dnf);
  // DNFs at the bottom
  rows.forEach((r, i) => { if (r.dnf) assert(rows.slice(i).every(x => x.dnf), `${label}: DNF ${r.driver.name_acronym} not at bottom`); });
  for (const r of rows) {
    const f: any = flags.get(r.driver.driver_number);
    if (f?.stopped || f?.retired) assert(r.dnf, `${label}: ${r.driver.name_acronym} stopped/retired but not DNF`);
    if (!r.dnf && r.pitsLeft === 0) assert(Math.abs(r.pred - r.curPos) <= MAX_SHIFT + 3, `${label}: ${r.driver.name_acronym} moved too far (${r.curPos}→${r.pred})`);
  }
  const leader = rows.find(r => r.curPos === 1)!;
  assert(leader.pred <= 3, `${label}: leader to P${leader.pred}`);
  const mad = running.reduce((a, r) => a + Math.abs(r.pred - r.curPos), 0) / running.length;
  assert(mad < 3, `${label}: order too scrambled (MAD ${mad.toFixed(2)})`);
  const str = rows.find(r => r.driver.name_acronym === 'STR');
  console.log(`${label}: lap ${cur} MAD ${mad.toFixed(2)} | leader ${leader.driver.name_acronym}→P${leader.pred} | STR ${str ? (str.dnf ? 'DNF→P' + str.pred : 'P' + str.curPos + '→P' + str.pred) : 'n/a'}`);
  console.log('  ', rows.map(r => `${r.pred}:${r.driver.name_acronym}${r.dnf ? '(DNF)' : ''}`).join(' '));
  return rows;
}

async function main() {
  const snap = JSON.parse(readFileSync(__dirname + '/fixtures/singapore-2026-race-lap48.json', 'utf8'));
  const rows = check('snapshot', snap);
  const str = rows.find(r => r.driver.name_acronym === 'STR')!;
  assert(str.dnf && str.pred >= 20, `snapshot: STR should be DNF at bottom, got P${str.pred}`);
  try {
    const live = await (await fetch((process.env.PROXY || 'http://127.0.0.1:8787') + '/state')).json();
    if (live?.positions?.length) check('live', live);
  } catch { console.log('live: proxy unavailable, skipped'); }
  console.log('PASS');
}
main().catch(e => { console.error(e.message || e); process.exit(1); });
