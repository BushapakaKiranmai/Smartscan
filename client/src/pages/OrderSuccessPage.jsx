import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import api from '../api/client';
import { getExitPass } from '../services/exitService';
import QRCodeDisplay from '../components/QRCodeDisplay';
import { formatPaise } from '../context/CartContext';
import Icons from '../components/Icons';

export const OrderSuccessPage = () => {
  const { orderId: paramOrderId } = useParams();
  const location = useLocation();

  const [orderId, setOrderId] = useState(
    paramOrderId || localStorage.getItem('smartscan_latest_order_id') || null
  );
  const [order, setOrder] = useState(null);
  const [exitToken, setExitToken] = useState(
    location.state?.verificationResult?.exitToken || null
  );
  const [shortCode, setShortCode] = useState(null);
  const [passStatus, setPassStatus] = useState('ACTIVE');
  const [usedAt, setUsedAt] = useState(null);
  const [loading, setLoading] = useState(true);

  // Sync param changes
  useEffect(() => {
    if (paramOrderId) {
      setOrderId(paramOrderId);
    }
  }, [paramOrderId]);

  // 1. Initial Load: Fetch order & authoritative ExitPass status from backend
  useEffect(() => {
    let isMounted = true;

    const fetchOrderAndPass = async () => {
      try {
        setLoading(true);

        let activeId = orderId;
        if (!activeId) {
          try {
            const ordersRes = await api.get('/orders');
            const ordersList = ordersRes?.orders || ordersRes?.data?.orders || ordersRes?.data || [];
            if (Array.isArray(ordersList) && ordersList.length > 0) {
              activeId = ordersList[0]._id || ordersList[0].id;
              setOrderId(activeId);
              localStorage.setItem('smartscan_latest_order_id', activeId);
            }
          } catch (listErr) {
            console.warn('[ExitPass] Could not fetch user orders:', listErr);
          }
        }

        if (!activeId) {
          if (isMounted) setLoading(false);
          return;
        }

        const [orderRes, exitRes] = await Promise.all([
          api.get(`/orders/${activeId}`).catch(() => null),
          getExitPass(activeId).catch(() => null)
        ]);

        if (!isMounted) return;

        const raw =
          orderRes?.transaction ||
          orderRes?.data?.order ||
          orderRes?.order ||
          orderRes?.data?.transaction ||
          orderRes?.data ||
          orderRes ||
          {};

        const items = raw.items || [];
        const rawTotal = raw.totalAmount || 0;
        const totalPaise =
          raw.totalAmountPaise ||
          raw.finalPayableAmountPaise ||
          Math.round(rawTotal * 100);

        const passData = exitRes?.data || exitRes || {};
        const tokenVal =
          passData.passId ||
          passData.uniquePassId ||
          passData.exitToken ||
          raw.exitToken ||
          exitToken ||
          `EXIT-${String(raw._id || orderId).slice(-6).toUpperCase()}`;

        const codeVal =
          passData.shortCode ||
          (typeof tokenVal === 'string' && tokenVal.includes('-')
            ? tokenVal.split('-').slice(-1)[0]
            : String(raw.orderNumber || 'EXIT89').slice(-6));

        const backendStatus =
          passData.status ||
          (raw.status === 'completed' ? 'USED' : raw.paymentStatus === 'paid' ? 'ACTIVE' : 'PENDING');

        const normalized = {
          _id: raw._id || raw.id || orderId,
          orderNumber:
            raw.orderNumber ||
            `ORD-${String(raw._id || orderId).slice(-8).toUpperCase()}`,
          items: items.map((item) => ({
            name: item.name || 'Store Item',
            quantity: item.quantity || 1,
            unitPricePaise:
              item.unitPricePaise || Math.round((item.price || 0) * 100),
            subtotalPaise:
              item.subtotalPaise ||
              Math.round(
                (item.subtotal || (item.price || 0) * (item.quantity || 1) || 0) * 100
              )
          })),
          pricingSummary: {
            itemsGrossTotalPaise:
              raw.pricingSummary?.itemsGrossTotalPaise ||
              raw.pricing?.itemsGrossTotalPaise ||
              totalPaise,
            totalItemDiscountPaise:
              raw.pricingSummary?.totalItemDiscountPaise || 0,
            couponDiscountAmountPaise:
              raw.pricingSummary?.couponDiscountAmountPaise || 0,
            totalTaxAmountPaise:
              raw.pricingSummary?.totalTaxAmountPaise || 0,
            finalPayableAmountPaise:
              raw.pricingSummary?.finalPayableAmountPaise ||
              raw.pricing?.finalPayableAmountPaise ||
              totalPaise
          },
          paidAt:
            raw.paidAt ||
            raw.updatedAt ||
            raw.createdAt ||
            new Date().toISOString(),
          paymentStatus: raw.paymentStatus || 'paid',
          exitToken: tokenVal
        };

        setOrder(normalized);
        setExitToken(tokenVal);
        setShortCode(codeVal);
        setPassStatus(backendStatus);
        if (passData.usedAt) {
          setUsedAt(passData.usedAt);
        }
      } catch (err) {
        console.error('[Receipt] Fetch error:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchOrderAndPass();

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  // 2. Realtime Background Polling: Update customer UI when gate scanner burns the pass
  useEffect(() => {
    if (passStatus !== 'ACTIVE' || !orderId) return;

    const intervalId = setInterval(async () => {
      try {
        const exitRes = await getExitPass(orderId);
        const latestStatus = exitRes?.data?.status;
        if (latestStatus && latestStatus !== 'ACTIVE') {
          setPassStatus(latestStatus);
          if (exitRes.data?.usedAt) {
            setUsedAt(exitRes.data.usedAt);
          }
        }
      } catch (e) {
        // Silently catch background poll error
      }
    }, 2500);

    return () => clearInterval(intervalId);
  }, [orderId, passStatus]);

  if (loading && !order) {
    return (
      <div className="container app-workspace page-container" style={{ textAlign: 'center', paddingTop: '80px', paddingBottom: '90px' }}>
        <Icons.Sparkles size={40} color="var(--primary)" style={{ marginBottom: '16px' }} />
        <div style={{ color: 'var(--primary)', fontSize: '1.2rem', fontWeight: 800 }}>
          Retrieving your digital receipt & exit verification pass...
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="container app-workspace page-container" style={{ textAlign: 'center', paddingTop: '60px', paddingBottom: '90px' }}>
        <Icons.CheckCircle2 size={52} color="var(--primary)" style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '8px' }}>
          Payment Verified
        </h2>
        <p className="subtitle" style={{ marginBottom: '24px' }}>
          Your purchase was successfully completed.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '300px', margin: '0 auto' }}>
          <Link to="/orders" className="btn btn-primary btn-block">
            <Icons.Receipt size={18} />
            <span>View Receipt & Exit Pass</span>
          </Link>
          <Link to="/home" className="btn btn-secondary btn-block">
            <Icons.Home size={18} />
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    );
  }

  const rawToken =
    (typeof exitToken === 'string'
      ? exitToken
      : exitToken?.rawToken || exitToken?.exitToken) ||
    order.exitToken ||
    `PASS-${order._id}`;

  const isPassUsed = passStatus === 'USED';
  const isPassExpired = passStatus === 'EXPIRED';

  return (
    <div className="container app-workspace page-container">
      {/* Success Celebration Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div
          style={{
            width: '68px',
            height: '68px',
            borderRadius: '50%',
            background: isPassUsed
              ? 'linear-gradient(135deg, #059669 0%, #047857 100%)'
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: '#ffffff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '14px',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)'
          }}
        >
          <Icons.CheckCircle2 size={40} />
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.85rem',
            fontWeight: 900,
            letterSpacing: '-0.025em',
            color: 'var(--text-primary)',
            marginBottom: '6px'
          }}
        >
          {isPassUsed ? 'Exit Verified & Complete!' : 'Payment Confirmed!'}
        </h1>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '340px', margin: '0 auto' }}>
          {isPassUsed
            ? 'Your store exit has been approved. Thank you for shopping with SmartScan Pay!'
            : 'Your payment was processed. Flash the authorized exit pass below at the security gate to depart.'}
        </p>
      </div>

      {/* 1. Digital Exit Gate Pass Card */}
      <div
        className="glass-card"
        style={{
          padding: '28px 22px',
          borderRadius: '26px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          border: isPassUsed
            ? '2px solid var(--border-color, #cbd5e1)'
            : isPassExpired
            ? '2px solid #f59e0b'
            : '2px solid var(--primary)',
          boxShadow: isPassUsed
            ? '0 4px 20px rgba(0, 0, 0, 0.06)'
            : '0 8px 32px rgba(16, 185, 129, 0.2)',
          background: 'var(--bg-surface)',
          marginBottom: '24px',
          transition: 'all 0.3s ease'
        }}
      >
        {/* State Badge */}
        {isPassUsed ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#059669',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.78rem',
              fontWeight: 800,
              marginBottom: '16px',
              border: '1px solid rgba(16, 185, 129, 0.3)'
            }}
          >
            <Icons.CheckCircle2 size={15} />
            <span>EXIT PASS USED</span>
          </div>
        ) : isPassExpired ? (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(245, 158, 11, 0.12)',
              color: '#d97706',
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.78rem',
              fontWeight: 800,
              marginBottom: '16px',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }}
          >
            <Icons.AlertTriangle size={15} />
            <span>EXIT PASS EXPIRED</span>
          </div>
        ) : (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              padding: '5px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 800,
              marginBottom: '16px'
            }}
          >
            <Icons.ShieldCheck size={14} />
            <span>AUTHORIZED EXIT PASS</span>
          </div>
        )}

        {/* Heading & Subtitle based on state */}
        {isPassUsed ? (
          <>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Exit Verified
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '320px', marginBottom: '16px' }}>
              Your exit has been verified. This pass can no longer be used.
            </p>

            {/* Checkpoints as required by spec */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                width: '100%',
                maxWidth: '280px',
                background: 'rgba(16, 185, 129, 0.07)',
                padding: '12px 16px',
                borderRadius: '12px',
                marginBottom: '18px',
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', fontWeight: 700, color: '#047857' }}>
                <Icons.CheckCircle2 size={16} />
                <span>Exit verified</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', fontWeight: 700, color: '#047857' }}>
                <Icons.CheckCircle2 size={16} />
                <span>Payment verified</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', fontWeight: 700, color: '#047857' }}>
                <Icons.CheckCircle2 size={16} />
                <span>Exit pass consumed</span>
              </div>
            </div>
          </>
        ) : isPassExpired ? (
          <>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#d97706', marginBottom: '4px' }}>
              Exit Pass Expired
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '300px', marginBottom: '20px' }}>
              This exit pass has exceeded the departure window. Please see supermarket staff for assistance.
            </p>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Scan at Supermarket Gate
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: '300px', marginBottom: '20px' }}>
              Present this live QR code or 6-character shortcode at the exit gate scanner to clear departure.
            </p>
          </>
        )}

        {/* QR Display with State Control */}
        <QRCodeDisplay
          token={rawToken}
          shortCode={shortCode}
          size={200}
          status={passStatus}
          usedAt={usedAt}
        />

        {/* Security Meta */}
        <div
          style={{
            marginTop: '20px',
            padding: '12px 14px',
            borderRadius: '16px',
            background: 'var(--bg-surface-muted)',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
            width: '100%',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <div>Store: <strong style={{ color: 'var(--text-primary)' }}>SmartScan Express</strong></div>
          <div>Order: <strong style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{order.orderNumber}</strong></div>
          <div>Status: <strong style={{ color: isPassUsed ? '#059669' : isPassExpired ? '#d97706' : 'var(--primary)' }}>{passStatus}</strong></div>
          {usedAt && (
            <div>Verified At: <strong>{new Date(usedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</strong></div>
          )}
          {!isPassUsed && (
            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Strict one-time pass. Automatically invalidated upon first exit.
            </div>
          )}
        </div>

        {!isPassUsed && !isPassExpired && (
          <Link
            to="/terminal"
            className="btn btn-secondary btn-sm"
            style={{ marginTop: '16px', width: '100%', borderRadius: 'var(--radius-md)', fontWeight: 700 }}
          >
            <Icons.ShieldCheck size={16} />
            <span>Simulate Gate Security Check</span>
          </Link>
        )}
      </div>

      {/* 2. Digital Thermal Tax Invoice Ticket */}
      <div className="receipt-ticket" style={{ padding: '24px 20px', borderRadius: '22px', marginBottom: '24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            SmartScan Express
          </h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Self-Checkout Station • Cashier: Customer App
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            GSTIN: 36AAACS1234A1Z5
          </div>
        </div>

        <div className="receipt-divider-dotted" />

        {/* Metadata */}
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Order No:</span>
            <strong style={{ fontFamily: 'monospace', color: 'var(--text-primary)' }}>{order.orderNumber}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Transaction Time:</span>
            <span>{new Date(order.paidAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}, {new Date(order.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Status:</span>
            <span style={{ color: 'var(--primary)', fontWeight: 800 }}>PAID ✓</span>
          </div>
        </div>

        <div className="receipt-divider-dotted" />

        {/* Itemized Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.84rem' }}>
          {(order.items || []).map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{item.name}</div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {item.quantity} × {formatPaise(item.unitPricePaise)}
                </div>
              </div>
              <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                {formatPaise(item.subtotalPaise)}
              </div>
            </div>
          ))}
        </div>

        <div className="receipt-divider-dotted" />

        {/* Financial Totals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.86rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
            <span>Gross MRP:</span>
            <span>{formatPaise(order.pricingSummary?.itemsGrossTotalPaise)}</span>
          </div>

          {order.pricingSummary?.totalItemDiscountPaise > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary)', fontWeight: 700 }}>
              <span>Store Savings:</span>
              <span>−{formatPaise(order.pricingSummary?.totalItemDiscountPaise)}</span>
            </div>
          )}

          {order.pricingSummary?.couponDiscountAmountPaise > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary)', fontWeight: 700 }}>
              <span>Coupon Applied:</span>
              <span>−{formatPaise(order.pricingSummary?.couponDiscountAmountPaise)}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
            <span>GST & Taxes (Included):</span>
            <span>{formatPaise(order.pricingSummary?.totalTaxAmountPaise || 0)}</span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              fontWeight: 900,
              fontSize: '1.25rem',
              color: 'var(--text-primary)',
              borderTop: '2px dashed var(--border-subtle)',
              paddingTop: '10px',
              marginTop: '4px'
            }}
          >
            <span>Amount Paid:</span>
            <span style={{ color: 'var(--primary)' }}>
              {formatPaise(order.pricingSummary?.finalPayableAmountPaise)}
            </span>
          </div>
        </div>

        <div className="receipt-divider-dotted" />

        <div style={{ textAlign: 'center', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
          Thank you for shopping with SmartScan Pay!
          <br />
          Scan. Pay. Go.
        </div>

        {/* Print Button */}
        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => window.print()}
            className="btn btn-secondary btn-sm btn-block"
            style={{ borderRadius: 'var(--radius-md)', fontWeight: 700 }}
          >
            <Icons.Receipt size={16} />
            <span>Print / Save Tax Receipt</span>
          </button>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Link to="/scan" className="btn btn-primary btn-block" style={{ padding: '14px', borderRadius: 'var(--radius-md)', fontWeight: 800 }}>
          <Icons.Camera size={18} />
          <span>Scan More Items</span>
        </Link>
        <Link to="/orders" className="btn btn-secondary btn-block" style={{ padding: '12px', borderRadius: 'var(--radius-md)', fontWeight: 700 }}>
          <Icons.Receipt size={18} />
          <span>View All Order Receipts</span>
        </Link>
      </div>
    </div>
  );
};

export default OrderSuccessPage;
