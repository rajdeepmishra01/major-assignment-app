import { vi, describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Must be set before any module that reads JWT_SECRET is imported
process.env.JWT_SECRET = 'test-secret-key-for-auth-tests';

// ── Mocks (hoisted before static imports by vitest) ──────────────────────────
vi.mock('../config/db.js', () => ({
  pool: { query: vi.fn() },
  ensureAuthTables: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$10$mocked-hash'),
    compare: vi.fn(),
  },
}));

import { pool } from '../config/db.js';
import bcrypt from 'bcryptjs';
import { createApp } from '../app.js';

// ── Single app instance shared across all tests ───────────────────────────────
const app = createApp();

// Reset pool mock and re-initialise bcrypt defaults before every test
beforeEach(() => {
  vi.resetAllMocks();
  bcrypt.hash.mockResolvedValue('$2b$10$mocked-hash');
  bcrypt.compare.mockResolvedValue(false); // safe default: wrong password
});

// ── GET /health ───────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('returns 200 with service name and status', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ service: 'auth-service', status: 'healthy' });
  });
});

// ── POST /api/auth/register ───────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('message');
  });

  it('returns 400 when password is shorter than 5 characters', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@test.com', password: 'abc' });

    expect(res.status).toBe(400);
  });

  it('returns 409 when username or email already exists', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // SELECT → duplicate found

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@test.com', password: 'password123' });

    expect(res.status).toBe(409);
  });

  it('returns 201 with token and user on successful registration', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }); // SELECT → no duplicate
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'alice', email: 'alice@test.com', created_at: new Date().toISOString() }],
    }); // INSERT RETURNING

    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'alice', email: 'alice@test.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.username).toBe('alice');
    expect(res.body.user).not.toHaveProperty('password');
  });
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com' });

    expect(res.status).toBe(400);
  });

  it('returns 401 when user is not found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  it('returns 401 when password is incorrect', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'alice', email: 'alice@test.com', password: '$2b$10$mocked-hash' }],
    });
    bcrypt.compare.mockResolvedValueOnce(false);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('returns 200 with token and user on valid credentials', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [{ id: 1, username: 'alice', email: 'alice@test.com', password: '$2b$10$mocked-hash' }],
    });
    bcrypt.compare.mockResolvedValueOnce(true);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@test.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('alice@test.com');
    expect(res.body.user).not.toHaveProperty('password');
  });
});

// ── GET /api/auth/validate ────────────────────────────────────────────────────
describe('GET /api/auth/validate', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).get('/api/auth/validate');

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });

  it('returns 401 for a malformed / tampered token', async () => {
    const res = await request(app)
      .get('/api/auth/validate')
      .set('Authorization', 'Bearer not.a.real.token');

    expect(res.status).toBe(401);
    expect(res.body.valid).toBe(false);
  });

  it('returns 200 with decoded user for a valid JWT', async () => {
    const token = jwt.sign(
      { id: 1, username: 'alice', email: 'alice@test.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/auth/validate')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.user.email).toBe('alice@test.com');
  });
});
