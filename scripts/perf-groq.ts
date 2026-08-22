import * as groqProvider from '../src/ai/providers/groq.provider.js';

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
	console.error('Defina GROQ_API_KEY para rodar o teste de performance real.');
	process.exit(1);
}

const model = process.env.GROQ_MODEL ?? 'openai/gpt-oss-120b';
const RUNS = 5;

const prompts = [
	'Quero cadastrar um lead chamado Maria Silva, telefone 11987654321, veio do Instagram',
	'Oi, tudo bem?',
	'Agende uma reunião com o João amanhã às 15h',
	'Qual a taxa de conversão deste mês?',
	'O cliente desistiu da compra',
];

const samples: { ms: number; mode: string }[] = [];

for (let i = 0; i < RUNS; i++) {
	const start = performance.now();
	try {
		const result = await groqProvider.complete(
			{ apiKey, model },
			{ messages: [{ role: 'user', content: prompts[i % prompts.length] }] },
		);
		samples.push({ ms: performance.now() - start, mode: result.mode });
	} catch (err) {
		console.error('Falha na chamada:', err);
		process.exit(1);
	}
}

const sorted = samples.map((s) => s.ms).sort((a, b) => a - b);
const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;

console.log(`Modelo: ${model} | Chamadas: ${RUNS}`);
console.log(`Latência média: ${Math.round(avg)}ms`);
console.log(`p50: ${Math.round(sorted[Math.floor(RUNS / 2)])}ms | max: ${Math.round(sorted[RUNS - 1])}ms`);
samples.forEach((s, i) => console.log(`  #${i + 1}: ${Math.round(s.ms)}ms (${s.mode})`));
