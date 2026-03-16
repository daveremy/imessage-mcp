import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  _setDbForTesting,
  getChatCount,
  getMessageCount,
  getChats,
  getChatById,
  getChatParticipants,
  getHandleById,
  getMessages,
  getMessageByGuid,
  getAttachments,
  extractMessageText,
  getRecentMessagesForSearch,
  getTotalMessageCount,
  getChatIdForMessage,
} from '../db.js';
import { createTestDb, seedBasicData, TS_MAR_13, TS_MAR_14, TS_MAR_15 } from './fixtures/test-db.js';
import { SHORT_MESSAGE } from './fixtures/typedstream-blobs.js';
import { DatabaseSync } from 'node:sqlite';

let db: DatabaseSync;

beforeEach(() => {
  db = createTestDb();
  seedBasicData(db);
  _setDbForTesting(db);
});

afterEach(() => {
  _setDbForTesting(null);
  db.close();
});

describe('getChatCount', () => {
  it('returns correct chat count', () => {
    assert.equal(getChatCount(), 2);
  });
});

describe('getMessageCount', () => {
  it('returns correct message count', () => {
    // 7 in chat 1 (100-106) + 2 in chat 2 (200-201) = 9
    assert.equal(getMessageCount(), 9);
  });
});

describe('getChats', () => {
  it('returns chats ordered by last_message_date DESC', () => {
    const chats = getChats(10, false);
    assert.ok(chats.length >= 1);
    // Chat 1 has messages up to TS_MAR_15 + 5s, Chat 2 up to TS_MAR_15
    assert.equal(Number(chats[0].ROWID), 1);
  });

  it('respects limit', () => {
    const chats = getChats(1, false);
    assert.equal(chats.length, 1);
  });

  it('includes participant count', () => {
    const chats = getChats(10, false);
    const chat1 = chats.find(c => Number(c.ROWID) === 1);
    const chat2 = chats.find(c => Number(c.ROWID) === 2);
    assert.equal(Number(chat1!.participant_count), 1);
    assert.equal(Number(chat2!.participant_count), 3);
  });
});

describe('getChatById', () => {
  it('returns chat when found', () => {
    const chat = getChatById(1);
    assert.ok(chat);
    assert.equal(chat!.guid, 'iMessage;-;+15551234567');
  });

  it('returns null when not found', () => {
    assert.equal(getChatById(999), null);
  });
});

describe('getChatParticipants', () => {
  it('returns participants for 1:1 chat', () => {
    const participants = getChatParticipants(1);
    assert.equal(participants.length, 1);
    assert.equal(participants[0].handle, '+15551234567');
  });

  it('returns participants for group chat', () => {
    const participants = getChatParticipants(2);
    assert.equal(participants.length, 3);
  });
});

describe('getHandleById', () => {
  it('returns handle string', () => {
    assert.equal(getHandleById(1), '+15551234567');
  });

  it('returns null for handle_id 0', () => {
    assert.equal(getHandleById(0), null);
  });

  it('returns null for nonexistent handle', () => {
    assert.equal(getHandleById(999), null);
  });
});

describe('getMessages', () => {
  it('returns messages in chronological order', () => {
    const { messages } = getMessages(1, 50);
    assert.ok(messages.length >= 2);
    // First message should be oldest
    for (let i = 1; i < messages.length; i++) {
      assert.ok(messages[i].date >= messages[i - 1].date);
    }
  });

  it('respects limit', () => {
    const { messages } = getMessages(1, 2);
    assert.equal(messages.length, 2);
  });

  it('returns nextCursor when limit is reached', () => {
    const { nextCursor } = getMessages(1, 2);
    assert.ok(nextCursor);
    assert.ok(nextCursor!.date);
    assert.ok(typeof nextCursor!.rowid === 'number');
  });

  it('returns null nextCursor when all messages fit', () => {
    const { nextCursor } = getMessages(1, 100);
    assert.equal(nextCursor, null);
  });

  it('pagination with cursor returns next page', () => {
    const page1 = getMessages(1, 3);
    assert.ok(page1.nextCursor);

    const page2 = getMessages(1, 3, page1.nextCursor!);
    assert.ok(page2.messages.length > 0);

    // Pages should not overlap
    const page1Ids = new Set(page1.messages.map(m => Number(m.ROWID)));
    for (const msg of page2.messages) {
      assert.ok(!page1Ids.has(Number(msg.ROWID)), `Message ${msg.ROWID} appears in both pages`);
    }
  });
});

describe('getMessageByGuid', () => {
  it('returns message when found', () => {
    const msg = getMessageByGuid('msg-100');
    assert.ok(msg);
    assert.equal(msg!.text, 'Hello there');
  });

  it('returns null when not found', () => {
    assert.equal(getMessageByGuid('nonexistent'), null);
  });
});

describe('extractMessageText', () => {
  it('returns text from text column', () => {
    const msg = getMessageByGuid('msg-100')!;
    assert.equal(extractMessageText(msg), 'Hello there');
  });

  it('returns [Message unsent] for retracted messages', () => {
    const msg = getMessageByGuid('msg-104')!;
    assert.equal(extractMessageText(msg), '[Message unsent]');
  });

  it('returns [Edited] prefix for edited messages', () => {
    const msg = getMessageByGuid('msg-105')!;
    assert.equal(extractMessageText(msg), '[Edited] Edited text');
  });

  it('extracts text from attributedBody when text is null', () => {
    // Insert a message with attributedBody but no text
    db.prepare(`
      INSERT INTO message (ROWID, guid, text, attributedBody, handle_id, is_from_me, date, associated_message_type, service)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(300, 'msg-300', null, SHORT_MESSAGE, 1, 0, TS_MAR_15, 0, 'iMessage');

    const msg = getMessageByGuid('msg-300')!;
    const text = extractMessageText(msg);
    assert.equal(text, 'Y');
  });

  it('returns "(no text content)" when both text and attributedBody are null', () => {
    db.prepare(`
      INSERT INTO message (ROWID, guid, text, attributedBody, handle_id, is_from_me, date, associated_message_type, service)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(301, 'msg-301', null, null, 1, 0, TS_MAR_15, 0, 'iMessage');

    const msg = getMessageByGuid('msg-301')!;
    assert.equal(extractMessageText(msg), '(no text content)');
  });
});

describe('getAttachments', () => {
  it('returns attachments for message with cache_has_attachments', () => {
    const atts = getAttachments(103);
    assert.equal(atts.length, 1);
    assert.equal(atts[0].transfer_name, 'photo.jpg');
    assert.equal(Number(atts[0].total_bytes), 2150400);
  });

  it('returns empty array for message without attachments', () => {
    const atts = getAttachments(100);
    assert.equal(atts.length, 0);
  });
});

describe('getRecentMessagesForSearch', () => {
  it('returns messages across all chats when chatId is null', () => {
    const msgs = getRecentMessagesForSearch(null, 100);
    assert.ok(msgs.length > 0);
  });

  it('filters by chatId', () => {
    const msgs = getRecentMessagesForSearch(2, 100);
    // Only messages from chat 2
    assert.equal(msgs.length, 2);
  });

  it('respects limit', () => {
    const msgs = getRecentMessagesForSearch(null, 2);
    assert.equal(msgs.length, 2);
  });
});

describe('getTotalMessageCount', () => {
  it('returns total count for null chatId', () => {
    assert.equal(getTotalMessageCount(null), 9);
  });

  it('returns count for specific chat', () => {
    assert.equal(getTotalMessageCount(1), 7);
    assert.equal(getTotalMessageCount(2), 2);
  });
});

describe('getChatIdForMessage', () => {
  it('returns chat ID for a message', () => {
    assert.equal(getChatIdForMessage(100), 1);
    assert.equal(getChatIdForMessage(200), 2);
  });

  it('returns null for nonexistent message', () => {
    assert.equal(getChatIdForMessage(999), null);
  });
});
