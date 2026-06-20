import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App.jsx';
import { logout } from '../api.js';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/vendors', label: 'Vendors' },
  { to: '/plans', label: 'Plans' },
  { to: '/distribute', label: 'Distribute' },
  { to: '/tracker', label: 'Tracker' },
  { to: '/intelligence', label: 'Bid Intelligence' },
];

export default function Navbar() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    setUser(null);
    navigate('/login');
  };

  return (
    <nav style={{
      background: '#0f172a',
      padding: '0 24px',
      display: 'flex',
      alignItems: 'center',
      height: 56,
      gap: 8,
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{ color: '#f97316', fontWeight: 800, fontSize: 20, marginRight: 24, whiteSpace: 'nowrap' }}>
        🚀 Rocket Fuel
      </div>

      <div style={{ display: 'flex', gap: 4, flex: 1 }}>
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              color: isActive ? '#f97316' : '#94a3b8',
              textDecoration: 'none',
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              background: isActive ? 'rgba(249,115,22,0.12)' : 'transparent',
              transition: 'all 0.15s',
            })}
          >
            {label}
          </NavLink>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: '#64748b', fontSize: 13 }}>{user?.name}</span>
        <button
          onClick={handleLogout}
          style={{
            background: 'transparent',
            border: '1px solid #334155',
            color: '#94a3b8',
            padding: '5px 12px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
