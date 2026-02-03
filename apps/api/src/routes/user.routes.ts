import express, { type Router } from 'express';
import { requireAuth } from '../middleware/auth';

const router: Router = express.Router();

router.get('/session', requireAuth, (req, res) => {
  res.json({
    user: req.user,
    session: req.session,
  });
});

export default router;
