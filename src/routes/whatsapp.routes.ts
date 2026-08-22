import { Router } from 'express';
import { getStatus } from '../whatsapp/whatsapp.service.js';

export const whatsappRouter = Router();

whatsappRouter.get('/api/whatsapp/status', (_req, res) => {
	const { status, qr } = getStatus();
	res.json({ status, qr });
});
