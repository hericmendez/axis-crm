import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authRateLimit } from '../middlewares/auth-rate-limit.middleware.js';

export const authRouter = Router();

// Brute-force protection on credential-consuming endpoints only.
// Logout stays unlimited: it is idempotent and reveals nothing.
authRouter.post('/api/auth/login', authRateLimit, authController.login);
authRouter.post('/api/auth/refresh', authRateLimit, authController.refresh);
authRouter.post('/api/auth/logout', authController.logout);
