import { randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;

/**
 * Generate a cryptographically random portal token.
 * 32 bytes of entropy → 64 lowercase hex characters.
 * Used for read-only client-portal magic links (T8/T17).
 */
export function generatePortalToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

export const PORTAL_TOKEN_HEX_LENGTH = TOKEN_BYTES * 2;
