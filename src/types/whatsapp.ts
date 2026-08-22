export interface WhatsAppClient {
	sendText(chatId: string, text: string): Promise<void>;
}
