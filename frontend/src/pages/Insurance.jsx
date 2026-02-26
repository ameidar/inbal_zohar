import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const COVERAGE_TYPES = ['חובה','מקיף','חובה + מקיף','צד ג','חובה + צד ג\'','אחר','פוליסת גרירה','פוליסת שמשות'];
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }
function fmtCur(n) { return n != null ? `₪${Number(n).toLocaleString('he-IL')}` : '—'; }

export default function Insurance() {
  const [policies, setPolicies] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [scheduleItems, setScheduleItems] = useState([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');

  async function load() {
    const [data, v, pm] = await Promise.all([
      api.policies().catch(()=>[]),
      api.vehicles().catch(()=>[]),
      api.paymentMethods().catch(()=>[])
    ]);
    setPolicies(data); setVehicles(v); setPaymentMethods(pm);
  }
  async function loadSelected(id) {
    const data = await api.policy(id).catch(()=>null);
    setSelected(data);
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditItem(null);
    const newForm = { status:'פעילה', coverage_type:'חובה', num_payments:12, first_charge_day:1 };
    setForm(newForm);
    setScheduleItems(buildAutoSchedule(newForm, null));
    setShowSchedule(false);
    setShowModal(true);
  }
  function openEdit(item) {
    setEditItem(item);
    setForm(item);
    setShowSchedule(false);
    if (item.id) {
      api.policySchedule(item.id).then(items => {
        setScheduleItems(items.length > 0 ? items : buildAutoSchedule(item, item.charge_method_id));
      }).catch(() => {
        setScheduleItems(buildAutoSchedule(item, item.charge_method_id));
      });
    } else {
      setScheduleItems(buildAutoSchedule(item, item.charge_method_id));
    }
    setShowModal(true);
  }
  function closeModal() { setShowModal(false); setEditItem(null); setForm({}); setScheduleItems([]); setShowSchedule(false); }
  const f = (k, val) => setForm(p => ({ ...p, [k]: val }));

  // Build auto schedule from form values
  function buildAutoSchedule(formData, pmId) {
    const total = parseFloat(formData.total_premium) || 0;
    const count = parseInt(formData.num_payments) || 1;
    const chargeDay = parseInt(formData.first_charge_day) || 1;
    const startDate = formData.start_date ? new Date(formData.start_date) : null;
    const perInstallment = count > 0 ? (total / count) : total;
    return Array.from({ length: count }, (_, i) => {
      let chargeDate = null;
      let chargeMonth = null;
      if (startDate) {
        const d = new Date(startDate);
        d.setMonth(d.getMonth() + i);
        d.setDate(Math.min(chargeDay, new Date(d.getFullYear(), d.getMonth()+1, 0).getDate()));
        chargeDate = d.toISOString().split('T')[0];
        chargeMonth = chargeDate.substring(0, 7);
      }
      return {
        installment_number: i + 1,
        amount: Math.round(perInstallment * 100) / 100,
        charge_date: chargeDate,
        charge_month: chargeMonth,
        payment_method_id: pmId || formData.charge_method_id || null,
      };
    });
  }

  async function save() {
    setSaving(true);
    try {
      let savedPolicy;
      if (editItem) {
        savedPolicy = await api.updatePolicy(editItem.id, form);
      } else {
        savedPolicy = await api.createPolicy(form);
      }
      // Save schedule items if any
      const policyId = savedPolicy?.id || editItem?.id;
      if (policyId && scheduleItems.length > 0) {
        await api.bulkReplaceSchedule(policyId, scheduleItems).catch(()=>{});
      }
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
  const pmMap = Object.fromEntries(paymentMethods.map(pm=>[pm.id, pm]));

  // Monthly cost: sum(total_premium / num_payments) for active policies
  const activePolicies = policies.filter(p => p.status === 'פעילה');
  const monthlyCostTotal = activePolicies.reduce((sum, p) => {
    const monthly = p.total_premium && p.num_payments ? (parseFloat(p.total_premium) / parseInt(p.num_payments)) : 0;
    return sum + monthly;
  }, 0);

  // Monthly cost by payment method
  const monthlyCostByPM = {};
  activePolicies.forEach(p => {
    const pmName = pmMap[p.charge_method_id]?.name || 'לא משויך';
    const monthly = p.total_premium && p.num_payments ? (parseFloat(p.total_premium) / parseInt(p.num_payments)) : 0;
    monthlyCostByPM[pmName] = (monthlyCostByPM[pmName] || 0) + monthly;
  });

  // Policies expiring this calendar month
  const nowDate = new Date();
  const thisYear = nowDate.getFullYear();
  const thisMonth = nowDate.getMonth(); // 0-indexed
  const expiringThisMonth = policies.filter(p => {
    if (!p.expiry_date || p.status !== 'פעילה') return false;
    const d = new Date(p.expiry_date);
    return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
  }).sort((a,b) => new Date(a.expiry_date) - new Date(b.expiry_date));

  // Charge day visibility (depends on form.charge_method_id)
  const selectedPM = paymentMethods.find(pm => pm.id === form.charge_method_id);
  const showChargeDay = !selectedPM || selectedPM.payment_type === 'אשראי' || (selectedPM.payment_type && selectedPM.payment_type.includes('הו'));

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <h2 style={{ fontSize:18, fontWeight:700 }}>ביטוח — {policies.length} פוליסות</h2>
          <Link to="/dept/vehicles/policies/payments" style={{ fontSize:13, color:'#0369a1', fontWeight:600, padding:'4px 10px', background:'#e0f2fe', borderRadius:6, textDecoration:'none' }}>📊 לוח תשלומים</Link>
          <Link to="/dept/vehicles/reports/payment-methods" style={{ fontSize:13, color:'#7c3aed', fontWeight:600, padding:'4px 10px', background:'#ede9fe', borderRadius:6, textDecoration:'none' }}>📈 דוח אמצעי תשלום</Link>
        </div>
        {user.role==='admin' && <button className="btn btn-primary" onClick={openAdd}>+ הוסף פוליסה</button>}
      </div>

      {/* Monthly cost summary */}
      <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
        <div className="card" style={{ flex:'0 0 auto', padding:'12px 20px', background:'#f0fdf4', border:'1px solid #86efac', minWidth:200 }}>
          <div style={{ fontSize:12, color:'#15803d', fontWeight:600, marginBottom:4 }}>💰 עלות חודשית כוללת (פוליסות פעילות)</div>
          <div style={{ fontSize:22, fontWeight:800, color:'#166534' }}>₪{Math.round(monthlyCostTotal).toLocaleString('he-IL')}</div>
          <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>{activePolicies.length} פוליסות פעילות</div>
        </div>
        {Object.entries(monthlyCostByPM).sort((a,b)=>b[1]-a[1]).map(([name, cost]) => (
          <div key={name} className="card" style={{ flex:'0 0 auto', padding:'12px 16px', background:'#f8fafc', border:'1px solid #e2e8f0', minWidth:160 }}>
            <div style={{ fontSize:11, color:'#64748b', fontWeight:600, marginBottom:4 }}>{name}</div>
            <div style={{ fontSize:18, fontWeight:700, color:'#1e293b' }}>₪{Math.round(cost).toLocaleString('he-IL')}</div>
            <div style={{ fontSize:11, color:'#94a3b8' }}>/ חודש</div>
          </div>
        ))}
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
              <thead><tr><th>מס' פוליסה</th><th>רכב</th><th>כיסוי</th><th>מבטח</th><th>עד תאריך</th><th>פרמיה</th><th>חודשי</th><th>אמצעי תשלום</th><th>סטטוס</th><th>באיחור</th><th></th></tr></thead>
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
                      <td style={{fontSize:12,color:'#0369a1',fontWeight:600}}>
                        {p.total_premium && p.num_payments ? `₪${Math.round(parseFloat(p.total_premium)/parseInt(p.num_payments)).toLocaleString('he-IL')}` : '—'}
                      </td>
                      <td style={{fontSize:12}}>
                        {pmMap[p.charge_method_id] ? (
                          <span style={{background:'#e0f2fe',color:'#0369a1',padding:'2px 8px',borderRadius:12,fontWeight:600}}>
                            {pmMap[p.charge_method_id].name}
                          </span>
                        ) : <span style={{color:'#9ca3af'}}>—</span>}
                      </td>
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
                {policies.length===0 && <tr><td colSpan={11} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין פוליסות</td></tr>}
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
              <div className={`form-row ${showChargeDay ? 'cols-3' : 'cols-2'}`}>
                <div className="form-group"><label className="form-label">פרמיה כוללת (₪)</label><input className="form-control" type="number" value={form.total_premium ?? ''} onChange={e=>f('total_premium', e.target.value === '' ? '' : +e.target.value)}/></div>
                <div className="form-group"><label className="form-label">מס' תשלומים</label><input className="form-control" type="number" value={form.num_payments ?? 12} onChange={e=>f('num_payments', e.target.value === '' ? '' : +e.target.value)}/></div>
                {showChargeDay && <div className="form-group"><label className="form-label">יום חיוב בחודש</label><input className="form-control" type="number" min="1" max="28" value={form.first_charge_day ?? 1} onChange={e=>f('first_charge_day', e.target.value === '' ? '' : +e.target.value)}/></div>}
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">אמצעי תשלום</label>
                  <select className="form-control" value={form.charge_method_id||''} onChange={e=>f('charge_method_id',+e.target.value||null)}>
                    <option value="">בחר אמצעי תשלום</option>
                    {paymentMethods.map(pm=><option key={pm.id} value={pm.id}>{pm.name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">סטטוס</label>
                  <select className="form-control" value={form.status||'פעילה'} onChange={e=>f('status',e.target.value)}>
                    {['פעילה','לא פעילה','בוטלה'].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ borderTop:'1px solid #e5e7eb', paddingTop:12, marginTop:4 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <span style={{ fontWeight:700, fontSize:14 }}>📅 פריסת תשלומים ({scheduleItems.length} תשלומים)</span>
                  <div style={{ display:'flex', gap:8 }}>
                    <button type="button" className="btn btn-secondary btn-sm"
                      onClick={() => setScheduleItems(buildAutoSchedule(form, form.charge_method_id))}>
                      🔄 חשב מחדש
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm"
                      onClick={() => setShowSchedule(s => !s)}>
                      {showSchedule ? '🔼 סגור' : '🔽 הצג/ערוך'}
                    </button>
                  </div>
                </div>
                {showSchedule && (
                  <div style={{ maxHeight:300, overflowY:'auto', border:'1px solid #e5e7eb', borderRadius:6 }}>
                    <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
                      <thead>
                        <tr style={{ background:'#f8fafc' }}>
                          <th style={{ padding:'6px 8px', textAlign:'right', borderBottom:'1px solid #e5e7eb' }}>#</th>
                          <th style={{ padding:'6px 8px', textAlign:'right', borderBottom:'1px solid #e5e7eb' }}>תאריך</th>
                          <th style={{ padding:'6px 8px', textAlign:'right', borderBottom:'1px solid #e5e7eb' }}>סכום (₪)</th>
                          <th style={{ padding:'6px 8px', textAlign:'right', borderBottom:'1px solid #e5e7eb' }}>אמצעי תשלום</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleItems.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom:'1px solid #f1f5f9' }}>
                            <td style={{ padding:'4px 8px', color:'#64748b' }}>{item.installment_number}</td>
                            <td style={{ padding:'4px 8px' }}>
                              <input type="date" style={{ border:'1px solid #e5e7eb', borderRadius:4, padding:'2px 4px', fontSize:12, width:130 }}
                                value={item.charge_date || ''}
                                onChange={e => setScheduleItems(s => s.map((it,i) => i===idx ? {...it, charge_date:e.target.value, charge_month:e.target.value.substring(0,7)} : it))}
                              />
                            </td>
                            <td style={{ padding:'4px 8px' }}>
                              <input type="number" style={{ border:'1px solid #e5e7eb', borderRadius:4, padding:'2px 4px', fontSize:12, width:90 }}
                                value={item.amount || ''}
                                onChange={e => setScheduleItems(s => s.map((it,i) => i===idx ? {...it, amount:+e.target.value} : it))}
                              />
                            </td>
                            <td style={{ padding:'4px 8px' }}>
                              <select style={{ border:'1px solid #e5e7eb', borderRadius:4, padding:'2px 4px', fontSize:12 }}
                                value={item.payment_method_id || ''}
                                onChange={e => setScheduleItems(s => s.map((it,i) => i===idx ? {...it, payment_method_id:+e.target.value||null} : it))}>
                                <option value="">ללא</option>
                                {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
