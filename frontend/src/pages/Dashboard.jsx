import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Link } from 'react-router-dom';
import {
  Truck, CreditCard, ShieldCheck, Wrench, Users,
  AlertTriangle, AlertCircle, Info, CheckCircle, BarChart2
} from 'lucide-react';

function dayClass(date) {
  if (!date) return '';
  const days = Math.floor((new Date(date) - new Date()) / 86400000);
  if (days < 0) return 'date-danger';
  if (days < 30) return 'date-warn';
  return 'date-ok';
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }
function daysTo(d) {
  if (!d) return null;
  return Math.floor((new Date(d) - new Date()) / 86400000);
}

function StatCard({ value, label, sub, color, Icon }) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="stat-value" style={{ color: color || 'var(--primary)' }}>{value ?? '—'}</div>
          <div className="stat-label">{label}</div>
          {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
        </div>
        {Icon && <Icon size={28} strokeWidth={1.4} style={{ color: color || 'var(--primary)', opacity: 0.25 }} />}
      </div>
    </div>
  );
}

function AlertIcon({ severity }) {
  if (severity === 'high')   return <AlertCircle   size={15} strokeWidth={2} style={{ color: 'var(--danger)',  flexShrink: 0, marginTop: 2 }} />;
  if (severity === 'medium') return <AlertTriangle size={15} strokeWidth={2} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />;
  return                            <Info          size={15} strokeWidth={2} style={{ color: 'var(--info)',    flexShrink: 0, marginTop: 2 }} />;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    api.dashStats().then(setStats).catch(() => {});
    api.dashAlerts().then(setAlerts).catch(() => {});
    api.dashVehicles().then(setVehicles).catch(() => {});
  }, []);

  const activeVehicles = stats?.vehicles_by_status?.find(v => v.status === 'פעיל')?.cnt || 0;
  const totalVehicles  = stats?.vehicles_by_status?.reduce((s, v) => s + v.cnt, 0) || 0;
  const highAlerts     = alerts.filter(a => a.severity === 'high').length;

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid">
        <StatCard value={activeVehicles} label="רכבים פעילים" sub={`מתוך ${totalVehicles} סה"כ`} Icon={Truck} />
        <StatCard value={stats?.pending_payments_30d}
          label="תשלומים ממתינים (30 יום)"
          color={stats?.pending_payments_30d > 0 ? 'var(--danger)' : 'var(--success)'}
          Icon={CreditCard} />
        <StatCard value={stats?.active_policies} label="פוליסות פעילות" Icon={ShieldCheck} />
        <StatCard value={stats?.open_maintenance} label="טיפולים פתוחים"
          color={stats?.open_maintenance > 0 ? 'var(--warning)' : 'var(--success)'}
          Icon={Wrench} />
        <StatCard value={stats?.active_employees} label="עובדים פעילים" Icon={Users} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Alerts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={15} strokeWidth={2} style={{ color: highAlerts > 0 ? 'var(--danger)' : 'var(--warning)' }} />
              התראות
              {alerts.length > 0 && (
                <span className={`badge ${highAlerts > 0 ? 'badge-red' : 'badge-yellow'}`}>{alerts.length}</span>
              )}
            </span>
          </div>
          <div className="card-body" style={{ padding: '12px 16px', maxHeight: 400, overflowY: 'auto' }}>
            {alerts.length === 0 && (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--gray)' }}>
                <CheckCircle size={28} style={{ color: 'var(--success)', margin: '0 auto 8px', display: 'block' }} />
                אין התראות פעילות
              </div>
            )}
            {alerts.map((a, i) => (
              <div key={i} className={`alert alert-${a.severity}`}>
                <AlertIcon severity={a.severity} />
                <div className="alert-content">
                  <div className="alert-vehicle">{a.vehicle}{a.nickname ? ` (${a.nickname})` : ''}</div>
                  <div className="alert-msg">{a.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vehicle status summary */}
        <div className="card">
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BarChart2 size={15} strokeWidth={2} style={{ color: 'var(--primary)' }} />
              מצב רכבים לפי סטטוס
            </span>
          </div>
          <div className="card-body">
            {stats?.vehicles_by_status?.map(s => (
              <div key={s.status} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid var(--border)'
              }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{s.status}</span>
                <span className={`badge ${s.status === 'פעיל' ? 'badge-green' : s.status === 'מושבת' ? 'badge-red' : s.status === 'בהקפאה' ? 'badge-yellow' : 'badge-gray'}`}>
                  {s.cnt}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vehicle list */}
      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Truck size={15} strokeWidth={2} style={{ color: 'var(--primary)' }} />
            סקירת רכבים
          </span>
          <Link to="/vehicles" className="btn btn-secondary btn-sm">כל הרכבים</Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>מספר רכב</th>
                <th>כינוי</th>
                <th>סוג</th>
                <th>סטטוס</th>
                <th>אחראי</th>
                <th>טיפול הבא</th>
                <th>בדיקה הבאה</th>
                <th>פקיעת פוליסה</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.slice(0, 12).map(v => {
                const mtDays  = daysTo(v.next_maintenance_date);
                const inDays  = daysTo(v.next_inspection_date);
                const polDays = daysTo(v.policy_expiry_date);
                return (
                  <tr key={v.id}>
                    <td>
                      <Link to={`/vehicles/${v.id}`} style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        {v.vehicle_number}
                      </Link>
                    </td>
                    <td>{v.nickname || '—'}</td>
                    <td>{v.asset_type}</td>
                    <td>
                      <span className={`badge ${v.status === 'פעיל' ? 'badge-green' : v.status === 'מושבת' ? 'badge-red' : v.status === 'בהקפאה' ? 'badge-yellow' : 'badge-gray'}`}>
                        {v.status}
                      </span>
                    </td>
                    <td>{v.responsible_employee || <span style={{ color: 'var(--danger)', fontSize: 12 }}>לא שויך</span>}</td>
                    <td className={dayClass(v.next_maintenance_date)}>
                      {v.next_maintenance_date ? `${fmtDate(v.next_maintenance_date)} (${mtDays}י')` : '—'}
                    </td>
                    <td className={dayClass(v.next_inspection_date)}>
                      {v.next_inspection_date ? `${fmtDate(v.next_inspection_date)} (${inDays}י')` : '—'}
                    </td>
                    <td className={dayClass(v.policy_expiry_date)}>
                      {v.policy_expiry_date ? `${fmtDate(v.policy_expiry_date)} (${polDays}י')` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
