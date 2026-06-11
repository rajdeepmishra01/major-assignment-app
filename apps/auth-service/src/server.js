import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import client from 'prom-client';
import authRoutes from './routes/auth.routes.js';
import { ensureAuthTables, pool } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const port = process.env.PORT || 5001;

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: 'auth_service_http_requests_total',
  help: 'Total HTTP requests received by auth-service',
  labelNames: ['method', 'route', 'status_code']
});

const userRegistrationsCounter = new client.Counter({
  name: 'auth_user_registrations_total',
  help: 'Total successful user registrations'
});

const loginAttemptsCounter = new client.Counter({
  name: 'auth_login_attempts_total',
  help: 'Total login attempts',
  labelNames: ['result']
});

const tokenValidationsCounter = new client.Counter({
  name: 'auth_token_validations_total',
  help: 'Total token validation requests',
  labelNames: ['result']
});

const registeredUsersGauge = new client.Gauge({
  name: 'auth_registered_users_total',
  help: 'Total registered users currently in the database',
  async collect() {
    try {
      const result = await pool.query('SELECT COUNT(*) FROM users');
      this.set(parseInt(result.rows[0].count, 10));
    } catch (_) {}
  }
});

register.registerMetric(httpRequestCounter);
register.registerMetric(userRegistrationsCounter);
register.registerMetric(loginAttemptsCounter);
register.registerMetric(tokenValidationsCounter);
register.registerMetric(registeredUsersGauge);

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    console.log(
      JSON.stringify({
        service: 'auth-service',
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs
      })
    );
  });

  next();
});

app.use((req, res, next) => {
  res.on('finish', () => {
    const routePath = req.route?.path || req.path;
    httpRequestCounter.inc({
      method: req.method,
      route: routePath,
      status_code: res.statusCode
    });

    // Business event counters derived from route + status
    if (routePath === '/register' && req.method === 'POST' && res.statusCode === 201) {
      userRegistrationsCounter.inc();
    }
    if (routePath === '/login' && req.method === 'POST') {
      loginAttemptsCounter.inc({ result: res.statusCode === 200 ? 'success' : 'failure' });
    }
    if (routePath === '/validate' && req.method === 'GET') {
      tokenValidationsCounter.inc({ result: res.statusCode === 200 ? 'valid' : 'invalid' });
    }
  });
  next();
});

app.get('/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ service: 'auth-service', status: 'healthy' });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/api/auth', authRoutes);
app.use(errorHandler);

ensureAuthTables()
  .then(() => {
    app.listen(port, () => console.log(`auth-service running on ${port}`));
  })
  .catch((err) => {
    console.error('failed to initialize auth-service', err);
    process.exit(1);
  });
