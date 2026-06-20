import React, { useEffect, useState } from 'react';
import { getReviewQueue } from '../../api.js';

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

export default function ReviewQueue({ onReview }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReviewQueue()
      .then((r) => setItems(r.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (d) => d ? new Date(d).toLocaleDateString() : '—';

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading queue...</div>;
  if (items.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ color: '#64748b', fontSize: 16 }}>Review queue is empty — all extractions confirmed.</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ background: '#f97316', color: '#fff', borderRadius: 99, padding: '2px 10px', fontWeight: 700, fontSize: 13 }}>
          {items.length}
        </span>
        <span style={{ color: '#64748b', fontSize: 14 }}>items pending review</span>
      </div>
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {['Type', 'Project', 'Vendor', 'Uploaded', 'Confidence', 'Actions'].map((h) => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isLow = item.avg_confidence != null && item.avg_confidence < 60;
              return (
                <tr
                  key={`${item.item_type}-${item.id}`}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    borderLeft: isLow ? '4px solid #dc2626' : '4px solid transparent',
                  }}
                >
                  <td style={{ padding: '11px 14px' }}>
                    <span style={{
                      background: item.item_type === 'plan' ? '#ede9fe' : '#dbeafe',
                      color: item.item_type === 'plan' ? '#7c3aed' : '#1d4ed8',
                      borderRadius: 99, padding: '2px 9px', fontSize: 11, fontWeight: 700,
                    }}>
                      {item.item_type === 'plan' ? '📐 Plan' : '📄 Bid'}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{item.project_name}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: '#64748b' }}>{item.vendor_name || '—'}</td>
                  <td style={{ padding: '11px 14px', fontSize: 13, color: '#64748b' }}>{fmt(item.created_at)}</td>
                  <td style={{ padding: '11px 14px' }}><ConfidenceBadge score={item.avg_confidence} /></td>
                  <td style={{ padding: '11px 14px' }}>
                    <button
                      onClick={() => onReview && onReview(item)}
                      style={{
                        background: '#f97316', color: '#fff', border: 'none', borderRadius: 6,
                        padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      }}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
