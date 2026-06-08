import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.routes.js';
import { ensureAuthTables, pool } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const port = process.env.PORT || 5001;

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', async (req, res) => {
  await pool.query('SELECT 1');
  res.json({ service: 'auth-service', status: 'healthy' });
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
