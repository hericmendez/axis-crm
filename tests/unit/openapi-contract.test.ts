import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { load as loadYaml } from 'js-yaml';
import type { Router } from 'express';
import { healthRouter } from '../../src/routes/health.routes.js';
import { authRouter } from '../../src/routes/auth.routes.js';
import { leadRouter } from '../../src/routes/lead.routes.js';
import { eventoRouter } from '../../src/routes/evento.routes.js';
import { conversaRouter } from '../../src/routes/conversa.routes.js';
import { agendaRouter } from '../../src/routes/agenda.routes.js';
import { metricasRouter } from '../../src/routes/metricas.routes.js';
import { whatsappRouter } from '../../src/routes/whatsapp.routes.js';
import { googleOAuthRouter } from '../../src/routes/google-oauth.routes.js';

const here = dirname(fileURLToPath(import.meta.url));
const specPath = join(here, '..', '..', 'docs', 'api', 'openapi.yaml');

function loadSpec(): Record<string, unknown> {
	const raw = readFileSync(specPath, 'utf8');
	return loadYaml(raw) as Record<string, unknown>;
}

// Express "/api/leads/:id" -> OpenAPI "/api/leads/{id}"
function toOpenApiPath(expressPath: string): string {
	return expressPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
}

function registeredRoutes(): Array<{ method: string; path: string }> {
	const routers: Router[] = [
		healthRouter,
		authRouter,
		leadRouter,
		eventoRouter,
		conversaRouter,
		agendaRouter,
		metricasRouter,
		whatsappRouter,
		googleOAuthRouter,
	];
	const out: Array<{ method: string; path: string }> = [];
	for (const router of routers) {
		for (const layer of (router.stack as Array<{ route?: { path: string; methods: Record<string, boolean> } }>)) {
			if (!layer.route) continue;
			for (const [method, enabled] of Object.entries(layer.route.methods)) {
				if (enabled) out.push({ method, path: toOpenApiPath(layer.route.path) });
			}
		}
	}
	return out;
}

function collectRefs(node: unknown, refs: string[]): void {
	if (Array.isArray(node)) {
		for (const item of node) collectRefs(item, refs);
		return;
	}
	if (node && typeof node === 'object') {
		for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
			if (key === '$ref' && typeof value === 'string') refs.push(value);
			else collectRefs(value, refs);
		}
	}
}

describe('OpenAPI contract (docs/api/openapi.yaml)', () => {
	it('exists, parses as YAML and declares OpenAPI 3.1.x', () => {
		const spec = loadSpec();
		expect(spec.openapi).toMatch(/^3\.1\./);
		expect((spec.info as { title?: string }).title).toBe('Axis CRM API');
		expect(spec.paths).toBeTypeOf('object');
	});

	it('documents every registered Express route with at least one response', () => {
		const spec = loadSpec();
		const paths = spec.paths as Record<string, Record<string, { responses?: unknown }>>;
		const missing: string[] = [];
		for (const { method, path } of registeredRoutes()) {
			const operation = paths[path]?.[method];
			if (!operation || typeof operation.responses !== 'object' || operation.responses === null) {
				missing.push(`${method.toUpperCase()} ${path}`);
			}
		}
		expect(missing).toEqual([]);
	});

	it('declares both security schemes used by the middleware chain', () => {
		const spec = loadSpec();
		const schemes = (spec.components as { securitySchemes?: Record<string, { type?: string }> })
			.securitySchemes;
		expect(schemes?.bearerAuth?.type).toBe('http');
		expect(schemes?.apiKeyAuth?.type).toBe('apiKey');
	});

	it('marks the truly public routes as security-free', () => {
		const spec = loadSpec();
		const paths = spec.paths as Record<string, Record<string, { security?: unknown[] }>>;
		for (const path of ['/health', '/api/auth/login', '/api/v1/integrations/google/callback']) {
			const operation = paths[path]?.get ?? paths[path]?.post;
			expect(operation?.security, path).toEqual([]);
		}
	});

	it('every internal $ref resolves inside the document', () => {
		const spec = loadSpec();
		const refs: string[] = [];
		collectRefs(spec, refs);
		expect(refs.length).toBeGreaterThan(0);
		const broken = refs.filter((ref) => {
			if (!ref.startsWith('#/')) return true;
			const parts = ref.slice(2).split('/');
			let node: unknown = spec;
			for (const part of parts) {
				if (!node || typeof node !== 'object' || !(part in (node as Record<string, unknown>))) {
					return true;
				}
				node = (node as Record<string, unknown>)[part];
			}
			return false;
		});
		expect(broken).toEqual([]);
	});
});
