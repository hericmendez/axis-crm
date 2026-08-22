const MIN_DIGITS = 10;
const MAX_DIGITS = 15;

export function normalizeTelefone(telefone: string): string {
	const digits = telefone.replace(/\D/g, '');
	if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) {
		throw new RangeError(`Telefone inválido: ${digits.length} dígitos`);
	}
	return digits;
}
