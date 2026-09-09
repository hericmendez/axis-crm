import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { authRouter } from './auth.routes.js';
import { leadRouter } from './lead.routes.js';
import { eventoRouter } from './evento.routes.js';
import { conversaRouter } from './conversa.routes.js';
import { agendaRouter } from './agenda.routes.js';
import { metricasRouter } from './metricas.routes.js';
import { whatsappRouter } from './whatsapp.routes.js';
import { googleOAuthRouter } from './google-oauth.routes.js';

export const router = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(googleOAuthRouter);
router.use(leadRouter);
router.use(eventoRouter);
router.use(conversaRouter);
router.use(agendaRouter);
router.use(metricasRouter);
router.use(whatsappRouter);
