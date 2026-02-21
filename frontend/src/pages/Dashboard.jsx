import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Link } from 'react-router-dom';

function dayClass(date) {
  if (!date) return '';
  const days = Math.floor((new Date(date) - new Date()) / 86400000);
  if (days < 0) return 'date-danger';
  if (days < 14) return 'date-warn';
  if (days < 30) return 'date-warn';
  return 'date-ok';
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }
function daysTo(d) {
  if (!d) return null;
  const n = Math.floor((new Date(d) - new Date()) / 86400000);
  return n;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    api.dashStats().then(setStats).catch(()=>{});
    api.dashAlerts().then(setAlerts).catch(()=>{});
    api.dashVehicles().then(setVehicles).catch(()=>{});
  }, []);

  const activeVehicles = stats?.vehicles_by_status?.find(v=>v.status==='פעיל')?.cnt || 0;
  const totalVehicles = stats?.vehicles_by_status?.reduce((s,v)=>s+v.cnt,0) || 0;

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{activeVehicles}</div>
          <div className="stat-label">🚗 רכבים פעילים</div>
          <div style={{fontSize:11,color:'#9ca3af',marginTop:4}}>מתוך {totalVehicles} סה"כ</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{color: stats?.pending_payments_30d > 0 ? '#dc2626' : '#16a34a'}}>{stats?.pending_payments_30d ?? '—'}</div>
          <div className="stat-label">💳 תשלומים ממתינים (30 יום)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.active_policies ?? '—'}</div>
          <div className="stat-label">🛡️ פוליסות פעילות</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{color: stats?.open_maintenance > 0 ? '#d97706' : '#16a34a'}}>{stats?.open_maintenance ?? '—'}</div>
          <div className="stat-label">🔧 טיפולים פתוחים</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.active_employees ?? '—'}</div>
          <div className="stat-label">👥 עובדים פעילים</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Alerts */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">⚠️ התראות ({alerts.length})</span>
          </div>
          <div className="card-body" style={{ padding: '12px 16px', maxHeight: 400, overflowY: 'auto' }}>
            {alerts.length === 0 && <div className="empty-state"><div>✅</div><div>אין התראות</div></div>}
            {alerts.map((a, i) => (
              <div key={i} className={`alert alert-${a.severity}`}>
                <span className="alert-icon">{a.severity==='high'?'🔴':a.severity==='medium'?'🟡':'🔵'}</span>
                <div className="alert-content">
                  <div className="alert-vehicle">{a.vehicle} {a.nickname ? `(${a.nickname})` : ''}</div>
                  <div className="alert-msg">{a.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Vehicle status summary */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">📊 מצב רכבים לפי סטטוס</span>
          </div>
          <div className="card-body">
            {stats?.vehicles_by_status?.map(s => (
              <div key={s.status} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f3f4f6' }}>
                <span style={{fontSize:14}}>{s.status}</span>
                <span className={`badge ${s.status==='פעיל'?'badge-green':s.status==='מושבת'?'badge-red':s.status==='בהקפאה'?'badge-yellow':'badge-gray'}`}>{s.cnt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vehicle list with upcoming dates */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🚛 סקירת רכבים</span>
          <Link to="/vehicles" className="btn btn-secondary btn-sm">כל הרכבים ←</Link>
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
              {vehicles.slice(0,10).map(v => {
                const mtDays = daysTo(v.next_maintenance_date);
                const inDays = daysTo(v.next_inspection_date);
                const polDays = daysTo(v.policy_expiry_date);
                return (
                  <tr key={v.id}>
                    <td><Link to={`/vehicles/${v.id}`} style={{color:'#1e40af',fontWeight:600}}>{v.vehicle_number}</Link></td>
                    <td>{v.nickname || '—'}</td>
                    <td>{v.asset_type}</td>
                    <td><span className={`badge ${v.status==='פעיל'?'badge-green':v.status==='מושבת'?'badge-red':v.status==='בהקפאה'?'badge-yellow':'badge-gray'}`}>{v.status}</span></td>
                    <td>{v.responsible_employee || <span style={{color:'#ef4444'}}>⚠️ אין</span>}</td>
                    <td className={dayClass(v.next_maintenance_date)}>{v.next_maintenance_date ? `${fmtDate(v.next_maintenance_date)} (${mtDays}י')` : '—'}</td>
                    <td className={dayClass(v.next_inspection_date)}>{v.next_inspection_date ? `${fmtDate(v.next_inspection_date)} (${inDays}י')` : '—'}</td>
                    <td className={dayClass(v.policy_expiry_date)}>{v.policy_expiry_date ? `${fmtDate(v.policy_expiry_date)} (${polDays}י')` : '—'}</td>
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
