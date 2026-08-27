import { describe, expect, it, vi } from 'vitest';
import { createCreateLeadTool } from '../../src/ai/tools/create-lead.tool.js';
import { createUpdateLeadTool } from '../../src/ai/tools/update-lead.tool.js';
import { createRegisterEventTool } from '../../src/ai/tools/register-event.tool.js';
import { createConsultAgendaTool } from '../../src/ai/tools/consult-agenda.tool.js';

describe('CreateLeadTool', () => {
	it('cria lead e retorna SUCCESS com dados', async () => {
		const leadService = {
			create: vi.fn().mockResolvedValue({
				id: 'lead-1',
				nome: 'João',
				telefone: '16999999999',
				status: 'LEAD',
				contatoOrigem: 'whatsapp',
				createdAt: new Date(),
				updatedAt: new Date(),
			}),
		};
		const tool = createCreateLeadTool({ leadService });

		const result = await tool.execute({
			nome: 'João',
			telefone: '16999999999',
			contatoOrigem: 'whatsapp',
		});

		expect(result.type).toBe('SUCCESS');
		expect(result.message).toContain('Lead criado');
		expect(result.message).toContain('João');
		expect(result.message).toContain('16999999999');
		expect(leadService.create).toHaveBeenCalledWith({
			nome: 'João',
			telefone: '16999999999',
			contatoOrigem: 'whatsapp',
		});
	});

	it('passa status quando fornecido', async () => {
		const leadService = {
			create: vi.fn().mockResolvedValue({
				id: 'lead-1', nome: 'João', telefone: '16999999999', status: 'CLIENTE',
			}),
		};
		const tool = createCreateLeadTool({ leadService });

		await tool.execute({
			nome: 'João',
			telefone: '16999999999',
			contatoOrigem: 'whatsapp',
			status: 'CLIENTE',
		});

		expect(leadService.create).toHaveBeenCalledWith({
			nome: 'João',
			telefone: '16999999999',
			contatoOrigem: 'whatsapp',
			status: 'CLIENTE',
		});
	});

	it('propaga erro do service', async () => {
		const leadService = {
			create: vi.fn().mockRejectedValue(new Error('Duplicate key')),
		};
		const tool = createCreateLeadTool({ leadService });

		await expect(
			tool.execute({ nome: 'João', telefone: '16999999999', contatoOrigem: 'whatsapp' }),
		).rejects.toThrow('Duplicate key');
	});
});

describe('UpdateLeadTool', () => {
	it('atualiza lead e retorna SUCCESS', async () => {
		const leadService = {
			update: vi.fn().mockResolvedValue({
				id: 'lead-1',
				nome: 'João',
				status: 'VENDIDO',
			}),
		};
		const tool = createUpdateLeadTool({ leadService });

		const result = await tool.execute({
			leadId: 'lead-1',
			patch: { status: 'VENDIDO' },
		});

		expect(result.type).toBe('SUCCESS');
		expect(result.message).toContain('Lead atualizado');
		expect(leadService.update).toHaveBeenCalledWith('lead-1', { status: 'VENDIDO' });
	});

	it('propaga erro do service', async () => {
		const leadService = {
			update: vi.fn().mockRejectedValue(new Error('Not found')),
		};
		const tool = createUpdateLeadTool({ leadService });

		await expect(
			tool.execute({ leadId: 'lead-999', patch: { status: 'VENDIDO' } }),
		).rejects.toThrow('Not found');
	});
});

describe('RegisterEventTool', () => {
	it('registra evento e retorna SUCCESS', async () => {
		const eventoService = {
			create: vi.fn().mockResolvedValue({ id: 'evento-1' }),
		};
		const tool = createRegisterEventTool({ eventoService });

		const result = await tool.execute({
			leadId: 'lead-1',
			tipo: 'VENDA',
			leadNome: 'João',
			data: new Date('2026-09-01'),
			observacoes: 'Teste',
		});

		expect(result.type).toBe('SUCCESS');
		expect(result.message).toContain('Evento registrado');
		expect(result.message).toContain('VENDA');
		expect(result.message).toContain('João');
		expect(eventoService.create).toHaveBeenCalledWith({
			leadId: 'lead-1',
			tipo: 'VENDA',
			data: expect.any(Date),
			observacoes: 'Teste',
		});
	});

	it('registra evento sem data e sem observacoes', async () => {
		const eventoService = {
			create: vi.fn().mockResolvedValue({ id: 'evento-1' }),
		};
		const tool = createRegisterEventTool({ eventoService });

		const result = await tool.execute({
			leadId: 'lead-1',
			tipo: 'REUNIAO',
			leadNome: 'João',
		});

		expect(result.type).toBe('SUCCESS');
		expect(eventoService.create).toHaveBeenCalledWith({
			leadId: 'lead-1',
			tipo: 'REUNIAO',
		});
	});

	it('propaga erro do service', async () => {
		const eventoService = {
			create: vi.fn().mockRejectedValue(new Error('Invalid event')),
		};
		const tool = createRegisterEventTool({ eventoService });

		await expect(
			tool.execute({ leadId: 'lead-1', tipo: 'VENDA', leadNome: 'João' }),
		).rejects.toThrow('Invalid event');
	});
});

describe('ConsultAgendaTool', () => {
	it('retorna lista formatada quando há agendamentos', async () => {
		const metricasService = {
			agenda: vi.fn().mockResolvedValue([
				{ nome: 'João', dataAgendamento: new Date('2026-09-01') },
				{ nome: 'Maria', dataAgendamento: new Date('2026-09-02') },
			]),
		};
		const tool = createConsultAgendaTool({ metricasService });

		const de = new Date('2026-09-01');
		const ate = new Date('2026-09-07');
		const result = await tool.execute({ de, ate });

		expect(result.type).toBe('SUCCESS');
		expect(result.message).toContain('Agendamentos');
		expect(result.message).toContain('João');
		expect(result.message).toContain('Maria');
		expect(result.data).toHaveLength(2);
	});

	it('retorna mensagem quando vazio', async () => {
		const metricasService = {
			agenda: vi.fn().mockResolvedValue([]),
		};
		const tool = createConsultAgendaTool({ metricasService });

		const result = await tool.execute({ de: new Date(), ate: new Date() });

		expect(result.type).toBe('SUCCESS');
		expect(result.message).toContain('Nenhum agendamento');
		expect(result.data).toBeUndefined();
	});

	it('propaga erro do service', async () => {
		const metricasService = {
			agenda: vi.fn().mockRejectedValue(new Error('DB error')),
		};
		const tool = createConsultAgendaTool({ metricasService });

		await expect(
			tool.execute({ de: new Date(), ate: new Date() }),
		).rejects.toThrow('DB error');
	});
});
