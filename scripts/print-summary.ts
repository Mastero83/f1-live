import { summarize } from '../src/summary';
async function main() { for (const k of process.argv.slice(2)) { const st = await (await fetch(`http://localhost:8787/archive?key=${k}`)).json(); console.log(`== ${k} ${st.session.session_name} ${st.session.year}`); for (const p of summarize(st)) console.log(p); } }
main();
