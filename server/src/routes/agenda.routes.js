import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as ctrl from '../controllers/opportunities.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/', ctrl.agenda); // follow-ups + activities, scoped, optional ?from&to

export default router;
