import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import opportunitiesRoutes from './routes/opportunities.routes.js';
import meRoutes from './routes/me.routes.js';
import cronRoutes from './routes/cron.routes.js';
import agendaRoutes from './routes/agenda.routes.js';
import samplesRoutes from './routes/samples.routes.js';
import velocityRoutes from './routes/velocity.routes.js';

export function createApp() {
  const app = express();

  const origin =
    config.clientOrigin === '*'
      ? '*'
      : config.clientOrigin.split(',').map((s) => s.trim());

  app.use(cors({ origin, credentials: false }));
  app.use(express.json({ limit: '12mb' })); // generous limit for bulk CSV import

  app.get('/api/health', (req, res) =>
    res.json({ ok: true, service: 'cafezal-crm', time: new Date().toISOString() }),
  );

  app.use('/api/me', meRoutes);
  app.use('/api/opportunities', opportunitiesRoutes);
  app.use('/api/agenda', agendaRoutes);
  app.use('/api/samples', samplesRoutes);
  app.use('/api/velocity', velocityRoutes);
  app.use('/api/cron', cronRoutes);

  // 404
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));

  // Centralized error handler
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) console.error('[error]', err);
    res.status(status).json({ error: err.message || 'Internal server error' });
  });

  return app;
}
