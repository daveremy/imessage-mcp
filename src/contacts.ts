import { DatabaseSync } from 'node:sqlite';
import { homedir } from 'os';
import { globSync } from 'glob';

const AB_GLOB = `${homedir()}/Library/Application Support/AddressBook/Sources/*/AddressBook-v*.abcddb`;

let _contactMap: Map<string, string> | null = null;
let _abFiles: string[] | null = null;

/** Override the contact map for testing. Pass null to reset. */
export function _setContactMapForTesting(map: Map<string, string> | null): void {
  _contactMap = map;
}

function getAbFiles(): string[] {
  // Only cache non-empty results so we retry if contacts weren't available yet
  if (_abFiles !== null && _abFiles.length > 0) return _abFiles;
  _abFiles = globSync(AB_GLOB);
  return _abFiles;
}

export function contactsDbExists(): boolean {
  return getAbFiles().length > 0;
}

export function canAccessContacts(): { ok: boolean; error?: string; filesExist: boolean } {
  const filesExist = contactsDbExists();
  if (!filesExist) {
    return { ok: false, error: 'No AddressBook database files found.', filesExist: false };
  }
  try {
    loadContacts();
    return { ok: true, filesExist: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg, filesExist: true };
  }
}

/** Exported for testing. */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return '1' + digits; // US number, prepend country code
  }
  return digits;
}

/** Exported for testing. */
export function suffixKey(digits: string): string {
  return digits.slice(-10);
}

function loadContacts(): Map<string, string> {
  if (_contactMap) return _contactMap;

  const map = new Map<string, string>();
  const files = getAbFiles();

  for (const file of files) {
    try {
      const db = new DatabaseSync(file, { readOnly: true });

      // Load phone numbers
      try {
        const phones = db.prepare(`
          SELECT
            r.ZFIRSTNAME, r.ZLASTNAME, r.ZORGANIZATION, r.ZNICKNAME,
            p.ZFULLNUMBER
          FROM ZABCDRECORD r
          JOIN ZABCDPHONENUMBER p ON p.ZOWNER = r.Z_PK
          WHERE p.ZFULLNUMBER IS NOT NULL
        `).all() as Array<{
          ZFIRSTNAME: string | null;
          ZLASTNAME: string | null;
          ZORGANIZATION: string | null;
          ZNICKNAME: string | null;
          ZFULLNUMBER: string;
        }>;

        for (const row of phones) {
          const name = buildName(row.ZFIRSTNAME, row.ZLASTNAME, row.ZORGANIZATION, row.ZNICKNAME);
          if (!name) continue;
          const normalized = normalizePhone(row.ZFULLNUMBER);
          if (normalized.length >= 7) {
            map.set(normalized, name);
            map.set(suffixKey(normalized), name);
            // Also store with + prefix for exact handle matching
            map.set('+' + normalized, name);
          }
        }
      } catch {
        // Phone table might not exist in all sources
      }

      // Load email addresses
      try {
        const emails = db.prepare(`
          SELECT
            r.ZFIRSTNAME, r.ZLASTNAME, r.ZORGANIZATION, r.ZNICKNAME,
            e.ZADDRESS
          FROM ZABCDRECORD r
          JOIN ZABCDEMAILADDRESS e ON e.ZOWNER = r.Z_PK
          WHERE e.ZADDRESS IS NOT NULL
        `).all() as Array<{
          ZFIRSTNAME: string | null;
          ZLASTNAME: string | null;
          ZORGANIZATION: string | null;
          ZNICKNAME: string | null;
          ZADDRESS: string;
        }>;

        for (const row of emails) {
          const name = buildName(row.ZFIRSTNAME, row.ZLASTNAME, row.ZORGANIZATION, row.ZNICKNAME);
          if (!name) continue;
          map.set(row.ZADDRESS.toLowerCase(), name);
        }
      } catch {
        // Email table might not exist in all sources
      }

      db.close();
    } catch {
      // Skip unreadable DB files
    }
  }

  _contactMap = map;
  return map;
}

/** Exported for testing. */
export function buildName(
  first: string | null,
  last: string | null,
  org: string | null,
  nickname: string | null
): string | null {
  const parts: string[] = [];
  if (first) parts.push(first);
  if (last) parts.push(last);
  if (parts.length > 0) return parts.join(' ');
  if (org) return org;
  if (nickname) return nickname;
  return null;
}

export function resolveHandle(handle: string): string | null {
  const map = loadContacts();

  // Direct lookup (email or already-normalized)
  const directMatch = map.get(handle.toLowerCase());
  if (directMatch) return directMatch;

  // Phone normalization lookup
  const digits = handle.replace(/\D/g, '');
  if (digits.length >= 7) {
    const normalized = normalizePhone(handle);
    const match = map.get(normalized);
    if (match) return match;

    // Suffix fallback
    const suffix = suffixKey(digits);
    const suffixMatch = map.get(suffix);
    if (suffixMatch) return suffixMatch;
  }

  return null;
}

export function formatSender(handle: string | null, isFromMe: boolean): string {
  if (isFromMe) return 'Me';
  if (!handle) return 'Unknown';
  const name = resolveHandle(handle);
  if (name) return `${name} (${handle})`;
  return handle;
}

export function getContactCount(): number {
  const map = loadContacts();
  // Count unique names (values), not keys (which include multiple lookups per contact)
  return new Set(map.values()).size;
}
