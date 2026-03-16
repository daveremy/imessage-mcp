/**
 * Extract plain text from an NSArchiver typedstream (attributedBody blob).
 *
 * This is a best-effort parser for the common single-string NSAttributedString case.
 * Returns null if parsing fails — callers should fall back to the `text` column.
 */
export function extractTextFromAttributedBody(blob: Buffer): string | null {
  if (!blob || blob.length < 20) return null;

  // Verify typedstream magic
  if (blob[0] !== 0x04 || blob[1] !== 0x0b) return null;

  // Look for the text marker: 0x01 followed by 0x2B (or similar patterns)
  // The marker 0x01+ is followed by length-prefixed UTF-8 string
  const marker = findMarker(blob);
  if (marker < 0) return null;

  const lengthOffset = marker + 1;
  if (lengthOffset >= blob.length) return null;

  const { length, dataOffset } = readLength(blob, lengthOffset);
  if (length <= 0 || dataOffset + length > blob.length) return null;

  try {
    const text = blob.subarray(dataOffset, dataOffset + length).toString('utf-8');
    // Sanity check: should contain printable characters
    if (text.length === 0) return null;
    return text;
  } catch {
    return null;
  }
}

function findMarker(blob: Buffer): number {
  // Strategy: look for the +[NSString ...] marker pattern
  // In typedstream, the text content typically follows a specific sequence.
  // We search for the byte sequence that precedes the string content.

  // Primary pattern: find 0x84 0x01 sequence (NSMutableString indicator)
  // followed eventually by the string length + data
  // Actually, the most reliable pattern is finding "+\x00" or the 0x01 0x2B marker

  // Look for 0x01 0x2B pattern (type marker for the string content)
  for (let i = 0; i < blob.length - 2; i++) {
    if (blob[i] === 0x01 && blob[i + 1] === 0x2b) {
      return i + 1; // position of 0x2B, length follows
    }
  }

  // Alternate: look for NSString class reference followed by string data
  // The pattern is: after class definitions, a length byte, then the string
  const nsStringIdx = blob.indexOf('NSString', 0, 'utf-8');
  if (nsStringIdx >= 0) {
    // Scan forward from NSString for a viable length + string
    for (let i = nsStringIdx + 8; i < Math.min(nsStringIdx + 50, blob.length - 1); i++) {
      const { length, dataOffset } = readLength(blob, i);
      if (length > 0 && length < 100000 && dataOffset + length <= blob.length) {
        const candidate = blob.subarray(dataOffset, dataOffset + length).toString('utf-8');
        // Check if it looks like real text (has some printable ASCII)
        if (/[\x20-\x7e]/.test(candidate) && !/[\x00-\x08]/.test(candidate)) {
          return i - 1; // return position before the length byte
        }
      }
    }
  }

  return -1;
}

function readLength(blob: Buffer, offset: number): { length: number; dataOffset: number } {
  if (offset >= blob.length) return { length: -1, dataOffset: offset };

  const firstByte = blob[offset];

  if (firstByte < 0x80) {
    // Direct length
    return { length: firstByte, dataOffset: offset + 1 };
  }

  if (firstByte === 0x81) {
    // uint16 LE
    if (offset + 3 > blob.length) return { length: -1, dataOffset: offset };
    const length = blob.readUInt16LE(offset + 1);
    return { length, dataOffset: offset + 3 };
  }

  if (firstByte === 0x82) {
    // uint32 LE
    if (offset + 5 > blob.length) return { length: -1, dataOffset: offset };
    const length = blob.readUInt32LE(offset + 1);
    return { length, dataOffset: offset + 5 };
  }

  return { length: -1, dataOffset: offset };
}
