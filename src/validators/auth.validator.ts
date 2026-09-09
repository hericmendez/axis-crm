import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const loginSchema = z
	.object({
		email: emailSchema,
		password: z.string().min(1).max(128),
	})
	.strip();

export const refreshSchema = z
	.object({
		refreshToken: z.string().trim().min(1).max(512),
	})
	.strip();

export const createUserSchema = z
	.object({
		name: z.string().trim().min(1).max(200),
		email: emailSchema,
		password: z.string().min(8).max(128),
	})
	.strip();
