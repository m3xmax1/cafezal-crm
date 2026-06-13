import { db } from '../config/supabase.js';
import { config } from '../config/env.js';
import { COMMERCIALI, FASI } from '../lib/constants.js';
import { buildMonthlyReportEmail } from '../lib/reportTemplate.js';
import { sendMail } from '../lib/mailer.js';

const PAGE = 1000;

/** Load every opportunity (paged past PostgREST's ~1000-row limit). */
async function fetchAll() {
  const all = [];
  for (let p = 0; p < 25; p++) {
    const from = p * PAGE;
    const { data, error } = await db
      .from('opportunities')
      .select(
        'commerciale_assegnato,fase_pipeline,categoria,quantita_minima_kg,data_ultima_modifica,sensibility,macchina',
      )
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
  }
  return all;
}

const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

/** The previous calendar month window [start, end) in the configured timezone. */
function previousMonthWindow(tz) {
  const ym = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
  }).format(new Date()); // YYYY-MM (current month)
  const [y, m] = ym.split('-').map(Number);
  let py = y;
  let pm = m - 1;
  if (pm === 0) {
    pm = 12;
    py -= 1;
  }
  const pad = (n) => String(n).padStart(2, '0');
  return {
    startISO: `${py}-${pad(pm)}-01`, // first day of previous month
    endISO: `${y}-${pad(m)}-01`, // first day of current month (exclusive)
    label: `${MESI[pm - 1]} ${py}`,
  };
}

function emptyPhases() {
  return Object.fromEntries(FASI.map((f) => [f, 0]));
}

/**
 * Build the monthly management report and email it to config.report.to.
 * The report covers the *previous* calendar month (the job runs on the 1st).
 */
export async function runMonthlyReport() {
  const tz = config.cron.timezone;
  const win = previousMonthWindow(tz);
  const rows = await fetchAll();

  const inMonth = (o) => {
    const d = (o.data_ultima_modifica || '').slice(0, 10);
    return d && d >= win.startISO && d < win.endISO;
  };

  // Overall figures.
  const total = rows.length;
  const pool = rows.filter((o) => !o.commerciale_assegnato).length;
  const assigned = total - pool;

  const byPhase = emptyPhases();
  for (const o of rows) {
    if (o.fase_pipeline in byPhase) byPhase[o.fase_pipeline] += 1;
  }
  const won = byPhase['Chiuso'] || 0;
  const lost = byPhase['K.O.'] || 0;
  const open = total - won - lost;
  const updatedThisMonth = rows.filter(inMonth).length;

  // Per-commercial breakdown.
  const perCommercial = COMMERCIALI.map((c) => {
    const mine = rows.filter((o) => o.commerciale_assegnato === c);
    const phases = emptyPhases();
    for (const o of mine) {
      if (o.fase_pipeline in phases) phases[o.fase_pipeline] += 1;
    }
    const cWon = phases['Chiuso'] || 0;
    const cLost = phases['K.O.'] || 0;
    const decided = cWon + cLost;
    return {
      commerciale: c,
      total: mine.length,
      open: mine.length - cWon - cLost,
      won: cWon,
      lost: cLost,
      worked: mine.filter(inMonth).length,
      winRate: decided ? Math.round((cWon / decided) * 100) : null,
    };
  });

  // Top categories by volume.
  const catCounts = {};
  for (const o of rows) {
    const k = o.categoria || 'Senza categoria';
    catCounts[k] = (catCounts[k] || 0) + 1;
  }
  const topCategories = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const stats = {
    monthLabel: win.label,
    total,
    pool,
    assigned,
    open,
    won,
    lost,
    updatedThisMonth,
    byPhase,
    perCommercial,
    topCategories,
  };

  const html = buildMonthlyReportEmail(stats);
  const to = config.report.to;
  const subject = `Report mensile Cafezal CRM — ${win.label}`;

  try {
    await sendMail({ to, subject, html });
    return { ok: true, to, month: win.label, total, sent: true, stats };
  } catch (err) {
    return { ok: false, to, month: win.label, sent: false, error: err.message };
  }
}
