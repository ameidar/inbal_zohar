import React, { useState, useEffect, useRef } from 'react';
import { api } from '../api/client';

function fmtCur(n) { return n != null ? `₪${Number(n).toLocaleString('he-IL', {minimumFractionDigits:0,maximumFractionDigits:0})}` : '—'; }

export default function PolicyMonthlySummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('coverage'); // coverage | payment | detail
  const printRef = useRef();

  useEffect(() => {
    api.insuranceMonthlySummary().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  function exportCSV() {
    if (!data) return;
    const rows = data.policies.map(p => [
      p.vehicle_number || '',
      p.nickname || '',
      p.coverage_type || '',
      p.insurer || '',
      p.policy_number || '',
      p.total_premium || '',
      p.num_payments || '',
      p.monthly_cost || '',
      p.payment_method_name || '',
    ]);
    const header = ['מספר רכב','כינוי','סוג כיסוי','חברת ביטוח','מספר פוליסה','פרמיה כוללת','תשלומים','חודשי','אמצעי תשלום'];
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'דוח-פוליסות-חודשי.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    window.print();
  }

  if (loading) return <div style={{padding:32,textAlign:'center'}}>טוען...</div>;
  if (!data) return <div style={{padding:32,color:'#dc2626'}}>שגיאה בטעינת נתונים</div>;

  return (
    <div ref={printRef}>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 12px; }
          .card { break-inside: avoid; }
        }
      `}</style>

      {/* Header */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
        <div>
          <h2 style={{fontSize:20, fontWeight:800, margin:0}}>📊 דשבורד עלויות פוליסות</h2>
          <p style={{margin:'4px 0 0', color:'#64748b', fontSize:13}}>{data.activeCount} פוליסות פעילות</p>
        </div>
        <div style={{display:'flex', gap:8}} className="no-print">
          <button className="btn btn-secondary" onClick={exportCSV}>📥 Excel (CSV)</button>
          <button className="btn btn-secondary" onClick={exportPDF}>🖨️ PDF</button>
        </div>
      </div>

      {/* KPI Banner */}
      <div style={{display:'flex', gap:12, marginBottom:24, flexWrap:'wrap'}}>
        <div className="card" style={{flex:'0 0 auto', padding:'16px 24px', background:'#f0fdf4', border:'2px solid #86efac', minWidth:200}}>
          <div style={{fontSize:12, color:'#15803d', fontWeight:700, marginBottom:4}}>💰 סה"כ עלות חודשית</div>
          <div style={{fontSize:28, fontWeight:900, color:'#166534'}}>{fmtCur(data.total)}</div>
          <div style={{fontSize:11, color:'#6b7280', marginTop:2}}>מ-{data.activeCount} פוליסות פעילות</div>
        </div>
        <div className="card" style={{flex:'0 0 auto', padding:'16px 24px', background:'#eff6ff', border:'1px solid #bfdbfe', minWidth:180}}>
          <div style={{fontSize:12, color:'#1d4ed8', fontWeight:700, marginBottom:4}}>📋 סוגי כיסוי</div>
          <div style={{fontSize:22, fontWeight:800, color:'#1e40af'}}>{data.byCoverage.length}</div>
        </div>
        <div className="card" style={{flex:'0 0 auto', padding:'16px 24px', background:'#faf5ff', border:'1px solid #e9d5ff', minWidth:180}}>
          <div style={{fontSize:12, color:'#7c3aed', fontWeight:700, marginBottom:4}}>💳 אמצעי תשלום</div>
          <div style={{fontSize:22, fontWeight:800, color:'#6d28d9'}}>{data.byPayment.length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex', gap:4, marginBottom:16}} className="no-print">
        {[{k:'coverage',l:'לפי סוג כיסוי'},{k:'payment',l:'לפי אמצעי תשלום'},{k:'detail',l:'פירוט פוליסות'}].map(({k,l})=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{padding:'6px 16px', borderRadius:6, border:'1px solid #e2e8f0', fontWeight:600, fontSize:13,
              background: tab===k ? '#1e40af' : '#fff', color: tab===k ? '#fff' : '#374151', cursor:'pointer'}}>
            {l}
          </button>
        ))}
      </div>

      {/* Tab: By Coverage Type */}
      {(tab === 'coverage' || tab === 'print') && (
        <div className="card" style={{marginBottom:20}}>
          <div className="card-header"><span className="card-title">📋 עלות חודשית לפי סוג כיסוי</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>סוג כיסוי</th><th>מספר פוליסות</th><th>עלות חודשית</th><th>% מהסה"כ</th></tr></thead>
              <tbody>
                {data.byCoverage.map(r => (
                  <tr key={r.coverage_type}>
                    <td style={{fontWeight:600}}>{r.coverage_type}</td>
                    <td>{r.count}</td>
                    <td style={{fontWeight:700, color:'#15803d'}}>{fmtCur(r.monthly_cost)}</td>
                    <td>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <div style={{flex:1, background:'#e2e8f0', borderRadius:4, height:8, overflow:'hidden'}}>
                          <div style={{width:`${Math.round(r.monthly_cost/data.total*100)}%`, background:'#3b82f6', height:'100%'}}/>
                        </div>
                        <span style={{fontSize:12, color:'#64748b', minWidth:36}}>{Math.round(r.monthly_cost/data.total*100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr style={{background:'#f0fdf4', fontWeight:800}}>
                  <td>סה"כ</td><td>{data.activeCount}</td><td style={{color:'#166534'}}>{fmtCur(data.total)}</td><td>100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: By Payment Method */}
      {(tab === 'payment' || tab === 'print') && (
        <div className="card" style={{marginBottom:20}}>
          <div className="card-header"><span className="card-title">💳 עלות חודשית לפי אמצעי תשלום</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>אמצעי תשלום</th><th>סוג</th><th>מספר פוליסות</th><th>עלות חודשית</th><th>% מהסה"כ</th></tr></thead>
              <tbody>
                {data.byPayment.map(r => (
                  <tr key={r.payment_method}>
                    <td style={{fontWeight:600}}>{r.payment_method}</td>
                    <td><span style={{background:'#e0f2fe',color:'#0369a1',padding:'2px 8px',borderRadius:12,fontSize:12}}>{r.payment_type}</span></td>
                    <td>{r.count}</td>
                    <td style={{fontWeight:700, color:'#7c3aed'}}>{fmtCur(r.monthly_cost)}</td>
                    <td>
                      <div style={{display:'flex', alignItems:'center', gap:8}}>
                        <div style={{flex:1, background:'#e2e8f0', borderRadius:4, height:8, overflow:'hidden'}}>
                          <div style={{width:`${Math.round(r.monthly_cost/data.total*100)}%`, background:'#8b5cf6', height:'100%'}}/>
                        </div>
                        <span style={{fontSize:12, color:'#64748b', minWidth:36}}>{Math.round(r.monthly_cost/data.total*100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                <tr style={{background:'#faf5ff', fontWeight:800}}>
                  <td colSpan={3}>סה"כ</td><td style={{color:'#6d28d9'}}>{fmtCur(data.total)}</td><td>100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Detail */}
      {tab === 'detail' && (
        <div className="card">
          <div className="card-header"><span className="card-title">🔍 פירוט כל הפוליסות הפעילות</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>רכב</th><th>סוג כיסוי</th><th>מבטח</th><th>מספר פוליסה</th><th>פרמיה כוללת</th><th>תשלומים</th><th>חודשי</th><th>אמצעי תשלום</th></tr></thead>
              <tbody>
                {data.policies.map(p => (
                  <tr key={p.id}>
                    <td style={{fontWeight:600}}>{p.vehicle_number}{p.nickname ? ` (${p.nickname})` : ''}</td>
                    <td>{p.coverage_type}</td>
                    <td style={{fontSize:12}}>{p.insurer}</td>
                    <td style={{fontSize:12}}>{p.policy_number}</td>
                    <td>{fmtCur(p.total_premium)}</td>
                    <td style={{textAlign:'center'}}>{p.num_payments}</td>
                    <td style={{fontWeight:700, color:'#15803d'}}>{fmtCur(p.monthly_cost)}</td>
                    <td style={{fontSize:12}}>
                      <span style={{background:'#e0f2fe',color:'#0369a1',padding:'2px 8px',borderRadius:12}}>
                        {p.payment_method_name || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr style={{background:'#f0fdf4', fontWeight:800}}>
                  <td colSpan={6} style={{textAlign:'left'}}>סה"כ</td>
                  <td style={{color:'#166534'}}>{fmtCur(data.total)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
