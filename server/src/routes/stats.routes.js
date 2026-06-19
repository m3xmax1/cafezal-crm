import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as ctrl from '../controllers/stats.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/torrefazione', ctrl.roastery);

export default router;
