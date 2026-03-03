import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';

const DOC_TYPES = ['פוליסת ביטוח','מסמכי רכישה','תעודת רישום','טסט','חוזה','תמונה','רישיון מפעיל','מסמך משפטי','חשבונית','אחר'];
const ENTITY_TYPES = ['Vehicle', 'Policy', 'Maintenance', 'Inspection', 'Tool'];
const ENTITY_TYPE_HE = { Vehicle: 'רכב', Policy: 'פוליסה', Maintenance: 'טיפול', Inspection: 'בדיקה', Tool: 'כלי' };

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }

function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 500, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function Documents({ linkedEntityType: propEntityType, linkedEntityId: propEntityId }) {
  const [searchParams] = useSearchParams();
  const entityType = propEntityType || searchParams.get('linkedEntityType') || '';
  const entityId = propEntityId || searchParams.get('linkedEntityId') || '';

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ linkedEntityType: entityType, linkedEntityId: entityId, document_type: '', dateFrom: '', dateTo: '' });
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ document_type: '', linked_entity_type: '', linked_entity_id: '', date: '', notes: '' });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();
  const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');
  const isAdmin = user.role === 'admin';

  function load() {
    setLoading(true);
    api.getDocuments(filters.linkedEntityType, filters.linkedEntityId, filters.document_type, filters.dateFrom, filters.dateTo)
      .then(setDocs).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [filters]);

  function openAdd() {
    setForm({ document_type: '', linked_entity_type: entityType || '', linked_entity_id: entityId || '', date: '', notes: '' });
    setFile(null);
    setModal({ mode: 'add' });
  }

  async function save() {
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      if (file) fd.append('file', file);
      await api.uploadDocument(fd);
      setModal(null);
      load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function del(id) {
    if (!confirm('למחוק מסמך זה?')) return;
    await api.deleteDocument(id).catch(() => {});
    load();
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>📄 מרכז מסמכים</h2>
        {isAdmin && <button className="btn-primary" onClick={openAdd}>+ הוסף מסמך</button>}
      </div>

      {!propEntityType && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, background: '#f8f9fa', padding: 12, borderRadius: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="form-control" style={{ width: 'auto', minWidth: 140 }} value={filters.document_type} onChange={e => setFilters(f => ({ ...f, document_type: e.target.value }))}>
            <option value="">כל סוגי המסמכים</option>
            {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="form-control" style={{ width: 'auto', minWidth: 120 }} value={filters.linkedEntityType} onChange={e => setFilters(f => ({ ...f, linkedEntityType: e.target.value }))}>
            <option value="">כל הישויות</option>
            {ENTITY_TYPES.map(t => <option key={t} value={t}>{ENTITY_TYPE_HE[t]}</option>)}
          </select>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{fontSize:12,color:'#6b7280'}}>מ-</span>
            <input className="form-control" type="date" style={{ width: 130 }} value={filters.dateFrom} onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
            <span style={{fontSize:12,color:'#6b7280'}}>עד</span>
            <input className="form-control" type="date" style={{ width: 130 }} value={filters.dateTo} onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} />
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setFilters({ linkedEntityType: '', linkedEntityId: '', document_type: '', dateFrom: '', dateTo: '' })}>נקה הכל</button>
          <span style={{ fontSize: 12, color: '#6b7280', marginRight: 'auto' }}>{docs.length} מסמכים</span>
        </div>
      )}

      {loading ? <p>טוען...</p> : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>סוג מסמך</th>
                <th>ישות מקושרת</th>
                <th>ID</th>
                <th>תאריך</th>
                <th>הערות</th>
                <th>קובץ</th>
                {isAdmin && <th>פעולות</th>}
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>אין מסמכים</td></tr>}
              {docs.map(doc => (
                <tr key={doc.id}>
                  <td>{doc.document_type || '—'}</td>
                  <td>{ENTITY_TYPE_HE[doc.linked_entity_type] || doc.linked_entity_type || '—'}</td>
                  <td>{doc.linked_entity_id || '—'}</td>
                  <td>{fmtDate(doc.date)}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.notes || '—'}</td>
                  <td>
                    {doc.file_url ? (
                      <a href={doc.file_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                        📎 הורד
                      </a>
                    ) : '—'}
                  </td>
                  {isAdmin && (
                    <td>
                      <button className="btn-sm btn-danger" onClick={() => del(doc.id)}>מחק</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal title="הוסף מסמך" onClose={() => setModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>סוג מסמך</label>
              <select className="input-field" value={form.document_type} onChange={e => setForm(f => ({ ...f, document_type: e.target.value }))}>
                <option value="">-- בחר --</option>
                {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>סוג ישות</label>
              <select className="input-field" value={form.linked_entity_type} onChange={e => setForm(f => ({ ...f, linked_entity_type: e.target.value }))}>
                <option value="">-- בחר --</option>
                {ENTITY_TYPES.map(t => <option key={t} value={t}>{ENTITY_TYPE_HE[t]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>ID ישות</label>
              <input className="input-field" type="number" value={form.linked_entity_id} onChange={e => setForm(f => ({ ...f, linked_entity_id: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>תאריך</label>
              <input className="input-field" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>הערות</label>
              <textarea className="input-field" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>קובץ</label>
              <input ref={fileRef} type="file" onChange={e => setFile(e.target.files[0])} style={{ fontSize: 13 }} />
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
