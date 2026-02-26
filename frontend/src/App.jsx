import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { LogOut, Menu } from 'lucide-react';

// Sidebar
import Sidebar from './components/Sidebar';

// Pages - existing
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

// Pages - new
import VehiclesDashboard from './pages/VehiclesDashboard';
import PaymentMethods from './pages/PaymentMethods';
import PaymentSchedule from './pages/PaymentSchedule';
import PaymentMethodsReport from './pages/PaymentMethodsReport';
import Documents from './pages/Documents';
import ToolCategories from './pages/ToolCategories';
import Duplicates from './pages/Duplicates';
import MissingData from './pages/MissingData';
import PolicyMonthlySummary from './pages/PolicyMonthlySummary';

function getUser() {
  try { return JSON.parse(localStorage.getItem('fleet_user') || 'null'); } catch { return null; }
}

const PAGE_TITLES = {
  '/dept/vehicles/dashboard': 'דשבורד רכבים',
  '/dept/vehicles/list': 'ניהול רכבים',
  '/dept/vehicles/maintenance/list': 'טיפולים',
  '/dept/vehicles/inspections/list': 'בדיקות רכב',
  '/dept/vehicles/fuel/invoices': 'ניהול דלק',
  '/dept/vehicles/policies/list': 'פוליסות ביטוח',
  '/dept/vehicles/policies/payments': 'לוח תשלומים',
  '/dept/vehicles/payment-methods': 'אמצעי תשלום',
  '/dept/vehicles/reports/payment-methods': 'דוח לפי אמצעי תשלום',
  '/dept/vehicles/tools/list': 'כלי עבודה',
  '/dept/vehicles/tools/categories': 'קטגוריות כלים',
  '/dept/vehicles/documents': 'מרכז מסמכים',
  '/dept/vehicles/operator-license': 'רישיון מפעיל',
  '/dept/vehicles/duplicates': 'כפילויות',
};

function ComingSoon({ dept }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16, color: '#64748b' }}>
      <div style={{ fontSize: 64 }}>🚧</div>
      <h2 style={{ margin: 0, fontSize: 24, color: '#1e293b' }}>מחלקת {dept}</h2>
      <p style={{ margin: 0, fontSize: 16 }}>המודול הזה בפיתוח — יהיה זמין בקרוב</p>
    </div>
  );
}

function Layout({ children }) {
  const navigate = useNavigate();
  const user = getUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  function logout() {
    localStorage.removeItem('fleet_token');
    localStorage.removeItem('fleet_user');
    navigate('/login');
  }

  const path = window.location.pathname;
  const titleKey = Object.keys(PAGE_TITLES).find(k => path === k || path.startsWith(k + '/'));
  const title = PAGE_TITLES[titleKey] || 'מערכת ניהול';

  return (
    <div className="layout">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-content">
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(o => !o)}
              aria-label="תפריט"
            >
              <Menu size={20} />
            </button>
            <h1 style={{ margin: 0 }}>{title}</h1>
          </div>
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
        <Route path="/" element={<Navigate to="/dept/vehicles/dashboard" replace />} />

        {/* Legacy route redirects */}
        <Route path="/vehicles" element={<Navigate to="/dept/vehicles/list" replace />} />
        <Route path="/vehicles/:id" element={<LegacyVehicleRedirect />} />
        <Route path="/maintenance" element={<Navigate to="/dept/vehicles/maintenance/list" replace />} />
        <Route path="/inspections" element={<Navigate to="/dept/vehicles/inspections/list" replace />} />
        <Route path="/insurance" element={<Navigate to="/dept/vehicles/policies/list" replace />} />
        <Route path="/fuel" element={<Navigate to="/dept/vehicles/fuel/invoices" replace />} />
        <Route path="/tools" element={<Navigate to="/dept/vehicles/tools/list" replace />} />
        <Route path="/operator-license" element={<Navigate to="/dept/vehicles/operator-license" replace />} />

        <Route path="/dept/*" element={
          <PrivateRoute>
            <Layout>
              <Routes>
                {/* Dept root redirects */}
                <Route path="vehicles" element={<Navigate to="/dept/vehicles/dashboard" replace />} />
                <Route path="vehicles/dashboard" element={<VehiclesDashboard />} />
                <Route path="vehicles/list" element={<Vehicles />} />
                <Route path="vehicles/:id/overview" element={<VehicleDetail />} />
                <Route path="vehicles/:id/missing-data" element={<MissingData />} />
                <Route path="vehicles/maintenance/list" element={<Maintenance />} />
                <Route path="vehicles/inspections/list" element={<Inspections />} />
                <Route path="vehicles/fuel/invoices" element={<Fuel />} />
                <Route path="vehicles/policies/list" element={<Insurance />} />
                <Route path="vehicles/policies/payments" element={<PaymentSchedule />} />
                <Route path="vehicles/payment-methods" element={<PaymentMethods />} />
                <Route path="vehicles/tools/list" element={<Tools />} />
                <Route path="vehicles/tools/categories" element={<ToolCategories />} />
                <Route path="vehicles/documents" element={<Documents />} />
                <Route path="vehicles/operator-license" element={<OperatorLicense />} />
                <Route path="vehicles/duplicates" element={<Duplicates />} />
                <Route path="vehicles/reports/payment-methods" element={<PaymentMethodsReport />} />
                <Route path="vehicles/reports/monthly-summary" element={<PolicyMonthlySummary />} />

                {/* Placeholder depts */}
                <Route path="finance" element={<Finance />} />
                <Route path="employees" element={<Employees />} />
                <Route path="projects" element={<ComingSoon dept="פרויקטים" />} />
                <Route path="clients" element={<ComingSoon dept="לקוחות" />} />
                <Route path="tasks" element={<ComingSoon dept="משימות" />} />
                <Route path="legal" element={<ComingSoon dept="משפטי" />} />
                <Route path="*" element={<Navigate to="/dept/vehicles/dashboard" replace />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        } />

        {/* Old protected routes (keep for backward compat) */}
        <Route path="/*" element={
          <PrivateRoute>
            <Layout>
              <Routes>
                <Route path="employees" element={<Employees />} />
                <Route path="finance" element={<Finance />} />
                <Route path="*" element={<Navigate to="/dept/vehicles/dashboard" replace />} />
              </Routes>
            </Layout>
          </PrivateRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

function LegacyVehicleRedirect() {
  const { id } = useParams();
  return <Navigate to={`/dept/vehicles/${id}/overview`} replace />;
}
