import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }
function fmtCur(n) { return n != null ? `₪${Number(n).toLocaleString('he-IL')}` : '—'; }

export default function VehicleDetail() {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState(null);
  const [tab, setTab] = useState('כללי');
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({});
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const TABS = ['כללי','טיפולים','בדיקות','כרטיסי דלק','ביטוח','מיגון','כלי עבודה','החזרי סולר'];
  const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');

  useEffect(() => { api.vehicle(id).then(setVehicle).catch(console.error); }, [id]);

  function openPurchaseEdit() {
    setPurchaseForm({
      purchase_date: vehicle.purchase_date?.split('T')[0] || '',
      purchase_amount: vehicle.purchase_amount || '',
      purchase_payment_method: vehicle.purchase_payment_method || '',
      purchase_num_payments: vehicle.purchase_num_payments || '',
      purchase_doc_url: vehicle.purchase_doc_url || '',
    });
    setShowPurchaseModal(true);
  }

  async function savePurchase() {
    setPurchaseSaving(true);
    try {
      const token = localStorage.getItem('fleet_token');
      const r = await fetch(`/api/vehicles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(purchaseForm)
      });
      if (!r.ok) throw new Error(await r.text());
      const updated = await r.json();
      setVehicle(v => ({ ...v, ...updated }));
      setShowPurchaseModal(false);
    } catch (e) { alert(e.message); }
    finally { setPurchaseSaving(false); }
  }

  async function uploadPurchaseDoc(file) {
    setUploading(true);
    try {
      const token = localStorage.getItem('fleet_token');
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`/api/vehicles/${id}/purchase-doc`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });
      if (!r.ok) throw new Error(await r.text());
      const { url } = await r.json();
      setVehicle(v => ({ ...v, purchase_doc_url: url }));
      setPurchaseForm(p => ({ ...p, purchase_doc_url: url }));
    } catch (e) { alert(e.message); }
    finally { setUploading(false); }
  }

  if (!vehicle) return <div className="loading">טוען...</div>;

  const statusBadge = (s) => {
    const map = { 'פעיל':'badge-green','בוצע':'badge-green','שולם':'badge-green','פעילה':'badge-green',
                  'מושבת':'badge-red','בוטל':'badge-red','לא פעיל':'badge-red','בוטלה':'badge-red',
                  'בהקפאה':'badge-yellow','בתיקון':'badge-yellow','שולם באיחור':'badge-yellow',
                  'פתוח':'badge-blue','התקבל':'badge-green','הוגש':'badge-yellow' };
    return <span className={`badge ${map[s]||'badge-gray'}`}>{s}</span>;
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
        <Link to="/vehicles" className="btn btn-secondary btn-sm">→ חזרה</Link>
        <div>
          <h2 style={{ fontSize:22, fontWeight:700 }}>{vehicle.vehicle_number} {vehicle.nickname ? `— ${vehicle.nickname}` : ''}</h2>
          <div style={{ fontSize:14, color:'#6b7280' }}>{vehicle.manufacturer} {vehicle.model} {vehicle.year} | {vehicle.asset_type} | {vehicle.fuel_type}</div>
        </div>
        <span className={`badge ${vehicle.status==='פעיל'?'badge-green':vehicle.status==='מושבת'?'badge-red':'badge-yellow'}`} style={{fontSize:14,padding:'4px 12px'}}>{vehicle.status}</span>
      </div>

      <div className="tabs">
        {TABS.map(t => <div key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t}</div>)}
      </div>

      {tab === 'כללי' && (
        <><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">פרטי רכב</span></div>
            <div className="card-body">
              {[['מספר רכב', vehicle.vehicle_number], ['כינוי', vehicle.nickname], ['סוג נכס', vehicle.asset_type], ['דלק', vehicle.fuel_type], ['יצרן', vehicle.manufacturer], ['דגם', vehicle.model], ['שנה', vehicle.year], ['מספר שילדה', vehicle.chassis_number], ['תאריך רכישה', fmtDate(vehicle.purchase_date)], ['זכאי להחזר סולר', vehicle.eligible_diesel_refund ? 'כן ✅' : 'לא']].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid #f3f4f6',fontSize:14}}>
                  <span style={{color:'#6b7280'}}>{k}</span><span style={{fontWeight:500}}>{v||'—'}</span>
                </div>
              ))}
              {vehicle.notes && <div style={{marginTop:12,padding:10,background:'#f9fafb',borderRadius:6,fontSize:13}}>{vehicle.notes}</div>}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">אחראים משויכים</span></div>
            <div className="card-body">
              {vehicle.employees?.length === 0 && <div style={{color:'#9ca3af',fontSize:14}}>אין עובדים משויכים</div>}
              {vehicle.employees?.map(e=>(
                <div key={e.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #f3f4f6'}}>
                  <div><div style={{fontWeight:600}}>{e.name}</div><div style={{fontSize:12,color:'#6b7280'}}>{e.role}</div></div>
                  <div style={{textAlign:'left'}}>{e.is_responsible && <span className="badge badge-blue">אחראי</span>}<div style={{fontSize:12,color:'#6b7280'}}>{e.phone}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Purchase Details */}
        <div className="card" style={{marginTop:20}}>
          <div className="card-header">
            <span className="card-title">🛒 פרטי רכישה</span>
            {user.role === 'admin' && <button className="btn btn-secondary btn-sm" onClick={openPurchaseEdit}>✏️ עריכה</button>}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:20,padding:16}}>
            {[
              ['תאריך רכישה', fmtDate(vehicle.purchase_date)],
              ['סכום רכישה', fmtCur(vehicle.purchase_amount)],
              ['אופן תשלום', vehicle.purchase_payment_method],
              ['מספר תשלומים', vehicle.purchase_num_payments],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{fontSize:12,color:'#6b7280',marginBottom:4}}>{label}</div>
                <div style={{fontWeight:600,fontSize:15}}>{val || '—'}</div>
              </div>
            ))}
          </div>
          {vehicle.purchase_doc_url && (
            <div style={{padding:'0 16px 16px'}}>
              <a href={vehicle.purchase_doc_url} target="_blank" rel="noopener noreferrer"
                className="btn btn-secondary btn-sm">
                📄 מסמך רכישה
              </a>
            </div>
          )}
          {!vehicle.purchase_doc_url && user.role === 'admin' && (
            <div style={{padding:'0 16px 16px'}}>
              <label className="btn btn-secondary btn-sm" style={{cursor:'pointer'}}>
                {uploading ? '⏳ מעלה...' : '📎 העלה מסמך רכישה'}
                <input type="file" style={{display:'none'}} accept=".pdf,.jpg,.jpeg,.png"
                  onChange={e => e.target.files[0] && uploadPurchaseDoc(e.target.files[0])} />
              </label>
            </div>
          )}
        </div>

        {/* Purchase Edit Modal */}
        {showPurchaseModal && (
          <div className="modal-overlay" onClick={()=>setShowPurchaseModal(false)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title">פרטי רכישה — {vehicle.vehicle_number}</span>
                <button className="modal-close" onClick={()=>setShowPurchaseModal(false)}>×</button>
              </div>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group"><label className="form-label">תאריך רכישה</label>
                    <input className="form-control" type="date" value={purchaseForm.purchase_date||''} onChange={e=>setPurchaseForm(p=>({...p,purchase_date:e.target.value}))}/>
                  </div>
                  <div className="form-group"><label className="form-label">סכום (₪)</label>
                    <input className="form-control" type="number" value={purchaseForm.purchase_amount||''} onChange={e=>setPurchaseForm(p=>({...p,purchase_amount:+e.target.value}))}/>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">אופן תשלום</label>
                    <input className="form-control" list="pay-methods" value={purchaseForm.purchase_payment_method||''} onChange={e=>setPurchaseForm(p=>({...p,purchase_payment_method:e.target.value}))}/>
                    <datalist id="pay-methods">
                      {['מזומן','אשראי','העברה בנקאית','ליסינג','צ\'ק','מימון בנקאי'].map(v=><option key={v} value={v}/>)}
                    </datalist>
                  </div>
                  <div className="form-group"><label className="form-label">מספר תשלומים</label>
                    <input className="form-control" type="number" min="1" value={purchaseForm.purchase_num_payments||''} onChange={e=>setPurchaseForm(p=>({...p,purchase_num_payments:+e.target.value}))}/>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">מסמך רכישה</label>
                  <label className="btn btn-secondary btn-sm" style={{cursor:'pointer',display:'inline-block'}}>
                    {uploading ? '⏳ מעלה...' : (purchaseForm.purchase_doc_url ? '📄 החלף מסמך' : '📎 העלה מסמך')}
                    <input type="file" style={{display:'none'}} accept=".pdf,.jpg,.jpeg,.png"
                      onChange={e => e.target.files[0] && uploadPurchaseDoc(e.target.files[0])} />
                  </label>
                  {purchaseForm.purchase_doc_url && (
                    <a href={purchaseForm.purchase_doc_url} target="_blank" rel="noopener noreferrer"
                      style={{marginRight:10,fontSize:13}}>צפה במסמך</a>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-primary" onClick={savePurchase} disabled={purchaseSaving}>{purchaseSaving?'שומר...':'שמור'}</button>
                <button className="btn btn-secondary" onClick={()=>setShowPurchaseModal(false)}>ביטול</button>
              </div>
            </div>
          </div>
        )}
        </>
      )}

      {tab === 'טיפולים' && (
        <div className="card">
          <div className="card-header"><span className="card-title">🔧 היסטוריית טיפולים</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>תאריך</th><th>סוג</th><th>מוסך</th><th>תיאור</th><th>ק"מ</th><th>עלות</th><th>סטטוס</th><th>תאריך הבא</th></tr></thead>
              <tbody>
                {vehicle.maintenance?.map(m=>(
                  <tr key={m.id}>
                    <td>{fmtDate(m.maintenance_date)}</td>
                    <td>{m.maintenance_type}</td>
                    <td>{m.garage_name||'—'}</td>
                    <td style={{maxWidth:200,fontSize:12}}>{m.description}</td>
                    <td>{m.odometer?.toLocaleString()}</td>
                    <td>{fmtCur(m.cost)}</td>
                    <td>{statusBadge(m.status)}</td>
                    <td style={{color: m.next_date && new Date(m.next_date)<new Date()?'#dc2626':''}}>{fmtDate(m.next_date)}</td>
                  </tr>
                ))}
                {!vehicle.maintenance?.length && <tr><td colSpan={8} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין טיפולים</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'בדיקות' && (
        <div className="card">
          <div className="card-header"><span className="card-title">📋 בדיקות רכב</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>תאריך</th><th>סוג</th><th>בודק</th><th>עלות</th><th>עבר?</th><th>בדיקה הבאה</th></tr></thead>
              <tbody>
                {vehicle.inspections?.map(i=>(
                  <tr key={i.id}>
                    <td>{fmtDate(i.inspection_date)}</td>
                    <td>{i.inspection_type}</td>
                    <td>{i.inspector||'—'}</td>
                    <td>{fmtCur(i.cost)}</td>
                    <td>{i.passed ? <span className="badge badge-green">עבר ✓</span> : <span className="badge badge-red">נכשל ✗</span>}</td>
                    <td style={{color: i.next_inspection_date && new Date(i.next_inspection_date)<new Date()?'#dc2626':''}}>{fmtDate(i.next_inspection_date)}</td>
                  </tr>
                ))}
                {!vehicle.inspections?.length && <tr><td colSpan={6} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין בדיקות</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'כרטיסי דלק' && (
        <div className="card">
          <div className="card-header"><span className="card-title">⛽ כרטיסי דלק</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>מספר כרטיס</th><th>ספק</th><th>סוג דלק</th><th>סטטוס</th><th>הגבלה יומית</th><th>הגבלה חודשית</th></tr></thead>
              <tbody>
                {vehicle.fuel_cards?.map(fc=>(
                  <tr key={fc.id}>
                    <td style={{fontWeight:600}}>{fc.card_number}</td>
                    <td>{fc.supplier}</td>
                    <td>{fc.fuel_type}</td>
                    <td>{statusBadge(fc.status)}</td>
                    <td>{fmtCur(fc.daily_limit)}</td>
                    <td>{fmtCur(fc.monthly_limit)}</td>
                  </tr>
                ))}
                {!vehicle.fuel_cards?.length && <tr><td colSpan={6} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין כרטיסי דלק</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'ביטוח' && (
        <div className="card">
          <div className="card-header"><span className="card-title">🛡️ פוליסות ביטוח</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>מספר פוליסה</th><th>סוג כיסוי</th><th>מבטח</th><th>מתאריך</th><th>עד תאריך</th><th>פרמיה כוללת</th><th>תשלומים</th><th>סטטוס</th></tr></thead>
              <tbody>
                {vehicle.policies?.map(p=>(
                  <tr key={p.id}>
                    <td style={{fontWeight:600}}>{p.policy_number}</td>
                    <td>{p.coverage_type}</td>
                    <td>{p.insurer}</td>
                    <td>{fmtDate(p.start_date)}</td>
                    <td style={{color: p.expiry_date && new Date(p.expiry_date)<new Date(Date.now()+30*86400000)?'#dc2626':''}}>{fmtDate(p.expiry_date)}</td>
                    <td>{fmtCur(p.total_premium)}</td>
                    <td>{p.num_payments}</td>
                    <td>{statusBadge(p.status)}</td>
                  </tr>
                ))}
                {!vehicle.policies?.length && <tr><td colSpan={8} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין פוליסות</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'מיגון' && (
        <div className="card">
          <div className="card-header"><span className="card-title">🔒 מיגון לרכב</span></div>
          <div className="card-body">
            {vehicle.security?.map(s=>(
              <div key={s.id} style={{padding:'12px',border:'1px solid #e5e7eb',borderRadius:8,marginBottom:10}}>
                <div style={{fontWeight:600}}>{s.company_name} — {s.security_type}</div>
                <div style={{fontSize:13,color:'#6b7280',marginTop:4}}>התקנה: {fmtDate(s.installation_date)} | חידוש: {fmtDate(s.renewal_date)} | דמי יונמ: {fmtCur(s.subscription_fee)}/חודש</div>
              </div>
            ))}
            {!vehicle.security?.length && <div style={{color:'#9ca3af'}}>אין מיגון רשום</div>}
          </div>
        </div>
      )}

      {tab === 'כלי עבודה' && (
        <div className="card">
          <div className="card-header"><span className="card-title">🔩 כלי עבודה</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>מספר סידורי</th><th>סוג כלי</th><th>סטטוס</th><th>נדרש ריקורד?</th></tr></thead>
              <tbody>
                {vehicle.tools?.map(t=>(
                  <tr key={t.id}><td>{t.serial_number}</td><td>{t.tool_type}</td><td>{statusBadge(t.status)}</td><td>{t.requires_inspection?'כן':'לא'}</td></tr>
                ))}
                {!vehicle.tools?.length && <tr><td colSpan={4} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין כלי עבודה</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'החזרי סולר' && (
        <div className="card">
          <div className="card-header"><span className="card-title">⛽ החזרי סולר (רלו)</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>תקופה</th><th>ליטרים</th><th>סכום</th><th>סטטוס</th><th>תאריך הגשה</th><th>תאריך קבלה</th></tr></thead>
              <tbody>
                {vehicle.diesel_refunds?.map(r=>(
                  <tr key={r.id}><td>{r.period}</td><td>{r.liters?.toLocaleString()}</td><td>{fmtCur(r.amount)}</td><td>{statusBadge(r.refund_status)}</td><td>{fmtDate(r.submission_date)}</td><td>{fmtDate(r.actual_receipt_date)}</td></tr>
                ))}
                {!vehicle.diesel_refunds?.length && <tr><td colSpan={6} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין נתוני החזרי סולר</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
