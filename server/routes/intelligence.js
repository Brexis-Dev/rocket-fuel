/**
 * Rocket Fuel — Bid Intelligence Engine Routes
 * All routes require auth middleware.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db');
const auth = require('../middleware/auth');
const { extractPlanSpecs, normalizeBid, compareBidToBaseline } = require('../claude');
const { UPLOAD_DIR } = require('../upload');

const router = express.Router();
router.use(auth);

// ─── Multer for intelligence uploads (PDF + office formats) ───────────────────

const intelligenceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    // We'll move the file after we know the project_id; use a temp dir for now
    const tmp = path.join(UPLOAD_DIR, 'tmp');
    fs.mkdirSync(tmp, { recursive: true });
    cb(null, tmp);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const PLAN_EXTS = ['.pdf'];
const BID_EXTS = ['.pdf', '.xlsx', '.xls', '.docx'];

const planUpload = multer({
  storage: intelligenceStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (PLAN_EXTS.includes(ext)) return cb(null, true);
    cb(new Error('Plan files must be PDF'));
  },
});

const bidUpload = multer({
  storage: intelligenceStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BID_EXTS.includes(ext)) return cb(null, true);
    cb(new Error('Bid files must be PDF, Excel (.xlsx/.xls), or Word (.docx)'));
  },
});

// ─── Helper: extract text from file ──────────────────────────────────────────

async function extractText(filePath, ext) {
  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (ext === '.xlsx' || ext === '.xls') {
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath);
    let text = '';
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      text += XLSX.utils.sheet_to_csv(sheet) + '\n';
    }
    return text;
  }
  if (ext === '.docx') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  }
  throw new Error(`Unsupported file type: ${ext}`);
}

// ─── Helper: get model version ────────────────────────────────────────────────

async function getLatestModelVersion() {
  const { rows } = await query(
    `SELECT version FROM model_versions ORDER BY created_at DESC LIMIT 1`
  );
  return rows[0] ? rows[0].version : null;
}

async function getNextModelVersion() {
  const current = await getLatestModelVersion();
  if (!current) return '1.0';
  const parts = current.split('.');
  const major = parseInt(parts[0]) || 1;
  const minor = parseInt(parts[1]) || 0;
  return `${major}.${minor + 1}`;
}

// ─── POST /api/intelligence/plans/upload ─────────────────────────────────────

router.post('/plans/upload', (req, res) => {
  planUpload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { project_id, is_reference } = req.body;
    if (!project_id) return res.status(400).json({ error: 'project_id required' });

    // Move file to proper directory
    const destDir = path.join(UPLOAD_DIR, 'projects', project_id, 'plans');
    fs.mkdirSync(destDir, { recursive: true });
    const destPath = path.join(destDir, req.file.filename);
    fs.renameSync(req.file.path, destPath);

    try {
      const text = await extractText(destPath, '.pdf');

      let extraction;
      try {
        extraction = await extractPlanSpecs(text);
      } catch (aiErr) {
        console.error('Claude extraction error:', aiErr);
        return res.status(500).json({ error: 'AI extraction failed: ' + aiErr.message });
      }

      // Compute overall confidence score
      const scores = Object.values(extraction)
        .filter((v) => v && typeof v === 'object' && 'confidence' in v)
        .map((v) => v.confidence);
      const avgConfidence = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

      const getValue = (key) => extraction[key]?.value ?? null;

      // Save plan_specs row
      const { rows: specRows } = await query(
        `INSERT INTO plan_specs
           (project_id, is_reference, total_sqft_conditioned, total_sqft_unconditioned,
            bedrooms, bathrooms, exterior_doors, interior_doors, windows,
            cabinet_linear_feet, countertop_sqft, garage_type, roof_type, roof_pitch,
            foundation_type, stories, finish_notes, raw_extracted, confirmed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,false)
         RETURNING *`,
        [
          project_id,
          is_reference === 'true' || is_reference === true,
          getValue('total_sqft_conditioned'),
          getValue('total_sqft_unconditioned'),
          getValue('bedrooms'),
          getValue('bathrooms'),
          getValue('exterior_doors'),
          getValue('interior_doors'),
          getValue('windows'),
          getValue('cabinet_linear_feet'),
          getValue('countertop_sqft'),
          getValue('garage_type'),
          getValue('roof_type'),
          getValue('roof_pitch'),
          getValue('foundation_type'),
          getValue('stories'),
          getValue('finish_notes'),
          JSON.stringify(extraction),
        ]
      );

      const spec = specRows[0];

      // Log extraction
      await query(
        `INSERT INTO extraction_log (source_type, source_id, document_type, raw_response, parsed_result, confidence_score, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        ['plan_specs', spec.id, 'plan_pdf', text.slice(0, 10000), JSON.stringify(extraction), avgConfidence, req.user.id]
      );

      res.status(201).json({
        spec_id: spec.id,
        extraction,
        avg_confidence: avgConfidence,
        file: req.file.filename,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });
});

// ─── PUT /api/intelligence/plans/:id/confirm ─────────────────────────────────

router.put('/plans/:id/confirm', async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    const { rows } = await query(
      `UPDATE plan_specs SET
         total_sqft_conditioned=$1, total_sqft_unconditioned=$2, bedrooms=$3, bathrooms=$4,
         exterior_doors=$5, interior_doors=$6, windows=$7, cabinet_linear_feet=$8,
         countertop_sqft=$9, garage_type=$10, roof_type=$11, roof_pitch=$12,
         foundation_type=$13, stories=$14, finish_notes=$15,
         confirmed=true, confirmed_by=$16, confirmed_at=NOW()
       WHERE id=$17
       RETURNING *`,
      [
        data.total_sqft_conditioned, data.total_sqft_unconditioned, data.bedrooms, data.bathrooms,
        data.exterior_doors, data.interior_doors, data.windows, data.cabinet_linear_feet,
        data.countertop_sqft, data.garage_type, data.roof_type, data.roof_pitch,
        data.foundation_type, data.stories, data.finish_notes,
        req.user.id, id,
      ]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Plan spec not found' });

    // Log corrections
    if (data.corrections) {
      await query(
        `INSERT INTO extraction_log (source_type, source_id, document_type, corrections, created_by)
         VALUES ($1,$2,$3,$4,$5)`,
        ['plan_specs', id, 'correction', JSON.stringify(data.corrections), req.user.id]
      );
    }

    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/intelligence/bids/upload ──────────────────────────────────────

router.post('/bids/upload', (req, res) => {
  bidUpload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { project_id, vendor_id, is_reference } = req.body;
    if (!project_id) return res.status(400).json({ error: 'project_id required' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    const destDir = path.join(UPLOAD_DIR, 'projects', project_id, 'bids');
    fs.mkdirSync(destDir, { recursive: true });
    const destPath = path.join(destDir, req.file.filename);
    fs.renameSync(req.file.path, destPath);

    try {
      const text = await extractText(destPath, ext);

      // Fetch vendor and project names for context
      let vendorName = null;
      let projectName = null;
      if (vendor_id) {
        const { rows: vr } = await query('SELECT company_name FROM vendors WHERE id=$1', [vendor_id]);
        vendorName = vr[0]?.company_name || null;
      }
      const { rows: pr } = await query('SELECT name FROM projects WHERE id=$1', [project_id]);
      projectName = pr[0]?.name || null;

      let normalized;
      try {
        normalized = await normalizeBid(text, ext.replace('.', '').toUpperCase(), vendorName, projectName);
      } catch (aiErr) {
        console.error('Claude normalization error:', aiErr);
        return res.status(500).json({ error: 'AI normalization failed: ' + aiErr.message });
      }

      // Compute overall confidence
      const summaryKeys = ['trade', 'bid_date', 'bid_expiration_date', 'grand_total', 'subtotal', 'tax', 'exclusions', 'clarifications'];
      const scores = summaryKeys
        .filter((k) => normalized[k] && typeof normalized[k] === 'object' && 'confidence' in normalized[k])
        .map((k) => normalized[k].confidence);
      const avgConfidence = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;

      const getValue = (key) => normalized[key]?.value ?? null;
      const isRef = is_reference === 'true' || is_reference === true;

      // Save bid_documents row
      const { rows: docRows } = await query(
        `INSERT INTO bid_documents (project_id, vendor_id, filename, original_name, file_path, file_type, file_size, is_reference, uploaded_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          project_id, vendor_id || null, req.file.filename, req.file.originalname,
          destPath, ext.replace('.', ''), req.file.size, isRef, req.user.id,
        ]
      );
      const doc = docRows[0];

      // Compute completeness score: pct of summary fields with value
      const filledCount = summaryKeys.filter((k) => getValue(k) !== null).length;
      const completenessScore = Math.round((filledCount / summaryKeys.length) * 100);

      // Save bid_summaries row
      const { rows: sumRows } = await query(
        `INSERT INTO bid_summaries
           (bid_document_id, project_id, vendor_id, bid_date, bid_expiration_date, trade,
            subtotal, tax, grand_total, exclusions, clarifications, completeness_score, is_reference, confirmed)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,false) RETURNING *`,
        [
          doc.id, project_id, vendor_id || null,
          getValue('bid_date'), getValue('bid_expiration_date'), getValue('trade'),
          getValue('subtotal'), getValue('tax'), getValue('grand_total'),
          getValue('exclusions'), getValue('clarifications'),
          completenessScore, isRef,
        ]
      );

      // Save bid_line_items rows
      const lineItems = normalized.line_items || [];
      const savedItems = [];
      for (let i = 0; i < lineItems.length; i++) {
        const li = lineItems[i];
        const getLI = (k) => li[k]?.value ?? null;
        const anyFlagged = Object.values(li).some((v) => v?.flagged);
        const flagReason = anyFlagged ? 'Low confidence extraction' : null;

        const { rows: liRows } = await query(
          `INSERT INTO bid_line_items
             (bid_document_id, project_id, vendor_id, trade, description, quantity, unit,
              unit_price, line_total, sort_order, flagged, flag_reason, confirmed)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false) RETURNING *`,
          [
            doc.id, project_id, vendor_id || null,
            getValue('trade'), getLI('description'),
            getLI('quantity'), getLI('unit'), getLI('unit_price'), getLI('line_total'),
            i, anyFlagged, flagReason,
          ]
        );
        savedItems.push(liRows[0]);
      }

      // Log extraction
      await query(
        `INSERT INTO extraction_log (source_type, source_id, document_type, raw_response, parsed_result, confidence_score, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        ['bid_documents', doc.id, 'bid', text.slice(0, 10000), JSON.stringify(normalized), avgConfidence, req.user.id]
      );

      res.status(201).json({
        document: doc,
        summary: sumRows[0],
        line_items: savedItems,
        normalized,
        avg_confidence: avgConfidence,
        completeness_score: completenessScore,
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Server error' });
    }
  });
});

// ─── PUT /api/intelligence/bids/:id/confirm ──────────────────────────────────

router.put('/bids/:id/confirm', async (req, res) => {
  const { id } = req.params;
  const { summary, line_items, corrections } = req.body;

  try {
    // Update bid_summaries
    if (summary) {
      await query(
        `UPDATE bid_summaries SET
           trade=$1, bid_date=$2, bid_expiration_date=$3, subtotal=$4, tax=$5,
           grand_total=$6, exclusions=$7, clarifications=$8, notes=$9,
           confirmed=true, confirmed_by=$10, confirmed_at=NOW()
         WHERE bid_document_id=$11`,
        [
          summary.trade, summary.bid_date, summary.bid_expiration_date,
          summary.subtotal, summary.tax, summary.grand_total,
          summary.exclusions, summary.clarifications, summary.notes,
          req.user.id, id,
        ]
      );
    }

    // Update line items
    if (Array.isArray(line_items)) {
      for (const li of line_items) {
        if (li.id) {
          await query(
            `UPDATE bid_line_items SET
               trade=$1, description=$2, quantity=$3, unit=$4, unit_price=$5,
               line_total=$6, flagged=$7, flag_reason=$8, confirmed=true
             WHERE id=$9`,
            [li.trade, li.description, li.quantity, li.unit, li.unit_price,
             li.line_total, li.flagged || false, li.flag_reason || null, li.id]
          );
        } else {
          // New line item added during review
          const { rows: docR } = await query('SELECT project_id, vendor_id FROM bid_documents WHERE id=$1', [id]);
          if (docR[0]) {
            await query(
              `INSERT INTO bid_line_items (bid_document_id, project_id, vendor_id, trade, description, quantity, unit, unit_price, line_total, flagged, confirmed)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)`,
              [id, docR[0].project_id, docR[0].vendor_id, li.trade, li.description,
               li.quantity, li.unit, li.unit_price, li.line_total, li.flagged || false]
            );
          }
        }
      }
    }

    // Log corrections
    if (corrections) {
      await query(
        `INSERT INTO extraction_log (source_type, source_id, document_type, corrections, created_by)
         VALUES ($1,$2,$3,$4,$5)`,
        ['bid_documents', id, 'correction', JSON.stringify(corrections), req.user.id]
      );
    }

    res.json({ message: 'Bid confirmed', bid_document_id: id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/intelligence/model/build ──────────────────────────────────────

router.post('/model/build', async (req, res) => {
  try {
    // Pull reference plan specs (confirmed)
    const { rows: refPlans } = await query(
      `SELECT * FROM plan_specs WHERE is_reference=true AND confirmed=true ORDER BY created_at DESC`
    );
    if (refPlans.length === 0) {
      return res.status(400).json({ error: 'No confirmed reference plans found. Upload and confirm a reference plan first.' });
    }
    const refPlan = refPlans[0];
    const sqft = refPlan.total_sqft_conditioned;
    if (!sqft || sqft <= 0) {
      return res.status(400).json({ error: 'Reference plan has no conditioned square footage.' });
    }

    // Pull reference bid summaries (confirmed)
    const { rows: refBids } = await query(
      `SELECT * FROM bid_summaries WHERE is_reference=true AND confirmed=true`
    );
    if (refBids.length === 0) {
      return res.status(400).json({ error: 'No confirmed reference bids found.' });
    }

    const newVersion = await getNextModelVersion();
    const totalCost = refBids.reduce((sum, b) => sum + parseFloat(b.grand_total || 0), 0);
    const factors = [];

    for (const bid of refBids) {
      const total = parseFloat(bid.grand_total || 0);
      const costPerSqft = sqft > 0 ? total / sqft : null;
      const pctOfTotal = totalCost > 0 ? total / totalCost : null;

      const { rows: pmRows } = await query(
        `INSERT INTO pricing_model (model_version, trade, cost_per_sqft, pct_of_total, sample_count, reference_plan_id)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [newVersion, bid.trade || 'Unknown', costPerSqft, pctOfTotal, 1, refPlan.id]
      );
      factors.push(pmRows[0]);
    }

    // Save snapshot
    const { rows: mvRows } = await query(
      `INSERT INTO model_versions (version, notes, snapshot, created_by)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [
        newVersion,
        req.body.notes || null,
        JSON.stringify({ factors, reference_plan: refPlan, reference_bids: refBids }),
        req.user.id,
      ]
    );

    res.status(201).json({ version: newVersion, factors, model_version: mvRows[0] });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

// ─── GET /api/intelligence/model/estimate/:project_id ────────────────────────

router.get('/model/estimate/:project_id', async (req, res) => {
  const { project_id } = req.params;
  try {
    const { rows: specs } = await query(
      `SELECT * FROM plan_specs WHERE project_id=$1 AND confirmed=true ORDER BY created_at DESC LIMIT 1`,
      [project_id]
    );
    if (!specs[0]) return res.status(404).json({ error: 'No confirmed plan spec for this project' });
    const spec = specs[0];

    const version = await getLatestModelVersion();
    if (!version) return res.status(404).json({ error: 'No pricing model built yet' });

    const { rows: factors } = await query(
      `SELECT * FROM pricing_model WHERE model_version=$1`,
      [version]
    );

    const sqft = spec.total_sqft_conditioned;
    const estimate = factors.map((f) => ({
      trade: f.trade,
      cost_per_sqft: parseFloat(f.cost_per_sqft || 0),
      estimated_cost: sqft ? Math.round(parseFloat(f.cost_per_sqft || 0) * sqft) : null,
      pct_of_total: parseFloat(f.pct_of_total || 0),
    }));

    const totalEstimate = estimate.reduce((s, e) => s + (e.estimated_cost || 0), 0);

    res.json({ project_id, sqft, model_version: version, estimate, total_estimate: totalEstimate });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/intelligence/compare/:project_id/:bid_document_id ─────────────

router.post('/compare/:project_id/:bid_document_id', async (req, res) => {
  const { project_id, bid_document_id } = req.params;
  try {
    // Get baseline estimate
    const { rows: specs } = await query(
      `SELECT * FROM plan_specs WHERE project_id=$1 AND confirmed=true ORDER BY created_at DESC LIMIT 1`,
      [project_id]
    );
    if (!specs[0]) return res.status(404).json({ error: 'No confirmed plan spec for this project' });
    const sqft = specs[0].total_sqft_conditioned;

    const version = await getLatestModelVersion();
    if (!version) return res.status(400).json({ error: 'No pricing model built yet' });

    const { rows: factors } = await query(`SELECT * FROM pricing_model WHERE model_version=$1`, [version]);
    const baselineTotal = factors.reduce((s, f) => s + (sqft ? parseFloat(f.cost_per_sqft || 0) * sqft : 0), 0);
    const baselineByTrade = {};
    for (const f of factors) {
      baselineByTrade[f.trade] = sqft ? parseFloat(f.cost_per_sqft || 0) * sqft : 0;
    }

    // Get confirmed bid
    const { rows: sumRows } = await query(
      `SELECT bs.*, v.company_name as vendor_name FROM bid_summaries bs
       LEFT JOIN vendors v ON v.id = bs.vendor_id
       WHERE bs.bid_document_id=$1`,
      [bid_document_id]
    );
    if (!sumRows[0]) return res.status(404).json({ error: 'Bid summary not found' });
    const bid = sumRows[0];

    const bidTotal = parseFloat(bid.grand_total || 0);
    const varianceAmount = bidTotal - baselineTotal;
    const variancePct = baselineTotal > 0 ? varianceAmount / baselineTotal : 0;

    // Get bid line items for detail comparison
    const { rows: lineItems } = await query(
      `SELECT * FROM bid_line_items WHERE bid_document_id=$1 AND confirmed=true`,
      [bid_document_id]
    );

    // Line-by-line comparison
    const lineItemResults = lineItems.map((li) => {
      const baseline = baselineByTrade[li.trade] || null;
      const bidAmt = parseFloat(li.line_total || 0);
      let flag = null;
      if (baseline) {
        const pct = (bidAmt - baseline) / baseline;
        if (pct > 0.25) flag = 'red';
        else if (pct > 0.10) flag = 'yellow';
        else if (pct < -0.20) flag = 'blue';
        else flag = 'green';
      }
      return { ...li, baseline_amount: baseline, variance_pct: baseline ? (bidAmt - baseline) / baseline : null, flag };
    });

    // AI analysis
    let aiAnalysis = {};
    try {
      aiAnalysis = await compareBidToBaseline(bid, { total: baselineTotal, by_trade: baselineByTrade });
    } catch (aiErr) {
      console.error('AI comparison error:', aiErr);
      aiAnalysis = { completeness_score: bid.completeness_score || 50, recommended: false };
    }

    const completenessScore = aiAnalysis.completeness_score || bid.completeness_score || 50;
    const recommended = aiAnalysis.recommended || false;

    // Save comparison
    const { rows: compRows } = await query(
      `INSERT INTO bid_comparisons
         (project_id, bid_document_id, model_version, baseline_total, bid_total,
          variance_amount, variance_pct, completeness_score, line_item_results, recommended)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        project_id, bid_document_id, version,
        baselineTotal, bidTotal, varianceAmount, variancePct,
        completenessScore, JSON.stringify(lineItemResults), recommended,
      ]
    );

    res.status(201).json({
      comparison: compRows[0],
      baseline_total: baselineTotal,
      bid_total: bidTotal,
      variance_amount: varianceAmount,
      variance_pct: variancePct,
      line_item_results: lineItemResults,
      ai_analysis: aiAnalysis,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

// ─── GET /api/intelligence/queue ─────────────────────────────────────────────

router.get('/queue', async (req, res) => {
  try {
    const { rows: plans } = await query(
      `SELECT ps.id, ps.project_id, ps.is_reference, ps.confirmed, ps.created_at,
              ps.raw_extracted, p.name as project_name,
              'plan' as item_type, NULL as vendor_name
       FROM plan_specs ps
       LEFT JOIN projects p ON p.id = ps.project_id
       WHERE ps.confirmed = false
       ORDER BY ps.created_at DESC`
    );

    const { rows: bids } = await query(
      `SELECT bs.id, bs.project_id, bs.is_reference, bs.confirmed, bs.created_at,
              bs.completeness_score, bs.bid_document_id,
              p.name as project_name,
              'bid' as item_type, v.company_name as vendor_name
       FROM bid_summaries bs
       LEFT JOIN projects p ON p.id = bs.project_id
       LEFT JOIN vendors v ON v.id = bs.vendor_id
       WHERE bs.confirmed = false
       ORDER BY bs.created_at DESC`
    );

    // Compute avg confidence for plan items
    const planItems = plans.map((ps) => {
      let avgConf = null;
      if (ps.raw_extracted) {
        const extracted = typeof ps.raw_extracted === 'string' ? JSON.parse(ps.raw_extracted) : ps.raw_extracted;
        const scores = Object.values(extracted)
          .filter((v) => v && typeof v === 'object' && 'confidence' in v)
          .map((v) => v.confidence);
        avgConf = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      }
      return { ...ps, avg_confidence: avgConf };
    });

    const bidItems = bids.map((b) => ({
      ...b,
      avg_confidence: b.completeness_score,
    }));

    const all = [...planItems, ...bidItems].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json(all);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/intelligence/comparisons/:project_id ───────────────────────────

router.get('/comparisons/:project_id', async (req, res) => {
  const { project_id } = req.params;
  try {
    const { rows } = await query(
      `SELECT bc.*, bd.original_name, v.company_name as vendor_name
       FROM bid_comparisons bc
       LEFT JOIN bid_documents bd ON bd.id = bc.bid_document_id
       LEFT JOIN vendors v ON v.id = bd.vendor_id
       WHERE bc.project_id=$1
       ORDER BY bc.created_at DESC`,
      [project_id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/intelligence/model/history ─────────────────────────────────────

router.get('/model/history', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT mv.*, u.name as created_by_name
       FROM model_versions mv
       LEFT JOIN users u ON u.id = mv.created_by
       ORDER BY mv.created_at DESC`
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/intelligence/plans/:project_id ─────────────────────────────────

router.get('/plans/:project_id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT ps.*, u.name as confirmed_by_name
       FROM plan_specs ps
       LEFT JOIN users u ON u.id = ps.confirmed_by
       WHERE ps.project_id=$1
       ORDER BY ps.created_at DESC`,
      [req.params.project_id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/intelligence/bids/:project_id ──────────────────────────────────

router.get('/bids/:project_id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT bs.*, bd.original_name, bd.file_type, v.company_name as vendor_name
       FROM bid_summaries bs
       LEFT JOIN bid_documents bd ON bd.id = bs.bid_document_id
       LEFT JOIN vendors v ON v.id = bs.vendor_id
       WHERE bs.project_id=$1
       ORDER BY bs.created_at DESC`,
      [req.params.project_id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/intelligence/bids/items/:bid_document_id ───────────────────────

router.get('/bids/items/:bid_document_id', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM bid_line_items WHERE bid_document_id=$1 ORDER BY sort_order ASC`,
      [req.params.bid_document_id]
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
