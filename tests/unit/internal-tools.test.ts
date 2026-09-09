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
			userId: '507f1f77bcf86cd799439011',
		});

		expect(result.type).toBe('SUCCESS');
		expect(result.message).toContain('Lead criado');
		expect(result.message).toContain('João');
		expect(result.message).toContain('16999999999');
		expect(leadService.create).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
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
			userId: '507f1f77bcf86cd799439011',
		});

		expect(leadService.create).toHaveBeenCalledWith('507f1f77bcf86cd799439011', {
			nome: 'João',
			telefone: '16999999999',
			contatoOrigem: 'whatsapp',
			status: 'CLIENTE',
		});
	});

	it('rejeita sem userId (401, sem chamar service)', async () => {
		const leadService = { create: vi.fn() };
		const tool = createCreateLeadTool({ leadService });

		await expect(
			tool.execute({ nome: 'João', telefone: '16999999999', contatoOrigem: 'whatsapp' }),
		).rejects.toMatchObject({ statusCode: 401 });
		expect(leadService.create).not.toHaveBeenCalled();
	});

	it('propaga erro do service', async () => {
		const leadService = {
			create: vi.fn().mockRejectedValue(new Error('Duplicate key')),
		};
		const tool = createCreateLeadTool({ leadService });

		await expect(
			tool.execute({ nome: 'João', telefone: '16999999999', contatoOrigem: 'whatsapp', userId: '507f1f77bcf86cd799439011' }),
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
			userId: '507f1f77bcf86cd799439011',
		});

		expect(result.type).toBe('SUCCESS');
		expect(result.message).toContain('Lead atualizado');
		expect(leadService.update).toHaveBeenCalledWith('507f1f77bcf86cd799439011', 'lead-1', { status: 'VENDIDO' });
	});

	it('propaga erro do service', async () => {
		const leadService = {
			update: vi.fn().mockRejectedValue(new Error('Not found')),
		};
		const tool = createUpdateLeadTool({ leadService });

		await expect(
			tool.execute({ leadId: 'lead-999', patch: { status: 'VENDIDO' }, userId: '507f1f77bcf86cd799439011' }),
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
			userId: '507f1f77bcf86cd799439011',
		});

		expect(result.type).toBe('SUCCESS');
		expect(result.message).toContain('Evento registrado');
		expect(result.message).toContain('VENDA');
		expect(result.message).toContain('João');
		expect(eventoService.create).toHaveBeenCalledWith({
			leadId: 'lead-1',
			tipo: 'VENDA',
			userId: '507f1f77bcf86cd799439011',
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
			userId: '507f1f77bcf86cd799439011',
		});

		expect(result.type).toBe('SUCCESS');
		expect(eventoService.create).toHaveBeenCalledWith({
			leadId: 'lead-1',
			tipo: 'REUNIAO',
			userId: '507f1f77bcf86cd799439011',
		});
	});

	it('propaga erro do service', async () => {
		const eventoService = {
			create: vi.fn().mockRejectedValue(new Error('Invalid event')),
		};
		const tool = createRegisterEventTool({ eventoService });

		await expect(
			tool.execute({ leadId: 'lead-1', tipo: 'VENDA', leadNome: 'João', userId: '507f1f77bcf86cd799439011' }),
		).rejects.toThrow('Invalid event');
	});
});

describe('ConsultAgendaTool', () => {
	it('retorna lista formatada quando há agendamentos', async () => {
		const agendaService = {
			consultarAgenda: vi.fn().mockResolvedValue({
				de: new Date('2026-09-01'),
				ate: new Date('2026-09-07'),
				eventos: [
					{ id: '1', origem: 'domain', titulo: 'João', inicio: new Date('2026-09-01T14:00:00-03:00'), fim: new Date('2026-09-01T15:00:00-03:00'), allDay: false, tipo: 'AGENDAMENTO', leadId: 'lead-1', leadNome: 'João' },
					{ id: '2', origem: 'domain', titulo: 'Maria', inicio: new Date('2026-09-02T10:00:00-03:00'), fim: new Date('2026-09-02T11:00:00-03:00'), allDay: false, tipo: 'AGENDAMENTO', leadId: 'lead-2', leadNome: 'Maria' },
				],
				ocupacao: [],
				disponibilidade: [],
				calendarStatus: 'OK',
			}),
		};
		const tool = createConsultAgendaTool({ agendaService });

		const de = new Date('2026-09-01');
		const ate = new Date('2026-09-07');
		const result = await tool.execute({ de, ate });

		expect(result.type).toBe('SUCCESS');
		expect(result.message).toContain('Agendamentos');
		expect(result.message).toContain('João');
		expect(result.message).toContain('Maria');
		expect(result.data).toBeDefined();
		expect(result.data!.eventos).toHaveLength(2);
	});

	it('retorna mensagem quando vazio', async () => {
		const agendaService = {
			consultarAgenda: vi.fn().mockResolvedValue({
				de: new Date(),
				ate: new Date(),
				eventos: [],
				ocupacao: [],
				disponibilidade: [],
				calendarStatus: 'OK',
			}),
		};
		const tool = createConsultAgendaTool({ agendaService });

		const result = await tool.execute({ de: new Date(), ate: new Date() });

		expect(result.type).toBe('SUCCESS');
		expect(result.message).toContain('Nenhum agendamento');
		expect(result.data).toBeUndefined();
	});

	it('propaga erro do service', async () => {
		const agendaService = {
			consultarAgenda: vi.fn().mockRejectedValue(new Error('DB error')),
		};
		const tool = createConsultAgendaTool({ agendaService });

		await expect(
			tool.execute({ de: new Date(), ate: new Date() }),
		).rejects.toThrow('DB error');
	});
});
