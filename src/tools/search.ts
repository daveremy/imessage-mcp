import {
  getRecentMessagesForSearch,
  getTotalMessageCount,
  extractMessageText,
  getHandleById,
  getChatIdForMessage,
  getChatById,
  appleNsToDate,
  formatDate,
} from '../db.js';
import { formatSender, resolveHandle } from '../contacts.js';

export function handleSearch(args: {
  query: string;
  chatId?: number;
  limit?: number;
}): { content: Array<{ type: 'text'; text: string }> } {
  const limit = args.limit ?? 20;
  const maxScan = 5000;

  const messages = getRecentMessagesForSearch(args.chatId ?? null, maxScan);
  const totalCount = getTotalMessageCount(args.chatId ?? null);

  const queryLower = args.query.toLowerCase();
  const results: string[] = [];

  for (const msg of messages) {
    if (results.length >= limit) break;

    // Skip reactions and system messages
    if (Number(msg.associated_message_type) !== 0) continue;

    const text = extractMessageText(msg);
    if (text === '(no text content)') continue;

    if (text.toLowerCase().includes(queryLower)) {
      const date = appleNsToDate(msg.date);
      const dateStr = formatDate(date);
      const handle = getHandleById(Number(msg.handle_id));
      const sender = formatSender(handle, Number(msg.is_from_me) === 1);

      // Get chat name for cross-chat search
      let chatLabel = '';
      if (args.chatId === undefined) {
        const chatId = getChatIdForMessage(Number(msg.ROWID));
        if (chatId) {
          const chat = getChatById(chatId);
          if (chat) {
            chatLabel = chat.display_name ? ` in ${chat.display_name}` : '';
            if (!chatLabel && chat.style !== 43) {
              // 1:1 chat, use participant handle
              const parts = chat.guid?.split(';');
              const chatHandle = parts?.[2];
              if (chatHandle) {
                const name = resolveHandle(chatHandle);
                chatLabel = ` in chat with ${name ?? chatHandle}`;
              }
            }
          }
        }
      }

      results.push(`[${dateStr}] ${sender}${chatLabel}: ${text}`);
    }
  }

  const lines: string[] = [];

  if (results.length === 0) {
    lines.push(`No messages found matching "${args.query}".`);
  } else {
    lines.push(...results);
  }

  lines.push('');
  lines.push(`(searched ${Math.min(maxScan, totalCount)} of ${totalCount} total messages)`);

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
