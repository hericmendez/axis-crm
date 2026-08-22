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

const DUPLICATE_KEY_CODE = 11000;

function isDuplicateKeyError(err: unknown): boolean {
	return (
		typeof err === 'object' &&
		err !== null &&
		'code' in err &&
		(err as { code?: unknown }).code === DUPLICATE_KEY_CODE
	);
}

function withNormalizedTelefone(input: CreateLeadInput): CreateLeadInput {
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

export async function create(rawInput: CreateLeadInput): Promise<Lead> {
	const input = withNormalizedTelefone(rawInput);
	assertConsistentVenda(input.status, input.dataConversao);

	const finalInput: CreateLeadInput =
		input.status === 'VENDIDO' && !input.dataConversao
			? { ...input, dataConversao: new Date() }
			: input;

	const existing = await leadRepository.findByTelefone(finalInput.telefone);
	if (existing) {
		throw new AppError(409, 'Já existe um lead com este telefone');
	}

	try {
		return await leadRepository.create(finalInput);
	} catch (err) {
		if (isDuplicateKeyError(err)) {
			throw new AppError(409, 'Já existe um lead com este telefone');
		}
		throw err;
	}
}

export async function getById(id: string): Promise<Lead> {
	const lead = await leadRepository.findById(id);
	if (!lead) {
		throw new AppError(404, 'Lead não encontrado');
	}
	return lead;
}

export async function list(
	filter: Partial<Pick<Lead, 'status'>>,
	pagination: PaginationParams,
): Promise<PaginatedResult<Lead>> {
	return leadRepository.find(filter, pagination);
}

export async function update(id: string, patch: UpdateLeadInput): Promise<Lead> {
	const existing = await getById(id);
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
		id,
		{ ...finalPatch, ultimaInteracao: new Date() },
	);
	if (!updated) {
		throw new AppError(404, 'Lead não encontrado');
	}
	return updated;
}

export async function remove(id: string): Promise<void> {
	const deleted = await leadRepository.deleteById(id);
	if (!deleted) {
		throw new AppError(404, 'Lead não encontrado');
	}
}
