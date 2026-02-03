import { Router } from 'express';
import { globalRateLimit } from '../middleware/rate-limit';
import userRoutes from './user.routes';

const router: Router = Router();

router.use(globalRateLimit);

router.use('/users', userRoutes);

export default router;
