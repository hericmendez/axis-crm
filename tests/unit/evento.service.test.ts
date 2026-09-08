import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as eventoService from '../../src/services/evento.service.js';
import * as leadRepository from '../../src/repositories/lead.repository.js';
import * as eventoRepository from '../../src/repositories/evento.repository.js';

vi.mock('../../src/repositories/lead.repository.js', () => ({
	findById: vi.fn(),
	updateById: vi.fn(),
}));

vi.mock('../../src/repositories/evento.repository.js', () => ({
	create: vi.fn(),
	deleteById: vi.fn(),
	findByLeadId: vi.fn(),
	findLastActiveForLead: vi.fn(),
	findById: vi.fn(),
	updateGoogleEventId: vi.fn(),
}));

vi.mock('../../src/integrations/google/calendar/calendar.projection.js', () => ({
	calendarProjection: vi.fn(),
}));

vi.mock('../../src/integrations/google/sheets/sheets.projection.js', () => ({
	sheetsProjection: vi.fn(),
}));

const mockLead = {
	id: '507f1f77bcf86cd799439011',
	nome: 'João',
	telefone: '11999998888',
	contatoOrigem: 'whatsapp',
	createdAt: new Date(),
};

const mockAgendamento = {
	id: '507f1f77bcf86cd799439012',
	leadId: mockLead.id,
	tipo: 'AGENDAMENTO' as const,
	data: new Date('2026-09-01T10:00:00Z'),
	createdAt: new Date('2026-08-25T10:00:00Z'),
};

const mockReagendamento = {
	id: '507f1f77bcf86cd799439013',
	leadId: mockLead.id,
	tipo: 'REAGENDAMENTO' as const,
	data: new Date('2026-09-02T10:00:00Z'),
	previousEventoId: mockAgendamento.id,
	createdAt: new Date('2026-08-26T10:00:00Z'),
};

describe('EventoService.create', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('cria AGENDAMENTO sem previousEventoId', async () => {
		vi.mocked(leadRepository.findById).mockResolvedValue(mockLead);
		vi.mocked(eventoRepository.create).mockResolvedValue(mockAgendamento);
		vi.mocked(leadRepository.updateById).mockResolvedValue(mockLead);

		const result = await eventoService.create({
			leadId: mockLead.id,
			tipo: 'AGENDAMENTO',
			data: new Date('2026-09-01T10:00:00Z'),
		});

		expect(result.tipo).toBe('AGENDAMENTO');
		expect(result.previousEventoId).toBeUndefined();
		expect(eventoRepository.create).toHaveBeenCalledWith(
			expect.objectContaining({
				leadId: mockLead.id,
				tipo: 'AGENDAMENTO',
			}),
		);
	});

	it('cria VENDA sem previousEventoId', async () => {
		const mockVenda = { ...mockAgendamento, tipo: 'VENDA' as const };
		vi.mocked(leadRepository.findById).mockResolvedValue(mockLead);
		vi.mocked(eventoRepository.create).mockResolvedValue(mockVenda);
		vi.mocked(leadRepository.updateById).mockResolvedValue(mockLead);

		const result = await eventoService.create({
			leadId: mockLead.id,
			tipo: 'VENDA',
		});

		expect(result.tipo).toBe('VENDA');
		expect(result.previousEventoId).toBeUndefined();
	});

	it('cria REAGENDAMENTO com previousEventoId do AGENDAMENTO ativo', async () => {
		vi.mocked(leadRepository.findById).mockResolvedValue(mockLead);
		vi.mocked(eventoRepository.findLastActiveForLead).mockResolvedValue(mockAgendamento);
		vi.mocked(eventoRepository.create).mockResolvedValue(mockReagendamento);
		vi.mocked(leadRepository.updateById).mockResolvedValue(mockLead);

		const result = await eventoService.create({
			leadId: mockLead.id,
			tipo: 'REAGENDAMENTO',
			data: new Date('2026-09-02T10:00:00Z'),
		});

		expect(result.tipo).toBe('REAGENDAMENTO');
		expect(result.previousEventoId).toBe(mockAgendamento.id);
		expect(eventoRepository.findLastActiveForLead).toHaveBeenCalledWith(mockLead.id);
	});

	it('cria REAGENDAMENTO em cadeia com previousEventoId correto', async () => {
		vi.mocked(leadRepository.findById).mockResolvedValue(mockLead);
		vi.mocked(eventoRepository.findLastActiveForLead).mockResolvedValue(mockReagendamento);
		vi.mocked(eventoRepository.create).mockResolvedValue({
			...mockReagendamento,
			id: '507f1f77bcf86cd799439014',
			tipo: 'REAGENDAMENTO' as const,
			previousEventoId: mockReagendamento.id,
		});
		vi.mocked(leadRepository.updateById).mockResolvedValue(mockLead);

		const result = await eventoService.create({
			leadId: mockLead.id,
			tipo: 'REAGENDAMENTO',
			data: new Date('2026-09-03T10:00:00Z'),
		});

		expect(result.tipo).toBe('REAGENDAMENTO');
		expect(result.previousEventoId).toBe(mockReagendamento.id);
	});

	it('cria DESISTENCIA com previousEventoId', async () => {
		vi.mocked(leadRepository.findById).mockResolvedValue(mockLead);
		vi.mocked(eventoRepository.findLastActiveForLead).mockResolvedValue(mockAgendamento);
		const mockDesistencia = {
			...mockAgendamento,
			id: '507f1f77bcf86cd799439016',
			tipo: 'DESISTENCIA' as const,
			previousEventoId: mockAgendamento.id,
		};
		vi.mocked(eventoRepository.create).mockResolvedValue(mockDesistencia);
		vi.mocked(leadRepository.updateById).mockResolvedValue(mockLead);

		const result = await eventoService.create({
			leadId: mockLead.id,
			tipo: 'DESISTENCIA',
		});

		expect(result.tipo).toBe('DESISTENCIA');
		expect(result.previousEventoId).toBe(mockAgendamento.id);
	});

	it('cria NO_SHOW com previousEventoId', async () => {
		vi.mocked(leadRepository.findById).mockResolvedValue(mockLead);
		vi.mocked(eventoRepository.findLastActiveForLead).mockResolvedValue(mockAgendamento);
		const mockNoShow = {
			...mockAgendamento,
			id: '507f1f77bcf86cd799439017',
			tipo: 'NO_SHOW' as const,
			previousEventoId: mockAgendamento.id,
		};
		vi.mocked(eventoRepository.create).mockResolvedValue(mockNoShow);
		vi.mocked(leadRepository.updateById).mockResolvedValue(mockLead);

		const result = await eventoService.create({
			leadId: mockLead.id,
			tipo: 'NO_SHOW',
		});

		expect(result.tipo).toBe('NO_SHOW');
		expect(result.previousEventoId).toBe(mockAgendamento.id);
	});

	it('lança erro quando REAGENDAMENTO não tem appointment ativo', async () => {
		vi.mocked(leadRepository.findById).mockResolvedValue(mockLead);
		vi.mocked(eventoRepository.findLastActiveForLead).mockResolvedValue(null);

		await expect(
			eventoService.create({
				leadId: mockLead.id,
				tipo: 'REAGENDAMENTO',
				data: new Date('2026-09-02T10:00:00Z'),
			}),
		).rejects.toThrow('Não há agendamento ativo para este lead');
	});

	it('lança erro quando DESISTENCIA não tem appointment ativo', async () => {
		vi.mocked(leadRepository.findById).mockResolvedValue(mockLead);
		vi.mocked(eventoRepository.findLastActiveForLead).mockResolvedValue(null);

		await expect(
			eventoService.create({
				leadId: mockLead.id,
				tipo: 'DESISTENCIA',
			}),
		).rejects.toThrow('Não há agendamento ativo para este lead');
	});

	it('lança erro quando NO_SHOW não tem appointment ativo', async () => {
		vi.mocked(leadRepository.findById).mockResolvedValue(mockLead);
		vi.mocked(eventoRepository.findLastActiveForLead).mockResolvedValue(null);

		await expect(
			eventoService.create({
				leadId: mockLead.id,
				tipo: 'NO_SHOW',
			}),
		).rejects.toThrow('Não há agendamento ativo para este lead');
	});

	it('lança erro quando lead não existe', async () => {
		vi.mocked(leadRepository.findById).mockResolvedValue(null);

		await expect(
			eventoService.create({
				leadId: '507f1f77bcf86cd799439099',
				tipo: 'AGENDAMENTO',
			}),
		).rejects.toThrow('Lead não encontrado');
	});

	it('compensa quando falha ao atualizar lead', async () => {
		vi.mocked(leadRepository.findById).mockResolvedValue(mockLead);
		vi.mocked(eventoRepository.create).mockResolvedValue(mockAgendamento);
		vi.mocked(leadRepository.updateById).mockResolvedValue(null);
		vi.mocked(eventoRepository.deleteById).mockResolvedValue(true);

		await expect(
			eventoService.create({
				leadId: mockLead.id,
				tipo: 'AGENDAMENTO',
				data: new Date('2026-09-01T10:00:00Z'),
			}),
		).rejects.toThrow('Falha ao aplicar efeitos do evento no lead');

		expect(eventoRepository.deleteById).toHaveBeenCalledWith(mockAgendamento.id);
	});

	it('resolução de predecessor não usa data > now', async () => {
		const pastAgendamento = {
			...mockAgendamento,
			data: new Date('2020-01-01T10:00:00Z'),
			createdAt: new Date('2019-12-25T10:00:00Z'),
		};

		vi.mocked(leadRepository.findById).mockResolvedValue(mockLead);
		vi.mocked(eventoRepository.findLastActiveForLead).mockResolvedValue(pastAgendamento);
		vi.mocked(eventoRepository.create).mockResolvedValue({
			...pastAgendamento,
			id: '507f1f77bcf86cd799439015',
			tipo: 'REAGENDAMENTO' as const,
			previousEventoId: pastAgendamento.id,
		});
		vi.mocked(leadRepository.updateById).mockResolvedValue(mockLead);

		const result = await eventoService.create({
			leadId: mockLead.id,
			tipo: 'REAGENDAMENTO',
			data: new Date('2026-09-02T10:00:00Z'),
		});

		expect(result.previousEventoId).toBe(pastAgendamento.id);
	});

	it('chama calendarProjection após sucesso do MongoDB', async () => {
		const { calendarProjection } = await import('../../src/integrations/google/calendar/calendar.projection.js');

		vi.mocked(leadRepository.findById).mockResolvedValue(mockLead);
		vi.mocked(eventoRepository.create).mockResolvedValue(mockAgendamento);
		vi.mocked(leadRepository.updateById).mockResolvedValue(mockLead);
		vi.mocked(eventoRepository.findById).mockResolvedValue(null);

		await eventoService.create({
			leadId: mockLead.id,
			tipo: 'AGENDAMENTO',
			data: new Date('2026-09-01T10:00:00Z'),
			userId: 'user-1',
		});

		expect(calendarProjection).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				evento: mockAgendamento,
				lead: mockLead,
			}),
		);
	});

	it('falha da projection não impede retorno do Evento', async () => {
		const { calendarProjection } = await import('../../src/integrations/google/calendar/calendar.projection.js');

		vi.mocked(leadRepository.findById).mockResolvedValue(mockLead);
		vi.mocked(eventoRepository.create).mockResolvedValue(mockAgendamento);
		vi.mocked(leadRepository.updateById).mockResolvedValue(mockLead);
		vi.mocked(calendarProjection).mockRejectedValue(new Error('Google API error'));

		const result = await eventoService.create({
			leadId: mockLead.id,
			tipo: 'AGENDAMENTO',
			data: new Date('2026-09-01T10:00:00Z'),
		});

		expect(result).toEqual(mockAgendamento);
	});

	it('lead update falha e projection NÃO é chamada', async () => {
		const { calendarProjection } = await import('../../src/integrations/google/calendar/calendar.projection.js');

		vi.mocked(leadRepository.findById).mockResolvedValue(mockLead);
		vi.mocked(eventoRepository.create).mockResolvedValue(mockAgendamento);
		vi.mocked(leadRepository.updateById).mockResolvedValue(null);
		vi.mocked(eventoRepository.deleteById).mockResolvedValue(true);

		await expect(
			eventoService.create({
				leadId: mockLead.id,
				tipo: 'AGENDAMENTO',
				data: new Date('2026-09-01T10:00:00Z'),
			}),
		).rejects.toThrow('Falha ao aplicar efeitos do evento no lead');

		expect(calendarProjection).not.toHaveBeenCalled();
	});
});

describe('EventoRepository.updateGoogleEventId', () => {
	it('chama updateGoogleEventId com parâmetros corretos', async () => {
		vi.mocked(eventoRepository.updateGoogleEventId).mockResolvedValue(true);

		const result = await eventoRepository.updateGoogleEventId('507f1f77bcf86cd799439012', 'google-event-123');

		expect(eventoRepository.updateGoogleEventId).toHaveBeenCalledWith(
			'507f1f77bcf86cd799439012',
			'google-event-123',
		);
		expect(result).toBe(true);
	});

	it('retorna false para ID inválido', async () => {
		vi.mocked(eventoRepository.updateGoogleEventId).mockResolvedValue(false);

		const result = await eventoRepository.updateGoogleEventId('invalid-id', 'google-event-123');
		expect(result).toBe(false);
	});
});
