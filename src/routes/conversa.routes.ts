import { Router } from 'express';
import * as conversaController from '../controllers/conversa.controller.js';

export const conversaRouter = Router();

conversaRouter.get('/api/v1/conversations', conversaController.list);
conversaRouter.get('/api/v1/conversations/:id', conversaController.getById);
