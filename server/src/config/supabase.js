import { createClient } from '@supabase/supabase-js';
import { config } from './env.js';

const clientOpts = { auth: { autoRefreshToken: false, persistSession: false } };

// Service-role client: full DB access, BYPASSES Row Level Security.
// Used for all data operations (authorization is enforced in the service layer).
export const db = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, clientOpts);

// Anon client: used only to validate user access tokens (auth.getUser).
export const authClient = createClient(config.supabaseUrl, config.supabaseAnonKey, clientOpts);
