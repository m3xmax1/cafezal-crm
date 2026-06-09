import { Router } from 'express';
import { config } from '../config/env.js';
import { runDailyReminders } from '../services/reminder.service.js';

const router = Router();

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
    const provided =
      req.headers['x-cron-secret'] ||
      req.query.secret ||
      (req.headers.authorization || '').replace(/^Bearer\s+/i, '');

    if (config.cron.secret && provided !== config.cron.secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await runDailyReminders();
    return res.json({ ok: true, ...result });
  } catch (e) {
    return next(e);
  }
}

router.post('/daily-reminder', handler);
router.get('/daily-reminder', handler); // Vercel Cron issues GET requests

export default router;
