import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Vehicles from './pages/Vehicles';
import VehicleDetail from './pages/VehicleDetail';
import Employees from './pages/Employees';
import Maintenance from './pages/Maintenance';
import Inspections from './pages/Inspections';
import Insurance from './pages/Insurance';
import Fuel from './pages/Fuel';
import Tools from './pages/Tools';
import Finance from './pages/Finance';
import OperatorLicense from './pages/OperatorLicense';
import Login from './pages/Login';

function getUser() {
  try { return JSON.parse(localStorage.getItem('fleet_user') || 'null'); } catch { return null; }
}

const NAV = [
  { to: '/', icon: '🏠', label: 'לוח בקרה', exact: true },
  {
    icon: '🚗', label: 'רכבים', to: '/vehicles',
    children: [
      { to: '/maintenance', icon: '🔧', label: 'טיפולים' },
      { to: '/inspections', icon: '🔍', label: 'בדיקות' },
      { to: '/fuel', icon: '⛽', label: 'דלק' },
      { to: '/tools', icon: '🔩', label: 'כלי עבודה' },
    ]
  },
  { to: '/insurance', icon: '🛡️', label: 'פוליסות' },
  { to: '/finance', icon: '💰', label: 'כספים' },
  { to: '/employees', icon: '👥', label: 'עובדים' },
  { to: '/operator-license', icon: '📜', label: 'רישיון מפעיל' },
];

function NavGroup({ item }) {
  const location = window.location.pathname;
  const isChildActive = item.children.some(c => location.startsWith(c.to));
  const isParentActive = location === item.to || location.startsWith(item.to + '/');
  const [open, setOpen] = React.useState(isChildActive || isParentActive);

  return (
    <div>
      <div
        style={{ display:'flex', alignItems:'center', cursor:'pointer', gap:8,
          padding:'10px 20px', color: (isParentActive||isChildActive) ? '#fff' : 'rgba(255,255,255,0.7)',
          background: isParentActive && !isChildActive ? 'rgba(255,255,255,0.15)' : 'transparent',
          borderRight: isParentActive && !isChildActive ? '3px solid #fff' : '3px solid transparent',
          fontSize:14, userSelect:'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <NavLink to={item.to} style={{ flex:1, color:'inherit', textDecoration:'none', display:'flex', alignItems:'center', gap:8 }}
          onClick={e => e.stopPropagation()}>
          <span>{item.icon}</span> {item.label}
        </NavLink>
        <span style={{ fontSize:10, opacity:0.7 }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ paddingRight:16 }}>
          {item.children.map(c => (
            <NavLink key={c.to} to={c.to} className={({ isActive }) => isActive ? 'active' : ''}
              style={{ paddingRight:28, fontSize:13 }}>
              <span className="nav-icon">{c.icon}</span> {c.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function Layout({ children }) {
  const navigate = useNavigate();
  const user = getUser();

  function logout() {
    localStorage.removeItem('fleet_token');
    localStorage.removeItem('fleet_user');
    navigate('/login');
  }

  const pageTitles = {
    '/': 'לוח בקרה', '/vehicles': 'ניהול רכבים', '/maintenance': 'טיפולים',
    '/inspections': 'בדיקות רכב', '/insurance': 'פוליסות ביטוח', '/fuel': 'ניהול דלק',
    '/employees': 'עובדים', '/tools': 'כלי עבודה', '/finance': 'כספים',
    '/operator-license': 'רישיון מפעיל'
  };
  const currentPath = window.location.pathname;
  const title = pageTitles[currentPath] || 'מערכת ניהול';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>🚛 מערכת ניהול</h2>
          <p>הצוות תשתיות בע"מ</p>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => n.children ? (
            <NavGroup key={n.to} item={n} />
          ) : (
            <NavLink key={n.to} to={n.to} end={n.exact} className={({ isActive }) => isActive ? 'active' : ''}>
              <span className="nav-icon">{n.icon}</span> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">גרסה 1.0</div>
      </aside>
      <div className="main-content">
        <header className="topbar">
          <h1>{title}</h1>
          <div className="topbar-actions">
            <span className="user-info">{user?.full_name || user?.username} ({user?.role === 'admin' ? 'מנהל' : 'מדווח'})</span>
            <button className="btn-logout" onClick={logout}>יציאה</button>
          </div>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}

function PrivateRoute({ children }) {
  const token = localStorage.getItem('fleet_token');
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/vehicles" element={<Vehicles />} />
                <Route path="/vehicles/:id" element={<VehicleDetail />} />
                <Route path="/maintenance" element={<Maintenance />} />
                <Route path="/inspections" element={<Inspections />} />
                <Route path="/insurance" element={<Insurance />} />
                <Route path="/fuel" element={<Fuel />} />
                <Route path="/employees" element={<Employees />} />
                <Route path="/tools" element={<Tools />} />
                <Route path="/finance" element={<Finance />} />
                <Route path="/operator-license" element={<OperatorLicense />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
