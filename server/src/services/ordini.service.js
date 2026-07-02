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

/**
 * Build order line rows + per-product kg from a list of raw righe.
 * Matches the format by id (catalog picker) or by name (correction from an
 * existing order, where only the formato string is stored). Returns rounded
 * totals + shortfalls vs. current stock.
 */
async function buildLines(righe) {
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

  const shortfalls = [];
  for (const pid of Object.keys(needKg)) {
    const p = prodMap[pid];
    const avail = Number(p.giacenza_kg) || 0;
    if (needKg[pid] > avail) {
      shortfalls.push({ prodotto: p.nome, richiesto_kg: r2(needKg[pid]), disponibile_kg: r2(avail) });
    }
  }
  return { prodMap, lineRows, needKg, totale: r2(totale), pesoTot: r2(pesoTot), shortfalls };
}

/** Compose the order note from an optional shortfall warning + the user's note. */
function composeNote(shortfalls, userNote) {
  const base = userNote || null;
  if (!shortfalls.length) return base;
  const warn = `⚠ Scorta insufficiente: ${shortfalls.map((s) => `${s.prodotto} (${s.disponibile_kg}/${s.richiesto_kg}kg)`).join('; ')}`;
  return base ? `${warn} — ${base}` : warn;
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
  } else if (!user.isAdmin && !user.isTorrefazione && !user.isFinance) {
    // sales see only the b2b orders they originated (kept simple for now)
    if (!user.commerciale) return [];
    q = q.eq('origine', 'b2b').eq('created_by', user.commerciale);
  }
  // admin / torrefazione / finance: vedono tutti gli ordini.
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
  // Ordini B2B (commerciali): i dati di fatturazione sono obbligatori all'emissione.
  if (!user.store) {
    const req = {
      ragione_sociale: 'Ragione sociale', piva_cf: 'P.IVA/C.F.', pec: 'PEC', sdi: 'SDI',
      email: 'Email', telefono: 'Telefono', indirizzo_sede_legale: 'Indirizzo sede legale',
      indirizzo_consegna: 'Indirizzo spedizione',
    };
    const missing = Object.entries(req).filter(([k]) => !String(payload[k] || '').trim()).map(([, v]) => v);
    if (missing.length) throw httpError(`Dati di fatturazione mancanti: ${missing.join(', ')}`, 400);
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

  const { prodMap, lineRows, needKg, totale, pesoTot, shortfalls } = await buildLines(righe);
  if (!lineRows.length) throw httpError('Nessuna riga valida nell\'ordine', 400);

  // Costo di trasporto (solo B2B): prima consegna gratuita, poi il commerciale
  // lo indica se va addebitato. Entra nel totale dell'ordine.
  const costoTrasporto = !user.store && Number(payload.costo_trasporto) > 0 ? r2(payload.costo_trasporto) : null;

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
      note: composeNote(shortfalls, payload.note),
      costo_trasporto: costoTrasporto,
      totale: r2(totale + (costoTrasporto || 0)),
      peso_totale_kg: pesoTot,
      created_by: user.commerciale || user.store || user.email,
      // Snapshot fiscale per la fattura (congelato al momento dell'invio).
      ragione_sociale: payload.ragione_sociale || null,
      piva_cf: payload.piva_cf || null,
      pec: payload.pec || null,
      sdi: payload.sdi || null,
      indirizzo_sede_legale: payload.indirizzo_sede_legale || null,
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

/**
 * Torrefazione/admin: status, DDT, tracking, note, data consegna prevista, problema.
 * Finance: può SOLO segnare l'ordine come fatturato.
 */
export async function updateOrdine(user, id, payload) {
  const isStaff = user.isAdmin || user.isTorrefazione;
  if (!isStaff && !user.isFinance) throw httpError('Non autorizzato', 403);
  const allowed = isStaff
    ? ['stato', 'ddt', 'tracking', 'note', 'data_consegna', 'data_consegna_prevista', 'problema_nota', 'fatturato', 'numero_fattura']
    : ['fatturato', 'numero_fattura'];
  const row = {};
  for (const k of allowed) {
    if (payload[k] === undefined) continue;
    row[k] = typeof payload[k] === 'boolean' ? payload[k] : payload[k] || null;
  }
  if (row.fatturato !== undefined) row.fatturato_at = row.fatturato ? new Date().toISOString() : null;
  // Appena fatturato, un ordine "spedito" esce dalla pipeline → archiviato.
  if (row.fatturato === true && row.stato === undefined) {
    const { data: cur } = await db.from('ordini').select('stato').eq('id', id).maybeSingle();
    if (cur?.stato === 'spedito') row.stato = 'archiviato';
  }
  // Flagging a problem without a reason still works; clearing the problem state
  // (any non-problema status) wipes a stale problem note.
  if (row.stato && row.stato !== 'problema') row.problema_nota = null;
  if (Object.keys(row).length === 0) return null;
  const { data, error } = await db.from('ordini').update(row).eq('id', id).select('*, negozi(nome), ordini_righe(*)').single();
  if (error) throw error;
  return data;
}

/**
 * Spedizione automatica: il 1º ordine B2B del MESE per un cliente è gratuito;
 * dal 2º il commerciale riceve un alert e decide se addebitarla.
 * Match del cliente: opportunity_id → P.IVA → ragione sociale/nome (normalizzati),
 * sugli ordini del mese corrente di TUTTI i commerciali (service role).
 */
export async function spedizioneCheck(user, { opportunity_id, piva_cf, cliente } = {}) {
  if (!user.isAdmin && !user.commerciale) throw httpError('Non autorizzato', 403);
  const norm = (s) => (s || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
  const romeToday = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' });
  const monthStart = `${romeToday.slice(0, 7)}-01`;

  const { data, error } = await db
    .from('ordini')
    .select('id, opportunity_id, piva_cf, ragione_sociale, cliente_nome')
    .eq('origine', 'b2b')
    .gte('data_ordine', monthStart);
  if (error) throw error;

  const kP = norm(piva_cf);
  const kC = norm(cliente);
  const matched = (data || []).filter((o) => {
    if (opportunity_id && o.opportunity_id && String(o.opportunity_id) === String(opportunity_id)) return true;
    if (kP && norm(o.piva_cf) && kP === norm(o.piva_cf)) return true;
    const on = `${norm(o.ragione_sociale)}|${norm(o.cliente_nome)}`;
    if (kC && kC.length >= 4 && on.includes(kC)) return true;
    return false;
  });
  return { ordiniMese: matched.length, gratuita: matched.length === 0, mese: monthStart.slice(0, 7) };
}

/**
 * Elimina un ordine appena inviato: il locale può cancellare SOLO i propri
 * ordini ancora in "ricevuto" (non lavorati); l'admin può eliminare anche
 * oltre. Il magazzino viene ri-accreditato dei kg delle righe.
 */
export async function deleteOrdine(user, id) {
  const { data: existing, error: e0 } = await db
    .from('ordini')
    .select('*, ordini_righe(*)')
    .eq('id', id)
    .maybeSingle();
  if (e0) throw e0;
  if (!existing) throw httpError('Ordine non trovato', 404);

  if (user.store) {
    const neg = await negozioByName(user.store);
    if (!neg || existing.negozio_id !== neg.id) throw httpError('Non autorizzato', 403);
    if (existing.stato !== 'ricevuto') {
      throw httpError('Puoi eliminare solo ordini non ancora presi in carico (stato "Ricevuto")', 400);
    }
  } else if (!user.isAdmin) {
    throw httpError('Non autorizzato', 403);
  }

  // Ri-accredita il magazzino (l'invio lo aveva scalato).
  const backKg = {};
  for (const r of existing.ordini_righe || []) {
    backKg[r.prodotto_id] = (backKg[r.prodotto_id] || 0) + (Number(r.peso_kg) || 0) * (Number(r.quantita) || 0);
  }
  for (const pid of Object.keys(backKg)) {
    const { data: pcur } = await db.from('prodotti').select('giacenza_kg').eq('id', pid).maybeSingle();
    if (!pcur) continue;
    await db
      .from('prodotti')
      .update({ giacenza_kg: r2((Number(pcur.giacenza_kg) || 0) + backKg[pid]), updated_at: new Date().toISOString() })
      .eq('id', pid);
  }

  await db.from('ordini_righe').delete().eq('ordine_id', id);
  const { error } = await db.from('ordini').delete().eq('id', id);
  if (error) throw error;
  return { ok: true, id: existing.id };
}

/**
 * The owning store (or admin) corrects an order that the roastery flagged as
 * "problema" and resends it: lines are replaced, stock is re-balanced (credit
 * the old lines, debit the new), the order returns to "ricevuto" and the
 * problem note is cleared — so it never stays stuck in "problema".
 */
export async function correctOrdine(user, id, payload) {
  const { data: existing, error: e0 } = await db
    .from('ordini')
    .select('*, ordini_righe(*)')
    .eq('id', id)
    .maybeSingle();
  if (e0) throw e0;
  if (!existing) throw httpError('Ordine non trovato', 404);

  // Ownership: only the store that placed it (or an admin) can correct it.
  if (user.store) {
    const neg = await negozioByName(user.store);
    if (!neg || existing.negozio_id !== neg.id) throw httpError('Non autorizzato', 403);
  } else if (!user.isAdmin) {
    throw httpError('Non autorizzato', 403);
  }
  if (existing.stato !== 'problema') {
    throw httpError('Solo gli ordini segnalati con un problema possono essere corretti', 400);
  }

  const righe = Array.isArray(payload.righe) ? payload.righe : [];
  if (!righe.length) throw httpError('Ordine vuoto', 400);
  const { lineRows, needKg, totale, pesoTot, shortfalls } = await buildLines(righe);
  if (!lineRows.length) throw httpError('Nessuna riga valida nell\'ordine', 400);

  // kg of the OLD lines, to re-credit the warehouse before debiting the new ones.
  const oldNeedKg = {};
  for (const r of existing.ordini_righe || []) {
    oldNeedKg[r.prodotto_id] = (oldNeedKg[r.prodotto_id] || 0) + (Number(r.peso_kg) || 0) * (Number(r.quantita) || 0);
  }

  // Replace the order lines.
  await db.from('ordini_righe').delete().eq('ordine_id', id);
  await db.from('ordini_righe').insert(lineRows.map((l) => ({ ...l, ordine_id: id })));

  // Stock delta per product: + old (give back) − new (take again).
  const allPids = new Set([...Object.keys(oldNeedKg), ...Object.keys(needKg)]);
  for (const pid of allPids) {
    const { data: pcur } = await db.from('prodotti').select('giacenza_kg').eq('id', pid).maybeSingle();
    if (!pcur) continue;
    const delta = (oldNeedKg[pid] || 0) - (needKg[pid] || 0);
    await db
      .from('prodotti')
      .update({ giacenza_kg: r2((Number(pcur.giacenza_kg) || 0) + delta), updated_at: new Date().toISOString() })
      .eq('id', pid);
  }

  const userNote = payload.note !== undefined ? payload.note : existing.note;
  const { data: ord, error } = await db
    .from('ordini')
    .update({
      stato: 'ricevuto',
      problema_nota: null,
      note: composeNote(shortfalls, userNote),
      data_consegna: payload.data_consegna !== undefined ? payload.data_consegna || null : existing.data_consegna,
      totale: r2(totale + (Number(existing.costo_trasporto) || 0)),
      peso_totale_kg: pesoTot,
    })
    .eq('id', id)
    .select('*, negozi(nome), ordini_righe(*)')
    .single();
  if (error) throw error;
  return { ordine: ord, shortfalls };
}
