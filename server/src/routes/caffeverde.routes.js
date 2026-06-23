import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as ctrl from '../controllers/caffeverde.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

// Analisi DiFluid
router.post('/:id/difluid', ctrl.addDifluid);
router.delete('/difluid/:did', ctrl.removeDifluid);

// Analisi cupping (SCA)
router.post('/:id/cupping', ctrl.addCupping);
router.delete('/cupping/:cid', ctrl.removeCupping);

export default router;
