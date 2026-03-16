#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { VERSION } from './version.js';
import { handleStatus } from './tools/status.js';
import { handleChats } from './tools/chats.js';
import { handleMessages } from './tools/messages.js';
import { handleSearch } from './tools/search.js';
import { handleSend } from './tools/send.js';
import { handleParticipants } from './tools/participants.js';

const server = new McpServer({
  name: 'imessage-mcp',
  version: VERSION,
});

// im_status — verify access and show counts
server.tool(
  'im_status',
  'Check iMessage database access, contacts access, and show chat/message counts. Run this first to verify everything works.',
  async () => handleStatus()
);

// im_chats — list recent chats
server.tool(
  'im_chats',
  'List recent iMessage chats with resolved contact names, ordered by most recent activity.',
  { limit: z.number().optional().describe('Maximum chats to return (default 20)') },
  async (args) => handleChats(args)
);

// im_messages — read messages from a chat
server.tool(
  'im_messages',
  'Read messages from an iMessage chat. Returns chronological messages with sender names, attachments, and reactions. Use the cursor parameter to page through older messages.',
  {
    chatId: z.number().describe('Chat ID (ROWID from im_chats)'),
    limit: z.number().optional().describe('Maximum messages to return (default 50)'),
    cursor: z.string().optional().describe('Opaque cursor from previous response for pagination'),
  },
  async (args) => handleMessages(args)
);

// im_search — search messages
server.tool(
  'im_search',
  'Search iMessage history for messages containing a query string. Searches up to 5000 recent messages.',
  {
    query: z.string().describe('Text to search for (case-insensitive)'),
    chatId: z.number().optional().describe('Limit search to a specific chat ID'),
    limit: z.number().optional().describe('Maximum results to return (default 20)'),
  },
  async (args) => handleSearch(args)
);

// im_send — send a message
server.tool(
  'im_send',
  'Send an iMessage to an existing chat. IMPORTANT: Always confirm with the user before calling this tool.',
  {
    chatId: z.number().describe('Chat ID (ROWID from im_chats)'),
    text: z.string().describe('Message text to send'),
  },
  async (args) => handleSend(args)
);

// im_participants — list chat participants
server.tool(
  'im_participants',
  'List participants in an iMessage chat with resolved contact names.',
  {
    chatId: z.number().describe('Chat ID (ROWID from im_chats)'),
  },
  async (args) => handleParticipants(args)
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`imessage-mcp v${VERSION} running on stdio`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
