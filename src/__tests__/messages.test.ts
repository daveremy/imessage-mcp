import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { _setDbForTesting } from '../db.js';
import { _setContactMapForTesting } from '../contacts.js';
import { handleMessages } from '../tools/messages.js';
import { handleSearch } from '../tools/search.js';
import { handleParticipants } from '../tools/participants.js';
import { handleChats } from '../tools/chats.js';
import { createTestDb, seedBasicData, TS_MAR_15 } from './fixtures/test-db.js';

let db: DatabaseSync;

beforeEach(() => {
  db = createTestDb();
  seedBasicData(db);
  _setDbForTesting(db);
  _setContactMapForTesting(new Map([
    ['+15551234567', 'Alice'],
    ['15551234567', 'Alice'],
    ['5551234567', 'Alice'],
    ['+15559876543', 'Bob'],
    ['15559876543', 'Bob'],
    ['5559876543', 'Bob'],
    ['alice@example.com', 'Alice Email'],
  ]));
});

afterEach(() => {
  _setDbForTesting(null);
  _setContactMapForTesting(null);
  db.close();
});

describe('handleMessages', () => {
  it('returns messages for a valid chat', () => {
    const result = handleMessages({ chatId: 1 });
    const text = result.content[0].text;
    assert.ok(text.includes('Hello there'));
    assert.ok(text.includes('Hi! How are you?'));
  });

  it('returns error for nonexistent chat', () => {
    const result = handleMessages({ chatId: 999 });
    assert.ok(result.content[0].text.includes('Chat not found'));
  });

  it('shows sender names resolved from contacts', () => {
    const result = handleMessages({ chatId: 1 });
    const text = result.content[0].text;
    assert.ok(text.includes('Alice'));
    assert.ok(text.includes('Me'));
  });

  it('displays reactions with target text', () => {
    const result = handleMessages({ chatId: 1 });
    const text = result.content[0].text;
    assert.ok(text.includes('[Liked "Hello there"]'));
  });

  it('shows [Message unsent] for retracted messages', () => {
    const result = handleMessages({ chatId: 1 });
    const text = result.content[0].text;
    assert.ok(text.includes('[Message unsent]'));
  });

  it('shows [Edited] prefix for edited messages', () => {
    const result = handleMessages({ chatId: 1 });
    const text = result.content[0].text;
    assert.ok(text.includes('[Edited] Edited text'));
  });

  it('skips reaction removals (type 3000-3005)', () => {
    const result = handleMessages({ chatId: 1 });
    const text = result.content[0].text;
    // msg-106 is a reaction removal, should not appear
    assert.ok(!text.includes('msg-106'));
    assert.ok(!text.includes('[Reaction type 3001]'));
  });

  it('shows attachment info', () => {
    const result = handleMessages({ chatId: 1 });
    const text = result.content[0].text;
    assert.ok(text.includes('[Attachment: photo.jpg'));
    assert.ok(text.includes('2.1 MB'));
  });

  it('includes pagination cursor when more messages available', () => {
    const result = handleMessages({ chatId: 1, limit: 2 });
    const text = result.content[0].text;
    assert.ok(text.includes('More messages available'));
    assert.ok(text.includes('cursor'));
  });

  it('handles BigInt values from node:sqlite without crashing', () => {
    // Insert a message with a large attachment (BigInt total_bytes)
    db.exec(`
      INSERT INTO attachment VALUES (2, '/path/to/video.mp4', 'video/mp4', 157286400, 'video.mp4');
      INSERT INTO message (ROWID, guid, text, handle_id, is_from_me, date, cache_has_attachments, associated_message_type, service)
        VALUES (400, 'msg-400', 'Big file', 1, 0, ${TS_MAR_15 + 10000000000}, 1, 0, 'iMessage');
      INSERT INTO message_attachment_join VALUES (400, 2);
      INSERT INTO chat_message_join VALUES (1, 400);
    `);
    // This should not throw "Cannot mix BigInt and other types"
    const result = handleMessages({ chatId: 1 });
    const text = result.content[0].text;
    assert.ok(text.includes('video.mp4'));
    assert.ok(text.includes('150.0 MB'));
  });
});

describe('handleSearch', () => {
  it('finds messages matching query', () => {
    const result = handleSearch({ query: 'Hello' });
    const text = result.content[0].text;
    assert.ok(text.includes('Hello there'));
  });

  it('is case insensitive', () => {
    const result = handleSearch({ query: 'hello' });
    const text = result.content[0].text;
    assert.ok(text.includes('Hello there'));
  });

  it('filters by chatId', () => {
    const result = handleSearch({ query: 'Group', chatId: 2 });
    const text = result.content[0].text;
    assert.ok(text.includes('Group message'));
  });

  it('shows completeness line', () => {
    const result = handleSearch({ query: 'xyz-no-match' });
    const text = result.content[0].text;
    assert.ok(text.includes('searched'));
    assert.ok(text.includes('total messages'));
  });

  it('respects limit', () => {
    const result = handleSearch({ query: 'message', limit: 1 });
    const text = result.content[0].text;
    const lines = text.split('\n').filter(l => l.startsWith('['));
    assert.equal(lines.length, 1);
  });
});

describe('handleParticipants', () => {
  it('lists participants with resolved names', () => {
    const result = handleParticipants({ chatId: 2 });
    const text = result.content[0].text;
    assert.ok(text.includes('Alice'));
    assert.ok(text.includes('Bob'));
    assert.ok(text.includes('Alice Email'));
    assert.ok(text.includes('3'));
  });

  it('returns error for nonexistent chat', () => {
    const result = handleParticipants({ chatId: 999 });
    assert.ok(result.content[0].text.includes('Chat not found'));
  });

  it('shows group type for style 43', () => {
    const result = handleParticipants({ chatId: 2 });
    assert.ok(result.content[0].text.includes('Group'));
  });

  it('shows 1:1 type for style 45', () => {
    const result = handleParticipants({ chatId: 1 });
    assert.ok(result.content[0].text.includes('1:1'));
  });
});

describe('handleChats', () => {
  it('lists chats with resolved names', () => {
    const result = handleChats({ limit: 10 });
    const text = result.content[0].text;
    assert.ok(text.includes('Chat ID: 1'));
    assert.ok(text.includes('Chat ID: 2'));
  });

  it('shows group name for group chats', () => {
    const result = handleChats({ limit: 10 });
    const text = result.content[0].text;
    assert.ok(text.includes('Test Group'));
  });

  it('shows resolved name for 1:1 chats', () => {
    const result = handleChats({ limit: 10 });
    const text = result.content[0].text;
    assert.ok(text.includes('Alice'));
  });
});
