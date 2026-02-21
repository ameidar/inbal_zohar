import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }
function fmtCur(n) { return n != null ? `₪${Number(n).toLocaleString('he-IL')}` : '—'; }

export default function Fuel() {
  const [invoices, setInvoices] = useState([]);
  const [cards, setCards] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [tab, setTab] = useState('חשבוניות');
  const [selected, setSelected] = useState(null);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');

  async function load() {
    const [inv, c, v] = await Promise.all([
      api.fuelInvoices().catch(()=>[]),
      api.fuelCards().catch(()=>[]),
      api.vehicles().catch(()=>[])
    ]);
    setInvoices(inv); setCards(c); setVehicles(v);
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
          <div className="card-header"><span className="card-title">כרטיסי דלק ({cards.length})</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>מספר כרטיס</th><th>ספק</th><th>רכב</th><th>סוג דלק</th><th>סטטוס</th><th>הגבלה יומית</th><th>הגבלה חודשית</th></tr></thead>
              <tbody>
                {cards.map(c=>(
                  <tr key={c.id}>
                    <td style={{fontWeight:600}}>{c.card_number}</td>
                    <td>{c.supplier}</td>
                    <td>{c.vehicle_number ? `${c.vehicle_number}${c.nickname?` (${c.nickname})`:'' }` : '—'}</td>
                    <td>{c.fuel_type}</td>
                    <td><span className={`badge ${c.status==='פעיל'?'badge-green':c.status==='חסום'?'badge-red':'badge-gray'}`}>{c.status}</span></td>
                    <td>{fmtCur(c.daily_limit)}</td>
                    <td>{fmtCur(c.monthly_limit)}</td>
                  </tr>
                ))}
                {cards.length===0 && <tr><td colSpan={7} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין כרטיסי דלק</td></tr>}
              </tbody>
            </table>
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
