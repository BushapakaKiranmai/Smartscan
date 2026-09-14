import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import Icons from '../components/Icons';

export const HomePage = () => {
  const { itemCount, totalAmount, totalPaise, formatPaise } = useCart();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [activeModal, setActiveModal] = useState(null); // 'guide' | 'support' | 'green' | null

  const userName = user?.name ? user.name.split(' ')[0] : 'Kiran';

  // Dynamic greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="container app-workspace page-container" style={{ paddingTop: '74px', paddingBottom: '110px' }}>
      {/* 1. HERO SECTION */}
      <div
        style={{
          position: 'relative',
          borderRadius: '26px',
          overflow: 'hidden',
          padding: '18px 18px 16px',
          background: 'linear-gradient(135deg, rgba(236, 253, 245, 0.9) 0%, rgba(255, 255, 255, 0.98) 55%, rgba(209, 250, 229, 0.6) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.22)',
          boxShadow: '0 6px 24px rgba(16, 185, 129, 0.08)',
          marginBottom: '14px'
        }}
      >
        {/* Softly masked supermarket aisle & basket background on the right */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '62%',
            height: '100%',
            backgroundImage: 'url(/images/hero_basket.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center 35%',
            opacity: 0.26,
            maskImage: 'linear-gradient(to left, rgba(0, 0, 0, 0.95) 25%, rgba(0, 0, 0, 0.6) 60%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to left, rgba(0, 0, 0, 0.95) 25%, rgba(0, 0, 0, 0.6) 60%, transparent 100%)',
            pointerEvents: 'none'
          }}
        />

        {/* Top Header Row: Greeting & Store Live Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#475569' }}>
            {isAuthenticated ? `${getGreeting()}, ${userName} 👋` : `${getGreeting()}, Guest 👋`}
          </div>

          {/* Floating Store Live Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.94)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
            }}
          >
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 6px #10b981',
                display: 'inline-block'
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#065f46' }}>Store Live</span>
              <span style={{ fontSize: '0.62rem', color: '#64748b' }}>Everything ready</span>
            </div>
          </div>
        </div>

        {/* Main Title & Subtitle */}
        <div style={{ position: 'relative', zIndex: 2, marginBottom: '14px' }}>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.95rem',
              fontWeight: 900,
              letterSpacing: '-0.035em',
              color: 'var(--text-primary)',
              lineHeight: 1.1,
              margin: '2px 0 4px 0'
            }}
          >
            Ready to shop?
          </h1>
          <p
            style={{
              fontSize: '0.84rem',
              color: 'var(--text-secondary)',
              margin: 0,
              maxWidth: '210px',
              lineHeight: 1.35
            }}
          >
            Scan your items, add to cart and pay in seconds.
          </p>
        </div>

        {/* Hero Interactive Split: 3 Process Steps + Dominant Scanner Bubble */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
            zIndex: 2,
            gap: '8px'
          }}
        >
          {/* Left: 3 Process Steps */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Step 1: Scan */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 5px rgba(16, 185, 129, 0.12)',
                  marginBottom: '4px'
                }}
              >
                <Icons.Zap size={16} />
              </div>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-primary)' }}>Scan</span>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Items</span>
            </div>

            {/* Step 2: Add */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 5px rgba(16, 185, 129, 0.12)',
                  marginBottom: '4px'
                }}
              >
                <Icons.ShoppingCart size={16} />
              </div>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-primary)' }}>Add</span>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>to cart</span>
            </div>

            {/* Step 3: Pay */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 5px rgba(16, 185, 129, 0.12)',
                  marginBottom: '4px'
                }}
              >
                <Icons.CreditCard size={16} />
              </div>
              <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-primary)' }}>Pay</span>
              <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>and go</span>
            </div>
          </div>

          {/* Right: Dominant Glowing Scanner Bubble */}
          <Link
            to="/scan"
            style={{
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            {/* Glowing Concentric Container */}
            <div
              style={{
                position: 'relative',
                width: '122px',
                height: '122px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {/* Outer Radiance Ring 1 */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  border: '2px solid rgba(16, 185, 129, 0.25)',
                  animation: 'beaconPulse 2.6s ease-out infinite'
                }}
              />
              {/* Outer Radiance Ring 2 */}
              <div
                style={{
                  position: 'absolute',
                  inset: '6px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.35)'
                }}
              />

              {/* Inner Solid Emerald Button */}
              <div
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.45)',
                  position: 'relative',
                  zIndex: 2,
                  transition: 'transform 0.18s ease'
                }}
                className="hover-scale"
              >
                <Icons.CameraReticle size={32} />
                <div
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 900,
                    letterSpacing: '0.04em',
                    lineHeight: 1.1,
                    marginTop: '3px',
                    textAlign: 'center'
                  }}
                >
                  <div>SCAN</div>
                  <div>PRODUCT</div>
                </div>
              </div>
            </div>

            {/* Tap to open scanner pill */}
            <div
              style={{
                marginTop: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '18px',
                background: '#ecfdf5',
                border: '1px solid #10b981',
                color: '#059669',
                fontSize: '0.74rem',
                fontWeight: 800,
                boxShadow: '0 2px 6px rgba(16, 185, 129, 0.1)',
                whiteSpace: 'nowrap'
              }}
            >
              <span>Tap to open scanner</span>
              <span>→</span>
            </div>
          </Link>
        </div>
      </div>

      {/* 2. "YOUR CART" CARD */}
      <div
        className="glass-card"
        style={{
          padding: '16px 18px',
          borderRadius: '22px',
          border: '1px solid var(--border-card)',
          background: 'var(--bg-surface)',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px'
        }}
      >
        {/* Left: Cart Icon & Details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Icons.ShoppingCart size={22} />
          </div>

          <div>
            <h2
              style={{
                fontSize: '1.05rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                margin: '0 0 1px 0'
              }}
            >
              Your Cart
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {itemCount > 0 ? 'Ready for quick self-checkout' : 'Scan products to start adding'}
            </div>
          </div>
        </div>

        {/* Right: Total & View Cart Button */}
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              TOTAL
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>
              {formatPaise(totalPaise ?? Math.round((totalAmount || 0) * 100), totalAmount)}
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/cart')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '18px',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              border: 'none',
              fontWeight: 800,
              fontSize: '0.8rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            <span>View Cart</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* 3. PROMOTIONAL GROCERY BANNER */}
      <div
        style={{
          position: 'relative',
          borderRadius: '22px',
          overflow: 'hidden',
          padding: '18px 18px',
          marginBottom: '14px',
          minHeight: '110px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(90deg, #064e3b 0%, #065f46 52%, rgba(6, 95, 70, 0.45) 100%), url(/images/grocery_banner.jpg) center right / cover no-repeat',
          boxShadow: '0 4px 16px rgba(6, 78, 59, 0.2)'
        }}
      >
        {/* Left: Text Details */}
        <div style={{ position: 'relative', zIndex: 2, maxWidth: '230px' }}>
          <div style={{ color: '#a7f3d0', fontSize: '0.88rem', fontWeight: 700, marginBottom: '2px' }}>
            A Faster,
          </div>
          <h3
            style={{
              color: '#ffffff',
              fontSize: '1.2rem',
              fontWeight: 900,
              letterSpacing: '-0.02em',
              margin: '0 0 3px 0',
              lineHeight: 1.15
            }}
          >
            Smarter Shopping Experience
          </h3>
          <div style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.76rem', fontWeight: 600 }}>
            Scan. Pay. Go.
          </div>
        </div>

        {/* Right: Same Shop Smarter Way Pill */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            background: '#ffffff',
            color: '#065f46',
            borderRadius: '18px',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.72rem',
            fontWeight: 800,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
            whiteSpace: 'nowrap'
          }}
        >
          <span style={{ fontSize: '0.8rem' }}>❇️</span>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
            <span style={{ fontSize: '0.62rem', color: '#64748b' }}>Same Shop</span>
            <span>Smarter Way</span>
          </div>
        </div>
      </div>

      {/* 4. 4 QUICK ACTION CARDS (GRID) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '8px',
          marginBottom: '16px'
        }}
      >
        {/* Action 1: Recent Orders */}
        <div
          onClick={() => navigate('/orders')}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            borderRadius: '18px',
            padding: '14px 6px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'transform 0.15s ease'
          }}
          className="interactive-card"
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '6px'
            }}
          >
            <Icons.Clock size={18} />
          </div>
          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px', whiteSpace: 'nowrap' }}>
            Recent Orders
          </span>
          <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            View history
          </span>
        </div>

        {/* Action 2: How to Scan */}
        <div
          onClick={() => setActiveModal('guide')}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            borderRadius: '18px',
            padding: '14px 6px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'transform 0.15s ease'
          }}
          className="interactive-card"
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: '#ccfbf1',
              color: '#0d9488',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '6px'
            }}
          >
            <Icons.QrCode size={18} />
          </div>
          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px', whiteSpace: 'nowrap' }}>
            How to Scan
          </span>
          <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Quick guide
          </span>
        </div>

        {/* Action 3: Help & Support */}
        <div
          onClick={() => setActiveModal('support')}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            borderRadius: '18px',
            padding: '14px 6px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'transform 0.15s ease'
          }}
          className="interactive-card"
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: '#d1fae5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '6px'
            }}
          >
            <Icons.HelpCircle size={18} />
          </div>
          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px', whiteSpace: 'nowrap' }}>
            Help & Support
          </span>
          <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Get assistance
          </span>
        </div>

        {/* Action 4: Go Green */}
        <div
          onClick={() => setActiveModal('green')}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-card)',
            borderRadius: '18px',
            padding: '14px 6px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
            transition: 'transform 0.15s ease'
          }}
          className="interactive-card"
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: '#ecfdf5',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '6px'
            }}
          >
            <Icons.Leaf size={18} />
          </div>
          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px', whiteSpace: 'nowrap' }}>
            Go Green
          </span>
          <span style={{ fontSize: '0.64rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            Shop smarter
          </span>
        </div>
      </div>

      {/* 5. INTERACTIVE MODALS */}

      {/* Modal: How to Scan Guide */}
      {activeModal === 'guide' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '24px',
              borderRadius: '26px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-card)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icons.QrCode size={22} color="var(--primary)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>How to Scan Barcodes</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="btn btn-ghost btn-icon"
              >
                <Icons.X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>1</span>
                <div>
                  <strong>Locate the Barcode:</strong> Find the standard 13-digit EAN barcode printed on the product packaging.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>2</span>
                <div>
                  <strong>Hold 10-15cm Away:</strong> Point your camera at the barcode inside the green scanner reticle.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, flexShrink: 0 }}>3</span>
                <div>
                  <strong>Instant Add:</strong> Price and item name appear immediately. Tap Add to Cart and continue shopping!
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveModal(null);
                navigate('/scan');
              }}
              className="btn btn-primary btn-block"
              style={{ marginTop: '20px', borderRadius: 'var(--radius-md)', fontWeight: 800 }}
            >
              Open Camera Scanner Now
            </button>
          </div>
        </div>
      )}

      {/* Modal: Help & Support */}
      {activeModal === 'support' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '24px',
              borderRadius: '26px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-card)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icons.HelpCircle size={22} color="var(--primary)" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Store Assistance</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="btn btn-ghost btn-icon"
              >
                <Icons.X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '16px' }}>
              Need help scanning an item or checking out? Our in-store floor assistants are ready to help.
            </p>

            <div style={{ padding: '14px', borderRadius: '16px', background: 'var(--bg-surface-muted)', fontSize: '0.84rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div>🏪 <strong>In-Store Help Desk:</strong> Aisle 1 Entrance</div>
              <div>📞 <strong>Store Helpline:</strong> 1800-SMARTSCAN</div>
              <div>⚡ <strong>Self-Checkout Support:</strong> Ask any store attendant</div>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="btn btn-secondary btn-block"
              style={{ marginTop: '18px', borderRadius: 'var(--radius-md)', fontWeight: 700 }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Modal: Go Green */}
      {activeModal === 'green' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 1000
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: '420px',
              padding: '24px',
              borderRadius: '26px',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-card)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icons.Leaf size={22} color="#16a34a" />
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>100% Paperless Self-Checkout</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="btn btn-ghost btn-icon"
              >
                <Icons.X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '14px' }}>
              By using SmartScan Pay, you eliminate thermal paper receipts and reduce waiting times to zero!
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.84rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontWeight: 700 }}>
                <span>🌱</span>
                <span>Zero Paper Waste: Digital exit passes & tax invoices</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontWeight: 700 }}>
                <span>⚡</span>
                <span>Zero Queue Times: Skip long cashier waiting lines</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontWeight: 700 }}>
                <span>🔒</span>
                <span>Encrypted digital records saved in your profile</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="btn btn-primary btn-block"
              style={{ marginTop: '20px', borderRadius: 'var(--radius-md)', fontWeight: 800 }}
            >
              Continue Shopping
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomePage;
