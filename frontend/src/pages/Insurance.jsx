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
  const [sort, setSort] = useState({ col: 'status', dir: 'asc' });

  function toggleSort(col) { setSort(s => ({ col, dir: s.col===col && s.dir==='asc' ? 'desc' : 'asc' })); }

  function sortedPolicies() {
    const active = ['פעילה'], inactive = ['הסתיימה','בוטלה','לא פעילה','בהקפאה'];
    const order = p => active.includes(p.status) ? 0 : inactive.includes(p.status) ? 2 : 1;
    return [...policies].sort((a, b) => {
      const sd = order(a) - order(b);
      if (sd !== 0) return sd;
      const dir = sort.dir === 'asc' ? 1 : -1;
      if (sort.col === 'expiry_date' || sort.col === 'start_date') return dir*(new Date(a[sort.col]||0)-new Date(b[sort.col]||0));
      if (sort.col === 'total_premium') return dir*((parseFloat(a.total_premium)||0)-(parseFloat(b.total_premium)||0));
      return dir*(a[sort.col]||'').toString().localeCompare((b[sort.col]||'').toString(),'he');
    });
  }
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
    const today = new Date().toISOString().split('T')[0];
    const newForm = { status:'פעילה', coverage_type:'חובה', num_payments:12, first_charge_day:1, purchase_date: today };
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

  // Calculate first charge date based on PM type
  function calcFirstChargeDate(startDateStr, pm) {
    if (!startDateStr) return null;
    const d = new Date(startDateStr);
    const isAutoCharge = pm && pm.monthly_charge_day && (pm.payment_type === 'אשראי' || (pm.payment_type && pm.payment_type.includes('הו')));
    if (isAutoCharge) {
      const chargeDay = parseInt(pm.monthly_charge_day);
      let year = d.getFullYear(), month = d.getMonth();
      if (d.getDate() >= chargeDay) { month += 1; if (month > 11) { month = 0; year += 1; } }
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      return `${year}-${String(month+1).padStart(2,'0')}-${String(Math.min(chargeDay, daysInMonth)).padStart(2,'0')}`;
    }
    return d.toISOString().split('T')[0];
  }

  // Build auto schedule from form values — pm passed directly to avoid stale closure
  function buildAutoSchedule(formData, pmId, pmDirect) {
    const total = parseFloat(formData.total_premium) || 0;
    const count = parseInt(formData.num_payments) || 1;
    const pm = pmDirect || paymentMethods.find(p => p.id === (pmId || formData.charge_method_id));
    const baseDate = formData.purchase_date || new Date().toISOString().split('T')[0];
    const firstDate = calcFirstChargeDate(baseDate, pm);
    const perInstallment = count > 0 ? (total / count) : total;
    return Array.from({ length: count }, (_, i) => {
      let chargeDate = null;
      let chargeMonth = null;
      if (firstDate) {
        const d = new Date(firstDate);
        d.setMonth(d.getMonth() + i);
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

  // Smart first charge date display
  const selectedPM = paymentMethods.find(pm => pm.id === (form.charge_method_id));
  const isAutoChargeDay = selectedPM && selectedPM.monthly_charge_day && (selectedPM.payment_type === 'אשראי' || (selectedPM.payment_type && selectedPM.payment_type.includes('הו')));
  const computedFirstCharge = calcFirstChargeDate(form.purchase_date || new Date().toISOString().split('T')[0], selectedPM);
  const firstChargeDisplay = form.charge_method_id && computedFirstCharge
    ? isAutoChargeDay
      ? `${new Date(computedFirstCharge).toLocaleDateString('he-IL')} (יום ${selectedPM.monthly_charge_day} לחודש — מחושב)`
      : new Date(computedFirstCharge).toLocaleDateString('he-IL')
    : null;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <h2 style={{ fontSize:18, fontWeight:700 }}>ביטוח — {policies.length} פוליסות</h2>
          <Link to="/dept/vehicles/policies/payments" style={{ fontSize:13, color:'#0369a1', fontWeight:600, padding:'4px 10px', background:'#e0f2fe', borderRadius:6, textDecoration:'none' }}>📊 לוח תשלומים</Link>
          <Link to="/dept/vehicles/reports/payment-methods" style={{ fontSize:13, color:'#7c3aed', fontWeight:600, padding:'4px 10px', background:'#ede9fe', borderRadius:6, textDecoration:'none' }}>📈 דוח אמצעי תשלום</Link>
          <Link to="/dept/vehicles/reports/monthly-summary" style={{ fontSize:13, color:'#059669', fontWeight:600, padding:'4px 10px', background:'#d1fae5', borderRadius:6, textDecoration:'none' }}>💰 עלויות חודשיות</Link>
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
              <thead>
                <tr>
                  {[
                    {col:'policy_number',label:"מס' פוליסה"},
                    {col:'vehicle_id',label:'רכב'},
                    {col:'coverage_type',label:'כיסוי'},
                    {col:'insurer',label:'מבטח'},
                    {col:'expiry_date',label:'עד תאריך'},
                    {col:'total_premium',label:'פרמיה'},
                    {col:'monthly',label:'חודשי',noSort:true},
                    {col:'charge_method_id',label:'אמצעי תשלום'},
                    {col:'status',label:'סטטוס'},
                    {col:'overdue',label:'באיחור',noSort:true},
                  ].map(({col,label,noSort})=>(
                    <th key={col} style={{cursor:noSort?'default':'pointer',userSelect:'none',whiteSpace:'nowrap'}}
                      onClick={noSort?undefined:()=>toggleSort(col)}>
                      {label}{!noSort && sort.col===col?(sort.dir==='asc'?' ↑':' ↓'):''}
                    </th>
                  ))}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedPolicies().map((p, idx, arr)=>{
                  const isInactive = ['הסתיימה','בוטלה','לא פעילה','בהקפאה'].includes(p.status);
                  const prevInactive = idx > 0 && ['הסתיימה','בוטלה','לא פעילה','בהקפאה'].includes(arr[idx-1]?.status);
                  const firstInactive = isInactive && !prevInactive;
                  const v = vMap[p.vehicle_id];
                  const expiringSoon = !isInactive && p.expiry_date && new Date(p.expiry_date) < new Date(Date.now()+30*86400000);
                  return (
                    <React.Fragment key={p.id}>
                      {firstInactive && (
                        <tr><td colSpan={11} style={{background:'#f1f5f9',padding:'4px 12px',fontSize:11,color:'#64748b',fontWeight:600}}>— פוליסות לא פעילות —</td></tr>
                      )}
                      <tr style={{cursor:'pointer',background:selected?.id===p.id?'#eff6ff':'',opacity:isInactive?0.65:1}} onClick={()=>loadSelected(p.id)}>
                        <td style={{fontWeight:600}}>{p.policy_number}</td>
                        <td style={{fontSize:12}}>
                          {v ? (
                            <Link to={`/vehicles/${v.id}`} style={{color:'#1e40af',textDecoration:'none',fontWeight:600}}>
                              {v.vehicle_number}{v.nickname?` (${v.nickname})`:''}
                            </Link>
                          ) : p.policy_type ? (
                            <span style={{background:'#f3f4f6',color:'#374151',padding:'2px 8px',borderRadius:12,fontSize:11,fontWeight:600}}>🏢 {p.policy_type}</span>
                          ) : <span style={{color:'#9ca3af'}}>—</span>}
                        </td>
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
                        <td><span className={`badge ${p.status==='פעילה'?'badge-green':p.status==='הסתיימה'||p.status==='בוטלה'?'badge-red':'badge-gray'}`}>{p.status}</span></td>
                        <td>{p.overdue_count > 0 ? <span className="badge badge-red">{p.overdue_count} 🔴</span> : <span className="badge badge-green">תקין</span>}</td>
                        <td onClick={e=>e.stopPropagation()}>
                          {user.role==='admin' && <>
                            <button className="btn btn-secondary btn-sm" onClick={()=>openEdit(p)} style={{marginLeft:4}}>✏️</button>
                            <button className="btn btn-danger btn-sm" onClick={()=>del(p)}>🗑️</button>
                          </>}
                        </td>
                      </tr>
                    </React.Fragment>
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
                <div className="form-group"><label className="form-label">רכב <span style={{fontSize:11,color:'#6b7280'}}>(אופציונלי)</span></label>
                  <select className="form-control" value={form.vehicle_id||''} onChange={e=>f('vehicle_id',+e.target.value||null)}>
                    <option value="">ללא רכב (פוליסה עצמאית)</option>
                    {vehicles.map(v=><option key={v.id} value={v.id}>{v.vehicle_number} {v.nickname?`(${v.nickname})`:''}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">מספר פוליסה</label><input className="form-control" value={form.policy_number||''} onChange={e=>f('policy_number',e.target.value)}/></div>
              </div>
              {!form.vehicle_id && (
                <div className="form-group">
                  <label className="form-label">סוג פוליסה <span style={{fontSize:11,color:'#6b7280'}}>(למשל: פוליסת קבלנים, ביטוח עסק, אחריות מקצועית)</span></label>
                  <input className="form-control" placeholder="הזן סוג פוליסה..." value={form.policy_type||''} onChange={e=>f('policy_type',e.target.value)}/>
                </div>
              )}
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
              <div className="form-row cols-2">
                <div className="form-group"><label className="form-label">תחילת פוליסה <span style={{fontSize:11,color:'#6b7280'}}>(כיסוי מ-)</span></label><input className="form-control" type="date" value={form.start_date?.split('T')[0]||''} onChange={e=>f('start_date',e.target.value)}/></div>
                <div className="form-group"><label className="form-label">תפוגת פוליסה</label><input className="form-control" type="date" value={form.expiry_date?.split('T')[0]||''} onChange={e=>f('expiry_date',e.target.value)}/></div>
              </div>
              <div className="form-row cols-2">
                <div className="form-group"><label className="form-label">פרמיה כוללת (₪)</label><input className="form-control" type="number" value={form.total_premium ?? ''} onChange={e=>f('total_premium', e.target.value === '' ? '' : +e.target.value)}/></div>
                <div className="form-group"><label className="form-label">מס' תשלומים</label><input className="form-control" type="number" value={form.num_payments ?? 12} onChange={e=>f('num_payments', e.target.value === '' ? '' : +e.target.value)}/></div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">אמצעי תשלום</label>
                  <select className="form-control" value={form.charge_method_id||''} onChange={e=>{
                    const pmId = +e.target.value||null;
                    const pm = paymentMethods.find(p => p.id === pmId);
                    f('charge_method_id', pmId);
                    setScheduleItems(buildAutoSchedule({...form, charge_method_id: pmId}, pmId, pm));
                  }}>
                    <option value="">בחר אמצעי תשלום</option>
                    {paymentMethods.map(pm=><option key={pm.id} value={pm.id}>{pm.name}{pm.monthly_charge_day ? ` (יום ${pm.monthly_charge_day})` : ''}</option>)}
                  </select>
                  
                </div>
                <div className="form-group"><label className="form-label">סטטוס</label>
                  <select className="form-control" value={form.status||'פעילה'} onChange={e=>f('status',e.target.value)}>
                    {['פעילה','לא פעילה','בוטלה'].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">תאריך רכישה <span style={{fontSize:11,color:'#6b7280'}}>(מתי שולמה — בסיס לחישוב חיוב)</span></label>
                <input className="form-control" type="date" value={form.purchase_date?.split('T')[0]||''} onChange={e=>{
                  const val = e.target.value;
                  const pm = paymentMethods.find(p => p.id === form.charge_method_id);
                  f('purchase_date', val);
                  setScheduleItems(buildAutoSchedule({...form, purchase_date: val}, form.charge_method_id, pm));
                }}/>
                <div style={{marginTop:8, padding:'8px 12px', background: firstChargeDisplay ? '#f0fdf4' : '#f8fafc', border:`1px solid ${firstChargeDisplay ? '#86efac' : '#e2e8f0'}`, borderRadius:6, fontSize:13}}>
                  <span style={{color:'#64748b'}}>⚡ חיוב ראשון: </span>
                  {firstChargeDisplay
                    ? <strong style={{color:'#15803d'}}>📅 {firstChargeDisplay}</strong>
                    : <span style={{color:'#94a3b8'}}>בחר אמצעי תשלום לחישוב</span>
                  }
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
