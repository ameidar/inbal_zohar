import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, AlertCircle } from 'lucide-react';
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
    } catch {
      setError('שם משתמש או סיסמה שגויים');
    } finally { setLoading(false); }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      fontFamily: "'Assistant', sans-serif"
    }}>
      <div style={{ width: 380 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56,
            background: 'var(--primary)',
            borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 4px 14px rgba(30,58,95,0.25)'
          }}>
            <Truck size={28} strokeWidth={1.8} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px' }}>
            מערכת ניהול
          </h1>
          <p style={{ color: 'var(--gray)', fontSize: 13, margin: 0 }}>
            הצוות תשתיות בע"מ
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 28 }}>
          <form onSubmit={handleSubmit}>
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#FFEBEE', color: 'var(--danger)',
                padding: '10px 14px', borderRadius: 7,
                marginBottom: 20, fontSize: 14,
                border: '1px solid #FFCDD2'
              }}>
                <AlertCircle size={15} />
                {error}
              </div>
            )}

            <div className="form-group">
              <label className="form-label">שם משתמש</label>
              <input
                className="form-control"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                dir="ltr"
                style={{ textAlign: 'right' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label">סיסמה</label>
              <input
                className="form-control"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', fontSize: 15 }}
            >
              {loading ? 'מתחבר...' : 'כניסה למערכת'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 16 }}>
          גרסה 1.0
        </p>
      </div>
    </div>
  );
}
