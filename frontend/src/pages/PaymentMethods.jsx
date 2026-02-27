import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

const TYPES = ["אשראי","צ'ק","העברה","הו\"ק","מזומן","אחר"];
const STATUSES = ['Active', 'Inactive'];

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: '#6b7280' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const EMPTY = { type: '', last4: '', monthly_charge_day: '', status: 'Active', provider: '', notes: '' };

export default function PaymentMethods() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | { mode: 'add'|'edit', data }
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');
  const isAdmin = user.role === 'admin';

  function load() {
    setLoading(true);
    api.getPaymentMethods().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setForm(EMPTY);
    setError('');
    setModal({ mode: 'add' });
  }

  function openEdit(item) {
    setForm({
      type: item.payment_type || item.type || '',
      last4: item.last4 || item.last_4_digits || '',
      monthly_charge_day: item.monthly_charge_day || item.charge_day || '',
      status: item.status || 'Active',
      provider: item.provider || item.company || '',
      notes: item.notes || '',
      name: item.name || '',
    });
    setError('');
    setModal({ mode: 'edit', id: item.id });
  }

  async function save() {
    if (!form.type && !form.name) { setError('יש להזין סוג או שם'); return; }
    setSaving(true);
    setError('');
    try {
      if (modal.mode === 'add') {
        await api.createPaymentMethod(form);
      } else {
        await api.updatePaymentMethod(modal.id, form);
      }
      setModal(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function del(id) {
    if (!confirm('למחוק אמצעי תשלום זה?')) return;
    await api.deletePaymentMethod(id).catch(() => {});
    load();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>💳 אמצעי תשלום</h2>
        {isAdmin && <button className="btn-primary" onClick={openAdd}>+ הוסף</button>}
      </div>

      {loading ? <p>טוען...</p> : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>שם/סוג</th>
                <th>4 ספרות אחרונות</th>
                <th>יום חיוב</th>
                <th>ספק/חברה</th>
                <th>סטטוס</th>
                <th>הערות</th>
                {isAdmin && <th>פעולות</th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>אין אמצעי תשלום</td></tr>}
              {items.map(item => (
                <tr key={item.id}>
                  <td><strong>{item.name || item.type || item.payment_type || '—'}</strong></td>
                  <td>{item.last4 || item.last_4_digits || '—'}</td>
                  <td>{item.monthly_charge_day || item.charge_day || '—'}</td>
                  <td>{item.provider || item.company || '—'}</td>
                  <td>
                    <span style={{
                      padding: '2px 8px', borderRadius: 12, fontSize: 12,
                      background: item.status === 'Active' ? '#dcfce7' : '#fee2e2',
                      color: item.status === 'Active' ? '#15803d' : '#dc2626'
                    }}>
                      {item.status === 'Active' ? 'פעיל' : 'לא פעיל'}
                    </span>
                  </td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.notes || '—'}</td>
                  {isAdmin && (
                    <td>
                      <button className="btn-sm" onClick={() => openEdit(item)}>עריכה</button>
                      {' '}
                      <button className="btn-sm btn-danger" onClick={() => del(item.id)}>מחק</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal.mode === 'add' ? 'הוסף אמצעי תשלום' : 'עריכת אמצעי תשלום'} onClose={() => setModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {error && <div style={{ color: '#dc2626', fontSize: 13 }}>{error}</div>}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>שם</label>
              <input className="input-field" value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>סוג</label>
              <select className="input-field" value={form.type || ''} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                <option value="">-- בחר --</option>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>4 ספרות אחרונות</label>
              <input className="input-field" maxLength={4} value={form.last4 || ''} onChange={e => setForm(f => ({ ...f, last4: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>יום חיוב חודשי</label>
              <input className="input-field" type="number" min={1} max={31} value={form.monthly_charge_day || ''} onChange={e => setForm(f => ({ ...f, monthly_charge_day: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>ספק/חברה</label>
              <input className="input-field" value={form.provider || ''} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>סטטוס</label>
              <select className="input-field" value={form.status || 'Active'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s === 'Active' ? 'פעיל' : 'לא פעיל'}</option>)}
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
