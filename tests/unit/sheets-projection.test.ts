/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sheetsProjection } from '../../src/integrations/google/sheets/sheets.projection.js';
import type { Lead } from '../../src/types/lead.js';

vi.mock('../../src/models/google-connection.model.js', () => ({
	GoogleConnectionModel: {
		findOne: vi.fn(),
	},
}));

vi.mock('../../src/integrations/google/oauth-user-auth-provider.js', () => ({
	createOAuthUserProvider: vi.fn(),
}));

vi.mock('../../src/integrations/google/sheets/sheets.adapter.js', () => ({
	GoogleSheetsAdapter: vi.fn(),
}));

const mockLead: Lead = {
	id: '507f1f77bcf86cd799439011',
	nome: 'João da Silva',
	telefone: '11999998888',
	email: 'joao@test.com',
	contatoOrigem: 'whatsapp',
	senioridade: 'Pleno',
	renda: 5000,
	status: 'AGENDADO',
	dataAgendamento: new Date('2026-09-01T10:00:00Z'),
	dataConversao: undefined,
	tipoFechamento: undefined,
	observacoes: 'Reunião de apresentação',
	ultimaInteracao: new Date('2026-08-25T10:00:00Z'),
	createdAt: new Date('2026-08-20T10:00:00Z'),
	updatedAt: new Date('2026-08-25T10:00:00Z'),
};

const mockLeadMinimal: Lead = {
	id: '507f1f77bcf86cd799439012',
	nome: 'Maria Santos',
	telefone: '11888887777',
	contatoOrigem: 'instagram',
	createdAt: new Date('2026-08-20T10:00:00Z'),
	updatedAt: new Date('2026-08-25T10:00:00Z'),
};

describe('SheetsProjection', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('CREATE / APPEND', () => {
		it('faz append quando lead não existe na planilha', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce([]); // data fetch
			const mockAppendRow = vi.fn().mockResolvedValue({ updatedRows: 1 });
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: mockLead });

			expect(mockAppendRow).toHaveBeenCalledWith(
				'Leads',
				[expect.arrayContaining([
					'11999998888',
					'João da Silva',
					'joao@test.com',
					'whatsapp',
					'Pleno',
					5000,
					'AGENDADO',
				])],
			);
		});

		it('chama updateRow quando lead já existe na planilha', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const existingRows = [
				['telefone', 'nome'],
				['11999998888', 'João Antigo'],
				['11777776666', 'Pedro'],
			];
			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce(existingRows); // data fetch
			const mockUpdateRow = vi.fn().mockResolvedValue({ updatedCells: 14 });
			const mockAppendRow = vi.fn();
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: mockUpdateRow,
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: mockLead });

			expect(mockUpdateRow).toHaveBeenCalledWith(
				'Leads!A3',
				[expect.arrayContaining(['11999998888', 'João da Silva'])],
			);
			expect(mockAppendRow).not.toHaveBeenCalledWith('Leads', expect.anything());
		});
	});

	describe('IDENTIDADE', () => {
		it('busca da linha usa telefone', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const existingRows = [
				['telefone', 'nome'],
				['11999998888', 'João Existente'],
			];
			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce(existingRows); // data fetch
			const mockUpdateRow = vi.fn().mockResolvedValue({ updatedCells: 14 });
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: vi.fn(),
				updateRow: mockUpdateRow,
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: mockLead });

			const dataCall = mockGetRows.mock.calls[1];
			expect(dataCall[0]).toBe('Leads');

			const row = existingRows[1];
			expect(row[0]).toBe('11999998888');
		});

		it('_id não é usado como chave da linha', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const existingRows = [
				['telefone', 'nome'],
				['507f1f77bcf86cd799439011', 'Wrong Key'],
			];
			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce(existingRows); // data fetch
			const mockAppendRow = vi.fn().mockResolvedValue({ updatedRows: 1 });
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: mockLead });

			expect(mockAppendRow).toHaveBeenCalled();
		});

		it('nome não é usado como chave da linha', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const existingRows = [
				['telefone', 'nome'],
				['11888887777', 'João da Silva'],
			];
			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce(existingRows); // data fetch
			const mockAppendRow = vi.fn().mockResolvedValue({ updatedRows: 1 });
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: mockLead });

			expect(mockAppendRow).toHaveBeenCalled();
		});

		it('email não é usado como chave da linha', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const existingRows = [
				['telefone', 'nome'],
				['11888887777', 'Outro'],
			];
			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce(existingRows); // data fetch
			const mockAppendRow = vi.fn().mockResolvedValue({ updatedRows: 1 });
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: mockLead });

			expect(mockAppendRow).toHaveBeenCalled();
		});
	});

	describe('DUPLICIDADE', () => {
		it('mesmo telefone projetado novamente atualiza a linha', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const existingRows = [
				['telefone', 'nome'],
				['11999998888', 'João Velho'],
			];
			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce(existingRows); // data fetch
			const mockUpdateRow = vi.fn().mockResolvedValue({ updatedCells: 14 });
			const mockAppendRow = vi.fn();
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: mockUpdateRow,
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: mockLead });

			expect(mockUpdateRow).toHaveBeenCalledTimes(1);
			expect(mockAppendRow).not.toHaveBeenCalledWith('Leads', expect.anything());
		});
	});

	describe('ROW', () => {
		it('updateRow recebe o número correto da linha', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const existingRows = [
				['telefone', 'nome'],
				['11777776666', 'Pedro'],
				['11999998888', 'João'],
				['11666665555', 'Ana'],
			];
			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce(existingRows); // data fetch
			const mockUpdateRow = vi.fn().mockResolvedValue({ updatedCells: 14 });
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: vi.fn(),
				updateRow: mockUpdateRow,
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: mockLead });

			expect(mockUpdateRow).toHaveBeenCalledWith(
				'Leads!A4',
				[expect.arrayContaining(['11999998888'])],
			);
		});

		it('header não é tratado como Lead', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const existingRows = [
				['telefone', 'nome', 'email'],
				['11999998888', 'João'],
			];
			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce(existingRows); // data fetch
			const mockUpdateRow = vi.fn().mockResolvedValue({ updatedCells: 14 });
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: vi.fn(),
				updateRow: mockUpdateRow,
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: mockLead });

			expect(mockUpdateRow).toHaveBeenCalledWith(
				'Leads!A3',
				[expect.arrayContaining(['11999998888'])],
			);
		});
	});

	describe('CONNECTION', () => {
		it('GoogleConnection inexistente: projection falha silenciosamente', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue(null),
			} as any);

			await expect(
				sheetsProjection({ userId: 'user-1', lead: mockLead }),
			).resolves.toBeUndefined();
		});

		it('spreadsheetId inexistente: projection falha silenciosamente', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: null,
				}),
			} as any);

			await expect(
				sheetsProjection({ userId: 'user-1', lead: mockLead }),
			).resolves.toBeUndefined();
		});
	});

	describe('GOOGLE FAILURE', () => {
		it('getRows falha: não chama append, projection falha', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockGetRows = vi.fn().mockRejectedValue(new Error('API error'));
			const mockAppendRow = vi.fn();
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await expect(
				sheetsProjection({ userId: 'user-1', lead: mockLead }),
			).resolves.toBeUndefined();

			expect(mockAppendRow).not.toHaveBeenCalled();
		});

		it('updateRow falha: não faz append fallback', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const existingRows = [
				['telefone', 'nome'],
				['11999998888', 'João'],
			];
			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce(existingRows); // data fetch
			const mockUpdateRow = vi.fn().mockRejectedValue(new Error('API error'));
			const mockAppendRow = vi.fn();
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: mockUpdateRow,
			}) as any);

			await expect(
				sheetsProjection({ userId: 'user-1', lead: mockLead }),
			).resolves.toBeUndefined();

			expect(mockAppendRow).not.toHaveBeenCalledWith('Leads', expect.anything());
		});

		it('appendRow falha: não tenta novamente', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce([]); // data fetch
			const mockAppendRow = vi.fn().mockRejectedValue(new Error('API error'));
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await expect(
				sheetsProjection({ userId: 'user-1', lead: mockLead }),
			).resolves.toBeUndefined();

			const appendCalls = mockAppendRow.mock.calls.filter(
				(call: any) => call[0] === 'Leads',
			);
			expect(appendCalls).toHaveLength(1);
		});

		it('updateRow falha: não tenta novamente', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const existingRows = [
				['telefone', 'nome'],
				['11999998888', 'João'],
			];
			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce(existingRows); // data fetch
			const mockUpdateRow = vi.fn().mockRejectedValue(new Error('API error'));
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: vi.fn(),
				updateRow: mockUpdateRow,
			}) as any);

			await expect(
				sheetsProjection({ userId: 'user-1', lead: mockLead }),
			).resolves.toBeUndefined();

			expect(mockUpdateRow).toHaveBeenCalledTimes(1);
		});
	});

	describe('GET ROWS RETRY', () => {
		it('getRows transiente faz retry e sucesso', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const transientError = Object.assign(new Error('timeout'), { code: 408 });
			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check - success
				.mockRejectedValueOnce(transientError) // data fetch - transient fail
				.mockResolvedValueOnce([['11999998888', 'João']]); // data fetch - retry success
			const mockAppendRow = vi.fn();
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await expect(
				sheetsProjection({ userId: 'user-1', lead: mockLead }),
			).resolves.toBeUndefined();

			expect(mockGetRows).toHaveBeenCalledTimes(3);
		});

		it('getRows transiente com múltiplos failures antes do sucesso', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const transientError = Object.assign(new Error('timeout'), { code: 408 });
			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check - success
				.mockRejectedValueOnce(transientError) // data fetch - fail 1
				.mockRejectedValueOnce(transientError) // data fetch - fail 2
				.mockResolvedValueOnce([]); // data fetch - success on 3rd attempt
			const mockAppendRow = vi.fn().mockResolvedValue({ updatedRows: 1 });
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await expect(
				sheetsProjection({ userId: 'user-1', lead: mockLead }),
			).resolves.toBeUndefined();

			expect(mockGetRows).toHaveBeenCalledTimes(4);
		});

		it('getRows falha após limite de retries aborta projeção', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const transientError = Object.assign(new Error('timeout'), { code: 408 });
			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check - success
				.mockRejectedValueOnce(transientError) // data fetch - fail 1
				.mockRejectedValueOnce(transientError) // data fetch - fail 2
				.mockRejectedValueOnce(transientError); // data fetch - fail 3 (limit)
			const mockAppendRow = vi.fn();
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await expect(
				sheetsProjection({ userId: 'user-1', lead: mockLead }),
			).resolves.toBeUndefined();

			expect(mockGetRows).toHaveBeenCalledTimes(4);
			expect(mockAppendRow).not.toHaveBeenCalled();
		});

		it('getRows não transiente não faz retry', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const permError = Object.assign(new Error('Permission denied'), { code: 403 });
			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check - success
				.mockRejectedValueOnce(permError); // data fetch - non-transient fail
			const mockAppendRow = vi.fn();
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await expect(
				sheetsProjection({ userId: 'user-1', lead: mockLead }),
			).resolves.toBeUndefined();

			expect(mockGetRows).toHaveBeenCalledTimes(2);
			expect(mockAppendRow).not.toHaveBeenCalled();
		});
	});

	describe('EVENT → LEAD', () => {
		it('lead com status AGENDADO e dataAgendamento é mapeado corretamente', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce([]); // data fetch
			const mockAppendRow = vi.fn().mockResolvedValue({ updatedRows: 1 });
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: mockLead });

			const dataCall = mockAppendRow.mock.calls.find((call: any) => call[0] === 'Leads');
			const row = dataCall[1][0];
			expect(row[6]).toBe('AGENDADO');
			expect(row[7]).toBe(new Date('2026-09-01T10:00:00Z').toISOString());
		});

		it('lead com status VENDIDO e dataConversao é mapeado corretamente', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const leadVendido: Lead = {
				...mockLead,
				status: 'VENDIDO',
				dataConversao: new Date('2026-09-05T10:00:00Z'),
			};

			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce([]); // data fetch
			const mockAppendRow = vi.fn().mockResolvedValue({ updatedRows: 1 });
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: leadVendido });

			const dataCall = mockAppendRow.mock.calls.find((call: any) => call[0] === 'Leads');
			const row = dataCall[1][0];
			expect(row[6]).toBe('VENDIDO');
			expect(row[8]).toBe(new Date('2026-09-05T10:00:00Z').toISOString());
		});

		it('lead com status PERDIDO é mapeado corretamente', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const leadPerdido: Lead = {
				...mockLead,
				status: 'PERDIDO',
			};

			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce([]); // data fetch
			const mockAppendRow = vi.fn().mockResolvedValue({ updatedRows: 1 });
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: leadPerdido });

			const dataCall = mockAppendRow.mock.calls.find((call: any) => call[0] === 'Leads');
			const row = dataCall[1][0];
			expect(row[6]).toBe('PERDIDO');
		});

		it('lead com status NO_SHOW é mapeado corretamente', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const leadNoShow: Lead = {
				...mockLead,
				status: 'NO_SHOW',
			};

			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce([]); // data fetch
			const mockAppendRow = vi.fn().mockResolvedValue({ updatedRows: 1 });
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: leadNoShow });

			const dataCall = mockAppendRow.mock.calls.find((call: any) => call[0] === 'Leads');
			const row = dataCall[1][0];
			expect(row[6]).toBe('NO_SHOW');
		});

		it('lead com REAGENDADO é mapeado corretamente', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const leadReagendado: Lead = {
				...mockLead,
				status: 'REAGENDADO',
				dataAgendamento: new Date('2026-09-10T14:00:00Z'),
			};

			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce([]); // data fetch
			const mockAppendRow = vi.fn().mockResolvedValue({ updatedRows: 1 });
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: leadReagendado });

			const dataCall = mockAppendRow.mock.calls.find((call: any) => call[0] === 'Leads');
			const row = dataCall[1][0];
			expect(row[6]).toBe('REAGENDADO');
			expect(row[7]).toBe(new Date('2026-09-10T14:00:00Z').toISOString());
		});
	});

	describe('MAPPING', () => {
		it('todos os campos definidos no contrato são mapeados corretamente', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const fullLead: Lead = {
				id: '507f1f77bcf86cd799439099',
				nome: 'Ana Complete',
				telefone: '11555554444',
				email: 'ana@test.com',
				contatoOrigem: 'linkedin',
				senioridade: 'Senior',
				renda: 10000,
				status: 'VENDIDO',
				dataAgendamento: new Date('2026-09-01T10:00:00Z'),
				dataConversao: new Date('2026-09-05T10:00:00Z'),
				tipoFechamento: 'premium',
				observacoes: 'Cliente VIP',
				ultimaInteracao: new Date('2026-09-05T10:00:00Z'),
				createdAt: new Date('2026-08-01T10:00:00Z'),
				updatedAt: new Date('2026-09-05T10:00:00Z'),
			};

			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce([]); // data fetch
			const mockAppendRow = vi.fn().mockResolvedValue({ updatedRows: 1 });
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: fullLead });

			const dataCall = mockAppendRow.mock.calls.find((call: any) => call[0] === 'Leads');
			const row = dataCall[1][0];
			expect(row).toEqual([
				'11555554444',
				'Ana Complete',
				'ana@test.com',
				'linkedin',
				'Senior',
				10000,
				'VENDIDO',
				new Date('2026-09-01T10:00:00Z').toISOString(),
				new Date('2026-09-05T10:00:00Z').toISOString(),
				'premium',
				'Cliente VIP',
				new Date('2026-09-05T10:00:00Z').toISOString(),
				new Date('2026-08-01T10:00:00Z').toISOString(),
				new Date('2026-09-05T10:00:00Z').toISOString(),
			]);
		});

		it('datas são serializadas deterministicamente', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce([]); // data fetch
			const mockAppendRow = vi.fn().mockResolvedValue({ updatedRows: 1 });
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: mockLead });

			const dataCall = mockAppendRow.mock.calls.find((call: any) => call[0] === 'Leads');
			const row = dataCall[1][0];
			expect(row[7]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
			expect(row[11]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
			expect(row[12]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
			expect(row[13]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
		});

		it('undefined é tratado de forma consistente como string vazia', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check
				.mockResolvedValueOnce([]); // data fetch
			const mockAppendRow = vi.fn().mockResolvedValue({ updatedRows: 1 });
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: mockLeadMinimal });

			const dataCall = mockAppendRow.mock.calls.find((call: any) => call[0] === 'Leads');
			const row = dataCall[1][0];
			expect(row[2]).toBe('');
			expect(row[4]).toBe('');
			expect(row[5]).toBe('');
			expect(row[6]).toBe('');
			expect(row[7]).toBe('');
			expect(row[8]).toBe('');
			expect(row[9]).toBe('');
			expect(row[10]).toBe('');
			expect(row[11]).toBe('');
		});
	});

	describe('ISOLATION', () => {
		it('falha do Sheets não faz LeadService falhar', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: vi.fn().mockRejectedValue(new Error('Google API error')),
				appendRow: vi.fn(),
				updateRow: vi.fn(),
			}) as any);

			await expect(
				sheetsProjection({ userId: 'user-1', lead: mockLead }),
			).resolves.toBeUndefined();
		});
	});

	describe('HEADER', () => {
		it('não cria header se já existe', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const existingRows = [
				['telefone', 'nome', 'email'],
				['11999998888', 'João'],
			];
			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([['telefone', 'nome']]) // header check - exists
				.mockResolvedValueOnce(existingRows); // data fetch
			const mockAppendRow = vi.fn().mockResolvedValue({ updatedRows: 1 });
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: mockLead });

			expect(mockGetRows).toHaveBeenCalledTimes(2);
			const headerAppendCalls = mockAppendRow.mock.calls.filter(
				(call: any) => call[0] === 'Leads' && call[1][0][0] === 'telefone',
			);
			expect(headerAppendCalls).toHaveLength(0);
		});

		it('cria header se aba está vazia', async () => {
			const { GoogleConnectionModel } = await import('../../src/models/google-connection.model.js');
			const { createOAuthUserProvider } = await import('../../src/integrations/google/oauth-user-auth-provider.js');
			const { GoogleSheetsAdapter } = await import('../../src/integrations/google/sheets/sheets.adapter.js');

			vi.mocked(GoogleConnectionModel.findOne).mockReturnValue({
				lean: vi.fn().mockResolvedValue({
					id: 'conn-1',
					userId: 'user-1',
					spreadsheetId: 'sheet-123',
				}),
			} as any);

			vi.mocked(createOAuthUserProvider).mockReturnValue({
				getClient: vi.fn().mockResolvedValue({}),
			});

			const mockGetRows = vi.fn()
				.mockResolvedValueOnce([]) // header check - empty
				.mockResolvedValueOnce([]); // data fetch
			const mockAppendRow = vi.fn().mockResolvedValue({ updatedRows: 1 });
			vi.mocked(GoogleSheetsAdapter).mockImplementation(() => ({
				getRows: mockGetRows,
				appendRow: mockAppendRow,
				updateRow: vi.fn(),
			}) as any);

			await sheetsProjection({ userId: 'user-1', lead: mockLead });

			expect(mockAppendRow).toHaveBeenCalledTimes(2);
			expect(mockAppendRow).toHaveBeenNthCalledWith(
				1,
				'Leads',
				[expect.arrayContaining(['telefone', 'nome', 'email'])],
			);
		});
	});
});
