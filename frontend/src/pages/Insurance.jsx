import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const COVERAGE_TYPES = ['חובה','מקיף','חובה + מקיף','צד ג','חובה + צד ג\'','אחר','פוליסת גרירה','פוליסת שמשות'];
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }
function fmtCur(n) { return n != null ? `₪${Number(n).toLocaleString('he-IL')}` : '—'; }

export default function Insurance() {
  const [policies, setPolicies] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');

  async function load() {
    const [data, v] = await Promise.all([api.policies().catch(()=>[]), api.vehicles().catch(()=>[])]);
    setPolicies(data); setVehicles(v);
  }
  async function loadSelected(id) {
    const data = await api.policy(id).catch(()=>null);
    setSelected(data);
  }
  useEffect(() => { load(); }, []);

  function openAdd() { setEditItem(null); setForm({ status:'פעילה', coverage_type:'חובה', num_payments:12, first_charge_day:1 }); setShowModal(true); }
  function openEdit(item) { setEditItem(item); setForm(item); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditItem(null); setForm({}); }
  const f = (k, val) => setForm(p => ({ ...p, [k]: val }));

  async function save() {
    setSaving(true);
    try {
      if (editItem) await api.updatePolicy(editItem.id, form);
      else await api.createPolicy(form);
      closeModal(); load(); if (selected) loadSelected(selected.id);
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function del(item) {
    if (!confirm('למחוק פוליסה זו?')) return;
    await api.deletePolicy(item.id).catch(e=>alert(e.message));
    if (selected?.id === item.id) setSelected(null);
    load();
  }

  async function updatePayment(polId, payId, status) {
    await api.updatePayment(polId, payId, { status, actual_amount: selected.payments.find(p=>p.id===payId)?.expected_amount, actual_payment_date: new Date().toISOString().split('T')[0] }).catch(e=>alert(e.message));
    loadSelected(polId);
  }

  const vMap = Object.fromEntries(vehicles.map(v=>[v.id, v]));

  // Policies expiring this calendar month
  const nowDate = new Date();
  const thisYear = nowDate.getFullYear();
  const thisMonth = nowDate.getMonth(); // 0-indexed
  const expiringThisMonth = policies.filter(p => {
    if (!p.expiry_date || p.status !== 'פעילה') return false;
    const d = new Date(p.expiry_date);
    return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
  }).sort((a,b) => new Date(a.expiry_date) - new Date(b.expiry_date));

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ fontSize:18, fontWeight:700 }}>ביטוח — {policies.length} פוליסות</h2>
        {user.role==='admin' && <button className="btn btn-primary" onClick={openAdd}>+ הוסף פוליסה</button>}
      </div>

      {/* Expiring this month banner */}
      {expiringThisMonth.length > 0 && (
        <div className="card" style={{ marginBottom:20, border:'2px solid #f59e0b', background:'#fffbeb' }}>
          <div className="card-header" style={{ background:'#f59e0b', color:'#fff' }}>
            <span className="card-title">⚠️ פוליסות שפגות החודש — {expiringThisMonth.length}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>רכב</th><th>מספר פוליסה</th><th>כיסוי</th><th>מבטח</th><th>תאריך פג</th><th>ימים שנותרו</th>
                </tr>
              </thead>
              <tbody>
                {expiringThisMonth.map(p => {
                  const v = vMap[p.vehicle_id];
                  const daysLeft = Math.ceil((new Date(p.expiry_date) - new Date()) / 86400000);
                  return (
                    <tr key={`exp-${p.id}`} style={{ cursor:'pointer' }}
                      onClick={() => v && (window.location.href = `/vehicles/${v.id}`)}>
                      <td style={{ fontWeight:700, color:'#1e40af' }}>
                        {v ? (
                          <Link to={`/vehicles/${v.id}`} style={{ color:'#1e40af', textDecoration:'none' }}
                            onClick={e => e.stopPropagation()}>
                            {v.vehicle_number}{v.nickname ? ` (${v.nickname})` : ''}
                          </Link>
                        ) : '—'}
                      </td>
                      <td style={{ fontSize:12 }}>{p.policy_number}</td>
                      <td>{p.coverage_type}</td>
                      <td style={{ fontSize:12 }}>{p.insurer}</td>
                      <td style={{ fontWeight:700, color: daysLeft <= 7 ? '#dc2626' : '#d97706' }}>{fmtDate(p.expiry_date)}</td>
                      <td>
                        <span className={`badge ${daysLeft <= 7 ? 'badge-red' : 'badge-yellow'}`}>
                          {daysLeft <= 0 ? 'פגה!' : `${daysLeft} ימים`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}


      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap:20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">פוליסות</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>מס' פוליסה</th><th>רכב</th><th>כיסוי</th><th>מבטח</th><th>עד תאריך</th><th>פרמיה</th><th>סטטוס</th><th>באיחור</th><th></th></tr></thead>
              <tbody>
                {policies.map(p=>{
                  const v = vMap[p.vehicle_id];
                  const expiringSoon = p.expiry_date && new Date(p.expiry_date) < new Date(Date.now()+30*86400000);
                  return (
                    <tr key={p.id} style={{cursor:'pointer',background:selected?.id===p.id?'#eff6ff':''}} onClick={()=>loadSelected(p.id)}>
                      <td style={{fontWeight:600}}>{p.policy_number}</td>
                      <td style={{fontSize:12}}>{v?v.vehicle_number:'—'}</td>
                      <td>{p.coverage_type}</td>
                      <td style={{fontSize:12}}>{p.insurer}</td>
                      <td style={{color:expiringSoon?'#dc2626':'',fontWeight:expiringSoon?700:''}}>{fmtDate(p.expiry_date)}{expiringSoon?' ⚠️':''}</td>
                      <td>{fmtCur(p.total_premium)}</td>
                      <td><span className={`badge ${p.status==='פעילה'?'badge-green':p.status==='בוטלה'?'badge-red':'badge-gray'}`}>{p.status}</span></td>
                      <td>{p.overdue_count > 0 ? <span className="badge badge-red">{p.overdue_count} 🔴</span> : <span className="badge badge-green">תקין</span>}</td>
                      <td onClick={e=>e.stopPropagation()}>
                        {user.role==='admin' && <>
                          <button className="btn btn-secondary btn-sm" onClick={()=>openEdit(p)} style={{marginLeft:4}}>✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={()=>del(p)}>🗑️</button>
                        </>}
                      </td>
                    </tr>
                  );
                })}
                {policies.length===0 && <tr><td colSpan={9} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין פוליסות</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {selected && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">💳 תשלומים — {selected.policy_number}</span>
              <button className="btn btn-secondary btn-sm" onClick={()=>setSelected(null)}>×</button>
            </div>
            <div className="table-wrap" style={{maxHeight:500,overflowY:'auto'}}>
              <table>
                <thead><tr><th>#</th><th>תאריך</th><th>סכום יופצ</th><th>שולם</th><th>סטטוס</th><th></th></tr></thead>
                <tbody>
                  {selected.payments?.map(pay=>{
                    const past = new Date(pay.charge_date) < new Date();
                    return (
                      <tr key={pay.id}>
                        <td>{pay.payment_number}</td>
                        <td style={{color:past&&pay.status==='פתוח'?'#dc2626':''}}>{fmtDate(pay.charge_date)}</td>
                        <td>{fmtCur(pay.expected_amount)}</td>
                        <td>{fmtCur(pay.actual_amount)}</td>
                        <td><span className={`badge ${pay.status==='שולם'?'badge-green':pay.status==='שולם באיחור'?'badge-yellow':'badge-blue'}`}>{pay.status}</span></td>
                        <td>
                          {pay.status==='פתוח' && (
                            <button className="btn btn-secondary btn-sm" onClick={()=>updatePayment(selected.id, pay.id, 'שולם')}>✓ שולם</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editItem?'עריכת פוליסה':'הוספת פוליסה'}</span>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label className="form-label">רכב</label>
                  <select className="form-control" value={form.vehicle_id||''} onChange={e=>f('vehicle_id',+e.target.value||null)}>
                    <option value="">בחר רכב</option>
                    {vehicles.map(v=><option key={v.id} value={v.id}>{v.vehicle_number} {v.nickname?`(${v.nickname})`:''}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">מספר פוליסה</label><input className="form-control" value={form.policy_number||''} onChange={e=>f('policy_number',e.target.value)}/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">סוג כיסוי</label>
                  <select className="form-control" value={form.coverage_type||''} onChange={e=>f('coverage_type',e.target.value)}>
                    {COVERAGE_TYPES.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">חברת ביטוח</label>
                  <input className="form-control" list="insurers-list" value={form.insurer||''} onChange={e=>f('insurer',e.target.value)}/>
                  <datalist id="insurers-list">
                    {['מגדל','הראל','הכשרה','מנורה','הפניקס','ביטוח ישיר','כלל','איילון','ניו קופל'].map(i=><option key={i} value={i}/>)}
                  </datalist>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">תחילת פוליסה</label><input className="form-control" type="date" value={form.start_date?.split('T')[0]||''} onChange={e=>f('start_date',e.target.value)}/></div>
                <div className="form-group"><label className="form-label">תפוגת פוליסה</label><input className="form-control" type="date" value={form.expiry_date?.split('T')[0]||''} onChange={e=>f('expiry_date',e.target.value)}/></div>
              </div>
              <div className="form-row cols-3">
                <div className="form-group"><label className="form-label">פרמיה כוללת (₪)</label><input className="form-control" type="number" value={form.total_premium||''} onChange={e=>f('total_premium',+e.target.value)}/></div>
                <div className="form-group"><label className="form-label">מס' תשלומים</label><input className="form-control" type="number" value={form.num_payments||12} onChange={e=>f('num_payments',+e.target.value)}/></div>
                <div className="form-group"><label className="form-label">יום חיוב בחודש</label><input className="form-control" type="number" min="1" max="28" value={form.first_charge_day||1} onChange={e=>f('first_charge_day',+e.target.value)}/></div>
              </div>
              <div className="form-group"><label className="form-label">הערות</label><textarea className="form-control" rows={2} value={form.notes||''} onChange={e=>f('notes',e.target.value)}/></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'שומר...':'שמור'}</button>
              {!editItem && <div style={{fontSize:12,color:'#6b7280',marginRight:'auto'}}>⚡ תשלומים יווצרו אוטומטית</div>}
              <button className="btn btn-secondary" onClick={closeModal}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
