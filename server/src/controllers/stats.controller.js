import * as service from '../services/stats.service.js';

export async function roastery(req, res, next) {
  try {
    res.json(await service.roasteryStats(req.user));
  } catch (e) {
    next(e);
  }
}
