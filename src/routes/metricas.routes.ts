import { Router } from 'express';
import * as eventoController from '../controllers/evento.controller.js';

export const metricasRouter = Router();

metricasRouter.get('/api/metricas', eventoController.metricas);
