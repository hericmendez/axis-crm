import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import { errorHandler } from '../src/middlewares/error-handler.middleware.js';
import { notFoundHandler } from '../src/middlewares/not-found.middleware.js';
import { AppError } from '../src/utils/errors.js';

function buildApp(): Express {
	const app = express();
	app.get('/boom', () => {
		throw new Error('segredo interno');
	});
	app.get('/app-error', () => {
		throw new AppError(422, 'dados inválidos');
	});
	app.get('/async-error', async () => {
		throw new Error('falha assíncrona');
	});
	app.use(notFoundHandler);
	app.use(errorHandler);
	return app;
}

describe('error handler', () => {
	it('responde 500 genérico sem vazar stack para erro inesperado', async () => {
		const res = await request(buildApp()).get('/boom');
		expect(res.status).toBe(500);
		expect(res.body.error).toBe('Internal Server Error');
		expect(JSON.stringify(res.body)).not.toContain('segredo');
	});

	it('propaga mensagem de AppError com status correto', async () => {
		const res = await request(buildApp()).get('/app-error');
		expect(res.status).toBe(422);
		expect(res.body.error).toBe('dados inválidos');
	});

	it('captura erro assíncrono (promise rejeitada) no error middleware', async () => {
		const res = await request(buildApp()).get('/async-error');
		expect(res.status).toBe(500);
		expect(res.body.error).toBe('Internal Server Error');
		expect(JSON.stringify(res.body)).not.toContain('assíncrona');
	});
});

describe('not found handler', () => {
	it('responde 404 JSON para rota inexistente', async () => {
		const res = await request(buildApp()).get('/inexistente');
		expect(res.status).toBe(404);
		expect(res.body.error).toContain('/inexistente');
	});
});
