import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar.jsx';
import { getProjects, getPlans, getVendors, getTrades, sendDistribution } from '../api.js';

export default function Distribute() {
  const [step, setStep] = useState(1);
  const [projects, setProjects] = useState([]);
  const [plans, setPlans] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [trades, setTrades] = useState([]);

  // Selections
  const [projectId, setProjectId] = useState('');
  const [selectedPlans, setSelectedPlans] = useState([]);
  const [selectedVendors, setSelectedVendors] = useState([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState('');
  const [message, setMessage] = useState('');
  const [bidDueDate, setBidDueDate] = useState('');

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getProjects().then((r) => setProjects(r.data));
    getTrades().then((r) => setTrades(r.data));
  }, []);

  useEffect(() => {
    if (projectId) {
      getPlans(projectId).then((r) => setPlans(r.data));
      setSelectedPlans([]);
    }
  }, [projectId]);

  useEffect(() => {
    getVendors({
      search: vendorSearch || undefined,
      trade: tradeFilter || undefined,
    }).then((r) => setVendors(r.data.filter((v) => v.active)));
  }, [vendorSearch, tradeFilter]);

  const togglePlan = (id) =>
    setSelectedPlans((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const toggleVendor = (id) =>
    setSelectedVendors((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const selectAllByTrade = (trade) => {
    const ids = vendors.filter((v) => v.trade === trade).map((v) => v.id);
    setSelectedVendors((prev) => {
      const set = new Set(prev);
      ids.forEach((id) => set.add(id));
      return [...set];
    });
  };

  const handleSend = async () => {
    setError('');
    setSending(true);
    try {
      const res = await sendDistribution({
        project_id: parseInt(projectId),
        plan_ids: selectedPlans,
        vendor_ids: selectedVendors,
        message,
        bid_due_date: bidDueDate || null,
      });
      setResult(res.data);
      setStep(5);
    } catch (err) {
      setError(err.response?.data?.error || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const reset = () => {
    setStep(1); setProjectId(''); setSelectedPlans([]); setSelectedVendors([]);
    setMessage(''); setBidDueDate(''); setResult(null); setError('');
  };

  const btnStyle = (active) => ({
    background: active ? '#f97316' : '#f1f5f9',
    color: active ? '#fff' : '#374151',
    border: 'none', borderRadius: 8, padding: '9px 22px',
    cursor: 'pointer', fontWeight: 700, fontSize: 14,
  });

  const steps = ['Select Project & Plans', 'Select Vendors', 'Compose Message', 'Preview & Send'];

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Navbar />
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: '#0f172a', marginBottom: 24 }}>Distribute Plans</h1>

        {/* Step indicator */}
        {step < 5 && (
          <div style={{ display: 'flex', gap: 0, marginBottom: 32 }}>
            {steps.map((s, i) => {
              const n = i + 1;
              const active = step === n;
              const done = step > n;
              return (
                <div key={s} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? '#16a34a' : active ? '#f97316' : '#e2e8f0',
                    color: done || active ? '#fff' : '#64748b',
                    fontWeight: 700, fontSize: 14, marginBottom: 6,
                  }}>{done ? '✓' : n}</div>
                  <div style={{ fontSize: 11, color: active ? '#f97316' : '#64748b', textAlign: 'center', fontWeight: active ? 600 : 400 }}>{s}</div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e2e8f0', padding: 32 }}>
          {/* Step 1 */}
          {step === 1 && (
            <div>
              <h2 style={{ fontWeight: 700, fontSize: 18, color: '#0f172a', marginBottom: 20 }}>Step 1: Select Project & Plans</h2>
              <label style={{ fontSize: 13, color: '#64748b', display: 'block', marginBottom: 6 }}>Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                style={{ padding: '9px 14px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, marginBottom: 24, minWidth: 300 }}
              >
                <option value="">— Select project —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>

              {plans.length > 0 && (
                <>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#374151', marginBottom: 10 }}>Select Plans to Include</div>
                  {plans.map((p) => (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
                      <input type="checkbox" checked={selectedPlans.includes(p.id)} onChange={() => togglePlan(p.id)} />
                      <span style={{ fontWeight: 500 }}>{p.original_name}</span>
                      {p.revision && <span style={{ color: '#94a3b8', fontSize: 12 }}>({p.revision})</span>}
                      {p.label && <span style={{ color: '#6b7280', fontSize: 12 }}>— {p.label}</span>}
                    </label>
                  ))}
                </>
              )}
              {projectId && plans.length === 0 && (
                <p style={{ color: '#94a3b8', fontSize: 14 }}>No plans uploaded for this project yet.</p>
              )}

              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  disabled={!projectId || selectedPlans.length === 0}
                  onClick={() => setStep(2)}
                  style={btnStyle(projectId && selectedPlans.length > 0)}
                >
                  Next: Select Vendors →
                </button>
              </div>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <h2 style={{ fontWeight: 700, fontSize: 18, color: '#0f172a', marginBottom: 20 }}>Step 2: Select Vendors</h2>
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <input
                  placeholder="Search vendors..."
                  value={vendorSearch}
                  onChange={(e) => setVendorSearch(e.target.value)}
                  style={{ flex: 2, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 14 }}
                />
                <select
                  value={tradeFilter}
                  onChange={(e) => setTradeFilter(e.target.value)}
                  style={{ flex: 1, padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 14 }}
                >
                  <option value="">All Trades</option>
                  {trades.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Group by trade */}
              {(() => {
                const byTrade = {};
                vendors.forEach((v) => {
                  const t = v.trade || 'Other';
                  if (!byTrade[t]) byTrade[t] = [];
                  byTrade[t].push(v);
                });
                return Object.entries(byTrade).map(([trade, tvs]) => (
                  <div key={trade} style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#374151' }}>{trade}</span>
                      <button
                        onClick={() => selectAllByTrade(trade)}
                        style={{ background: '#f1f5f9', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer', color: '#374151' }}
                      >Select All</button>
                    </div>
                    {tvs.map((v) => (
                      <label key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer', fontSize: 14, color: '#374151', paddingLeft: 8 }}>
                        <input type="checkbox" checked={selectedVendors.includes(v.id)} onChange={() => toggleVendor(v.id)} />
                        <span style={{ fontWeight: 500 }}>{v.company_name}</span>
                        {v.contact_name && <span style={{ color: '#94a3b8', fontSize: 12 }}>({v.contact_name})</span>}
                        <span style={{ color: '#64748b', fontSize: 12 }}>{v.email}</span>
                      </label>
                    ))}
                  </div>
                ));
              })()}

              {vendors.length === 0 && <p style={{ color: '#94a3b8', fontSize: 14 }}>No vendors found.</p>}

              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => setStep(1)} style={btnStyle(false)}>← Back</button>
                <button
                  disabled={selectedVendors.length === 0}
                  onClick={() => setStep(3)}
                  style={btnStyle(selectedVendors.length > 0)}
                >
                  Next: Compose Message → ({selectedVendors.length} selected)
                </button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div>
              <h2 style={{ fontWeight: 700, fontSize: 18, color: '#0f172a', marginBottom: 20 }}>Step 3: Compose Message</h2>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>Bid Due Date</label>
                <input
                  type="date"
                  value={bidDueDate}
                  onChange={(e) => setBidDueDate(e.target.value)}
                  style={{ padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 14 }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, color: '#64748b', fontWeight: 500, display: 'block', marginBottom: 6 }}>Message to Vendors</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={7}
                  placeholder="Please review the attached plans and submit your bid by the due date. Feel free to reply with any questions."
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => setStep(2)} style={btnStyle(false)}>← Back</button>
                <button onClick={() => setStep(4)} style={btnStyle(true)}>Preview & Send →</button>
              </div>
            </div>
          )}

          {/* Step 4 — Preview */}
          {step === 4 && (
            <div>
              <h2 style={{ fontWeight: 700, fontSize: 18, color: '#0f172a', marginBottom: 20 }}>Step 4: Preview & Send</h2>

              <div style={{ background: '#f8fafc', borderRadius: 10, padding: 20, marginBottom: 20, fontSize: 14 }}>
                <div style={{ marginBottom: 10 }}><strong>Project:</strong> {projects.find((p) => String(p.id) === projectId)?.name}</div>
                <div style={{ marginBottom: 10 }}><strong>Plans:</strong> {plans.filter((p) => selectedPlans.includes(p.id)).map((p) => p.original_name).join(', ')}</div>
                <div style={{ marginBottom: 10 }}><strong>Vendors ({selectedVendors.length}):</strong> {vendors.filter((v) => selectedVendors.includes(v.id)).map((v) => v.company_name).join(', ')}</div>
                <div style={{ marginBottom: 10 }}><strong>Bid Due Date:</strong> {bidDueDate || 'Not set'}</div>
                <div><strong>Message:</strong>
                  <div style={{ marginTop: 6, color: '#374151', whiteSpace: 'pre-wrap', background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #e2e8f0' }}>
                    {message || '(no message)'}
                  </div>
                </div>
              </div>

              {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 16 }}>{error}</div>}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button onClick={() => setStep(3)} style={btnStyle(false)}>← Back</button>
                <button onClick={handleSend} disabled={sending} style={btnStyle(true)}>
                  {sending ? '📤 Sending...' : `🚀 Send to ${selectedVendors.length} Vendor${selectedVendors.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          )}

          {/* Step 5 — Result */}
          {step === 5 && result && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🚀</div>
              <h2 style={{ fontWeight: 800, fontSize: 22, color: '#0f172a', marginBottom: 8 }}>Distribution Complete!</h2>
              <p style={{ color: '#64748b', marginBottom: 24, fontSize: 14 }}>
                Plans sent to {result.sent?.length || 0} vendor{result.sent?.length !== 1 ? 's' : ''}.
                {result.failed?.length > 0 && ` ${result.failed.length} failed.`}
              </p>

              {result.sent?.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  {result.sent.map((s) => (
                    <div key={s.vendor_id} style={{ color: '#16a34a', fontSize: 14, marginBottom: 4 }}>✓ {s.company}</div>
                  ))}
                </div>
              )}

              {result.failed?.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  {result.failed.map((f) => (
                    <div key={f.vendor_id} style={{ color: '#dc2626', fontSize: 14, marginBottom: 4 }}>✗ {f.company}: {f.error}</div>
                  ))}
                </div>
              )}

              <button onClick={reset} style={btnStyle(true)}>Send Another Distribution</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
