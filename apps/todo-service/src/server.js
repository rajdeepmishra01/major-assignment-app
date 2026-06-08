import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import todoRoutes from './routes/todo.routes.js';
import { ensureTodoTables, pool } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const port = process.env.PORT || 5002;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ service: 'todo-service', status: 'healthy' });
});

app.use('/api/todos', todoRoutes);
app.use(errorHandler);

ensureTodoTables()
  .then(() => app.listen(port, () => console.log(`todo-service running on ${port}`)))
  .catch((err) => {
    console.error('failed to initialize todo-service', err);
    process.exit(1);
  });
