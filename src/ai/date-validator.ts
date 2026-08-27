export interface DateValidationOk {
	valid: true;
	date: Date;
	hadTime: boolean;
	year: number;
	month: number;
	day: number;
	hours: number;
	minutes: number;
}

export interface DateValidationInvalid {
	valid: false;
	code: 'INVALID_DATE' | 'INVALID_TIME' | 'PAST_DATE';
	field?: string;
	message: string;
}

export type DateValidation = DateValidationOk | DateValidationInvalid;

const MESES_MAX_DIAS: Record<number, number> = {
	1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30,
	7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31,
};

function isLeapYear(year: number): boolean {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function maxDaysInMonth(year: number, month: number): number {
	if (month === 2 && isLeapYear(year)) return 29;
	return MESES_MAX_DIAS[month] ?? 31;
}

const MONTH_NAMES: Record<string, number> = {
	janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4,
	maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9,
	outubro: 10, novembro: 11, dezembro: 12,
};

function parseDateString(raw: string): { year: number; month: number; day: number } | null {
	const iso = raw.match(
		/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[Tt\s]|$)/,
	);
	if (iso) {
		return {
			year: Number.parseInt(iso[1]!, 10),
			month: Number.parseInt(iso[2]!, 10),
			day: Number.parseInt(iso[3]!, 10),
		};
	}

	const br = raw.match(
		/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/,
	);
	if (br) {
		return {
			year: Number.parseInt(br[3]!, 10),
			month: Number.parseInt(br[2]!, 10),
			day: Number.parseInt(br[1]!, 10),
		};
	}

	const rel = raw.match(
		/(?:dia\s+)?(\d{1,2})\s*(?:de\s*)?(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)?\s*(?:de\s*(\d{4}))?/i,
	);
	if (rel?.[1]) {
		const day = Number.parseInt(rel[1], 10);
		const month = rel[2] ? MONTH_NAMES[rel[2].toLowerCase()] : undefined;
		const year = rel[3] ? Number.parseInt(rel[3], 10) : undefined;
		if (month && year) return { year, month, day };
		if (month) return { year: new Date().getFullYear(), month, day };
	}

	return null;
}

function parseTimeString(raw: string): { hours: number; minutes: number } | null {
	const mIso = raw.match(/[Tt\s](\d{1,2}):(\d{2})(?::\d{2})?$/);
	if (mIso?.[1] && mIso?.[2]) {
		return { hours: Number.parseInt(mIso[1], 10), minutes: Number.parseInt(mIso[2], 10) };
	}

	const m14h = raw.match(/(\d{1,2})h(?::?(\d{2}))?(?:\s*(?:da\s*)?(manhã|tarde|noite))?/i);
	if (m14h?.[1]) {
		let hours = Number.parseInt(m14h[1], 10);
		const minutes = m14h[2] ? Number.parseInt(m14h[2], 10) : 0;
		const period = m14h[3]?.toLowerCase();
		if (period === 'tarde' && hours < 12) hours += 12;
		if (period === 'noite' && hours < 18) hours += 12;
		return { hours, minutes };
	}

	const mColon = raw.match(/às?\s*(\d{1,2}):(\d{2})/i);
	if (mColon?.[1] && mColon?.[2]) {
		return { hours: Number.parseInt(mColon[1], 10), minutes: Number.parseInt(mColon[2], 10) };
	}

	const mWord = raw.match(
		/(?:às?\s*)?(uma|duas|três|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezasseis|dezessete|dezassete|dezoito|dezenove|dezanove|vinte)\s*(?:e\s*(\w+)\s*)?(?:da\s*)?(manhã|tarde|noite)?/i,
	);
	if (mWord?.[1]) {
		const numWords: Record<string, number> = {
			uma: 1, duas: 2, 'três': 3, tres: 3, quatro: 4, cinco: 5,
			seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11,
			doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15,
			'dezesseis': 16, 'dezasseis': 16, 'dezessete': 17, 'dezassete': 17,
			dezoito: 18, 'dezenove': 19, 'dezanove': 19, vinte: 20,
		};
		const numWord = mWord[1].toLowerCase();
		let hours = numWords[numWord] ?? 0;
		if (mWord[2]) {
			const unitWords: Record<string, number> = {
				uma: 1, duas: 2, 'três': 3, tres: 3, quatro: 4, cinco: 5,
				seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
			};
			const unit = unitWords[mWord[2].toLowerCase()];
			if (unit) hours = hours * 10 + unit;
		}
		const period = mWord[3]?.toLowerCase();
		if (period === 'tarde' && hours < 12) hours += 12;
		if (period === 'noite' && hours < 18) hours += 12;
		if (period === 'manhã' && hours >= 12) hours -= 12;
		return { hours, minutes: 0 };
	}

	const mManha = raw.match(/(?:de\s*)?manhã/i);
	if (mManha) return { hours: 9, minutes: 0 };

	const mTarde = raw.match(/(?:de\s*)?tarde/i);
	if (mTarde) return { hours: 14, minutes: 0 };

	return null;
}

export function validateTime(hours: number, minutes: number): DateValidationInvalid | null {
	if (hours < 0 || hours > 23 || !Number.isInteger(hours)) {
		return { valid: false, code: 'INVALID_TIME', field: 'time', message: `${hours}h não é um horário válido. O horário deve estar entre 00:00 e 23:59.` };
	}
	if (minutes < 0 || minutes > 59 || !Number.isInteger(minutes)) {
		return { valid: false, code: 'INVALID_TIME', field: 'time', message: `${minutes} minutos não é válido. Os minutos devem estar entre 0 e 59.` };
	}
	return null;
}

export function validateDateComponents(
	year: number,
	month: number,
	day: number,
): DateValidationInvalid | null {
	if (month < 1 || month > 12) {
		return { valid: false, code: 'INVALID_DATE', field: 'date', message: `Mês ${month} não é válido. Os meses vão de 1 a 12.` };
	}
	const maxDay = maxDaysInMonth(year, month);
	if (day < 1 || day > maxDay) {
		const monthNames = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
		return {
			valid: false,
			code: 'INVALID_DATE',
			field: 'date',
			message: `${day} de ${monthNames[month]} não existe. ${monthNames[month]} tem apenas ${maxDay} dias.`,
		};
	}
	return null;
}

export function validateDateString(raw: string): DateValidationInvalid | null {
	const components = parseDateString(raw);
	if (!components) return null;

	const dateValidation = validateDateComponents(components.year, components.month, components.day);
	if (dateValidation) return dateValidation;

	const date = new Date(dateValidation === null ? `${components.year}-${String(components.month).padStart(2, '0')}-${String(components.day).padStart(2, '0')}T00:00:00` : raw);

	const actualYear = date.getFullYear();
	const actualMonth = date.getMonth() + 1;
	const actualDay = date.getDate();

	if (actualYear !== components.year || actualMonth !== components.month || actualDay !== components.day) {
		return {
			valid: false,
			code: 'INVALID_DATE',
			field: 'date',
			message: `${components.day}/${components.month}/${components.year} não é uma data válida.`,
		};
	}

	return null;
}

export function validateDateTime(raw: string): DateValidation {
	const lower = raw.toLowerCase();

	const components = parseDateString(lower);
	if (!components) {
		return { valid: false, code: 'INVALID_DATE', message: 'Não foi possível interpretar a data.' };
	}

	const dateErr = validateDateComponents(components.year, components.month, components.day);
	if (dateErr) return dateErr;

	const time = parseTimeString(lower);
	let hours = 0;
	let minutes = 0;
	let hadTime = false;

	if (time) {
		hadTime = true;
		hours = time.hours;
		minutes = time.minutes;
		const timeErr = validateTime(hours, minutes);
		if (timeErr) return timeErr;
	}

	const date = new Date(components.year, components.month - 1, components.day, hours, minutes, 0, 0);

	const actualYear = date.getFullYear();
	const actualMonth = date.getMonth() + 1;
	const actualDay = date.getDate();
	const actualHours = date.getHours();
	const actualMinutes = date.getMinutes();

	if (actualYear !== components.year || actualMonth !== components.month || actualDay !== components.day) {
		return {
			valid: false,
			code: 'INVALID_DATE',
			field: 'date',
			message: `${components.day}/${components.month}/${components.year} não é uma data válida.`,
		};
	}

	if (hadTime && (actualHours !== hours || actualMinutes !== minutes)) {
		return {
			valid: false,
			code: 'INVALID_TIME',
			field: 'time',
			message: `${hours}h${String(minutes).padStart(2, '0')} não é um horário válido.`,
		};
	}

	return {
		valid: true,
		date,
		hadTime,
		year: actualYear,
		month: actualMonth,
		day: actualDay,
		hours: actualHours,
		minutes: actualMinutes,
	};
}
