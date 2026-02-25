import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Truck, LayoutDashboard, Wrench, ScanSearch, Fuel as FuelIcon, Package,
  ShieldCheck, CreditCard, BarChart2, FolderOpen, FileText, AlertTriangle,
  ChevronDown, ChevronUp, DollarSign, Users, Briefcase, User, CheckSquare,
  Scale, X, Menu
} from 'lucide-react';

const DEPTS = [
  {
    id: 'vehicles',
    label: 'רכבים',
    icon: Truck,
    dashPath: '/dept/vehicles/dashboard',
    children: [
      { to: '/dept/vehicles/dashboard', icon: LayoutDashboard, label: 'דשבורד רכבים' },
      { to: '/dept/vehicles/list', icon: Truck, label: 'רכבים' },
      { to: '/dept/vehicles/maintenance/list', icon: Wrench, label: 'טיפולים' },
      { to: '/dept/vehicles/inspections/list', icon: ScanSearch, label: 'בדיקות' },
      { to: '/dept/vehicles/fuel/invoices', icon: FuelIcon, label: 'דלק' },
      { to: '/dept/vehicles/policies/list', icon: ShieldCheck, label: 'פוליסות' },
      { to: '/dept/vehicles/policies/payments', icon: CreditCard, label: 'תשלומים' },
      { to: '/dept/vehicles/payment-methods', icon: CreditCard, label: 'אמצעי תשלום' },
      { to: '/dept/vehicles/reports/payment-methods', icon: BarChart2, label: 'דוח אמצעי תשלום' },
      { to: '/dept/vehicles/tools/list', icon: Package, label: 'כלי עבודה' },
      { to: '/dept/vehicles/tools/categories', icon: FolderOpen, label: 'קטגוריות כלים' },
      { to: '/dept/vehicles/documents', icon: FileText, label: 'מסמכים' },
      { to: '/dept/vehicles/operator-license', icon: FileText, label: 'רישיון מפעיל' },
      { to: '/dept/vehicles/duplicates', icon: AlertTriangle, label: 'כפילויות' },
    ]
  },
  { id: 'finance',   label: 'כספים',    icon: DollarSign, dashPath: '/dept/finance',   children: [] },
  { id: 'employees', label: 'עובדים',   icon: Users,      dashPath: '/dept/employees', children: [] },
  { id: 'projects',  label: 'פרויקטים', icon: Briefcase,  dashPath: '/dept/projects',  children: [] },
  { id: 'clients',   label: 'לקוחות',   icon: User,       dashPath: '/dept/clients',   children: [] },
  { id: 'tasks',     label: 'משימות',   icon: CheckSquare,dashPath: '/dept/tasks',     children: [] },
  { id: 'legal',     label: 'משפטי',    icon: Scale,      dashPath: '/dept/legal',     children: [] },
];

export default function Sidebar({ open, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [openDept, setOpenDept] = useState('vehicles');

  function isChildActive(dept) {
    return dept.children.some(c => location.pathname.startsWith(c.to));
  }

  function handleDeptClick(dept, e) {
    if (dept.children.length === 0) {
      navigate(dept.dashPath);
      if (onClose) onClose();
      return;
    }
    // Toggle accordion
    if (openDept === dept.id) {
      setOpenDept(null);
    } else {
      setOpenDept(dept.id);
    }
  }

  function handleDeptLabelClick(dept, e) {
    e.stopPropagation();
    navigate(dept.dashPath);
    if (onClose) onClose();
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40,
            display: 'none'
          }}
          className="sidebar-overlay"
        />
      )}

      <aside
        className={`sidebar${open ? ' sidebar-open' : ''}`}
        style={{ overflowY: 'auto' }}
      >
        {/* Mobile close button */}
        <button
          className="sidebar-close-btn"
          onClick={onClose}
          aria-label="סגור תפריט"
          style={{ display: 'none' }}
        >
          <X size={20} />
        </button>

        <div className="sidebar-logo">
          <h2>
            <Truck size={18} strokeWidth={2} style={{ color: 'var(--primary)' }} />
            מערכת ניהול
          </h2>
          <p>הצוות תשתיות בע"מ</p>
        </div>

        <nav className="sidebar-nav">
          {DEPTS.map(dept => {
            const Icon = dept.icon;
            const isOpen = openDept === dept.id;
            const hasChildren = dept.children.length > 0;
            const active = isChildActive(dept) || location.pathname.startsWith(dept.dashPath);

            return (
              <div key={dept.id}>
                <div
                  className={`sidebar-dept-item${active && !isOpen ? ' active' : ''}`}
                  onClick={(e) => handleDeptClick(dept, e)}
                >
                  <div
                    className="sidebar-dept-label"
                    onClick={(e) => handleDeptLabelClick(dept, e)}
                  >
                    <span className="nav-icon"><Icon size={17} strokeWidth={1.8} /></span>
                    <span>{dept.label}</span>
                  </div>
                  {hasChildren && (
                    <span className="sidebar-chevron">
                      {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </span>
                  )}
                </div>

                {hasChildren && isOpen && (
                  <div className="sidebar-children">
                    {dept.children.map(child => {
                      const CIcon = child.icon;
                      return (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          onClick={() => { if (onClose) onClose(); }}
                          className={({ isActive }) =>
                            `sidebar-child-link${isActive || location.pathname === child.to ? ' active' : ''}`
                          }
                        >
                          <span className="nav-icon"><CIcon size={15} strokeWidth={1.8} /></span>
                          {child.label}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">גרסה 2.0</div>
      </aside>
    </>
  );
}
