import { db } from '../config/supabase.js';

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

async function negozioByName(nome) {
  const { data } = await db.from('negozi').select('id, nome').eq('nome', nome).maybeSingle();
  return data;
}

/** Orders scoped: a store sees its own; torrefazione/admin see all. */
export async function listOrdini(user, filters = {}) {
  let q = db
    .from('ordini')
    .select('*, negozi(nome), ordini_righe(*)')
    .order('data_ordine', { ascending: false });

  if (user.store) {
    const neg = await negozioByName(user.store);
    q = q.eq('negozio_id', neg ? neg.id : -1);
  } else if (!user.isAdmin && !user.isTorrefazione) {
    // sales see only the b2b orders they originated (kept simple for now)
    if (!user.commerciale) return [];
    q = q.eq('origine', 'b2b').eq('created_by', user.commerciale);
  }
  if (filters.stato) q = q.eq('stato', filters.stato);
  const { data, error } = await q.limit(1000);
  if (error) throw error;
  return data;
}

/** Create an order (retail from a store, or b2b). Decrements stock; flags shortfalls. */
export async function createOrdine(user, payload) {
  // Default-deny: solo chi ha un ruolo (store, commerciale, torrefazione, admin)
  // può creare ordini. Blocca gli account senza ruolo (es. da signup pubblico),
  // che altrimenti scriverebbero ordini e scalerebbero il magazzino reale.
  if (!user.store && !user.commerciale && !user.isAdmin && !user.isTorrefazione) {
    throw httpError('Non autorizzato', 403);
  }
  const righe = Array.isArray(payload.righe) ? payload.righe : [];
  if (!righe.length) throw httpError('Ordine vuoto', 400);

  let negozio_id = null;
  let cliente_nome = payload.cliente_nome || null;
  if (user.store) {
    const neg = await negozioByName(user.store);
    if (!neg) throw httpError('Negozio non trovato', 400);
    negozio_id = neg.id;
    cliente_nome = user.store;
  } else if (payload.negozio_id) {
    negozio_id = payload.negozio_id;
    const { data: n } = await db.from('negozi').select('nome').eq('id', negozio_id).maybeSingle();
    cliente_nome = n?.nome || cliente_nome;
  }

  const prodIds = [...new Set(righe.map((r) => r.prodotto_id).filter(Boolean))];
  const { data: prods } = await db
    .from('prodotti')
    .select('id, nome, giacenza_kg, prodotti_formati(*)')
    .in('id', prodIds.length ? prodIds : [-1]);
  const prodMap = Object.fromEntries((prods || []).map((p) => [p.id, p]));

  const lineRows = [];
  let totale = 0;
  let pesoTot = 0;
  const needKg = {};
  for (const r of righe) {
    const p = prodMap[r.prodotto_id];
    if (!p) continue;
    const formati = p.prodotti_formati || [];
    const fmt = formati.find((f) => f.id === r.formato_id) || formati.find((f) => f.formato === r.formato);
    const q = Number(r.quantita) || 0;
    if (q <= 0) continue;
    const peso = fmt ? Number(fmt.peso_kg) || 0 : 0;
    // Selling price: per-line override (commercial) wins over the catalog price.
    const hasOverride = r.prezzo !== undefined && r.prezzo !== null && r.prezzo !== '';
    const prezzo = hasOverride ? Number(r.prezzo) : fmt ? fmt.prezzo : null;
    const kgTot = q * peso;
    needKg[p.id] = (needKg[p.id] || 0) + kgTot;
    const tot = prezzo != null ? q * prezzo : null;
    if (tot) totale += tot;
    pesoTot += kgTot;
    lineRows.push({
      prodotto_id: p.id,
      nome_caffe: `${p.nome}${fmt ? ` (${fmt.formato})` : ''}`,
      formato: fmt ? fmt.formato : r.formato || null,
      quantita: q,
      prezzo_unitario: prezzo,
      peso_kg: peso,
      totale: tot,
    });
  }
  if (!lineRows.length) throw httpError('Nessuna riga valida nell\'ordine', 400);

  const shortfalls = [];
  for (const pid of Object.keys(needKg)) {
    const p = prodMap[pid];
    const avail = Number(p.giacenza_kg) || 0;
    if (needKg[pid] > avail) {
      shortfalls.push({ prodotto: p.nome, richiesto_kg: r2(needKg[pid]), disponibile_kg: r2(avail) });
    }
  }

  const { data: ord, error: oerr } = await db
    .from('ordini')
    .insert({
      origine: user.store ? 'retail' : payload.origine || 'b2b',
      negozio_id,
      opportunity_id: payload.opportunity_id || null,
      cliente_nome,
      persona: payload.persona || null,
      email: payload.email || null,
      telefono: payload.telefono || null,
      indirizzo_consegna: payload.indirizzo_consegna || null,
      data_consegna: payload.data_consegna || null,
      stato: 'ricevuto',
      note: shortfalls.length
        ? `⚠ Scorta insufficiente: ${shortfalls.map((s) => `${s.prodotto} (${s.disponibile_kg}/${s.richiesto_kg}kg)`).join('; ')}${payload.note ? ' — ' + payload.note : ''}`
        : payload.note || null,
      totale: r2(totale),
      peso_totale_kg: r2(pesoTot),
      created_by: user.commerciale || user.store || user.email,
    })
    .select()
    .single();
  if (oerr) throw oerr;

  await db.from('ordini_righe').insert(lineRows.map((l) => ({ ...l, ordine_id: ord.id })));

  // Decrement warehouse (best-effort, per product).
  for (const pid of Object.keys(needKg)) {
    const p = prodMap[pid];
    await db
      .from('prodotti')
      .update({ giacenza_kg: r2((Number(p.giacenza_kg) || 0) - needKg[pid]), updated_at: new Date().toISOString() })
      .eq('id', pid);
  }

  return { ordine: ord, shortfalls };
}

/** Torrefazione/admin updates status, DDT, tracking, notes. */
export async function updateOrdine(user, id, payload) {
  if (!user.isAdmin && !user.isTorrefazione) throw httpError('Non autorizzato', 403);
  const row = {};
  for (const k of ['stato', 'ddt', 'tracking', 'note', 'data_consegna']) {
    if (payload[k] !== undefined) row[k] = payload[k] || null;
  }
  if (Object.keys(row).length === 0) return null;
  const { data, error } = await db.from('ordini').update(row).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
