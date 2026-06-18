import { db } from '../config/supabase.js';

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Who can manage the catalog/warehouse, and who can see prices.
const canManage = (u) => u.isAdmin || u.isTorrefazione;
const canSeePrices = (u) => u.isAdmin || u.isTorrefazione || !!u.commerciale;
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

/** Catalog with formats. Stores get the list WITHOUT prices. */
export async function listProdotti(user) {
  const { data, error } = await db
    .from('prodotti')
    .select('*, prodotti_formati(*)')
    .order('categoria', { ascending: true })
    .order('nome', { ascending: true });
  if (error) throw error;
  const prices = canSeePrices(user);
  return (data || []).map((p) => ({
    ...p,
    prodotti_formati: (p.prodotti_formati || [])
      .sort((a, b) => a.id - b.id)
      .map((f) => (prices ? f : { ...f, prezzo: null })),
  }));
}

function sanitizeProdotto(p, { partial }) {
  const out = {};
  if (!partial || p.nome !== undefined) {
    const n = (p.nome ?? '').toString().trim();
    if (!partial && !n) throw httpError('Il nome del prodotto è obbligatorio', 400);
    if (p.nome !== undefined) out.nome = n;
  }
  if (p.categoria !== undefined) out.categoria = p.categoria ? String(p.categoria) : null;
  if (p.giacenza_kg !== undefined) {
    const v = Number(p.giacenza_kg);
    if (Number.isNaN(v)) throw httpError('Giacenza non valida', 400);
    out.giacenza_kg = v;
  }
  if (p.attivo !== undefined) out.attivo = Boolean(p.attivo);
  if (p.descrizione !== undefined) out.descrizione = p.descrizione ? String(p.descrizione) : null;
  if (p.foto_url !== undefined) out.foto_url = p.foto_url ? String(p.foto_url) : null;
  return out;
}

export async function createProdotto(user, payload) {
  if (!canManage(user)) throw httpError('Non autorizzato', 403);
  const { data, error } = await db.from('prodotti').insert(sanitizeProdotto(payload, { partial: false })).select().single();
  if (error) throw error;
  return data;
}

export async function updateProdotto(user, id, payload) {
  if (!canManage(user)) throw httpError('Non autorizzato', 403);
  const row = sanitizeProdotto(payload, { partial: true });
  row.updated_at = new Date().toISOString();
  const { data, error } = await db.from('prodotti').update(row).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProdotto(user, id) {
  if (!canManage(user)) throw httpError('Non autorizzato', 403);
  const { error } = await db.from('prodotti').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function addFormato(user, prodottoId, payload) {
  if (!canManage(user)) throw httpError('Non autorizzato', 403);
  const row = {
    prodotto_id: prodottoId,
    formato: (payload.formato ?? '').toString().trim() || 'std',
    prezzo: num(payload.prezzo),
    peso_kg: num(payload.peso_kg) ?? 0,
  };
  const { data, error } = await db.from('prodotti_formati').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateFormato(user, id, payload) {
  if (!canManage(user)) throw httpError('Non autorizzato', 403);
  const row = {};
  if (payload.formato !== undefined) row.formato = String(payload.formato);
  if (payload.prezzo !== undefined) row.prezzo = num(payload.prezzo);
  if (payload.peso_kg !== undefined) row.peso_kg = num(payload.peso_kg) ?? 0;
  if (payload.attivo !== undefined) row.attivo = Boolean(payload.attivo);
  const { data, error } = await db.from('prodotti_formati').update(row).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteFormato(user, id) {
  if (!canManage(user)) throw httpError('Non autorizzato', 403);
  const { error } = await db.from('prodotti_formati').delete().eq('id', id);
  if (error) throw error;
  return true;
}
