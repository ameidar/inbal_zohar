import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

function fmtLiters(n) { return n ? `${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 1 })} ל'` : '—'; }
function fmtCur(n) { return n != null ? `₪${Number(n).toLocaleString('he-IL', { maximumFractionDigits: 0 })}` : '—'; }
function prevMonths(n = 2) {
  const months = [];
  const d = new Date();
  for (let i = n; i >= 1; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    months.push(`${m.getFullYear()}-${String(m.getMonth()+1).padStart(2,'0')}`);
  }
  return months;
}

export default function DieselReports() {
  const [tab, setTab] = useState('צריכה');
  const [consumption, setConsumption] = useState([]);
  const [byPeriod, setByPeriod] = useState([]);
  const [refunds, setRefunds] = useState({ rows: [], summary: [] });
  const [eligible, setEligible] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    from: prevMonths(6)[0],
    to: new Date().toISOString().slice(0,7),
    status: '',
    vehicle_id: '',
  });

  async function load() {
    setLoading(true);
    try {
      const token = localStorage.getItem('fleet_token');
      const h = { Authorization: `Bearer ${token}` };
      const base = '/api';
      const qs = `?from=${filters.from}&to=${filters.to}`;
      const [c, bp, r, e] = await Promise.all([
        fetch(`${base}/reports/diesel-consumption${qs}`, {headers:h}).then(r=>r.json()),
        fetch(`${base}/reports/diesel-by-period${qs}`, {headers:h}).then(r=>r.json()),
        fetch(`${base}/reports/diesel-refunds?from=${filters.from}&to=${filters.to}${filters.status?'&status='+filters.status:''}`, {headers:h}).then(r=>r.json()),
        fetch(`${base}/reports/diesel-eligible`, {headers:h}).then(r=>r.json()),
      ]);
      setConsumption(Array.isArray(c) ? c : []);
      setByPeriod(Array.isArray(bp) ? bp : []);
      setRefunds(r && r.rows ? r : { rows: [], summary: [] });
      setEligible(Array.isArray(e) ? e : []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filters.from, filters.to, filters.status]);

  const totalLiters = consumption.reduce((s,r) => s + parseFloat(r.total_liters||0), 0);
  const totalAmount = consumption.reduce((s,r) => s + parseFloat(r.total_amount||0), 0);
  const refundEligibleLiters = consumption.filter(r=>r.eligible_diesel_refund).reduce((s,r)=>s+parseFloat(r.total_liters||0),0);

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ margin:0 }}>⛽ דוחות סולר</h2>
      </div>

      {/* Period filter */}
      <div style={{ display:'flex', gap:10, marginBottom:16, background:'#f8f9fa', padding:12, borderRadius:8, flexWrap:'wrap', alignItems:'center' }}>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <span style={{fontSize:12,color:'#6b7280'}}>מ-</span>
          <input className="form-control" type="month" style={{width:140}} value={filters.from} onChange={e=>setFilters(f=>({...f,from:e.target.value}))}/>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:4}}>
          <span style={{fontSize:12,color:'#6b7280'}}>עד</span>
          <input className="form-control" type="month" style={{width:140}} value={filters.to} onChange={e=>setFilters(f=>({...f,to:e.target.value}))}/>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={()=>setFilters(f=>({...f,from:prevMonths(2)[0]}))}>2 חודשים</button>
        <button className="btn btn-secondary btn-sm" onClick={()=>setFilters(f=>({...f,from:prevMonths(6)[0]}))}>6 חודשים</button>
        <button className="btn btn-secondary btn-sm" onClick={()=>setFilters(f=>({...f,from:`${new Date().getFullYear()}-01`}))}>השנה</button>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:20 }}>
        {[
          { label:'סה"כ סולר', value:fmtLiters(totalLiters), color:'#0369a1', bg:'#e0f2fe' },
          { label:'עלות כוללת', value:fmtCur(totalAmount), color:'#7c3aed', bg:'#ede9fe' },
          { label:'זכאי להחזר', value:fmtLiters(refundEligibleLiters), color:'#15803d', bg:'#dcfce7' },
          { label:'רכבים', value:consumption.length, color:'#374151', bg:'#f3f4f6' },
        ].map(c=>(
          <div key={c.label} style={{ background:c.bg, borderRadius:10, padding:'12px 16px' }}>
            <div style={{ fontSize:11, color:c.color, fontWeight:600, marginBottom:4 }}>{c.label}</div>
            <div style={{ fontSize:20, fontWeight:700, color:c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom:16 }}>
        {['צריכה','לפי תקופה','החזרים','זכאים'].map(t=>(
          <div key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t}</div>
        ))}
      </div>

      {loading ? <p>טוען...</p> : <>

        {/* Tab: צריכה */}
        {tab === 'צריכה' && (
          <div className="card">
            <div className="card-header"><span className="card-title">צריכת סולר לפי רכב ({consumption.length})</span></div>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>מספר רכב</th><th>כינוי</th><th>ליטרים</th><th>עלות</th><th>תקופות</th><th>זכאי החזר</th>
                </tr></thead>
                <tbody>
                  {consumption.map(r=>(
                    <tr key={r.vehicle_id}>
                      <td style={{fontWeight:600}}>{r.vehicle_number}</td>
                      <td>{r.nickname||'—'}</td>
                      <td>{fmtLiters(r.total_liters)}</td>
                      <td>{fmtCur(r.total_amount)}</td>
                      <td style={{fontSize:11,color:'#6b7280'}}>{r.periods||'—'}</td>
                      <td>{r.eligible_diesel_refund?<span className="badge badge-green">כן ✅</span>:<span className="badge badge-gray">לא</span>}</td>
                    </tr>
                  ))}
                  {consumption.length===0 && <tr><td colSpan={6} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין נתונים לתקופה זו</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: לפי תקופה */}
        {tab === 'לפי תקופה' && (
          <div className="card">
            <div className="card-header"><span className="card-title">צריכה דו-חודשית לפי רכב ותקופה</span></div>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <th>תקופה</th><th>מספר רכב</th><th>כינוי</th><th>ליטרים</th><th>עלות</th><th>זכאי</th>
                </tr></thead>
                <tbody>
                  {byPeriod.map((r,i)=>(
                    <tr key={i}>
                      <td style={{fontWeight:600,color:'#1e40af'}}>{r.period}</td>
                      <td>{r.vehicle_number}</td>
                      <td>{r.nickname||'—'}</td>
                      <td>{fmtLiters(r.liters)}</td>
                      <td>{fmtCur(r.amount)}</td>
                      <td>{r.eligible_diesel_refund?'✅':'—'}</td>
                    </tr>
                  ))}
                  {byPeriod.length===0 && <tr><td colSpan={6} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין נתונים</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: החזרים */}
        {tab === 'החזרים' && (
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:16,alignItems:'start'}}>
            <div className="card">
              <div className="card-header">
                <span className="card-title">רשומות החזר סולר ({refunds.rows.length})</span>
                <select className="form-control" style={{width:'auto',fontSize:12}} value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))}>
                  <option value="">כל הסטטוסים</option>
                  {['יופצ','הוגש','התקבל','בוטל'].map(s=><option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>רכב</th><th>תקופה</th><th>ליטרים</th><th>סכום</th><th>סטטוס</th><th>תאריך הגשה</th></tr></thead>
                  <tbody>
                    {refunds.rows.map(r=>(
                      <tr key={r.id}>
                        <td style={{fontWeight:600}}>{r.vehicle_number}</td>
                        <td>{r.period}</td>
                        <td>{fmtLiters(r.liters)}</td>
                        <td>{fmtCur(r.amount)}</td>
                        <td><span className={`badge ${r.refund_status==='התקבל'?'badge-green':r.refund_status==='הוגש'?'badge-blue':'badge-gray'}`}>{r.refund_status}</span></td>
                        <td style={{fontSize:12}}>{r.submission_date?new Date(r.submission_date).toLocaleDateString('he-IL'):'—'}</td>
                      </tr>
                    ))}
                    {refunds.rows.length===0 && <tr><td colSpan={6} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין נתונים</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">סיכום לפי רכב</span></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>רכב</th><th>ליטרים</th><th>סכום</th><th>התקבל</th></tr></thead>
                  <tbody>
                    {refunds.summary.map((r,i)=>(
                      <tr key={i}>
                        <td style={{fontWeight:600}}>{r.vehicle_number}</td>
                        <td>{fmtLiters(r.total_liters)}</td>
                        <td>{fmtCur(r.total_amount)}</td>
                        <td style={{textAlign:'center'}}>{r.received_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab: זכאים */}
        {tab === 'זכאים' && (
          <div className="card">
            <div className="card-header"><span className="card-title">רכבים זכאים להחזר סולר ({eligible.length})</span></div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>מספר רכב</th><th>כינוי</th><th>סוג דלק</th><th>סה"כ ליטרים</th><th>סה"כ עלות</th><th>החזרים שהתקבלו</th></tr></thead>
                <tbody>
                  {eligible.map(r=>(
                    <tr key={r.id}>
                      <td style={{fontWeight:600}}>{r.vehicle_number}</td>
                      <td>{r.nickname||'—'}</td>
                      <td>{r.fuel_type}</td>
                      <td style={{color:'#0369a1',fontWeight:600}}>{fmtLiters(r.total_liters_all_time)}</td>
                      <td>{fmtCur(r.total_amount_all_time)}</td>
                      <td style={{color:'#15803d',fontWeight:600}}>{fmtCur(r.total_refunds_received)}</td>
                    </tr>
                  ))}
                  {eligible.length===0 && <tr><td colSpan={6} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין רכבים מסומנים כזכאי החזר סולר</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>}
    </div>
  );
}
