const DIAS_SEMANA: Record<string, number> = {
	segunda: 1, 'segunda-feira': 1, seg: 1,
	terça: 2, 'terça-feira': 2, ter: 2,
	quarta: 3, 'quarta-feira': 3, qua: 3,
	quinta: 4, 'quinta-feira': 4, qui: 4,
	sexta: 5, 'sexta-feira': 5, sex: 5,
	sábado: 6, sabado: 6, sab: 6,
	domingo: 0, dom: 0,
};

const PAST_MODIFIERS = ['passada', 'passado', 'anterior', 'que já passou', 'da semana passada', 'da semana que já passou'];
const FUTURE_MODIFIERS = ['próxima', 'proximo', 'que vem'];

function parseTime(text: string): { found: boolean; invalid: boolean; hours: number; minutes: number } {
	const m14h = text.match(/(\d{1,2})h(?::(\d{2}))?(?:\s*(?:da\s*)?(manhã|tarde|noite))?/i);
	if (m14h?.[1]) {
		let hours = Number.parseInt(m14h[1], 10);
		const minutes = m14h[2] ? Number.parseInt(m14h[2], 10) : 0;
		const period = m14h[3]?.toLowerCase();
		if (period === 'tarde' && hours < 12) hours += 12;
		if (period === 'noite' && hours < 18) hours += 12;
		if (hours > 23 || minutes > 59) return { found: true, invalid: true, hours, minutes };
		return { found: true, invalid: false, hours, minutes };
	}

	const mColon = text.match(/às?\s*(\d{1,2}):(\d{2})/i);
	if (mColon?.[1] && mColon?.[2]) {
		const hours = Number.parseInt(mColon[1], 10);
		const minutes = Number.parseInt(mColon[2], 10);
		if (hours > 23 || minutes > 59) return { found: true, invalid: true, hours, minutes };
		return { found: true, invalid: false, hours, minutes };
	}

	const mWord = text.match(
		/às\s+(uma|duas|três|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezasseis|dezessete|dezassete|dezoito|dezenove|dezanove|vinte)\s*(?:e\s*(\w+)\s*)?(?:da\s*)?(manhã|tarde|noite)?/i,
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
		if (hours > 23) return { found: true, invalid: true, hours, minutes: 0 };
		return { found: true, invalid: false, hours, minutes: 0 };
	}

	const mManha = text.match(/às\s*(?:de\s*)?manhã|(?:de\s*)manhã(?=\s|$)/i);
	if (mManha) return { found: true, invalid: false, hours: 9, minutes: 0 };

	const mTarde = text.match(/às\s*(?:de\s*)?tarde|(?:de\s*)tarde(?=\s|$)/i);
	if (mTarde) return { found: true, invalid: false, hours: 14, minutes: 0 };

	return { found: false, invalid: false, hours: 0, minutes: 0 };
}

export interface ParsedDateTime {
	date: Date;
	hadTime: boolean;
	invalidTime: boolean;
}

function findWeekday(text: string): { name: string; dayNum: number } | null {
	for (const [name, dayNum] of Object.entries(DIAS_SEMANA)) {
		if (text.includes(name)) {
			return { name, dayNum };
		}
	}
	return null;
}

function hasPastModifier(text: string, weekdayName: string): boolean {
	const afterWeekday = text.slice(text.indexOf(weekdayName) + weekdayName.length).trimStart();
	return PAST_MODIFIERS.some((m) => afterWeekday.includes(m));
}

function hasFutureModifier(text: string, weekdayName: string): boolean {
	const afterWeekday = text.slice(text.indexOf(weekdayName) + weekdayName.length).trimStart();
	if (afterWeekday.includes('desta semana') || afterWeekday.includes('esta semana') || afterWeekday.includes('mesma semana')) {
		return false;
	}
	return FUTURE_MODIFIERS.some((m) => afterWeekday.includes(m));
}

function calculateWeekday(
	result: Date,
	dayNum: number,
	direction: 'future' | 'past' | 'next',
): void {
	const currentDay = result.getDay();

	if (direction === 'past') {
		let daysBack = currentDay - dayNum;
		if (daysBack <= 0) daysBack += 7;
		result.setDate(result.getDate() - daysBack);
	} else {
		let daysAhead = dayNum - currentDay;
		if (direction === 'future') {
			if (daysAhead <= 0) daysAhead += 7;
		} else {
			if (daysAhead <= 0) daysAhead += 7;
		}
		result.setDate(result.getDate() + daysAhead);
	}
}

export function parseRelativeDateTime(
	text: string,
	now: Date,
): ParsedDateTime | null {
	const lower = text.toLowerCase();
	const result = new Date(now);
	let foundDate = false;
	let hadTime = false;

	if (lower.includes('depois de amanhã') || lower.includes('depois de amanha')) {
		result.setDate(result.getDate() + 2);
		foundDate = true;
	} else if (lower.includes('anteontem')) {
		result.setDate(result.getDate() - 2);
		foundDate = true;
	} else if (lower.includes('ontem')) {
		result.setDate(result.getDate() - 1);
		foundDate = true;
	} else if (lower.includes('amanhã') || lower.includes('amanha')) {
		result.setDate(result.getDate() + 1);
		foundDate = true;
	}

	const isSemanaPassada = lower.includes('semana passada') || lower.includes('semana que já passou');
	const isProximaSemana = lower.includes('próxima semana') || lower.includes('proximo semana') || lower.includes('semana que vem');

	if (!foundDate) {
		const weekday = findWeekday(lower);
		if (weekday) {
			const isPast = hasPastModifier(lower, weekday.name);
			const isFuture = hasFutureModifier(lower, weekday.name);

			if (isPast || isSemanaPassada) {
				calculateWeekday(result, weekday.dayNum, 'past');
				foundDate = true;
			} else if (isFuture || isProximaSemana) {
				calculateWeekday(result, weekday.dayNum, 'future');
				foundDate = true;
			} else {
				calculateWeekday(result, weekday.dayNum, 'next');
				foundDate = true;
			}
		}
	}

	if (!foundDate && isSemanaPassada) {
		result.setDate(result.getDate() - 7);
		foundDate = true;
	} else if (!foundDate && isProximaSemana) {
		result.setDate(result.getDate() + 7);
		foundDate = true;
	}

	if (!foundDate) {
		const mMonth = lower.match(
			/(?:dia\s+)?(\d{1,2})\s*(?:de\s*)?(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)?/i,
		);
		if (mMonth?.[1]) {
			const day = Number.parseInt(mMonth[1], 10);
			if (day >= 1 && day <= 31) {
				result.setDate(day);
				foundDate = true;
				if (mMonth[2]) {
					const months: Record<string, number> = {
						janeiro: 0, fevereiro: 1, 'março': 2, marco: 2, abril: 3,
						maio: 4, junho: 5, julho: 6, agosto: 7, setembro: 8,
						outubro: 9, novembro: 10, dezembro: 11,
					};
					const monthNum = months[mMonth[2].toLowerCase()];
					if (monthNum !== undefined) result.setMonth(monthNum);
				}
			}
		}
	}

	if (!foundDate) return null;

	const time = parseTime(lower);
	if (time.found && time.invalid) {
		result.setHours(0, 0, 0, 0);
		return { date: result, hadTime: false, invalidTime: true };
	}
	if (time.found) {
		result.setHours(time.hours, time.minutes, 0, 0);
		hadTime = true;
	} else {
		result.setHours(0, 0, 0, 0);
	}

	return { date: result, hadTime, invalidTime: false };
}
