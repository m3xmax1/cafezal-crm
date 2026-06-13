import { db } from '../config/supabase.js';
import { COMMERCIALI, FASI, SENSIBILITY, CATEGORIE } from '../lib/constants.js';

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

export async function createOpportunity(user, payload) {
  const row = sanitize(payload, { partial: false });
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

  return out;
}
