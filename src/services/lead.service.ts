import type {
	CreateLeadInput,
	Lead,
	LeadStatus,
	PaginatedResult,
	PaginationParams,
	UpdateLeadInput,
} from '../types/lead.js';
import { AppError } from '../utils/errors.js';
import { normalizeTelefone } from '../utils/telefone.js';
import * as leadRepository from '../repositories/lead.repository.js';
import type { LeadListFilter } from '../repositories/lead.repository.js';
import { sheetsProjection } from '../integrations/google/sheets/sheets.projection.js';
import { logger } from '../utils/logger.js';
import { requireTenant } from './tenant.js';

const DUPLICATE_KEY_CODE = 11000;

function isDuplicateKeyError(err: unknown): boolean {
	return (
		typeof err === 'object' &&
		err !== null &&
		'code' in err &&
		(err as { code?: unknown }).code === DUPLICATE_KEY_CODE
	);
}

function withNormalizedTelefone(input: Omit<CreateLeadInput, 'userId'>): Omit<CreateLeadInput, 'userId'> {
	try {
		return { ...input, telefone: normalizeTelefone(input.telefone) };
	} catch {
		throw new AppError(400, 'Telefone inválido');
	}
}

function assertConsistentVenda(status: LeadStatus | undefined, dataConversao?: Date): void {
	if (dataConversao && status !== 'VENDIDO') {
		throw new AppError(422, 'dataConversao só é permitida quando o status é VENDIDO');
	}
}

export async function create(userId: string | undefined, rawInput: Omit<CreateLeadInput, 'userId'>): Promise<Lead> {
	const tenant = requireTenant(userId);
	const input = withNormalizedTelefone(rawInput);
	assertConsistentVenda(input.status, input.dataConversao);

	const finalInput: Omit<CreateLeadInput, 'userId'> =
		input.status === 'VENDIDO' && !input.dataConversao
			? { ...input, dataConversao: new Date() }
			: input;

	const existing = await leadRepository.findByTelefone(tenant, finalInput.telefone);
	if (existing) {
		throw new AppError(409, 'Já existe um lead com este telefone');
	}

	let lead: Lead;
	try {
		lead = await leadRepository.create({ ...finalInput, userId: tenant });
	} catch (err) {
		if (isDuplicateKeyError(err)) {
			throw new AppError(409, 'Já existe um lead com este telefone');
		}
		throw err;
	}

	try {
		await sheetsProjection({ userId: tenant, lead });
	} catch (err) {
		logger.error(
			{ err, leadId: lead.id, userId: tenant, operation: 'sheetsProjection' },
			'Sheets projection failed, domain result preserved',
		);
	}

	return lead;
}

export async function getById(userId: string | undefined, id: string): Promise<Lead> {
	const tenant = requireTenant(userId);
	const lead = await leadRepository.findById(tenant, id);
	if (!lead) {
		throw new AppError(404, 'Lead não encontrado');
	}
	return lead;
}

export async function list(
	userId: string | undefined,
	filter: LeadListFilter,
	pagination: PaginationParams,
): Promise<PaginatedResult<Lead>> {
	const tenant = requireTenant(userId);
	return leadRepository.find(tenant, filter, pagination);
}

export async function update(
	userId: string | undefined,
	id: string,
	patch: UpdateLeadInput,
): Promise<Lead> {
	const tenant = requireTenant(userId);
	const existing = await getById(tenant, id);
	const effectiveStatus = patch.status ?? existing.status;

	if (patch.dataConversao && effectiveStatus !== 'VENDIDO') {
		throw new AppError(422, 'dataConversao só é permitida quando o status é VENDIDO');
	}

	const finalPatch: UpdateLeadInput = { ...patch };
	if (
		effectiveStatus === 'VENDIDO' &&
		finalPatch.dataConversao === undefined &&
		existing.dataConversao === undefined
	) {
		finalPatch.dataConversao = new Date();
	}

	const updated = await leadRepository.updateById(
		tenant,
		id,
		{ ...finalPatch, ultimaInteracao: new Date() },
	);
	if (!updated) {
		throw new AppError(404, 'Lead não encontrado');
	}

	try {
		await sheetsProjection({ userId: tenant, lead: updated });
	} catch (err) {
		logger.error(
			{ err, leadId: updated.id, userId: tenant, operation: 'sheetsProjection' },
			'Sheets projection failed, domain result preserved',
		);
	}

	return updated;
}

export async function remove(userId: string | undefined, id: string): Promise<void> {
	const tenant = requireTenant(userId);
	const deleted = await leadRepository.deleteById(tenant, id);
	if (!deleted) {
		throw new AppError(404, 'Lead não encontrado');
	}
}
