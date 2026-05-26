import express from 'express';
import cors from 'cors';
import { bfhl } from './routes.js';

export function buildApp() {
  const app = express();

  app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
  app.use(express.json({ limit: '256kb' }));

  app.get('/', (_req, res) =>
    res.json({ service: 'taskflow-api', base: '/bfhl' })
  );
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Mount the task routes under /bfhl, as the spec requires.
  app.use('/bfhl', bfhl);

  // catch-all 404 in JSON, never HTML
  app.use((req, res) =>
    res.status(404).json({ error: `route not found: ${req.method} ${req.path}` })
  );

  // last-resort error -> always JSON 500
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error('unhandled:', err);
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}
