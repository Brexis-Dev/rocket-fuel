import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar.jsx';
import { getProjects, getVendors, getTracker } from '../api.js';

const card = (label, value, color = '#f97316') => (
  <div key={label} style={{
    background: '#fff',
    borderRadius: 12,
    padding: '24px 28px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
    border: '1px solid #e2e8f0',
    flex: '1 1 200px',
  }}>
    <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500, marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 36, fontWeight: 800, color }}>{value}</div>
  </div>
);

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [tracker, setTracker] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getProjects(), getVendors(), getTracker()])
      .then(([p, v, t]) => {
        setProjects(p.data);
        setVendors(v.data);
        setTracker(t.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const in14 = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const distThisMonth = tracker.filter((r) => new Date(r.sent_at) >= thisMonthStart);
  const pendingBids = tracker.filter((r) => r.status === 'Pending');
  const overdue = tracker.filter((r) => {
    if (!r.bid_due_date || r.status !== 'Pending') return false;
    return new Date(r.bid_due_date) < now;
  });
  const upcoming = tracker
    .filter((r) => {
      if (!r.bid_due_date) return false;
      const d = new Date(r.bid_due_date);
      return d >= now && d <= in14;
    })
    .sort((a, b) => new Date(a.bid_due_date) - new Date(b.bid_due_date));

  const recentDists = [...tracker].sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at)).slice(0, 5);

  const fmt = (d) => d ? new Date(d).toLocaleDateString() : '—';

  const statusBadge = (s) => {
    const colors = { Pending: '#6b7280', Responded: '#16a34a', Declined: '#dc2626', 'No Response': '#ea580c' };
    return (
      <span style={{
        background: colors[s] || '#6b7280',
        color: '#fff',
        borderRadius: 99,
        padding: '2px 10px',
        fontSize: 12,
        fontWeight: 600,
      }}>{s || 'Pending'}</span>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Navbar />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 24 }}>Dashboard</h1>

        {loading ? (
          <p style={{ color: '#64748b' }}>Loading...</p>
        ) : (
          <>
            {/* Stats Cards */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 32 }}>
              {card('Active Projects', projects.length, '#f97316')}
              {card('Total Vendors', vendors.filter((v) => v.active).length, '#0ea5e9')}
              {card('Distributions This Month', distThisMonth.length, '#8b5cf6')}
              {card('Pending Bids', pendingBids.length, overdue.length > 0 ? '#dc2626' : '#16a34a')}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Upcoming Due Dates */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0' }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>
                  Upcoming Due Dates <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 13 }}>(next 14 days)</span>
                </h2>
                {upcoming.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: 14 }}>No upcoming due dates.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        {['Project', 'Vendor', 'Due Date'].map((h) => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {upcoming.map((r) => {
                        const isOverdue = new Date(r.bid_due_date) < now;
                        return (
                          <tr key={r.distribution_id} style={{ borderBottom: '1px solid #f1f5f9', background: isOverdue ? '#fff1f2' : 'transparent' }}>
                            <td style={{ padding: '8px 8px', color: '#0f172a' }}>{r.project_name}</td>
                            <td style={{ padding: '8px 8px', color: '#374151' }}>{r.vendor_name}</td>
                            <td style={{ padding: '8px 8px', color: isOverdue ? '#dc2626' : '#374151', fontWeight: isOverdue ? 700 : 400 }}>
                              {fmt(r.bid_due_date)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Recent Distributions */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e2e8f0' }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 16 }}>Recent Distributions</h2>
                {recentDists.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: 14 }}>No distributions yet.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                        {['Project', 'Vendor', 'Sent', 'Status'].map((h) => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recentDists.map((r) => (
                        <tr key={r.distribution_id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '8px 8px', color: '#0f172a' }}>{r.project_name}</td>
                          <td style={{ padding: '8px 8px', color: '#374151' }}>{r.vendor_name}</td>
                          <td style={{ padding: '8px 8px', color: '#64748b' }}>{fmt(r.sent_at)}</td>
                          <td style={{ padding: '8px 8px' }}>{statusBadge(r.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Overdue alert */}
            {overdue.length > 0 && (
              <div style={{
                marginTop: 24,
                background: '#fff1f2',
                border: '1px solid #fecaca',
                borderRadius: 10,
                padding: '14px 20px',
                color: '#b91c1c',
                fontWeight: 600,
              }}>
                ⚠️ {overdue.length} bid{overdue.length > 1 ? 's are' : ' is'} overdue and still pending. Check the Tracker.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
