import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractTextFromAttributedBody } from '../typedstream.js';
import {
  SHORT_MESSAGE, SHORT_MESSAGE_TEXT,
  MEDIUM_MESSAGE, MEDIUM_MESSAGE_TEXT,
  LONG_MESSAGE, LONG_MESSAGE_TEXT,
  EMOJI_MESSAGE, EMOJI_MESSAGE_TEXT,
  MALFORMED_BLOB, TINY_BLOB,
} from './fixtures/typedstream-blobs.js';

describe('extractTextFromAttributedBody', () => {
  it('returns null for empty buffer', () => {
    assert.equal(extractTextFromAttributedBody(Buffer.alloc(0)), null);
  });

  it('returns null for buffer smaller than 20 bytes', () => {
    assert.equal(extractTextFromAttributedBody(TINY_BLOB), null);
  });

  it('returns null for wrong magic bytes', () => {
    assert.equal(extractTextFromAttributedBody(MALFORMED_BLOB), null);
  });

  it('returns null for null input', () => {
    assert.equal(extractTextFromAttributedBody(null as any), null);
  });

  it('extracts short single-char message', () => {
    const result = extractTextFromAttributedBody(SHORT_MESSAGE);
    assert.equal(result, SHORT_MESSAGE_TEXT);
  });

  it('extracts medium-length message', () => {
    const result = extractTextFromAttributedBody(MEDIUM_MESSAGE);
    assert.equal(result, MEDIUM_MESSAGE_TEXT);
  });

  it('extracts long message with 0x81 length encoding', () => {
    const result = extractTextFromAttributedBody(LONG_MESSAGE);
    assert.equal(result, LONG_MESSAGE_TEXT);
  });

  it('extracts message with emoji and smart quotes', () => {
    const result = extractTextFromAttributedBody(EMOJI_MESSAGE);
    assert.equal(result, EMOJI_MESSAGE_TEXT);
  });

  it('long message uses NSMutableAttributedString class', () => {
    // Verify the long blob starts with the right magic
    assert.equal(LONG_MESSAGE[0], 0x04);
    assert.equal(LONG_MESSAGE[1], 0x0b);
    // And contains NSMutableAttributedString (different class from short messages)
    assert.ok(LONG_MESSAGE.includes(Buffer.from('NSMutableAttributedString')));
  });
});
