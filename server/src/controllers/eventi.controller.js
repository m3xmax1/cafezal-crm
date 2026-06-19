import * as service from '../services/eventi.service.js';

export async function list(req, res, next) {
  try {
    res.json(await service.listEventi(req.user));
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    res.status(201).json(await service.createEvento(req.user, req.body || {}));
  } catch (e) {
    next(e);
  }
}

export async function update(req, res, next) {
  try {
    res.json(await service.updateEvento(req.user, req.params.id, req.body || {}));
  } catch (e) {
    next(e);
  }
}

export async function remove(req, res, next) {
  try {
    res.json(await service.deleteEvento(req.user, req.params.id));
  } catch (e) {
    next(e);
  }
}
