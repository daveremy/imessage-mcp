import { getChatById, getChatParticipants } from '../db.js';
import { resolveHandle } from '../contacts.js';

export function handleParticipants(args: { chatId: number }): { content: Array<{ type: 'text'; text: string }> } {
  const chat = getChatById(args.chatId);
  if (!chat) {
    return {
      content: [{ type: 'text', text: 'Chat not found. Use im_chats to list available chats.' }],
    };
  }

  const participants = getChatParticipants(args.chatId);
  const isGroup = Number(chat.style) === 43;

  const lines: string[] = [];

  if (chat.display_name) {
    lines.push(`Chat: ${chat.display_name}`);
  }
  lines.push(`Type: ${isGroup ? 'Group' : '1:1'} | Service: ${chat.service_name ?? 'iMessage'}`);
  lines.push(`Participants (${participants.length}):`);
  lines.push('');

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    const name = resolveHandle(p.handle);
    if (name) {
      lines.push(`${i + 1}. ${name} (${p.handle}) — ${p.service}`);
    } else {
      lines.push(`${i + 1}. ${p.handle} — ${p.service}`);
    }
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}
