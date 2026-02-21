import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const STATUSES = ['פעיל','מושבת','נמכר','בהקפאה'];
const TYPES = ['מכונית','משאית','נגרר','צמ"ה','כלי תפעולי'];
const FUEL_TYPES = ['בנזין','סולר','אחר'];

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }

function VehicleCard({ v, onEdit, onDel, isAdmin }) {
  const statusColor = { 'פעיל': '#15803d', 'מושבת': '#dc2626', 'בהקפאה': '#d97706' };

  return (
    <div style={{
      border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden',
      background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      transition: 'box-shadow 0.15s', cursor: 'pointer',
      display: 'flex', flexDirection: 'column'
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.13)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)'}
    >
      {/* Image */}
      <Link to={`/vehicles/${v.id}`} style={{ textDecoration: 'none', display: 'block' }}>
        <div style={{
          width: '100%', height: 140, background: '#f3f4f6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', position: 'relative'
        }}>
          {v.image_url ? (
            <img src={v.image_url} alt={v.vehicle_number}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
          ) : null}
          <div style={{
            display: v.image_url ? 'none' : 'flex',
            flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#9ca3af', fontSize: 13, gap: 8, width: '100%', height: '100%'
          }}>
            <span style={{ fontSize: 40 }}>🚛</span>
            <span>{v.asset_type || 'רכב'}</span>
          </div>
          {/* Status badge overlay */}
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: statusColor[v.status] || '#6b7280',
            color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 700
          }}>
            {v.status}
          </div>
        </div>
      </Link>

      {/* Info */}
      <div style={{ padding: '12px 14px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Link to={`/vehicles/${v.id}`} style={{ textDecoration: 'none' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#1e40af' }}>{v.vehicle_number}</div>
          {v.nickname && <div style={{ fontSize: 12, color: '#6b7280' }}>{v.nickname}</div>}
          <div style={{ fontSize: 12, color: '#374151', marginTop: 2 }}>
            {v.manufacturer} {v.model}{v.year ? ` (${v.year})` : ''}
          </div>
        </Link>

        {/* Insurance checkmarks */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4,
            color: v.has_mandatory ? '#15803d' : '#dc2626', fontWeight: 600 }}>
            {v.has_mandatory ? '✅' : '❌'} חובה
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4,
            color: v.has_comprehensive ? '#15803d' : '#dc2626', fontWeight: 600 }}>
            {v.has_comprehensive ? '✅' : '❌'} מקיף
          </span>
        </div>

        {/* Actions */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); onEdit(v); }}>✏️</button>
            <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); onDel(v); }}>🗑️</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editVehicle, setEditVehicle] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('vehicles_view') || 'table');
  const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');

  async function load() {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (filterStatus) params.set('status', filterStatus);
    if (filterType) params.set('asset_type', filterType);
    const p = params.toString() ? '?' + params : '';
    const data = await api.vehicles(p).catch(() => []);
    setVehicles(data);
  }

  useEffect(() => { load(); }, [search, filterStatus, filterType]);

  function setView(mode) { setViewMode(mode); localStorage.setItem('vehicles_view', mode); }

  function openAdd() { setEditVehicle(null); setForm({ status: 'פעיל', fuel_type: 'סולר', asset_type: 'משאית', eligible_diesel_refund: false }); setShowModal(true); }
  function openEdit(v) { setEditVehicle(v); setForm(v); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditVehicle(null); setForm({}); }

  async function save() {
    setSaving(true);
    try {
      if (editVehicle) await api.updateVehicle(editVehicle.id, form);
      else await api.createVehicle(form);
      closeModal(); load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function del(v) {
    if (!confirm(`למחוק רכב ${v.vehicle_number}?`)) return;
    await api.deleteVehicle(v.id).catch(e => alert(e.message));
    load();
  }

  const f = (k, val) => setForm(p => ({ ...p, [k]: val }));

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:18, fontWeight:700 }}>סה"כ {vehicles.length} רכבים</h2>
        <div style={{ display:'flex', gap:8 }}>
          {/* View toggle */}
          <div style={{ display:'flex', border:'1px solid #e5e7eb', borderRadius:6, overflow:'hidden' }}>
            <button onClick={() => setView('table')} style={{
              padding:'6px 12px', border:'none', cursor:'pointer', fontSize:13,
              background: viewMode === 'table' ? '#2563eb' : '#fff',
              color: viewMode === 'table' ? '#fff' : '#374151'
            }}>☰ טבלה</button>
            <button onClick={() => setView('cards')} style={{
              padding:'6px 12px', border:'none', cursor:'pointer', fontSize:13,
              background: viewMode === 'cards' ? '#2563eb' : '#fff',
              color: viewMode === 'cards' ? '#fff' : '#374151'
            }}>⊞ כרטיסיות</button>
          </div>
          {user.role === 'admin' && <button className="btn btn-primary" onClick={openAdd}>+ הוסף רכב</button>}
        </div>
      </div>

      <div className="search-bar">
        <input className="form-control" placeholder="🔍 חיפוש לפי מספר רכב, כינוי, יצרן..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">כל הסטטוסים</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">כל הסוגים</option>
          {TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>מספר רכב</th><th>כינוי</th><th>סוג נכס</th><th>יצרן / דגם</th><th>שנה</th><th>דלק</th><th>סטטוס</th><th>חובה</th><th>מקיף</th><th>אחראי</th><th>טיפול הבא</th><th>בדיקה הבאה</th><th></th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map(v => (
                  <tr key={v.id}>
                    <td><Link to={`/vehicles/${v.id}`} style={{color:'#1e40af',fontWeight:600}}>{v.vehicle_number}</Link></td>
                    <td>{v.nickname || '—'}</td>
                    <td>{v.asset_type}</td>
                    <td>{v.manufacturer} {v.model}</td>
                    <td>{v.year}</td>
                    <td>{v.fuel_type}</td>
                    <td><span className={`badge ${v.status==='פעיל'?'badge-green':v.status==='מושבת'?'badge-red':v.status==='בהקפאה'?'badge-yellow':'badge-gray'}`}>{v.status}</span></td>
                    <td style={{textAlign:'center', fontSize:15}}>{v.has_mandatory ? '✅' : '❌'}</td>
                    <td style={{textAlign:'center', fontSize:15}}>{v.has_comprehensive ? '✅' : '❌'}</td>
                    <td>{v.responsible_employee || <span style={{color:'#ef4444',fontSize:12}}>⚠️ אין</span>}</td>
                    <td style={{fontSize:12}}>{fmtDate(v.next_maintenance_date)}</td>
                    <td style={{fontSize:12}}>{fmtDate(v.next_inspection_date)}</td>
                    <td>
                      {user.role==='admin' && <>
                        <button className="btn btn-secondary btn-sm" onClick={()=>openEdit(v)} style={{marginLeft:4}}>✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={()=>del(v)}>🗑️</button>
                      </>}
                      <Link to={`/vehicles/${v.id}`} className="btn btn-secondary btn-sm" style={{marginRight:4}}>←</Link>
                    </td>
                  </tr>
                ))}
                {vehicles.length === 0 && <tr><td colSpan={13} className="empty-state">אין רכבים</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CARDS VIEW */}
      {viewMode === 'cards' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:16 }}>
          {vehicles.map(v => (
            <VehicleCard key={v.id} v={v} onEdit={openEdit} onDel={del} isAdmin={user.role === 'admin'} />
          ))}
          {vehicles.length === 0 && (
            <div style={{ gridColumn:'1/-1', textAlign:'center', color:'#9ca3af', padding:40 }}>אין רכבים</div>
          )}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editVehicle ? 'עריכת רכב' : 'הוספת רכב'}</span>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row cols-3">
                <div className="form-group"><label className="form-label">מספר רכב *</label><input className="form-control" value={form.vehicle_number||''} onChange={e=>f('vehicle_number',e.target.value)} /></div>
                <div className="form-group"><label className="form-label">כינוי</label><input className="form-control" value={form.nickname||''} onChange={e=>f('nickname',e.target.value)} /></div>
                <div className="form-group"><label className="form-label">סוג נכס</label>
                  <select className="form-control" value={form.asset_type||''} onChange={e=>f('asset_type',e.target.value)}>
                    {TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row cols-3">
                <div className="form-group"><label className="form-label">יצרן</label><input className="form-control" value={form.manufacturer||''} onChange={e=>f('manufacturer',e.target.value)} /></div>
                <div className="form-group"><label className="form-label">דגם</label><input className="form-control" value={form.model||''} onChange={e=>f('model',e.target.value)} /></div>
                <div className="form-group"><label className="form-label">שנה</label><input className="form-control" type="number" value={form.year||''} onChange={e=>f('year',+e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">סוג דלק</label>
                  <select className="form-control" value={form.fuel_type||''} onChange={e=>f('fuel_type',e.target.value)}>
                    {FUEL_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">סטטוס</label>
                  <select className="form-control" value={form.status||''} onChange={e=>f('status',e.target.value)}>
                    {STATUSES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">מספר שילדה</label><input className="form-control" value={form.chassis_number||''} onChange={e=>f('chassis_number',e.target.value)} /></div>
                <div className="form-group"><label className="form-label">תאריך רכישה</label><input className="form-control" type="date" value={form.purchase_date?.split('T')[0]||''} onChange={e=>f('purchase_date',e.target.value)} /></div>
              </div>
              <div className="form-group">
                <label className="form-label">קישור לתמונה (URL)</label>
                <input className="form-control" placeholder="https://..." value={form.image_url||''} onChange={e=>f('image_url',e.target.value)} />
              </div>
              <div style={{ display:'flex', gap:20, flexWrap:'wrap', marginTop:4 }}>
                <div className="form-group" style={{display:'flex',alignItems:'center',gap:8,margin:0}}>
                  <input type="checkbox" id="diesel" checked={form.eligible_diesel_refund||false} onChange={e=>f('eligible_diesel_refund',e.target.checked)} />
                  <label htmlFor="diesel" className="form-label" style={{margin:0}}>זכאי להחזר סולר (רלו)</label>
                </div>
                <div className="form-group" style={{display:'flex',alignItems:'center',gap:8,margin:0}}>
                  <input type="checkbox" id="pledged" checked={form.is_pledged||false} onChange={e=>f('is_pledged',e.target.checked)} />
                  <label htmlFor="pledged" className="form-label" style={{margin:0,fontWeight:600}}>משועבד</label>
                </div>
              </div>
              {form.is_pledged && (
                <div className="form-group" style={{marginTop:8}}>
                  <label className="form-label">למי משועבד</label>
                  <input className="form-control" placeholder="לדוגמה: בנק לאומי / אוטוקאש" value={form.pledged_to||''} onChange={e=>f('pledged_to',e.target.value)} />
                </div>
              )}
              <div className="form-group" style={{marginTop:8}}><label className="form-label">הערות</label><textarea className="form-control" rows={2} value={form.notes||''} onChange={e=>f('notes',e.target.value)} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'שומר...':'שמור'}</button>
              <button className="btn btn-secondary" onClick={closeModal}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
