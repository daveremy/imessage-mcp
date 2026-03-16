# imessage-mcp

MCP server for reading and sending iMessages from Claude Code. Resolves phone numbers and emails to Apple Contacts names automatically.

**macOS only** — requires Full Disk Access for the terminal app.

## Setup

### Claude Code Plugin

```bash
claude plugin add /path/to/imessage-mcp
```

### Manual MCP Config

Add to your Claude Code MCP settings:

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

### Prerequisites

1. **Full Disk Access**: System Settings → Privacy & Security → Full Disk Access → add your terminal app
2. **Contacts** (optional): If contact names aren't resolving, grant Contacts permission to your terminal app
3. **Messages.app**: Must be signed in for sending messages

## Tools

| Tool | Description |
|------|-------------|
| `im_status` | Check database access, contacts, counts |
| `im_chats` | List recent chats with contact names |
| `im_messages` | Read messages with pagination |
| `im_search` | Search message history |
| `im_send` | Send a message (requires confirmation) |
| `im_participants` | List chat participants |

## CLI Usage

```bash
npx imessage-mcp status
npx imessage-mcp chats [limit]
npx imessage-mcp messages <chatId> [limit] [cursor]
npx imessage-mcp search <query> [chatId] [limit]
npx imessage-mcp participants <chatId>
npx imessage-mcp send <chatId> <text>
```

Run without arguments to start the MCP server on stdio.

## Development

```bash
npm install
npm run build
npx tsx src/cli.ts status
```

## Known Limitations

- International phone number normalization is US-centric (10-digit numbers get "1" prefix)
- Typedstream parser handles common single-string NSAttributedString; complex multi-segment bodies may show "(no text content)"
- Attachment content is not readable — only filenames and sizes are shown
- Search scans up to 5000 recent messages, not the full history
