// Creates the predefined Cafezal accounts in Supabase Auth.
// Usage:  npm run seed:users   (from the server/ folder)
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env
// Optional: SEED_USER_PASSWORD (default below), SEED_ADMIN_EMAIL.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('✗ Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env first.');
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const password = process.env.SEED_USER_PASSWORD || 'Cafezal2026!';

const commercials = ['laura@cafezal.com', 'massimo@cafezal.com', 'gabriele@cafezal.com'];
const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();

async function ensureUser(email, isAdmin) {
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: isAdmin ? { role: 'admin' } : {},
  });
  if (error) {
    if (/already.*registered|exists/i.test(error.message)) {
      console.log(`• ${email} already exists — skipped`);
    } else {
      console.error(`✗ ${email}: ${error.message}`);
    }
  } else {
    console.log(`✓ Created ${email}${isAdmin ? ' (admin)' : ''}`);
  }
}

for (const email of commercials) await ensureUser(email, false);
if (adminEmail) await ensureUser(adminEmail, true);

console.log(`\nDefault password for all accounts: ${password}`);
console.log('→ Change it after the first login (Supabase Dashboard → Authentication).');
