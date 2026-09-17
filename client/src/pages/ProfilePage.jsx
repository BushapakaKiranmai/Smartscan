import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import Icons from '../components/Icons';

export const ProfilePage = () => {
  const { user, isAuthenticated, isStaff, isAdmin, logout, updateProfile } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  // Edit Profile modal state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('CUSTOMER');
  const [isSaving, setIsSaving] = useState(false);

  const handleLogout = () => {
    logout();
    toast.info('Signed out successfully');
    navigate('/login', { replace: true });
  };

  const openEditModal = () => {
    setEditName(user?.name || '');
    setEditPhone(user?.phone || '');
    setEditEmail(user?.email || '');
    setEditRole((user?.role || 'CUSTOMER').toUpperCase());
    setIsEditing(true);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    if (!editPhone.trim()) {
      toast.error('Phone number cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        role: editRole
      });
      toast.success('Profile updated successfully!');
      setIsEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const getRoleBadge = (currentRole) => {
    const norm = (currentRole || '').toUpperCase();
    switch (norm) {
      case 'SUPER_ADMIN':
      case 'ADMIN':
        return {
          title: 'Administrator',
          style: { background: 'rgba(239, 68, 68, 0.14)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' },
          icon: '⚡'
        };
      case 'BRANCH_MANAGER':
      case 'MANAGER':
        return {
          title: 'Store Manager',
          style: { background: 'rgba(99, 102, 241, 0.14)', color: '#6366f1', border: '1px solid rgba(99, 102, 241, 0.3)' },
          icon: '🏪'
        };
      case 'BRANCH_STAFF':
      case 'STAFF':
        return {
          title: 'Security Staff',
          style: { background: 'rgba(245, 158, 11, 0.14)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' },
          icon: '🛡️'
        };
      case 'CUSTOMER':
      default:
        return {
          title: 'Shopper',
          style: { background: 'rgba(16, 185, 129, 0.14)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' },
          icon: '🛒'
        };
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container app-workspace page-container" style={{ textAlign: 'center' }}>
        <div className="glass-card" style={{ padding: '40px 24px', borderRadius: '28px' }}>
          <div
            style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px'
            }}
          >
            <Icons.User size={34} />
          </div>
          <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
            Account Profile
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            Sign in to access your digital receipts, exit passes, and order history.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Link to="/login" className="btn btn-primary btn-block" style={{ borderRadius: 'var(--radius-md)', fontWeight: 800 }}>
              Sign In to Your Account
            </Link>
            <Link to="/register" className="btn btn-secondary btn-block" style={{ borderRadius: 'var(--radius-md)', fontWeight: 700 }}>
              Create Customer Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const roleInfo = getRoleBadge(user?.role);

  return (
    <div className="container app-workspace page-container">
      {/* Title */}
      <h1
        style={{
          fontFamily: 'var(--font-heading)',
          fontSize: '1.6rem',
          fontWeight: 800,
          marginBottom: '20px',
          color: 'var(--text-primary)',
          letterSpacing: '-0.02em'
        }}
      >
        Account Profile
      </h1>

      {/* User Info Card */}
      <div
        className="glass-card"
        style={{
          padding: '22px',
          borderRadius: '24px',
          border: '1px solid var(--border-card)',
          background: 'var(--bg-surface)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '20px',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.4rem',
            fontWeight: 900,
            flexShrink: 0,
            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
          }}
        >
          {user?.name?.[0]?.toUpperCase() || 'U'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name}
            </div>
            <button
              type="button"
              onClick={openEditModal}
              title="Edit Profile Information"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--border-card)',
                background: 'var(--bg-surface-muted)',
                color: 'var(--text-primary)',
                fontSize: '0.72rem',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              <Icons.Edit size={12} />
              <span>Edit</span>
            </button>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 6px 0' }}>
            {user?.phone} {user?.email ? `• ${user?.email}` : ''}
          </div>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '2px 9px',
              borderRadius: 'var(--radius-full)',
              ...roleInfo.style
            }}
          >
            <span>{roleInfo.icon}</span>
            <span>{roleInfo.title}</span>
          </span>
        </div>
      </div>

      {/* Menu Options List */}
      <div
        className="glass-card"
        style={{
          borderRadius: '24px',
          border: '1px solid var(--border-card)',
          background: 'var(--bg-surface)',
          overflow: 'hidden',
          marginBottom: '20px'
        }}
      >
        {/* Order History */}
        <Link
          to="/orders"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            textDecoration: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icons.Receipt size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>Order History & Exit Passes</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>View previous self-checkout passes & invoices</div>
            </div>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>›</span>
        </Link>

        {/* View Tray */}
        <Link
          to="/cart"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            textDecoration: 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icons.ShoppingBag size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>Checkout Tray</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Review current self-checkout session</div>
            </div>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>›</span>
        </Link>

        {/* Staff Gate Terminal */}
        {isStaff && (
          <Link
            to="/terminal"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              color: 'var(--accent-dark)',
              textDecoration: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'var(--accent-light)', color: 'var(--accent-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.ShieldCheck size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>Security Gate Terminal</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Verify customer QR exit tokens</div>
              </div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>›</span>
          </Link>
        )}

        {/* Admin Product Management */}
        {isAdmin && (
          <Link
            to="/admin/products"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              color: 'var(--primary)',
              textDecoration: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icons.Barcode size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>Product Database</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Manage products, barcodes, and prices</div>
              </div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>›</span>
          </Link>
        )}

        {/* Edit Profile Quick Row */}
        <div
          onClick={openEditModal}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'var(--bg-surface-muted)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icons.Edit size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Edit Profile & Role</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Update name, phone, email, or change role</div>
            </div>
          </div>
          <span style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>›</span>
        </div>

        {/* Theme Switcher Toggle */}
        <div
          onClick={toggleTheme}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'var(--bg-surface-muted)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isDark ? <Icons.Sun size={18} color="#fbbf24" /> : <Icons.Moon size={18} color="#64748b" />}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>Appearance</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isDark ? 'Dark Mode' : 'Light Mode'}</div>
            </div>
          </div>
          <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
            {isDark ? 'Dark' : 'Light'}
          </span>
        </div>

        {/* App Version Info */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'var(--bg-surface-muted)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icons.Zap size={18} color="var(--primary)" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>SmartScan Pay</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Scan. Pay. Go. • Self-Checkout</div>
            </div>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 700 }}>v2.0</span>
        </div>

        {/* Clean Integrated Log Out Menu Option */}
        <div
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            cursor: 'pointer',
            color: 'var(--danger)',
            background: 'rgba(239, 68, 68, 0.03)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icons.LogOut size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>Sign Out</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Logout from this account</div>
            </div>
          </div>
          <span style={{ fontSize: '1.1rem', color: 'var(--danger)' }}>›</span>
        </div>
      </div>

      {/* Standalone Logout Button (with ample bottom margin so it clears bottom dock on mobile) */}
      <button
        type="button"
        onClick={handleLogout}
        className="btn btn-secondary btn-block"
        style={{
          padding: '14px',
          color: 'var(--danger)',
          borderColor: 'var(--danger-light)',
          fontWeight: 800,
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '32px'
        }}
      >
        <Icons.LogOut size={18} />
        <span>Logout from Account</span>
      </button>

      {/* ============================================================ */}
      {/* EDIT PROFILE & ROLE MODAL */}
      {/* ============================================================ */}
      {isEditing && (
        <div
          className="modal-backdrop"
          onClick={() => !isSaving && setIsEditing(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div
            className="glass-card"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '460px',
              borderRadius: '24px',
              padding: '24px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-card)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Edit Profile & Role
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={isSaving}
                className="btn btn-ghost btn-icon"
                style={{ borderRadius: '50%', width: '32px', height: '32px' }}
              >
                <Icons.X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProfile}>
              {/* Name */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Your full name"
                  required
                  className="input"
                  style={{ width: '100%', borderRadius: '12px', padding: '10px 14px' }}
                />
              </div>

              {/* Phone */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+91..."
                  required
                  className="input"
                  style={{ width: '100%', borderRadius: '12px', padding: '10px 14px' }}
                />
              </div>

              {/* Email */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="input"
                  style={{ width: '100%', borderRadius: '12px', padding: '10px 14px' }}
                />
              </div>

              {/* Role Switcher */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Account Role & Permissions
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {[
                    { key: 'CUSTOMER', label: '🛒 Shopper', desc: 'Customer self-checkout' },
                    { key: 'BRANCH_STAFF', label: '🛡️ Gate Staff', desc: 'Verify exit passes' },
                    { key: 'BRANCH_MANAGER', label: '🏪 Store Manager', desc: 'Manager & terminal' },
                    { key: 'SUPER_ADMIN', label: '⚡ Administrator', desc: 'Full product & store admin' }
                  ].map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setEditRole(r.key)}
                      style={{
                        padding: '10px 8px',
                        borderRadius: '12px',
                        border: editRole === r.key ? '2px solid var(--primary)' : '1px solid var(--border-card)',
                        background: editRole === r.key ? 'var(--primary-light)' : 'var(--bg-surface-muted)',
                        color: editRole === r.key ? 'var(--primary)' : 'var(--text-primary)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ fontWeight: 800, fontSize: '0.82rem' }}>{r.label}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>{r.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="btn btn-secondary"
                  style={{ flex: 1, borderRadius: '12px', fontWeight: 700 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn btn-primary"
                  style={{ flex: 1, borderRadius: '12px', fontWeight: 800 }}
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;
