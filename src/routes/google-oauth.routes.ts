import { Router } from 'express';
import * as googleOAuthController from '../controllers/google-oauth.controller.js';

export const googleOAuthRouter = Router();

googleOAuthRouter.get('/api/v1/integrations/google/connect', googleOAuthController.connect);
googleOAuthRouter.get('/api/v1/integrations/google/callback', googleOAuthController.callback);
googleOAuthRouter.get('/api/v1/integrations/google/status', googleOAuthController.status);
googleOAuthRouter.delete('/api/v1/integrations/google', googleOAuthController.disconnect);
