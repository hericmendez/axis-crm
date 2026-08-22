export interface IncomingMessageInfo {
	fromMe: boolean;
	isGroup: boolean;
	chatId: string;
	body: string;
	hasMention: boolean;
	mentionedNumbers: string[];
}

export interface FilterConfig {
	selfNumber?: string;
	allowedGroups: string[];
}

const MENTION_RE = /@axis\b/i;

function normalize(number: string): string {
	return number.replace(/\D/g, '');
}

function wasMentioned(msg: IncomingMessageInfo, config: FilterConfig): boolean {
	if (!config.selfNumber) return false;
	const self = normalize(config.selfNumber);
	if (msg.mentionedNumbers.some((n) => normalize(n) === self)) return true;
	return MENTION_RE.test(msg.body);
}

/**
 * Regra inicial (docs/05): só processa mensagens de grupo em que o Axis foi
 * mencionado; ignora mensagens próprias e grupos não autorizados.
 */
export function shouldProcessMessage(
	msg: IncomingMessageInfo,
	config: FilterConfig,
): { process: boolean; reason: string } {
	if (msg.fromMe) {
		return { process: false, reason: 'mensagem própria' };
	}
	if (
		msg.isGroup &&
		config.allowedGroups.length > 0 &&
		!config.allowedGroups.includes(msg.chatId)
	) {
		return { process: false, reason: 'grupo não autorizado' };
	}
	if (msg.isGroup && !wasMentioned(msg, config)) {
		return { process: false, reason: 'sem menção ao Axis' };
	}
	return { process: true, reason: 'ok' };
}
