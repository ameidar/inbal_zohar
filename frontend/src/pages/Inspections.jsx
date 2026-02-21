import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

const TYPES = ['טסט','ריקורד','אחר'];
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }
function fmtCur(n) { return n != null ? `₪${Number(n).toLocaleString('he-IL')}` : '—'; }

export default function Inspections() {
  const [items, setItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');

  async function load() {
    const [data, v] = await Promise.all([api.inspections().catch(()=>[]), api.vehicles().catch(()=>[])]);
    setItems(data); setVehicles(v);
  }
  useEffect(() => { load(); }, []);

  function openAdd() { setEditItem(null); setForm({ inspection_type:'טסט', passed:true }); setShowModal(true); }
  function openEdit(item) { setEditItem(item); setForm(item); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditItem(null); setForm({}); }
  const f = (k, val) => setForm(p => ({ ...p, [k]: val }));

  async function save() {
    setSaving(true);
    try {
      if (editItem) await api.updateInspection(editItem.id, form);
      else await api.createInspection(form);
      closeModal(); load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function del(item) {
    if (!confirm('למחוק?')) return;
    await api.deleteInspection(item.id).catch(e=>alert(e.message));
    load();
  }

  const vMap = Object.fromEntries(vehicles.map(v=>[v.id, v]));

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ fontSize:18, fontWeight:700 }}>בדיקות רכב ({items.length})</h2>
        {user.role==='admin' && <button className="btn btn-primary" onClick={openAdd}>+ הוסף בדיקה</button>}
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>תאריך</th><th>רכב</th><th>סוג</th><th>בודק</th><th>עלות</th><th>עבר?</th><th>בדיקה הבאה</th><th></th></tr></thead>
            <tbody>
              {items.map(i=>{
                const v = vMap[i.vehicle_id];
                const past = i.next_inspection_date && new Date(i.next_inspection_date) < new Date();
                return (
                  <tr key={i.id}>
                    <td>{fmtDate(i.inspection_date)}</td>
                    <td style={{fontWeight:600}}>{v?`${v.vehicle_number}${v.nickname?` (${v.nickname})`:''}`:'—'}</td>
                    <td>{i.inspection_type}</td>
                    <td style={{fontSize:12}}>{i.inspector||'—'}</td>
                    <td>{fmtCur(i.cost)}</td>
                    <td>{i.passed?<span className="badge badge-green">עבר ✓</span>:<span className="badge badge-red">נכשל ✗</span>}</td>
                    <td style={{color:past?'#dc2626':'',fontWeight:past?700:''}}>{fmtDate(i.next_inspection_date)}{past?' ⚠️':''}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={()=>openEdit(i)} style={{marginLeft:4}}>✏️</button>
                      {user.role==='admin' && <button className="btn btn-danger btn-sm" onClick={()=>del(i)}>🗑️</button>}
                    </td>
                  </tr>
                );
              })}
              {items.length===0 && <tr><td colSpan={8} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין בדיקות</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editItem?'עריכת בדיקה':'הוספת בדיקה'}</span>
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
                <div className="form-group"><label className="form-label">סוג בדיקה</label>
                  <select className="form-control" value={form.inspection_type||''} onChange={e=>f('inspection_type',e.target.value)}>
                    {TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">תאריך בדיקה</label><input className="form-control" type="date" value={form.inspection_date?.split('T')[0]||''} onChange={e=>f('inspection_date',e.target.value)}/></div>
                <div className="form-group"><label className="form-label">בדיקה הבאה</label><input className="form-control" type="date" value={form.next_inspection_date?.split('T')[0]||''} onChange={e=>f('next_inspection_date',e.target.value)}/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">שם בודק</label><input className="form-control" value={form.inspector||''} onChange={e=>f('inspector',e.target.value)}/></div>
                <div className="form-group"><label className="form-label">עלות (₪)</label><input className="form-control" type="number" value={form.cost||''} onChange={e=>f('cost',+e.target.value)}/></div>
              </div>
              <div className="form-group" style={{display:'flex',alignItems:'center',gap:8}}>
                <input type="checkbox" id="passed" checked={form.passed||false} onChange={e=>f('passed',e.target.checked)}/>
                <label htmlFor="passed" className="form-label" style={{margin:0}}>עבר בדיקה</label>
              </div>
              <div className="form-group"><label className="form-label">הערות</label><textarea className="form-control" rows={2} value={form.notes||''} onChange={e=>f('notes',e.target.value)}/></div>
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
