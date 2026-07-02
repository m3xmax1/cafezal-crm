import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import * as ctrl from '../controllers/ordini.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/', ctrl.list);
router.get('/spedizione-check', ctrl.spedizioneCheck); // 1º ordine del mese del cliente? → spedizione gratis
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove); // store: elimina un proprio ordine ancora "ricevuto"
router.post('/:id/correct', ctrl.correct); // store corregge e re-invia un ordine in "problema"

export default router;
