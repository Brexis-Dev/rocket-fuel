const express = require('express');
const { query } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/projects
router.get('/', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT p.*,
        COUNT(DISTINCT pl.id)::int AS plan_count,
        COUNT(DISTINCT d.id)::int AS distribution_count
      FROM projects p
      LEFT JOIN plans pl ON pl.project_id = p.id
      LEFT JOIN distributions d ON d.project_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/projects
router.post('/', async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  try {
    const { rows } = await query(
      `INSERT INTO projects (name, description) VALUES ($1,$2) RETURNING *`,
      [name, description || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/projects/:id
router.put('/:id', async (req, res) => {
  const { name, description } = req.body;
  try {
    const { rows } = await query(
      `UPDATE projects SET name=$1, description=$2, updated_at=NOW() WHERE id=$3 RETURNING *`,
      [name, description || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Project not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM projects WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
