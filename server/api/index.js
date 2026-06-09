// Vercel serverless entry point.
// Vercel runs functions on demand, so the in-process node-cron scheduler does
// NOT run here — use Vercel Cron (see server/vercel.json) to hit
// /api/cron/daily-reminder once a day.
import { createApp } from '../src/app.js';

const app = createApp();

export default app;
