import { db } from '../config/supabase.js';
import { config } from '../config/env.js';
import { COMMERCIALI, COMMERCIALE_TO_EMAIL, CLOSED_FASI, FASI } from '../lib/constants.js';
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

/** All leads of a commercial (paged past the 1000-row limit). */
async function fetchCommercialLeads(commerciale) {
  const all = [];
  for (let p = 0; p < 25; p++) {
    const from = p * 1000;
    const { data, error } = await db
      .from('opportunities')
      .select(
        'azienda, fase_pipeline, prossima_azione, data_prossimo_followup, referente, telefono, categoria',
      )
      .eq('commerciale_assegnato', commerciale)
      .order('data_prossimo_followup', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < 1000) break;
  }
  return all;
}

/**
 * For each commercial, build a "guided" daily recap based on FOLLOW-UPS:
 * overdue, due today, upcoming (within REMINDER_DAYS_AHEAD), a nudge for leads
 * with no next step ("da pianificare"), and a per-phase pipeline recap.
 */
export async function runDailyReminders(options = {}) {
  const overrideTo = options.overrideTo || null;
  const today = todayISO();
  const until = addDaysISO(today, config.cron.daysAhead);
  const results = [];

  for (const commerciale of COMMERCIALI) {
    const to = overrideTo || COMMERCIALE_TO_EMAIL[commerciale];
    const leads = await fetchCommercialLeads(commerciale);

    const open = leads.filter((l) => !CLOSED_FASI.includes(l.fase_pipeline));
    const overdue = [];
    const dueToday = [];
    const upcoming = [];
    let daPianificare = 0;

    // "To plan" nudge applies only to still-open leads with no next step.
    for (const l of open) {
      if (!(l.data_prossimo_followup || '').slice(0, 10)) daPianificare += 1;
    }
    // Scheduled follow-ups include won ("Chiuso") clients (post-sale / reorder);
    // only lost ("K.O.") leads are excluded.
    for (const l of leads) {
      if (l.fase_pipeline === 'K.O.') continue;
      const f = (l.data_prossimo_followup || '').slice(0, 10);
      if (!f) continue;
      if (f < today) overdue.push(l);
      else if (f === today) dueToday.push(l);
      else if (f <= until) upcoming.push(l);
    }

    const recap = Object.fromEntries(FASI.map((ph) => [ph, 0]));
    for (const l of leads) recap[l.fase_pipeline] = (recap[l.fase_pipeline] || 0) + 1;

    const actionable = overdue.length + dueToday.length + upcoming.length + daPianificare;
    if (actionable === 0) {
      results.push({ commerciale, to, sent: false, reason: 'niente da fare' });
      continue;
    }

    const html = buildReminderEmail({
      commerciale,
      today,
      daysAhead: config.cron.daysAhead,
      overdue,
      dueToday,
      upcoming,
      daPianificare,
      recap,
    });

    const subject = overrideTo
      ? `[TEST] La tua giornata - Cafezal CRM (${commerciale})`
      : 'La tua giornata - Cafezal CRM';

    try {
      await sendMail({ to, subject, html });
      results.push({
        commerciale,
        to,
        sent: true,
        overdue: overdue.length,
        today: dueToday.length,
        upcoming: upcoming.length,
        daPianificare,
      });
    } catch (err) {
      results.push({ commerciale, to, sent: false, error: err.message });
    }
  }

  return { today, until, daysAhead: config.cron.daysAhead, test: Boolean(overrideTo), results };
}
