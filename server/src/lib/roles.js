import { config } from '../config/env.js';
import { EMAIL_TO_COMMERCIALE, TORREFAZIONE_EMAILS, STORE_EMAIL_TO_NEGOZIO, FINANCE_EMAILS } from './constants.js';

/**
 * Resolve a user's authorization scope from their email.
 * - isAdmin: sees everything (sales + torrefazione)
 * - commerciale: the sales enum value they own (or null)
 * - isTorrefazione: roastery user (orders queue + warehouse, no sales pipeline)
 * - isFinance: finance user (read clienti/recap + ordini da fatturare; mark fatturato)
 * - store: retail store name they order for (or null)
 */
export function resolveUserScope(email) {
  const e = (email || '').toLowerCase();
  return {
    email: e,
    isAdmin: config.adminEmails.includes(e),
    commerciale: EMAIL_TO_COMMERCIALE[e] || null,
    isTorrefazione: TORREFAZIONE_EMAILS.includes(e),
    isFinance: FINANCE_EMAILS.includes(e),
    store: STORE_EMAIL_TO_NEGOZIO[e] || null,
  };
}
