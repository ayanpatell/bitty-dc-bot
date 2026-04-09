import { describe, expect, it } from 'vitest';
import { isAllowed, parseAllowlist } from '../src/utils/allowlist.js';

describe('parseAllowlist', () => {
  it('parses a single valid E.164 number', () => {
    const set = parseAllowlist('+14155551234');
    expect(set.has('+14155551234')).toBe(true);
    expect(set.size).toBe(1);
  });

  it('parses multiple comma-separated numbers', () => {
    const set = parseAllowlist('+14155551234,+12125559876');
    expect(set.size).toBe(2);
    expect(set.has('+14155551234')).toBe(true);
    expect(set.has('+12125559876')).toBe(true);
  });

  it('trims whitespace around entries', () => {
    const set = parseAllowlist('  +14155551234 , +12125559876  ');
    expect(set.has('+14155551234')).toBe(true);
    expect(set.has('+12125559876')).toBe(true);
  });

  it('filters empty strings from trailing commas', () => {
    const set = parseAllowlist('+14155551234,');
    expect(set.size).toBe(1);
  });

  it('returns empty set for empty string', () => {
    expect(parseAllowlist('').size).toBe(0);
  });

  it('skips malformed entries (not E.164)', () => {
    const set = parseAllowlist('14155551234,+14155551234');
    expect(set.size).toBe(1);
    expect(set.has('+14155551234')).toBe(true);
  });

  it('skips bare numbers without + prefix', () => {
    const set = parseAllowlist('14155551234');
    expect(set.size).toBe(0);
  });
});

describe('isAllowed', () => {
  const allowed = new Set(['+14155551234', '+12125559876']);

  it('returns true for a number in the set', () => {
    expect(isAllowed('+14155551234', allowed)).toBe(true);
  });

  it('returns false for a number not in the set', () => {
    expect(isAllowed('+19999999999', allowed)).toBe(false);
  });

  it('returns false for empty set', () => {
    expect(isAllowed('+14155551234', new Set())).toBe(false);
  });

  it('is case-sensitive (E.164 always uses + prefix, numbers only)', () => {
    // Ensure no accidental case folding
    expect(isAllowed('+14155551234', new Set(['+14155551234']))).toBe(true);
  });
});
