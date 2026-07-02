// ============================================================
//  Backfill vendite giornaliere da Tilby, a mesi (default: da gennaio 2026).
//  Uso:  cd server && node scripts/backfill-cassa.mjs [da] [a]
//  Es.:  node scripts/backfill-cassa.mjs 2026-01-01
//  Richiede server/.env (SUPABASE_*) e negozi.tilby_token valorizzati.
// ============================================================
import { getNegoziCassa, syncNegozioRange } from '../src/services/cassa.service.js';

const romeToday = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
const from = process.argv[2] || '2026-01-01';
const to = process.argv[3] || romeToday();

const monthChunks = (a, b) => {
  const out = [];
  let start = a;
  while (start <= b) {
    const [y, m] = start.split('-').map(Number);
    const endOfMonth = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    out.push([start, endOfMonth < b ? endOfMonth : b]);
    start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  }
  return out;
};

const negozi = await getNegoziCassa();
console.log(`Backfill ${from} → ${to} per ${negozi.length} locali: ${negozi.map((n) => n.nome).join(', ')}\n`);

let totGiorni = 0;
let totVendite = 0;
for (const n of negozi) {
  for (const [a, b] of monthChunks(from, to)) {
    try {
      const r = await syncNegozioRange(n, a, b);
      totGiorni += r.giorni;
      totVendite += r.vendite;
      console.log(`  ✓ ${n.nome}  ${a} → ${b}   ${r.vendite} vendite, ${r.giorni} giorni`);
    } catch (e) {
      console.error(`  ✗ ${n.nome}  ${a} → ${b}   ERRORE: ${e.message}`);
    }
  }
}
console.log(`\nFatto: ${totVendite} vendite aggregate in ${totGiorni} righe giorno×locale.`);
process.exit(0);
