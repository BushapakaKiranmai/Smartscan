import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart, formatPaise } from '../context/CartContext';
import Icons from './Icons';

export const CartDrawer = () => {
  const {
    items,
    itemCount,
    pricingSummary,
    appliedCoupon,
    isDrawerOpen,
    setIsDrawerOpen,
    updateQuantity,
    removeItem,
    clearCart,
    applyCoupon,
    removeCoupon
  } = useCart();

  const [couponCode, setCouponCode] = useState('');
  const navigate = useNavigate();

  if (!isDrawerOpen) return null;

  const handleApplyCoupon = async (e) => {
    if (e) e.preventDefault();
    if (!couponCode.trim()) return;
    await applyCoupon(couponCode.trim());
    setCouponCode('');
  };

  const handleQuickCoupon = async (code) => {
    await applyCoupon(code);
  };

  const handleCheckout = () => {
    setIsDrawerOpen(false);
    navigate('/checkout');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={() => setIsDrawerOpen(false)}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '450px',
          height: '100%',
          backgroundColor: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-surface)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Icons.ShoppingBag size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Your Self-Checkout Cart</h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                {itemCount} {itemCount === 1 ? 'item' : 'items'} in basket
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {items.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--danger)', fontSize: '0.8rem', padding: '4px 8px' }}
                title="Empty Cart"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="btn btn-ghost btn-icon"
              style={{ width: '36px', height: '36px' }}
            >
              <Icons.X size={20} />
            </button>
          </div>
        </div>

        {/* Cart Line Items */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          {items.length === 0 ? (
            <div style={{ textAlign: 'center', margin: 'auto 0', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  background: 'var(--bg-surface-muted)',
                  color: 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}
              >
                <Icons.ShoppingBag size={34} />
              </div>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '6px' }}>Your Cart is Empty</h3>
              <p className="subtitle" style={{ maxWidth: '280px', margin: '0 auto 20px' }}>
                Scan product barcodes on store shelves to add items to your self-checkout session.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  navigate('/scan');
                }}
                className="btn btn-primary btn-sm"
              >
                <Icons.Scan size={16} />
                <span>Open Barcode Scanner</span>
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.productId}
                className="glass-card"
                style={{
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  border: '1px solid var(--border-card)'
                }}
              >
                {/* Thumbnail */}
                <img
                  src={
                    item.images?.[0]?.url ||
                    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&fit=crop'
                  }
                  alt={item.name}
                  style={{
                    width: '58px',
                    height: '58px',
                    borderRadius: 'var(--radius-sm)',
                    objectFit: 'cover',
                    background: 'var(--bg-surface-muted)',
                    border: '1px solid var(--border-subtle)',
                    flexShrink: 0
                  }}
                />

                {/* Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {item.brand}
                  </div>
                  <div
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                    title={item.name}
                  >
                    {item.name}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 700, marginTop: '2px' }}>
                    {formatPaise(item.unitPricePaise ?? Math.round((item.price || 0) * 100), item.price)}
                  </div>
                </div>

                {/* Stepper Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                  <div className="stepper-pill" style={{ padding: '2px' }}>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="stepper-btn"
                      style={{ width: '24px', height: '24px' }}
                    >
                      <Icons.Minus size={12} />
                    </button>
                    <span className="stepper-count" style={{ fontSize: '0.85rem', minWidth: '22px' }}>
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      disabled={item.quantity >= 20 || item.quantity >= item.availableStock}
                      className="stepper-btn"
                      style={{ width: '24px', height: '24px' }}
                    >
                      <Icons.Plus size={12} />
                    </button>
                  </div>

                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {formatPaise(item.subtotalPaise ?? Math.round((item.subtotal ?? ((item.price || 0) * item.quantity)) * 100), item.subtotal ?? ((item.price || 0) * item.quantity))}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer & Checkout Breakdown */}
        {items.length > 0 && (
          <div
            style={{
              padding: '20px',
              borderTop: '1px solid var(--border-card)',
              backgroundColor: 'var(--bg-surface-muted)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            {/* Coupon Section */}
            {appliedCoupon ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 13px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--primary-light)',
                  border: '1px dashed var(--primary)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Icons.Tag size={16} color="var(--primary)" />
                  <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.85rem' }}>
                    {appliedCoupon.code}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    (−{formatPaise(appliedCoupon.discountAmountPaise)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={removeCoupon}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--danger)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <form onSubmit={handleApplyCoupon} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    placeholder="Enter Coupon Code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="form-input"
                    style={{ padding: '8px 12px', fontSize: '0.85rem', textTransform: 'uppercase' }}
                  />
                  <button type="submit" disabled={!couponCode.trim()} className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
                    Apply
                  </button>
                </form>
                {/* 1-Click Demo Coupon Pill */}
                <button
                  type="button"
                  onClick={() => handleQuickCoupon('WELCOME50')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--bg-surface)',
                    border: '1px dashed var(--primary)',
                    color: 'var(--primary)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <Icons.Sparkles size={12} />
                  <span>Tap to apply: <strong>WELCOME50</strong> (₹50 OFF)</span>
                </button>
              </div>
            )}

            {/* Price Calculations */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>Items Gross Total (MRP):</span>
                <span>{formatPaise(pricingSummary.itemsGrossTotalPaise)}</span>
              </div>
              {pricingSummary.totalItemDiscountPaise > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary)' }}>
                  <span>In-Store Item Savings:</span>
                  <span>−{formatPaise(pricingSummary.totalItemDiscountPaise)}</span>
                </div>
              )}
              {pricingSummary.couponDiscountAmountPaise > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary)' }}>
                  <span>Voucher Discount:</span>
                  <span>−{formatPaise(pricingSummary.couponDiscountAmountPaise)}</span>
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: 'var(--text-primary)',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  borderTop: '1px solid var(--border-card)',
                  paddingTop: '10px',
                  marginTop: '4px'
                }}
              >
                <span>Final Payable Amount:</span>
                <span style={{ color: 'var(--primary)' }}>
                  {formatPaise(pricingSummary.finalPayableAmountPaise)}
                </span>
              </div>
            </div>

            {/* Checkout CTA */}
            <button onClick={handleCheckout} className="btn btn-primary btn-lg btn-block">
              <span>Proceed to Self-Checkout</span>
              <Icons.ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartDrawer;
