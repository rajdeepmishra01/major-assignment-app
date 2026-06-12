import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Must be set before any module that reads JWT_SECRET is imported
process.env.JWT_SECRET = 'test-secret-key-for-todo-tests';

// ── Mocks (hoisted before static imports by vitest) ──────────────────────────
vi.mock('../config/db.js', () => ({
  pool: { query: vi.fn() },
  ensureTodoTables: vi.fn().mockResolvedValue(undefined),
}));

import { pool } from '../config/db.js';
import { createApp } from '../app.js';

// ── Shared fixtures ───────────────────────────────────────────────────────────
const app = createApp();

const TEST_USER = { id: 1, username: 'testuser', email: 'test@test.com' };
const AUTH_TOKEN = jwt.sign(TEST_USER, process.env.JWT_SECRET, { expiresIn: '1h' });
const authHeader = () => ({ Authorization: `Bearer ${AUTH_TOKEN}` });

const makeTodo = (overrides = {}) => ({
  id: 1,
  title: 'Buy milk',
  completed: false,
  user_id: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('createApp', () => {
  it('creates a todo-service Express app and wires middleware/routes', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const localApp = createApp();

    const res = await request(localApp).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      service: 'todo-service',
      status: 'healthy',
    });
  });

  it('applies injected middleware before routes', async () => {
    const injectedMiddleware = (req, _res, next) => {
      req.headers.authorization = `Bearer ${AUTH_TOKEN}`;
      next();
    };

    pool.query.mockResolvedValueOnce({ rows: [] });

    const localApp = createApp({
      middleware: [injectedMiddleware],
    });

    const res = await request(localApp).get('/api/todos');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('passes health check database errors to error handler', async () => {
    pool.query.mockRejectedValueOnce(new Error('db down'));

    const localApp = createApp();

    const res = await request(localApp).get('/health');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('db down');
  });
});

// ── GET /health ───────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('returns 200 with service name and status', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ service: 'todo-service', status: 'healthy' });
  });
});

// ── GET /api/todos ────────────────────────────────────────────────────────────
describe('GET /api/todos', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app).get('/api/todos');

    expect(res.status).toBe(401);
  });

  it('returns 200 with an array of todos for authenticated user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [makeTodo(), makeTodo({ id: 2, title: 'Do laundry' })] });

    const res = await request(app).get('/api/todos').set(authHeader());

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe('Buy milk');
  });

  it('returns 200 with empty array when user has no todos', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/todos').set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ── POST /api/todos ───────────────────────────────────────────────────────────
describe('POST /api/todos', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app).post('/api/todos').send({ title: 'Test' });

    expect(res.status).toBe(401);
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app).post('/api/todos').set(authHeader()).send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 400 when title is blank whitespace', async () => {
    const res = await request(app).post('/api/todos').set(authHeader()).send({ title: '   ' });

    expect(res.status).toBe(400);
  });

  it('returns 201 with the created todo', async () => {
    pool.query.mockResolvedValueOnce({ rows: [makeTodo({ title: 'Buy eggs' })] });

    const res = await request(app)
      .post('/api/todos')
      .set(authHeader())
      .send({ title: 'Buy eggs' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Buy eggs');
    expect(res.body.completed).toBe(false);
  });
});

// ── PUT /api/todos/:id ────────────────────────────────────────────────────────
describe('PUT /api/todos/:id', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app).put('/api/todos/1').send({ completed: true });

    expect(res.status).toBe(401);
  });

  it('returns 404 when todo does not belong to the user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // SELECT existing → not found

    const res = await request(app)
      .put('/api/todos/999')
      .set(authHeader())
      .send({ completed: true });

    expect(res.status).toBe(404);
  });

  it('returns 200 with updated todo on success', async () => {
    pool.query.mockResolvedValueOnce({ rows: [makeTodo()] }); // SELECT existing
    pool.query.mockResolvedValueOnce({ rows: [makeTodo({ completed: true })] }); // UPDATE RETURNING

    const res = await request(app)
      .put('/api/todos/1')
      .set(authHeader())
      .send({ completed: true });

    expect(res.status).toBe(200);
    expect(res.body.completed).toBe(true);
  });

  it('returns 200 when only title is updated', async () => {
    pool.query.mockResolvedValueOnce({ rows: [makeTodo()] });
    pool.query.mockResolvedValueOnce({ rows: [makeTodo({ title: 'Updated title' })] });

    const res = await request(app)
      .put('/api/todos/1')
      .set(authHeader())
      .send({ title: 'Updated title' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated title');
  });
});

// ── DELETE /api/todos/:id ─────────────────────────────────────────────────────
describe('DELETE /api/todos/:id', () => {
  it('returns 401 without an auth token', async () => {
    const res = await request(app).delete('/api/todos/1');

    expect(res.status).toBe(401);
  });

  it('returns 404 when todo is not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // DELETE RETURNING → empty

    const res = await request(app).delete('/api/todos/999').set(authHeader());

    expect(res.status).toBe(404);
  });

  it('returns 200 with the deleted todo id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // DELETE RETURNING

    const res = await request(app).delete('/api/todos/1').set(authHeader());

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
  });
});


describe('todo-service error handling', () => {
  it('returns 500 when health database query fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('db down'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('db down');
  });

  it('returns 401 for invalid JWT token', async () => {
    const res = await request(app)
      .get('/api/todos')
      .set('Authorization', 'Bearer invalid.token.value');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('invalid or expired token');
  });

  it('returns 500 when listing todos fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('list failed'));

    const res = await request(app)
      .get('/api/todos')
      .set(authHeader());

    expect(res.status).toBe(500);
  });

  it('returns 500 when creating todo fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('insert failed'));

    const res = await request(app)
      .post('/api/todos')
      .set(authHeader())
      .send({ title: 'New todo' });

    expect(res.status).toBe(500);
  });

  it('returns 500 when deleting todo fails', async () => {
    pool.query.mockRejectedValueOnce(new Error('delete failed'));

    const res = await request(app)
      .delete('/api/todos/1')
      .set(authHeader());

    expect(res.status).toBe(500);
  });
});