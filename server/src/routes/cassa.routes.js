import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { daily, analisi, sync, exportXlsx, exportCsv, cassaConfig } from '../controllers/cassa.controller.js';

const router = Router();

// CSV con chiave dedicata (Google Sheets IMPORTDATA): NIENTE requireAuth,
// il controllo è la chiave lunga in query string (vedi controller).
router.get('/export.csv', exportCsv);

router.use(requireAuth);
router.get('/daily', daily);
router.get('/analisi', analisi);
router.post('/sync', sync);
router.get('/export.xlsx', exportXlsx);
router.get('/config', cassaConfig);

export default router;
