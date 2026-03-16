import { getChatById } from '../db.js';
import { sendMessage } from '../applescript.js';

export async function handleSend(args: {
  chatId: number;
  text: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const chat = getChatById(args.chatId);
  if (!chat) {
    return {
      content: [{ type: 'text', text: 'Chat not found. Use im_chats to list available chats.' }],
    };
  }

  try {
    await sendMessage(chat.guid, args.text);
    return {
      content: [{ type: 'text', text: `Message sent to chat ${args.chatId}.` }],
    };
  } catch (e: any) {
    return {
      content: [{ type: 'text', text: `Failed to send message: ${e.message}` }],
    };
  }
}
