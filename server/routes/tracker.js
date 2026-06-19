const express = require('express');
const { query } = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/tracker
router.get('/', async (req, res) => {
  const { project_id, vendor_id, status } = req.query;
  let sql = `
    SELECT
      d.id AS distribution_id,
      d.project_id,
      d.vendor_id,
      d.sent_at,
      d.bid_due_date,
      d.message,
      d.plan_ids,
      p.name AS project_name,
      v.company_name AS vendor_name,
      v.contact_name AS vendor_contact,
      v.email AS vendor_email,
      v.trade AS vendor_trade,
      br.id AS response_id,
      br.response_status AS status,
      br.response_date,
      br.bid_amount,
      br.notes,
      br.updated_at AS response_updated_at
    FROM distributions d
    JOIN projects p ON p.id = d.project_id
    JOIN vendors v ON v.id = d.vendor_id
    LEFT JOIN bid_responses br ON br.distribution_id = d.id
    WHERE 1=1
  `;
  const params = [];

  if (project_id) {
    params.push(project_id);
    sql += ` AND d.project_id = $${params.length}`;
  }
  if (vendor_id) {
    params.push(vendor_id);
    sql += ` AND d.vendor_id = $${params.length}`;
  }
  if (status && status !== 'All') {
    params.push(status);
    sql += ` AND br.response_status = $${params.length}`;
  }

  sql += ` ORDER BY d.sent_at DESC`;

  try {
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/tracker/:distribution_id
router.put('/:distribution_id', async (req, res) => {
  const { status, response_date, bid_amount, notes } = req.body;
  try {
    const { rows } = await query(
      `UPDATE bid_responses SET
        response_status = COALESCE($1, response_status),
        response_date = $2,
        bid_amount = $3,
        notes = $4,
        updated_at = NOW()
       WHERE distribution_id = $5 RETURNING *`,
      [status || null, response_date || null, bid_amount || null, notes || null, req.params.distribution_id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Response not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tracker/export
router.get('/export', async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        p.name AS project,
        v.company_name AS vendor,
        v.email AS vendor_email,
        v.trade,
        d.sent_at,
        d.bid_due_date,
        br.response_status AS status,
        br.response_date,
        br.bid_amount,
        br.notes
      FROM distributions d
      JOIN projects p ON p.id = d.project_id
      JOIN vendors v ON v.id = d.vendor_id
      LEFT JOIN bid_responses br ON br.distribution_id = d.id
      ORDER BY d.sent_at DESC
    `);

    const headers = ['Project', 'Vendor', 'Vendor Email', 'Trade', 'Sent At', 'Bid Due Date', 'Status', 'Response Date', 'Bid Amount', 'Notes'];
    const csvRows = rows.map((r) => [
      r.project,
      r.vendor,
      r.vendor_email,
      r.trade || '',
      r.sent_at ? new Date(r.sent_at).toLocaleDateString() : '',
      r.bid_due_date ? new Date(r.bid_due_date).toLocaleDateString() : '',
      r.status || '',
      r.response_date ? new Date(r.response_date).toLocaleDateString() : '',
      r.bid_amount != null ? `$${parseFloat(r.bid_amount).toFixed(2)}` : '',
      r.notes || '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));

    const csv = [headers.join(','), ...csvRows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="rocket-fuel-tracker.csv"');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
