import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Icons from '../components/Icons';

export const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);

  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // If already authenticated, redirect to /home without creating history entry
  if (isAuthenticated) {
    return <Navigate to="/home" replace />;
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim() || !formData.password) {
      toast.warning('Please complete all required fields.');
      return;
    }

    if (formData.password.length < 6) {
      toast.warning('Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      const user = await register(formData);
      toast.success(`Account created! Welcome to SmartScan Pay, ${user.name}.`);
      navigate('/home', { replace: true });
    } catch (err) {
      toast.error(err.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container app-workspace page-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '36px 26px', borderRadius: '28px', border: '1px solid var(--border-card)', background: 'var(--bg-surface)' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <span className="badge badge-success" style={{ marginBottom: '10px' }}>
            <Icons.Sparkles size={13} />
            Instant In-Store Checkout
          </span>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.025em', marginBottom: '4px', color: 'var(--text-primary)' }}>
            Create Shopper Account
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Scan. Pay. Go. • Skip all cashier lines
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Full Name *</label>
            <input
              type="text"
              placeholder="e.g. Rahul Verma"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="form-input"
              required
              style={{ borderRadius: 'var(--radius-md)', padding: '12px 14px' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Mobile Phone Number *</label>
            <input
              type="tel"
              placeholder="+919876543210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="form-input"
              required
              style={{ borderRadius: 'var(--radius-md)', padding: '12px 14px' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Email Address (Optional)</label>
            <input
              type="email"
              placeholder="rahul@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="form-input"
              style={{ borderRadius: 'var(--radius-md)', padding: '12px 14px' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 700 }}>Password (min 6 characters) *</label>
            <input
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="form-input"
              required
              style={{ borderRadius: 'var(--radius-md)', padding: '12px 14px' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-lg btn-block"
            style={{ borderRadius: 'var(--radius-md)', padding: '14px', fontWeight: 800, fontSize: '1rem' }}
          >
            {loading ? 'Creating Account...' : 'Register & Start Shopping'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '22px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 800 }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
