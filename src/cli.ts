#!/usr/bin/env node

import { handleStatus } from './tools/status.js';
import { handleChats } from './tools/chats.js';
import { handleMessages } from './tools/messages.js';
import { handleSearch } from './tools/search.js';
import { handleSend } from './tools/send.js';
import { handleParticipants } from './tools/participants.js';
import { VERSION } from './version.js';

const args = process.argv.slice(2);
const command = args[0];

function printUsage() {
  console.log(`imessage-mcp v${VERSION}`);
  console.log('');
  console.log('Usage:');
  console.log('  imessage-mcp                    Start MCP server (stdio)');
  console.log('  imessage-mcp status             Check database access');
  console.log('  imessage-mcp chats [limit]      List recent chats');
  console.log('  imessage-mcp messages <chatId> [limit] [cursor]  Read messages');
  console.log('  imessage-mcp search <query> [chatId] [limit]     Search messages');
  console.log('  imessage-mcp participants <chatId>                List participants');
  console.log('  imessage-mcp send <chatId> <text>                 Send a message');
}

async function main() {
  if (!command || command === '--help' || command === '-h') {
    // No command = start MCP server
    if (!command) {
      const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
      const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
      const { z } = await import('zod');

      const server = new McpServer({ name: 'imessage-mcp', version: VERSION });

      server.tool('im_status', 'Check iMessage database access, contacts access, and show chat/message counts.', async () => handleStatus());
      server.tool('im_chats', 'List recent iMessage chats.', { limit: z.number().optional() }, async (a) => handleChats(a));
      server.tool('im_messages', 'Read messages from a chat.', { chatId: z.number(), limit: z.number().optional(), cursor: z.string().optional() }, async (a) => handleMessages(a));
      server.tool('im_search', 'Search message history.', { query: z.string(), chatId: z.number().optional(), limit: z.number().optional() }, async (a) => handleSearch(a));
      server.tool('im_send', 'Send a message. Always confirm with user first.', { chatId: z.number(), text: z.string() }, async (a) => handleSend(a));
      server.tool('im_participants', 'List chat participants.', { chatId: z.number() }, async (a) => handleParticipants(a));

      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error(`imessage-mcp v${VERSION} running on stdio`);
      return;
    }
    printUsage();
    return;
  }

  switch (command) {
    case 'status': {
      const result = handleStatus();
      console.log(result.content[0].text);
      break;
    }

    case 'chats': {
      const limit = args[1] ? parseInt(args[1], 10) : undefined;
      const result = handleChats({ limit });
      console.log(result.content[0].text);
      break;
    }

    case 'messages': {
      const chatId = parseInt(args[1], 10);
      if (isNaN(chatId)) {
        console.error('Error: chatId is required. Usage: imessage-mcp messages <chatId>');
        process.exit(1);
      }
      const limit = args[2] ? parseInt(args[2], 10) : undefined;
      const cursor = args[3];
      const result = handleMessages({ chatId, limit, cursor });
      console.log(result.content[0].text);
      break;
    }

    case 'search': {
      const query = args[1];
      if (!query) {
        console.error('Error: query is required. Usage: imessage-mcp search <query>');
        process.exit(1);
      }
      const chatId = args[2] ? parseInt(args[2], 10) : undefined;
      const limit = args[3] ? parseInt(args[3], 10) : undefined;
      const result = handleSearch({ query, chatId, limit });
      console.log(result.content[0].text);
      break;
    }

    case 'participants': {
      const chatId = parseInt(args[1], 10);
      if (isNaN(chatId)) {
        console.error('Error: chatId is required. Usage: imessage-mcp participants <chatId>');
        process.exit(1);
      }
      const result = handleParticipants({ chatId });
      console.log(result.content[0].text);
      break;
    }

    case 'send': {
      const chatId = parseInt(args[1], 10);
      const text = args.slice(2).join(' ');
      if (isNaN(chatId) || !text) {
        console.error('Error: chatId and text are required. Usage: imessage-mcp send <chatId> <text>');
        process.exit(1);
      }
      const result = await handleSend({ chatId, text });
      console.log(result.content[0].text);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
