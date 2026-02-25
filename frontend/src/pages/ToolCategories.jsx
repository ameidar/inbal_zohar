import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function ToolCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');
  const isAdmin = user.role === 'admin';

  function load() {
    setLoading(true);
    api.getToolCategories().then(setCategories).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function openAdd() {
    setForm({ name: '', notes: '' });
    setModal({ mode: 'add' });
  }

  function openEdit(cat) {
    setForm({ name: cat.name, notes: cat.notes || '' });
    setModal({ mode: 'edit', id: cat.id });
  }

  async function save() {
    if (!form.name.trim()) { alert('שם קטגוריה הינו שדה חובה'); return; }
    setSaving(true);
    try {
      if (modal.mode === 'add') {
        await api.createToolCategory(form);
      } else {
        await api.updateToolCategory(modal.id, form);
      }
      setModal(null);
      load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function del(id) {
    if (!confirm('למחוק קטגוריה זו? הכלים המשויכים יישארו ללא קטגוריה.')) return;
    await api.deleteToolCategory(id).catch(() => {});
    load();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>📂 קטגוריות כלי עבודה</h2>
        {isAdmin && <button className="btn-primary" onClick={openAdd}>+ הוסף קטגוריה</button>}
      </div>

      {loading ? <p>טוען...</p> : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>שם</th>
                <th>כלים</th>
                <th>הערות</th>
                {isAdmin && <th>פעולות</th>}
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>אין קטגוריות. הוסף קטגוריה ראשונה!</td></tr>}
              {categories.map(cat => (
                <tr key={cat.id}>
                  <td><strong>{cat.name}</strong></td>
                  <td>
                    <span style={{ padding: '2px 8px', borderRadius: 12, background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 600 }}>
                      {cat.tool_count || 0} כלים
                    </span>
                  </td>
                  <td style={{ color: '#6b7280' }}>{cat.notes || '—'}</td>
                  {isAdmin && (
                    <td>
                      <button className="btn-sm" onClick={() => openEdit(cat)}>עריכה</button>
                      {' '}
                      <button className="btn-sm btn-danger" onClick={() => del(cat.id)}>מחק</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title={modal.mode === 'add' ? 'קטגוריה חדשה' : 'עריכת קטגוריה'} onClose={() => setModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>שם קטגוריה *</label>
              <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="לדוגמה: כלי חשמל" autoFocus />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>הערות</label>
              <textarea className="input-field" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
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
