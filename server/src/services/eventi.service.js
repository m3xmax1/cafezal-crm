import { db } from '../config/supabase.js';
import { ACTIVITY_TIPI } from '../lib/constants.js';

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Scrittura: solo admin o un commerciale mappato (default-deny).
function assertAccess(user) {
  if (!user.isAdmin && !user.commerciale) throw httpError('Non autorizzato', 403);
}
// Lettura: anche la finance (vede gli eventi da fatturare).
function assertRead(user) {
  if (!user.isAdmin && !user.commerciale && !user.isFinance) throw httpError('Non autorizzato', 403);
}

const FIELDS = [
  'richiesta', 'contatti', 'tipologia_fiera', 'status', 'prossima_fiera_data', 'commerciale_assegnato',
  'citta', 'note', 'motivo_ko', 'attivo', 'prossima_azione', 'data_prossimo_followup',
  'data_evento', 'data_allestimento', 'data_smontaggio', 'orari_evento', 'pause', 'pause_quando',
  'permessi_status', 'acqua_fornita', 'energia_comunicata', 'spazio_comunicato', 'scia_comunicata',
  'latte', 'avena', 'persone_previste', 'catering', 'catering_note', 'baristi',
  'referente_nome', 'referente_numero', 'referente_mail', 'note_organizzazione',
  // Dati di fatturazione evento + voci + prezzo finale + range data + flag fatturato
  'ragione_sociale', 'alias', 'piva_cf', 'indirizzo_sede_legale', 'email', 'telefono',
  'voci_fatturazione', 'prezzo_evento', 'data_evento_fine', 'fatturato', 'numero_fattura',
];

export async function listEventi(user) {
  assertRead(user);
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
  const isStaff = user.isAdmin || user.commerciale;
  if (!isStaff && !user.isFinance) throw httpError('Non autorizzato', 403);
  // Finance può segnare l'evento come fatturato + numero fattura; staff fa il resto.
  let row;
  if (isStaff) {
    row = sanitize(payload);
  } else {
    row = {};
    if (payload.fatturato !== undefined) row.fatturato = !!payload.fatturato;
    if (payload.numero_fattura !== undefined) row.numero_fattura = payload.numero_fattura || null;
  }
  if (row.fatturato !== undefined) row.fatturato_at = row.fatturato ? new Date().toISOString() : null;
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

// ── Azioni fatte (timeline dell'evento) ──
export async function listAttivita(user, eventoId) {
  assertAccess(user);
  const { data, error } = await db
    .from('eventi_attivita')
    .select('*')
    .eq('evento_id', eventoId)
    .order('data', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addAttivita(user, eventoId, payload) {
  assertAccess(user);
  const row = {
    evento_id: Number(eventoId),
    tipo: ACTIVITY_TIPI.includes(payload.tipo) ? payload.tipo : 'nota',
    data: payload.data || null,
    descrizione: payload.descrizione ? String(payload.descrizione) : null,
    commerciale: user.commerciale || user.email,
  };
  const { data, error } = await db.from('eventi_attivita').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteAttivita(user, id) {
  assertAccess(user);
  const { error } = await db.from('eventi_attivita').delete().eq('id', id);
  if (error) throw error;
  return { ok: true };
}
