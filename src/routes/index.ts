import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { leadRouter } from './lead.routes.js';
import { eventoRouter } from './evento.routes.js';
import { agendaRouter } from './agenda.routes.js';
import { metricasRouter } from './metricas.routes.js';

export const router = Router();

router.use(healthRouter);
router.use(leadRouter);
router.use(eventoRouter);
router.use(agendaRouter);
router.use(metricasRouter);
