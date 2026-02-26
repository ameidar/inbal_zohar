import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import Documents from './Documents';
import MissingData from './MissingData';

function DocumentsTab({ vehicleId }) {
  return <Documents linkedEntityType="Vehicle" linkedEntityId={vehicleId} />;
}

function MissingDataTab({ vehicleId }) {
  return <MissingData vehicleId={vehicleId} />;
}

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }
function fmtCur(n) { return n != null ? `₪${Number(n).toLocaleString('he-IL')}` : '—'; }

const token = () => localStorage.getItem('fleet_token');
const authHdr = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` });

async function apiFetch(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: authHdr(),
    body: body ? JSON.stringify(body) : undefined
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function VehicleDetail() {
  const { id } = useParams();
  const [vehicle, setVehicle] = useState(null);
  const [tab, setTab] = useState('כללי');
  const TABS = ['כללי','טיפולים','בדיקות','כרטיסי דלק','ביטוח','מיגון','כלי עבודה','החזרי סולר','מסמכים','נתונים חסרים'];
  const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');
  const isAdmin = user.role === 'admin';

  // ── Purchase modal ──
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({});
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ── Insurance modal ──
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [editingInsurance, setEditingInsurance] = useState(null); // null = add, obj = edit
  const [insuranceForm, setInsuranceForm] = useState({});
  const [insuranceSaving, setInsuranceSaving] = useState(false);
  const [insScheduleItems, setInsScheduleItems] = useState([]);
  const [showInsSchedule, setShowInsSchedule] = useState(false);
  const [insSort, setInsSort] = useState({ col: 'status', dir: 'asc' });

  function toggleInsSort(col) {
    setInsSort(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }));
  }

  function sortedPolicies(policies) {
    if (!policies) return [];
    const active = ['פעילה'];
    const inactive = ['הסתיימה', 'בוטלה', 'לא פעילה', 'בהקפאה'];
    const statusOrder = p => active.includes(p.status) ? 0 : inactive.includes(p.status) ? 2 : 1;
    return [...policies].sort((a, b) => {
      // Always: active first, then others
      const statusDiff = statusOrder(a) - statusOrder(b);
      if (statusDiff !== 0) return statusDiff;
      // Within same status group: sort by selected col
      const dir = insSort.dir === 'asc' ? 1 : -1;
      if (insSort.col === 'expiry_date') {
        return dir * (new Date(a.expiry_date||0) - new Date(b.expiry_date||0));
      }
      if (insSort.col === 'total_premium') {
        return dir * ((parseFloat(a.total_premium)||0) - (parseFloat(b.total_premium)||0));
      }
      const av = a[insSort.col] || '', bv = b[insSort.col] || '';
      return dir * av.toString().localeCompare(bv.toString(), 'he');
    });
  }

  // ── Maintenance modal ──
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState(null);
  const [maintenanceForm, setMaintenanceForm] = useState({});
  const [maintenanceSaving, setMaintenanceSaving] = useState(false);

  // ── Inspection modal ──
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [editingInspection, setEditingInspection] = useState(null);
  const [inspectionForm, setInspectionForm] = useState({});
  const [inspectionSaving, setInspectionSaving] = useState(false);

  // ── Fuel card modal ──
  const [showFuelCardModal, setShowFuelCardModal] = useState(false);
  const [editingFuelCard, setEditingFuelCard] = useState(null);
  const [fuelCardForm, setFuelCardForm] = useState({});
  const [fuelCardSaving, setFuelCardSaving] = useState(false);

  // ── Security modal ──
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [editingSecurity, setEditingSecurity] = useState(null);
  const [securityForm, setSecurityForm] = useState({});
  const [securitySaving, setSecuritySaving] = useState(false);

  // ── Tools modal ──
  const [showToolModal, setShowToolModal] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [toolForm, setToolForm] = useState({});
  const [toolSaving, setToolSaving] = useState(false);

  // ── Diesel refund modal ──
  const [showDieselModal, setShowDieselModal] = useState(false);
  const [editingDiesel, setEditingDiesel] = useState(null);
  const [dieselForm, setDieselForm] = useState({});
  const [dieselSaving, setDieselSaving] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [showAddPM, setShowAddPM] = useState(false);
  const [newPMForm, setNewPMForm] = useState({});
  const [savingPM, setSavingPM] = useState(false);

  useEffect(() => { api.vehicle(id).then(setVehicle).catch(console.error); }, [id]);
  useEffect(() => { api.paymentMethods().then(setPaymentMethods).catch(()=>{}); }, []);

  function reload() { api.vehicle(id).then(setVehicle).catch(console.error); }

  async function saveNewPM() {
    if (!newPMForm.name) return alert('חובה להזין שם');
    setSavingPM(true);
    try {
      const created = await api.createPaymentMethod(newPMForm);
      const updated = await api.paymentMethods();
      setPaymentMethods(updated);
      setInsuranceForm(f => ({ ...f, charge_method_id: created.id }));
      setShowAddPM(false);
      setNewPMForm({});
    } catch(e) { alert(e.message); }
    finally { setSavingPM(false); }
  }

  // ── Schedule helpers ──
  function calcFirstChargeDate(startDateStr, pm) {
    if (!startDateStr) return null;
    const d = new Date(startDateStr);
    const isAuto = pm && pm.charge_day && (pm.payment_type === 'אשראי' || (pm.payment_type && pm.payment_type.includes('הו')));
    if (isAuto) {
      const cDay = parseInt(pm.charge_day);
      let year = d.getFullYear(), month = d.getMonth();
      if (d.getDate() >= cDay) { month += 1; if (month > 11) { month = 0; year += 1; } }
      const dim = new Date(year, month + 1, 0).getDate();
      return `${year}-${String(month+1).padStart(2,'0')}-${String(Math.min(cDay,dim)).padStart(2,'0')}`;
    }
    return d.toISOString().split('T')[0];
  }

  function buildAutoSchedule(formData, pmId) {
    const total = parseFloat(formData.total_premium) || 0;
    const count = parseInt(formData.num_payments) || 1;
    const pm = paymentMethods.find(p => p.id === (pmId || formData.charge_method_id));
    const firstDate = calcFirstChargeDate(formData.start_date || new Date().toISOString().split('T')[0], pm);
    const perInstallment = count > 0 ? (total / count) : total;
    return Array.from({ length: count }, (_, i) => {
      let chargeDate = null, chargeMonth = null;
      if (firstDate) {
        const d = new Date(firstDate);
        d.setMonth(d.getMonth() + i);
        chargeDate = d.toISOString().split('T')[0];
        chargeMonth = chargeDate.substring(0, 7);
      }
      return {
        installment_number: i + 1,
        amount: Math.round(perInstallment * 100) / 100,
        charge_date: chargeDate,
        charge_month: chargeMonth,
        payment_method_id: pmId || formData.charge_method_id || null,
      };
    });
  }

  // ── Purchase handlers ──
  function openPurchaseEdit() {
    setPurchaseForm({
      purchase_date: vehicle.purchase_date?.split('T')[0] || '',
      purchase_amount: vehicle.purchase_amount || '',
      purchase_payment_method: vehicle.purchase_payment_method || '',
      purchase_num_payments: vehicle.purchase_num_payments || '',
      purchase_doc_url: vehicle.purchase_doc_url || '',
    });
    setShowPurchaseModal(true);
  }
  async function savePurchase() {
    setPurchaseSaving(true);
    try {
      const updated = await apiFetch('PUT', `/api/vehicles/${id}`, purchaseForm);
      setVehicle(v => ({ ...v, ...updated }));
      setShowPurchaseModal(false);
    } catch (e) { alert(e.message); }
    finally { setPurchaseSaving(false); }
  }
  async function uploadPurchaseDoc(file) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`/api/vehicles/${id}/purchase-doc`, {
        method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: fd
      });
      if (!r.ok) throw new Error(await r.text());
      const { url } = await r.json();
      setVehicle(v => ({ ...v, purchase_doc_url: url }));
      setPurchaseForm(p => ({ ...p, purchase_doc_url: url }));
    } catch (e) { alert(e.message); }
    finally { setUploading(false); }
  }

  // ── Insurance handlers ──
  function openAddInsurance() {
    setEditingInsurance(null);
    const newForm = { vehicle_id: +id, status: 'פעילה', num_payments: 1, first_charge_day: 1 };
    setInsuranceForm(newForm);
    setInsScheduleItems(buildAutoSchedule(newForm, null));
    setShowInsSchedule(false);
    setShowInsuranceModal(true);
  }
  function openEditInsurance(p) {
    setEditingInsurance(p);
    const editForm = {
      vehicle_id: p.vehicle_id,
      policy_number: p.policy_number || '',
      coverage_type: p.coverage_type || '',
      insurer: p.insurer || '',
      start_date: p.start_date?.split('T')[0] || '',
      expiry_date: p.expiry_date?.split('T')[0] || '',
      total_premium: p.total_premium || '',
      num_payments: p.num_payments || 1,
      first_charge_day: p.first_charge_day || 1,
      status: p.status || 'פעילה',
      notes: p.notes || '',
      charge_method_id: p.charge_method_id || null,
    };
    setInsuranceForm(editForm);
    setShowInsSchedule(false);
    if (p.id) {
      fetch(`/api/insurance/${p.id}/schedule`, { headers: { Authorization: `Bearer ${token()}` } })
        .then(r => r.json())
        .then(items => {
          setInsScheduleItems(items.length > 0 ? items : buildAutoSchedule(editForm, editForm.charge_method_id));
        })
        .catch(() => setInsScheduleItems(buildAutoSchedule(editForm, editForm.charge_method_id)));
    } else {
      setInsScheduleItems(buildAutoSchedule(editForm, editForm.charge_method_id));
    }
    setShowInsuranceModal(true);
  }
  async function saveInsurance() {
    setInsuranceSaving(true);
    try {
      let savedPolicy;
      if (editingInsurance) {
        savedPolicy = await apiFetch('PUT', `/api/insurance/${editingInsurance.id}`, insuranceForm);
      } else {
        savedPolicy = await apiFetch('POST', '/api/insurance', insuranceForm);
      }
      const policyId = savedPolicy?.id || editingInsurance?.id;
      if (policyId && insScheduleItems.length > 0) {
        await api.bulkReplaceSchedule(policyId, insScheduleItems).catch(()=>{});
      }
      setShowInsuranceModal(false);
      reload();
    } catch (e) { alert(e.message); }
    finally { setInsuranceSaving(false); }
  }

  // ── Maintenance handlers ──
  function openAddMaintenance() {
    setEditingMaintenance(null);
    setMaintenanceForm({ vehicle_id: +id, status: 'בוצע', maintenance_date: new Date().toISOString().split('T')[0] });
    setShowMaintenanceModal(true);
  }
  function openEditMaintenance(m) {
    setEditingMaintenance(m);
    setMaintenanceForm({
      vehicle_id: m.vehicle_id,
      maintenance_type: m.maintenance_type || '',
      maintenance_date: m.maintenance_date?.split('T')[0] || '',
      odometer: m.odometer || '',
      description: m.description || '',
      cost: m.cost || '',
      status: m.status || 'בוצע',
      next_date: m.next_date?.split('T')[0] || '',
      notes: m.notes || '',
    });
    setShowMaintenanceModal(true);
  }
  async function saveMaintenance() {
    setMaintenanceSaving(true);
    try {
      if (editingMaintenance) {
        await apiFetch('PUT', `/api/maintenance/${editingMaintenance.id}`, maintenanceForm);
      } else {
        await apiFetch('POST', '/api/maintenance', maintenanceForm);
      }
      setShowMaintenanceModal(false);
      reload();
    } catch (e) { alert(e.message); }
    finally { setMaintenanceSaving(false); }
  }

  // ── Inspection handlers ──
  function openAddInspection() {
    setEditingInspection(null);
    setInspectionForm({ vehicle_id: +id, passed: true, inspection_date: new Date().toISOString().split('T')[0] });
    setShowInspectionModal(true);
  }
  function openEditInspection(i) {
    setEditingInspection(i);
    setInspectionForm({
      vehicle_id: i.vehicle_id,
      inspection_type: i.inspection_type || '',
      inspection_date: i.inspection_date?.split('T')[0] || '',
      next_inspection_date: i.next_inspection_date?.split('T')[0] || '',
      inspector: i.inspector || '',
      cost: i.cost || '',
      passed: i.passed !== undefined ? i.passed : true,
      notes: i.notes || '',
    });
    setShowInspectionModal(true);
  }
  async function saveInspection() {
    setInspectionSaving(true);
    try {
      if (editingInspection) {
        await apiFetch('PUT', `/api/inspections/${editingInspection.id}`, inspectionForm);
      } else {
        await apiFetch('POST', '/api/inspections', inspectionForm);
      }
      setShowInspectionModal(false);
      reload();
    } catch (e) { alert(e.message); }
    finally { setInspectionSaving(false); }
  }

  // ── Fuel card handlers ──
  function openAddFuelCard() {
    setEditingFuelCard(null);
    setFuelCardForm({ vehicle_id: +id, status: 'פעיל', fuel_type: vehicle.fuel_type || '' });
    setShowFuelCardModal(true);
  }
  function openEditFuelCard(fc) {
    setEditingFuelCard(fc);
    setFuelCardForm({
      vehicle_id: fc.vehicle_id,
      card_number: fc.card_number || '',
      supplier: fc.supplier || '',
      fuel_type: fc.fuel_type || '',
      status: fc.status || 'פעיל',
      daily_limit: fc.daily_limit || '',
      monthly_limit: fc.monthly_limit || '',
      notes: fc.notes || '',
    });
    setShowFuelCardModal(true);
  }
  async function saveFuelCard() {
    setFuelCardSaving(true);
    try {
      if (editingFuelCard) {
        await apiFetch('PUT', `/api/fuel-cards/${editingFuelCard.id}`, fuelCardForm);
      } else {
        await apiFetch('POST', '/api/fuel-cards', fuelCardForm);
      }
      setShowFuelCardModal(false);
      reload();
    } catch (e) { alert(e.message); }
    finally { setFuelCardSaving(false); }
  }

  // ── Security handlers ──
  function openAddSecurity() {
    setEditingSecurity(null);
    setSecurityForm({ vehicle_id: +id });
    setShowSecurityModal(true);
  }
  function openEditSecurity(s) {
    setEditingSecurity(s);
    setSecurityForm({
      vehicle_id: s.vehicle_id,
      security_type: s.security_type || '',
      installation_date: s.installation_date?.split('T')[0] || '',
      renewal_date: s.renewal_date?.split('T')[0] || '',
      subscription_fee: s.subscription_fee || '',
      notes: s.notes || '',
    });
    setShowSecurityModal(true);
  }
  async function saveSecurity() {
    setSecuritySaving(true);
    try {
      if (editingSecurity) {
        await apiFetch('PUT', `/api/vehicle-security/${editingSecurity.id}`, securityForm);
      } else {
        await apiFetch('POST', '/api/vehicle-security', securityForm);
      }
      setShowSecurityModal(false);
      reload();
    } catch (e) { alert(e.message); }
    finally { setSecuritySaving(false); }
  }

  // ── Tool handlers ──
  function openAddTool() {
    setEditingTool(null);
    setToolForm({ vehicle_id: +id, status: 'פעיל', requires_inspection: false });
    setShowToolModal(true);
  }
  function openEditTool(t) {
    setEditingTool(t);
    setToolForm({
      vehicle_id: t.vehicle_id,
      serial_number: t.serial_number || '',
      tool_type: t.tool_type || '',
      status: t.status || 'פעיל',
      requires_inspection: t.requires_inspection || false,
      notes: t.notes || '',
    });
    setShowToolModal(true);
  }
  async function saveTool() {
    setToolSaving(true);
    try {
      if (editingTool) {
        await apiFetch('PUT', `/api/tools/${editingTool.id}`, toolForm);
      } else {
        await apiFetch('POST', '/api/tools', toolForm);
      }
      setShowToolModal(false);
      reload();
    } catch (e) { alert(e.message); }
    finally { setToolSaving(false); }
  }

  // ── Diesel refund handlers ──
  function openAddDiesel() {
    setEditingDiesel(null);
    setDieselForm({ vehicle_id: +id, refund_status: 'פתוח' });
    setShowDieselModal(true);
  }
  function openEditDiesel(r) {
    setEditingDiesel(r);
    setDieselForm({
      vehicle_id: r.vehicle_id,
      period: r.period || '',
      liters: r.liters || '',
      amount: r.amount || '',
      refund_status: r.refund_status || 'פתוח',
      submission_date: r.submission_date?.split('T')[0] || '',
      actual_receipt_date: r.actual_receipt_date?.split('T')[0] || '',
      notes: r.notes || '',
    });
    setShowDieselModal(true);
  }
  async function saveDiesel() {
    setDieselSaving(true);
    try {
      if (editingDiesel) {
        await apiFetch('PUT', `/api/diesel-refunds/${editingDiesel.id}`, dieselForm);
      } else {
        await apiFetch('POST', '/api/diesel-refunds', dieselForm);
      }
      setShowDieselModal(false);
      reload();
    } catch (e) { alert(e.message); }
    finally { setDieselSaving(false); }
  }

  // Insurance charge day visibility
  const insPM = paymentMethods.find(pm => pm.id === insuranceForm.charge_method_id);
  const insShowChargeDay = !insPM || insPM.payment_type === 'אשראי' || (insPM.payment_type && insPM.payment_type.includes('הו'));

  if (!vehicle) return <div className="loading">טוען...</div>;

  const statusBadge = (s) => {
    const map = { 'פעיל':'badge-green','בוצע':'badge-green','שולם':'badge-green','פעילה':'badge-green',
                  'מושבת':'badge-red','בוטל':'badge-red','לא פעיל':'badge-red','בוטלה':'badge-red','הסתיימה':'badge-gray',
                  'בהקפאה':'badge-yellow','בתיקון':'badge-yellow','שולם באיחור':'badge-yellow',
                  'פתוח':'badge-blue','התקבל':'badge-green','הוגש':'badge-yellow' };
    return <span className={`badge ${map[s]||'badge-gray'}`}>{s}</span>;
  };

  const ModalWrapper = ({ title, onClose, onSave, saving, children }) => (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>{saving ? 'שומר...' : 'שמור'}</button>
          <button className="btn btn-secondary" onClick={onClose}>ביטול</button>
        </div>
      </div>
    </div>
  );

  const Field = ({ label, children }) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );

  const inp = (form, setForm, key, type = 'text', extra = {}) => (
    <input className="form-control" type={type} value={form[key] ?? ''} {...extra}
      onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? (e.target.value === '' ? '' : +e.target.value) : e.target.value }))} />
  );

  const sel = (form, setForm, key, options) => (
    <select className="form-control" value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}>
      <option value="">— בחר —</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20 }}>
        <Link to="/dept/vehicles/list" className="btn btn-secondary btn-sm">→ חזרה</Link>
        <div>
          <h2 style={{ fontSize:22, fontWeight:700 }}>{vehicle.vehicle_number} {vehicle.nickname ? `— ${vehicle.nickname}` : ''}</h2>
          <div style={{ fontSize:14, color:'#6b7280' }}>{vehicle.manufacturer} {vehicle.model} {vehicle.year} - {vehicle.asset_type} - {vehicle.fuel_type}</div>
        </div>
        <span className={`badge ${vehicle.status==='פעיל'?'badge-green':vehicle.status==='מושבת'?'badge-red':'badge-yellow'}`} style={{fontSize:14,padding:'4px 12px'}}>{vehicle.status}</span>
      </div>

      <div className="tabs">
        {TABS.map(t => <div key={t} className={`tab ${tab===t?'active':''}`} onClick={()=>setTab(t)}>{t}</div>)}
      </div>

      {/* ═══════════════ כללי ═══════════════ */}
      {tab === 'כללי' && (
        <><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">פרטי רכב</span></div>
            <div className="card-body">
              {[['מספר רכב', vehicle.vehicle_number], ['כינוי', vehicle.nickname], ['סוג נכס', vehicle.asset_type], ['דלק', vehicle.fuel_type], ['יצרן', vehicle.manufacturer], ['דגם', vehicle.model], ['שנה', vehicle.year], ['מספר שילדה', vehicle.chassis_number], ['תאריך רכישה', fmtDate(vehicle.purchase_date)], ['זכאי להחזר סולר', vehicle.eligible_diesel_refund ? 'כן ✅' : 'לא']].map(([k,v])=>(
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid #f3f4f6',fontSize:14}}>
                  <span style={{color:'#6b7280'}}>{k}</span><span style={{fontWeight:500}}>{v||'—'}</span>
                </div>
              ))}
              {vehicle.notes && <div style={{marginTop:12,padding:10,background:'#f9fafb',borderRadius:6,fontSize:13}}>{vehicle.notes}</div>}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">אחראים משויכים</span></div>
            <div className="card-body">
              {vehicle.employees?.length === 0 && <div style={{color:'#9ca3af',fontSize:14}}>אין עובדים משויכים</div>}
              {vehicle.employees?.map(e=>(
                <div key={e.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #f3f4f6'}}>
                  <div><div style={{fontWeight:600}}>{e.name}</div><div style={{fontSize:12,color:'#6b7280'}}>{e.role}</div></div>
                  <div style={{textAlign:'left'}}>{e.is_responsible && <span className="badge badge-blue">אחראי</span>}<div style={{fontSize:12,color:'#6b7280'}}>{e.phone}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Purchase Details */}
        <div className="card" style={{marginTop:20}}>
          <div className="card-header">
            <span className="card-title">🛒 פרטי רכישה</span>
            {isAdmin && <button className="btn btn-secondary btn-sm" onClick={openPurchaseEdit}>✏️ עריכה</button>}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:20,padding:16}}>
            {[
              ['תאריך רכישה', fmtDate(vehicle.purchase_date)],
              ['סכום רכישה', fmtCur(vehicle.purchase_amount)],
              ['אופן תשלום', vehicle.purchase_payment_method],
              ['מספר תשלומים', vehicle.purchase_num_payments],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{fontSize:12,color:'#6b7280',marginBottom:4}}>{label}</div>
                <div style={{fontWeight:600,fontSize:15}}>{val || '—'}</div>
              </div>
            ))}
          </div>
          {vehicle.purchase_doc_url && (
            <div style={{padding:'0 16px 16px'}}>
              <a href={vehicle.purchase_doc_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">📄 מסמך רכישה</a>
            </div>
          )}
          {!vehicle.purchase_doc_url && isAdmin && (
            <div style={{padding:'0 16px 16px'}}>
              <label className="btn btn-secondary btn-sm" style={{cursor:'pointer'}}>
                {uploading ? '⏳ מעלה...' : '📎 העלה מסמך רכישה'}
                <input type="file" style={{display:'none'}} accept=".pdf,.jpg,.jpeg,.png"
                  onChange={e => e.target.files[0] && uploadPurchaseDoc(e.target.files[0])} />
              </label>
            </div>
          )}
        </div>

        {/* Purchase Edit Modal */}
        {showPurchaseModal && (
          <ModalWrapper title={`פרטי רכישה — ${vehicle.vehicle_number}`} onClose={() => setShowPurchaseModal(false)} onSave={savePurchase} saving={purchaseSaving}>
            <div className="form-row">
              <Field label="תאריך רכישה"><input className="form-control" type="date" value={purchaseForm.purchase_date||''} onChange={e=>setPurchaseForm(p=>({...p,purchase_date:e.target.value}))}/></Field>
              <Field label="סכום (₪)"><input className="form-control" type="number" value={purchaseForm.purchase_amount||''} onChange={e=>setPurchaseForm(p=>({...p,purchase_amount:+e.target.value}))}/></Field>
            </div>
            <div className="form-row">
              <Field label="אופן תשלום">
                <input className="form-control" list="pay-methods" value={purchaseForm.purchase_payment_method||''} onChange={e=>setPurchaseForm(p=>({...p,purchase_payment_method:e.target.value}))}/>
                <datalist id="pay-methods">{['מזומן','אשראי','העברה בנקאית','ליסינג','צ\'ק','מימון בנקאי'].map(v=><option key={v} value={v}/>)}</datalist>
              </Field>
              <Field label="מספר תשלומים"><input className="form-control" type="number" min="1" value={purchaseForm.purchase_num_payments||''} onChange={e=>setPurchaseForm(p=>({...p,purchase_num_payments:+e.target.value}))}/></Field>
            </div>
            <Field label="מסמך רכישה">
              <label className="btn btn-secondary btn-sm" style={{cursor:'pointer',display:'inline-block'}}>
                {uploading ? '⏳ מעלה...' : (purchaseForm.purchase_doc_url ? '📄 החלף מסמך' : '📎 העלה מסמך')}
                <input type="file" style={{display:'none'}} accept=".pdf,.jpg,.jpeg,.png"
                  onChange={e => e.target.files[0] && uploadPurchaseDoc(e.target.files[0])} />
              </label>
              {purchaseForm.purchase_doc_url && (
                <a href={purchaseForm.purchase_doc_url} target="_blank" rel="noopener noreferrer" style={{marginRight:10,fontSize:13}}>צפה במסמך</a>
              )}
            </Field>
          </ModalWrapper>
        )}
        </>
      )}

      {/* ═══════════════ טיפולים ═══════════════ */}
      {tab === 'טיפולים' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔧 היסטוריית טיפולים</span>
            {isAdmin && <button className="btn btn-primary btn-sm" onClick={openAddMaintenance}>+ הוסף טיפול</button>}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>תאריך</th><th>סוג</th><th>מוסך</th><th>תיאור</th><th>ק"מ</th><th>עלות</th><th>סטטוס</th><th>תאריך הבא</th>{isAdmin && <th></th>}</tr></thead>
              <tbody>
                {vehicle.maintenance?.map(m=>(
                  <tr key={m.id}>
                    <td>{fmtDate(m.maintenance_date)}</td>
                    <td>{m.maintenance_type}</td>
                    <td>{m.garage_name||'—'}</td>
                    <td style={{maxWidth:200,fontSize:12}}>{m.description}</td>
                    <td>{m.odometer?.toLocaleString()}</td>
                    <td>{fmtCur(m.cost)}</td>
                    <td>{statusBadge(m.status)}</td>
                    <td style={{color: m.next_date && new Date(m.next_date)<new Date()?'#dc2626':''}}>{fmtDate(m.next_date)}</td>
                    {isAdmin && <td><button className="btn btn-secondary btn-sm" onClick={()=>openEditMaintenance(m)}>✏️</button></td>}
                  </tr>
                ))}
                {!vehicle.maintenance?.length && <tr><td colSpan={isAdmin?9:8} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין טיפולים</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Maintenance Modal */}
      {showMaintenanceModal && (
        <ModalWrapper title={editingMaintenance ? 'עריכת טיפול' : 'הוספת טיפול'} onClose={() => setShowMaintenanceModal(false)} onSave={saveMaintenance} saving={maintenanceSaving}>
          <div className="form-row">
            <Field label="סוג טיפול">
              <input className="form-control" list="maint-types" value={maintenanceForm.maintenance_type||''} onChange={e=>setMaintenanceForm(f=>({...f,maintenance_type:e.target.value}))}/>
              <datalist id="maint-types">{['טיפול תקופתי','החלפת שמן','בלמים','גלגלים','מצבר','פילטרים','תיקון כללי','אחר'].map(v=><option key={v} value={v}/>)}</datalist>
            </Field>
            <Field label="תאריך">{inp(maintenanceForm, setMaintenanceForm, 'maintenance_date', 'date')}</Field>
          </div>
          <div className="form-row">
            <Field label='ק"מ נוכחי'>{inp(maintenanceForm, setMaintenanceForm, 'odometer', 'number')}</Field>
            <Field label="עלות (₪)">{inp(maintenanceForm, setMaintenanceForm, 'cost', 'number')}</Field>
          </div>
          <div className="form-row">
            <Field label="סטטוס">{sel(maintenanceForm, setMaintenanceForm, 'status', ['בוצע','בהמתנה','בתיקון','בוטל'])}</Field>
            <Field label="טיפול הבא">{inp(maintenanceForm, setMaintenanceForm, 'next_date', 'date')}</Field>
          </div>
          <Field label="תיאור">
            <textarea className="form-control" rows={2} value={maintenanceForm.description||''} onChange={e=>setMaintenanceForm(f=>({...f,description:e.target.value}))}/>
          </Field>
        </ModalWrapper>
      )}

      {/* ═══════════════ בדיקות ═══════════════ */}
      {tab === 'בדיקות' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">📋 בדיקות רכב</span>
            {isAdmin && <button className="btn btn-primary btn-sm" onClick={openAddInspection}>+ הוסף בדיקה</button>}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>תאריך</th><th>סוג</th><th>בודק</th><th>עלות</th><th>עבר?</th><th>בדיקה הבאה</th>{isAdmin && <th></th>}</tr></thead>
              <tbody>
                {vehicle.inspections?.map(i=>(
                  <tr key={i.id}>
                    <td>{fmtDate(i.inspection_date)}</td>
                    <td>{i.inspection_type}</td>
                    <td>{i.inspector||'—'}</td>
                    <td>{fmtCur(i.cost)}</td>
                    <td>{i.passed ? <span className="badge badge-green">עבר ✓</span> : <span className="badge badge-red">נכשל ✗</span>}</td>
                    <td style={{color: i.next_inspection_date && new Date(i.next_inspection_date)<new Date()?'#dc2626':''}}>{fmtDate(i.next_inspection_date)}</td>
                    {isAdmin && <td><button className="btn btn-secondary btn-sm" onClick={()=>openEditInspection(i)}>✏️</button></td>}
                  </tr>
                ))}
                {!vehicle.inspections?.length && <tr><td colSpan={isAdmin?7:6} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין בדיקות</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Inspection Modal */}
      {showInspectionModal && (
        <ModalWrapper title={editingInspection ? 'עריכת בדיקה' : 'הוספת בדיקה'} onClose={() => setShowInspectionModal(false)} onSave={saveInspection} saving={inspectionSaving}>
          <div className="form-row">
            <Field label="סוג בדיקה">
              <input className="form-control" list="insp-types" value={inspectionForm.inspection_type||''} onChange={e=>setInspectionForm(f=>({...f,inspection_type:e.target.value}))}/>
              <datalist id="insp-types">{['טסט','בדיקה שנתית','בדיקת גפ"מ','בדיקת בלמים','בדיקת פליטה','אחר'].map(v=><option key={v} value={v}/>)}</datalist>
            </Field>
            <Field label="תאריך בדיקה">{inp(inspectionForm, setInspectionForm, 'inspection_date', 'date')}</Field>
          </div>
          <div className="form-row">
            <Field label="בדיקה הבאה">{inp(inspectionForm, setInspectionForm, 'next_inspection_date', 'date')}</Field>
            <Field label="בודק">{inp(inspectionForm, setInspectionForm, 'inspector')}</Field>
          </div>
          <div className="form-row">
            <Field label="עלות (₪)">{inp(inspectionForm, setInspectionForm, 'cost', 'number')}</Field>
            <Field label="עבר?">
              <select className="form-control" value={inspectionForm.passed ? 'true' : 'false'} onChange={e=>setInspectionForm(f=>({...f,passed:e.target.value==='true'}))}>
                <option value="true">עבר ✓</option>
                <option value="false">נכשל ✗</option>
              </select>
            </Field>
          </div>
          <Field label="הערות">
            <textarea className="form-control" rows={2} value={inspectionForm.notes||''} onChange={e=>setInspectionForm(f=>({...f,notes:e.target.value}))}/>
          </Field>
        </ModalWrapper>
      )}

      {/* ═══════════════ כרטיסי דלק ═══════════════ */}
      {tab === 'כרטיסי דלק' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">⛽ כרטיסי דלק</span>
            {isAdmin && <button className="btn btn-primary btn-sm" onClick={openAddFuelCard}>+ הוסף כרטיס</button>}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>מספר כרטיס</th><th>ספק</th><th>סוג דלק</th><th>סטטוס</th><th>הגבלה יומית</th><th>הגבלה חודשית</th>{isAdmin && <th></th>}</tr></thead>
              <tbody>
                {vehicle.fuel_cards?.map(fc=>(
                  <tr key={fc.id}>
                    <td style={{fontWeight:600}}>{fc.card_number}</td>
                    <td>{fc.supplier}</td>
                    <td>{fc.fuel_type}</td>
                    <td>{statusBadge(fc.status)}</td>
                    <td>{fmtCur(fc.daily_limit)}</td>
                    <td>{fmtCur(fc.monthly_limit)}</td>
                    {isAdmin && <td><button className="btn btn-secondary btn-sm" onClick={()=>openEditFuelCard(fc)}>✏️</button></td>}
                  </tr>
                ))}
                {!vehicle.fuel_cards?.length && <tr><td colSpan={isAdmin?7:6} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין כרטיסי דלק</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fuel Card Modal */}
      {showFuelCardModal && (
        <ModalWrapper title={editingFuelCard ? 'עריכת כרטיס דלק' : 'הוספת כרטיס דלק'} onClose={() => setShowFuelCardModal(false)} onSave={saveFuelCard} saving={fuelCardSaving}>
          <div className="form-row">
            <Field label="מספר כרטיס">{inp(fuelCardForm, setFuelCardForm, 'card_number')}</Field>
            <Field label="ספק">
              <input className="form-control" list="fuel-suppliers" value={fuelCardForm.supplier||''} onChange={e=>setFuelCardForm(f=>({...f,supplier:e.target.value}))}/>
              <datalist id="fuel-suppliers">{['פז','דלק','סונול','Ten','אחר'].map(v=><option key={v} value={v}/>)}</datalist>
            </Field>
          </div>
          <div className="form-row">
            <Field label="סוג דלק">{sel(fuelCardForm, setFuelCardForm, 'fuel_type', ['סולר','בנזין','גז','חשמל'])}</Field>
            <Field label="סטטוס">{sel(fuelCardForm, setFuelCardForm, 'status', ['פעיל','לא פעיל','חסום'])}</Field>
          </div>
          <div className="form-row">
            <Field label="הגבלה יומית (₪)">{inp(fuelCardForm, setFuelCardForm, 'daily_limit', 'number')}</Field>
            <Field label="הגבלה חודשית (₪)">{inp(fuelCardForm, setFuelCardForm, 'monthly_limit', 'number')}</Field>
          </div>
          <Field label="הערות">
            <textarea className="form-control" rows={2} value={fuelCardForm.notes||''} onChange={e=>setFuelCardForm(f=>({...f,notes:e.target.value}))}/>
          </Field>
        </ModalWrapper>
      )}

      {/* ═══════════════ ביטוח ═══════════════ */}
      {tab === 'ביטוח' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">🛡️ פוליסות ביטוח</span>
            {isAdmin && <button className="btn btn-primary btn-sm" onClick={openAddInsurance}>+ הוספת פוליסה</button>}
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {[
                    { col:'policy_number', label:'מספר פוליסה' },
                    { col:'coverage_type', label:'סוג כיסוי' },
                    { col:'insurer', label:'מבטח' },
                    { col:'start_date', label:'מתאריך' },
                    { col:'expiry_date', label:'עד תאריך' },
                    { col:'total_premium', label:'פרמיה כוללת' },
                    { col:'num_payments', label:'תשלומים' },
                    { col:'status', label:'סטטוס' },
                  ].map(({col, label}) => (
                    <th key={col} style={{cursor:'pointer', userSelect:'none', whiteSpace:'nowrap'}}
                      onClick={() => toggleInsSort(col)}>
                      {label} {insSort.col===col ? (insSort.dir==='asc'?'↑':'↓') : ''}
                    </th>
                  ))}
                  {isAdmin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {sortedPolicies(vehicle.policies).map((p, idx, arr) => {
                  const isInactive = ['הסתיימה','בוטלה','לא פעילה','בהקפאה'].includes(p.status);
                  const prevInactive = idx > 0 && ['הסתיימה','בוטלה','לא פעילה','בהקפאה'].includes(arr[idx-1]?.status);
                  const firstInactive = isInactive && !prevInactive;
                  return (
                    <React.Fragment key={p.id}>
                      {firstInactive && (
                        <tr><td colSpan={isAdmin?9:8} style={{background:'#f1f5f9',padding:'4px 12px',fontSize:11,color:'#64748b',fontWeight:600}}>— פוליסות לא פעילות —</td></tr>
                      )}
                      <tr style={{opacity: isInactive ? 0.6 : 1, background: isInactive ? '#fafafa' : ''}}>
                        <td style={{fontWeight:600}}>{p.policy_number}</td>
                        <td>{p.coverage_type}</td>
                        <td>{p.insurer}</td>
                        <td>{fmtDate(p.start_date)}</td>
                        <td style={{color: !isInactive && p.expiry_date && new Date(p.expiry_date)<new Date(Date.now()+30*86400000)?'#dc2626':''}}>{fmtDate(p.expiry_date)}</td>
                        <td>{fmtCur(p.total_premium)}</td>
                        <td>{p.num_payments}</td>
                        <td>{statusBadge(p.status)}</td>
                        {isAdmin && <td><button className="btn btn-secondary btn-sm" onClick={()=>openEditInsurance(p)}>✏️</button></td>}
                      </tr>
                    </React.Fragment>
                  );
                })}
                {!vehicle.policies?.length && <tr><td colSpan={isAdmin?9:8} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין פוליסות</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Insurance Modal */}
      {showInsuranceModal && (
        <ModalWrapper title={editingInsurance ? `עריכת פוליסה ${editingInsurance.policy_number||''}` : 'הוספת פוליסה'} onClose={() => setShowInsuranceModal(false)} onSave={saveInsurance} saving={insuranceSaving}>
          <div className="form-row">
            <Field label="מספר פוליסה">{inp(insuranceForm, setInsuranceForm, 'policy_number')}</Field>
            <Field label="סוג כיסוי">{sel(insuranceForm, setInsuranceForm, 'coverage_type', ['חובה','מקיף','צד ג\'','חובה + מקיף','חובה + צד ג\'','אחר'])}</Field>
          </div>
          <div className="form-row">
            <Field label="חברת ביטוח">
              <input className="form-control" list="insurers" value={insuranceForm.insurer||''} onChange={e=>setInsuranceForm(f=>({...f,insurer:e.target.value}))}/>
              <datalist id="insurers">{['מגדל','הפניקס','הראל','כלל','מנורה','איילון','הדר','שומרה','אחר'].map(v=><option key={v} value={v}/>)}</datalist>
            </Field>
            <Field label="סטטוס">{sel(insuranceForm, setInsuranceForm, 'status', ['פעילה','בוטלה','בהקפאה'])}</Field>
          </div>
          <div className="form-row">
            <Field label="תאריך התחלה">
              <input className="form-control" type="date"
                value={insuranceForm.start_date?.split('T')[0]||''}
                onChange={e=>{
                  const val = e.target.value;
                  setInsuranceForm(f=>({...f, start_date: val}));
                  setTimeout(() => setInsScheduleItems(buildAutoSchedule({...insuranceForm, start_date: val}, insuranceForm.charge_method_id)), 0);
                }}/>
            </Field>
            <Field label="תאריך סיום">{inp(insuranceForm, setInsuranceForm, 'expiry_date', 'date')}</Field>
          </div>
          <div className="form-row">
            <Field label="פרמיה כוללת (₪)">{inp(insuranceForm, setInsuranceForm, 'total_premium', 'number')}</Field>
            <Field label="מספר תשלומים">{inp(insuranceForm, setInsuranceForm, 'num_payments', 'number', {min:1})}</Field>
          </div>
          <Field label="אמצעי תשלום">
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <select className="form-control" style={{flex:1}}
                value={insuranceForm.charge_method_id||''}
                onChange={e=>{
                  const pmId = +e.target.value||null;
                  setInsuranceForm(f=>({...f, charge_method_id: pmId}));
                  setTimeout(() => setInsScheduleItems(buildAutoSchedule({...insuranceForm, charge_method_id: pmId}, pmId)), 0);
                }}>
                <option value="">בחר אמצעי תשלום</option>
                {paymentMethods.map(pm=><option key={pm.id} value={pm.id}>{pm.name}{pm.charge_day?` (יום ${pm.charge_day})`:''}</option>)}
              </select>
              <button className="btn btn-secondary btn-sm" type="button" onClick={()=>{setShowAddPM(true);setNewPMForm({});}} title="הוסף אמצעי תשלום חדש">+ חדש</button>
            </div>
            {(() => {
              const pm = paymentMethods.find(p => p.id === insuranceForm.charge_method_id);
              const firstDate = calcFirstChargeDate(insuranceForm.start_date || new Date().toISOString().split('T')[0], pm);
              if (!pm || !firstDate) return null;
              const isAuto = pm.charge_day && (pm.payment_type === 'אשראי' || (pm.payment_type && pm.payment_type.includes('הו')));
              return (
                <div style={{fontSize:12, color: isAuto ? '#0369a1' : '#64748b', marginTop:4, fontWeight:600}}>
                  📅 {isAuto ? `חיוב ראשון מחושב: ${new Date(firstDate).toLocaleDateString('he-IL')} (יום ${pm.charge_day} לחודש)` : `חיוב ראשון: ${new Date(firstDate).toLocaleDateString('he-IL')}`}
                </div>
              );
            })()}
            {showAddPM && (
              <div style={{marginTop:10,padding:12,background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:8}}>
                <div style={{fontWeight:600,marginBottom:8,fontSize:13}}>➕ הוספת אמצעי תשלום חדש</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                  <input className="form-control" placeholder="שם (חובה)" value={newPMForm.name||''} onChange={e=>setNewPMForm(f=>({...f,name:e.target.value}))}/>
                  <select className="form-control" value={newPMForm.payment_type||''} onChange={e=>setNewPMForm(f=>({...f,payment_type:e.target.value}))}>
                    <option value="">סוג</option>
                    {['אשראי','העברה בנקאית',"הו\"\"ק",'צ\'ק','מזומן'].map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className="form-control" placeholder="4 ספרות אחרונות (לאשראי)" maxLength={4} value={newPMForm.last_4_digits||''} onChange={e=>setNewPMForm(f=>({...f,last_4_digits:e.target.value}))}/>
                  <input className="form-control" placeholder="חברה / בנק" value={newPMForm.company||''} onChange={e=>setNewPMForm(f=>({...f,company:e.target.value}))}/>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn btn-primary btn-sm" onClick={saveNewPM} disabled={savingPM}>{savingPM?'שומר...':'שמור'}</button>
                  <button className="btn btn-secondary btn-sm" onClick={()=>setShowAddPM(false)}>ביטול</button>
                </div>
              </div>
            )}
          </Field>
          <div style={{ borderTop:'1px solid #e5e7eb', paddingTop:12, marginTop:4 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontWeight:700, fontSize:14 }}>📅 פריסת תשלומים ({insScheduleItems.length} תשלומים)</span>
              <div style={{ display:'flex', gap:8 }}>
                <button type="button" className="btn btn-secondary btn-sm"
                  onClick={() => setInsScheduleItems(buildAutoSchedule(insuranceForm, insuranceForm.charge_method_id))}>
                  🔄 חשב מחדש
                </button>
                <button type="button" className="btn btn-secondary btn-sm"
                  onClick={() => setShowInsSchedule(s => !s)}>
                  {showInsSchedule ? '🔼 סגור' : '🔽 הצג/ערוך'}
                </button>
              </div>
            </div>
            {showInsSchedule && (
              <div style={{ maxHeight:300, overflowY:'auto', border:'1px solid #e5e7eb', borderRadius:6 }}>
                <table style={{ width:'100%', fontSize:12, borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#f8fafc' }}>
                      <th style={{ padding:'6px 8px', textAlign:'right', borderBottom:'1px solid #e5e7eb' }}>#</th>
                      <th style={{ padding:'6px 8px', textAlign:'right', borderBottom:'1px solid #e5e7eb' }}>תאריך</th>
                      <th style={{ padding:'6px 8px', textAlign:'right', borderBottom:'1px solid #e5e7eb' }}>סכום (₪)</th>
                      <th style={{ padding:'6px 8px', textAlign:'right', borderBottom:'1px solid #e5e7eb' }}>אמצעי תשלום</th>
                    </tr>
                  </thead>
                  <tbody>
                    {insScheduleItems.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'4px 8px', color:'#64748b' }}>{item.installment_number}</td>
                        <td style={{ padding:'4px 8px' }}>
                          <input type="date" style={{ border:'1px solid #e5e7eb', borderRadius:4, padding:'2px 4px', fontSize:12, width:130 }}
                            value={item.charge_date || ''}
                            onChange={e => setInsScheduleItems(s => s.map((it,i) => i===idx ? {...it, charge_date:e.target.value, charge_month:e.target.value.substring(0,7)} : it))}
                          />
                        </td>
                        <td style={{ padding:'4px 8px' }}>
                          <input type="number" style={{ border:'1px solid #e5e7eb', borderRadius:4, padding:'2px 4px', fontSize:12, width:90 }}
                            value={item.amount || ''}
                            onChange={e => setInsScheduleItems(s => s.map((it,i) => i===idx ? {...it, amount:+e.target.value} : it))}
                          />
                        </td>
                        <td style={{ padding:'4px 8px' }}>
                          <select style={{ border:'1px solid #e5e7eb', borderRadius:4, padding:'2px 4px', fontSize:12 }}
                            value={item.payment_method_id || ''}
                            onChange={e => setInsScheduleItems(s => s.map((it,i) => i===idx ? {...it, payment_method_id:+e.target.value||null} : it))}>
                            <option value="">ללא</option>
                            {paymentMethods.map(pm => <option key={pm.id} value={pm.id}>{pm.name}</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <Field label="הערות">
            <textarea className="form-control" rows={2} value={insuranceForm.notes||''} onChange={e=>setInsuranceForm(f=>({...f,notes:e.target.value}))}/>
          </Field>
        </ModalWrapper>
      )}

      {/* ═══════════════ מיגון ═══════════════ */}
      {tab === 'מיגון' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔒 מיגון לרכב</span>
            {isAdmin && <button className="btn btn-primary btn-sm" onClick={openAddSecurity}>+ הוסף מיגון</button>}
          </div>
          <div className="card-body">
            {vehicle.security?.map(s=>(
              <div key={s.id} style={{padding:'12px',border:'1px solid #e5e7eb',borderRadius:8,marginBottom:10,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div>
                  <div style={{fontWeight:600}}>{s.company_name} — {s.security_type}</div>
                  <div style={{fontSize:13,color:'#6b7280',marginTop:4}}>התקנה: {fmtDate(s.installation_date)} | חידוש: {fmtDate(s.renewal_date)} | דמי יונמ: {fmtCur(s.subscription_fee)}/חודש</div>
                </div>
                {isAdmin && <button className="btn btn-secondary btn-sm" onClick={()=>openEditSecurity(s)}>✏️</button>}
              </div>
            ))}
            {!vehicle.security?.length && <div style={{color:'#9ca3af'}}>אין מיגון רשום</div>}
          </div>
        </div>
      )}

      {/* Security Modal */}
      {showSecurityModal && (
        <ModalWrapper title={editingSecurity ? 'עריכת מיגון' : 'הוספת מיגון'} onClose={() => setShowSecurityModal(false)} onSave={saveSecurity} saving={securitySaving}>
          <div className="form-row">
            <Field label="סוג מיגון">
              <input className="form-control" list="sec-types" value={securityForm.security_type||''} onChange={e=>setSecurityForm(f=>({...f,security_type:e.target.value}))}/>
              <datalist id="sec-types">{['מכשיר אזעקה','GPS','אימובילייזר','מנעול הגה','ממסר סמוי','אחר'].map(v=><option key={v} value={v}/>)}</datalist>
            </Field>
            <Field label="תאריך התקנה">{inp(securityForm, setSecurityForm, 'installation_date', 'date')}</Field>
          </div>
          <div className="form-row">
            <Field label="תאריך חידוש">{inp(securityForm, setSecurityForm, 'renewal_date', 'date')}</Field>
            <Field label="דמי מנוי (₪/חודש)">{inp(securityForm, setSecurityForm, 'subscription_fee', 'number')}</Field>
          </div>
          <Field label="הערות">
            <textarea className="form-control" rows={2} value={securityForm.notes||''} onChange={e=>setSecurityForm(f=>({...f,notes:e.target.value}))}/>
          </Field>
        </ModalWrapper>
      )}

      {/* ═══════════════ כלי עבודה ═══════════════ */}
      {tab === 'כלי עבודה' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">🔩 כלי עבודה</span>
            {isAdmin && <button className="btn btn-primary btn-sm" onClick={openAddTool}>+ הוסף כלי</button>}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>מספר סידורי</th><th>סוג כלי</th><th>סטטוס</th><th>נדרש ריקורד?</th>{isAdmin && <th></th>}</tr></thead>
              <tbody>
                {vehicle.tools?.map(t=>(
                  <tr key={t.id}>
                    <td>{t.serial_number}</td>
                    <td>{t.tool_type}</td>
                    <td>{statusBadge(t.status)}</td>
                    <td>{t.requires_inspection?'כן':'לא'}</td>
                    {isAdmin && <td><button className="btn btn-secondary btn-sm" onClick={()=>openEditTool(t)}>✏️</button></td>}
                  </tr>
                ))}
                {!vehicle.tools?.length && <tr><td colSpan={isAdmin?5:4} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין כלי עבודה</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tool Modal */}
      {showToolModal && (
        <ModalWrapper title={editingTool ? 'עריכת כלי עבודה' : 'הוספת כלי עבודה'} onClose={() => setShowToolModal(false)} onSave={saveTool} saving={toolSaving}>
          <div className="form-row">
            <Field label="מספר סידורי">{inp(toolForm, setToolForm, 'serial_number')}</Field>
            <Field label="סוג כלי">
              <input className="form-control" list="tool-types" value={toolForm.tool_type||''} onChange={e=>setToolForm(f=>({...f,tool_type:e.target.value}))}/>
              <datalist id="tool-types">{['מדחס','גנרטור','מנוף','משאבה','ריתוך','אחר'].map(v=><option key={v} value={v}/>)}</datalist>
            </Field>
          </div>
          <div className="form-row">
            <Field label="סטטוס">{sel(toolForm, setToolForm, 'status', ['פעיל','לא פעיל','בתיקון'])}</Field>
            <Field label="נדרש ריקורד?">
              <select className="form-control" value={toolForm.requires_inspection ? 'true' : 'false'} onChange={e=>setToolForm(f=>({...f,requires_inspection:e.target.value==='true'}))}>
                <option value="false">לא</option>
                <option value="true">כן</option>
              </select>
            </Field>
          </div>
          <Field label="הערות">
            <textarea className="form-control" rows={2} value={toolForm.notes||''} onChange={e=>setToolForm(f=>({...f,notes:e.target.value}))}/>
          </Field>
        </ModalWrapper>
      )}

      {/* ═══════════════ החזרי סולר ═══════════════ */}
      {tab === 'החזרי סולר' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">⛽ החזרי סולר (רלו)</span>
            {isAdmin && <button className="btn btn-primary btn-sm" onClick={openAddDiesel}>+ הוסף החזר</button>}
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>תקופה</th><th>ליטרים</th><th>סכום</th><th>סטטוס</th><th>תאריך הגשה</th><th>תאריך קבלה</th>{isAdmin && <th></th>}</tr></thead>
              <tbody>
                {vehicle.diesel_refunds?.map(r=>(
                  <tr key={r.id}>
                    <td>{r.period}</td>
                    <td>{r.liters?.toLocaleString()}</td>
                    <td>{fmtCur(r.amount)}</td>
                    <td>{statusBadge(r.refund_status)}</td>
                    <td>{fmtDate(r.submission_date)}</td>
                    <td>{fmtDate(r.actual_receipt_date)}</td>
                    {isAdmin && <td><button className="btn btn-secondary btn-sm" onClick={()=>openEditDiesel(r)}>✏️</button></td>}
                  </tr>
                ))}
                {!vehicle.diesel_refunds?.length && <tr><td colSpan={isAdmin?7:6} style={{textAlign:'center',color:'#9ca3af',padding:20}}>אין נתוני החזרי סולר</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════ מסמכים ═══════════════ */}
      {tab === 'מסמכים' && (
        <DocumentsTab vehicleId={id} />
      )}

      {/* ═══════════════ נתונים חסרים ═══════════════ */}
      {tab === 'נתונים חסרים' && (
        <MissingDataTab vehicleId={id} />
      )}

      {/* Diesel Refund Modal */}
      {showDieselModal && (
        <ModalWrapper title={editingDiesel ? 'עריכת החזר סולר' : 'הוספת החזר סולר'} onClose={() => setShowDieselModal(false)} onSave={saveDiesel} saving={dieselSaving}>
          <div className="form-row">
            <Field label="תקופה (לדוג׳ 2024-Q1)">{inp(dieselForm, setDieselForm, 'period')}</Field>
            <Field label="ליטרים">{inp(dieselForm, setDieselForm, 'liters', 'number')}</Field>
          </div>
          <div className="form-row">
            <Field label="סכום (₪)">{inp(dieselForm, setDieselForm, 'amount', 'number')}</Field>
            <Field label="סטטוס">{sel(dieselForm, setDieselForm, 'refund_status', ['פתוח','הוגש','התקבל','בוטל'])}</Field>
          </div>
          <div className="form-row">
            <Field label="תאריך הגשה">{inp(dieselForm, setDieselForm, 'submission_date', 'date')}</Field>
            <Field label="תאריך קבלה">{inp(dieselForm, setDieselForm, 'actual_receipt_date', 'date')}</Field>
          </div>
          <Field label="הערות">
            <textarea className="form-control" rows={2} value={dieselForm.notes||''} onChange={e=>setDieselForm(f=>({...f,notes:e.target.value}))}/>
          </Field>
        </ModalWrapper>
      )}
    </div>
  );
}
