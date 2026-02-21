import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }
function fmtCur(n) { return n != null ? `₪${Number(n).toLocaleString('he-IL')}` : '—'; }

const HEB_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

export default function Finance() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('insurance');

  async function load(y, m) {
    setLoading(true);
    try {
      const res = await api.get(`/dashboard/monthly?year=${y}&month=${m}`);
      setData(res);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(year, month); }, [year, month]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const totalExpected = data?.summary?.insurance_expected || 0;
  const totalPaid = data?.summary?.insurance_paid || 0;
  const totalFuel = data?.summary?.fuel_total || 0;
  const totalMaint = data?.summary?.maintenance_total || 0;
  const grandTotal = totalExpected + totalFuel + totalMaint;

  const insPayments = data?.insurance_payments || [];
  const fuelInvoices = data?.fuel_invoices || [];
  const maintCosts = data?.maintenance_costs || [];

  // Group insurance payments by coverage type for summary
  const insByType = {};
  insPayments.forEach(p => {
    const key = p.coverage_type;
    if (!insByType[key]) insByType[key] = { count: 0, total: 0 };
    insByType[key].count++;
    insByType[key].total += parseFloat(p.expected_amount) || 0;
  });

  return (
    <div>
      {/* Month navigation */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
        <button className="btn btn-secondary" onClick={prevMonth}>→</button>
        <h2 style={{ fontSize:20, fontWeight:700, margin:0 }}>
          💰 כספים — {HEB_MONTHS[month-1]} {year}
        </h2>
        <button className="btn btn-secondary" onClick={nextMonth} disabled={year === now.getFullYear() && month >= now.getMonth() + 1}>←</button>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:16, marginBottom:24 }}>
        <div className="card" style={{ padding:16, background:'#eff6ff', border:'1px solid #bfdbfe' }}>
          <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>ביטוח — לחיוב</div>
          <div style={{ fontSize:22, fontWeight:700, color:'#1e40af' }}>{fmtCur(totalExpected)}</div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>{insPayments.length} תשלומים</div>
        </div>
        <div className="card" style={{ padding:16, background:'#f0fdf4', border:'1px solid #bbf7d0' }}>
          <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>ביטוח — שולם</div>
          <div style={{ fontSize:22, fontWeight:700, color:'#15803d' }}>{fmtCur(totalPaid)}</div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>
            {insPayments.filter(p => p.status !== 'פתוח').length} מתוך {insPayments.length}
          </div>
        </div>
        <div className="card" style={{ padding:16, background:'#fef9c3', border:'1px solid #fde68a' }}>
          <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>דלק</div>
          <div style={{ fontSize:22, fontWeight:700, color:'#b45309' }}>{fmtCur(totalFuel)}</div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>{fuelInvoices.length} חשבוניות</div>
        </div>
        <div className="card" style={{ padding:16, background:'#fdf2f8', border:'1px solid #f9a8d4' }}>
          <div style={{ fontSize:12, color:'#6b7280', marginBottom:4 }}>טיפולים</div>
          <div style={{ fontSize:22, fontWeight:700, color:'#9d174d' }}>{fmtCur(totalMaint)}</div>
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>{maintCosts.length} טיפולים</div>
        </div>
      </div>

      {/* Grand total bar */}
      <div className="card" style={{ padding:'12px 20px', marginBottom:24, display:'flex', alignItems:'center', justifyContent:'space-between', background:'#f8fafc' }}>
        <span style={{ fontWeight:600, color:'#374151' }}>סה"כ הוצאות צפויות החודש</span>
        <span style={{ fontSize:22, fontWeight:700, color:'#111827' }}>{fmtCur(grandTotal)}</span>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:16, borderBottom:'2px solid #e5e7eb', paddingBottom:0 }}>
        {[
          { key:'insurance', label:`🛡️ ביטוח (${insPayments.length})` },
          { key:'fuel', label:`⛽ דלק (${fuelInvoices.length})` },
          { key:'maintenance', label:`🔧 טיפולים (${maintCosts.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{ padding:'8px 18px', border:'none', cursor:'pointer', fontWeight:activeTab===t.key?700:400,
              borderBottom: activeTab===t.key ? '3px solid #2563eb' : '3px solid transparent',
              color: activeTab===t.key ? '#2563eb' : '#6b7280',
              background:'transparent', fontSize:14, marginBottom:-2 }}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div style={{ textAlign:'center', padding:40, color:'#9ca3af' }}>טוען...</div>}

      {!loading && activeTab === 'insurance' && (
        <div className="card">
          {/* Type summary */}
          {Object.keys(insByType).length > 0 && (
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #f0f0f0', display:'flex', gap:16, flexWrap:'wrap' }}>
              {Object.entries(insByType).map(([type, val]) => (
                <div key={type} style={{ background:'#f8fafc', padding:'6px 12px', borderRadius:8, fontSize:13 }}>
                  <strong>{type}</strong>: {val.count} תשלומים | {fmtCur(val.total)}
                </div>
              ))}
            </div>
          )}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>רכב</th><th>מספר פוליסה</th><th>כיסוי</th><th>מבטח</th>
                  <th>תאריך חיוב</th><th>סכום</th><th>שיטת תשלום</th><th>סטטוס</th>
                </tr>
              </thead>
              <tbody>
                {insPayments.map(p => (
                  <tr key={p.id} style={{ background: p.status === 'פתוח' && new Date(p.charge_date) < new Date() ? '#fef2f2' : '' }}>
                    <td style={{ fontWeight:600, color:'#1e40af' }}>
                      {p.vehicle_number}{p.nickname ? ` (${p.nickname})` : ''}
                    </td>
                    <td style={{ fontSize:12 }}>{p.policy_number}</td>
                    <td>{p.coverage_type}</td>
                    <td style={{ fontSize:12 }}>{p.insurer}</td>
                    <td style={{ fontSize:12, color: p.status === 'פתוח' && new Date(p.charge_date) < new Date() ? '#dc2626' : '' }}>
                      {fmtDate(p.charge_date)}
                    </td>
                    <td style={{ fontWeight:600 }}>{fmtCur(p.expected_amount)}</td>
                    <td style={{ fontSize:12 }}>{p.payment_method_name || '—'}</td>
                    <td>
                      <span className={`badge ${p.status === 'שולם' ? 'badge-green' : p.status === 'שולם באיחור' ? 'badge-yellow' : 'badge-blue'}`}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {insPayments.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign:'center', color:'#9ca3af', padding:24 }}>אין תשלומי ביטוח בחודש זה</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && activeTab === 'fuel' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>ספק</th><th>תקופה</th><th>סה"כ</th><th>נוצר</th></tr></thead>
              <tbody>
                {fuelInvoices.map(f => (
                  <tr key={f.id}>
                    <td style={{ fontWeight:600 }}>{f.supplier || '—'}</td>
                    <td>{f.period}</td>
                    <td style={{ fontWeight:700, color:'#b45309' }}>{fmtCur(f.total_amount)}</td>
                    <td style={{ fontSize:12 }}>{fmtDate(f.created_at)}</td>
                  </tr>
                ))}
                {fuelInvoices.length === 0 && (
                  <tr><td colSpan={4} style={{ textAlign:'center', color:'#9ca3af', padding:24 }}>אין חשבוניות דלק בחודש זה</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && activeTab === 'maintenance' && (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>רכב</th><th>תאריך</th><th>סוג טיפול</th><th>מוסך</th><th>עלות</th></tr></thead>
              <tbody>
                {maintCosts.map(m => (
                  <tr key={m.id}>
                    <td style={{ fontWeight:600 }}>{m.vehicle_number}{m.nickname ? ` (${m.nickname})` : ''}</td>
                    <td style={{ fontSize:12 }}>{fmtDate(m.maintenance_date)}</td>
                    <td>{m.maintenance_type}</td>
                    <td style={{ fontSize:12 }}>{m.garage_name || '—'}</td>
                    <td style={{ fontWeight:700, color:'#9d174d' }}>{fmtCur(m.cost)}</td>
                  </tr>
                ))}
                {maintCosts.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign:'center', color:'#9ca3af', padding:24 }}>אין טיפולים מתועדים בחודש זה</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
