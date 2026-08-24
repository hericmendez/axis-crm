export interface IncomingMessageInfo {
	fromMe: boolean;
	isGroup: boolean;
	chatId: string;
	body: string;
	hasMention: boolean;
	mentionedNumbers: string[];
}

export interface FilterConfig {
	/** Identificadores do próprio Axis (número e/ou LID), comparados por dígitos. */
	selfIds: string[];
	allowedGroups: string[];
}

const MENTION_RE = /@axis\b/i;
const UNSUPPORTED_CHAT_SUFFIXES = ['@newsletter', '@broadcast'];

function isUnsupportedChat(chatId: string): boolean {
	return (
		chatId === 'status@broadcast' ||
		UNSUPPORTED_CHAT_SUFFIXES.some((suffix) => chatId.endsWith(suffix))
	);
}

function normalize(number: string): string {
	return number.replace(/\D/g, '');
}

function wasMentioned(msg: IncomingMessageInfo, config: FilterConfig): boolean {
	// Fallback textual (@Axis no corpo).
	if (MENTION_RE.test(msg.body)) return true;
	const selfs = config.selfIds.map(normalize);
	return msg.mentionedNumbers.some((n) => {
		const digits = normalize(n);
		return digits !== '' && selfs.includes(digits);
	});
}

/**
 * Regra inicial (docs/05): só processa mensagens de grupo em que o Axis foi
 * mencionado; ignora mensagens próprias e grupos não autorizados.
 */
export function shouldProcessMessage(
	msg: IncomingMessageInfo,
	config: FilterConfig,
): { process: boolean; reason: string } {
	if (isUnsupportedChat(msg.chatId)) {
		return { process: false, reason: 'chat não suportado' };
	}
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
