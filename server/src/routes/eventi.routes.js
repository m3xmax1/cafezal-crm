import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as ctrl from '../controllers/eventi.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

// Azioni fatte (timeline)
router.get('/:id/attivita', ctrl.listAttivita);
router.post('/:id/attivita', ctrl.addAttivita);
router.delete('/attivita/:aid', ctrl.removeAttivita);

export default router;
