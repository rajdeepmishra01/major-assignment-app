import express from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT id, title, completed, user_id, created_at, updated_at
       FROM todos WHERE user_id=$1 ORDER BY id DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'title is required' });
    }

    const result = await pool.query(
      `INSERT INTO todos (title, user_id)
       VALUES ($1, $2)
       RETURNING id, title, completed, user_id, created_at, updated_at`,
      [title.trim(), req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, completed } = req.body;

    const existing = await pool.query('SELECT * FROM todos WHERE id=$1 AND user_id=$2', [id, req.user.id]);
    if (existing.rows.length === 0) return res.status(404).json({ message: 'todo not found' });

    const newTitle = title === undefined ? existing.rows[0].title : title;
    const newCompleted = completed === undefined ? existing.rows[0].completed : completed;

    const result = await pool.query(
      `UPDATE todos SET title=$1, completed=$2, updated_at=CURRENT_TIMESTAMP
       WHERE id=$3 AND user_id=$4
       RETURNING id, title, completed, user_id, created_at, updated_at`,
      [newTitle, newCompleted, id, req.user.id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM todos WHERE id=$1 AND user_id=$2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ message: 'todo not found' });
    res.json({ message: 'todo deleted', id: result.rows[0].id });
  } catch (err) {
    next(err);
  }
});

export default router;
