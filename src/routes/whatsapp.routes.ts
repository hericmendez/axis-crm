import { Router } from 'express';
import { getStatus } from '../whatsapp/whatsapp.service.js';
import * as whatsappController from '../controllers/whatsapp.controller.js';

export const whatsappRouter = Router();

whatsappRouter.get('/api/whatsapp/status', (_req, res) => {
	const { status, qr } = getStatus();
	res.json({ status, qr });
});

whatsappRouter.get('/api/v1/whatsapp/status', whatsappController.status);
whatsappRouter.get('/api/v1/whatsapp/qr', whatsappController.qr);
