import { canAccessDb, getChatCount, getMessageCount } from '../db.js';
import { canAccessContacts, getContactCount } from '../contacts.js';

export function handleStatus(): { content: Array<{ type: 'text'; text: string }> } {
  const lines: string[] = [];

  // Messages DB
  const dbAccess = canAccessDb();
  if (dbAccess.ok) {
    lines.push('Messages database: OK');
    lines.push(`  Chats: ${getChatCount()}`);
    lines.push(`  Messages: ${getMessageCount()}`);
  } else {
    lines.push('Messages database: NOT ACCESSIBLE');
    lines.push(`  Error: ${dbAccess.error}`);
    lines.push('');
    lines.push('To fix: System Settings → Privacy & Security → Full Disk Access');
    lines.push('Add your terminal app (Terminal, iTerm2, etc.) and restart it.');
  }

  lines.push('');

  // Contacts DB
  const contactsAccess = canAccessContacts();
  if (contactsAccess.ok) {
    lines.push(`Contacts: OK (${getContactCount()} contacts)`);
  } else if (contactsAccess.filesExist) {
    lines.push('Contacts: FILES EXIST BUT NOT READABLE');
    lines.push(`  Error: ${contactsAccess.error}`);
    lines.push('  This may require granting Contacts permission to your terminal app.');
  } else {
    lines.push('Contacts: No AddressBook files found');
    lines.push('  Contact name resolution will be unavailable. Raw handles will be shown.');
  }

  return {
    content: [{ type: 'text', text: lines.join('\n') }],
  };
}
