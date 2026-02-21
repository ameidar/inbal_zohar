import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

const ROLES = ['מנכ"ל','מנהל צמ"ה','מנהלת משרד','מנהל צוות תקלות','מפעיל','חשמלאי','עובד כללי','מפעיל חיצוני','קבלן חיצוני'];
const SALARY_TYPES = ['גלובלי','לפי ימי עבודה','שעתי','קבלן'];

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }

export default function Employees() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [filterActive, setFilterActive] = useState('');
  const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');

  async function load() {
    const data = await api.employees().catch(() => []);
    setItems(filterActive !== '' ? data.filter(e => String(e.active) === filterActive) : data);
  }
  useEffect(() => { load(); }, [filterActive]);

  function openAdd() { setEditItem(null); setForm({ active: true, role: 'מפעיל', salary_type: 'גלובלי' }); setShowModal(true); }
  function openEdit(item) { setEditItem(item); setForm(item); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditItem(null); setForm({}); }
  const f = (k, val) => setForm(p => ({ ...p, [k]: val }));

  async function save() {
    setSaving(true);
    try {
      if (editItem) await api.updateEmployee(editItem.id, form);
      else await api.createEmployee(form);
      closeModal(); load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function del(item) {
    if (!confirm(`למחוק ${item.name}?`)) return;
    await api.deleteEmployee(item.id).catch(e => alert(e.message));
    load();
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <h2 style={{ fontSize:18, fontWeight:700 }}>עובדים ({items.length})</h2>
          <select value={filterActive} onChange={e=>setFilterActive(e.target.value)} className="form-control" style={{width:'auto'}}>
            <option value="">כולם</option>
            <option value="true">פעילים</option>
            <option value="false">לא פעילים</option>
          </select>
        </div>
        {user.role==='admin' && <button className="btn btn-primary" onClick={openAdd}>+ הוסף עובד</button>}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>שם</th><th>ז.ת</th><th>תפקיד</th><th>טלפון</th><th>תחילת עבודה</th><th>שכר</th><th>סטטוס</th><th></th></tr></thead>
            <tbody>
              {items.map(e => (
                <tr key={e.id}>
                  <td style={{fontWeight:600}}>{e.name}</td>
                  <td style={{fontSize:12,color:'#6b7280'}}>{e.id_number}</td>
                  <td>{e.role}</td>
                  <td dir="ltr">{e.phone||'—'}</td>
                  <td>{fmtDate(e.start_date)}</td>
                  <td>{e.salary_type}{e.salary_amount ? ` — ₪${Number(e.salary_amount).toLocaleString()}` : ''}</td>
                  <td><span className={`badge ${e.active?'badge-green':'badge-gray'}`}>{e.active?'פעיל':'לא פעיל'}</span></td>
                  <td>
                    {user.role==='admin' && <>
                      <button className="btn btn-secondary btn-sm" onClick={()=>openEdit(e)} style={{marginLeft:4}}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={()=>del(e)}>🗑️</button>
                    </>}
                  </td>
                </tr>
              ))}
              {items.length===0 && <tr><td colSpan={8} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין עובדים</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editItem?'עריכת עובד':'הוספת עובד'}</span>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label className="form-label">שם מלא *</label><input className="form-control" value={form.name||''} onChange={e=>f('name',e.target.value)}/></div>
                <div className="form-group"><label className="form-label">ז.ת</label><input className="form-control" value={form.id_number||''} onChange={e=>f('id_number',e.target.value)}/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">תפקיד</label>
                  <select className="form-control" value={form.role||''} onChange={e=>f('role',e.target.value)}>{ROLES.map(r=><option key={r}>{r}</option>)}</select>
                </div>
                <div className="form-group"><label className="form-label">טלפון</label><input className="form-control" value={form.phone||''} onChange={e=>f('phone',e.target.value)}/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">מייל</label><input className="form-control" value={form.email||''} onChange={e=>f('email',e.target.value)}/></div>
                <div className="form-group"><label className="form-label">תחילת עבודה</label><input className="form-control" type="date" value={form.start_date?.split('T')[0]||''} onChange={e=>f('start_date',e.target.value)}/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">סוג שכר</label>
                  <select className="form-control" value={form.salary_type||''} onChange={e=>f('salary_type',e.target.value)}>{SALARY_TYPES.map(s=><option key={s}>{s}</option>)}</select>
                </div>
                <div className="form-group"><label className="form-label">שכר (₪)</label><input className="form-control" type="number" value={form.salary_amount||''} onChange={e=>f('salary_amount',+e.target.value)}/></div>
              </div>
              <div className="form-group" style={{display:'flex',alignItems:'center',gap:8}}>
                <input type="checkbox" id="active" checked={form.active||false} onChange={e=>f('active',e.target.checked)}/>
                <label htmlFor="active" className="form-label" style={{margin:0}}>עובד פעיל</label>
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
