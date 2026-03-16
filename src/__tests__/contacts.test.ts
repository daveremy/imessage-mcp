import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhone,
  suffixKey,
  buildName,
  formatSender,
  resolveHandle,
  _setContactMapForTesting,
} from '../contacts.js';

describe('normalizePhone', () => {
  it('prepends 1 to 10-digit US numbers', () => {
    assert.equal(normalizePhone('5551234567'), '15551234567');
  });

  it('strips formatting and prepends 1', () => {
    assert.equal(normalizePhone('(555) 123-4567'), '15551234567');
  });

  it('keeps 11-digit numbers as-is', () => {
    assert.equal(normalizePhone('+1 (555) 123-4567'), '15551234567');
  });

  it('keeps international numbers as-is', () => {
    assert.equal(normalizePhone('+44 7911 123456'), '447911123456');
  });

  it('handles digits-only input', () => {
    assert.equal(normalizePhone('15551234567'), '15551234567');
  });
});

describe('suffixKey', () => {
  it('returns last 10 digits of 11-digit number', () => {
    assert.equal(suffixKey('15551234567'), '5551234567');
  });

  it('returns last 10 digits of international number', () => {
    assert.equal(suffixKey('447911123456'), '7911123456');
  });

  it('returns full string if shorter than 10 digits', () => {
    assert.equal(suffixKey('1234567'), '1234567');
  });

  it('returns full string if exactly 10 digits', () => {
    assert.equal(suffixKey('5551234567'), '5551234567');
  });
});

describe('buildName', () => {
  it('combines first and last name', () => {
    assert.equal(buildName('John', 'Doe', null, null), 'John Doe');
  });

  it('uses first name only', () => {
    assert.equal(buildName('John', null, null, null), 'John');
  });

  it('uses last name only', () => {
    assert.equal(buildName(null, 'Doe', null, null), 'Doe');
  });

  it('falls back to organization', () => {
    assert.equal(buildName(null, null, 'Acme Corp', null), 'Acme Corp');
  });

  it('falls back to nickname', () => {
    assert.equal(buildName(null, null, null, 'Johnny'), 'Johnny');
  });

  it('returns null when all fields are null', () => {
    assert.equal(buildName(null, null, null, null), null);
  });

  it('prefers first+last over org', () => {
    assert.equal(buildName('John', 'Doe', 'Acme', 'Johnny'), 'John Doe');
  });

  it('prefers org over nickname', () => {
    assert.equal(buildName(null, null, 'Acme', 'Johnny'), 'Acme');
  });
});

describe('formatSender', () => {
  beforeEach(() => {
    _setContactMapForTesting(new Map([
      ['+15551234567', 'John Doe'],
      ['15551234567', 'John Doe'],
      ['5551234567', 'John Doe'],
    ]));
  });

  it('returns "Me" for is_from_me', () => {
    assert.equal(formatSender('+15551234567', true), 'Me');
  });

  it('returns "Unknown" for null handle', () => {
    assert.equal(formatSender(null, false), 'Unknown');
  });

  it('returns resolved name with handle in parens', () => {
    assert.equal(formatSender('+15551234567', false), 'John Doe (+15551234567)');
  });

  it('returns raw handle when no contact match', () => {
    assert.equal(formatSender('+15559999999', false), '+15559999999');
  });
});

describe('resolveHandle', () => {
  beforeEach(() => {
    _setContactMapForTesting(new Map([
      ['+15551234567', 'John Doe'],
      ['15551234567', 'John Doe'],
      ['5551234567', 'John Doe'],
      ['alice@example.com', 'Alice Smith'],
    ]));
  });

  it('resolves phone number with + prefix', () => {
    assert.equal(resolveHandle('+15551234567'), 'John Doe');
  });

  it('resolves email address', () => {
    assert.equal(resolveHandle('alice@example.com'), 'Alice Smith');
  });

  it('resolves email case-insensitively', () => {
    assert.equal(resolveHandle('Alice@Example.COM'), 'Alice Smith');
  });

  it('returns null for unknown handle', () => {
    assert.equal(resolveHandle('+15559999999'), null);
  });

  it('resolves via phone normalization', () => {
    assert.equal(resolveHandle('(555) 123-4567'), 'John Doe');
  });
});
