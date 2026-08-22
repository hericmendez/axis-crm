import { Router } from 'express';
import * as eventoController from '../controllers/evento.controller.js';

export const eventoRouter = Router();

eventoRouter.post('/api/leads/:id/eventos', eventoController.create);
eventoRouter.get('/api/leads/:id/eventos', eventoController.listByLead);
