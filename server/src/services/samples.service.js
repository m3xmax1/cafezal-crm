import { db } from '../config/supabase.js';
import { SAMPLE_ESITI } from '../lib/constants.js';
import { getOpportunity } from './opportunities.service.js';

const TABLE = 'samples';

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

const esito = (v) => (SAMPLE_ESITI.includes(v) ? v : 'in_attesa');
const txt = (v) => (v === null || v === undefined || v === '' ? null : String(v));

/** Samples for a lead the user can access. */
export async function listSamples(user, opportunityId) {
  const opp = await getOpportunity(user, opportunityId); // throws 403 if not allowed
  if (!opp) throw httpError('Not found', 404);
  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('opportunity_id', opportunityId)
    .order('data_invio', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addSample(user, opportunityId, payload = {}) {
  const opp = await getOpportunity(user, opportunityId);
  if (!opp) throw httpError('Not found', 404);
  const row = {
    opportunity_id: opportunityId,
    commerciale: user.commerciale || user.email || null,
    prodotto: txt(payload.prodotto),
    quantita: txt(payload.quantita),
    esito: esito(payload.esito),
    note: txt(payload.note),
  };
  if (payload.data_invio) row.data_invio = payload.data_invio;
  const { data, error } = await db.from(TABLE).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateSample(user, opportunityId, sampleId, payload = {}) {
  const opp = await getOpportunity(user, opportunityId);
  if (!opp) throw httpError('Not found', 404);
  const upd = {};
  if (payload.esito !== undefined) upd.esito = esito(payload.esito);
  if (payload.prodotto !== undefined) upd.prodotto = txt(payload.prodotto);
  if (payload.quantita !== undefined) upd.quantita = txt(payload.quantita);
  if (payload.note !== undefined) upd.note = txt(payload.note);
  if (payload.data_invio !== undefined) upd.data_invio = payload.data_invio || null;
  if (Object.keys(upd).length === 0) return null;
  const { data, error } = await db
    .from(TABLE)
    .update(upd)
    .eq('id', sampleId)
    .eq('opportunity_id', opportunityId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSample(user, opportunityId, sampleId) {
  const opp = await getOpportunity(user, opportunityId);
  if (!opp) throw httpError('Not found', 404);
  const { error } = await db.from(TABLE).delete().eq('id', sampleId).eq('opportunity_id', opportunityId);
  if (error) throw error;
  return true;
}

/** All samples the user can see (scoped) — for the conversion stats. */
export async function getSamplesOverview(user) {
  if (!user.isAdmin && !user.commerciale) return [];
  const { data, error } = await db
    .from(TABLE)
    .select('id, prodotto, esito, data_invio, commerciale, opportunities(azienda, commerciale_assegnato)')
    .order('data_invio', { ascending: false });
  if (error) throw error;
  return (data || [])
    .filter((s) => {
      if (user.isAdmin) return true;
      const o = s.opportunities || {};
      return o.commerciale_assegnato === user.commerciale || o.commerciale_assegnato == null;
    })
    .map((s) => ({
      id: s.id,
      prodotto: s.prodotto,
      esito: s.esito,
      data_invio: s.data_invio,
      azienda: s.opportunities?.azienda || '',
    }));
}
