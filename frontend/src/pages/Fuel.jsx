import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

const FUEL_TYPES = ['סולר','בנזין','אוריאה','אחר'];
const CARD_TYPES = ['דלק','Master','אחר'];

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }
function fmtCur(n) { return n != null ? `₪${Number(n).toLocaleString('he-IL')}` : '—'; }

export default function Fuel() {
  const [invoices, setInvoices] = useState([]);
  const [cards, setCards] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [tab, setTab] = useState('חשבוניות');
  const [selected, setSelected] = useState(null);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [showCardModal, setShowCardModal] = useState(false);
  const [editCard, setEditCard] = useState(null);
  const [form, setForm] = useState({});
  const [cardForm, setCardForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [cardSaving, setCardSaving] = useState(false);
  const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');

  async function load() {
    const [inv, c, v, emp] = await Promise.all([
      api.fuelInvoices().catch(()=>[]),
      api.fuelCards().catch(()=>[]),
      api.vehicles().catch(()=>[]),
      api.employees().catch(()=>[])
    ]);
    setInvoices(inv); setCards(c); setVehicles(v); setEmployees(emp);
  }

  function openAddCard() {
    setEditCard(null);
    setCardForm({ status: 'פעיל', fuel_type: 'סולר', card_type: 'דלק' });
    setShowCardModal(true);
  }
  function openEditCard(c) {
    setEditCard(c);
    setCardForm({ ...c });
    setShowCardModal(true);
  }
  async function saveCard() {
    setCardSaving(true);
    try {
      if (editCard) await api.updateFuelCard(editCard.id, cardForm);
      else await api.createFuelCard(cardForm);
      setShowCardModal(false); setCardForm({}); load();
    } catch(e) { alert(e.message); }
    finally { setCardSaving(false); }
  }
  async function delCard(c) {
    if (!confirm(`למחוק כרטיס ${c.card_number}?`)) return;
    await api.deleteFuelCard(c.id).catch(e=>alert(e.message));
    load();
  }
  async function loadInvoice(id) {
    const data = await api.fuelInvoice(id).catch(()=>null);
    setSelected(data);
  }
  useEffect(() => { load(); }, []);

  const f = (k, val) => setForm(p => ({ ...p, [k]: val }));

  async function saveInvoice() {
    setSaving(true);
    try {
      await api.createFuelInvoice(form);
      setShowAddInvoice(false); setForm({}); load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  const vMap = Object.fromEntries(vehicles.map(v=>[v.id, v]));

  return (
    <div>
      <div style={{ display:'flex', gap:0, borderBottom:'2px solid #e5e7eb', marginBottom:20, alignItems:'center', justifyContent:'space-between' }}>
        <div className="tabs" style={{borderBottom:'none',margin:0}}>
          {['חשבוניות','כרטיסי דלק'].map(t=><div key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>{setTab(t);setSelected(null);}}>{t}</div>)}
        </div>
        {user.role==='admin' && tab==='חשבוניות' && <button className="btn btn-primary btn-sm" onClick={()=>setShowAddInvoice(true)}>+ הוסף חשבונית</button>}
      </div>

      {tab === 'חשבוניות' && (
        <div style={{ display:'grid', gridTemplateColumns:selected?'1fr 1fr':'1fr', gap:20 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">חשבוניות דלק ({invoices.length})</span></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>תקופה</th><th>ספק</th><th>תאריך</th><th>ליטרים סולר</th><th>ליטרים בנזין</th><th>סה"כ</th><th>שורות</th></tr></thead>
                <tbody>
                  {invoices.map(inv=>(
                    <tr key={inv.id} style={{cursor:'pointer',background:selected?.id===inv.id?'#eff6ff':''}} onClick={()=>loadInvoice(inv.id)}>
                      <td style={{fontWeight:600}}>{inv.period}</td>
                      <td>{inv.supplier}</td>
                      <td>{fmtDate(inv.invoice_date)}</td>
                      <td>{inv.total_liters_diesel?.toLocaleString()} ל'</td>
                      <td>{inv.total_liters_petrol?.toLocaleString()} ל'</td>
                      <td style={{fontWeight:600}}>{fmtCur(inv.total_amount)}</td>
                      <td><span className="badge badge-blue">{inv.line_count} רשומות</span></td>
                    </tr>
                  ))}
                  {invoices.length===0 && <tr><td colSpan={7} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין חשבוניות</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {selected && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">פירוט — {selected.supplier} {selected.period}</span>
                <button className="btn btn-secondary btn-sm" onClick={()=>setSelected(null)}>×</button>
              </div>
              <div className="table-wrap" style={{maxHeight:500,overflowY:'auto'}}>
                <table>
                  <thead><tr><th>רכב</th><th>סוג דלק</th><th>ליטרים</th><th>סכום</th><th>מזוהה?</th></tr></thead>
                  <tbody>
                    {selected.lines?.map(l=>{
                      const v = vMap[l.vehicle_id];
                      return (
                        <tr key={l.id}>
                          <td style={{fontWeight:600}}>{l.vehicle_number_raw}{v&&v.nickname?` (${v.nickname})`:''}</td>
                          <td>{l.fuel_type}</td>
                          <td>{l.liters?.toLocaleString()} ל'</td>
                          <td>{fmtCur(l.amount)}</td>
                          <td>{l.vehicle_id ? <span className="badge badge-green">✓</span> : <span className="badge badge-red">לא מזוהה</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{padding:'10px 16px',borderTop:'1px solid #e5e7eb',fontSize:13,color:'#6b7280'}}>
                סה"כ: {fmtCur(selected.total_amount)} | סולר: {selected.total_liters_diesel?.toLocaleString()} ל' | בנזין: {selected.total_liters_petrol?.toLocaleString()} ל'
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'כרטיסי דלק' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">כרטיסי דלק ({cards.length})</span>
            {user.role==='admin' && <button className="btn btn-primary btn-sm" onClick={openAddCard}>+ הוסף כרטיס</button>}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>מספר כרטיס</th><th>ספק</th><th>סוג</th><th>רכב / עובד</th>
                  <th>סוג דלק</th><th>קוד שירות</th><th>סטטוס</th>
                  <th>הגבלה יומית</th><th>הגבלה חודשית</th>
                  {user.role==='admin' && <th></th>}
                </tr>
              </thead>
              <tbody>
                {cards.map(c=>(
                  <tr key={c.id}>
                    <td style={{fontWeight:600}}>{c.card_number}</td>
                    <td>{c.supplier}</td>
                    <td>
                      <span className={`badge ${c.card_type==='Master'?'badge-blue':'badge-gray'}`}>{c.card_type||'דלק'}</span>
                    </td>
                    <td style={{fontSize:12}}>
                      {c.vehicle_number
                        ? <span style={{color:'#1e40af',fontWeight:600}}>🚗 {c.vehicle_number}{c.nickname?` (${c.nickname})`:''}</span>
                        : c.employee_name
                        ? <span style={{color:'#7c3aed',fontWeight:600}}>👤 {c.employee_name}</span>
                        : <span style={{color:'#9ca3af'}}>— ללא שיוך</span>
                      }
                    </td>
                    <td>{c.fuel_type}</td>
                    <td style={{fontSize:12,color:'#6b7280'}}>{c.service_code||'—'}</td>
                    <td><span className={`badge ${c.status==='פעיל'?'badge-green':c.status==='חסום'?'badge-red':'badge-gray'}`}>{c.status}</span></td>
                    <td>{fmtCur(c.daily_limit)}</td>
                    <td>{fmtCur(c.monthly_limit)}</td>
                    {user.role==='admin' && (
                      <td>
                        <button className="btn btn-secondary btn-sm" onClick={()=>openEditCard(c)} style={{marginLeft:4}}>✏️</button>
                        <button className="btn btn-danger btn-sm" onClick={()=>delCard(c)}>🗑️</button>
                      </td>
                    )}
                  </tr>
                ))}
                {cards.length===0 && <tr><td colSpan={10} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין כרטיסי דלק</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Card Modal ── */}
      {showCardModal && (
        <div className="modal-overlay" onClick={()=>setShowCardModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editCard?'עריכת כרטיס דלק':'הוספת כרטיס דלק'}</span>
              <button className="modal-close" onClick={()=>setShowCardModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label className="form-label">מספר כרטיס</label>
                  <input className="form-control" value={cardForm.card_number||''} onChange={e=>setCardForm(f=>({...f,card_number:e.target.value}))}/>
                </div>
                <div className="form-group"><label className="form-label">ספק</label>
                  <input className="form-control" list="fuel-suppliers-list" value={cardForm.supplier||''} onChange={e=>setCardForm(f=>({...f,supplier:e.target.value}))}/>
                  <datalist id="fuel-suppliers-list">{['פז','דלק','סונול','Ten','אחר'].map(v=><option key={v} value={v}/>)}</datalist>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">סוג כרטיס</label>
                  <select className="form-control" value={cardForm.card_type||'דלק'} onChange={e=>setCardForm(f=>({...f,card_type:e.target.value}))}>
                    {CARD_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">סוג דלק</label>
                  <select className="form-control" value={cardForm.fuel_type||''} onChange={e=>setCardForm(f=>({...f,fuel_type:e.target.value}))}>
                    {FUEL_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">רכב <span style={{fontSize:11,color:'#6b7280'}}>(אופציונלי)</span></label>
                  <select className="form-control" value={cardForm.vehicle_id||''} onChange={e=>setCardForm(f=>({...f,vehicle_id:+e.target.value||null,employee_id:null}))}>
                    <option value="">ללא רכב</option>
                    {vehicles.map(v=><option key={v.id} value={v.id}>{v.vehicle_number}{v.nickname?` (${v.nickname})`:''}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">עובד <span style={{fontSize:11,color:'#6b7280'}}>(אם אין רכב)</span></label>
                  <select className="form-control" value={cardForm.employee_id||''} onChange={e=>setCardForm(f=>({...f,employee_id:+e.target.value||null}))} disabled={!!cardForm.vehicle_id}>
                    <option value="">ללא עובד</option>
                    {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">קוד שירות</label>
                  <input className="form-control" placeholder="קוד שירות (אופציונלי)" value={cardForm.service_code||''} onChange={e=>setCardForm(f=>({...f,service_code:e.target.value}))}/>
                </div>
                <div className="form-group"><label className="form-label">סטטוס</label>
                  <select className="form-control" value={cardForm.status||'פעיל'} onChange={e=>setCardForm(f=>({...f,status:e.target.value}))}>
                    {['פעיל','לא פעיל','חסום'].map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">הגבלה יומית (₪)</label>
                  <input className="form-control" type="number" value={cardForm.daily_limit??''} onChange={e=>setCardForm(f=>({...f,daily_limit:e.target.value===''?null:+e.target.value}))}/>
                </div>
                <div className="form-group"><label className="form-label">הגבלה חודשית (₪)</label>
                  <input className="form-control" type="number" value={cardForm.monthly_limit??''} onChange={e=>setCardForm(f=>({...f,monthly_limit:e.target.value===''?null:+e.target.value}))}/>
                </div>
              </div>
              <div className="form-group"><label className="form-label">הערות</label>
                <textarea className="form-control" rows={2} value={cardForm.notes||''} onChange={e=>setCardForm(f=>({...f,notes:e.target.value}))}/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={saveCard} disabled={cardSaving}>{cardSaving?'שומר...':'שמור'}</button>
              <button className="btn btn-secondary" onClick={()=>setShowCardModal(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {showAddInvoice && (
        <div className="modal-overlay" onClick={()=>setShowAddInvoice(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">הוספת חשבונית דלק</span>
              <button className="modal-close" onClick={()=>setShowAddInvoice(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label className="form-label">ספק</label><input className="form-control" value={form.supplier||''} onChange={e=>f('supplier',e.target.value)}/></div>
                <div className="form-group"><label className="form-label">תקופה (YYYY-MM)</label><input className="form-control" placeholder="2025-12" value={form.period||''} onChange={e=>f('period',e.target.value)}/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">תאריך חשבונית</label><input className="form-control" type="date" value={form.invoice_date||''} onChange={e=>f('invoice_date',e.target.value)}/></div>
                <div className="form-group"><label className="form-label">סה"כ (₪)</label><input className="form-control" type="number" value={form.total_amount||''} onChange={e=>f('total_amount',+e.target.value)}/></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">ליטרים סולר</label><input className="form-control" type="number" value={form.total_liters_diesel||''} onChange={e=>f('total_liters_diesel',+e.target.value)}/></div>
                <div className="form-group"><label className="form-label">ליטרים בנזין</label><input className="form-control" type="number" value={form.total_liters_petrol||''} onChange={e=>f('total_liters_petrol',+e.target.value)}/></div>
              </div>
              <div className="form-group"><label className="form-label">הערות</label><textarea className="form-control" rows={2} value={form.notes||''} onChange={e=>f('notes',e.target.value)}/></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={saveInvoice} disabled={saving}>{saving?'שומר...':'שמור'}</button>
              <button className="btn btn-secondary" onClick={()=>setShowAddInvoice(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
