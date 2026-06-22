import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as ctrl from '../controllers/ordini.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.post('/:id/correct', ctrl.correct); // store corregge e re-invia un ordine in "problema"

export default router;
