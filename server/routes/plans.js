const express = require('express');
const fs = require('fs');
const path = require('path');
const { query } = require('../db');
const auth = require('../middleware/auth');
const { upload } = require('../upload');

const router = express.Router();
router.use(auth);

// GET /api/plans?project_id=
router.get('/', async (req, res) => {
  const { project_id } = req.query;
  if (!project_id) return res.status(400).json({ error: 'project_id required' });
  try {
    const { rows } = await query(
      `SELECT pl.*, u.name AS uploader_name
       FROM plans pl
       LEFT JOIN users u ON u.id = pl.uploaded_by
       WHERE pl.project_id = $1
       ORDER BY pl.uploaded_at DESC`,
      [project_id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/plans/upload
router.post('/upload', (req, res) => {
  upload.array('files', 20)(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    const { project_id, revision, label } = req.body;
    if (!project_id) return res.status(400).json({ error: 'project_id required' });
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

    try {
      const inserted = [];
      for (const file of req.files) {
        const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
        const { rows } = await query(
          `INSERT INTO plans (project_id, filename, original_name, file_path, file_type, file_size, revision, label, uploaded_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
          [
            project_id,
            file.filename,
            file.originalname,
            file.path,
            ext,
            file.size,
            revision || null,
            label || null,
            req.user.id,
          ]
        );
        inserted.push(rows[0]);
      }
      res.status(201).json(inserted);
    } catch (dbErr) {
      console.error(dbErr);
      res.status(500).json({ error: 'Server error' });
    }
  });
});

// DELETE /api/plans/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM plans WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Plan not found' });
    const plan = rows[0];
    if (fs.existsSync(plan.file_path)) {
      fs.unlinkSync(plan.file_path);
    }
    await query('DELETE FROM plans WHERE id=$1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/plans/:id/download
router.get('/:id/download', async (req, res) => {
  try {
    const { rows } = await query('SELECT * FROM plans WHERE id=$1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Plan not found' });
    const plan = rows[0];
    if (!fs.existsSync(plan.file_path)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }
    res.setHeader('Content-Disposition', `attachment; filename="${plan.original_name}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    fs.createReadStream(plan.file_path).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
