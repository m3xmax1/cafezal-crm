import { db } from '../config/supabase.js';
import { COMMERCIALI, FASI, SENSIBILITY, CATEGORIE, CLOSED_FASI } from '../lib/constants.js';
import { parseCsv, norm } from '../lib/csv.js';

const TABLE = 'opportunities';

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/** Restrict a select query to what the user is allowed to see. */
function applyScope(query, user) {
  if (user.isAdmin) return query;
  // A commercial sees their own rows + the shared pool (unassigned leads),
  // so they can pick leads from the pool and claim them for themselves.
  return query.or(`commerciale_assegnato.eq.${user.commerciale},commerciale_assegnato.is.null`);
}

// Supabase/PostgREST returns at most ~1000 rows per request. To load the full
// dataset (~1900+ leads) we page through it in chunks and concatenate, so the
// board, search and the "Totale" stat reflect every lead — not just the first 1000.
const PAGE_SIZE = 1000;
const MAX_PAGES = 25; // safety cap (25k rows)

async function fetchAllRows(buildQuery) {
  const all = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break; // last page reached
  }
  return all;
}

export async function listOpportunities(user, filters = {}) {
  // Not admin and not a known commercial → no visibility.
  if (!user.isAdmin && !user.commerciale) return [];

  // A fresh query must be built per page (a query builder can be awaited only
  // once). A stable *total* order — note the `id` tiebreaker — is required so
  // pagination never skips or duplicates rows when many share a timestamp.
  const buildQuery = () => {
    let query = db
      .from(TABLE)
      .select('*')
      .order('data_ultima_modifica', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true });

    query = applyScope(query, user);

    // The commerciale filter only matters for admins (commercials are already scoped).
    if (user.isAdmin && filters.commerciale && COMMERCIALI.includes(filters.commerciale)) {
      query = query.eq('commerciale_assegnato', filters.commerciale);
    }
    if (filters.fase && FASI.includes(filters.fase)) {
      query = query.eq('fase_pipeline', filters.fase);
    }
    if (filters.sensibility && SENSIBILITY.includes(filters.sensibility)) {
      query = query.eq('sensibility', filters.sensibility);
    }
    if (filters.categoria && CATEGORIE.includes(filters.categoria)) {
      query = query.eq('categoria', filters.categoria);
    }
    return query;
  };

  return fetchAllRows(buildQuery);
}

/**
 * Agenda: scheduled follow-ups (from leads' data_prossimo_followup) + logged/
 * planned activities, scoped to what the user can see, within an optional range.
 */
export async function getAgenda(user, { from, to } = {}) {
  if (!user.isAdmin && !user.commerciale) return { followups: [], activities: [] };

  // Follow-ups taken from the leads themselves (exclude finalized phases).
  let fq = db
    .from(TABLE)
    .select(
      'id, azienda, categoria, fase_pipeline, commerciale_assegnato, prossima_azione, data_prossimo_followup',
    )
    .not('data_prossimo_followup', 'is', null)
    .order('data_prossimo_followup', { ascending: true });
  fq = applyScope(fq, user);
  if (from) fq = fq.gte('data_prossimo_followup', from);
  if (to) fq = fq.lte('data_prossimo_followup', to);
  const { data: fData, error: fErr } = await fq;
  if (fErr) throw fErr;
  // Include won ("Chiuso") clients that have a scheduled follow-up (e.g. post-sale
  // / reorder check-in); only lost ("K.O.") leads are excluded from the agenda.
  const followups = (fData || []).filter((o) => o.fase_pipeline !== 'K.O.');

  // Activities (history + planned appointments), with their parent lead embedded.
  let aq = db
    .from('activities')
    .select(
      'id, opportunity_id, commerciale, tipo, descrizione, data, opportunities(azienda, commerciale_assegnato, fase_pipeline, categoria)',
    )
    .order('data', { ascending: true });
  if (from) aq = aq.gte('data', from);
  if (to) aq = aq.lte('data', to);
  const { data: aData, error: aErr } = await aq;
  if (aErr) throw aErr;
  const activities = (aData || [])
    .filter((a) => {
      const opp = a.opportunities || {};
      if (user.isAdmin) return true;
      return opp.commerciale_assegnato === user.commerciale || opp.commerciale_assegnato == null;
    })
    .map((a) => ({
      id: a.id,
      opportunity_id: a.opportunity_id,
      azienda: a.opportunities?.azienda || '',
      categoria: a.opportunities?.categoria || null,
      tipo: a.tipo,
      descrizione: a.descrizione,
      data: a.data,
    }));

  return { followups, activities };
}

export async function getOpportunity(user, id) {
  const { data, error } = await db.from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // Non-admins may access their own rows and unassigned (shared-pool) ones,
  // but never rows already owned by another commercial.
  if (!user.isAdmin && data.commerciale_assegnato && data.commerciale_assegnato !== user.commerciale) {
    throw httpError('Forbidden', 403);
  }
  return data;
}

/**
 * Find an existing lead with the same company name (case/accent-insensitive).
 * Returns the matching row (id, azienda, commerciale_assegnato) or null.
 */
export async function findDuplicate(azienda, excludeId = null) {
  const a = (azienda || '').toString().trim();
  if (!a) return null;
  const esc = a.replace(/[%_\\]/g, (m) => `\\${m}`); // exact, case-insensitive
  const { data, error } = await db
    .from(TABLE)
    .select('id, azienda, commerciale_assegnato')
    .ilike('azienda', esc)
    .limit(50);
  if (error) throw error;
  const key = norm(a);
  return (data || []).find((d) => d.id !== excludeId && norm(d.azienda) === key) || null;
}

export async function createOpportunity(user, payload) {
  const row = sanitize(payload, { partial: false });

  // Duplicate guard: block a new lead whose company already exists, telling the
  // user who manages it (or that it is sitting in the shared pool).
  const dup = await findDuplicate(row.azienda);
  if (dup) {
    const who = dup.commerciale_assegnato
      ? `è già gestito da ${dup.commerciale_assegnato}`
      : 'è già presente nel pool (non assegnato)';
    throw httpError(`Esiste già un lead "${dup.azienda}": ${who}.`, 409);
  }

  // A non-admin commercial can only create opportunities assigned to themselves.
  if (!user.isAdmin && user.commerciale) {
    row.commerciale_assegnato = user.commerciale;
  } else if (!row.commerciale_assegnato && user.commerciale) {
    // Admin without an explicit assignment defaults to their own name (if any).
    row.commerciale_assegnato = user.commerciale;
  }
  const { data, error } = await db.from(TABLE).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateOpportunity(user, id, payload) {
  // Authorize first: throws 403 if not allowed, returns null if missing.
  const existing = await getOpportunity(user, id);
  if (!existing) return null;

  const row = sanitize(payload, { partial: true });
  // A non-admin commercial cannot reassign an opportunity to someone else.
  if (!user.isAdmin && 'commerciale_assegnato' in row) {
    row.commerciale_assegnato = user.commerciale;
  }
  if (Object.keys(row).length === 0) return existing; // nothing to change

  const { data, error } = await db.from(TABLE).update(row).eq('id', id).select().single();
  if (error) throw error;

  // Record phase transitions for funnel/velocity analytics (best-effort: never
  // block the update if the history table is missing or the insert fails).
  if (row.fase_pipeline && row.fase_pipeline !== existing.fase_pipeline) {
    try {
      await db.from('phase_changes').insert({
        opportunity_id: id,
        da_fase: existing.fase_pipeline,
        a_fase: row.fase_pipeline,
        commerciale: user.commerciale || user.email || null,
      });
    } catch {
      /* analytics logging is non-critical */
    }
  }

  return data;
}

export async function deleteOpportunity(user, id) {
  const existing = await getOpportunity(user, id);
  if (!existing) return false;
  // A commercial may delete only opportunities they own — never shared-pool ones.
  if (!user.isAdmin && existing.commerciale_assegnato !== user.commerciale) {
    throw httpError('Forbidden', 403);
  }
  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) throw error;
  return true;
}

/** Validate + coerce an incoming payload into a DB row. */
function sanitize(payload = {}, { partial }) {
  const out = {};

  if (!partial || payload.azienda !== undefined) {
    const azienda = (payload.azienda ?? '').toString().trim();
    if (!partial && !azienda) throw httpError('Il campo "azienda" è obbligatorio', 400);
    if (payload.azienda !== undefined) out.azienda = azienda;
  }

  if (payload.commerciale_assegnato !== undefined) {
    const v = payload.commerciale_assegnato;
    if (v !== null && v !== '' && !COMMERCIALI.includes(v)) {
      throw httpError('commerciale_assegnato non valido', 400);
    }
    out.commerciale_assegnato = v === '' ? null : v;
  }

  if (payload.fase_pipeline !== undefined) {
    if (!FASI.includes(payload.fase_pipeline)) throw httpError('fase_pipeline non valida', 400);
    out.fase_pipeline = payload.fase_pipeline;
  }

  if (payload.macchina !== undefined) out.macchina = Boolean(payload.macchina);

  if (payload.quantita_minima_kg !== undefined) {
    const q = payload.quantita_minima_kg;
    if (q === null || q === '') {
      out.quantita_minima_kg = null;
    } else {
      const n = Number(q);
      if (Number.isNaN(n)) throw httpError('quantita_minima_kg deve essere un numero', 400);
      out.quantita_minima_kg = n;
    }
  }

  if (payload.sensibility !== undefined) {
    if (!SENSIBILITY.includes(payload.sensibility)) throw httpError('sensibility non valida', 400);
    out.sensibility = payload.sensibility;
  }

  if (payload.note !== undefined) {
    out.note = payload.note === null || payload.note === '' ? null : String(payload.note);
  }

  if (payload.data_scadenza !== undefined) {
    out.data_scadenza = payload.data_scadenza ? payload.data_scadenza : null;
  }

  if (payload.categoria !== undefined) {
    const v = payload.categoria;
    if (v !== null && v !== '' && !CATEGORIE.includes(v)) {
      throw httpError('categoria non valida', 400);
    }
    out.categoria = v === '' ? null : v;
  }

  // Free-text client fields (pipeline guidata). Empty string → null.
  for (const f of ['referente', 'ruolo_referente', 'telefono', 'email', 'sito_web', 'citta', 'prossima_azione']) {
    if (payload[f] !== undefined) {
      const v = payload[f];
      out[f] = v === null || v === '' ? null : String(v);
    }
  }

  if (payload.data_prossimo_followup !== undefined) {
    out.data_prossimo_followup = payload.data_prossimo_followup ? payload.data_prossimo_followup : null;
  }

  if (payload.valore_stimato !== undefined) {
    const v = payload.valore_stimato;
    if (v === null || v === '') {
      out.valore_stimato = null;
    } else {
      const n = Number(v);
      if (Number.isNaN(n)) throw httpError('valore_stimato deve essere un numero', 400);
      out.valore_stimato = n;
    }
  }

  if (payload.motivo_chiusura !== undefined) {
    out.motivo_chiusura =
      payload.motivo_chiusura === null || payload.motivo_chiusura === '' ? null : String(payload.motivo_chiusura);
  }

  return out;
}

// ─── CSV import (admin self-service) ──────────────────────────────────────────

// Accepted CSV header names (normalized, case/accent/punctuation-insensitive).
const FIELD_ALIASES = {
  azienda: ['azienda', 'aziende', 'company', 'nome', 'ragionesociale', 'cliente', 'name', 'account'],
  categoria: ['categoria', 'category', 'tipo', 'segmento', 'tab'],
  commerciale_assegnato: ['commerciale', 'commercialeassegnato', 'assegnato', 'owner', 'venditore', 'sales', 'responsabile'],
  fase_pipeline: ['fase', 'fasepipeline', 'stato', 'status', 'stage', 'pipeline'],
  sensibility: ['sensibility', 'sensibilita', 'priorita', 'priority'],
  quantita_minima_kg: ['quantitaminimakg', 'kg', 'quantita', 'kgmin', 'quantitakg', 'kgminimi'],
  data_scadenza: ['datascadenza', 'scadenza', 'duedate', 'deadline'],
  note: ['note', 'notes', 'commento', 'commenti', 'descrizione'],
  macchina: ['macchina', 'machine', 'attrezzatura'],
};

/** Match a free-text value to a canonical enum value (case/accent-insensitive). */
function matchEnum(value, list) {
  const n = norm(value);
  if (!n) return null;
  return list.find((x) => norm(x) === n) || null;
}

function parseNum(v) {
  let s = String(v ?? '').trim();
  if (!s) return null;
  if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); // 1.234,5
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function parseDateISO(v) {
  const s = String(v ?? '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/); // dd/mm/yyyy
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

function parseBool(v) {
  return ['si', 'true', '1', 'x', 'vero', 'yes', 'y'].includes(norm(v));
}

/** Load all existing company names (paged) for duplicate detection. */
async function fetchAllAziende() {
  const all = [];
  for (let p = 0; p < 25; p++) {
    const from = p * 1000;
    const { data, error } = await db
      .from(TABLE)
      .select('azienda')
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
 * Import leads from raw CSV text (admin only).
 * Auto-maps headers, validates/coerces values, optionally skips duplicates
 * (by company name) and bulk-inserts in batches.
 */
export async function importOpportunities(user, csvText, options = {}) {
  if (!user.isAdmin) throw httpError('Solo gli amministratori possono importare lead', 403);

  const { rows } = parseCsv(csvText);
  if (!rows.length) throw httpError('Il CSV non contiene righe di dati.', 400);

  // Map each CSV header to a DB field.
  const headerKeys = Object.keys(rows[0]);
  const map = {};
  for (const hk of headerKeys) {
    const n = norm(hk);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.includes(n)) {
        map[hk] = field;
        break;
      }
    }
  }
  const hasAzienda = Object.values(map).includes('azienda');
  if (!hasAzienda) {
    throw httpError('Colonna "Azienda" non trovata. Il CSV deve contenere almeno una colonna Azienda.', 400);
  }

  const skipDuplicates = options.skipDuplicates !== false;
  let existing = new Set();
  if (skipDuplicates) {
    const existingRows = await fetchAllAziende();
    existing = new Set(existingRows.map((r) => norm(r.azienda)).filter(Boolean));
  }

  const toInsert = [];
  const seen = new Set();
  let skipped = 0;
  let invalid = 0;

  for (const raw of rows) {
    const o = {};
    for (const [hk, field] of Object.entries(map)) o[field] = raw[hk];

    const azienda = String(o.azienda ?? '').trim();
    if (!azienda) {
      invalid += 1;
      continue;
    }
    const key = norm(azienda);
    if (seen.has(key) || (skipDuplicates && existing.has(key))) {
      skipped += 1;
      continue;
    }
    seen.add(key);

    toInsert.push({
      azienda,
      categoria: matchEnum(o.categoria, CATEGORIE),
      commerciale_assegnato: matchEnum(o.commerciale_assegnato, COMMERCIALI),
      fase_pipeline: matchEnum(o.fase_pipeline, FASI) || 'Lead',
      sensibility: matchEnum(o.sensibility, SENSIBILITY) || 'mid',
      quantita_minima_kg: parseNum(o.quantita_minima_kg),
      data_scadenza: parseDateISO(o.data_scadenza),
      note: o.note ? String(o.note) : null,
      macchina: parseBool(o.macchina),
    });
  }

  let inserted = 0;
  const BATCH = 500;
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const chunk = toInsert.slice(i, i + BATCH);
    const { error } = await db.from(TABLE).insert(chunk);
    if (error) throw httpError(`Errore durante l'inserimento: ${error.message}`, 400);
    inserted += chunk.length;
  }

  return {
    total: rows.length,
    inserted,
    skipped,
    invalid,
    skipDuplicates,
    mappedColumns: map,
  };
}
