import { describe, it, expect } from 'vitest';
import { generatePortalToken, PORTAL_TOKEN_HEX_LENGTH } from '../../src/lib/token';

describe('generatePortalToken', () => {
  it('produces a 64-character lowercase hex string', () => {
    const token = generatePortalToken();
    expect(token).toHaveLength(PORTAL_TOKEN_HEX_LENGTH);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces unique values across calls', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      tokens.add(generatePortalToken());
    }
    expect(tokens.size).toBe(1000);
  });
});
