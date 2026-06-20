import React, { useState, useEffect } from 'react';
import { buildPricingModel, getModelHistory } from '../../api.js';

const fmt = (d) => d ? new Date(d).toLocaleDateString() : '—';
const fmtMoney = (v) => v != null ? `$${parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';
const fmtPct = (v) => v != null ? `${(parseFloat(v) * 100).toFixed(1)}%` : '—';

export default function PricingModel() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState(null);
  const [notes, setNotes] = useState('');
  const [lastBuild, setLastBuild] = useState(null);

  const loadHistory = () => {
    setLoading(true);
    getModelHistory()
      .then((r) => setHistory(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadHistory(); }, []);

  const handleBuild = async () => {
    setBuilding(true);
    setError(null);
    try {
      const res = await buildPricingModel(notes);
      setLastBuild(res.data);
      setNotes('');
      loadHistory();
    } catch (err) {
      setError(err.response?.data?.error || 'Build failed');
    } finally {
      setBuilding(false);
    }
  };

  const current = history[0];
  const currentFactors = current?.snapshot?.factors || [];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Pricing Model</h2>
          {current && (
            <div style={{ fontSize: 13, color: '#64748b' }}>
              Current version: <strong style={{ color: '#f97316' }}>v{current.version}</strong> — built {fmt(current.created_at)} by {current.created_by_name || 'system'}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Build notes (optional)..."
            style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, width: 220 }}
          />
          <button
            onClick={handleBuild}
            disabled={building}
            style={{
              background: building ? '#94a3b8' : '#f97316', color: '#fff', border: 'none',
              borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: 14,
              cursor: building ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {building ? '⏳ Building...' : current ? '🔁 Rebuild Model' : '🏗️ Build Model'}
          </button>
        </div>
      </div>

      {error && <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>{error}</div>}

      {lastBuild && (
        <div style={{ background: '#dcfce7', color: '#16a34a', borderRadius: 8, padding: '12px 16px', fontWeight: 700, marginBottom: 20 }}>
          ✅ Pricing model v{lastBuild.version} built successfully with {lastBuild.factors?.length || 0} trade factors.
        </div>
      )}

      {!loading && !current && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏗️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 8 }}>No Pricing Model Yet</div>
          <div style={{ fontSize: 13, color: '#64748b', maxWidth: 400, margin: '0 auto' }}>
            Upload and confirm at least one reference plan and reference bid, then click Build Model to generate pricing factors.
          </div>
        </div>
      )}

      {currentFactors.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 24, overflow: 'auto' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Current Pricing Factors — v{current.version}</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Trade', 'Cost / Sq Ft', '% of Total', 'Samples'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentFactors.map((f, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 16px', fontWeight: 700, fontSize: 13, color: '#0f172a' }}>{f.trade || '—'}</td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: '#374151' }}>{fmtMoney(f.cost_per_sqft)}</td>
                  <td style={{ padding: '11px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 80, background: '#e2e8f0', borderRadius: 99, height: 6 }}>
                        <div style={{ width: `${Math.min((parseFloat(f.pct_of_total || 0) * 100), 100)}%`, background: '#f97316', borderRadius: 99, height: 6 }} />
                      </div>
                      <span style={{ fontSize: 12, color: '#64748b' }}>{fmtPct(f.pct_of_total)}</span>
                    </div>
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: '#64748b' }}>{f.sample_count || 1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Model Version History</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Version', 'Built', 'By', 'Trades', 'Notes'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((v, i) => (
                <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9', background: i === 0 ? '#fff7ed' : '#fff' }}>
                  <td style={{ padding: '11px 16px' }}>
                    <span style={{
                      background: i === 0 ? '#f97316' : '#e2e8f0',
                      color: i === 0 ? '#fff' : '#374151',
                      borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 700,
                    }}>
                      v{v.version}{i === 0 ? ' (current)' : ''}
                    </span>
                  </td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: '#64748b' }}>{fmt(v.created_at)}</td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: '#374151' }}>{v.created_by_name || '—'}</td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: '#374151' }}>{v.snapshot?.factors?.length || 0}</td>
                  <td style={{ padding: '11px 16px', fontSize: 13, color: '#64748b' }}>{v.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
