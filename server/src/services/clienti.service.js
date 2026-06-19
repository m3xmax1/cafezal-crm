import { db } from '../config/supabase.js';
import { COMMERCIALI, COMMERCIALE_TO_EMAIL } from '../lib/constants.js';
import { buildClientiMensileEmail } from '../lib/clientiEmailTemplate.js';
import { sendMail } from '../lib/mailer.js';

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Clienti attivi are a sales/admin concern — stores and the roastery don't see them.
function assertAccess(user) {
  if (user.store || (user.isTorrefazione && !user.isAdmin)) throw httpError('Non autorizzato', 403);
}

const norm = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');

/** List active clients, each enriched with order stats (matched by name/opportunity). */
export async function listClienti(user) {
  assertAccess(user);
  const { data: clienti, error } = await db
    .from('clienti_attivi')
    .select('*')
    .order('scadenza_contratto', { ascending: true, nullsFirst: false });
  if (error) throw error;

  // Match against ALL orders (not just b2b): by linked opportunity, or by name.
  const { data: ordini } = await db
    .from('ordini')
    .select('cliente_nome, opportunity_id, peso_totale_kg, totale, data_ordine')
    .limit(5000);

  const now = Date.now();
  const D90 = 90 * 86400000;
  return (clienti || []).map((c) => {
    const keyCli = norm(c.cliente);
    const keyRag = norm(c.rag_sociale);
    const mine = (ordini || []).filter((o) => {
      if (c.opportunity_id && o.opportunity_id && o.opportunity_id === c.opportunity_id) return true;
      const on = norm(o.cliente_nome);
      if (!on) return false;
      if (keyRag && keyRag.length >= 4 && (on === keyRag || on.includes(keyRag))) return true;
      if (keyCli && keyCli.length >= 4 && (on === keyCli || on.includes(keyCli))) return true;
      return false;
    });
    let kgTot = 0;
    let kg90 = 0;
    let valore = 0;
    let ultimo = null;
    for (const o of mine) {
      const kg = Number(o.peso_totale_kg) || 0;
      kgTot += kg;
      valore += Number(o.totale) || 0;
      const t = o.data_ordine ? new Date(o.data_ordine).getTime() : null;
      if (t && now - t <= D90) kg90 += kg;
      if (t && (!ultimo || t > ultimo)) ultimo = t;
    }
    return {
      ...c,
      stats: {
        nOrdini: mine.length,
        kgTot: Math.round(kgTot * 100) / 100,
        kg90: Math.round(kg90 * 100) / 100,
        valore: Math.round(valore * 100) / 100,
        ultimoOrdine: ultimo ? new Date(ultimo).toISOString().slice(0, 10) : null,
      },
    };
  });
}

const EDITABLE = [
  'cliente', 'rag_sociale', 'piva', 'opportunity_id', 'account_manager', 'macchinari',
  'valore_attrezzatura', 'comodato', 'deposito', 'rata_noleggio', 'firma', 'durata_mesi',
  'scadenza_contratto', 'rinnovo', 'spese_trasporto', 'fornitura', 'prezzo_bloccato',
  'prezzo_caffe', 'ordine_minimo_kg', 'penale_ordine', 'assistenza_inclusa', 'numero_interventi',
  'costo_uscita', 'esclusiva', 'penale_esclusiva', 'pagamento', 'tags', 'note', 'attivo',
  'esito_contratto', 'feedback_chiusura',
];

export async function updateCliente(user, id, payload) {
  assertAccess(user);
  const row = {};
  for (const k of EDITABLE) if (payload[k] !== undefined) row[k] = payload[k] === '' ? null : payload[k];
  if (Object.keys(row).length === 0) return null;
  row.updated_at = new Date().toISOString();
  const { data, error } = await db.from('clienti_attivi').update(row).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function createCliente(user, payload) {
  assertAccess(user);
  const row = {};
  for (const k of EDITABLE) if (payload[k] !== undefined && payload[k] !== '') row[k] = payload[k];
  if (!row.cliente && !row.rag_sociale) throw httpError('Nome cliente obbligatorio', 400);
  if (row.attivo === undefined) row.attivo = true;
  const { data, error } = await db.from('clienti_attivi').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCliente(user, id) {
  assertAccess(user);
  const { error } = await db.from('clienti_attivi').delete().eq('id', id);
  if (error) throw error;
  return { ok: true };
}

/** kg ordinati negli ultimi 90 giorni per un cliente (match per opportunity o nome). */
function kg90For(c, ordini, now) {
  const D90 = 90 * 86400000;
  const keyCli = norm(c.cliente);
  const keyRag = norm(c.rag_sociale);
  let kg90 = 0;
  for (const o of ordini) {
    let mine = false;
    if (c.opportunity_id && o.opportunity_id && o.opportunity_id === c.opportunity_id) mine = true;
    else {
      const on = norm(o.cliente_nome);
      if (on && ((keyRag && keyRag.length >= 4 && (on === keyRag || on.includes(keyRag))) || (keyCli && keyCli.length >= 4 && (on === keyCli || on.includes(keyCli))))) mine = true;
    }
    if (!mine) continue;
    const t = o.data_ordine ? new Date(o.data_ordine).getTime() : null;
    if (t && now - t <= D90) kg90 += Number(o.peso_totale_kg) || 0;
  }
  return kg90;
}

/**
 * Reminder mensile: per ogni account manager (commerciale), i clienti attivi
 * sotto l'80% del minimo contrattuale negli ultimi 90 giorni. I clienti gestiti
 * dalla "Torrefazione" non generano email.
 */
export async function runMonthlyClientReminders(options = {}) {
  const overrideTo = options.overrideTo || null;
  const today = new Date().toISOString().slice(0, 10);
  const { data: clienti } = await db.from('clienti_attivi').select('*').eq('attivo', true);
  const { data: ordini } = await db.from('ordini').select('cliente_nome, opportunity_id, peso_totale_kg, data_ordine').limit(5000);
  const now = Date.now();

  const results = [];
  for (const comm of COMMERCIALI) {
    const to = overrideTo || COMMERCIALE_TO_EMAIL[comm];
    if (!to) continue;
    const mine = (clienti || []).filter((c) => c.account_manager === comm && Number(c.ordine_minimo_kg) > 0);
    const sotto = [];
    for (const c of mine) {
      const kg90 = kg90For(c, ordini || [], now);
      if (kg90 / 3 < Number(c.ordine_minimo_kg) * 0.8) sotto.push({ ...c, kg90 });
    }
    if (!sotto.length) {
      results.push({ commerciale: comm, sent: false, reason: 'tutti in linea' });
      continue;
    }
    const html = buildClientiMensileEmail({ commerciale: comm, today, sotto });
    const subject = overrideTo ? `[TEST] Clienti sotto minimo (${comm}) - Cafezal` : 'Clienti sotto il minimo - Cafezal CRM';
    try {
      await sendMail({ to, subject, html });
      results.push({ commerciale: comm, to, sent: true, sotto: sotto.length });
    } catch (err) {
      results.push({ commerciale: comm, to, sent: false, error: err.message });
    }
    if (overrideTo) break; // in test invia un solo campione
  }
  return { job: 'clienti-mensile', today, test: Boolean(overrideTo), results };
}
