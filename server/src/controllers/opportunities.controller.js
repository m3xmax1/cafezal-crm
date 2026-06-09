import * as service from '../services/opportunities.service.js';

export async function list(req, res, next) {
  try {
    const data = await service.listOpportunities(req.user, {
      commerciale: req.query.commerciale,
      fase: req.query.fase,
      sensibility: req.query.sensibility,
    });
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function getOne(req, res, next) {
  try {
    const data = await service.getOpportunity(req.user, req.params.id);
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    const data = await service.createOpportunity(req.user, req.body || {});
    res.status(201).json(data);
  } catch (e) {
    next(e);
  }
}

export async function update(req, res, next) {
  try {
    const data = await service.updateOpportunity(req.user, req.params.id, req.body || {});
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function remove(req, res, next) {
  try {
    const ok = await service.deleteOpportunity(req.user, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}
