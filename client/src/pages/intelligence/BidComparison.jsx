import React, { useState, useEffect } from 'react';
import { getProjects, getComparisons, compareBidToBaseline, getBidSummaries } from '../../api.js';

function VarianceBadge({ pct }) {
  if (pct == null) return <span style={{ color: '#94a3b8' }}>—</span>;
  const p = parseFloat(pct);
  const s = p > 0.25
    ? { bg: '#fee2e2', color: '#dc2626', label: `+${(p * 100).toFixed(1)}% ▲` }
    : p > 0.10
    ? { bg: '#fef9c3', color: '#a16207', label: `+${(p * 100).toFixed(1)}% ▲` }
    : p < -0.20
    ? { bg: '#dbeafe', color: '#1d4ed8', label: `${(p * 100).toFixed(1)}% ▼` }
    : { bg: '#dcfce7', color: '#16a34a', label: `${p >= 0 ? '+' : ''}${(p * 100).toFixed(1)}%` };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
      {s.label}
    </span>
  );
}

const fmtMoney = (v) => v != null ? `$${parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 0 })}` : '—';
const fmt = (d) => d ? new Date(d).toLocaleDateString() : '—';

export default function BidComparison() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [comparisons, setComparisons] = useState([]);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getProjects().then((r) => setProjects(r.data));
  }, []);

  useEffect(() => {
    if (!projectId) { setComparisons([]); setBids([]); return; }
    setLoading(true);
    Promise.all([
      getComparisons(projectId),
      getBidSummaries(projectId),
    ])
      .then(([cr, br]) => { setComparisons(cr.data); setBids(br.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleCompare = async (bidDocId) => {
    setRunning(bidDocId);
    setError(null);
    try {
      await compareBidToBaseline(projectId, bidDocId);
      const [cr] = await Promise.all([getComparisons(projectId)]);
      setComparisons(cr.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Comparison failed');
    } finally {
      setRunning(null);
    }
  };

  const exportCSV = () => {
    if (!comparisons.length) return;
    const rows = [
      ['Bid File', 'Vendor', 'Date', 'Baseline Total', 'Bid Total', 'Variance $', 'Variance %', 'Completeness', 'Recommended'],
      ...comparisons.map((c) => [
        c.original_name, c.vendor_name, fmt(c.created_at),
        c.baseline_total, c.bid_total, c.variance_amount,
        c.variance_pct != null ? (parseFloat(c.variance_pct) * 100).toFixed(2) + '%' : '',
        c.completeness_score, c.recommended ? 'Yes' : 'No',
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'bid_comparison.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>Bid Comparison</h2>
        <button
          onClick={exportCSV}
          disabled={!comparisons.length}
          style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: comparisons.length ? 1 : 0.4 }}
        >
          ↓ Export CSV
        </button>
      </div>

      <div style={{ marginBottom: 20 }}>
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, minWidth: 240 }}
        >
          <option value="">Select project...</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {projectId && !loading && bids.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Run Comparison</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {bids.filter((b) => b.confirmed).map((b) => (
              <button
                key={b.bid_document_id}
                onClick={() => handleCompare(b.bid_document_id)}
                disabled={running === b.bid_document_id}
                style={{
                  background: running === b.bid_document_id ? '#94a3b8' : '#f97316',
                  color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px',
                  fontWeight: 700, fontSize: 12, cursor: running === b.bid_document_id ? 'not-allowed' : 'pointer',
                }}
              >
                {running === b.bid_document_id ? '⏳ Running...' : `Compare: ${b.vendor_name || b.trade || `Bid #${b.bid_document_id}`}`}
              </button>
            ))}
            {bids.filter((b) => !b.confirmed).length > 0 && (
              <div style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                {bids.filter((b) => !b.confirmed).length} bid(s) pending confirmation
              </div>
            )}
          </div>
        </div>
      )}

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>}

      {!loading && projectId && comparisons.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
          No comparisons yet. Upload confirmed bids and run a comparison above.
        </div>
      )}

      {!loading && comparisons.length > 0 && (
        <>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, fontSize: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ color: '#64748b' }}>Variance:</span>
            {[
              { bg: '#dcfce7', color: '#16a34a', label: 'Within 10%' },
              { bg: '#fef9c3', color: '#a16207', label: '10-25% over' },
              { bg: '#fee2e2', color: '#dc2626', label: '25%+ over' },
              { bg: '#dbeafe', color: '#1d4ed8', label: '20%+ under' },
            ].map((s) => (
              <span key={s.label} style={{ background: s.bg, color: s.color, borderRadius: 99, padding: '2px 9px', fontWeight: 600 }}>{s.label}</span>
            ))}
          </div>

          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  {['Bid / Vendor', 'Date', 'Model Version', 'Baseline Total', 'Bid Total', 'Variance $', 'Variance %', 'Completeness', 'Recommended'].map((h) => (
                    <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisons.map((c) => {
                  const vp = parseFloat(c.variance_pct || 0);
                  const borderColor = vp > 0.25 ? '#dc2626' : vp > 0.10 ? '#a16207' : vp < -0.20 ? '#1d4ed8' : '#16a34a';
                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', borderLeft: `4px solid ${borderColor}` }}>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{c.original_name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{c.vendor_name || '—'}</div>
                      </td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: '#64748b' }}>{fmt(c.created_at)}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: '#64748b' }}>v{c.model_version}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: '#374151' }}>{fmtMoney(c.baseline_total)}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{fmtMoney(c.bid_total)}</td>
                      <td style={{ padding: '11px 14px', fontSize: 13, color: vp >= 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                        {c.variance_amount != null ? (vp >= 0 ? '+' : '') + fmtMoney(c.variance_amount) : '—'}
                      </td>
                      <td style={{ padding: '11px 14px' }}><VarianceBadge pct={c.variance_pct} /></td>
                      <td style={{ padding: '11px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 99, height: 6 }}>
                            <div style={{ width: `${c.completeness_score || 0}%`, background: '#f97316', borderRadius: 99, height: 6 }} />
                          </div>
                          <span style={{ fontSize: 11, color: '#64748b', minWidth: 28 }}>{c.completeness_score || 0}%</span>
                        </div>
                      </td>
                      <td style={{ padding: '11px 14px' }}>
                        {c.recommended && (
                          <span style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 99, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>
                            ✓ Recommended
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
