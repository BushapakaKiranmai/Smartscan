import React, { useState, useEffect, useRef } from 'react';
import api from '../api/client';
import { formatPaise } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import Icons from './Icons';

/**
 * Payment States:
 * - PAYMENT_PENDING: Customer selects method, ready to click Pay
 * - OPENING_GATEWAY: Razorpay Checkout is initializing/opening
 * - PROCESSING: Customer completed gateway action, backend is verifying HMAC/fetch
 * - SUCCESS: Backend confirmed authentic captured payment & created Exit Pass
 * - FAILED: Payment or signature verification rejected
 * - CANCELLED: Customer closed the gateway without paying
 */
export const RazorpayModal = ({ order, paymentData, onPaymentSuccess, onCancel }) => {
  const [paymentState, setPaymentState] = useState('PAYMENT_PENDING');
  // 'google_pay' | 'phonepe' | 'other_upi' | 'upi_qr' | 'card' | 'netbanking'
  const [selectedMethod, setSelectedMethod] = useState('google_pay');
  const [failureReason, setFailureReason] = useState('');
  const [verifiedResponse, setVerifiedResponse] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const [customKeyId, setCustomKeyId] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  const toast = useToast();
  const isSubmittingRef = useRef(false);
  const isVerifyingRef = useRef(false);
  const rzpInstanceRef = useRef(null);

  // Authoritative calculations from order and backend paymentData
  const rawTotal = order?.pricing?.finalPayableAmountPaise || order?.totalAmountPaise;
  const amountPaise = paymentData?.amountPaise || (typeof rawTotal === 'number' ? rawTotal : Math.round((order?.totalAmount || 0) * 100));
  const amountRupees = (amountPaise / 100).toFixed(2);
  const orderId = order?._id || order?.id || paymentData?.orderId || 'ORDER';

  const activeKeyId = (
    customKeyId.trim() ||
    paymentData?.keyId ||
    paymentData?.key ||
    import.meta.env.VITE_RAZORPAY_KEY_ID ||
    ''
  ).trim();

  const isKeyPlaceholder = !activeKeyId || activeKeyId.includes('placeholder');

  // Detect mobile viewport
  const isMobile = typeof window !== 'undefined' && (
    window.innerWidth <= 768 ||
    /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
  );

  // Default to UPI QR on desktop, Google Pay on mobile
  useEffect(() => {
    if (!isMobile) {
      setSelectedMethod('upi_qr');
    } else {
      setSelectedMethod('google_pay');
    }
  }, [isMobile]);

  // Cleanup Razorpay on unmount
  useEffect(() => {
    return () => {
      isSubmittingRef.current = false;
      isVerifyingRef.current = false;
      if (rzpInstanceRef.current && typeof rzpInstanceRef.current.close === 'function') {
        try {
          rzpInstanceRef.current.close();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  // ----------------------------------------------------
  // BACKEND AUTHORITATIVE PAYMENT VERIFICATION
  // ----------------------------------------------------
  const handleVerifyPayment = async (providerDetails = {}) => {
    if (isVerifyingRef.current) return;
    isVerifyingRef.current = true;

    setPaymentState('PROCESSING');
    setFailureReason('');

    console.log('[PAYMENT] Authoritative verification requested');
    console.log(`[PAYMENT] Order ID: ${orderId}`);
    console.log(`[PAYMENT] Expected amount: ₹${amountRupees}`);

    try {
      const payload = {
        orderId: orderId,
        transactionId: orderId,
        razorpay_order_id: providerDetails.razorpay_order_id || paymentData?.razorpayOrderId,
        razorpay_payment_id: providerDetails.razorpay_payment_id,
        razorpay_signature: providerDetails.razorpay_signature,
        upiTransactionRef: providerDetails.upiTransactionRef
      };

      const res = await api.post(`/transactions/${orderId}/verify`, payload);

      if (res.success && (res.paymentStatus === 'PAYMENT_SUCCESS' || res.transaction?.paymentStatus === 'paid')) {
        console.log('[PAYMENT] Payment successfully verified by server.');
        console.log('[PAYMENT] One-time Exit Pass created.');

        setPaymentState('SUCCESS');
        setVerifiedResponse(res);
        toast.success('Payment verified! Digital Receipt & Exit Pass ready.');
      } else {
        setPaymentState('FAILED');
        setFailureReason(res.message || 'Payment not confirmed by bank or provider.');
        toast.error(res.message || 'Payment verification was not approved.');
      }
    } catch (err) {
      const errorData = err.response?.data || err;
      const message = errorData.message || 'Payment verification could not be completed.';
      console.warn('[PAYMENT] Verification rejected:', message);

      setPaymentState('FAILED');
      setFailureReason(message);
      toast.error(message);
    } finally {
      isVerifyingRef.current = false;
    }
  };

  // ----------------------------------------------------
  // LAUNCH RAZORPAY CHECKOUT WITH SELECTED METHOD
  // ----------------------------------------------------
  const handlePayClick = () => {
    if (isSubmittingRef.current || paymentState === 'OPENING_GATEWAY' || paymentState === 'PROCESSING') {
      return;
    }

    if (!window.Razorpay) {
      toast.warning('Razorpay Checkout SDK is still loading. Please check your internet connection.');
      return;
    }

    if (isKeyPlaceholder) {
      toast.warning('Razorpay Key ID is still a placeholder. Please enter a key or test below.');
      setShowKeyInput(true);
      return;
    }

    isSubmittingRef.current = true;
    setPaymentState('OPENING_GATEWAY');

    try {
      const isMock = paymentData?.razorpayOrderId?.startsWith('order_mock_');
      const rzOrderId = isMock ? undefined : paymentData?.razorpayOrderId;

      // Base Razorpay Standard Checkout options
      const options = {
        key: activeKeyId,
        amount: amountPaise,
        currency: 'INR',
        name: 'SmartScan & Pay',
        description: `Order #${String(orderId).slice(-6).toUpperCase()}`,
        order_id: rzOrderId,
        prefill: {
          name: order?.user?.name || 'SmartScan Customer',
          email: order?.user?.email || 'customer@smartscanpay.local',
          contact: order?.user?.phone || '+919999911111'
        },
        theme: { color: '#059669' },
        modal: {
          ondismiss: () => {
            console.log('[Razorpay] Checkout modal dismissed by user.');
            isSubmittingRef.current = false;
            setPaymentState((current) => (current === 'SUCCESS' || current === 'PROCESSING' ? current : 'CANCELLED'));
          }
        },
        handler: async (response) => {
          console.log('[Razorpay] Payment captured by SDK. Invoking backend verification...');
          isSubmittingRef.current = false;
          await handleVerifyPayment({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature
          });
        }
      };

      // Method-specific Razorpay Checkout configurations
      if (selectedMethod === 'google_pay') {
        options.config = {
          display: {
            blocks: {
              upi: {
                name: 'Pay with Google Pay',
                instruments: [
                  {
                    method: 'upi',
                    flows: ['intent'],
                    apps: ['google_pay']
                  }
                ]
              }
            },
            sequence: ['block.upi'],
            preferences: { show_default_blocks: true }
          }
        };
      } else if (selectedMethod === 'phonepe') {
        options.config = {
          display: {
            blocks: {
              upi: {
                name: 'Pay with PhonePe',
                instruments: [
                  {
                    method: 'upi',
                    flows: ['intent'],
                    apps: ['phonepe']
                  }
                ]
              }
            },
            sequence: ['block.upi'],
            preferences: { show_default_blocks: true }
          }
        };
      } else if (selectedMethod === 'other_upi') {
        options.config = {
          display: {
            blocks: {
              upi: {
                name: 'Pay with UPI App',
                instruments: [
                  {
                    method: 'upi',
                    flows: ['intent', 'qr']
                  }
                ]
              }
            },
            sequence: ['block.upi'],
            preferences: { show_default_blocks: true }
          }
        };
      } else if (selectedMethod === 'upi_qr') {
        options.config = {
          display: {
            blocks: {
              upi: {
                name: 'Scan & Pay with UPI QR',
                instruments: [
                  {
                    method: 'upi',
                    flows: ['qr']
                  }
                ]
              }
            },
            sequence: ['block.upi'],
            preferences: { show_default_blocks: true }
          }
        };
      } else if (selectedMethod === 'card') {
        options.config = {
          display: {
            blocks: {
              card: {
                name: 'Credit or Debit Card',
                instruments: [{ method: 'card' }]
              }
            },
            sequence: ['block.card'],
            preferences: { show_default_blocks: true }
          }
        };
      } else if (selectedMethod === 'netbanking') {
        options.config = {
          display: {
            blocks: {
              netbanking: {
                name: 'Net Banking',
                instruments: [{ method: 'netbanking' }]
              }
            },
            sequence: ['block.netbanking'],
            preferences: { show_default_blocks: true }
          }
        };
      }

      const rzp = new window.Razorpay(options);

      rzp.on('payment.failed', (res) => {
        console.warn('[Razorpay] Payment failed event:', res.error?.description);
        isSubmittingRef.current = false;
        setPaymentState('FAILED');
        setFailureReason(res.error?.description || 'Payment rejected by bank.');
        toast.error(res.error?.description || 'Payment was unsuccessful.');
      });

      rzpInstanceRef.current = rzp;
      rzp.open();

      // Return state to pending so if customer returns without paying, Pay button is active
      setTimeout(() => {
        isSubmittingRef.current = false;
        setPaymentState((current) => (current === 'OPENING_GATEWAY' ? 'PAYMENT_PENDING' : current));
      }, 1000);
    } catch (err) {
      console.error('[Razorpay] Failed to open Checkout:', err);
      isSubmittingRef.current = false;
      setPaymentState('FAILED');
      setFailureReason(err.message || 'Could not launch payment gateway.');
      toast.error(err.message || 'Could not open payment window.');
    }
  };

  // ----------------------------------------------------
  // DEVELOPER TESTING / SIMULATOR ACTIONS
  // ----------------------------------------------------
  const handleSimulatePayment = async (simulatedPaise) => {
    try {
      setIsSimulating(true);
      await api.post(`/transactions/${orderId}/simulate-upi`, {
        orderId,
        amountPaise: simulatedPaise,
        status: 'captured',
        providerPaymentId: `upi_sim_${Date.now()}`
      });
      toast.info(`Simulated incoming payment: ₹${(simulatedPaise / 100).toFixed(2)}. Click Verify.`);
    } catch (err) {
      toast.error(`Simulation failed: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  // Payment Methods Data
  const paymentMethods = [
    {
      id: 'google_pay',
      name: 'Google Pay',
      subtitle: isMobile ? 'Tap to open Google Pay' : 'UPI Intent on supported device',
      tag: 'Instant UPI',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#F8FAFC" />
          <path d="M12 5C8.13 5 5 8.13 5 12C5 15.87 8.13 19 12 19C15.87 19 19 15.87 19 12" stroke="#4285F4" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M19 8L14 13L11 10" stroke="#34A853" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    },
    {
      id: 'phonepe',
      name: 'PhonePe',
      subtitle: isMobile ? 'Tap to open PhonePe' : 'UPI Intent on supported device',
      tag: 'Instant UPI',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="6" fill="#6739B7" />
          <text x="7" y="17" fill="#FFFFFF" fontSize="13" fontWeight="900" fontFamily="sans-serif">पे</text>
        </svg>
      )
    },
    {
      id: 'other_upi',
      name: 'Other UPI Apps',
      subtitle: 'Paytm, BHIM, CRED & any installed app',
      tag: 'UPI Intent',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
          <path d="M12 18h.01" />
        </svg>
      )
    },
    {
      id: 'upi_qr',
      name: 'UPI QR Code',
      subtitle: isMobile ? 'Scan with a 2nd phone or tablet' : 'Scan using any UPI app on your phone',
      tag: isMobile ? '2nd Phone' : 'Recommended',
      icon: <Icons.QrCode size={22} />
    },
    {
      id: 'card',
      name: 'Card',
      subtitle: 'Credit or Debit (Visa, MasterCard, RuPay)',
      tag: 'Cards',
      icon: <Icons.CreditCard size={22} />
    },
    {
      id: 'netbanking',
      name: 'Net Banking',
      subtitle: 'SBI, HDFC, ICICI, Axis & 50+ banks',
      tag: 'All Banks',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />
        </svg>
      )
    }
  ];

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={paymentState === 'PROCESSING' || paymentState === 'OPENING_GATEWAY' ? undefined : onCancel}
    >
      <div
        className="modal-content glass-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: '24px',
          padding: '24px',
          backgroundColor: 'var(--bg-surface)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-card)'
        }}
      >
        {/* ==================================================== */}
        {/* HEADER                                               */}
        {/* ==================================================== */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '16px',
            marginBottom: '18px'
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
              <Icons.CreditCard size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Payment
              </h2>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Order #{String(orderId).slice(-8).toUpperCase()}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={paymentState === 'PROCESSING' || paymentState === 'OPENING_GATEWAY'}
            aria-label="Close Payment"
            className="btn btn-ghost btn-icon"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              background: 'transparent',
              cursor: paymentState === 'PROCESSING' || paymentState === 'OPENING_GATEWAY' ? 'not-allowed' : 'pointer'
            }}
          >
            <Icons.X size={20} />
          </button>
        </div>

        {/* ==================================================== */}
        {/* ORDER TOTAL BOX                                      */}
        {/* ==================================================== */}
        <div
          style={{
            background: 'var(--primary-light)',
            border: '1.5px solid var(--primary-subtle)',
            borderRadius: '16px',
            padding: '16px',
            textAlign: 'center',
            marginBottom: '20px'
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-secondary)',
              marginBottom: '4px'
            }}
          >
            Order Total
          </div>
          <div
            style={{
              fontSize: '2.4rem',
              fontWeight: 900,
              color: 'var(--primary)',
              lineHeight: 1.15
            }}
          >
            ₹{amountRupees}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Authoritative Server Verified Amount ({order?.items?.length || 0} items)
          </div>
        </div>

        {/* ==================================================== */}
        {/* VIEW 1: PAYMENT SUCCESS                              */}
        {/* ==================================================== */}
        {paymentState === 'SUCCESS' ? (
          <div
            style={{
              padding: '28px 20px',
              textAlign: 'center',
              background: 'rgba(16, 185, 129, 0.08)',
              borderRadius: '18px',
              border: '2px solid var(--primary)',
              marginBottom: '16px'
            }}
          >
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: 'var(--primary)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '14px',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)'
              }}
            >
              <Icons.CheckCircle2 size={36} />
            </div>

            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--primary)', marginBottom: '6px' }}>
              Payment Successful!
            </div>

            <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '8px' }}>
              ₹{amountRupees} Paid
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '22px', lineHeight: 1.5 }}>
              Stock updated in branch inventory. Your one-time Exit Pass has been generated and is ready for gate verification.
            </p>

            <button
              type="button"
              id="get-exit-pass-btn"
              onClick={() => onPaymentSuccess(verifiedResponse)}
              className="btn btn-primary btn-lg btn-block"
              style={{
                padding: '15px',
                fontSize: '1.05rem',
                fontWeight: 900,
                borderRadius: '14px',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                cursor: 'pointer'
              }}
            >
              <span>Get Exit Pass</span>
              <Icons.ChevronRight size={20} />
            </button>
          </div>
        ) : paymentState === 'FAILED' ? (
          /* ==================================================== */
          /* VIEW 2: PAYMENT FAILED                               */
          /* ==================================================== */
          <div
            style={{
              padding: '24px 18px',
              textAlign: 'center',
              background: 'rgba(239, 68, 68, 0.08)',
              borderRadius: '18px',
              border: '1.5px solid var(--danger)',
              marginBottom: '16px'
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--danger)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px'
              }}
            >
              <Icons.AlertTriangle size={30} />
            </div>

            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--danger)', marginBottom: '8px' }}>
              Payment Verification Failed
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: 1.5 }}>
              {failureReason || 'Transaction was rejected by bank or provider.'}
            </p>

            <button
              type="button"
              onClick={() => {
                setPaymentState('PAYMENT_PENDING');
                setFailureReason('');
              }}
              className="btn btn-primary btn-block"
              style={{ padding: '12px', fontWeight: 800, borderRadius: '12px', width: '100%', cursor: 'pointer' }}
            >
              Try Again
            </button>
          </div>
        ) : paymentState === 'CANCELLED' ? (
          /* ==================================================== */
          /* VIEW 3: PAYMENT CANCELLED                            */
          /* ==================================================== */
          <div
            style={{
              padding: '24px 18px',
              textAlign: 'center',
              background: 'rgba(245, 158, 11, 0.08)',
              borderRadius: '18px',
              border: '1.5px solid var(--accent)',
              marginBottom: '16px'
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'rgba(245, 158, 11, 0.15)',
                color: 'var(--accent-dark)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px'
              }}
            >
              <Icons.Clock size={28} />
            </div>

            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-dark)', marginBottom: '8px' }}>
              Payment Cancelled
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: 1.5 }}>
              The payment window was closed before completion. Your cart items and order remain reserved and intact.
            </p>

            <button
              type="button"
              onClick={() => {
                setPaymentState('PAYMENT_PENDING');
                setFailureReason('');
              }}
              className="btn btn-primary btn-block"
              style={{ padding: '12px', fontWeight: 800, borderRadius: '12px', width: '100%', cursor: 'pointer' }}
            >
              Try Again
            </button>
          </div>
        ) : (
          /* ==================================================== */
          /* VIEW 4: METHOD SELECTION & PAY BUTTON                */
          /* ==================================================== */
          <div>
            <div
              style={{
                fontSize: '0.88rem',
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span>Choose Payment Method</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700 }}>
                {isMobile ? '📱 Mobile UPI Preferred' : '💻 Desktop Checkout'}
              </span>
            </div>

            {/* Payment Method Cards Grid */}
            <div
              role="radiogroup"
              aria-label="Choose Payment Method"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
                marginBottom: '18px'
              }}
            >
              {paymentMethods.map((method) => {
                const isSelected = selectedMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedMethod(method.id)}
                    disabled={paymentState === 'PROCESSING' || paymentState === 'OPENING_GATEWAY'}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '14px',
                      border: isSelected ? '2px solid var(--primary)' : '1.5px solid var(--border-card)',
                      background: isSelected ? 'var(--primary-light)' : 'var(--bg-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '8px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease-in-out',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ color: isSelected ? 'var(--primary)' : 'var(--text-secondary)' }}>
                        {method.icon}
                      </div>

                      {/* Radio indicator */}
                      <div
                        style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          border: isSelected ? '5px solid var(--primary)' : '2px solid var(--border-card)',
                          background: '#ffffff',
                          transition: 'all 0.15s ease'
                        }}
                      />
                    </div>

                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {method.name}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', lineHeight: 1.3 }}>
                        {method.subtitle}
                      </div>
                    </div>

                    {method.tag && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '6px',
                          background: isSelected ? 'rgba(5, 150, 105, 0.15)' : 'var(--bg-surface-muted)',
                          color: isSelected ? 'var(--primary-dark)' : 'var(--text-secondary)'
                        }}
                      >
                        {method.tag}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanatory Notice for Selected Method */}
            <div
              style={{
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                background: 'var(--bg-surface-muted)',
                padding: '10px 14px',
                borderRadius: '12px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Icons.Info size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
              <span>
                {selectedMethod === 'google_pay' && 'Google Pay UPI Intent flow. Opens GPay app directly on your device.'}
                {selectedMethod === 'phonepe' && 'PhonePe UPI Intent flow. Opens PhonePe app directly on your device.'}
                {selectedMethod === 'other_upi' && 'Supported UPI selector. Choose any installed UPI app (Paytm, BHIM, CRED).'}
                {selectedMethod === 'upi_qr' && 'Generates official Razorpay Order QR code to scan from another device.'}
                {selectedMethod === 'card' && 'Pay via Debit or Credit Card with 3D Secure OTP authentication.'}
                {selectedMethod === 'netbanking' && 'Pay securely via your bank portal with instant confirmation.'}
              </span>
            </div>

            {/* Primary CTA: Pay ₹<Amount> */}
            <button
              type="button"
              id="pay-now-cta-btn"
              onClick={handlePayClick}
              disabled={paymentState === 'OPENING_GATEWAY' || paymentState === 'PROCESSING'}
              className="btn btn-primary btn-lg btn-block"
              style={{
                padding: '15px',
                fontSize: '1.05rem',
                fontWeight: 900,
                borderRadius: '14px',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                width: '100%',
                cursor: paymentState === 'OPENING_GATEWAY' || paymentState === 'PROCESSING' ? 'not-allowed' : 'pointer'
              }}
            >
              {paymentState === 'OPENING_GATEWAY' ? (
                <>
                  <div className="spinner" style={{ width: '18px', height: '18px', borderTopColor: '#ffffff' }} />
                  <span>Opening secure payment...</span>
                </>
              ) : paymentState === 'PROCESSING' ? (
                <>
                  <div className="spinner" style={{ width: '18px', height: '18px', borderTopColor: '#ffffff' }} />
                  <span>Verifying payment...</span>
                </>
              ) : (
                <>
                  <Icons.ShieldCheck size={20} />
                  <span>Pay ₹{amountRupees}</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* ==================================================== */}
        {/* DEVELOPER SIMULATOR (Only if Key is Placeholder/Dev) */}
        {/* ==================================================== */}
        {(isKeyPlaceholder || import.meta.env.DEV) && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                🛠️ TEST BENCH (DEV MODE)
              </span>
              <button
                type="button"
                onClick={() => setShowDevTools(!showDevTools)}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.7rem', padding: '2px 6px', color: 'var(--text-secondary)' }}
              >
                {showDevTools ? 'Hide' : 'Test Tools'}
              </button>
            </div>

            {showDevTools && (
              <div
                style={{
                  background: 'var(--bg-surface-muted)',
                  padding: '10px',
                  borderRadius: '10px',
                  fontSize: '0.74rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  marginTop: '8px'
                }}
              >
                <div style={{ color: 'var(--text-muted)' }}>
                  Active Key: <code>{activeKeyId || 'None (Mock)'}</code>
                </div>

                {showKeyInput ? (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="rzp_test_..."
                      value={customKeyId}
                      onChange={(e) => setCustomKeyId(e.target.value)}
                      style={{ fontSize: '0.75rem', padding: '4px 8px', flex: 1 }}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowKeyInput(true)}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', textAlign: 'left', cursor: 'pointer', padding: 0 }}
                  >
                    + Enter Razorpay Key ID
                  </button>
                )}

                <div style={{ fontWeight: 700, marginTop: '4px' }}>Simulate Gateway Payments:</div>
                <button
                  type="button"
                  disabled={paymentState === 'PROCESSING' || isSimulating}
                  onClick={async () => {
                    await handleSimulatePayment(amountPaise);
                    await handleVerifyPayment();
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ textAlign: 'left', fontSize: '0.72rem' }}
                >
                  ⚡ Simulate Exact Payment (₹{amountRupees}) → Verify
                </button>
                <button
                  type="button"
                  disabled={paymentState === 'PROCESSING' || isSimulating}
                  onClick={async () => {
                    await handleSimulatePayment(100);
                    await handleVerifyPayment();
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ textAlign: 'left', fontSize: '0.72rem' }}
                >
                  ⚠️ Simulate Wrong Amount (₹1.00) → Expect Fail
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer Security Assurance */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            marginTop: '14px',
            textAlign: 'center'
          }}
        >
          <Icons.ShieldCheck size={14} color="var(--primary)" />
          <span>256-Bit SSL Encrypted • Powered by Razorpay Standard Gateway</span>
        </div>
      </div>
    </div>
  );
};

export default RazorpayModal;
