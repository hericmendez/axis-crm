import { describe, expect, it } from 'vitest';
import { createLeadSchema, listLeadsQuerySchema, updateLeadSchema } from '../../src/validators/lead.validator.js';

const validPayload = {
	nome: 'João',
	telefone: '(11) 91234-5678',
	contatoOrigem: 'instagram',
};

describe('createLeadSchema', () => {
	it('aceita payload válido e descarta campos desconhecidos', () => {
		const result = createLeadSchema.parse({ ...validPayload, hacker: true });
		expect(result).not.toHaveProperty('hacker');
		expect(result.nome).toBe('João');
	});

	it('rejeita sem telefone', () => {
		const { telefone: _tel, ...semTelefone } = validPayload;
		expect(() => createLeadSchema.parse(semTelefone)).toThrow();
	});

	it('rejeita email inválido', () => {
		expect(() => createLeadSchema.parse({ ...validPayload, email: 'invalido' })).toThrow();
	});

	it('rejeita renda negativa', () => {
		expect(() => createLeadSchema.parse({ ...validPayload, renda: -1 })).toThrow();
	});

	it('status deve ser um valor do enum', () => {
		expect(() => createLeadSchema.parse({ ...validPayload, status: 'OUTRO' })).toThrow();
		expect(createLeadSchema.parse({ ...validPayload, status: 'AGENDADO' }).status).toBe('AGENDADO');
	});
});

describe('updateLeadSchema', () => {
	it('aceita patch parcial', () => {
		const result = updateLeadSchema.parse({ nome: 'Maria' });
		expect(result.nome).toBe('Maria');
	});

	it('rejeita patch vazio', () => {
		expect(() => updateLeadSchema.parse({})).toThrow(/vazio/);
	});
});

describe('listLeadsQuerySchema', () => {
	it('aplica defaults de paginação', () => {
		const result = listLeadsQuerySchema.parse({});
		expect(result.page).toBe(1);
		expect(result.limit).toBe(20);
	});

	it('converte page/limit string em número e valida limites', () => {
		expect(listLeadsQuerySchema.parse({ page: '2', limit: '10' }).page).toBe(2);
		expect(() => listLeadsQuerySchema.parse({ limit: '101' })).toThrow();
		expect(() => listLeadsQuerySchema.parse({ page: '0' })).toThrow();
	});
});
