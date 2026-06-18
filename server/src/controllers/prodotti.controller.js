import * as service from '../services/prodotti.service.js';

export async function list(req, res, next) {
  try {
    res.json(await service.listProdotti(req.user));
  } catch (e) {
    next(e);
  }
}

export async function create(req, res, next) {
  try {
    res.status(201).json(await service.createProdotto(req.user, req.body || {}));
  } catch (e) {
    next(e);
  }
}

export async function update(req, res, next) {
  try {
    res.json(await service.updateProdotto(req.user, req.params.id, req.body || {}));
  } catch (e) {
    next(e);
  }
}

export async function remove(req, res, next) {
  try {
    await service.deleteProdotto(req.user, req.params.id);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

export async function addFormato(req, res, next) {
  try {
    res.status(201).json(await service.addFormato(req.user, req.params.id, req.body || {}));
  } catch (e) {
    next(e);
  }
}

export async function updateFormato(req, res, next) {
  try {
    res.json(await service.updateFormato(req.user, req.params.fid, req.body || {}));
  } catch (e) {
    next(e);
  }
}

export async function deleteFormato(req, res, next) {
  try {
    await service.deleteFormato(req.user, req.params.fid);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}
