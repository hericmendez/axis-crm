import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';
import helmet from 'helmet';
import { router } from './routes/index.js';
import { notFoundHandler } from './middlewares/not-found.middleware.js';
import { errorHandler } from './middlewares/error-handler.middleware.js';
import { apiKeyAuth } from './middlewares/api-key.middleware.js';
import { rateLimit } from './middlewares/rate-limit.middleware.js';
import { logger } from './utils/logger.js';

export function createApp(): Express {
	const app = express();

	app.use(helmet());
	app.use(express.json({ limit: '100kb' }));
	app.use(pinoHttp({ logger }));
	app.use(rateLimit);
	app.use(apiKeyAuth);

	app.use(router);

	app.use(notFoundHandler);
	app.use(errorHandler);

	return app;
}
