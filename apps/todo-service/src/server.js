import 'dotenv/config';
import { fileURLToPath } from 'url';
import client from 'prom-client';
import { createApp } from './app.js';
import { ensureTodoTables, pool } from './config/db.js';

const port = process.env.PORT || 5002;

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: 'todo_service_http_requests_total',
  help: 'Total HTTP requests received by todo-service',
  labelNames: ['method', 'route', 'status_code']
});

const todoItemsCreatedCounter = new client.Counter({
  name: 'todo_items_created_total',
  help: 'Total todo items created'
});

const todoItemsDeletedCounter = new client.Counter({
  name: 'todo_items_deleted_total',
  help: 'Total todo items deleted'
});

const todoItemsUpdatedCounter = new client.Counter({
  name: 'todo_items_updated_total',
  help: 'Total todo items updated (title or completion status)'
});

const totalTodosGauge = new client.Gauge({
  name: 'todo_total_items',
  help: 'Total todo items currently in the database',
  async collect() {
    try {
      const result = await pool.query('SELECT COUNT(*) FROM todos');
      this.set(parseInt(result.rows[0].count, 10));
    } catch (_) { /* DB unavailable during scrape — skip */ }
  }
});

const activeTodosGauge = new client.Gauge({
  name: 'todo_active_items',
  help: 'Total incomplete (active) todo items in the database',
  async collect() {
    try {
      const result = await pool.query('SELECT COUNT(*) FROM todos WHERE completed = false');
      this.set(parseInt(result.rows[0].count, 10));
    } catch (_) { /* DB unavailable during scrape — skip */ }
  }
});

const completedTodosGauge = new client.Gauge({
  name: 'todo_completed_items',
  help: 'Total completed todo items in the database',
  async collect() {
    try {
      const result = await pool.query('SELECT COUNT(*) FROM todos WHERE completed = true');
      this.set(parseInt(result.rows[0].count, 10));
    } catch (_) { /* DB unavailable during scrape — skip */ }
  }
});

const uniqueTodoUsersGauge = new client.Gauge({
  name: 'todo_unique_users',
  help: 'Number of distinct users who have at least one todo',
  async collect() {
    try {
      const result = await pool.query('SELECT COUNT(DISTINCT user_id) FROM todos');
      this.set(parseInt(result.rows[0].count, 10));
    } catch (_) { /* DB unavailable during scrape — skip */ }
  }
});

register.registerMetric(httpRequestCounter);
register.registerMetric(todoItemsCreatedCounter);
register.registerMetric(todoItemsDeletedCounter);
register.registerMetric(todoItemsUpdatedCounter);
register.registerMetric(totalTodosGauge);
register.registerMetric(activeTodosGauge);
register.registerMetric(completedTodosGauge);
register.registerMetric(uniqueTodoUsersGauge);

// ── Named middleware (passed into createApp so they run before routes) ────────
function loggingMiddleware(req, res, next) {
  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(JSON.stringify({
      service: 'todo-service',
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
    }));
  });
  next();
}

function metricsMiddleware(req, res, next) {
  res.on('finish', () => {
    const routePath = req.route?.path || req.path;
    httpRequestCounter.inc({ method: req.method, route: routePath, status_code: res.statusCode });

    // Business event counters derived from route + method + status
    if (routePath === '/' && req.method === 'POST' && res.statusCode === 201) {
      todoItemsCreatedCounter.inc();
    }
    if (routePath === '/:id' && req.method === 'DELETE' && res.statusCode === 200) {
      todoItemsDeletedCounter.inc();
    }
    if (routePath === '/:id' && req.method === 'PUT' && res.statusCode === 200) {
      todoItemsUpdatedCounter.inc();
    }
  });
  next();
}

// ── Build the app with injected middleware ────────────────────────────────────
const app = createApp({ middleware: [loggingMiddleware, metricsMiddleware] });

app.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ── Start the server only when run directly (not imported by tests) ───────────
const isMain = Boolean(process.argv[1]) &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  ensureTodoTables()
    .then(() => app.listen(port, () => console.log(`todo-service running on ${port}`)))
    .catch((err) => {
      console.error('failed to initialize todo-service', err);
      process.exit(1);
    });
}
