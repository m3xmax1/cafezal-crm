import { db } from '../config/supabase.js';
import { config } from '../config/env.js';
import {
  COMMERCIALI,
  COMMERCIALE_TO_EMAIL,
  CLOSED_FASI,
  FASI,
} from '../lib/constants.js';
import { buildReminderEmail } from '../lib/emailTemplate.js';
import { sendMail } from '../lib/mailer.js';

/** Today's date (YYYY-MM-DD) in the configured timezone. */
function todayISO() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.cron.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date()); // en-CA → YYYY-MM-DD
}

function addDaysISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/**
 * For each commercial, find opportunities due within REMINDER_DAYS_AHEAD days
 * (excluding finalized phases), build a per-phase recap, and email them.
 */
export async function runDailyReminders(options = {}) {
  // When overrideTo is set (test mode), every email is redirected to that single
  // address instead of the real commercials — handy to verify SMTP without spamming.
  const overrideTo = options.overrideTo || null;
  const today = todayISO();
  const until = addDaysISO(today, config.cron.daysAhead);
  const results = [];

  for (const commerciale of COMMERCIALI) {
    const to = overrideTo || COMMERCIALE_TO_EMAIL[commerciale];

    // Opportunities due in the window.
    const { data: dueRaw, error: dueErr } = await db
      .from('opportunities')
      .select('*')
      .eq('commerciale_assegnato', commerciale)
      .gte('data_scadenza', today)
      .lte('data_scadenza', until)
      .order('data_scadenza', { ascending: true });
    if (dueErr) throw dueErr;
    const due = (dueRaw || []).filter((o) => !CLOSED_FASI.includes(o.fase_pipeline));

    // Per-phase recap across all of this commercial's opportunities.
    const { data: all, error: allErr } = await db
      .from('opportunities')
      .select('fase_pipeline')
      .eq('commerciale_assegnato', commerciale);
    if (allErr) throw allErr;

    const recap = Object.fromEntries(FASI.map((f) => [f, 0]));
    for (const row of all || []) {
      recap[row.fase_pipeline] = (recap[row.fase_pipeline] || 0) + 1;
    }
    const openCount =
      (all?.length || 0) - (recap['Chiuso'] || 0) - (recap['K.O.'] || 0);

    // Skip people with nothing relevant to report.
    if (due.length === 0 && openCount === 0) {
      results.push({ commerciale, to, sent: false, reason: 'no due items / no open pipeline' });
      continue;
    }

    const html = buildReminderEmail({
      commerciale,
      due,
      recap,
      daysAhead: config.cron.daysAhead,
      today,
    });

    const subject = overrideTo
      ? `[TEST] Recap Giornaliero - Cafezal CRM (${commerciale})`
      : 'Recap Giornaliero - Cafezal CRM';

    try {
      await sendMail({ to, subject, html });
      results.push({ commerciale, to, sent: true, dueCount: due.length });
    } catch (err) {
      results.push({ commerciale, to, sent: false, error: err.message });
    }
  }

  return { today, until, daysAhead: config.cron.daysAhead, test: Boolean(overrideTo), results };
}
