import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as ctrl from '../controllers/opportunities.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getOne);
router.patch('/:id', ctrl.update);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

export default router;
