import React, { useState, useEffect } from 'react';
import { api } from '../api/client';

const TYPES = ['כלי חשמלי','כלי ידני','ציוד כבד','אחר'];
const STATUSES = ['פעיל','בתיקון','לא בשימוש','אבד'];

export default function Tools() {
  const [items, setItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');

  async function runImport(dryRun) {
    if (!importFile) return alert('בחר קובץ Excel');
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const result = await api.importToolsExcel(fd, dryRun);
      if (dryRun) {
        setImportPreview(result);
      } else {
        alert(`✅ ייובאו ${result.inserted} כלים. דולגו: ${result.skipped}. שגיאות: ${result.errors}`);
        setImportModal(false); setImportPreview(null); setImportFile(null); load();
      }
    } catch(e) { alert(e.message); }
    finally { setImporting(false); }
  }

  async function load() {
    const [data, v] = await Promise.all([api.get('/tools').catch(()=>[]), api.vehicles().catch(()=>[])]);
    setItems(data); setVehicles(v);
  }
  useEffect(() => { load(); }, []);

  function openAdd() { setEditItem(null); setForm({ status:'פעיל', tool_type:'כלי חשמלי', requires_inspection:false }); setShowModal(true); }
  function openEdit(item) { setEditItem(item); setForm(item); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditItem(null); setForm({}); }
  const f = (k, val) => setForm(p => ({ ...p, [k]: val }));

  async function save() {
    setSaving(true);
    try {
      if (editItem) await api.put(`/tools/${editItem.id}`, form);
      else await api.post('/tools', form);
      closeModal(); load();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function del(item) {
    if (!confirm('למחוק כלי?')) return;
    await api.delete(`/tools/${item.id}`).catch(e=>alert(e.message));
    load();
  }

  const vMap = Object.fromEntries(vehicles.map(v=>[v.id, v]));

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ fontSize:18, fontWeight:700 }}>כלי עבודה ({items.length})</h2>
        {user.role==='admin' && <>
          <button className="btn btn-secondary" onClick={()=>{setImportModal(true);setImportPreview(null);setImportFile(null);}}>📥 ייבוא מ-Excel</button>
          <button className="btn btn-primary" onClick={openAdd}>+ הוסף כלי</button>
        </>}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead><tr><th>מספר סידורי</th><th>סוג כלי</th><th>רכב משויך</th><th>סטטוס</th><th>נדרש ריקורד?</th><th>הערות</th><th></th></tr></thead>
            <tbody>
              {items.map(t=>{
                const v = vMap[t.vehicle_id];
                return (
                  <tr key={t.id}>
                    <td style={{fontWeight:600}}>{t.serial_number}</td>
                    <td>{t.tool_type}</td>
                    <td>{v ? `${v.vehicle_number}${v.nickname?` (${v.nickname})`:''}` : '—'}</td>
                    <td><span className={`badge ${t.status==='פעיל'?'badge-green':t.status==='אבד'?'badge-red':t.status==='בתיקון'?'badge-yellow':'badge-gray'}`}>{t.status}</span></td>
                    <td>{t.requires_inspection ? <span className="badge badge-blue">נדרש</span> : '—'}</td>
                    <td style={{fontSize:12,maxWidth:150}}>{t.notes||'—'}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={()=>openEdit(t)} style={{marginLeft:4}}>✏️</button>
                      {user.role==='admin' && <button className="btn btn-danger btn-sm" onClick={()=>del(t)}>🗑️</button>}
                    </td>
                  </tr>
                );
              })}
              {items.length===0 && <tr><td colSpan={7} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין כלי עבודה</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">{editItem?'עריכת כלי':'הוספת כלי עבודה'}</span>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label className="form-label">מספר סידורי *</label><input className="form-control" value={form.serial_number||''} onChange={e=>f('serial_number',e.target.value)}/></div>
                <div className="form-group"><label className="form-label">סוג כלי</label>
                  <select className="form-control" value={form.tool_type||''} onChange={e=>f('tool_type',e.target.value)}>
                    {TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">רכב משויך</label>
                  <select className="form-control" value={form.vehicle_id||''} onChange={e=>f('vehicle_id',+e.target.value||null)}>
                    <option value="">ללא שיוך</option>
                    {vehicles.map(v=><option key={v.id} value={v.id}>{v.vehicle_number} {v.nickname?`(${v.nickname})`:''}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">סטטוס</label>
                  <select className="form-control" value={form.status||''} onChange={e=>f('status',e.target.value)}>
                    {STATUSES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{display:'flex',alignItems:'center',gap:8}}>
                <input type="checkbox" id="ri" checked={form.requires_inspection||false} onChange={e=>f('requires_inspection',e.target.checked)}/>
                <label htmlFor="ri" className="form-label" style={{margin:0}}>נדרש ריקורד/בדיקה</label>
              </div>
              <div className="form-group"><label className="form-label">הערות</label><textarea className="form-control" rows={2} value={form.notes||''} onChange={e=>f('notes',e.target.value)}/></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'שומר...':'שמור'}</button>
              <button className="btn btn-secondary" onClick={closeModal}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Excel Modal */}
      {importModal && (
        <div className="modal-overlay" onClick={()=>{setImportModal(false);setImportPreview(null);}}>
          <div className="modal" style={{maxWidth:700}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">📥 ייבוא כלים מ-Excel</span>
              <button className="modal-close" onClick={()=>{setImportModal(false);setImportPreview(null);}}>×</button>
            </div>
            <div className="modal-body">
              <div style={{marginBottom:12,padding:12,background:'#f0f9ff',borderRadius:8,fontSize:12,color:'#0369a1'}}>
                <strong>עמודות נתמכות:</strong> מספר סידורי (חובה), סוג כלי, קטגוריה, מספר רכב, סטטוס, הערות, בדיקה נדרשת (כן/לא)
              </div>
              <div className="form-group">
                <label className="form-label">בחר קובץ Excel (.xlsx / .xls)</label>
                <input type="file" accept=".xlsx,.xls" className="form-control" onChange={e=>{ setImportFile(e.target.files[0]); setImportPreview(null); }}/>
              </div>
              {importPreview && (
                <div style={{marginTop:16}}>
                  <div style={{display:'flex',gap:12,marginBottom:8,flexWrap:'wrap',fontSize:13}}>
                    <span style={{background:'#dcfce7',color:'#15803d',padding:'2px 10px',borderRadius:8}}>✅ יוכנסו: {importPreview.to_insert}</span>
                    <span style={{background:'#f3f4f6',color:'#374151',padding:'2px 10px',borderRadius:8}}>⏭️ ידולגו (קיים): {importPreview.to_skip}</span>
                    {importPreview.errors > 0 && <span style={{background:'#fee2e2',color:'#dc2626',padding:'2px 10px',borderRadius:8}}>❌ שגיאות: {importPreview.errors}</span>}
                  </div>
                  <div style={{maxHeight:280,overflowY:'auto',fontSize:12}}>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead><tr style={{background:'#f8f9fa'}}>
                        <th style={{padding:6,textAlign:'right'}}>שורה</th>
                        <th style={{padding:6,textAlign:'right'}}>מספר סידורי</th>
                        <th style={{padding:6,textAlign:'right'}}>סוג</th>
                        <th style={{padding:6,textAlign:'right'}}>רכב</th>
                        <th style={{padding:6,textAlign:'right'}}>סטטוס</th>
                        <th style={{padding:6,textAlign:'right'}}>פעולה</th>
                      </tr></thead>
                      <tbody>
                        {importPreview.preview?.map((row,i)=>(
                          <tr key={i} style={{borderTop:'1px solid #f1f5f9',background:row.action==='skip'?'#fafafa':row.warning?'#fef9c3':''}}>
                            <td style={{padding:6,color:'#9ca3af'}}>{row.rowNum}</td>
                            <td style={{padding:6,fontWeight:600}}>{row.serial_number}</td>
                            <td style={{padding:6}}>{row.tool_type||'—'}</td>
                            <td style={{padding:6,fontSize:11}}>{row.vehicle_number||'—'}{row.warning?<span style={{color:'#f59e0b'}}> ⚠️</span>:''}</td>
                            <td style={{padding:6}}>{row.status}</td>
                            <td style={{padding:6}}>
                              {row.action==='insert'?<span style={{color:'#15803d',fontWeight:600}}>הכנס</span>:<span style={{color:'#9ca3af'}}>דלג</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>runImport(true)} disabled={importing||!importFile}>
                {importing?'בודק...':'🔍 תצוגה מקדימה'}
              </button>
              {importPreview && importPreview.to_insert > 0 && (
                <button className="btn btn-primary" onClick={()=>runImport(false)} disabled={importing}>
                  {importing?'מייבא...':'📥 ייבוא'}
                </button>
              )}
              <button className="btn btn-secondary" onClick={()=>{setImportModal(false);setImportPreview(null);}}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
