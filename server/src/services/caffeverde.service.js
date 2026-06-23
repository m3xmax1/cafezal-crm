import { db } from '../config/supabase.js';

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// Caffè verde è una sezione della torrefazione.
function assertAccess(user) {
  if (!user.isAdmin && !user.isTorrefazione) throw httpError('Non autorizzato', 403);
}

const CAFFE_FIELDS = ['nome', 'provenienza', 'tipologia', 'processo', 'costo', 'produttore', 'note', 'attivo'];
const DIFLUID_FIELDS = ['data', 'prossima_data', 'water_activity', 'moisture', 'true_density', 'mesh_size', 'note'];
const CUPPING_FIELDS = ['data', 'fragranza', 'flavor', 'aftertaste', 'acidity', 'body', 'balance', 'uniformity', 'clean_cup', 'sweetness', 'overall', 'difetti', 'punteggio', 'assaggiatore', 'note'];

const SELECT = '*, caffe_difluid(*), caffe_cupping(*)';

export async function listCaffe(user) {
  assertAccess(user);
  const { data, error } = await db.from('caffe_verde').select(SELECT).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createCaffe(user, payload) {
  assertAccess(user);
  const row = {};
  for (const k of CAFFE_FIELDS) if (payload[k] !== undefined) row[k] = payload[k] === '' ? null : payload[k];
  if (!row.nome) throw httpError('Il nome del caffè è obbligatorio', 400);
  if (row.attivo === undefined) row.attivo = true;
  row.created_by = user.commerciale || user.email;
  const { data, error } = await db.from('caffe_verde').insert(row).select(SELECT).single();
  if (error) throw error;
  return data;
}

export async function updateCaffe(user, id, payload) {
  assertAccess(user);
  const row = {};
  for (const k of CAFFE_FIELDS) if (payload[k] !== undefined) row[k] = payload[k] === '' ? null : payload[k];
  if (Object.keys(row).length === 0) return null;
  row.updated_at = new Date().toISOString();
  const { data, error } = await db.from('caffe_verde').update(row).eq('id', id).select(SELECT).single();
  if (error) throw error;
  return data;
}

export async function deleteCaffe(user, id) {
  assertAccess(user);
  const { error } = await db.from('caffe_verde').delete().eq('id', id);
  if (error) throw error;
  return { ok: true };
}

// ── Analisi DiFluid ──
export async function addDifluid(user, caffeId, payload) {
  assertAccess(user);
  const row = { caffe_id: Number(caffeId), created_by: user.commerciale || user.email };
  for (const k of DIFLUID_FIELDS) if (payload[k] !== undefined) row[k] = payload[k] === '' ? null : payload[k];
  const { data, error } = await db.from('caffe_difluid').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteDifluid(user, id) {
  assertAccess(user);
  const { error } = await db.from('caffe_difluid').delete().eq('id', id);
  if (error) throw error;
  return { ok: true };
}

// ── Analisi cupping (SCA) ──
export async function addCupping(user, caffeId, payload) {
  assertAccess(user);
  const row = { caffe_id: Number(caffeId), created_by: user.commerciale || user.email };
  for (const k of CUPPING_FIELDS) if (payload[k] !== undefined) row[k] = payload[k] === '' ? null : payload[k];
  const { data, error } = await db.from('caffe_cupping').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCupping(user, id) {
  assertAccess(user);
  const { error } = await db.from('caffe_cupping').delete().eq('id', id);
  if (error) throw error;
  return { ok: true };
}
