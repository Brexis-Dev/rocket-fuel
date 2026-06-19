const express = require('express');
const fs = require('fs');
const { query } = require('../db');
const auth = require('../middleware/auth');
const { sendPlanEmail } = require('../email');

const router = express.Router();
router.use(auth);

// POST /api/distributions/send
router.post('/send', async (req, res) => {
  const { project_id, vendor_ids, plan_ids, message, bid_due_date } = req.body;

  if (!project_id || !vendor_ids?.length || !plan_ids?.length) {
    return res.status(400).json({ error: 'project_id, vendor_ids, and plan_ids required' });
  }

  try {
    // Fetch project
    const { rows: projectRows } = await query('SELECT * FROM projects WHERE id=$1', [project_id]);
    if (!projectRows[0]) return res.status(404).json({ error: 'Project not found' });
    const project = projectRows[0];

    // Fetch plans and read files
    const { rows: planRows } = await query(
      `SELECT * FROM plans WHERE id = ANY($1::int[])`,
      [plan_ids]
    );

    const attachments = planRows
      .filter((p) => fs.existsSync(p.file_path))
      .map((p) => ({
        filename: p.original_name,
        content: fs.readFileSync(p.file_path),
      }));

    // Fetch vendors
    const { rows: vendorRows } = await query(
      `SELECT * FROM vendors WHERE id = ANY($1::int[])`,
      [vendor_ids]
    );

    const fromEmail = req.user.email;
    const results = { sent: [], failed: [] };

    for (const vendor of vendorRows) {
      try {
        await sendPlanEmail(
          vendor.email,
          vendor.contact_name || vendor.company_name,
          fromEmail,
          message || '',
          bid_due_date,
          project.name,
          attachments
        );

        // Insert distribution row
        const { rows: distRows } = await query(
          `INSERT INTO distributions (project_id, vendor_id, sent_by, bid_due_date, message, plan_ids, status)
           VALUES ($1,$2,$3,$4,$5,$6,'Sent') RETURNING *`,
          [project_id, vendor.id, req.user.id, bid_due_date || null, message || null, plan_ids]
        );

        // Insert bid_response row
        await query(
          `INSERT INTO bid_responses (distribution_id, response_status) VALUES ($1,'Pending')`,
          [distRows[0].id]
        );

        results.sent.push({ vendor_id: vendor.id, company: vendor.company_name });
      } catch (emailErr) {
        console.error(`Failed to send to ${vendor.email}:`, emailErr.message);
        results.failed.push({
          vendor_id: vendor.id,
          company: vendor.company_name,
          error: emailErr.message,
        });
      }
    }

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
