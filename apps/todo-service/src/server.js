import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import client from 'prom-client';
import todoRoutes from './routes/todo.routes.js';
import { ensureTodoTables, pool } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const port = process.env.PORT || 5002;

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestCounter = new client.Counter({
  name: 'todo_service_http_requests_total',
  help: 'Total HTTP requests received by todo-service',
  labelNames: ['method', 'route', 'status_code']
});

register.registerMetric(httpRequestCounter);

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  res.on('finish', () => {
    httpRequestCounter.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode
    });
  });
  next();
});

app.get('/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ service: 'todo-service', status: 'healthy' });
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

app.use('/api/todos', todoRoutes);
app.use(errorHandler);

ensureTodoTables()
  .then(() => app.listen(port, () => console.log(`todo-service running on ${port}`)))
  .catch((err) => {
    console.error('failed to initialize todo-service', err);
    process.exit(1);
  });
