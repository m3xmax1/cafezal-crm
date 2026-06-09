import dotenv from 'dotenv';

dotenv.config();

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn(
    `[env] Missing required env vars: ${missing.join(', ')}.\n` +
      '      The server will start, but Supabase calls will fail until these are set.',
  );
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',

  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,

  // Comma-separated list of allowed browser origins ("*" for any).
  clientOrigin: process.env.CLIENT_ORIGIN || '*',

  // Comma-separated list of admin emails (see everything).
  adminEmails: (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),

  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.MAIL_FROM || 'Cafezal CRM <no-reply@cafezal.com>',
  },

  cron: {
    enabled: String(process.env.CRON_ENABLED || 'true') === 'true',
    schedule: process.env.CRON_SCHEDULE || '0 9 * * *',
    timezone: process.env.CRON_TIMEZONE || 'Europe/Rome',
    secret: process.env.CRON_SECRET || '',
    daysAhead: Number(process.env.REMINDER_DAYS_AHEAD) || 3,
  },
};
