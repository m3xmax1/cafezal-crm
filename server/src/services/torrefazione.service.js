import { db } from '../config/supabase.js';
import { config } from '../config/env.js';
import { TORREFAZIONE_EMAILS, STORE_EMAIL_TO_NEGOZIO } from '../lib/constants.js';
import { buildWeeklyRecapEmail, buildStoreReminderEmail } from '../lib/torreEmailTemplate.js';
import { sendMail } from '../lib/mailer.js';

const ATTIVI = ['ricevuto', 'in_lavorazione', 'pronto', 'problema'];

/** Today's date (YYYY-MM-DD) in the configured timezone. */
function todayISO() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.cron.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Weekday in the configured timezone: 1=Mon … 7=Sun. */
function weekdayInTZ() {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: config.cron.timezone,
    weekday: 'short',
  }).format(new Date());
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[name] || 0;
}

/** Active (not yet shipped/archived) orders with their lines + store name. */
async function fetchActiveOrders() {
  const { data, error } = await db
    .from('ordini')
    .select('id, origine, cliente_nome, stato, note, data_consegna, peso_totale_kg, negozi(nome), ordini_righe(nome_caffe, quantita, peso_kg)')
    .in('stato', ATTIVI)
    .order('data_consegna', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data || [];
}

/** Aggregate orders into produzione (per coffee) + destinazioni + problemi. */
function aggregate(orders) {
  const prod = {};
  for (const o of orders) {
    for (const r of o.ordini_righe || []) {
      const k = r.nome_caffe || '—';
      if (!prod[k]) prod[k] = { pezzi: 0, kg: 0 };
      prod[k].pezzi += Number(r.quantita) || 0;
      prod[k].kg += (Number(r.quantita) || 0) * (Number(r.peso_kg) || 0);
    }
  }
  const produzione = Object.entries(prod).sort((a, b) => b[1].kg - a[1].kg);
  const kgTot = produzione.reduce((s, [, v]) => s + v.kg, 0);

  const g = {};
  for (const o of orders) {
    const nome = o.cliente_nome || o.negozi?.nome || '—';
    (g[nome] ||= { nome, origine: o.origine, ordini: [] }).ordini.push(o);
  }
  const destinazioni = Object.values(g).sort((a, b) => a.nome.localeCompare(b.nome));

  const problemi = orders.filter((o) => o.stato === 'problema');
  return { produzione, kgTot, destinazioni, problemi };
}

/** Monday recap to the roastery: what to produce/ship this week + problems. */
export async function runWeeklyRecap(options = {}) {
  const overrideTo = options.overrideTo || null;
  const today = todayISO();
  const to = overrideTo || TORREFAZIONE_EMAILS[0];

  const orders = await fetchActiveOrders();
  const { produzione, kgTot, destinazioni, problemi } = aggregate(orders);

  const html = buildWeeklyRecapEmail({
    today,
    produzione,
    destinazioni,
    problemi,
    kgTot,
    ordiniAttivi: orders.length,
  });
  const subject = overrideTo
    ? '[TEST] Torrefazione — Recap settimana (Cafezal)'
    : 'Torrefazione — Recap della settimana';

  try {
    await sendMail({ to, subject, html });
    return {
      job: 'weekly-recap',
      today,
      to,
      sent: true,
      ordini: orders.length,
      destinazioni: destinazioni.length,
      kg: Number(kgTot.toFixed(2)),
      problemi: problemi.length,
      test: Boolean(overrideTo),
    };
  } catch (err) {
    return { job: 'weekly-recap', today, to, sent: false, error: err.message };
  }
}

/** Friday reminder to every store with a login: place your weekly order. */
export async function runStoreReminders(options = {}) {
  const overrideTo = options.overrideTo || null;
  const today = todayISO();
  const results = [];

  for (const [email, negozio] of Object.entries(STORE_EMAIL_TO_NEGOZIO)) {
    const to = overrideTo || email;
    const html = buildStoreReminderEmail({ negozio, today });
    const subject = overrideTo
      ? `[TEST] Promemoria ordine — ${negozio} (Cafezal)`
      : `Promemoria ordine settimanale — ${negozio}`;
    try {
      await sendMail({ to, subject, html });
      results.push({ negozio, to, sent: true });
    } catch (err) {
      results.push({ negozio, to, sent: false, error: err.message });
    }
    if (overrideTo) break; // in test mode send a single sample, not 5 copies
  }
  return { job: 'store-reminders', today, test: Boolean(overrideTo), results };
}

/**
 * Weekday dispatcher, piggy-backed on the existing daily cron so we don't add
 * Vercel cron slots: Monday → roastery recap, Friday → store reminders.
 * `force` runs both regardless of weekday (manual testing).
 */
export async function runWeeklyJobs(options = {}) {
  const wd = weekdayInTZ();
  const out = { weekday: wd, ran: [] };
  if (options.force || wd === 1) out.ran.push(await runWeeklyRecap(options));
  if (options.force || wd === 5) out.ran.push(await runStoreReminders(options));
  return out;
}
