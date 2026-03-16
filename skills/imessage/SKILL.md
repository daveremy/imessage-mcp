---
name: imessage
description: Read and send iMessages — status check, chat listing, message reading, search, and sending
allowed-tools: mcp__imessage-mcp__im_status, mcp__imessage-mcp__im_chats, mcp__imessage-mcp__im_messages, mcp__imessage-mcp__im_search, mcp__imessage-mcp__im_send, mcp__imessage-mcp__im_participants
---

# iMessage Companion Skill

You have access to iMessage tools. Follow this workflow:

## First-Time Setup
1. Run `im_status` to verify database access and contacts resolution
2. If Full Disk Access is missing, guide the user to System Settings → Privacy & Security → Full Disk Access

## Workflow
1. **List chats**: Use `im_chats` to show recent conversations with contact names
2. **Read messages**: Use `im_messages` with a chat ID to read conversation history
3. **Search**: Use `im_search` to find messages containing specific text
4. **Participants**: Use `im_participants` to see who's in a group chat
5. **Send**: Use `im_send` to send a message — **always confirm with the user first**

## Presentation
- Show contact names first, handles in parentheses
- Display messages chronologically
- When paginating, tell the user more messages are available and offer to load them
- For search results, mention how many messages were searched out of the total

## Important
- Never send a message without explicit user confirmation
- Chat IDs are the numbers shown by `im_chats` (ROWID)
- If contacts aren't resolving, suggest checking Contacts permission for the terminal app
