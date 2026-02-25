import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import {
  Truck, CreditCard, ShieldCheck, Wrench, AlertTriangle, AlertCircle, Info, CheckCircle
} from 'lucide-react';

function dayClass(date) {
  if (!date) return '';
  const days = Math.floor((new Date(date) - new Date()) / 86400000);
  if (days < 0) return 'date-danger';
  if (days < 30) return 'date-warn';
  return 'date-ok';
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }

function StatCard({ value, label, sub, color, Icon, onClick }) {
  return (
    <div
      className="stat-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
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

export default function VehiclesDashboard() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.dashStats().then(setStats).catch(() => {});
    api.dashAlerts().then(setAlerts).catch(() => {});
  }, []);

  const activeVehicles = stats?.vehicles_by_status?.find(v => v.status === 'פעיל')?.cnt || 0;
  const totalVehicles  = stats?.vehicles_by_status?.reduce((s, v) => s + v.cnt, 0) || 0;
  const highAlerts     = alerts.filter(a => a.severity === 'high').length;

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>📊 דשבורד רכבים</h2>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <StatCard
          value={activeVehicles}
          label="רכבים פעילים"
          sub={`מתוך ${totalVehicles} סה"כ`}
          color="var(--primary)"
          Icon={Truck}
          onClick={() => navigate('/dept/vehicles/list')}
        />
        <StatCard
          value={stats?.active_policies ?? '—'}
          label="פוליסות פעילות"
          color="var(--success)"
          Icon={ShieldCheck}
          onClick={() => navigate('/dept/vehicles/policies/list')}
        />
        <StatCard
          value={stats?.pending_payments_30d ?? '—'}
          label="תשלומים ממתינים (30 יום)"
          color="var(--warning)"
          Icon={CreditCard}
          onClick={() => navigate('/dept/vehicles/policies/payments')}
        />
        <StatCard
          value={stats?.open_maintenance ?? '—'}
          label="טיפולים פתוחים"
          color="var(--info)"
          Icon={Wrench}
          onClick={() => navigate('/dept/vehicles/maintenance/list')}
        />
        <StatCard
          value={stats?.open_duplicates ?? 0}
          label="כפילויות פתוחות"
          color={stats?.open_duplicates > 0 ? 'var(--danger)' : 'var(--success)'}
          Icon={AlertTriangle}
          onClick={() => navigate('/dept/vehicles/duplicates')}
        />
        <StatCard
          value={highAlerts}
          label="התראות קריטיות"
          color={highAlerts > 0 ? 'var(--danger)' : 'var(--success)'}
          Icon={AlertCircle}
        />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 15 }}>
            🔔 התראות ({alerts.length})
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {alerts.map((a, i) => (
              <div key={i} style={{ padding: '12px 20px', borderBottom: '1px solid #f9fafb', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <AlertIcon severity={a.severity} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{a.vehicle} {a.nickname ? `(${a.nickname})` : ''}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{a.message}</div>
                </div>
                {a.date && <div style={{ fontSize: 11, color: '#9ca3af' }}>{fmtDate(a.date)}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {alerts.length === 0 && stats && (
        <div style={{ textAlign: 'center', padding: 32, color: '#15803d', background: '#dcfce7', borderRadius: 12 }}>
          <CheckCircle size={40} style={{ marginBottom: 8, opacity: 0.7 }} />
          <div style={{ fontWeight: 600 }}>הכל בסדר! אין התראות פעילות.</div>
        </div>
      )}
    </div>
  );
}
