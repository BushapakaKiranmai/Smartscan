import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useStore } from '../context/StoreContext';
import { useCart, formatPaise } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import RazorpayModal from '../components/RazorpayModal';
import Icons from '../components/Icons';

export const CheckoutPage = () => {
  const { selectedBranch } = useStore();
  const { cart, clearCart } = useCart();
  const navigate = useNavigate();
  const toast = useToast();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(900); // 15 mins default

  // Step 1: Initiate Checkout on Mount with frontend cart items
  useEffect(() => {
    const initiateCheckout = async () => {
      const items = cart?.items || [];
      if (items.length === 0) {
        toast.warning('Your tray is empty.');
        navigate('/cart');
        return;
      }

      try {
        setLoading(true);
        const branchId = selectedBranch?._id || 'dmart-kukatpally';
        const res = await api.post('/transactions/checkout', { items, branchId });
        const orderData = res.order || res.transaction || res.data?.order || res.data?.transaction || res.data || {};
        
        const rawItems = orderData.items || res.transaction?.items || items || [];
        const normalizedItems = rawItems.map((item) => {
          const qty = Number(item.quantity) || 1;
          const priceRupees = Number(item.price) || (typeof item.unitPricePaise === 'number' ? item.unitPricePaise / 100 : 0);
          const unitPricePaise = typeof item.unitPricePaise === 'number' && item.unitPricePaise > 0
            ? Math.round(item.unitPricePaise)
            : Math.round(priceRupees * 100);
          const subtotalPaise = typeof item.subtotalPaise === 'number' && item.subtotalPaise > 0
            ? Math.round(item.subtotalPaise)
            : Math.round((Number(item.subtotal) || (priceRupees * qty)) * 100);

          return {
            ...item,
            productId: item.productId || item._id,
            name: item.name,
            quantity: qty,
            price: priceRupees,
            subtotal: subtotalPaise / 100,
            unitPricePaise,
            subtotalPaise
          };
        });

        const calculatedGrossPaise = normalizedItems.reduce((acc, it) => acc + (it.subtotalPaise || 0), 0);
        const rawTotal = orderData.totalAmount || res.transaction?.totalAmount || (calculatedGrossPaise / 100);
        const totalPaise = orderData.totalAmountPaise || orderData.finalPayableAmountPaise || (calculatedGrossPaise > 0 ? calculatedGrossPaise : Math.round(rawTotal * 100));

        const normalizedOrder = {
          ...orderData,
          _id: orderData._id || orderData.id || res.transaction?._id,
          orderNumber: orderData.orderNumber || `ORD-${String(orderData._id || res.transaction?._id || Date.now()).slice(-8).toUpperCase()}`,
          items: normalizedItems,
          totalAmount: rawTotal || (totalPaise / 100),
          pricing: {
            itemsGrossTotalPaise: orderData.pricing?.itemsGrossTotalPaise || totalPaise,
            totalItemDiscountPaise: orderData.pricing?.totalItemDiscountPaise || 0,
            couponDiscountAmountPaise: orderData.pricing?.couponDiscountAmountPaise || 0,
            taxAmountPaise: orderData.pricing?.taxAmountPaise || 0,
            finalPayableAmountPaise: orderData.pricing?.finalPayableAmountPaise || totalPaise
          }
        };

        setOrder(normalizedOrder);

        // Calculate countdown timer
        if (res.data?.reservationExpiresAt || res.reservationExpiresAt) {
          const diffMs = new Date(res.data?.reservationExpiresAt || res.reservationExpiresAt) - new Date();
          setTimeLeftSeconds(Math.max(0, Math.floor(diffMs / 1000)));
        }
      } catch (err) {
        toast.error(err.message || 'Checkout failed. Check your tray items.');
        navigate('/cart');
      } finally {
        setLoading(false);
      }
    };

    initiateCheckout();
  }, [cart, navigate, toast]);

  // Reservation Countdown Timer
  useEffect(() => {
    if (timeLeftSeconds <= 0) return;
    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeftSeconds]);

  // Step 2: Request Razorpay Order & Open Gateway Modal
  const handleStartPayment = async () => {
    if (!order) return;

    try {
      setLoading(true);
      const res = await api.post('/payments/create-order', { orderId: order._id || order.id });
      const pData = res.data || res;
      setPaymentData(pData);
      setShowPaymentModal(true);
    } catch (err) {
      toast.error(err.message || 'Failed to initialize payment gateway.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Payment Success Callback
  const handlePaymentSuccess = (verificationResult) => {
    setShowPaymentModal(false);
    clearCart(); // Frontend cart cleared after purchase
    navigate(`/order-success/${order._id || order.id}`, {
      state: { verificationResult }
    });
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading && !order) {
    return (
      <div className="container app-workspace page-container" style={{ textAlign: 'center', paddingTop: '80px', paddingBottom: '90px' }}>
        <div style={{ display: 'inline-block', marginBottom: '16px' }}>
          <Icons.ShieldCheck size={40} color="var(--primary)" />
        </div>
        <div style={{ color: 'var(--primary)', fontSize: '1.15rem', fontWeight: 800 }}>
          Reserving store items and verifying zero-trust pricing...
        </div>
      </div>
    );
  }

  if (!order) return null;

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
          <Icons.CheckCircle2 size={15} />
          Tray Review
        </span>
        <Icons.ChevronRight size={14} color="var(--text-muted)" />
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
            2
          </span>
          Secure Payment
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

      {/* Stock Reservation Banner */}
      <div
        className="glass-card"
        style={{
          padding: '14px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: '18px',
          borderLeft: '4px solid var(--accent-dark)',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Icons.Clock size={20} color="var(--accent-dark)" />
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              Stock Reserved for Self-Checkout
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Locked in store database. Complete payment before countdown expires.
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Expires in</div>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '1.2rem',
              fontWeight: 900,
              color: timeLeftSeconds < 180 ? 'var(--danger)' : 'var(--accent-dark)'
            }}
          >
            {formatTimer(timeLeftSeconds)}
          </div>
        </div>
      </div>

      {/* Order Review List */}
      <div
        className="glass-card"
        style={{
          padding: '20px',
          borderRadius: '24px',
          border: '1px solid var(--border-card)',
          background: 'var(--bg-surface)',
          marginBottom: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
            Scanned Items ({order.items?.length || 0})
          </div>
          <div style={{ fontSize: '0.78rem', fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700 }}>
            {order.orderNumber}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
          {order.items?.map((item, idx) => (
            <div
              key={item.productId || idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: '14px',
                background: 'var(--bg-surface-muted)',
                border: '1px solid var(--border-subtle)'
              }}
            >
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                  {item.name}
                </div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Qty: <strong>{item.quantity}</strong> × {formatPaise(item.unitPricePaise, item.price)}
                </div>
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {formatPaise(item.subtotalPaise, item.subtotal)}
              </div>
            </div>
          ))}
        </div>

        {/* Bill Financial Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span>MRP Subtotal:</span>
            <span>{formatPaise(order.pricing?.itemsGrossTotalPaise)}</span>
          </div>

          {order.pricing?.totalItemDiscountPaise > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary)', fontWeight: 700 }}>
              <span>Store Item Savings:</span>
              <span>−{formatPaise(order.pricing.totalItemDiscountPaise)}</span>
            </div>
          )}

          {order.pricing?.couponDiscountAmountPaise > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary)', fontWeight: 700 }}>
              <span>Coupon Applied:</span>
              <span>−{formatPaise(order.pricing.couponDiscountAmountPaise)}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            <span>GST & Taxes (Included):</span>
            <span>{formatPaise(order.pricing?.taxAmountPaise || 0)}</span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              borderTop: '1px solid var(--border-card)',
              paddingTop: '12px',
              marginTop: '4px'
            }}
          >
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>Final Payable:</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary)' }}>
              {formatPaise(order.pricing?.finalPayableAmountPaise)}
            </span>
          </div>
        </div>
      </div>

      {/* Zero Trust Verification Assurance */}
      <div
        style={{
          padding: '14px 16px',
          borderRadius: '18px',
          background: 'var(--primary-light)',
          border: '1px solid var(--primary-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '20px'
        }}
      >
        <Icons.ShieldCheck size={24} color="var(--primary)" style={{ flexShrink: 0 }} />
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '2px' }}>
            Zero-Trust Server Verified
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            Prices and stock cryptographically validated. Instant exit gate pass generated upon payment.
          </div>
        </div>
      </div>

      {/* Pay Now Button */}
      <button
        type="button"
        onClick={handleStartPayment}
        disabled={loading || timeLeftSeconds <= 0}
        className="btn btn-primary btn-lg btn-block"
        style={{
          padding: '15px',
          fontSize: '1.05rem',
          fontWeight: 900,
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 28px rgba(16, 185, 129, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px'
        }}
      >
        <Icons.CreditCard size={22} />
        <span>Pay {formatPaise(order.pricing?.finalPayableAmountPaise)} via Razorpay</span>
      </button>

      <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
        🔒 256-bit Encrypted Payment • UPI, Cards & NetBanking Supported
      </div>

      {/* Razorpay Gateway Modal */}
      {showPaymentModal && paymentData && (
        <RazorpayModal
          order={order}
          paymentData={paymentData}
          onPaymentSuccess={handlePaymentSuccess}
          onCancel={() => setShowPaymentModal(false)}
        />
      )}
    </div>
  );
};

export default CheckoutPage;
