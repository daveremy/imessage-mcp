# imessage-mcp

An [MCP server](https://modelcontextprotocol.io/) that gives AI assistants like [Claude Code](https://docs.anthropic.com/en/docs/claude-code) the ability to read and send iMessages on macOS.

Phone numbers and email addresses are automatically resolved to real names from your Apple Contacts — so you interact with people, not handles.

## What it looks like

```
> imessage-mcp chats 3

1. Sarah, Mike, Pete, Joel
   Chat ID: 91 | iMessage, 4 participants | 46 messages | Mar 15, 9:33 PM
2. Family Group Chat
   Chat ID: 40 | iMessage, 8 participants | 125 messages | Mar 15, 6:08 PM
3. Alex Johnson (+15551234567)
   Chat ID: 67 | iMessage | 12 messages | Mar 15, 4:39 PM
```

```
> imessage-mcp messages 67 3

[Mar 15, 2:01 PM] Alex Johnson (+15551234567): Are we still on for Friday?
[Mar 15, 2:05 PM] Me: Yes! Looking forward to it.
[Mar 15, 4:39 PM] Alex Johnson (+15551234567): Great, see you then!
```

## Prerequisites

**macOS only.** This reads the local Messages database directly.

1. **Full Disk Access** — your terminal app needs permission to read `~/Library/Messages/chat.db`
   - System Settings → Privacy & Security → Full Disk Access → add your terminal (Terminal.app, iTerm2, Ghostty, etc.)
   - Restart the terminal after granting access
2. **Contacts permission** (optional but recommended) — for resolving phone numbers to names
   - If names aren't showing up, grant Contacts access to your terminal app in System Settings
3. **Messages.app signed in** — required only for sending messages
4. **Node.js >= 22** — uses the built-in `node:sqlite` module (no native compilation needed)

Run `imessage-mcp status` to verify everything is working.

## Installation

### As a Claude Code MCP server

Add to your project's `.mcp.json` or `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "imessage-mcp": {
      "command": "npx",
      "args": ["-y", "imessage-mcp"]
    }
  }
}
```

Then restart Claude Code. The `im_*` tools will appear automatically.

### As a CLI tool

```bash
npx imessage-mcp status       # verify access
npx imessage-mcp chats        # list recent conversations
npx imessage-mcp messages 42  # read messages from chat 42
```

## Tools

### im_status

Check that database access and contact resolution are working.

```
Messages database: OK
  Chats: 102
  Messages: 1432

Contacts: OK (77 contacts)
```

### im_chats

List recent conversations, ordered by last activity. Groups show the group name or resolved participant names. 1:1 chats show the contact name with handle.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 20 | Maximum chats to return |

### im_messages

Read messages from a specific chat in chronological order. Includes reactions, attachments, edited/unsent indicators, and pagination.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `chatId` | number | required | Chat ID from `im_chats` |
| `limit` | number | 50 | Messages per page |
| `cursor` | string | — | Opaque cursor from previous response for loading older messages |

Messages are formatted as:
```
[Mar 15, 2:01 PM] Contact Name (+15551234567): message text
[Mar 15, 2:05 PM] Me: response text
[Mar 15, 2:06 PM] Me: [Liked "message text"]
[Mar 15, 2:07 PM] Contact Name (+15551234567): photo.jpg [Attachment: photo.jpg, 2.1 MB]
```

### im_search

Search message text across all chats or within a specific chat. Scans up to 5,000 recent messages with case-insensitive substring matching.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Text to search for |
| `chatId` | number | — | Limit search to one chat |
| `limit` | number | 20 | Maximum results |

Results include a completeness line: `(searched 1432 of 1432 total messages)` so you know the coverage.

### im_send

Send a message to an existing chat. The MCP tool description includes a warning to always confirm with the user before sending.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `chatId` | number | required | Chat ID from `im_chats` |
| `text` | string | required | Message text |

Uses JXA (JavaScript for Automation) to send via Messages.app. Only targets existing chat threads by GUID — never creates new conversations.

### im_participants

List everyone in a chat with resolved contact names and service type (iMessage, SMS, RCS).

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `chatId` | number | required | Chat ID from `im_chats` |

## How it works

```
┌─────────────┐     stdio/JSON-RPC      ┌──────────────┐
│ Claude Code  │ ◄──────────────────────► │ imessage-mcp │
└─────────────┘                          └──────┬───────┘
                                                │
                         ┌──────────────────────┼──────────────────────┐
                         │                      │                      │
                         ▼                      ▼                      ▼
              ~/Library/Messages/     AddressBook/*.abcddb      osascript (JXA)
                  chat.db                (read-only)           Messages.app
                (read-only)           Contact resolution         (send)
              Message history
```

- **Reading**: Queries `chat.db` directly via SQLite (read-only). Message text is extracted from the `attributedBody` column using a custom binary parser for Apple's typedstream format (NSArchiver), falling back to the `text` column.
- **Contacts**: Reads Apple's AddressBook SQLite databases to build a phone/email → name lookup map. Phone numbers are normalized for matching (strips formatting, handles US country code).
- **Sending**: Invokes Messages.app through JXA (`osascript -l JavaScript`). Message text is safely encoded via `JSON.stringify()`. Only targets existing conversations by chat GUID.

## CLI reference

```
imessage-mcp                                      Start MCP server (stdio)
imessage-mcp status                               Check database access
imessage-mcp chats [limit]                        List recent chats
imessage-mcp messages <chatId> [limit] [cursor]   Read messages
imessage-mcp search <query> [chatId] [limit]      Search messages
imessage-mcp participants <chatId>                 List participants
imessage-mcp send <chatId> <text>                  Send a message
```

## Development

```bash
git clone https://github.com/daveremy/imessage-mcp.git
cd imessage-mcp
npm install
npm run build

# Test directly
npx tsx src/cli.ts status
npx tsx src/cli.ts chats

# Test as MCP server
npx @modelcontextprotocol/inspector -- npx tsx src/mcp.ts
```

### Project structure

```
src/
  mcp.ts              MCP server entry (stdio transport, tool registration)
  cli.ts              CLI entry (argument parsing, dual-mode)
  db.ts               SQLite queries against ~/Library/Messages/chat.db
  contacts.ts         Contact resolution from AddressBook databases
  typedstream.ts      Binary parser for attributedBody (NSArchiver format)
  applescript.ts      Send messages via JXA → Messages.app
  types.ts            TypeScript interfaces
  version.ts          Version from package.json
  tools/
    status.ts         im_status implementation
    chats.ts          im_chats implementation
    messages.ts       im_messages implementation
    search.ts         im_search implementation
    send.ts           im_send implementation
    participants.ts   im_participants implementation
```

## Known limitations

- **Phone normalization is US-centric**: 10-digit numbers get a "1" prefix. International numbers with different country code lengths may not resolve to contacts.
- **Typedstream parser is best-effort**: Handles the common single-string NSAttributedString. Multi-segment bodies, inline attachment references, or unusual class hierarchies return `(no text content)`.
- **Attachments are metadata only**: Filenames and sizes are shown, but attachment file contents are not read or returned.
- **Search scans recent messages**: Up to 5,000 most recent messages, not the full history. The completeness line tells you exactly how much was covered.
- **No conversation creation**: `im_send` only sends to existing chats. It cannot start new conversations.

## License

MIT
