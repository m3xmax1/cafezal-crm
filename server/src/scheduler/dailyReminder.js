import cron from 'node-cron';
import { config } from '../config/env.js';
import { runDailyReminders } from '../services/reminder.service.js';

/**
 * In-process scheduler. Works when the server runs as a long-lived process
 * (local, Railway, Render, a VM…). On serverless platforms (Vercel) use the
 * /api/cron/daily-reminder endpoint with a platform cron instead.
 */
export function startScheduler() {
  if (!config.cron.enabled) {
    console.log('[scheduler] Disabled (CRON_ENABLED=false).');
    return null;
  }
  if (!cron.validate(config.cron.schedule)) {
    console.warn(`[scheduler] Invalid CRON_SCHEDULE "${config.cron.schedule}" — not started.`);
    return null;
  }

  const task = cron.schedule(
    config.cron.schedule,
    async () => {
      console.log(`[scheduler] Running daily reminders @ ${new Date().toISOString()}`);
      try {
        const r = await runDailyReminders();
        console.log('[scheduler] Done:', JSON.stringify(r.results));
      } catch (e) {
        console.error('[scheduler] Failed:', e);
      }
    },
    { timezone: config.cron.timezone },
  );

  console.log(`[scheduler] Scheduled "${config.cron.schedule}" (${config.cron.timezone}).`);
  return task;
}
