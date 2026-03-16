import { DatabaseSync } from 'node:sqlite';
import { homedir } from 'os';
import { existsSync } from 'fs';
import type { ChatRow, MessageRow, HandleRow, AttachmentRow, ParticipantInfo, PaginationCursor } from './types.js';
import { extractTextFromAttributedBody } from './typedstream.js';

const CHAT_DB_PATH = `${homedir()}/Library/Messages/chat.db`;

// Apple epoch offset: 2001-01-01 in Unix epoch seconds
const APPLE_EPOCH_OFFSET = 978307200n;

let _db: DatabaseSync | null = null;

export function getDbPath(): string {
  return CHAT_DB_PATH;
}

export function canAccessDb(): { ok: boolean; error?: string } {
  if (!existsSync(CHAT_DB_PATH)) {
    return { ok: false, error: `Database not found at ${CHAT_DB_PATH}. Full Disk Access may be required.` };
  }
  try {
    const db = openDb();
    db.prepare('SELECT 1 FROM message LIMIT 1').get();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

function openDb(): DatabaseSync {
  if (_db) return _db;
  _db = new DatabaseSync(CHAT_DB_PATH, { readOnly: true });
  return _db;
}

/** Prepare a statement with BigInt support enabled (needed for Apple nanosecond timestamps). */
function prepare(sql: string) {
  const stmt = openDb().prepare(sql);
  stmt.setReadBigInts(true);
  return stmt;
}

export function appleNsToDate(ns: bigint | number | null): Date | null {
  if (ns === null || ns === 0 || ns === 0n) return null;
  const bigNs = typeof ns === 'bigint' ? ns : BigInt(ns);
  const unixSeconds = Number(bigNs / 1_000_000_000n + APPLE_EPOCH_OFFSET);
  return new Date(unixSeconds * 1000);
}

export function formatDate(date: Date | null): string {
  if (!date) return '';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function getChatCount(): number {
  const row = prepare('SELECT COUNT(*) as c FROM chat').get() as any;
  return Number(row.c);
}

export function getMessageCount(): number {
  const row = prepare('SELECT COUNT(*) as c FROM message').get() as any;
  return Number(row.c);
}

export function getChats(limit: number, includeArchived: boolean): ChatRow[] {
  const db = openDb();
  // Get chats with their most recent message date and participant count
  const query = `
    SELECT
      c.ROWID,
      c.guid,
      c.display_name,
      c.style,
      c.service_name,
      (
        SELECT MAX(m.date)
        FROM message m
        JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
        WHERE cmj.chat_id = c.ROWID
      ) as last_message_date,
      (
        SELECT COUNT(*)
        FROM message m
        JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
        WHERE cmj.chat_id = c.ROWID
      ) as message_count,
      (
        SELECT COUNT(*)
        FROM chat_handle_join chj
        WHERE chj.chat_id = c.ROWID
      ) as participant_count
    FROM chat c
    WHERE (
      SELECT COUNT(*)
      FROM message m
      JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
      WHERE cmj.chat_id = c.ROWID
    ) > 0
    ORDER BY last_message_date DESC
    LIMIT ?
  `;
  return prepare(query).all(limit) as unknown as ChatRow[];
}

export function getChatById(chatId: number): ChatRow | null {
  const row = prepare(`
    SELECT
      c.ROWID,
      c.guid,
      c.display_name,
      c.style,
      c.service_name,
      NULL as last_message_date,
      0 as message_count,
      (SELECT COUNT(*) FROM chat_handle_join chj WHERE chj.chat_id = c.ROWID) as participant_count
    FROM chat c
    WHERE c.ROWID = ?
  `).get(chatId) as ChatRow | undefined;
  return row ?? null;
}

export function getChatParticipants(chatId: number): ParticipantInfo[] {
  const rows = prepare(`
    SELECT h.id, h.service
    FROM handle h
    JOIN chat_handle_join chj ON chj.handle_id = h.ROWID
    WHERE chj.chat_id = ?
    ORDER BY h.id
  `).all(chatId) as Array<{ id: string; service: string }>;

  return rows.map(r => ({
    handle: r.id,
    name: null, // resolved by contacts module
    service: r.service,
  }));
}

export function getHandleById(handleId: number): string | null {
  if (handleId === 0) return null;
  const row = prepare('SELECT id FROM handle WHERE ROWID = ?').get(handleId) as { id: string } | undefined;
  return row?.id ?? null;
}

export interface RawMessageRow {
  ROWID: number | bigint;
  guid: string;
  text: string | null;
  attributedBody: ArrayBuffer | null;
  handle_id: number | bigint;
  is_from_me: number | bigint;
  date: bigint;
  date_read: bigint | null;
  date_delivered: bigint | null;
  date_edited: bigint | null;
  date_retracted: bigint | null;
  cache_has_attachments: number | bigint;
  associated_message_guid: string | null;
  associated_message_type: number | bigint;
  service: string | null;
}

export function getMessages(
  chatId: number,
  limit: number,
  cursor?: PaginationCursor
): { messages: RawMessageRow[]; nextCursor: PaginationCursor | null } {
  let query: string;
  let params: any[];

  if (cursor) {
    query = `
      SELECT
        m.ROWID, m.guid, m.text, m.attributedBody, m.handle_id, m.is_from_me,
        m.date, m.date_read, m.date_delivered, m.date_edited, m.date_retracted,
        m.cache_has_attachments, m.associated_message_guid, m.associated_message_type,
        m.service
      FROM message m
      JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
      WHERE cmj.chat_id = ?
        AND (m.date < ? OR (m.date = ? AND m.ROWID < ?))
      ORDER BY m.date DESC, m.ROWID DESC
      LIMIT ?
    `;
    params = [chatId, BigInt(cursor.date), BigInt(cursor.date), cursor.rowid, limit];
  } else {
    query = `
      SELECT
        m.ROWID, m.guid, m.text, m.attributedBody, m.handle_id, m.is_from_me,
        m.date, m.date_read, m.date_delivered, m.date_edited, m.date_retracted,
        m.cache_has_attachments, m.associated_message_guid, m.associated_message_type,
        m.service
      FROM message m
      JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
      WHERE cmj.chat_id = ?
      ORDER BY m.date DESC, m.ROWID DESC
      LIMIT ?
    `;
    params = [chatId, limit];
  }

  const rows = prepare(query).all(...params) as unknown as RawMessageRow[];

  // The oldest message in the DESC result (last row) becomes the cursor for the next page
  let nextCursor: PaginationCursor | null = null;
  if (rows.length === limit) {
    const oldest = rows[rows.length - 1];
    nextCursor = {
      date: String(oldest.date),
      rowid: Number(oldest.ROWID),
    };
  }

  // Reverse for chronological display
  rows.reverse();

  return { messages: rows, nextCursor };
}

export function getMessageByGuid(guid: string): RawMessageRow | null {
  const row = prepare(`
    SELECT
      m.ROWID, m.guid, m.text, m.attributedBody, m.handle_id, m.is_from_me,
      m.date, m.date_read, m.date_delivered, m.date_edited, m.date_retracted,
      m.cache_has_attachments, m.associated_message_guid, m.associated_message_type,
      m.service
    FROM message m
    WHERE m.guid = ?
  `).get(guid) as RawMessageRow | undefined;
  return row ?? null;
}

export function getAttachments(messageRowId: number): AttachmentRow[] {
  return prepare(`
    SELECT a.filename, a.mime_type, a.total_bytes, a.transfer_name
    FROM attachment a
    JOIN message_attachment_join maj ON maj.attachment_id = a.ROWID
    WHERE maj.message_id = ?
  `).all(messageRowId) as unknown as AttachmentRow[];
}

export function extractMessageText(msg: RawMessageRow): string {
  // Unsent message
  if (msg.date_retracted) {
    return '[Message unsent]';
  }

  // Try attributedBody first
  if (msg.attributedBody) {
    const buf = Buffer.from(msg.attributedBody);
    const extracted = extractTextFromAttributedBody(buf);
    if (extracted) {
      const prefix = msg.date_edited ? '[Edited] ' : '';
      return prefix + extracted;
    }
  }

  // Fall back to text column
  if (msg.text) {
    const prefix = msg.date_edited ? '[Edited] ' : '';
    return prefix + msg.text;
  }

  return '(no text content)';
}

export function getRecentMessagesForSearch(chatId: number | null, maxMessages: number): RawMessageRow[] {
  let query: string;
  let params: any[];

  if (chatId !== null) {
    query = `
      SELECT
        m.ROWID, m.guid, m.text, m.attributedBody, m.handle_id, m.is_from_me,
        m.date, m.date_read, m.date_delivered, m.date_edited, m.date_retracted,
        m.cache_has_attachments, m.associated_message_guid, m.associated_message_type,
        m.service
      FROM message m
      JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
      WHERE cmj.chat_id = ?
      ORDER BY m.date DESC
      LIMIT ?
    `;
    params = [chatId, maxMessages];
  } else {
    query = `
      SELECT
        m.ROWID, m.guid, m.text, m.attributedBody, m.handle_id, m.is_from_me,
        m.date, m.date_read, m.date_delivered, m.date_edited, m.date_retracted,
        m.cache_has_attachments, m.associated_message_guid, m.associated_message_type,
        m.service
      FROM message m
      ORDER BY m.date DESC
      LIMIT ?
    `;
    params = [maxMessages];
  }

  return prepare(query).all(...params) as unknown as RawMessageRow[];
}

export function getTotalMessageCount(chatId: number | null): number {
  if (chatId !== null) {
    const row = prepare(`
      SELECT COUNT(*) as c
      FROM message m
      JOIN chat_message_join cmj ON cmj.message_id = m.ROWID
      WHERE cmj.chat_id = ?
    `).get(chatId) as any;
    return Number(row.c);
  }
  const row = prepare('SELECT COUNT(*) as c FROM message').get() as any;
  return Number(row.c);
}

export function getChatIdForMessage(messageRowId: number): number | null {
  const row = prepare('SELECT chat_id FROM chat_message_join WHERE message_id = ?').get(messageRowId) as { chat_id: number } | undefined;
  return row?.chat_id ?? null;
}
