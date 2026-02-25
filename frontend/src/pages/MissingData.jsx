import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

function SeverityBadge({ severity }) {
  const config = {
    high: { bg: '#fee2e2', c: '#dc2626', icon: '🔴', label: 'גבוה' },
    medium: { bg: '#fef3c7', c: '#d97706', icon: '🟡', label: 'בינוני' },
    low: { bg: '#dcfce7', c: '#15803d', icon: '🟢', label: 'נמוך' },
  };
  const s = config[severity] || config.low;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, background: s.bg, color: s.c, fontWeight: 600 }}>
      {s.icon} {s.label}
    </span>
  );
}

function MissingSection({ title, items, vehicleId, baseTab }) {
  if (items.length === 0) return (
    <div style={{ padding: 16, color: '#15803d', background: '#dcfce7', borderRadius: 8, fontSize: 14 }}>
      ✅ לא נמצאו חסרים
    </div>
  );

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
          background: i % 2 === 0 ? '#fff' : '#fafafa'
        }}>
          <div>
            <div style={{ fontWeight: 500, fontSize: 14 }}>{item.label}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>שדה: {item.field}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <SeverityBadge severity={item.severity} />
            <Link
              to={`/dept/vehicles/${vehicleId}/overview`}
              style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none', fontWeight: 500 }}
            >
              מעבר →
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MissingData({ vehicleId: propVehicleId }) {
  const { id: paramId } = useParams();
  const vehicleId = propVehicleId || paramId;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('documents');

  useEffect(() => {
    if (!vehicleId) return;
    setLoading(true);
    api.getMissingData(vehicleId)
      .then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [vehicleId]);

  const tabs = [
    { id: 'documents',   label: '📄 חסר מסמכים',  key: 'missingDocuments' },
    { id: 'dates',       label: '📅 חסר תאריכים',  key: 'missingDates' },
    { id: 'assignments', label: '👤 חסר שיוכים',   key: 'missingAssignments' },
    { id: 'details',     label: '📋 חסר פרטים',    key: 'missingDetails' },
  ];

  if (loading) return <p>טוען...</p>;
  if (!data) return <p style={{ color: '#dc2626' }}>שגיאה בטעינת הנתונים</p>;

  const activeTab = tabs.find(t => t.id === tab);
  const items = data[activeTab?.key] || [];

  const totalMissing = data.total_missing || 0;
  const highCount = data.high_severity_count || 0;

  return (
    <div>
      {!propVehicleId && (
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ marginBottom: 4 }}>⚠️ נתונים חסרים - {data.vehicle_number}</h2>
          {totalMissing > 0 ? (
            <div style={{ color: '#dc2626', fontSize: 14 }}>
              {totalMissing} שדות חסרים ({highCount} בעדיפות גבוהה)
            </div>
          ) : (
            <div style={{ color: '#15803d', fontSize: 14 }}>✅ הרכב מלא!</div>
          )}
        </div>
      )}

      {/* Summary row */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {tabs.map(t => {
          const count = (data[t.key] || []).length;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: tab === t.id ? 'var(--primary)' : '#f1f5f9',
                color: tab === t.id ? '#fff' : '#374151',
                fontSize: 13, fontWeight: tab === t.id ? 700 : 400
              }}
            >
              {t.label} ({count})
            </button>
          );
        })}
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <MissingSection title={activeTab?.label} items={items} vehicleId={vehicleId} />
      </div>
    </div>
  );
}
