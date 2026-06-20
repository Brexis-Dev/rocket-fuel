import React, { useState, useEffect } from 'react';
import { getProjects, getVendors, uploadBidForNormalization, confirmBid } from '../../api.js';

function ConfidenceBadge({ score }) {
  if (score == null) return null;
  const s = score >= 80
    ? { bg: '#dcfce7', color: '#16a34a', label: 'High' }
    : score >= 60
    ? { bg: '#fef9c3', color: '#a16207', label: 'Medium' }
    : { bg: '#fee2e2', color: '#dc2626', label: 'Low' };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
      {s.label} ({score}%)
    </span>
  );
}

const inputS = {
  padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6,
  fontSize: 13, boxSizing: 'border-box',
};

export default function BidNormalization() {
  const [projects, setProjects] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [isReference, setIsReference] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [docId, setDocId] = useState(null);
  const [summary, setSummary] = useState({});
  const [lineItems, setLineItems] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [avgConfidence, setAvgConfidence] = useState(null);

  useEffect(() => {
    getProjects().then((r) => setProjects(r.data));
    getVendors().then((r) => setVendors(r.data));
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!projectId || !file) return setError('Please select a project and file.');
    setError(null);
    setUploading(true);
    setResult(null);
    setSaved(false);

    const fd = new FormData();
    fd.append('project_id', projectId);
    if (vendorId) fd.append('vendor_id', vendorId);
    fd.append('is_reference', isReference ? 'true' : 'false');
    fd.append('file', file);

    try {
      const res = await uploadBidForNormalization(fd);
      const { normalized, summary: savedSummary, line_items, avg_confidence } = res.data;
      setResult(normalized);
      setDocId(res.data.document.id);
      setAvgConfidence(avg_confidence);

      // Pre-fill summary form
      setSummary({
        trade: savedSummary.trade || '',
        bid_date: savedSummary.bid_date ? savedSummary.bid_date.split('T')[0] : '',
        bid_expiration_date: savedSummary.bid_expiration_date ? savedSummary.bid_expiration_date.split('T')[0] : '',
        grand_total: savedSummary.grand_total || '',
        subtotal: savedSummary.subtotal || '',
        tax: savedSummary.tax || '',
        exclusions: savedSummary.exclusions || '',
        clarifications: savedSummary.clarifications || '',
        notes: savedSummary.notes || '',
      });
      setLineItems(line_items.map((li) => ({
        id: li.id,
        trade: li.trade || '',
        description: li.description || '',
        quantity: li.quantity || '',
        unit: li.unit || '',
        unit_price: li.unit_price || '',
        line_total: li.line_total || '',
        flagged: li.flagged || false,
        flag_reason: li.flag_reason || '',
      })));
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleAddRow = () => {
    setLineItems([...lineItems, { id: null, trade: '', description: '', quantity: '', unit: '', unit_price: '', line_total: '', flagged: false }]);
  };

  const handleRemoveRow = (idx) => {
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  const handleLIChange = (idx, field, value) => {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], [field]: value };
    // Auto-compute line_total if qty and unit_price change
    if (field === 'quantity' || field === 'unit_price') {
      const q = parseFloat(field === 'quantity' ? value : updated[idx].quantity) || 0;
      const up = parseFloat(field === 'unit_price' ? value : updated[idx].unit_price) || 0;
      if (q && up) updated[idx].line_total = (q * up).toFixed(2);
    }
    setLineItems(updated);
  };

  const handleConfirm = async () => {
    if (!docId) return;
    setSaving(true);
    setError(null);
    const corrections = {};
    if (result) {
      const keys = ['trade', 'bid_date', 'bid_expiration_date', 'grand_total', 'subtotal', 'tax', 'exclusions', 'clarifications'];
      for (const k of keys) {
        if (String(summary[k]) !== String(result[k]?.value ?? '')) {
          corrections[k] = { original: result[k]?.value, corrected: summary[k] };
        }
      }
    }
    try {
      await confirmBid(docId, { summary, line_items: lineItems, corrections });
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const flaggedCount = lineItems.filter((li) => li.flagged).length;
  const fmtMoney = (v) => v != null && v !== '' ? `$${parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 20 }}>Upload Bid for Normalization</h2>

      <form onSubmit={handleUpload} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Project *</label>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ ...inputS, width: '100%' }} required>
              <option value="">Select project...</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Vendor</label>
            <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} style={{ ...inputS, width: '100%' }}>
              <option value="">Select vendor...</option>
              {vendors.map((v) => <option key={v.id} value={v.id}>{v.company_name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 24 }}>
            <input type="checkbox" id="isRefBid" checked={isReference} onChange={(e) => setIsReference(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <label htmlFor="isRefBid" style={{ fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>Reference Bid</label>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Bid File *</label>
          <input type="file" accept=".pdf,.xlsx,.xls,.docx" onChange={(e) => setFile(e.target.files[0])} style={{ fontSize: 13 }} required />
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>PDF, Excel (.xlsx/.xls), or Word (.docx), max 50 MB</div>
        </div>
        {error && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{error}</div>}
        <button
          type="submit"
          disabled={uploading}
          style={{ background: uploading ? '#94a3b8' : '#f97316', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: uploading ? 'not-allowed' : 'pointer' }}
        >
          {uploading ? '⏳ Normalizing with AI...' : 'Upload & Normalize'}
        </button>
      </form>

      {result && (
        <div>
          {/* Feral Cat alert if many fields flagged */}
          {flaggedCount > 3 && (
            <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 10, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 24 }}>🐱</span>
              <div>
                <div style={{ fontWeight: 800, color: '#92400e', fontSize: 14 }}>Feral Cat Alert — Messy Bid Detected</div>
                <div style={{ fontSize: 13, color: '#b45309' }}>
                  {flaggedCount} line items have low confidence scores. This bid document may be poorly formatted or missing key information. Review all highlighted fields carefully.
                </div>
              </div>
            </div>
          )}

          {avgConfidence != null && (
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: '#64748b' }}>Overall extraction confidence:</span>
              <ConfidenceBadge score={avgConfidence} />
            </div>
          )}

          {/* Summary section */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>Bid Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              {[
                { key: 'trade', label: 'Trade', type: 'text' },
                { key: 'bid_date', label: 'Bid Date', type: 'date' },
                { key: 'bid_expiration_date', label: 'Expiration Date', type: 'date' },
                { key: 'subtotal', label: 'Subtotal ($)', type: 'number' },
                { key: 'tax', label: 'Tax ($)', type: 'number' },
                { key: 'grand_total', label: 'Grand Total ($)', type: 'number' },
              ].map(({ key, label, type }) => {
                const conf = result[key]?.confidence ?? null;
                const flagged = conf != null && conf < 80;
                return (
                  <div key={key} style={{ background: flagged ? '#fff7ed' : '#f8fafc', borderRadius: 8, padding: '10px 12px', borderLeft: flagged ? '4px solid #f97316' : '4px solid transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{label}</label>
                      <ConfidenceBadge score={conf} />
                    </div>
                    <input
                      type={type}
                      value={summary[key] ?? ''}
                      onChange={(e) => setSummary({ ...summary, [key]: e.target.value })}
                      style={{ ...inputS, width: '100%', borderColor: flagged ? '#f97316' : '#d1d5db', background: '#fff' }}
                      step={type === 'number' ? '0.01' : undefined}
                    />
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              {[
                { key: 'exclusions', label: 'Exclusions' },
                { key: 'clarifications', label: 'Clarifications' },
                { key: 'notes', label: 'Notes' },
              ].map(({ key, label }) => {
                const conf = result[key]?.confidence ?? null;
                const flagged = conf != null && conf < 80;
                return (
                  <div key={key} style={{ background: flagged ? '#fff7ed' : '#f8fafc', borderRadius: 8, padding: '10px 12px', borderLeft: flagged ? '4px solid #f97316' : '4px solid transparent' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{label}</label>
                      {conf != null && <ConfidenceBadge score={conf} />}
                    </div>
                    <textarea
                      value={summary[key] ?? ''}
                      onChange={(e) => setSummary({ ...summary, [key]: e.target.value })}
                      rows={3}
                      style={{ ...inputS, width: '100%', borderColor: flagged ? '#f97316' : '#d1d5db', background: '#fff', resize: 'vertical' }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Line items */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Line Items ({lineItems.length})</h3>
              <button
                onClick={handleAddRow}
                style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
              >
                + Add Row
              </button>
            </div>
            <div style={{ overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Trade', 'Description', 'Qty', 'Unit', 'Unit Price', 'Line Total', 'Flag', ''].map((h) => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        borderLeft: li.flagged ? '4px solid #f97316' : '4px solid transparent',
                        background: li.flagged ? '#fff7ed' : '#fff',
                      }}
                    >
                      {['trade', 'description', 'quantity', 'unit', 'unit_price', 'line_total'].map((f) => (
                        <td key={f} style={{ padding: '6px 8px' }}>
                          <input
                            value={li[f] ?? ''}
                            onChange={(e) => handleLIChange(idx, f, e.target.value)}
                            type={['quantity', 'unit_price', 'line_total'].includes(f) ? 'number' : 'text'}
                            step={['unit_price', 'line_total'].includes(f) ? '0.01' : undefined}
                            style={{ ...inputS, width: f === 'description' ? 200 : 80 }}
                          />
                        </td>
                      ))}
                      <td style={{ padding: '6px 8px' }}>
                        <input
                          type="checkbox"
                          checked={li.flagged}
                          onChange={(e) => handleLIChange(idx, 'flagged', e.target.checked)}
                        />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <button
                          onClick={() => handleRemoveRow(idx)}
                          style={{ background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}
                          title="Remove row"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan={5} style={{ padding: '8px 10px', fontWeight: 700, fontSize: 12, color: '#374151' }}>Total</td>
                    <td style={{ padding: '8px 10px', fontWeight: 700, fontSize: 13, color: '#0f172a' }}>
                      {fmtMoney(lineItems.reduce((s, li) => s + (parseFloat(li.line_total) || 0), 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {saved ? (
            <div style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 8, padding: '12px 16px', fontWeight: 700 }}>
              ✅ Bid confirmed and saved!
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleConfirm}
                disabled={saving}
                style={{ background: saving ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Saving...' : 'Confirm & Save Bid'}
              </button>
              <button
                onClick={() => { setResult(null); setDocId(null); setFile(null); }}
                style={{ background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
