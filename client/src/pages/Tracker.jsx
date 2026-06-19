import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../components/Navbar.jsx';
import { getProjects, getTracker, updateTracker, exportTrackerUrl } from '../api.js';

const STATUS_COLORS = {
  Pending: { bg: '#f1f5f9', color: '#475569' },
  Responded: { bg: '#dcfce7', color: '#16a34a' },
  Declined: { bg: '#fee2e2', color: '#dc2626' },
  'No Response': { bg: '#ffedd5', color: '#ea580c' },
};

const STATUSES = ['All', 'Pending', 'Responded', 'Declined', 'No Response'];

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || STATUS_COLORS.Pending;
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: '3px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {status || 'Pending'}
    </span>
  );
}

function EditableRow({ row, onSave }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    status: row.status || 'Pending',
    response_date: row.response_date ? row.response_date.split('T')[0] : '',
    bid_amount: row.bid_amount || '',
    notes: row.notes || '',
  });

  const now = new Date();
  const isOverdue = row.bid_due_date && row.status === 'Pending' && new Date(row.bid_due_date) < now;
  const fmt = (d) => d ? new Date(d).toLocaleDateString() : '—';
  const fmtMoney = (v) => v != null ? `$${parseFloat(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';

  const handleSave = async () => {
    await onSave(row.distribution_id, form);
    setEditing(false);
  };

  const rowBg = isOverdue ? '#fff7ed' : '#fff';
  const inputS = { padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 };

  return (
    <tr style={{ borderBottom: '1px solid #f1f5f9', background: rowBg }}>
      <td style={{ padding: '11px 12px', fontSize: 13, color: '#0f172a', fontWeight: 500 }}>{row.project_name}</td>
      <td style={{ padding: '11px 12px', fontSize: 13 }}>
        <div style={{ fontWeight: 600, color: '#374151' }}>{row.vendor_name}</div>
        <div style={{ color: '#94a3b8', fontSize: 11 }}>{row.vendor_trade || ''}</div>
      </td>
      <td style={{ padding: '11px 12px', fontSize: 13, color: '#64748b' }}>{fmt(row.sent_at)}</td>
      <td style={{ padding: '11px 12px', fontSize: 13, color: isOverdue ? '#ea580c' : '#374151', fontWeight: isOverdue ? 700 : 400 }}>
        {fmt(row.bid_due_date)}{isOverdue ? ' ⚠️' : ''}
      </td>
      <td style={{ padding: '11px 12px' }}>
        {editing ? (
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={inputS}>
            {STATUSES.filter((s) => s !== 'All').map((s) => <option key={s}>{s}</option>)}
          </select>
        ) : <StatusBadge status={row.status} />}
      </td>
      <td style={{ padding: '11px 12px', fontSize: 13 }}>
        {editing ? (
          <input type="date" value={form.response_date} onChange={(e) => setForm({ ...form, response_date: e.target.value })} style={inputS} />
        ) : fmt(row.response_date)}
      </td>
      <td style={{ padding: '11px 12px', fontSize: 13 }}>
        {editing ? (
          <input type="number" value={form.bid_amount} onChange={(e) => setForm({ ...form, bid_amount: e.target.value })} style={{ ...inputS, width: 120 }} placeholder="0.00" step="0.01" />
        ) : fmtMoney(row.bid_amount)}
      </td>
      <td style={{ padding: '11px 12px', fontSize: 13, maxWidth: 180 }}>
        {editing ? (
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ ...inputS, width: '100%' }} placeholder="Notes..." />
        ) : <span style={{ color: '#64748b' }}>{row.notes || '—'}</span>}
      </td>
      <td style={{ padding: '11px 12px' }}>
        {editing ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleSave} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Save</button>
            <button onClick={() => setEditing(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12, color: '#374151' }}>Edit</button>
        )}
      </td>
    </tr>
  );
}

export default function Tracker() {
  const [rows, setRows] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectFilter, setProjectFilter] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => { getProjects().then((r) => setProjects(r.data)); }, []);

  const load = useCallback(() => {
    setLoading(true);
    getTracker({
      project_id: projectFilter || undefined,
      status: statusFilter !== 'All' ? statusFilter : undefined,
    })
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, [projectFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) =>
    !vendorSearch || r.vendor_name.toLowerCase().includes(vendorSearch.toLowerCase()) || r.vendor_email?.toLowerCase().includes(vendorSearch.toLowerCase())
  );

  const handleSave = async (distId, form) => {
    await updateTracker(distId, form);
    load();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Navbar />
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>Bid Tracker</h1>
          <a
            href={exportTrackerUrl()}
            download
            style={{ background: '#0f172a', color: '#fff', textDecoration: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 700, fontSize: 13 }}
          >
            ↓ Export CSV
          </a>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, minWidth: 200 }}
          >
            <option value="">All Projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input
            placeholder="Search vendor..."
            value={vendorSearch}
            onChange={(e) => setVendorSearch(e.target.value)}
            style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, minWidth: 200 }}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
          >
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 12, alignItems: 'center' }}>
          <span style={{ color: '#64748b' }}>Status:</span>
          {Object.entries(STATUS_COLORS).map(([s, c]) => (
            <span key={s} style={{ background: c.bg, color: c.color, borderRadius: 99, padding: '2px 9px', fontWeight: 600 }}>{s}</span>
          ))}
          <span style={{ color: '#ea580c', fontWeight: 600 }}>⚠️ = Overdue</span>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Project', 'Vendor', 'Sent Date', 'Due Date', 'Status', 'Response Date', 'Bid Amount', 'Notes', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '11px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Loading...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No records found.</td></tr>
              )}
              {!loading && filtered.map((row) => (
                <EditableRow key={row.distribution_id} row={row} onSave={handleSave} />
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, color: '#94a3b8' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</div>
      </div>
    </div>
  );
}
