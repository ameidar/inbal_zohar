import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const r = await api.login(username, password);
      localStorage.setItem('fleet_token', r.token);
      localStorage.setItem('fleet_user', JSON.stringify(r.user));
      navigate('/');
    } catch (e) {
      setError('שם משתמש או סיסמה שגויים');
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e40af' }}>
      <div className="card" style={{ width: 360, padding: 0 }}>
        <div style={{ padding: '32px 32px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🚛</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>ניהול צי רכב</h2>
          <p style={{ color: '#6b7280', fontSize: 14 }}>הצוות תשתיות בע"מ</p>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            {error && <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 14 }}>{error}</div>}
            <div className="form-group">
              <label className="form-label">שם משתמש</label>
              <input className="form-control" value={username} onChange={e => setUsername(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">סיסמה</label>
              <input className="form-control" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? 'מתחבר...' : 'כניסה'}
            </button>
          </form>
          <div style={{ marginTop: 20, padding: 12, background: '#f9fafb', borderRadius: 8, fontSize: 12, color: '#6b7280' }}>
            <strong>כניסת דמו:</strong><br />
            מנהל: admin / admin123<br />
            מדווח: reporter / report123
          </div>
        </div>
      </div>
    </div>
  );
}
