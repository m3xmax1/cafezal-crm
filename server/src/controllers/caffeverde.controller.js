import * as service from '../services/caffeverde.service.js';

export async function list(req, res, next) {
  try { res.json(await service.listCaffe(req.user)); } catch (e) { next(e); }
}
export async function create(req, res, next) {
  try { res.status(201).json(await service.createCaffe(req.user, req.body || {})); } catch (e) { next(e); }
}
export async function update(req, res, next) {
  try {
    const data = await service.updateCaffe(req.user, req.params.id, req.body || {});
    if (!data) return res.status(404).json({ error: 'Not found' });
    return res.json(data);
  } catch (e) { return next(e); }
}
export async function remove(req, res, next) {
  try { await service.deleteCaffe(req.user, req.params.id); res.status(204).end(); } catch (e) { next(e); }
}

export async function addDifluid(req, res, next) {
  try { res.status(201).json(await service.addDifluid(req.user, req.params.id, req.body || {})); } catch (e) { next(e); }
}
export async function updateDifluid(req, res, next) {
  try { res.json(await service.updateDifluid(req.user, req.params.did, req.body || {})); } catch (e) { next(e); }
}
export async function removeDifluid(req, res, next) {
  try { await service.deleteDifluid(req.user, req.params.did); res.status(204).end(); } catch (e) { next(e); }
}

export async function addCupping(req, res, next) {
  try { res.status(201).json(await service.addCupping(req.user, req.params.id, req.body || {})); } catch (e) { next(e); }
}
export async function updateCupping(req, res, next) {
  try { res.json(await service.updateCupping(req.user, req.params.cid, req.body || {})); } catch (e) { next(e); }
}
export async function removeCupping(req, res, next) {
  try { await service.deleteCupping(req.user, req.params.cid); res.status(204).end(); } catch (e) { next(e); }
}
