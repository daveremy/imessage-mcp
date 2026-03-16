import { DatabaseSync } from 'node:sqlite';

/**
 * Create an in-memory SQLite database with the iMessage chat.db schema.
 * Returns a DB instance ready for seeding and testing.
 */
export function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');

  db.exec(`
    CREATE TABLE handle (
      ROWID INTEGER PRIMARY KEY,
      id TEXT,
      service TEXT
    );

    CREATE TABLE chat (
      ROWID INTEGER PRIMARY KEY,
      guid TEXT,
      display_name TEXT,
      style INTEGER,
      service_name TEXT
    );

    CREATE TABLE message (
      ROWID INTEGER PRIMARY KEY,
      guid TEXT UNIQUE,
      text TEXT,
      attributedBody BLOB,
      handle_id INTEGER,
      is_from_me INTEGER DEFAULT 0,
      date INTEGER DEFAULT 0,
      date_read INTEGER,
      date_delivered INTEGER,
      date_edited INTEGER,
      date_retracted INTEGER,
      cache_has_attachments INTEGER DEFAULT 0,
      associated_message_guid TEXT,
      associated_message_type INTEGER DEFAULT 0,
      service TEXT
    );

    CREATE TABLE chat_message_join (
      chat_id INTEGER,
      message_id INTEGER
    );

    CREATE TABLE chat_handle_join (
      chat_id INTEGER,
      handle_id INTEGER
    );

    CREATE TABLE attachment (
      ROWID INTEGER PRIMARY KEY,
      filename TEXT,
      mime_type TEXT,
      total_bytes INTEGER,
      transfer_name TEXT
    );

    CREATE TABLE message_attachment_join (
      message_id INTEGER,
      attachment_id INTEGER
    );
  `);

  return db;
}

// Apple nanosecond timestamps for testing.
// Mar 15 2025 14:30:00 UTC = 763_832_600 seconds since Apple epoch (2001-01-01)
// As nanoseconds: 763832600 * 1e9 = 763832600000000000
export const TS_MAR_15 = 763832600000000000;
export const TS_MAR_14 = TS_MAR_15 - 86400 * 1_000_000_000; // 1 day earlier
export const TS_MAR_13 = TS_MAR_15 - 2 * 86400 * 1_000_000_000;

/**
 * Seed the test DB with a basic 1:1 chat and a group chat.
 */
export function seedBasicData(db: DatabaseSync) {
  // Handles
  db.exec(`
    INSERT INTO handle VALUES (1, '+15551234567', 'iMessage');
    INSERT INTO handle VALUES (2, '+15559876543', 'iMessage');
    INSERT INTO handle VALUES (3, 'alice@example.com', 'iMessage');
  `);

  // 1:1 chat (style 45)
  db.exec(`
    INSERT INTO chat VALUES (1, 'iMessage;-;+15551234567', NULL, 45, 'iMessage');
  `);
  db.prepare('INSERT INTO chat_handle_join VALUES (?, ?)').run(1, 1);

  // Group chat (style 43)
  db.exec(`
    INSERT INTO chat VALUES (2, 'iMessage;+;chat123456', 'Test Group', 43, 'iMessage');
  `);
  db.prepare('INSERT INTO chat_handle_join VALUES (?, ?)').run(2, 1);
  db.prepare('INSERT INTO chat_handle_join VALUES (?, ?)').run(2, 2);
  db.prepare('INSERT INTO chat_handle_join VALUES (?, ?)').run(2, 3);

  // Messages in 1:1 chat
  db.prepare(`
    INSERT INTO message (ROWID, guid, text, handle_id, is_from_me, date, associated_message_type, service)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(100, 'msg-100', 'Hello there', 1, 0, TS_MAR_13, 0, 'iMessage');

  db.prepare(`
    INSERT INTO message (ROWID, guid, text, handle_id, is_from_me, date, associated_message_type, service)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(101, 'msg-101', 'Hi! How are you?', 0, 1, TS_MAR_13 + 60_000_000_000, 0, 'iMessage');

  db.prepare(`
    INSERT INTO message (ROWID, guid, text, handle_id, is_from_me, date, associated_message_type, service)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(102, 'msg-102', null, 0, 1, TS_MAR_14, 2001, 'iMessage'); // Liked reaction

  // Set the reaction target
  db.prepare('UPDATE message SET associated_message_guid = ? WHERE ROWID = ?')
    .run('p:0/msg-100', 102);

  // Message with attachment
  db.prepare(`
    INSERT INTO message (ROWID, guid, text, handle_id, is_from_me, date, cache_has_attachments, associated_message_type, service)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(103, 'msg-103', 'Check this out', 1, 0, TS_MAR_15, 1, 0, 'iMessage');

  db.exec(`
    INSERT INTO attachment VALUES (1, '/path/to/photo.jpg', 'image/jpeg', 2150400, 'photo.jpg');
    INSERT INTO message_attachment_join VALUES (103, 1);
  `);

  // Unsent message
  db.prepare(`
    INSERT INTO message (ROWID, guid, text, handle_id, is_from_me, date, date_retracted, associated_message_type, service)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(104, 'msg-104', 'This was unsent', 1, 0, TS_MAR_15 + 1000000000, TS_MAR_15 + 2000000000, 0, 'iMessage');

  // Edited message
  db.prepare(`
    INSERT INTO message (ROWID, guid, text, handle_id, is_from_me, date, date_edited, associated_message_type, service)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(105, 'msg-105', 'Edited text', 0, 1, TS_MAR_15 + 3000000000, TS_MAR_15 + 4000000000, 0, 'iMessage');

  // Link all messages to chat 1
  for (const msgId of [100, 101, 102, 103, 104, 105]) {
    db.prepare('INSERT INTO chat_message_join VALUES (?, ?)').run(1, msgId);
  }

  // Messages in group chat
  db.prepare(`
    INSERT INTO message (ROWID, guid, text, handle_id, is_from_me, date, associated_message_type, service)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(200, 'msg-200', 'Group message 1', 2, 0, TS_MAR_14, 0, 'iMessage');

  db.prepare(`
    INSERT INTO message (ROWID, guid, text, handle_id, is_from_me, date, associated_message_type, service)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(201, 'msg-201', 'Group message 2', 3, 0, TS_MAR_15, 0, 'iMessage');

  db.prepare('INSERT INTO chat_message_join VALUES (?, ?)').run(2, 200);
  db.prepare('INSERT INTO chat_message_join VALUES (?, ?)').run(2, 201);

  // Reaction removal (should be skipped)
  db.prepare(`
    INSERT INTO message (ROWID, guid, text, handle_id, is_from_me, date, associated_message_type, service)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(106, 'msg-106', null, 0, 1, TS_MAR_15 + 5000000000, 3001, 'iMessage');
  db.prepare('INSERT INTO chat_message_join VALUES (?, ?)').run(1, 106);
}
