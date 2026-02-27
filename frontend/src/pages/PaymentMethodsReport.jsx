import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

function fmtAmount(n) { return n ? Number(n).toLocaleString('he-IL', { style: 'currency', currency: 'ILS' }) : '₪0'; }

function fmtMonthHe(m) {
  if (!m) return '—';
  const [y, mo] = m.split('-');
  const months = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  return `${months[parseInt(mo) - 1]} ${y}`;
}

export default function PaymentMethodsReport() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getPaymentScheduleSummary()
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Group by charge_month
  const byMonth = {};
  for (const row of rows) {
    if (!byMonth[row.charge_month]) byMonth[row.charge_month] = [];
    byMonth[row.charge_month].push(row);
  }
  const months = Object.keys(byMonth).sort().reverse();

  function drillTo(month, pmId) {
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    if (pmId) params.set('paymentMethodId', pmId);
    navigate('/dept/vehicles/policies/payments?' + params.toString());
  }

  if (loading) return <p>טוען...</p>;

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>📊 דוח לפי אמצעי תשלום</h2>

      {months.length === 0 && <p style={{ color: '#9ca3af' }}>אין נתונים. הוסף פריטים בלוח התשלומים.</p>}

      {months.map(month => {
        const monthRows = byMonth[month];
        const monthTotal = monthRows.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0);

        return (
          <div key={month} style={{ marginBottom: 24, border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: '#f8f9fa', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{fmtMonthHe(month)}</h3>
              <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 15 }}>סה"כ: {fmtAmount(monthTotal)}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>אמצעי תשלום</th>
                  <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>פריטים</th>
                  <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>שולמו</th>
                  <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600 }}>סה"כ</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => drillTo(month, row.payment_method_id)}
                    style={{ cursor: 'pointer', borderTop: '1px solid #f1f5f9' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8f9fa'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{row.payment_method_name || 'לא מוגדר'}</td>
                    <td style={{ padding: '10px 16px', color: '#6b7280' }}>{row.item_count}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ color: '#15803d' }}>{row.paid_count}</span>
                      <span style={{ color: '#9ca3af' }}> / {row.item_count}</span>
                    </td>
                    <td style={{ padding: '10px 16px', fontWeight: 700, color: 'var(--primary)' }}>{fmtAmount(row.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
