import {
  getChatById,
  getMessages,
  getHandleById,
  getAttachments,
  getMessageByGuid,
  extractMessageText,
  appleNsToDate,
  formatDate,
} from '../db.js';
import { formatSender } from '../contacts.js';
import type { PaginationCursor } from '../types.js';

// Reaction types
const REACTION_NAMES: Record<number, string> = {
  2000: 'Loved',
  2001: 'Liked',
  2002: 'Disliked',
  2003: 'Laughed at',
  2004: 'Emphasized',
  2005: 'Questioned',
};

export function handleMessages(args: {
  chatId: number;
  limit?: number;
  cursor?: string;
}): { content: Array<{ type: 'text'; text: string }> } {
  const chat = getChatById(args.chatId);
  if (!chat) {
    return {
      content: [{ type: 'text', text: 'Chat not found. Use im_chats to list available chats.' }],
    };
  }

  const limit = args.limit ?? 50;

  // Parse cursor
  let cursor: PaginationCursor | undefined;
  if (args.cursor) {
    const parts = args.cursor.split(':');
    if (parts.length === 2) {
      cursor = { date: parts[0], rowid: parseInt(parts[1], 10) };
    }
  }

  const { messages, nextCursor } = getMessages(args.chatId, limit, cursor);

  if (messages.length === 0) {
    return {
      content: [{ type: 'text', text: 'No messages found in this chat.' }],
    };
  }

  const lines: string[] = [];

  for (const msg of messages) {
    // Skip reaction removals (3000-3005)
    if (Number(msg.associated_message_type) >= 3000 && Number(msg.associated_message_type) <= 3005) {
      continue;
    }

    const date = appleNsToDate(msg.date);
    const dateStr = formatDate(date);
    const handle = getHandleById(Number(msg.handle_id));
    const sender = formatSender(handle, Number(msg.is_from_me) === 1);

    const msgType = Number(msg.associated_message_type);

    // Handle reactions (2000-2005)
    if (msgType >= 2000 && msgType <= 2005) {
      const reactionName = REACTION_NAMES[msgType] ?? 'Reacted to';
      const targetText = resolveReactionTarget(msg.associated_message_guid);
      lines.push(`[${dateStr}] ${sender}: [${reactionName} ${targetText}]`);
      continue;
    }

    // Handle unknown associated message types
    if (msgType !== 0) {
      lines.push(`[${dateStr}] ${sender}: [Reaction type ${msgType}]`);
      continue;
    }

    // Regular message
    const text = extractMessageText(msg);

    // Attachments
    let attachmentText = '';
    if (msg.cache_has_attachments) {
      const attachments = getAttachments(Number(msg.ROWID));
      if (attachments.length > 0) {
        const parts = attachments.map(a => {
          const name = a.transfer_name || a.filename || '(unknown)';
          const size = formatBytes(a.total_bytes);
          return `[Attachment: ${name}, ${size}]`;
        });
        attachmentText = ' ' + parts.join(' ');
      }
    }

    lines.push(`[${dateStr}] ${sender}: ${text}${attachmentText}`);
  }

  // Add cursor info if more messages available
  if (nextCursor) {
    lines.push('');
    lines.push(`--- More messages available. Use cursor: "${nextCursor.date}:${nextCursor.rowid}" ---`);
  }

  return { content: [{ type: 'text', text: lines.join('\n') }] };
}

function resolveReactionTarget(associatedGuid: string | null): string {
  if (!associatedGuid) return 'a message';

  // associated_message_guid format: "p:0/GUID" or "bp:GUID"
  let targetGuid = associatedGuid;
  const prefixMatch = associatedGuid.match(/^(?:p:\d+\/|bp:)(.+)$/);
  if (prefixMatch) {
    targetGuid = prefixMatch[1];
  }

  const targetMsg = getMessageByGuid(targetGuid);
  if (!targetMsg) return 'a message';

  const text = extractMessageText(targetMsg);
  if (text === '(no text content)') return 'a message';

  // Truncate long target text
  const maxLen = 50;
  const truncated = text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
  return `"${truncated}"`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 bytes';
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
