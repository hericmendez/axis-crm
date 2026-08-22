import { Router } from 'express';
import * as leadController from '../controllers/lead.controller.js';

export const leadRouter = Router();

leadRouter.get('/api/leads', leadController.list);
leadRouter.get('/api/leads/:id', leadController.getById);
leadRouter.post('/api/leads', leadController.create);
leadRouter.patch('/api/leads/:id', leadController.update);
leadRouter.delete('/api/leads/:id', leadController.remove);
