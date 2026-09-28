import { Router } from 'express';
import { register, login, logout, getMe, getAllUsers } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authMiddleware, getMe);

export default router;
router.get('/users', authMiddleware, getAllUsers);
