import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Truck, Wrench, ScanSearch, Fuel as FuelIcon, Package,
  ShieldCheck, Wallet, Users, FileText, ChevronDown, ChevronUp, LogOut
} from 'lucide-react';

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
  { to: '/', icon: LayoutDashboard, label: 'לוח בקרה', exact: true },
  {
    icon: Truck, label: 'רכבים', to: '/vehicles',
    children: [
      { to: '/maintenance', icon: Wrench,     label: 'טיפולים' },
      { to: '/inspections', icon: ScanSearch, label: 'בדיקות' },
      { to: '/fuel',        icon: FuelIcon,   label: 'דלק' },
      { to: '/tools',       icon: Package,    label: 'כלי עבודה' },
    ]
  },
  { to: '/insurance', icon: ShieldCheck, label: 'פוליסות' },
  { to: '/finance',   icon: Wallet,      label: 'כספים' },
  { to: '/employees', icon: Users,       label: 'עובדים' },
  { to: '/operator-license', icon: FileText, label: 'רישיון מפעיל' },
];

const ICON_SIZE = 17;

function NavItem({ item }) {
  const isActive = window.location.pathname === item.to ||
    (item.exact ? false : window.location.pathname.startsWith(item.to + '/'));
  const Icon = item.icon;
  return (
    <NavLink to={item.to} end={item.exact} className={({ isActive }) => isActive ? 'active' : ''}>
      <span className="nav-icon"><Icon size={ICON_SIZE} strokeWidth={1.8} /></span>
      {item.label}
    </NavLink>
  );
}

function NavGroup({ item }) {
  const location = window.location.pathname;
  const isChildActive = item.children.some(c => location.startsWith(c.to));
  const isParentActive = location === item.to || location.startsWith(item.to + '/');
  const [open, setOpen] = React.useState(isChildActive || isParentActive);
  const Icon = item.icon;

  return (
    <div>
      <div
        className={`sidebar-nav-item${isParentActive && !isChildActive ? ' active' : ''}`}
        style={{ justifyContent: 'space-between' }}
        onClick={() => setOpen(o => !o)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}
          onClick={e => { e.stopPropagation(); window.location.href = item.to; }}>
          <span className="nav-icon"><Icon size={ICON_SIZE} strokeWidth={1.8} /></span>
          {item.label}
        </div>
        <span style={{ color: 'var(--gray)', display: 'flex' }}>
          {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </span>
      </div>
      {open && (
        <div style={{ paddingRight: 12 }}>
          {item.children.map(c => {
            const CIcon = c.icon;
            return (
              <NavLink key={c.to} to={c.to} className={({ isActive }) => isActive ? 'active' : ''}
                style={{ paddingRight: 30, fontSize: 13 }}>
                <span className="nav-icon"><CIcon size={15} strokeWidth={1.8} /></span>
                {c.label}
              </NavLink>
            );
          })}
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
    '/': 'לוח בקרה',
    '/vehicles': 'ניהול רכבים',
    '/maintenance': 'טיפולים',
    '/inspections': 'בדיקות רכב',
    '/insurance': 'פוליסות ביטוח',
    '/fuel': 'ניהול דלק',
    '/employees': 'עובדים',
    '/tools': 'כלי עבודה',
    '/finance': 'כספים',
    '/operator-license': 'רישיון מפעיל',
  };
  const currentPath = window.location.pathname;
  const pathKey = Object.keys(pageTitles).find(k => currentPath === k || (k !== '/' && currentPath.startsWith(k + '/')));
  const title = pageTitles[pathKey] || 'מערכת ניהול';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>
            <Truck size={18} strokeWidth={2} style={{ color: 'var(--primary)' }} />
            מערכת ניהול
          </h2>
          <p>הצוות תשתיות בע"מ</p>
        </div>
        <nav className="sidebar-nav">
          {NAV.map(n => n.children ? (
            <NavGroup key={n.to} item={n} />
          ) : (
            <NavItem key={n.to} item={n} />
          ))}
        </nav>
        <div className="sidebar-footer">גרסה 1.0</div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <h1>{title}</h1>
          <div className="topbar-actions">
            <span className="user-info">
              {user?.full_name || user?.username}
              <span style={{ marginRight: 4, color: '#9ca3af' }}>
                ({user?.role === 'admin' ? 'מנהל' : 'מדווח'})
              </span>
            </span>
            <button className="btn-logout" onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <LogOut size={13} />
              יציאה
            </button>
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
