import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Icons from '../components/Icons';

export const LoginPage = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!identifier.trim() || !password) {
      toast.warning('Please enter your phone/email and password.');
      return;
    }

    try {
      setLoading(true);
      const user = await login(identifier.trim(), password);
      toast.success(`Welcome back, ${user.name}!`);

      if (user.role === 'BRANCH_STAFF' || user.role === 'BRANCH_MANAGER') {
        navigate('/terminal');
      } else {
        navigate(from, { replace: true });
      }
    } catch (err) {
      toast.error(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoId, demoPass) => {
    setIdentifier(demoId);
    setPassword(demoPass);
  };

  return (
    <div className="container app-workspace page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '36px 26px', borderRadius: '28px', border: '1px solid var(--border-card)', background: 'var(--bg-surface)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)',
              marginBottom: '14px'
            }}
          >
            <Icons.Zap size={28} />
          </div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.025em', marginBottom: '4px', color: 'var(--text-primary)' }}>
            SmartScan Pay
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Scan. Pay. Go. • Self-Checkout Sign In
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Phone Number or Email</label>
            <input
              type="text"
              placeholder="+919876543210 or email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="form-input"
              autoFocus
              style={{ borderRadius: 'var(--radius-md)', padding: '12px 14px' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              style={{ borderRadius: 'var(--radius-md)', padding: '12px 14px' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg btn-block"
            style={{ borderRadius: 'var(--radius-md)', padding: '14px', fontWeight: 800, fontSize: '1rem' }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Accounts Quick-Fill Section */}
        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px', letterSpacing: '0.04em' }}>
            Demo Accounts (1-Tap Auto-Fill)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              type="button"
              onClick={() => fillDemo('+919876543210', 'Password123!')}
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: 'space-between', width: '100%', padding: '9px 14px', borderRadius: '12px' }}
            >
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>🛒 Customer: Kiran (+919876543210)</span>
              <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Auto-Fill</span>
            </button>

            <button
              type="button"
              onClick={() => fillDemo('+919999911111', 'Password123!')}
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: 'space-between', width: '100%', padding: '9px 14px', borderRadius: '12px' }}
            >
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>🛒 Customer: Rohan (+919999911111)</span>
              <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Auto-Fill</span>
            </button>

            <button
              type="button"
              onClick={() => fillDemo('+919999944444', 'Password123!')}
              className="btn btn-secondary btn-sm"
              style={{ justifyContent: 'space-between', width: '100%', padding: '9px 14px', borderRadius: '12px' }}
            >
              <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>🛡️ Admin: Vikram (+919999944444)</span>
              <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>Auto-Fill</span>
            </button>
          </div>
        </div>

        {/* Register CTA */}
        <div style={{ textAlign: 'center', marginTop: '22px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Don't have an account yet?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 800 }}>
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
