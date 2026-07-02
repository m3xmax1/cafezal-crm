import { createApp } from './app.js';
import { config } from './config/env.js';
import { startScheduler } from './scheduler/dailyReminder.js';
import { startCassaScheduler } from './scheduler/cassaSync.js';

const app = createApp();

app.listen(config.port, () => {
  console.log(`☕ Cafezal CRM API listening on http://localhost:${config.port}`);
  startScheduler();
  startCassaScheduler();
});
