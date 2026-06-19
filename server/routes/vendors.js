const express = require('express');
const { query } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/vendors/trades — must come before /:id routes
router.get('/trades', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT DISTINCT trade FROM vendors WHERE trade IS NOT NULL AND trade != '' ORDER BY trade`
    );
    res.json(rows.map((r) => r.trade));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/vendors
router.get('/', async (req, res) => {
  const { search, trade } = req.query;
  let sql = `SELECT * FROM vendors WHERE 1=1`;
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    sql += ` AND (company_name ILIKE $${params.length} OR contact_name ILIKE $${params.length} OR email ILIKE $${params.length})`;
  }
  if (trade) {
    params.push(trade);
    sql += ` AND trade = $${params.length}`;
  }

  sql += ` ORDER BY company_name`;

  try {
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/vendors
router.post('/', async (req, res) => {
  const { company_name, contact_name, email, phone, trade, notes, active } = req.body;
  if (!company_name || !email) {
    return res.status(400).json({ error: 'Company name and email required' });
  }
  try {
    const { rows } = await query(
      `INSERT INTO vendors (company_name, contact_name, email, phone, trade, notes, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [company_name, contact_name || null, email, phone || null, trade || null, notes || null, active !== false]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/vendors/:id
router.put('/:id', async (req, res) => {
  const { company_name, contact_name, email, phone, trade, notes, active } = req.body;
  try {
    const { rows } = await query(
      `UPDATE vendors SET company_name=$1, contact_name=$2, email=$3, phone=$4, trade=$5, notes=$6, active=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [company_name, contact_name || null, email, phone || null, trade || null, notes || null, active !== false, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Vendor not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/vendors/:id
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM vendors WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
