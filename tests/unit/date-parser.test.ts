import { describe, expect, it } from 'vitest';
import { parseRelativeDateTime } from '../../src/ai/date-parser.js';

function makeDate(year: number, month: number, day: number, hours = 0, minutes = 0): Date {
	const d = new Date(year, month, day, hours, minutes, 0, 0);
	return d;
}

describe('date-parser', () => {
	const now = makeDate(2026, 7, 27, 10, 0); // Aug 27, 2026 10:00

	describe('datas relativas', () => {
		it('amanhã', () => {
			const result = parseRelativeDateTime('agende para amanhã', now);
			expect(result).not.toBeNull();
			expect(result!.date.getDate()).toBe(28);
			expect(result!.date.getMonth()).toBe(7);
		});

		it('depois de amanhã', () => {
			const result = parseRelativeDateTime('agende depois de amanhã', now);
			expect(result).not.toBeNull();
			expect(result!.date.getDate()).toBe(29);
		});

		it('segunda-feira', () => {
			const result = parseRelativeDateTime('agende para segunda-feira', now);
			expect(result).not.toBeNull();
			// Aug 27 is Wednesday, next Monday is Aug 31
			expect(result!.date.getDate()).toBe(31);
			expect(result!.date.getMonth()).toBe(7);
		});

		it('segunda (abreviação)', () => {
			const result = parseRelativeDateTime('agende para segunda', now);
			expect(result).not.toBeNull();
			expect(result!.date.getDate()).toBe(31);
		});

		it('terça-feira', () => {
			const result = parseRelativeDateTime('agende para terça-feira', now);
			expect(result).not.toBeNull();
			// Next Tuesday is Sep 1
			expect(result!.date.getDate()).toBe(1);
			expect(result!.date.getMonth()).toBe(8);
		});

		it('sexta-feira', () => {
			const result = parseRelativeDateTime('agende para sexta-feira', now);
			expect(result).not.toBeNull();
			// Next Friday is Aug 28... wait, Aug 27 is Thursday? Let me check.
			// Actually Aug 27, 2026 is Thursday. Next Friday is Aug 28.
			expect(result!.date.getDate()).toBe(28);
			expect(result!.date.getMonth()).toBe(7);
		});

		it('sábado', () => {
			const result = parseRelativeDateTime('agende para sábado', now);
			expect(result).not.toBeNull();
			// Aug 27 is Thursday, next Saturday is Aug 29
			expect(result!.date.getDate()).toBe(29);
		});

		it('domingo', () => {
			const result = parseRelativeDateTime('agende para domingo', now);
			expect(result).not.toBeNull();
			// Aug 27 is Thursday, next Sunday is Aug 30
			expect(result!.date.getDate()).toBe(30);
		});
	});

	describe('datas absolutas', () => {
		it('dia 31', () => {
			const result = parseRelativeDateTime('agende dia 31', now);
			expect(result).not.toBeNull();
			expect(result!.date.getDate()).toBe(31);
		});

		it('dia 15 de setembro', () => {
			const result = parseRelativeDateTime('agende dia 15 de setembro', now);
			expect(result).not.toBeNull();
			expect(result!.date.getDate()).toBe(15);
			expect(result!.date.getMonth()).toBe(8); // September
		});
	});

	describe('horários', () => {
		it('às 14h', () => {
			const result = parseRelativeDateTime('agende às 14h', now);
			expect(result).not.toBeNull();
			expect(result!.date.getHours()).toBe(14);
			expect(result!.date.getMinutes()).toBe(0);
			expect(result!.hadTime).toBe(true);
		});

		it('às 14:30', () => {
			const result = parseRelativeDateTime('agende às 14:30', now);
			expect(result).not.toBeNull();
			expect(result!.date.getHours()).toBe(14);
			expect(result!.date.getMinutes()).toBe(30);
			expect(result!.hadTime).toBe(true);
		});

		it('10h da manhã', () => {
			const result = parseRelativeDateTime('agende às 10h da manhã', now);
			expect(result).not.toBeNull();
			expect(result!.date.getHours()).toBe(10);
			expect(result!.hadTime).toBe(true);
		});

		it('3h da tarde', () => {
			const result = parseRelativeDateTime('agende às 3h da tarde', now);
			expect(result).not.toBeNull();
			expect(result!.date.getHours()).toBe(15);
			expect(result!.hadTime).toBe(true);
		});

		it('duas da tarde (com data)', () => {
			const result = parseRelativeDateTime('agende amanhã às duas da tarde', now);
			expect(result).not.toBeNull();
			expect(result!.date.getDate()).toBe(28);
			expect(result!.date.getHours()).toBe(14);
			expect(result!.hadTime).toBe(true);
		});

		it('de manhã com data (sem hora específica)', () => {
			const result = parseRelativeDateTime('agende amanhã de manhã', now);
			expect(result).not.toBeNull();
			expect(result!.date.getDate()).toBe(28);
			expect(result!.date.getHours()).toBe(9);
			expect(result!.hadTime).toBe(true);
		});

		it('de tarde com data (sem hora específica)', () => {
			const result = parseRelativeDateTime('agende sexta de tarde', now);
			expect(result).not.toBeNull();
			expect(result!.date.getHours()).toBe(14);
			expect(result!.hadTime).toBe(true);
		});
	});

	describe('combinações', () => {
		it('amanhã às 10h', () => {
			const result = parseRelativeDateTime('agende amanhã às 10h', now);
			expect(result).not.toBeNull();
			expect(result!.date.getDate()).toBe(28);
			expect(result!.date.getHours()).toBe(10);
			expect(result!.hadTime).toBe(true);
		});

		it('próxima segunda às 14h', () => {
			const result = parseRelativeDateTime('agende próxima segunda às 14h', now);
			expect(result).not.toBeNull();
			expect(result!.date.getDate()).toBe(31);
			expect(result!.date.getHours()).toBe(14);
			expect(result!.hadTime).toBe(true);
		});

		it('sexta às 15h', () => {
			const result = parseRelativeDateTime('agende sexta às 15h', now);
			expect(result).not.toBeNull();
			expect(result!.date.getHours()).toBe(15);
			expect(result!.hadTime).toBe(true);
		});

		it('dia 31 às 14:30', () => {
			const result = parseRelativeDateTime('agende dia 31 às 14:30', now);
			expect(result).not.toBeNull();
			expect(result!.date.getDate()).toBe(31);
			expect(result!.date.getHours()).toBe(14);
			expect(result!.date.getMinutes()).toBe(30);
			expect(result!.hadTime).toBe(true);
		});

		it('depois de amanhã às 9 (sem sufixo h, não reconhecido como horário)', () => {
			const result = parseRelativeDateTime('agende depois de amanhã às 9', now);
			expect(result).not.toBeNull();
			expect(result!.date.getDate()).toBe(29);
			expect(result!.hadTime).toBe(false);
		});
	});

	describe('sem informação de data', () => {
		it('retorna null para mensagem sem data', () => {
			const result = parseRelativeDateTime('agende com Pedro', now);
			expect(result).toBeNull();
		});

		it('retorna null para mensagem apenas com tipo', () => {
			const result = parseRelativeDateTime('marque uma call', now);
			expect(result).toBeNull();
		});
	});

	describe('ontem', () => {
		const now = new Date(2026, 7, 27, 10, 0, 0);

		it('ontem → dia anterior', () => {
			const r = parseRelativeDateTime('ontem às 14h', now);
			expect(r).not.toBeNull();
			expect(r!.date.getDate()).toBe(26);
			expect(r!.date.getMonth()).toBe(7);
			expect(r!.hadTime).toBe(true);
		});

		it('ontem sem horário → meia-noite', () => {
			const r = parseRelativeDateTime('ontem', now);
			expect(r).not.toBeNull();
			expect(r!.date.getDate()).toBe(26);
			expect(r!.hadTime).toBe(false);
		});
	});

	describe('anteontem', () => {
		const now = new Date(2026, 7, 27, 10, 0, 0);

		it('anteontem → dois dias atrás', () => {
			const r = parseRelativeDateTime('anteontem às 9h', now);
			expect(r).not.toBeNull();
			expect(r!.date.getDate()).toBe(25);
			expect(r!.date.getMonth()).toBe(7);
			expect(r!.hadTime).toBe(true);
		});
	});

	describe('semana passada', () => {
		const now = new Date(2026, 7, 27, 10, 0, 0); // quinta-feira

		it('terça-feira da semana passada → última terça', () => {
			const r = parseRelativeDateTime('terça-feira da semana passada às 16h', now);
			expect(r).not.toBeNull();
			expect(r!.date.getDay()).toBe(2); // terça
			expect(r!.date.getDate()).toBe(25); // 25/08 (última terça)
			expect(r!.hadTime).toBe(true);
		});

		it('sexta passada → última sexta', () => {
			const r = parseRelativeDateTime('sexta passada às 15h', now);
			expect(r).not.toBeNull();
			expect(r!.date.getDay()).toBe(5); // sexta
			expect(r!.date.getDate()).toBe(21); // 21/08
			expect(r!.hadTime).toBe(true);
		});

		it('segunda da semana passada → última segunda', () => {
			const r = parseRelativeDateTime('segunda da semana passada', now);
			expect(r).not.toBeNull();
			expect(r!.date.getDay()).toBe(1); // segunda
			expect(r!.date.getDate()).toBe(24); // 24/08
		});
	});

	describe('próxima semana', () => {
		const now = new Date(2026, 7, 27, 10, 0, 0); // quinta-feira

		it('próxima segunda → segunda que vem', () => {
			const r = parseRelativeDateTime('próxima segunda às 10h', now);
			expect(r).not.toBeNull();
			expect(r!.date.getDay()).toBe(1);
			expect(r!.date.getDate()).toBe(31); // 31/08
			expect(r!.hadTime).toBe(true);
		});

		it('próxima terça → terça que vem', () => {
			const r = parseRelativeDateTime('próxima terça', now);
			expect(r).not.toBeNull();
			expect(r!.date.getDay()).toBe(2);
			expect(r!.date.getDate()).toBe(1); // 01/09
		});
	});

	describe('esta semana', () => {
		const now = new Date(2026, 7, 27, 10, 0, 0); // quinta-feira

		it('sexta desta semana → sexta atual', () => {
			const r = parseRelativeDateTime('sexta desta semana às 14h', now);
			expect(r).not.toBeNull();
			expect(r!.date.getDay()).toBe(5);
			expect(r!.date.getDate()).toBe(28); // 28/08
			expect(r!.hadTime).toBe(true);
		});
	});

	describe('preservação do comportamento existente', () => {
		const now = new Date(2026, 7, 27, 10, 0, 0); // quinta-feira

		it('terça-feira (sem modificador) → próxima terça', () => {
			const r = parseRelativeDateTime('terça-feira às 14h', now);
			expect(r).not.toBeNull();
			expect(r!.date.getDay()).toBe(2);
			expect(r!.date.getDate()).toBe(1); // 01/09 (próxima)
		});

		it('sexta (sem modificador) → próxima sexta', () => {
			const r = parseRelativeDateTime('sexta às 15h', now);
			expect(r).not.toBeNull();
			expect(r!.date.getDay()).toBe(5);
			expect(r!.date.getDate()).toBe(28); // 28/08 (próxima)
		});

		it('amanhã + weekday → amanhã (ignora weekday)', () => {
			const r = parseRelativeDateTime('amanhã às 10h', now);
			expect(r).not.toBeNull();
			expect(r!.date.getDate()).toBe(28);
		});
	});
});

