/** Sanity: with live /state, leader stays near top; predicted order ≈ current order (unless pending stops). */
import { gapSeconds, predictOrder } from '../src/forecastOrder';
import { Driver, Interval, Position, Stint } from '../src/api';

function assert(c: unknown, m: string) { if (!c) throw new Error(m); }

// unit: gap parsing
assert(gapSeconds(null, 1) === 0, 'leader null → 0');
assert(gapSeconds(undefined, 1) === 0, 'leader undefined → 0');
assert(gapSeconds(12.5, 2) === 12.5, 'numeric gap');
assert(gapSeconds('1 L', 10) === 98 + 10, '1 L');
assert(gapSeconds('+1 LAP', 10) === 98 + 10, '+1 LAP');
assert(gapSeconds('+2 LAPS', 15) === 196 + 15, '+2 LAPS');
assert(gapSeconds(null, 5) === 10, 'missing midfield stays near order');
console.log('gapSeconds OK');

async function main() {
const PROXY = process.env.PROXY || 'http://127.0.0.1:8787';
const d = await (await fetch(`${PROXY}/state`)).json() as {
  drivers: Driver[]; positions: Position[]; intervals: Interval[]; stints: Stint[];
  lap_count?: { CurrentLap: number; TotalLaps: number }; session?: { circuit_short_name?: string };
};
const cur = d.lap_count?.CurrentLap ?? 1, tot = d.lap_count?.TotalLaps ?? 62;
const rows = predictOrder(d.drivers, d.stints, d.positions, d.intervals, cur, tot, d.session?.circuit_short_name);
assert(rows.length >= 10, 'enough drivers');
const leader = d.positions.find(p => p.position === 1)!;
const predLeader = rows.find(r => r.driver.driver_number === leader.driver_number)!;
console.log('lap', cur, 'leader', predLeader.driver.name_acronym, 'cur P1 → pred P' + predLeader.pred, 'pitsLeft', predLeader.pitsLeft);
assert(predLeader.pred <= 3, `leader should stay top-3 (got P${predLeader.pred})`);
// Spearman-ish: average |pred - cur| should be modest
const mad = rows.reduce((a, r) => a + Math.abs(r.pred - r.curPos), 0) / rows.length;
console.log('mean |pred-cur|', mad.toFixed(2));
assert(mad < 6, `order too scrambled (MAD ${mad})`);
console.log('top5', rows.slice(0, 5).map(r => `${r.pred}:${r.driver.name_acronym}(nu${r.curPos}${r.pitsLeft ? '+pit' : ''})`).join(' '));
console.log('PASS');
}
main().catch(e => { console.error(e); process.exit(1); });
