import { describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const { complete } = await import('../../src/ai/providers/groq.provider.js');
import { structuredOutputSchema } from '../../src/types/ai.js';

const config = { apiKey: 'perf-key', model: 'llama-3.3-70b-versatile' };
const ACTION_JSON =
	'{"mode":"ACTION","intent":"CRIAR_LEAD","confidence":0.95,"parameters":{"nome":"João","telefone":"11999999999"}}';

function latencyStats(samples: number[]) {
	const sorted = [...samples].sort((a, b) => a - b);
	const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
	return {
		avg: Math.round(avg),
		p50: sorted[Math.floor(sorted.length * 0.5)],
		p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
	};
}

describe('performance do pipeline LLM (overhead local, com fetch mockado)', () => {
	it('processa 100 respostas com p95 < 50ms de overhead', async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ choices: [{ message: { content: ACTION_JSON } }] }),
		});

		const samples: number[] = [];
		for (let i = 0; i < 100; i++) {
			const start = performance.now();
			const result = await complete(config, {
				messages: [{ role: 'user', content: `mensagem ${i}` }],
			});
			samples.push(performance.now() - start);
			expect(result.mode).toBe('ACTION');
		}

		const stats = latencyStats(samples);
		expect(stats.p95).toBeLessThan(50);
	});

	it('validação de schema suporta >1000 ops/s', () => {
		const start = performance.now();
		for (let i = 0; i < 1000; i++) {
			expect(structuredOutputSchema.safeParse(JSON.parse(ACTION_JSON)).success).toBe(true);
		}
		const elapsed = performance.now() - start;
		expect(elapsed).toBeLessThan(1000);
	});
});
