import { Router } from 'express';
import { config } from '../config/env.js';
import { runDailyReminders } from '../services/reminder.service.js';
import { runMonthlyReport } from '../services/report.service.js';

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
    const result = await runDailyReminders({ overrideTo: overrideToFrom(req) });
    return res.json({ ok: true, ...result });
  } catch (e) {
    return next(e);
  }
}

async function monthlyReportHandler(req, res, next) {
  try {
    if (!checkSecret(req, res)) return undefined;
    const result = await runMonthlyReport({ overrideTo: overrideToFrom(req) });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

router.post('/daily-reminder', handler);
router.get('/daily-reminder', handler); // Vercel Cron issues GET requests

router.post('/monthly-report', monthlyReportHandler);
router.get('/monthly-report', monthlyReportHandler);

export default router;
