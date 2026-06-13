import { db } from '../config/supabase.js';
import { ACTIVITY_TIPI } from '../lib/constants.js';
import { getOpportunity } from './opportunities.service.js';

const ACT_TABLE = 'activities';

function httpError(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/** Activities for a lead the user is allowed to see (own / pool / admin). */
export async function listActivities(user, opportunityId) {
  const opp = await getOpportunity(user, opportunityId); // throws 403 if not allowed
  if (!opp) throw httpError('Not found', 404);

  const { data, error } = await db
    .from(ACT_TABLE)
    .select('*')
    .eq('opportunity_id', opportunityId)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function addActivity(user, opportunityId, payload = {}) {
  const opp = await getOpportunity(user, opportunityId);
  if (!opp) throw httpError('Not found', 404);

  const row = {
    opportunity_id: opportunityId,
    commerciale: user.commerciale || user.email || null,
    tipo: ACTIVITY_TIPI.includes(payload.tipo) ? payload.tipo : 'nota',
    descrizione: payload.descrizione ? String(payload.descrizione) : null,
  };
  if (payload.data) row.data = payload.data; // else DB default = current_date

  const { data, error } = await db.from(ACT_TABLE).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deleteActivity(user, opportunityId, activityId) {
  const opp = await getOpportunity(user, opportunityId);
  if (!opp) throw httpError('Not found', 404);

  const { error } = await db
    .from(ACT_TABLE)
    .delete()
    .eq('id', activityId)
    .eq('opportunity_id', opportunityId);
  if (error) throw error;
  return true;
}
