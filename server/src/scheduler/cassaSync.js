import cron from 'node-cron';
import { config } from '../config/env.js';
import { runCassaSync } from '../services/cassa.service.js';

/**
 * Sync giornaliero cassa Tilby → vendite_giornaliere (ultimi 3 giorni, così
 * recuperiamo anche eventuali ritardi). In-process: vale per server persistente;
 * su Vercel usare /api/cron/cassa-sync con CRON_SECRET.
 */
export function startCassaScheduler() {
  if (!config.cron.enabled) return null;
  const schedule = process.env.CASSA_SYNC_SCHEDULE || '45 4 * * *';
  if (!cron.validate(schedule)) {
    console.warn(`[cassa] CASSA_SYNC_SCHEDULE non valida "${schedule}" — scheduler non avviato.`);
    return null;
  }
  const task = cron.schedule(schedule, async () => {
    console.log(`[cassa] Sync vendite Tilby @ ${new Date().toISOString()}`);
    try {
      const r = await runCassaSync({ days: 3 });
      console.log('[cassa] Done:', JSON.stringify(r.results));
    } catch (e) {
      console.error('[cassa] Failed:', e.message);
    }
  }, { timezone: config.cron.timezone });
  console.log(`[cassa] Sync schedulato "${schedule}" (${config.cron.timezone}).`);
  return task;
}
