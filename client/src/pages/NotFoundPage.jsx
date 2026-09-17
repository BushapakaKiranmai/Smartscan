import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icons from '../components/Icons';

export const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <div
      className="container page-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '75vh',
        textAlign: 'center',
        padding: '40px 20px 100px'
      }}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: '520px',
          width: '100%',
          padding: '44px 28px',
          borderRadius: '28px',
          border: '1px solid var(--border-card)',
          background: 'var(--bg-surface)',
          boxShadow: 'var(--shadow-md)'
        }}
      >
        {/* Visual 404 Icon Container */}
        <div
          style={{
            width: '96px',
            height: '96px',
            borderRadius: '28px',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(5, 150, 105, 0.08) 100%)',
            border: '2px dashed rgba(16, 185, 129, 0.4)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)',
            marginBottom: '24px'
          }}
        >
          <Icons.ShoppingBag size={46} />
        </div>

        <div
          style={{
            display: 'inline-block',
            padding: '4px 14px',
            borderRadius: '999px',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            fontSize: '0.84rem',
            fontWeight: 800,
            letterSpacing: '0.05em',
            marginBottom: '12px'
          }}
        >
          404 — AISLE NOT FOUND
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '2rem',
            fontWeight: 900,
            letterSpacing: '-0.03em',
            color: 'var(--text-primary)',
            lineHeight: 1.2,
            marginBottom: '10px'
          }}
        >
          Lost in the Supermarket?
        </h1>

        <p
          style={{
            fontSize: '0.96rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.55,
            maxWidth: '380px',
            margin: '0 auto 28px auto'
          }}
        >
          The page or product shelf you are looking for doesn't exist, has been relocated, or the link is broken.
        </p>

        {/* Primary Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
          <Link
            to="/home"
            className="btn btn-primary btn-block"
            style={{
              padding: '14px',
              borderRadius: '16px',
              fontWeight: 800,
              fontSize: '0.98rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Icons.Home size={19} />
            <span>Return to Supermarket Home</span>
          </Link>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary btn-block"
            style={{
              padding: '12px',
              borderRadius: '16px',
              fontWeight: 700,
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            <Icons.ArrowLeft size={18} />
            <span>Go Back to Previous Page</span>
          </button>
        </div>

        {/* Quick Links Section */}
        <div
          style={{
            paddingTop: '20px',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            flexWrap: 'wrap',
            fontSize: '0.85rem'
          }}
        >
          <Link
            to="/products"
            style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}
          >
            Browse Products
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <Link
            to="/cart"
            style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}
          >
            View Cart
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <Link
            to="/scan"
            style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}
          >
            Scan & Go
          </Link>
          <span style={{ color: 'var(--text-muted)' }}>•</span>
          <Link
            to="/orders"
            style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}
          >
            My Orders
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
