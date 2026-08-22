import { Router } from 'express';
import * as eventoController from '../controllers/evento.controller.js';

export const agendaRouter = Router();

agendaRouter.get('/api/agenda', eventoController.agenda);
