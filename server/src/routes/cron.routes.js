import { Router } from 'express';
import { config } from '../config/env.js';
import { runDailyReminders } from '../services/reminder.service.js';
import { runMonthlyReport } from '../services/report.service.js';
import {
  runWeeklyJobs,
  runWeeklyRecap,
  runStoreReminders,
} from '../services/torrefazione.service.js';
import { runMonthlyClientReminders } from '../services/clienti.service.js';
import { runCassaSync } from '../services/cassa.service.js';

const router = Router();

/** Shared CRON_SECRET check (accepts header, Bearer, or ?secret=). */
function checkSecret(req, res) {
  const provided =
    req.headers['x-cron-secret'] ||
    req.query.secret ||
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (config.cron.secret && provided !== config.cron.secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

/**
 * Optional test recipient (`?to=` or body.to) to redirect emails to a single
 * inbox. Only honored when CRON_SECRET is configured — otherwise the endpoint is
 * open and an arbitrary `to` could exfiltrate the report's business data.
 */
function overrideToFrom(req) {
  if (!config.cron.secret) return null;
  const v = (req.query.to || req.body?.to || '').toString().trim();
  return /^\S+@\S+\.\S+$/.test(v) ? v : null;
}

/**
 * Trigger the daily reminder job manually or from a scheduler
 * (Vercel Cron, GitHub Actions, cron-job.org, etc.).
 *
 * Protected by CRON_SECRET (skipped if CRON_SECRET is empty).
 * Accepts the secret via:
 *   - header  x-cron-secret: <secret>
 *   - header  Authorization: Bearer <secret>   (Vercel Cron format)
 *   - query   ?secret=<secret>
 */
async function handler(req, res, next) {
  try {
    if (!checkSecret(req, res)) return undefined;
    const overrideTo = overrideToFrom(req);
    const result = await runDailyReminders({ overrideTo });
    // Piggy-back the weekday jobs on the daily cron so we don't consume extra
    // Vercel cron slots: Monday → roastery recap, Friday → store reminders.
    // Failures here must never break the daily reminder, so isolate them.
    let weekly = null;
    try {
      weekly = await runWeeklyJobs({ overrideTo });
    } catch (e) {
      weekly = { error: e.message };
    }
    return res.json({ ok: true, ...result, weekly });
  } catch (e) {
    return next(e);
  }
}

async function monthlyReportHandler(req, res, next) {
  try {
    if (!checkSecret(req, res)) return undefined;
    const overrideTo = overrideToFrom(req);
    const result = await runMonthlyReport({ overrideTo });
    // Piggy-back: reminder mensile clienti sotto minimo (isolato).
    let clienti = null;
    try {
      clienti = await runMonthlyClientReminders({ overrideTo });
    } catch (e) {
      clienti = { error: e.message };
    }
    return res.json({ ...result, clientiMensile: clienti });
  } catch (e) {
    return next(e);
  }
}

router.post('/daily-reminder', handler);
router.get('/daily-reminder', handler); // Vercel Cron issues GET requests

router.post('/monthly-report', monthlyReportHandler);
router.get('/monthly-report', monthlyReportHandler);

// ── Torrefazione weekly jobs ──
// Dedicated endpoints (always run their job) for manual triggering / testing,
// plus a weekday-gated dispatcher for an optional external scheduler.
function torreHandler(fn) {
  return async (req, res, next) => {
    try {
      if (!checkSecret(req, res)) return undefined;
      const result = await fn({ overrideTo: overrideToFrom(req) });
      return res.json({ ok: true, ...result });
    } catch (e) {
      return next(e);
    }
  };
}

const weeklyRecap = torreHandler(runWeeklyRecap);
router.post('/weekly-recap', weeklyRecap);
router.get('/weekly-recap', weeklyRecap);

const storeReminders = torreHandler(runStoreReminders);
router.post('/store-reminders', storeReminders);
router.get('/store-reminders', storeReminders);

const clientiMensile = torreHandler(runMonthlyClientReminders);
router.post('/clienti-mensile', clientiMensile);
router.get('/clienti-mensile', clientiMensile);

// ── Cassa Tilby: sync vendite giornaliere (default ultimi 3 giorni) ──
async function cassaSyncHandler(req, res, next) {
  try {
    if (!checkSecret(req, res)) return undefined;
    const days = Number(req.query.days) || 3;
    const result = await runCassaSync({ days });
    return res.json({ ok: true, ...result });
  } catch (e) {
    return next(e);
  }
}
router.post('/cassa-sync', cassaSyncHandler);
router.get('/cassa-sync', cassaSyncHandler);

// Weekday dispatcher (Mon recap / Fri reminders). `?force=1` runs both now.
async function weeklyDispatch(req, res, next) {
  try {
    if (!checkSecret(req, res)) return undefined;
    const force = ['1', 'true', 'yes'].includes(String(req.query.force || '').toLowerCase());
    const result = await runWeeklyJobs({ overrideTo: overrideToFrom(req), force });
    return res.json({ ok: true, ...result });
  } catch (e) {
    return next(e);
  }
}
router.post('/weekly', weeklyDispatch);
router.get('/weekly', weeklyDispatch);

export default router;
