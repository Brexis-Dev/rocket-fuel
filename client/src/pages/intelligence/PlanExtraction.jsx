import React, { useState, useEffect } from 'react';
import { getProjects, uploadPlanForExtraction, confirmPlanSpecs } from '../../api.js';

const FIELD_LABELS = {
  total_sqft_conditioned: 'Conditioned Sq Ft',
  total_sqft_unconditioned: 'Unconditioned Sq Ft',
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  exterior_doors: 'Exterior Doors',
  interior_doors: 'Interior Doors',
  windows: 'Windows',
  cabinet_linear_feet: 'Cabinet Linear Feet',
  countertop_sqft: 'Countertop Sq Ft',
  garage_type: 'Garage Type',
  roof_type: 'Roof Type',
  roof_pitch: 'Roof Pitch',
  foundation_type: 'Foundation Type',
  stories: 'Stories',
  finish_notes: 'Finish Notes',
};

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

export default function PlanExtraction() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [isReference, setIsReference] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [specId, setSpecId] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getProjects().then((r) => setProjects(r.data));
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
    fd.append('is_reference', isReference ? 'true' : 'false');
    fd.append('file', file);

    try {
      const res = await uploadPlanForExtraction(fd);
      const { extraction, spec_id } = res.data;
      setResult(extraction);
      setSpecId(spec_id);
      // Pre-fill form with extracted values
      const initial = {};
      for (const key of Object.keys(FIELD_LABELS)) {
        initial[key] = extraction[key]?.value ?? '';
      }
      setForm(initial);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!specId) return;
    setSaving(true);
    setError(null);
    const corrections = {};
    for (const key of Object.keys(FIELD_LABELS)) {
      if (result && String(form[key]) !== String(result[key]?.value ?? '')) {
        corrections[key] = { original: result[key]?.value, corrected: form[key] };
      }
    }
    try {
      await confirmPlanSpecs(specId, { ...form, corrections });
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const inputS = {
    padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6,
    fontSize: 13, width: '100%', boxSizing: 'border-box',
  };

  return (
    <div>
      <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 20 }}>Upload Plan for Extraction</h2>

      <form onSubmit={handleUpload} style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24, marginBottom: 28 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>Project *</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              style={{ ...inputS, width: 'auto', minWidth: 200 }}
              required
            >
              <option value="">Select project...</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 24 }}>
            <input
              type="checkbox"
              id="isRef"
              checked={isReference}
              onChange={(e) => setIsReference(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <label htmlFor="isRef" style={{ fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
              Mark as Reference Plan (used to build pricing model)
            </label>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>PDF Plan File *</label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setFile(e.target.files[0])}
            style={{ fontSize: 13 }}
            required
          />
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>PDF only, max 50 MB</div>
        </div>

        {error && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{error}</div>}

        <button
          type="submit"
          disabled={uploading}
          style={{
            background: uploading ? '#94a3b8' : '#f97316', color: '#fff', border: 'none',
            borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: uploading ? 'not-allowed' : 'pointer',
          }}
        >
          {uploading ? '⏳ Extracting with AI...' : 'Upload & Extract'}
        </button>
      </form>

      {result && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Extracted Plan Specifications</h3>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Fields below 80% confidence are highlighted — review and correct before confirming.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {Object.keys(FIELD_LABELS).map((key) => {
              const extracted = result[key];
              const confidence = extracted?.confidence ?? null;
              const flagged = confidence != null && confidence < 80;
              return (
                <div
                  key={key}
                  style={{
                    background: flagged ? '#fff7ed' : '#f8fafc',
                    borderRadius: 8,
                    padding: '12px 14px',
                    borderLeft: flagged ? '4px solid #f97316' : '4px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{FIELD_LABELS[key]}</label>
                    <ConfidenceBadge score={confidence} />
                  </div>
                  <input
                    value={form[key] ?? ''}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    style={{
                      ...inputS,
                      borderColor: flagged ? '#f97316' : '#d1d5db',
                      background: '#fff',
                    }}
                    placeholder={`Enter ${FIELD_LABELS[key].toLowerCase()}...`}
                  />
                </div>
              );
            })}
          </div>

          {saved ? (
            <div style={{ marginTop: 20, background: '#dcfce7', color: '#16a34a', borderRadius: 8, padding: '12px 16px', fontWeight: 700 }}>
              ✅ Plan specs confirmed and saved!
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                onClick={handleConfirm}
                disabled={saving}
                style={{
                  background: saving ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none',
                  borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 14,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Saving...' : 'Confirm & Save'}
              </button>
              <button
                onClick={() => { setResult(null); setSpecId(null); setFile(null); }}
                style={{
                  background: '#f1f5f9', color: '#374151', border: 'none',
                  borderRadius: 8, padding: '10px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}
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
