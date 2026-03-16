import { getChats, getChatParticipants, appleNsToDate, formatDate } from '../db.js';
import { resolveHandle } from '../contacts.js';

export function handleChats(args: { limit?: number }): { content: Array<{ type: 'text'; text: string }> } {
  const limit = args.limit ?? 20;
  const chats = getChats(limit, false);

  if (chats.length === 0) {
    return { content: [{ type: 'text', text: 'No chats found.' }] };
  }

  const lines: string[] = [];

  for (let i = 0; i < chats.length; i++) {
    const chat = chats[i];
    const isGroup = Number(chat.style) === 43;
    const lastDate = appleNsToDate(chat.last_message_date);
    const dateStr = formatDate(lastDate);

    let displayName: string;
    if (isGroup) {
      displayName = formatGroupName(chat);
    } else {
      displayName = format1on1Name(chat);
    }

    const service = chat.service_name ?? 'iMessage';
    const msgCount = chat.message_count;
    const participantLabel = isGroup ? `, ${chat.participant_count} participants` : '';

    lines.push(`${i + 1}. ${displayName}`);
    lines.push(`   Chat ID: ${chat.ROWID} | ${service}${participantLabel} | ${msgCount} messages | ${dateStr}`);
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}

function formatGroupName(chat: any): string {
  if (chat.display_name) return chat.display_name;

  // Fall back to resolved participant names
  const participants = getChatParticipants(Number(chat.ROWID));
  const names = participants.map(p => resolveHandle(p.handle) ?? p.handle);

  if (names.length <= 4) {
    return names.join(', ');
  }
  return names.slice(0, 4).join(', ') + ` and ${names.length - 4} others`;
}

function format1on1Name(chat: any): string {
  const participants = getChatParticipants(Number(chat.ROWID));
  if (participants.length === 0) {
    // Extract handle from guid: "iMessage;-;+1234567890"
    const parts = chat.guid?.split(';');
    const handle = parts?.[2] ?? 'Unknown';
    const name = resolveHandle(handle);
    return name ? `${name} (${handle})` : handle;
  }
  const p = participants[0];
  const name = resolveHandle(p.handle);
  return name ? `${name} (${p.handle})` : p.handle;
}
