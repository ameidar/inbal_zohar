import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api/client';

const STATUSES = ['Planned', 'Charged', 'Paid', 'Cancelled'];
const STATUS_HE = { Planned: 'מתוכנן', Charged: 'חויב', Paid: 'שולם', Cancelled: 'בוטל' };
const STATUS_COLOR = {
  Planned: { bg: '#eff6ff', c: '#1d4ed8' },
  Charged: { bg: '#fef3c7', c: '#d97706' },
  Paid: { bg: '#dcfce7', c: '#15803d' },
  Cancelled: { bg: '#fee2e2', c: '#dc2626' },
};

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }
function fmtAmount(n) { return n ? Number(n).toLocaleString('he-IL', { style: 'currency', currency: 'ILS' }) : '—'; }

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function PaymentSchedule() {
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [policies, setPolicies] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [filters, setFilters] = useState({
    policyId: searchParams.get('policyId') || '',
    month: searchParams.get('month') || new Date().toISOString().slice(0,7),
    status: searchParams.get('status') || '',
    paymentMethodId: searchParams.get('paymentMethodId') || '',
  });
  const [todayItems, setTodayItems] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');
  const isAdmin = user.role === 'admin';

  function load() {
    setLoading(true);
    const params = Object.entries(filters).filter(([,v]) => v).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    api.getPaymentSchedule(params ? '?' + params : '').then(setItems).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [filters]);
  useEffect(() => {
    api.policies().then(d => setPolicies(Array.isArray(d) ? d : [])).catch(() => {});
    api.getPaymentMethods().then(d => setPaymentMethods(Array.isArray(d) ? d : [])).catch(() => {});
    api.getPaymentScheduleToday().then(d => setTodayItems(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  async function updateStatus(item, status) {
    try {
      await api.updatePaymentScheduleItem(item.id, { status });
      load();
    } catch (e) { alert(e.message); }
  }

  function openAdd() {
    setForm({ policy_id: filters.policyId || '', payment_method_id: '', amount: '', charge_date: '', charge_month: filters.month || '', installment_number: '', status: 'Planned', notes: '' });
    setModal({ mode: 'add' });
  }

  function openEdit(item) {
    setForm({ ...item });
    setModal({ mode: 'edit', id: item.id });
  }

  async function save() {
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await api.createPaymentScheduleItem(form);
      } else {
        await api.updatePaymentScheduleItem(modal.id, form);
      }
      setModal(null);
      load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function del(id) {
    if (!confirm('למחוק?')) return;
    await api.deletePaymentScheduleItem(id).catch(() => {});
    load();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>💳 לוח תשלומים</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/dept/vehicles/reports/payment-methods" style={{ textDecoration: 'none' }}>
            <button className="btn-secondary">📊 דוח</button>
          </Link>
          {isAdmin && <button className="btn-primary" onClick={openAdd}>+ הוסף</button>}
        </div>
      </div>

      {/* Today's payments banner */}
      {todayItems.length > 0 && (
        <div style={{ background:'#fef3c7', border:'1px solid #f59e0b', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
          <div style={{ fontWeight:700, fontSize:14, marginBottom:8, color:'#92400e' }}>
            ⚡ תשלומים לתשלום היום / בפיגור — {todayItems.length} פריטים, סה"כ ₪{todayItems.reduce((s,i)=>s+parseFloat(i.amount||0),0).toLocaleString('he-IL')}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {todayItems.slice(0,6).map(item => (
              <span key={item.id} style={{ background:'#fff', border:'1px solid #fcd34d', borderRadius:8, padding:'3px 10px', fontSize:12, color:'#374151' }}>
                {item.payment_method_name||'?'} · {item.policy_number||'?'} · ₪{parseFloat(item.amount||0).toLocaleString('he-IL')}
                <button style={{ marginRight:6, border:'none', background:'#dcfce7', color:'#15803d', borderRadius:4, cursor:'pointer', padding:'0 6px', fontSize:11 }}
                  onClick={()=>updateStatus(item,'Paid')}>✓ שולם</button>
              </span>
            ))}
            {todayItems.length > 6 && <span style={{fontSize:12,color:'#92400e'}}>+{todayItems.length-6} נוספים</span>}
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', background: '#f8f9fa', padding: 12, borderRadius: 8, alignItems:'center' }}>
        <input className="form-control" style={{ width: 130 }} type="month" value={filters.month} onChange={e => setFilters(f => ({ ...f, month: e.target.value }))} />
        <select className="form-control" style={{ width: 'auto', minWidth:140 }} value={filters.paymentMethodId} onChange={e => setFilters(f => ({ ...f, paymentMethodId: e.target.value }))}>
          <option value="">כל אמצעי התשלום</option>
          {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
        </select>
        <select className="form-control" style={{ width: 'auto', minWidth:120 }} value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
          <option value="">כל הסטטוסים</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_HE[s]}</option>)}
        </select>
        <select className="form-control" style={{ width: 'auto', minWidth:130 }} value={filters.policyId} onChange={e => setFilters(f => ({ ...f, policyId: e.target.value }))}>
          <option value="">כל הפוליסות</option>
          {policies.map(p => <option key={p.id} value={p.id}>{p.policy_number||p.id} - {p.insurer||''}</option>)}
        </select>
        <button className="btn btn-secondary btn-sm" onClick={() => setFilters({ policyId: '', month: new Date().toISOString().slice(0,7), status: '', paymentMethodId: '' })}>נקה</button>
        {/* Summary by PM for selected month */}
        {filters.month && items.length > 0 && (() => {
          const grouped = {};
          items.forEach(i => {
            const k = i.payment_method_name || 'ללא אמצעי';
            grouped[k] = (grouped[k]||0) + parseFloat(i.amount||0);
          });
          return (
            <div style={{ marginRight:'auto', display:'flex', gap:8, flexWrap:'wrap', fontSize:12 }}>
              {Object.entries(grouped).map(([name,total])=>(
                <span key={name} style={{background:'#e0f2fe',color:'#0369a1',padding:'2px 10px',borderRadius:12,fontWeight:600}}>
                  {name}: ₪{total.toLocaleString('he-IL')}
                </span>
              ))}
            </div>
          );
        })()}
      </div>

      {loading ? <p>טוען...</p> : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>פוליסה</th>
                <th>רכב</th>
                <th>אמצעי תשלום</th>
                <th>סכום</th>
                <th>תאריך חיוב</th>
                <th>חודש</th>
                <th>מספר תשלום</th>
                <th>סטטוס</th>
                <th>הערות</th>
                {isAdmin && <th>פעולות</th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>אין רשומות</td></tr>}
              {items.map(item => {
                const sc = STATUS_COLOR[item.status] || { bg: '#f3f4f6', c: '#374151' };
                return (
                  <tr key={item.id}>
                    <td>{item.policy_number || '—'}</td>
                    <td>{item.vehicle_number ? `${item.vehicle_number}${item.nickname ? ` (${item.nickname})` : ''}` : '—'}</td>
                    <td>{item.payment_method_name || '—'}</td>
                    <td>{fmtAmount(item.amount)}</td>
                    <td>{fmtDate(item.charge_date)}</td>
                    <td>{item.charge_month || '—'}</td>
                    <td>{item.installment_number || '—'}</td>
                    <td>
                      {isAdmin ? (
                        <select
                          value={item.status}
                          onChange={e => updateStatus(item, e.target.value)}
                          style={{ padding: '2px 6px', borderRadius: 8, border: '1px solid #e5e7eb', background: sc.bg, color: sc.c, fontSize: 12, cursor: 'pointer' }}
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{STATUS_HE[s]}</option>)}
                        </select>
                      ) : (
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: sc.bg, color: sc.c }}>{STATUS_HE[item.status] || item.status}</span>
                      )}
                    </td>
                    <td style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.notes || '—'}</td>
                    {isAdmin && (
                      <td>
                        <button className="btn-sm" onClick={() => openEdit(item)}>עריכה</button>
                        {' '}
                        <button className="btn-sm btn-danger" onClick={() => del(item.id)}>מחק</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal.mode === 'add' ? 'הוסף תשלום' : 'עריכת תשלום'} onClose={() => setModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>פוליסה</label>
              <select className="input-field" value={form.policy_id || ''} onChange={e => setForm(f => ({ ...f, policy_id: e.target.value }))}>
                <option value="">-- בחר --</option>
                {policies.map(p => <option key={p.id} value={p.id}>{p.policy_number} - {p.insurer}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>אמצעי תשלום</label>
              <select className="input-field" value={form.payment_method_id || ''} onChange={e => setForm(f => ({ ...f, payment_method_id: e.target.value }))}>
                <option value="">-- בחר --</option>
                {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name || pm.type}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>סכום (₪)</label>
              <input className="input-field" type="number" value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>תאריך חיוב</label>
              <input className="input-field" type="date" value={form.charge_date || ''} onChange={e => setForm(f => ({ ...f, charge_date: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>חודש עוגן (YYYY-MM)</label>
              <input className="input-field" type="month" value={form.charge_month || ''} onChange={e => setForm(f => ({ ...f, charge_month: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>מספר תשלום</label>
              <input className="input-field" type="number" value={form.installment_number || ''} onChange={e => setForm(f => ({ ...f, installment_number: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>סטטוס</label>
              <select className="input-field" value={form.status || 'Planned'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_HE[s]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>הערות</label>
              <textarea className="input-field" rows={2} value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn-secondary" onClick={() => setModal(null)}>ביטול</button>
              <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'שומר...' : 'שמור'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
