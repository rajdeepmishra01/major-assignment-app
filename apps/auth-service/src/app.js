import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { pool } from './config/db.js';

/**
 * Creates and returns the Express application.
 * @param {object} options
 * @param {import('express').RequestHandler[]} options.middleware - additional middleware
 *   injected BEFORE routes (e.g. logging, metrics).  Defaults to [].
 */
export function createApp({ middleware = [] } = {}) {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  for (const mw of middleware) {
    app.use(mw);
  }

  app.get('/health', async (_req, res, next) => {
    try {
      await pool.query('SELECT 1');
      res.json({ service: 'auth-service', status: 'healthy' });
    } catch (err) {
      next(err);
    }
  });

  app.use('/api/auth', authRoutes);
  app.use(errorHandler);

  return app;
}
