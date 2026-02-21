import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

const TYPES = ['טיפול תקופתי','תקלה','חירום','אחר'];
const STATUSES = ['פתוח','בוצע','בוטל'];

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }
function fmtCur(n) { return n != null ? `₪${Number(n).toLocaleString('he-IL')}` : '—'; }

export default function Maintenance() {
  const [items, setItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [garages, setGarages] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');

  async function load() {
    const p = filterStatus ? `?status=${filterStatus}` : '';
    const [data, v, g] = await Promise.all([
      api.maintenance(p).catch(()=>[]),
      api.vehicles().catch(()=>[]),
      api.garages().catch(()=>[])
    ]);
    setItems(data); setVehicles(v); setGarages(g);
  }
  useEffect(() => { load(); }, [filterStatus]);

  function openAdd() { setEditItem(null); setForm({ status:'פתוח', maintenance_type:'טיפול תקופתי' }); setShowModal(true); }
  function openEdit(item) { setEditItem(item); setForm(item); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditItem(null); setForm({}); }
  const f = (k, val) => setForm(p => ({ ...p, [k]: val }));

  async function save() {
    setSaving(true);
    try {
      if (editItem) await api.updateMaintenance(editItem.id, form);
      else await api.createMaintenance(form);
      closeModal(); load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function del(item) {
    if (!confirm('למחוק טיפול זה?')) return;
    await api.deleteMaintenance(item.id).catch(e=>alert(e.message));
    load();
  }

  const vMap = Object.fromEntries(vehicles.map(v=>[v.id, v]));
  const gMap = Object.fromEntries(garages.map(g=>[g.id, g]));

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <h2 style={{ fontSize:18, fontWeight:700 }}>טיפולים ({items.length})</h2>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="form-control" style={{width:'auto'}}>
            <option value="">כל הסטטוסים</option>
            {STATUSES.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        {user.role==='admin' && <button className="btn btn-primary" onClick={openAdd}>+ הוסף טיפול</button>}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>תאריך</th><th>רכב</th><th>סוג</th><th>מוסך</th><th>תיאור</th><th>ק"מ</th><th>עלות</th><th>סטטוס</th><th>הבא</th><th></th></tr></thead>
            <tbody>
              {items.map(m=>{
                const v = vMap[m.vehicle_id];
                const g = gMap[m.garage_id];
                return (
                  <tr key={m.id}>
                    <td>{fmtDate(m.maintenance_date)}</td>
                    <td style={{fontWeight:600}}>{v ? `${v.vehicle_number}${v.nickname?` (${v.nickname})`:''}` : m.vehicle_id}</td>
                    <td>{m.maintenance_type}</td>
                    <td>{g?.name||'—'}</td>
                    <td style={{maxWidth:180,fontSize:12}}>{m.description}</td>
                    <td>{m.odometer?.toLocaleString()}</td>
                    <td>{fmtCur(m.cost)}</td>
                    <td><span className={`badge ${m.status==='בוצע'?'badge-green':m.status==='בוטל'?'badge-red':'badge-blue'}`}>{m.status}</span></td>
                    <td style={{fontSize:12,color:m.next_date&&new Date(m.next_date)<new Date(Date.now()+7*86400000)?'#dc2626':''}}>{fmtDate(m.next_date)}</td>
                    <td>
                      {user.role==='admin' ? <>
                        <button className="btn btn-secondary btn-sm" onClick={()=>openEdit(m)} style={{marginLeft:4}}>✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={()=>del(m)}>🗑️</button>
                      </> : <button className="btn btn-secondary btn-sm" onClick={()=>openEdit(m)}>✏️</button>}
                    </td>
                  </tr>
                );
              })}
              {items.length===0 && <tr><td colSpan={10} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין טיפולים</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editItem?'עריכת טיפול':'הוספת טיפול'}</span>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label className="form-label">רכב *</label>
                  <select className="form-control" value={form.vehicle_id||''} onChange={e=>f('vehicle_id',+e.target.value)}>
                    <option value="">בחר רכב</option>
                    {vehicles.map(v=><option key={v.id} value={v.id}>{v.vehicle_number} {v.nickname?`(${v.nickname})`:''}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">מוסך</label>
                  <select className="form-control" value={form.garage_id||''} onChange={e=>f('garage_id',+e.target.value)}>
                    <option value="">בחר מוסך</option>
                    {garages.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">סוג טיפול</label>
                  <select className="form-control" value={form.maintenance_type||''} onChange={e=>f('maintenance_type',e.target.value)}>
                    {TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">תאריך</label><input className="form-control" type="date" value={form.maintenance_date?.split('T')[0]||''} onChange={e=>f('maintenance_date',e.target.value)}/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">ק"מ / שעות</label><input className="form-control" type="number" value={form.odometer||''} onChange={e=>f('odometer',+e.target.value)}/></div>
                <div className="form-group"><label className="form-label">עלות (₪)</label><input className="form-control" type="number" value={form.cost||''} onChange={e=>f('cost',+e.target.value)}/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">סטטוס</label>
                  <select className="form-control" value={form.status||''} onChange={e=>f('status',e.target.value)}>
                    {STATUSES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">תאריך טיפול הבא</label><input className="form-control" type="date" value={form.next_date?.split('T')[0]||''} onChange={e=>f('next_date',e.target.value)}/></div>
              </div>
              <div className="form-group"><label className="form-label">תיאור</label><textarea className="form-control" rows={3} value={form.description||''} onChange={e=>f('description',e.target.value)}/></div>
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
