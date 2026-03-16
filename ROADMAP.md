# iMessage MCP Roadmap

Tracked issues and future improvements surfaced during plan review (codex + gemini, 12 rounds).

## v1.1 — Parser & Search Improvements

### Full typedstream parser
The v1 typedstream parser is best-effort (marker scan for single-string NSAttributedString). It will miss:
- Multi-segment attributed strings (e.g. bold + plain runs)
- NSMutableString variant encodings
- Messages with inline attachment references in the attributed body
- Edited message part structures (macOS Ventura+)

Consider porting a known working typedstream implementation or using `@parseaple/typedstream`.

**Source**: codex rounds 2-8

### Full-text search indexing
v1 search scans up to 5000 recent messages in-app. For large databases (100k+ messages), this won't scale. Options:
- Build a SQLite FTS5 virtual table on extracted text
- Pre-extract and cache all message text on first run
- Use the existing Spotlight index if accessible

**Source**: codex rounds 4, 6

## v1.2 — Message Features

### Thread/reply context
Modern iMessage uses `thread_originator_guid` for threaded replies. Adding `(Reply to: "...")` context in `im_messages` output would help Claude understand conversation structure.

**Source**: gemini round 2

### Attachment content access
v1 renders `[Attachment: filename.jpg]` metadata only. A future `im_attachment_path` tool could return the absolute disk path so Claude can read/view attachments directly.

**Source**: gemini round 2

### Tapbacks, stickers, and app payloads
v1 handles standard reactions (types 2000-2005). Missing:
- Stickers (`is_sticker` on attachment)
- iMessage app content (`balloon_bundle_id`)
- Shared locations, Apple Pay, etc.
- Tapback emoji reactions (newer macOS)

**Source**: codex round 4

### Edited and unsent message history
v1 shows current state for edited messages and `[Message unsent]` for retracted. Could show edit history if `message_part` / versioning data is available.

**Source**: codex round 4, gemini round 2

## v1.3 — Contact Resolution

### International phone number support
v1 normalization is US-centric (strip digits, prepend "1" for 10-digit numbers). For international users:
- Use a proper phone number library (e.g. `libphonenumber-js`)
- Handle country codes beyond +1
- Support short codes and non-standard identifiers

**Source**: codex rounds 2, 4

### Duplicate contact handling
Multiple AddressBook source DBs (iCloud, Google, Exchange) can have overlapping contacts. v1 last-write-wins on the lookup map. Should detect and handle:
- Same phone number → different names across sources
- Unified/linked contacts
- Suffix match ambiguity

**Source**: codex rounds 4, 6

## v2 — Infrastructure

### Automated tests
v1 uses manual CLI verification. Should add:
- Fixture-based tests for typedstream parser with anonymized blobs
- Date conversion unit tests (edge cases: zero, null, boundary dates)
- Contact normalization tests (various phone formats)
- SQL query result shape tests with a test fixture DB

**Source**: codex rounds 4, 7

### Native dependency documentation
`better-sqlite3` requires native compilation. README should note:
- Xcode Command Line Tools requirement
- M1 vs Intel prebuild availability
- Potential `node-gyp` issues on different Node versions

**Source**: gemini round 5

### TCC / Contacts permission detection
Full Disk Access covers `chat.db` but AddressBook access may additionally require Contacts permission on some macOS versions. `im_status` should distinguish "file missing" vs "file exists but unreadable (TCC denied)".

**Source**: gemini rounds 2, 5

### Chat participant history
v1 shows current participants. Group chats can have members join/leave over time — historical participant data is in the message stream (group_action_type changes).

**Source**: codex round 4
