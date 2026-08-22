import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';
import { router } from './routes/index.js';
import { notFoundHandler } from './middlewares/not-found.middleware.js';
import { errorHandler } from './middlewares/error-handler.middleware.js';
import { logger } from './utils/logger.js';

export function createApp(): Express {
	const app = express();

	app.use(express.json());
	app.use(pinoHttp({ logger }));

	app.use(router);

	app.use(notFoundHandler);
	app.use(errorHandler);

	return app;
}
