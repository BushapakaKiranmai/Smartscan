import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart, formatPaise } from '../context/CartContext';
import Icons from '../components/Icons';

export const CartPage = () => {
  const {
    items,
    itemCount,
    pricingSummary,
    appliedCoupon,
    updateQuantity,
    removeItem,
    clearCart,
    applyCoupon,
    removeCoupon
  } = useCart();

  const [couponInput, setCouponInput] = useState('');
  const navigate = useNavigate();

  const handleApply = async (e) => {
    if (e) e.preventDefault();
    if (!couponInput.trim()) return;
    await applyCoupon(couponInput.trim());
    setCouponInput('');
  };

  if (items.length === 0) {
    return (
      <div className="container app-workspace page-container" style={{ textAlign: 'center' }}>
        <div
          className="glass-card"
          style={{
            padding: '48px 24px',
            borderRadius: '28px',
            border: '1px solid var(--border-card)',
            background: 'var(--bg-surface)'
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.15)'
            }}
          >
            <Icons.ShoppingBag size={40} />
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.55rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              marginBottom: '8px'
            }}
          >
            Your Checkout Tray is Empty
          </h2>
          <p
            style={{
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
              maxWidth: '320px',
              margin: '0 auto 28px'
            }}
          >
            Scan barcodes directly from the store shelves to add items to your self-checkout session.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '280px', margin: '0 auto' }}>
            <Link to="/scan" className="btn btn-primary btn-lg" style={{ borderRadius: 'var(--radius-md)', fontWeight: 800 }}>
              <Icons.Camera size={20} />
              <span>Start Barcode Scanning</span>
            </Link>
            <Link to="/home" className="btn btn-secondary" style={{ borderRadius: 'var(--radius-md)', fontWeight: 700 }}>
              <Icons.Home size={18} />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container app-workspace page-container">
      {/* Checkout Progress Stepper */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          marginBottom: '24px',
          fontSize: '0.82rem',
          fontWeight: 700
        }}
      >
        <span style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: 'var(--primary)',
              color: '#ffffff',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.72rem',
              fontWeight: 800
            }}
          >
            1
          </span>
          Tray Review
        </span>
        <Icons.ChevronRight size={14} color="var(--text-muted)" />
        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: 'var(--bg-surface-muted)',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.72rem',
              fontWeight: 700
            }}
          >
            2
          </span>
          Pay
        </span>
        <Icons.ChevronRight size={14} color="var(--text-muted)" />
        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              background: 'var(--bg-surface-muted)',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.72rem',
              fontWeight: 700
            }}
          >
            3
          </span>
          Exit Pass
        </span>
      </div>

      {/* Tray Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
              margin: 0
            }}
          >
            Your Shopping Cart
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'} scanned • Review your items before payment
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => navigate('/scan')}
            className="btn btn-secondary btn-sm"
            style={{ fontWeight: 800, fontSize: '0.8rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icons.Camera size={15} />
            <span>Scan More</span>
          </button>

          <button
            type="button"
            onClick={clearCart}
            className="btn btn-ghost btn-sm"
            style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.8rem', padding: '6px 10px' }}
          >
            <Icons.Trash2 size={15} />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      {/* Items Tray List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
        {items.map((item) => (
          <div
            key={item.productId}
            className="glass-card"
            style={{
              padding: '14px 16px',
              borderRadius: '20px',
              display: 'flex',
              gap: '14px',
              alignItems: 'center',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-card)'
            }}
          >
            {/* Product Image / Icon */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '14px',
                background: 'var(--bg-surface-muted)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0
              }}
            >
              {(item.images?.[0]?.url || item.image) ? (
                <img
                  src={item.images?.[0]?.url || item.image}
                  alt={item.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <Icons.ShoppingBag size={26} color="var(--primary)" />
              )}
            </div>

            {/* Product Details */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {item.brand && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {item.brand}
                </div>
              )}
              <h3
                style={{
                  fontSize: '0.96rem',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  marginBottom: '4px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {item.name}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.92rem', color: 'var(--primary)', fontWeight: 800 }}>
                  {formatPaise(item.unitPricePaise ?? Math.round((item.price || 0) * 100), item.price)}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  each
                </span>
              </div>
            </div>

            {/* Read-Only Quantity Display & Subtotal */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--bg-surface-muted)',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    letterSpacing: '0.02em'
                  }}
                >
                  Quantity: {item.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(item.productId)}
                  className="btn btn-ghost btn-sm"
                  style={{
                    padding: '4px 6px',
                    color: 'var(--text-muted)',
                    borderRadius: '8px',
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Remove from cart"
                  aria-label={`Remove ${item.name} from cart`}
                >
                  <Icons.Trash2 size={15} />
                </button>
              </div>

              <div style={{ fontSize: '1rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                {formatPaise(item.subtotalPaise ?? Math.round((item.subtotal ?? ((item.price || 0) * item.quantity)) * 100), item.subtotal ?? ((item.price || 0) * item.quantity))}
              </div>
            </div>
          </div>
        ))}

        {/* Scan Another Item Action Button */}
        <Link
          to="/scan"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '14px',
            borderRadius: '18px',
            border: '2px dashed var(--primary-subtle)',
            color: 'var(--primary)',
            fontWeight: 800,
            fontSize: '0.9rem',
            background: 'var(--bg-surface)',
            textDecoration: 'none',
            transition: 'all 0.2s ease'
          }}
          className="interactive-card"
        >
          <Icons.Plus size={18} />
          <span>Scan another item from shelf</span>
        </Link>
      </div>

      {/* Digital Receipt Bill Card */}
      <div
        className="glass-card"
        style={{
          padding: '22px',
          borderRadius: '24px',
          border: '1px solid var(--border-card)',
          background: 'var(--bg-surface)',
          marginBottom: '20px'
        }}
      >
        <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '14px' }}>
          Session Bill Breakdown
        </div>

        {/* Promo Voucher / Coupon */}
        <div style={{ marginBottom: '18px' }}>
          {appliedCoupon ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--primary-light)',
                border: '1px dashed var(--primary)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icons.Tag size={16} color="var(--primary)" />
                <div>
                  <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.88rem' }}>{appliedCoupon.code}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '6px' }}>
                    (−{formatPaise(appliedCoupon.discountAmountPaise)})
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={removeCoupon}
                style={{ background: 'none', border: 'none', color: 'var(--danger)', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem' }}
              >
                Remove
              </button>
            </div>
          ) : (
            <div>
              <form onSubmit={handleApply} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Promo coupon code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  style={{ padding: '9px 12px', fontSize: '0.88rem', textTransform: 'uppercase' }}
                />
                <button type="submit" disabled={!couponInput.trim()} className="btn btn-secondary btn-sm" style={{ flexShrink: 0, fontWeight: 700 }}>
                  Apply
                </button>
              </form>
              <button
                type="button"
                onClick={() => applyCoupon('WELCOME50')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--bg-surface-muted)',
                  border: '1px dashed var(--primary-subtle)',
                  color: 'var(--primary)',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <Icons.Sparkles size={12} />
                <span>Apply coupon: <strong>WELCOME50</strong></span>
              </button>
            </div>
          )}
        </div>

        {/* Bill Lines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span>Items MRP Total:</span>
            <span>{formatPaise(pricingSummary.itemsGrossTotalPaise)}</span>
          </div>

          {pricingSummary.totalItemDiscountPaise > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary)', fontWeight: 700 }}>
              <span>Store Savings:</span>
              <span>−{formatPaise(pricingSummary.totalItemDiscountPaise)}</span>
            </div>
          )}

          {pricingSummary.couponDiscountAmountPaise > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary)', fontWeight: 700 }}>
              <span>Voucher Discount:</span>
              <span>−{formatPaise(pricingSummary.couponDiscountAmountPaise)}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            <span>Taxes & GST (Included):</span>
            <span>{formatPaise(pricingSummary.taxAmountPaise || 0)}</span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              borderTop: '1px solid var(--border-card)',
              paddingTop: '14px',
              marginTop: '4px'
            }}
          >
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Total Payable
              </div>
              <div style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--primary)' }}>
                {formatPaise(pricingSummary.finalPayableAmountPaise)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/payment')}
              className="btn btn-primary"
              style={{
                padding: '12px 24px',
                borderRadius: 'var(--radius-md)',
                fontWeight: 800,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)'
              }}
            >
              <span>Proceed to Payment</span>
              <Icons.ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
