import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as ctrl from '../controllers/opportunities.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/', ctrl.samplesOverview); // all scoped samples (for conversion stats)

export default router;
