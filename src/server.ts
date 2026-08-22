import { getEnv } from './config/env.js';
import { logger } from './utils/logger.js';
import { createApp } from './app.js';
import { connectMongo, disconnectMongo } from './infra/mongo/mongo.connection.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

function main(): void {
	const env = getEnv();
	const app = createApp();

	connectMongo(env.MONGO_URI)
		.then(() => {
			logger.info('Conectado ao MongoDB');
			const server = app.listen(env.PORT, () => {
				logger.info(`Servidor escutando na porta ${env.PORT}`);
			});

			const shutdown = (signal: string) => {
				logger.info({ signal }, 'Encerrando servidor');
				const timeout = setTimeout(() => {
					logger.error('Timeout no encerramento; forçando saída');
					process.exit(1);
				}, SHUTDOWN_TIMEOUT_MS);
				timeout.unref();
				server.close(() => {
					disconnectMongo()
						.catch((err: unknown) => {
							logger.error({ err }, 'Falha ao desconectar MongoDB');
						})
						.finally(() => process.exit(0));
				});
			};

			process.on('SIGINT', () => shutdown('SIGINT'));
			process.on('SIGTERM', () => shutdown('SIGTERM'));
		})
		.catch((err: unknown) => {
			logger.error({ err }, 'Falha ao inicializar o servidor');
			process.exit(1);
		});
}

process.on('unhandledRejection', (reason) => {
	logger.error({ reason }, 'unhandledRejection');
	process.exit(1);
});

process.on('uncaughtException', (err) => {
	logger.error({ err }, 'uncaughtException');
	process.exit(1);
});

main();
