import React, { useEffect, useState, useCallback } from 'react';
import Navbar from '../components/Navbar.jsx';
import { getVendors, getTrades, createVendor, updateVendor, deleteVendor } from '../api.js';

const EMPTY = { company_name: '', contact_name: '', email: '', phone: '', trade: '', notes: '', active: true };

const inputStyle = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
  borderRadius: 7, fontSize: 14, outline: 'none', marginBottom: 12,
};

export default function Vendors() {
  const [vendors, setVendors] = useState([]);
  const [trades, setTrades] = useState([]);
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | vendor object
  const [form, setForm] = useState(EMPTY);
  const [delConfirm, setDelConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    getVendors({ search: search || undefined, trade: tradeFilter || undefined })
      .then((r) => setVendors(r.data));
    getTrades().then((r) => setTrades(r.data));
  }, [search, tradeFilter]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm(EMPTY); setModal('add'); setError(''); };
  const openEdit = (v) => { setForm({ ...v }); setModal(v); setError(''); };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (modal === 'add') {
        await createVendor(form);
      } else {
        await updateVendor(modal.id, form);
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    await deleteVendor(id);
    setDelConfirm(null);
    load();
  };

  const toggleActive = async (v) => {
    await updateVendor(v.id, { ...v, active: !v.active });
    load();
  };

  const fld = (key, label, type = 'text', placeholder = '') => (
    <div>
      <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Navbar />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a' }}>Vendors</h1>
          <button onClick={openAdd} style={{
            background: '#f97316', color: '#fff', border: 'none', borderRadius: 8,
            padding: '9px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14,
          }}>
            + Add Vendor
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <input
            placeholder="Search by name, company, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...inputStyle, marginBottom: 0, flex: 2 }}
          />
          <select
            value={tradeFilter}
            onChange={(e) => setTradeFilter(e.target.value)}
            style={{ ...inputStyle, marginBottom: 0, flex: 1 }}
          >
            <option value="">All Trades</option>
            {trades.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Table */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                {['Company', 'Contact', 'Email', 'Phone', 'Trade', 'Status', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 13 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendors.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No vendors found.</td></tr>
              )}
              {vendors.map((v) => (
                <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9', background: v.active ? '#fff' : '#f9fafb' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0f172a' }}>{v.company_name}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{v.contact_name || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{v.email}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{v.phone || '—'}</td>
                  <td style={{ padding: '12px 16px', color: '#374151' }}>{v.trade || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => toggleActive(v)}
                      style={{
                        background: v.active ? '#dcfce7' : '#f1f5f9',
                        color: v.active ? '#16a34a' : '#64748b',
                        border: 'none', borderRadius: 99, padding: '3px 12px',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {v.active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEdit(v)} style={{
                        background: '#f1f5f9', border: 'none', borderRadius: 6,
                        padding: '5px 12px', cursor: 'pointer', fontSize: 13, color: '#374151',
                      }}>Edit</button>
                      <button onClick={() => setDelConfirm(v)} style={{
                        background: '#fff1f2', border: 'none', borderRadius: 6,
                        padding: '5px 12px', cursor: 'pointer', fontSize: 13, color: '#dc2626',
                      }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 32, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ fontWeight: 800, color: '#0f172a', marginBottom: 20, fontSize: 20 }}>
              {modal === 'add' ? 'Add Vendor' : 'Edit Vendor'}
            </h2>
            {fld('company_name', 'Company Name *', 'text', 'Acme Electrical')}
            {fld('contact_name', 'Contact Name', 'text', 'Jane Smith')}
            {fld('email', 'Email *', 'email', 'jane@acme.com')}
            {fld('phone', 'Phone', 'tel', '(555) 000-0000')}
            {fld('trade', 'Trade', 'text', 'Electrical')}
            <div>
              <label style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                placeholder="Optional notes..."
              />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#374151', marginBottom: 20, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Active vendor
            </label>
            {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 7, padding: '9px 20px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ background: '#f97316', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 20px', cursor: 'pointer', fontWeight: 700 }}>
                {saving ? 'Saving...' : 'Save Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {delConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 32, maxWidth: 380, width: '100%' }}>
            <h2 style={{ fontWeight: 800, marginBottom: 12, color: '#0f172a' }}>Delete Vendor?</h2>
            <p style={{ color: '#374151', marginBottom: 24, fontSize: 14 }}>
              Are you sure you want to delete <strong>{delConfirm.company_name}</strong>? This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setDelConfirm(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 7, padding: '9px 20px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={() => handleDelete(delConfirm.id)} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, padding: '9px 20px', cursor: 'pointer', fontWeight: 700 }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
