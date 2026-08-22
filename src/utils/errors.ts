export class AppError extends Error {
	constructor(
		public readonly statusCode: number,
		message: string,
		options?: { cause?: unknown },
	) {
		super(message, options);
		this.name = 'AppError';
	}
}
