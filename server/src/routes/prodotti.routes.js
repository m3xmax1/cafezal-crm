import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as ctrl from '../controllers/prodotti.controller.js';

const router = Router();

router.use(requireAuth);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

// Formati
router.post('/:id/formati', ctrl.addFormato);
router.patch('/formati/:fid', ctrl.updateFormato);
router.delete('/formati/:fid', ctrl.deleteFormato);

export default router;
