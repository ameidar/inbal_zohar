import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }

export default function OperatorLicense() {
  const [items, setItems] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');

  async function load() {
    const data = await fetch('/api/operator-licenses', {
      headers: { Authorization: `Bearer ${localStorage.getItem('fleet_token')}` }
    }).then(r => r.json()).catch(() => []);
    setItems(Array.isArray(data) ? data : []);
  }
  useEffect(() => { load(); }, []);

  function openAdd() { setEditItem(null); setForm({ license_type: 'רישיון מפעיל', status: 'פעיל' }); setShowModal(true); }
  function openEdit(item) { setEditItem(item); setForm(item); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditItem(null); setForm({}); }
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function save() {
    setSaving(true);
    const token = localStorage.getItem('fleet_token');
    const url = editItem ? `/api/operator-licenses/${editItem.id}` : '/api/operator-licenses';
    const method = editItem ? 'PUT' : 'POST';
    try {
      const r = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form)
      });
      if (!r.ok) throw new Error(await r.text());
      closeModal(); load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function del(item) {
    if (!confirm('למחוק?')) return;
    const token = localStorage.getItem('fleet_token');
    await fetch(`/api/operator-licenses/${item.id}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
    });
    load();
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ fontSize:18, fontWeight:700 }}>רישיון מפעיל</h2>
        {user.role==='admin' && <button className="btn btn-primary" onClick={openAdd}>+ הוסף רישיון</button>}
      </div>

      {items.length === 0 && (
        <div className="card" style={{ textAlign:'center', padding:40, color:'#6b7280' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
          <div style={{ fontWeight:600, marginBottom:8 }}>אין רישיון מפעיל במערכת</div>
          <div style={{ fontSize:13 }}>הוסף את הרישיון הראשון של החברה</div>
        </div>
      )}

      {items.map(item => {
        const expiry = item.expiry_date ? new Date(item.expiry_date) : null;
        const now = new Date();
        const daysLeft = expiry ? Math.ceil((expiry - now) / 86400000) : null;
        const isExpired = daysLeft !== null && daysLeft < 0;
        const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 60;

        return (
          <div key={item.id} className="card" style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <div style={{ fontSize:20, fontWeight:700, marginBottom:4 }}>{item.license_type}</div>
                {item.license_number && <div style={{ fontSize:13, color:'#6b7280' }}>מס׳ רישיון: {item.license_number}</div>}
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span className={`badge ${item.status==='פעיל'?'badge-green':'badge-red'}`}>{item.status}</span>
                {user.role==='admin' && <>
                  <button className="btn btn-secondary btn-sm" onClick={()=>openEdit(item)}>✏️ עריכה</button>
                  <button className="btn btn-danger btn-sm" onClick={()=>del(item)}>🗑️</button>
                </>}
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginTop:16 }}>
              <div>
                <div style={{ fontSize:12, color:'#6b7280' }}>תאריך הוצאה</div>
                <div style={{ fontWeight:500 }}>{fmtDate(item.issue_date)}</div>
              </div>
              <div>
                <div style={{ fontSize:12, color:'#6b7280' }}>תוקף</div>
                <div style={{ fontWeight:700, color: isExpired?'#dc2626':isExpiringSoon?'#f59e0b':'#16a34a', fontSize:16 }}>
                  {fmtDate(item.expiry_date)}
                  {daysLeft !== null && (
                    <span style={{ fontSize:12, fontWeight:400, marginRight:8 }}>
                      {isExpired ? `(פג לפני ${Math.abs(daysLeft)} ימים ⚠️)` : `(עוד ${daysLeft} ימים)`}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div style={{ fontSize:12, color:'#6b7280' }}>גורם מנפיק</div>
                <div style={{ fontWeight:500 }}>{item.issuing_authority || '—'}</div>
              </div>
            </div>

            {item.notes && (
              <div style={{ marginTop:12, padding:'8px 12px', background:'#f9fafb', borderRadius:6, fontSize:13 }}>
                {item.notes}
              </div>
            )}

            {isExpiringSoon && !isExpired && (
              <div style={{ marginTop:12, padding:'8px 12px', background:'#fef3c7', border:'1px solid #f59e0b', borderRadius:6, fontSize:13, color:'#92400e' }}>
                ⚠️ הרישיון פוקע בעוד {daysLeft} ימים — יש לחדש
              </div>
            )}
            {isExpired && (
              <div style={{ marginTop:12, padding:'8px 12px', background:'#fef2f2', border:'1px solid #dc2626', borderRadius:6, fontSize:13, color:'#991b1b' }}>
                🔴 הרישיון פג תוקף — יש לחדש מיד!
              </div>
            )}
          </div>
        );
      })}

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editItem?'עריכת רישיון':'הוספת רישיון מפעיל'}</span>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label className="form-label">סוג רישיון</label>
                  <input className="form-control" value={form.license_type||''} onChange={e=>f('license_type',e.target.value)}/>
                </div>
                <div className="form-group"><label className="form-label">מספר רישיון</label>
                  <input className="form-control" value={form.license_number||''} onChange={e=>f('license_number',e.target.value)}/>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">תאריך הוצאה</label>
                  <input className="form-control" type="date" value={form.issue_date?.split('T')[0]||''} onChange={e=>f('issue_date',e.target.value)}/>
                </div>
                <div className="form-group"><label className="form-label">תוקף</label>
                  <input className="form-control" type="date" value={form.expiry_date?.split('T')[0]||''} onChange={e=>f('expiry_date',e.target.value)}/>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">גורם מנפיק</label>
                  <input className="form-control" value={form.issuing_authority||''} onChange={e=>f('issuing_authority',e.target.value)}/>
                </div>
                <div className="form-group"><label className="form-label">סטטוס</label>
                  <select className="form-control" value={form.status||''} onChange={e=>f('status',e.target.value)}>
                    <option>פעיל</option>
                    <option>לא פעיל</option>
                    <option>בחידוש</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label className="form-label">הערות</label>
                <textarea className="form-control" rows={2} value={form.notes||''} onChange={e=>f('notes',e.target.value)}/>
              </div>
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
