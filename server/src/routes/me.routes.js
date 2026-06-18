import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Who am I? Used by the frontend to learn its role.
router.get('/', requireAuth, (req, res) => {
  res.json({
    email: req.user.email,
    commerciale: req.user.commerciale,
    isAdmin: req.user.isAdmin,
    isTorrefazione: req.user.isTorrefazione,
    store: req.user.store,
  });
});

export default router;
