import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { appleNsToDate, formatDate } from '../db.js';

describe('appleNsToDate', () => {
  it('returns null for null input', () => {
    assert.equal(appleNsToDate(null), null);
  });

  it('returns null for 0', () => {
    assert.equal(appleNsToDate(0), null);
  });

  it('returns null for 0n', () => {
    assert.equal(appleNsToDate(0n), null);
  });

  it('converts BigInt timestamp correctly', () => {
    // 763832600 seconds since Apple epoch = Mar 15 2025 14:30:00 UTC
    // Apple epoch is 2001-01-01 00:00:00 UTC = Unix 978307200
    // Unix timestamp = 763832600 + 978307200 = 1742139800
    const ns = 763832600000000000n;
    const result = appleNsToDate(ns);
    assert.ok(result instanceof Date);
    assert.equal(result!.getTime(), 1742139800000);
  });

  it('converts number timestamp correctly', () => {
    // Use a smaller timestamp that fits in a JS number safely
    // 100000000 * 1e9 = 100000000000000000 (within safe integer? No, > MAX_SAFE_INTEGER)
    // Use a value small enough: 1000000 seconds as ns = 1000000000000000
    const ns = 1000000 * 1_000_000_000;
    const result = appleNsToDate(ns);
    assert.ok(result instanceof Date);
    // Apple epoch + 1000000 seconds
    const expectedUnix = (978307200 + 1000000) * 1000;
    assert.equal(result!.getTime(), expectedUnix);
  });

  it('handles typical iMessage timestamps (BigInt from node:sqlite)', () => {
    // Real-world value: 795328435894029184n (nanoseconds)
    const ns = 795328435894029184n;
    const result = appleNsToDate(ns);
    assert.ok(result instanceof Date);
    assert.ok(!isNaN(result!.getTime()));
    // Should be a date in 2026
    assert.equal(result!.getFullYear(), 2026);
  });
});

describe('formatDate', () => {
  it('returns empty string for null', () => {
    assert.equal(formatDate(null), '');
  });

  it('formats a date with month, day, time', () => {
    const date = new Date('2025-06-15T14:30:00');
    const result = formatDate(date);
    // Should contain "Jun 15" and time
    assert.ok(result.includes('Jun'));
    assert.ok(result.includes('15'));
  });
});
