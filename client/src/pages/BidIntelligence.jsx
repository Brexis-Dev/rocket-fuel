import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar.jsx';
import ReviewQueue from './intelligence/ReviewQueue.jsx';
import PlanExtraction from './intelligence/PlanExtraction.jsx';
import BidNormalization from './intelligence/BidNormalization.jsx';
import BidComparison from './intelligence/BidComparison.jsx';
import PricingModel from './intelligence/PricingModel.jsx';
import { getReviewQueue } from '../api.js';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'plans', label: 'Plans' },
  { id: 'bids', label: 'Bids' },
  { id: 'compare', label: 'Compare' },
  { id: 'model', label: 'Pricing Model' },
];

export default function BidIntelligence() {
  const [activeTab, setActiveTab] = useState('overview');
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    getReviewQueue()
      .then((r) => setQueueCount(r.data.length))
      .catch(() => {});
  }, [activeTab]);

  const tabStyle = (id) => ({
    padding: '10px 20px',
    border: 'none',
    borderBottom: activeTab === id ? '3px solid #f97316' : '3px solid transparent',
    background: 'transparent',
    color: activeTab === id ? '#f97316' : '#64748b',
    fontWeight: activeTab === id ? 700 : 500,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      <Navbar />
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
            🧠 Bid Intelligence Engine
          </h1>
          <p style={{ color: '#64748b', fontSize: 14 }}>
            Upload plans and bids, extract specifications with AI, build pricing models, and compare incoming bids to your baseline.
          </p>
        </div>

        {/* Tab nav */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          marginBottom: 28,
          background: '#fff',
          borderRadius: '12px 12px 0 0',
          padding: '0 8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflowX: 'auto',
        }}>
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)} style={tabStyle(id)}>
              {label}
              {id === 'overview' && queueCount > 0 && (
                <span style={{
                  background: '#f97316', color: '#fff', borderRadius: 99,
                  padding: '1px 7px', fontSize: 11, fontWeight: 800, minWidth: 18, textAlign: 'center',
                }}>
                  {queueCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'overview' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
                {[
                  { label: 'Review Queue', value: queueCount, color: '#f97316', icon: '📋', tab: 'overview' },
                  { label: 'Upload Plans', value: 'Extract specs', color: '#7c3aed', icon: '📐', tab: 'plans' },
                  { label: 'Upload Bids', value: 'Normalize & review', color: '#1d4ed8', icon: '📄', tab: 'bids' },
                  { label: 'Compare Bids', value: 'vs. baseline', color: '#16a34a', icon: '⚖️', tab: 'compare' },
                  { label: 'Pricing Model', value: 'Build & track', color: '#0f172a', icon: '📊', tab: 'model' },
                ].map(({ label, value, color, icon, tab }) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
                      padding: '20px', cursor: 'pointer', textAlign: 'left',
                      transition: 'all 0.15s', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
                  </button>
                ))}
              </div>

              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: 24 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>
                  Review Queue
                  {queueCount > 0 && (
                    <span style={{ background: '#f97316', color: '#fff', borderRadius: 99, padding: '2px 10px', fontSize: 13, fontWeight: 800, marginLeft: 10 }}>
                      {queueCount}
                    </span>
                  )}
                </h2>
                <ReviewQueue onReview={(item) => setActiveTab(item.item_type === 'plan' ? 'plans' : 'bids')} />
              </div>
            </div>
          )}

          {activeTab === 'plans' && <PlanExtraction />}
          {activeTab === 'bids' && <BidNormalization />}
          {activeTab === 'compare' && <BidComparison />}
          {activeTab === 'model' && <PricingModel />}
        </div>
      </div>
    </div>
  );
}
