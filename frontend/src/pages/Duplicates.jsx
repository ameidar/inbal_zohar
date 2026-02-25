import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

function fmtDate(d) { return d ? new Date(d).toLocaleDateString('he-IL') : '—'; }
function fmtAmount(n) { return n ? Number(n).toLocaleString('he-IL', { style: 'currency', currency: 'ILS' }) : '—'; }

function MergeModal({ primaryRecord, secondaryRecord, fields, onConfirm, onClose }) {
  const [overrides, setOverrides] = useState({});
  const [merging, setMerging] = useState(false);

  async function doMerge() {
    setMerging(true);
    try {
      await onConfirm(overrides);
      onClose();
    } catch (e) { alert(e.message); setMerging(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: '100%', maxWidth: 700, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0 }}>🔀 מיזוג רשומות</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>

        <div style={{ marginBottom: 12, padding: 12, background: '#fef3c7', borderRadius: 8, fontSize: 13 }}>
          <strong>ראשי:</strong> #{primaryRecord?.id} — <strong>משני:</strong> #{secondaryRecord?.id}
          <br />פרטי הרשומה הראשית יישמרו. ניתן לבחור ידנית ערכים מהרשומה המשנית.
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th style={{ padding: 8, textAlign: 'right' }}>שדה</th>
              <th style={{ padding: 8, textAlign: 'right', color: '#15803d' }}>ראשי</th>
              <th style={{ padding: 8, textAlign: 'right', color: '#dc2626' }}>משני</th>
              <th style={{ padding: 8, textAlign: 'center' }}>שמור מ...</th>
            </tr>
          </thead>
          <tbody>
            {fields.map(field => {
              const valA = primaryRecord?.[field];
              const valB = secondaryRecord?.[field];
              const isDiff = String(valA) !== String(valB);
              return (
                <tr key={field} style={{ borderTop: '1px solid #f1f5f9', background: isDiff ? '#fffbeb' : '' }}>
                  <td style={{ padding: 8, fontWeight: 600, color: '#374151' }}>{field}</td>
                  <td style={{ padding: 8, color: '#15803d' }}>{valA ?? '—'}</td>
                  <td style={{ padding: 8, color: '#dc2626' }}>{valB ?? '—'}</td>
                  <td style={{ padding: 8, textAlign: 'center' }}>
                    {isDiff ? (
                      <select
                        value={overrides[field] !== undefined ? 'secondary' : 'primary'}
                        onChange={e => {
                          if (e.target.value === 'secondary') {
                            setOverrides(o => ({ ...o, [field]: valB }));
                          } else {
                            setOverrides(o => { const n = { ...o }; delete n[field]; return n; });
                          }
                        }}
                        style={{ padding: '2px 8px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 12 }}
                      >
                        <option value="primary">ראשי</option>
                        <option value="secondary">משני</option>
                      </select>
                    ) : (
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>זהה</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
          <button className="btn-danger" onClick={doMerge} disabled={merging}>
            {merging ? 'ממזג...' : '🔀 בצע מיזוג'}
          </button>
        </div>
      </div>
    </div>
  );
}

function VehicleGroup({ group, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [mergeModal, setMergeModal] = useState(null);
  const [primaryId, setPrimaryId] = useState('');
  const [secondaryId, setSecondaryId] = useState('');
  const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');
  const isAdmin = user.role === 'admin';

  const VEHICLE_FIELDS = ['vehicle_number', 'nickname', 'manufacturer', 'model', 'year', 'chassis_number', 'fuel_type', 'status', 'notes'];

  async function doMerge(overrides) {
    await api.mergeVehicles(parseInt(primaryId), parseInt(secondaryId), overrides);
    onRefresh();
  }

  const primary = group.vehicles?.find(v => v.id === parseInt(primaryId));
  const secondary = group.vehicles?.find(v => v.id === parseInt(secondaryId));

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
      <div
        style={{ padding: '12px 16px', background: group.warning_only ? '#fef9c3' : '#fee2e2', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div>
          <strong style={{ fontSize: 14 }}>{group.warning_only ? '⚠️' : '🚨'} {group.match_reason}</strong>
          <span style={{ marginRight: 12, color: '#6b7280', fontSize: 13 }}>{group.count} רכבים</span>
        </div>
        <span style={{ color: '#6b7280' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ padding: 16 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8f9fa' }}>
                  <th style={{ padding: 8, textAlign: 'right' }}>מספר רכב</th>
                  <th style={{ padding: 8, textAlign: 'right' }}>כינוי</th>
                  <th style={{ padding: 8, textAlign: 'right' }}>יצרן/דגם</th>
                  <th style={{ padding: 8, textAlign: 'right' }}>שנה</th>
                  <th style={{ padding: 8, textAlign: 'right' }}>סטטוס</th>
                  <th style={{ padding: 8, textAlign: 'right' }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {group.vehicles?.map(v => (
                  <tr key={v.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: 8 }}><Link to={`/dept/vehicles/${v.id}/overview`} style={{ color: 'var(--primary)' }}>{v.vehicle_number}</Link></td>
                    <td style={{ padding: 8 }}>{v.nickname || '—'}</td>
                    <td style={{ padding: 8 }}>{v.manufacturer} {v.model}</td>
                    <td style={{ padding: 8 }}>{v.year || '—'}</td>
                    <td style={{ padding: 8 }}>{v.status || '—'}</td>
                    <td style={{ padding: 8 }}>
                      <Link to={`/dept/vehicles/${v.id}/overview`}>
                        <button className="btn-sm">פתח</button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isAdmin && !group.warning_only && (
            <div style={{ marginTop: 16, padding: 12, background: '#f8f9fa', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>🔀 מיזוג רכבים</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="input-field" style={{ width: 'auto' }} value={primaryId} onChange={e => setPrimaryId(e.target.value)}>
                  <option value="">-- ראשי --</option>
                  {group.vehicles?.map(v => <option key={v.id} value={v.id}>{v.vehicle_number} (#{v.id})</option>)}
                </select>
                <span style={{ color: '#6b7280' }}>←</span>
                <select className="input-field" style={{ width: 'auto' }} value={secondaryId} onChange={e => setSecondaryId(e.target.value)}>
                  <option value="">-- משני --</option>
                  {group.vehicles?.map(v => <option key={v.id} value={v.id}>{v.vehicle_number} (#{v.id})</option>)}
                </select>
                <button
                  className="btn-danger"
                  disabled={!primaryId || !secondaryId || primaryId === secondaryId}
                  onClick={() => setMergeModal(true)}
                >
                  מיזוג
                </button>
              </div>
            </div>
          )}

          {mergeModal && primary && secondary && (
            <MergeModal
              primaryRecord={primary}
              secondaryRecord={secondary}
              fields={VEHICLE_FIELDS}
              onConfirm={doMerge}
              onClose={() => setMergeModal(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function PolicyGroup({ group, onRefresh }) {
  const [expanded, setExpanded] = useState(false);
  const [mergeModal, setMergeModal] = useState(null);
  const [primaryId, setPrimaryId] = useState('');
  const [secondaryId, setSecondaryId] = useState('');
  const user = JSON.parse(localStorage.getItem('fleet_user') || '{}');
  const isAdmin = user.role === 'admin';

  const POLICY_FIELDS = ['policy_number', 'coverage_type', 'insurer', 'start_date', 'expiry_date', 'total_premium', 'status'];

  async function doMerge(overrides) {
    await api.mergePolicies(parseInt(primaryId), parseInt(secondaryId), overrides);
    onRefresh();
  }

  const primary = group.policies?.find(p => p.id === parseInt(primaryId));
  const secondary = group.policies?.find(p => p.id === parseInt(secondaryId));

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
      <div
        style={{ padding: '12px 16px', background: group.warning_only ? '#fef9c3' : '#fee2e2', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div>
          <strong style={{ fontSize: 14 }}>{group.warning_only ? '⚠️' : '🚨'} {group.match_reason}</strong>
          <span style={{ marginRight: 12, color: '#6b7280', fontSize: 13 }}>{group.count} פוליסות</span>
        </div>
        <span style={{ color: '#6b7280' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ padding: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <th style={{ padding: 8, textAlign: 'right' }}>מספר פוליסה</th>
                <th style={{ padding: 8, textAlign: 'right' }}>כיסוי</th>
                <th style={{ padding: 8, textAlign: 'right' }}>מבטח</th>
                <th style={{ padding: 8, textAlign: 'right' }}>רכב</th>
                <th style={{ padding: 8, textAlign: 'right' }}>סטטוס</th>
                <th style={{ padding: 8, textAlign: 'right' }}>פג תוקף</th>
              </tr>
            </thead>
            <tbody>
              {group.policies?.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: 8 }}>{p.policy_number || '—'}</td>
                  <td style={{ padding: 8 }}>{p.coverage_type || '—'}</td>
                  <td style={{ padding: 8 }}>{p.insurer || '—'}</td>
                  <td style={{ padding: 8 }}>{p.vehicle_number || '—'}</td>
                  <td style={{ padding: 8 }}>{p.status || '—'}</td>
                  <td style={{ padding: 8 }}>{fmtDate(p.expiry_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {isAdmin && !group.warning_only && (
            <div style={{ marginTop: 16, padding: 12, background: '#f8f9fa', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>🔀 מיזוג פוליסות</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <select className="input-field" style={{ width: 'auto' }} value={primaryId} onChange={e => setPrimaryId(e.target.value)}>
                  <option value="">-- ראשי --</option>
                  {group.policies?.map(p => <option key={p.id} value={p.id}>{p.policy_number} (#{p.id})</option>)}
                </select>
                <span>←</span>
                <select className="input-field" style={{ width: 'auto' }} value={secondaryId} onChange={e => setSecondaryId(e.target.value)}>
                  <option value="">-- משני --</option>
                  {group.policies?.map(p => <option key={p.id} value={p.id}>{p.policy_number} (#{p.id})</option>)}
                </select>
                <button className="btn-danger" disabled={!primaryId || !secondaryId || primaryId === secondaryId} onClick={() => setMergeModal(true)}>מיזוג</button>
              </div>
            </div>
          )}

          {mergeModal && primary && secondary && (
            <MergeModal primaryRecord={primary} secondaryRecord={secondary} fields={POLICY_FIELDS} onConfirm={doMerge} onClose={() => setMergeModal(null)} />
          )}
        </div>
      )}
    </div>
  );
}

export default function Duplicates() {
  const [tab, setTab] = useState('vehicles');
  const [vehicleGroups, setVehicleGroups] = useState([]);
  const [policyGroups, setPolicyGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  function loadVehicles() {
    api.getDuplicateVehicles().then(setVehicleGroups).catch(() => {});
  }
  function loadPolicies() {
    api.getDuplicatePolicies().then(setPolicyGroups).catch(() => {});
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getDuplicateVehicles().then(setVehicleGroups).catch(() => {}),
      api.getDuplicatePolicies().then(setPolicyGroups).catch(() => {})
    ]).finally(() => setLoading(false));
  }, []);

  const groups = tab === 'vehicles' ? vehicleGroups : policyGroups;
  const errorGroups = groups.filter(g => !g.warning_only);
  const warnGroups = groups.filter(g => g.warning_only);

  return (
    <div>
      <h2 style={{ marginBottom: 20 }}>⚠️ כפילויות</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { id: 'vehicles', label: `🚗 כפילויות רכבים (${vehicleGroups.length})` },
          { id: 'policies', label: `🛡️ כפילויות פוליסות (${policyGroups.length})` }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: tab === t.id ? 700 : 400,
              background: tab === t.id ? 'var(--primary)' : '#f1f5f9',
              color: tab === t.id ? '#fff' : '#374151',
              fontSize: 14
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? <p>טוען...</p> : (
        <div>
          {groups.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: '#15803d', background: '#dcfce7', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>לא נמצאו כפילויות!</div>
            </div>
          )}

          {errorGroups.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ color: '#dc2626', marginBottom: 12 }}>🚨 כפילויות מוחלטות ({errorGroups.length})</h3>
              {errorGroups.map((g, i) => tab === 'vehicles'
                ? <VehicleGroup key={i} group={g} onRefresh={loadVehicles} />
                : <PolicyGroup key={i} group={g} onRefresh={loadPolicies} />
              )}
            </div>
          )}

          {warnGroups.length > 0 && (
            <div>
              <h3 style={{ color: '#d97706', marginBottom: 12 }}>⚠️ אזהרות (כדאי לבדוק) ({warnGroups.length})</h3>
              {warnGroups.map((g, i) => tab === 'vehicles'
                ? <VehicleGroup key={i} group={g} onRefresh={loadVehicles} />
                : <PolicyGroup key={i} group={g} onRefresh={loadPolicies} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
