import * as service from '../services/opportunities.service.js';
import * as activities from '../services/activities.service.js';
import * as samples from '../services/samples.service.js';

export async function list(req, res, next) {
  try {
    const data = await service.listOpportunities(req.user, {
      commerciale: req.query.commerciale,
      categoria: req.query.categoria,
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

export async function importCsv(req, res, next) {
  try {
    const csv = req.body?.csv;
    if (typeof csv !== 'string' || !csv.trim()) {
      return res.status(400).json({ error: 'Campo "csv" mancante o vuoto.' });
    }
    const result = await service.importOpportunities(req.user, csv, {
      skipDuplicates: req.body?.skipDuplicates !== false,
    });
    return res.json(result);
  } catch (e) {
    return next(e);
  }
}

export async function agenda(req, res, next) {
  try {
    const data = await service.getAgenda(req.user, { from: req.query.from, to: req.query.to });
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function listActivities(req, res, next) {
  try {
    const data = await activities.listActivities(req.user, req.params.id);
    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function addActivity(req, res, next) {
  try {
    const data = await activities.addActivity(req.user, req.params.id, req.body || {});
    res.status(201).json(data);
  } catch (e) {
    next(e);
  }
}

export async function deleteActivity(req, res, next) {
  try {
    await activities.deleteActivity(req.user, req.params.id, req.params.actId);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

export async function listSamples(req, res, next) {
  try {
    res.json(await samples.listSamples(req.user, req.params.id));
  } catch (e) {
    next(e);
  }
}

export async function addSample(req, res, next) {
  try {
    res.status(201).json(await samples.addSample(req.user, req.params.id, req.body || {}));
  } catch (e) {
    next(e);
  }
}

export async function updateSample(req, res, next) {
  try {
    const data = await samples.updateSample(req.user, req.params.id, req.params.sampleId, req.body || {});
    if (!data) return res.status(404).json({ error: 'Not found' });
    return res.json(data);
  } catch (e) {
    return next(e);
  }
}

export async function deleteSample(req, res, next) {
  try {
    await samples.deleteSample(req.user, req.params.id, req.params.sampleId);
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

export async function samplesOverview(req, res, next) {
  try {
    res.json(await samples.getSamplesOverview(req.user));
  } catch (e) {
    next(e);
  }
}
