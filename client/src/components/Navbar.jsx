import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useTheme } from '../context/ThemeContext';
import Icons from './Icons';

export const Navbar = () => {
  const { user, isAuthenticated, isStaff, isAdmin, logout } = useAuth();
  const { itemCount, setIsDrawerOpen } = useCart();
  const { toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '66px',
        backgroundColor: 'var(--header-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-card)',
        zIndex: 900,
        display: 'flex',
        alignItems: 'center',
        transition: 'background-color var(--transition-normal)'
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}
      >
        {/* Brand with Logo & Subtitle */}
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textDecoration: 'none',
            color: 'inherit',
            flexShrink: 0
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
              flexShrink: 0
            }}
          >
            <Icons.Zap size={21} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 900,
                fontSize: '1.25rem',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                color: 'var(--text-primary)'
              }}
            >
              SmartScan<span style={{ color: 'var(--primary)' }}>Pay</span>
            </span>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 600,
                color: 'var(--text-muted)',
                letterSpacing: '0.02em',
                marginTop: '1px'
              }}
            >
              Scan. Pay. Go.
            </span>
          </div>
        </Link>

        {/* Navigation Controls */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Desktop-only Navigation Links */}
          <div className="desktop-nav-links">
            <Link
              to="/scan"
              style={{
                padding: '7px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: isActive('/scan') ? 'var(--primary)' : 'var(--text-secondary)',
                background: isActive('/scan') ? 'var(--primary-light)' : 'transparent',
                transition: 'all var(--transition-fast)'
              }}
            >
              Scan & Go
            </Link>

            <Link
              to="/catalog"
              style={{
                padding: '7px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: (isActive('/catalog') || isActive('/search')) ? 'var(--primary)' : 'var(--text-secondary)',
                background: (isActive('/catalog') || isActive('/search')) ? 'var(--primary-light)' : 'transparent',
                transition: 'all var(--transition-fast)'
              }}
            >
              Check Availability
            </Link>

            {isAuthenticated && (
              <Link
                to="/orders"
                style={{
                  padding: '7px 12px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: isActive('/orders') ? 'var(--primary)' : 'var(--text-secondary)',
                  background: isActive('/orders') ? 'var(--primary-light)' : 'transparent',
                  transition: 'all var(--transition-fast)'
                }}
              >
                Orders
              </Link>
            )}

            {isStaff && (
              <Link
                to="/terminal"
                style={{
                  padding: '6px 11px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: '#ffffff',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Icons.ShieldCheck size={15} />
                Gate Terminal
              </Link>
            )}

            {isAdmin && (
              <Link
                to="/admin/products"
                style={{
                  padding: '6px 11px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  color: isActive('/admin/products') ? 'var(--primary)' : 'var(--text-secondary)',
                  background: isActive('/admin/products') ? 'var(--primary-light)' : 'transparent',
                  border: '1px solid var(--border-card)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <Icons.Barcode size={15} />
                Products
              </Link>
            )}
          </div>

          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="btn btn-ghost btn-icon"
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
            style={{ borderRadius: '50%', width: '36px', height: '36px', flexShrink: 0 }}
          >
            {isDark ? <Icons.Sun size={18} color="#fbbf24" /> : <Icons.Moon size={18} color="#64748b" />}
          </button>

          {/* Cart Icon & Slide-over Drawer Trigger */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '38px',
              height: '38px',
              borderRadius: '11px',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              border: '1px solid var(--primary-subtle)',
              cursor: 'pointer',
              flexShrink: 0
            }}
            title="View Cart"
          >
            <Icons.ShoppingBag size={19} />
            {itemCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                }}
              >
                {itemCount}
              </span>
            )}
          </button>

          {/* User Profile Pill Avatar Dropdown or Sign In */}
          {isAuthenticated ? (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 8px 3px 3px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-surface-muted)',
                  border: '1px solid var(--border-card)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '50%',
                    background: '#065f46',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.82rem',
                    fontWeight: 800
                  }}
                >
                  {user?.name?.[0]?.toUpperCase() || 'K'}
                </div>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>▼</span>
              </button>

              {userMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    width: '210px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-card)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: 'var(--shadow-lg)',
                    padding: '8px',
                    zIndex: 950,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{user?.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user?.role}</div>
                  </div>

                  <Link
                    to="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <Icons.User size={16} />
                    My Profile
                  </Link>

                  <Link
                    to="/orders"
                    onClick={() => setUserMenuOpen(false)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <Icons.Receipt size={16} />
                    Receipts & Passes
                  </Link>

                  {isStaff && (
                    <Link
                      to="/terminal"
                      onClick={() => setUserMenuOpen(false)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--accent-dark)'
                      }}
                    >
                      <Icons.ShieldCheck size={16} />
                      Gate Exit Terminal
                    </Link>
                  )}

                  {isAdmin && (
                    <Link
                      to="/admin/products"
                      onClick={() => setUserMenuOpen(false)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: 'var(--primary)'
                      }}
                    >
                      <Icons.Barcode size={16} />
                      Product Database
                    </Link>
                  )}

                  <button
                    type="button"
                    onClick={handleLogout}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: 'var(--danger)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    <Icons.LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <Link to="/login" className="btn btn-primary btn-sm" style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 800 }}>
                Sign In
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
