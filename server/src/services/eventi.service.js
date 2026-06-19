import { db } from '../config/supabase.js';

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Eventi è una sezione commerciale: store e torrefazione non la vedono.
function assertAccess(user) {
  if (user.store || (user.isTorrefazione && !user.isAdmin)) throw httpError('Non autorizzato', 403);
}

const FIELDS = [
  'richiesta', 'contatti', 'tipologia_fiera', 'status', 'prossima_fiera_data', 'commerciale_assegnato',
  'citta', 'note', 'attivo',
  'data_evento', 'data_allestimento', 'data_smontaggio', 'orari_evento', 'pause', 'pause_quando',
  'permessi_status', 'acqua_fornita', 'energia_comunicata', 'spazio_comunicato', 'scia_comunicata',
  'latte', 'avena', 'persone_previste', 'catering', 'catering_note', 'baristi',
  'referente_nome', 'referente_numero', 'referente_mail', 'note_organizzazione',
];

export async function listEventi(user) {
  assertAccess(user);
  const { data, error } = await db
    .from('eventi')
    .select('*')
    .order('data_evento', { ascending: true, nullsFirst: false })
    .order('id', { ascending: false });
  if (error) throw error;
  return data || [];
}

function sanitize(payload) {
  const row = {};
  for (const k of FIELDS) if (payload[k] !== undefined) row[k] = payload[k] === '' ? null : payload[k];
  return row;
}

export async function createEvento(user, payload) {
  assertAccess(user);
  const row = sanitize(payload);
  if (!row.richiesta && !row.tipologia_fiera && !row.contatti) {
    throw httpError('Indica almeno richiesta, tipologia o contatti', 400);
  }
  if (!row.status) row.status = 'contattato';
  if (row.attivo === undefined) row.attivo = true;
  row.created_by = user.commerciale || user.email;
  const { data, error } = await db.from('eventi').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateEvento(user, id, payload) {
  assertAccess(user);
  const row = sanitize(payload);
  if (Object.keys(row).length === 0) return null;
  row.updated_at = new Date().toISOString();
  const { data, error } = await db.from('eventi').update(row).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteEvento(user, id) {
  assertAccess(user);
  const { error } = await db.from('eventi').delete().eq('id', id);
  if (error) throw error;
  return { ok: true };
}
