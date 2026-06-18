import * as service from '../services/ordini.service.js';

export async function list(req, res, next) {
  try {
    res.json(await service.listOrdini(req.user, { stato: req.query.stato }));
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    res.status(201).json(await service.createOrdine(req.user, req.body || {}));
  } catch (e) {
    next(e);
  }
}

export async function update(req, res, next) {
  try {
    const data = await service.updateOrdine(req.user, req.params.id, req.body || {});
    if (!data) return res.status(404).json({ error: 'Not found' });
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}
