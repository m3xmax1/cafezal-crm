import { authClient } from '../config/supabase.js';
import { resolveUserScope } from '../lib/roles.js';

/**
 * Validates the Supabase access token sent as `Authorization: Bearer <jwt>`
 * and attaches req.user = { id, email, isAdmin, commerciale }.
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) return res.status(401).json({ error: 'Missing bearer token' });

    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const scope = resolveUserScope(data.user.email);
    req.user = { id: data.user.id, ...scope };
    return next();
  } catch (err) {
    return next(err);
  }
}
