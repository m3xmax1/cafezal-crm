import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as ctrl from '../controllers/opportunities.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.post('/import', ctrl.importCsv); // admin-only bulk CSV import
router.get('/:id', ctrl.getOne);
router.patch('/:id', ctrl.update);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

// Activity timeline (nested under a lead)
router.get('/:id/activities', ctrl.listActivities);
router.post('/:id/activities', ctrl.addActivity);
router.delete('/:id/activities/:actId', ctrl.deleteActivity);

export default router;
