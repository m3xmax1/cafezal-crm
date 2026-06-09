import { config } from '../config/env.js';
import { EMAIL_TO_COMMERCIALE } from './constants.js';

/**
 * Resolve a user's authorization scope from their email.
 * - isAdmin: can see/edit every opportunity
 * - commerciale: the enum value they own (or null)
 */
export function resolveUserScope(email) {
  const e = (email || '').toLowerCase();
  return {
    email: e,
    isAdmin: config.adminEmails.includes(e),
    commerciale: EMAIL_TO_COMMERCIALE[e] || null,
  };
}
