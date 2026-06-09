import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

let transporter = null;

export function getTransporter() {
  if (transporter) return transporter;

  if (!config.smtp.host) {
    // No SMTP configured → log instead of sending (handy for local dev).
    console.warn('[mailer] SMTP_HOST not set — emails will be logged, not sent.');
    transporter = {
      sendMail: async (opts) => {
        console.log(`[mailer:dev] (not sent) to=${opts.to} subject="${opts.subject}"`);
        return { messageId: 'dev-noop' };
      },
    };
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure, // true for 465, false for 587/STARTTLS
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });

  return transporter;
}

export async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  return t.sendMail({ from: config.smtp.from, to, subject, html });
}
