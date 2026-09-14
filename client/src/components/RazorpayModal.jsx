import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import api from '../api/client';
import { formatPaise } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import Icons from './Icons';

/**
 * Payment States according to zero-trust specification:
 * - PAYMENT_PENDING: QR displayed, waiting for customer to pay
 * - PAYMENT_PROCESSING: Inquiry sent to backend payment provider
 * - PAYMENT_SUCCESS: Backend confirmed authentic captured payment
 * - PAYMENT_FAILED: Payment rejected (amount mismatch, invalid signature, failed provider transaction)
 * - PAYMENT_EXPIRED: Reservation or payment window timed out
 */
export const RazorpayModal = ({ order, paymentData, onPaymentSuccess, onCancel }) => {
  const [paymentState, setPaymentState] = useState('PAYMENT_PENDING');
  const [selectedMethod, setSelectedMethod] = useState('upi'); // 'upi' | 'razorpay'
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  const [customKeyId, setCustomKeyId] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [failureReason, setFailureReason] = useState('');
  const [verifiedResponse, setVerifiedResponse] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showDevTools, setShowDevTools] = useState(false);
  const toast = useToast();

  const amountPaise = paymentData?.amountPaise || (order?.totalAmount ? Math.round(order.totalAmount * 100) : 0);
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

  // Generate genuine dynamic camera-scannable UPI Payment QR Code for EXACT payable amount
  useEffect(() => {
    const generateUpiQr = async () => {
      try {
        // Encode exact amount down to two decimal places and exact orderId transaction reference
        const upiString = `upi://pay?pa=smartscanpay@upi&pn=SmartScan%20Pay&am=${amountRupees}&cu=INR&tr=${orderId}&tn=Order%20${orderId}`;
        const url = await QRCode.toDataURL(upiString, {
          width: 440,
          margin: 1,
          color: {
            dark: '#0f172a',
            light: '#ffffff'
          }
        });
        setQrCodeDataUrl(url);
      } catch (err) {
        console.error('[PaymentQR] Failed to generate QR code:', err);
      }
    };

    generateUpiQr();
  }, [amountRupees, orderId]);

  // Execute Payment Verification on Backend
  const handleVerifyPayment = async (providerDetails = {}) => {
    // 1. Transition state to PAYMENT_PROCESSING
    setPaymentState('PAYMENT_PROCESSING');
    setFailureReason('');

    // 2. Frontend debug logging as strictly specified
    console.log('[PAYMENT] Verification requested');
    console.log(`[PAYMENT] Order ID: ${orderId}`);
    console.log(`[PAYMENT] Expected amount: ₹${amountRupees}`);
    console.log('[PAYMENT] Verification pending');

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
        // Successful authentic verification
        console.log('[PAYMENT] Payment verified successfully');
        console.log('[PAYMENT] Exit pass can now be generated');

        setPaymentState('PAYMENT_SUCCESS');
        setVerifiedResponse(res);
        toast.success('Payment authorized and verified! Receipt & Exit Pass ready.');
      } else {
        // Stays pending if backend does not confirm success
        setPaymentState('PAYMENT_PENDING');
        setFailureReason(res.message || 'Payment not detected yet.');
        toast.warning(res.message || 'Payment not detected yet. Please scan and pay first.');
      }
    } catch (err) {
      const errorData = err.response?.data || err;
      const status = errorData.paymentStatus || 'PAYMENT_PENDING';
      const reason = errorData.rejectionReason;
      const message = errorData.message || 'Payment verification failed.';

      console.warn('[PAYMENT] Backend verification notice:', status, message);

      if (status === 'PAYMENT_FAILED' || reason === 'AMOUNT_MISMATCH' || reason === 'INVALID_SIGNATURE') {
        setPaymentState('PAYMENT_FAILED');
        setFailureReason(message);
        toast.error(message);
      } else {
        // Customer clicked verify without paying or transaction is still processing
        setPaymentState('PAYMENT_PENDING');
        setFailureReason(message);
        toast.warning(message);
      }
    }
  };

  // Launch official Razorpay SDK window
  const handleOpenRazorpaySDK = () => {
    if (!window.Razorpay) {
      toast.warning('Razorpay Checkout SDK is still loading. Please use the UPI QR code.');
      return;
    }

    if (isKeyPlaceholder) {
      toast.warning('Razorpay Key ID in server/.env is still a placeholder. Please save your key in server/.env or enter it below.');
      setShowKeyInput(true);
      return;
    }

    try {
      setPaymentState('PAYMENT_PROCESSING');
      const options = {
        key: activeKeyId,
        amount: amountPaise,
        currency: 'INR',
        name: 'SmartScan & Pay',
        description: `Self-Checkout Order #${String(orderId).slice(-6)}`,
        order_id: paymentData?.razorpayOrderId?.startsWith('order_mock') ? undefined : paymentData?.razorpayOrderId,
        prefill: {
          name: 'Customer',
          email: 'customer@smartscanpay.local',
          contact: '+919999911111'
        },
        handler: async (response) => {
          await handleVerifyPayment({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            razorpay_order_id: response.razorpay_order_id
          });
        },
        modal: {
          ondismiss: () => {
            setPaymentState('PAYMENT_PENDING');
          }
        },
        theme: { color: '#059669' }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (res) => {
        toast.error(res.error?.description || 'Payment was unsuccessful.');
        setPaymentState('PAYMENT_FAILED');
        setFailureReason(res.error?.description || 'Razorpay payment rejected by issuing bank.');
      });
      rzp.open();
    } catch (err) {
      console.warn('[Razorpay] SDK open error:', err);
      setPaymentState('PAYMENT_PENDING');
      toast.error(err.message || 'Could not launch Razorpay window. Please use the UPI QR code.');
    }
  };

  // Test Simulator Actions for Verifying Requirements & Test Cases
  const handleSimulatePayment = async (simulatedPaise) => {
    try {
      setIsSimulating(true);
      await api.post(`/transactions/${orderId}/simulate-upi`, {
        orderId,
        amountPaise: simulatedPaise,
        status: 'captured',
        providerPaymentId: `upi_sim_${Date.now()}`
      });

      toast.info(`Simulated incoming payment event: ₹${(simulatedPaise / 100).toFixed(2)}. Now click "Verify Payment".`);
    } catch (err) {
      toast.error(`Simulation failed: ${err.message}`);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={paymentState === 'PAYMENT_PROCESSING' ? undefined : onCancel}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ padding: '24px', maxWidth: '450px' }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
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
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Complete Payment</h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Order #{String(orderId).slice(-8).toUpperCase()}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={paymentState === 'PAYMENT_PROCESSING'}
            className="btn btn-ghost btn-icon"
            style={{ width: '32px', height: '32px' }}
          >
            <Icons.X size={18} />
          </button>
        </div>

        {/* Amount Box */}
        <div
          style={{
            background: 'var(--primary-light)',
            border: '1.5px solid var(--primary-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '14px 16px',
            textAlign: 'center',
            marginBottom: '18px'
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Payable Amount
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1.2 }}>
            ₹{amountRupees}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Authoritative Server Verified Total
          </div>
        </div>

        {/* ---------------------------------------------------- */}
        {/* VIEW 1: PAYMENT SUCCESS (Authoritative Server Proof) */}
        {/* ---------------------------------------------------- */}
        {paymentState === 'PAYMENT_SUCCESS' ? (
          <div
            style={{
              padding: '24px 16px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'rgba(16, 185, 129, 0.06)',
              borderRadius: 'var(--radius-lg)',
              border: '2px solid var(--primary)',
              marginBottom: '18px'
            }}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'var(--primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
                boxShadow: '0 6px 18px rgba(16, 185, 129, 0.35)'
              }}
            >
              <Icons.CheckCircle2 size={32} />
            </div>

            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--primary)', marginBottom: '4px' }}>
              ✓ PAYMENT SUCCESSFUL
            </div>

            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '4px' }}>
              ₹{amountRupees} Paid
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'var(--primary-light)',
                color: 'var(--primary)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.78rem',
                fontWeight: 800,
                marginBottom: '20px'
              }}
            >
              <Icons.ShieldCheck size={14} />
              <span>Transaction verified</span>
            </div>

            {/* THE "Get Exit Pass" BUTTON: ONLY RENDERED AFTER SUCCESSFUL VERIFICATION */}
            <button
              type="button"
              id="get-exit-pass-btn"
              onClick={() => onPaymentSuccess(verifiedResponse)}
              className="btn btn-primary btn-lg btn-block"
              style={{
                padding: '14px',
                fontSize: '1rem',
                fontWeight: 900,
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 8px 24px rgba(16, 185, 129, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <span>Get Exit Pass</span>
              <Icons.ChevronRight size={18} />
            </button>
          </div>
        ) : paymentState === 'PAYMENT_FAILED' ? (
          /* ---------------------------------------------------- */
          /* VIEW 2: PAYMENT FAILED                               */
          /* ---------------------------------------------------- */
          <div
            style={{
              padding: '22px 18px',
              textAlign: 'center',
              background: 'rgba(239, 68, 68, 0.06)',
              borderRadius: 'var(--radius-lg)',
              border: '1.5px solid var(--danger)',
              marginBottom: '18px'
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px'
              }}
            >
              <Icons.AlertTriangle size={28} />
            </div>

            <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--danger)', marginBottom: '6px' }}>
              Payment could not be verified
            </div>

            <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.4 }}>
              {failureReason || 'Transaction was rejected by provider or payment amount does not match order total.'}
            </p>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setPaymentState('PAYMENT_PENDING');
                  setFailureReason('');
                }}
                className="btn btn-primary btn-block"
              >
                Try Again
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedMethod(selectedMethod === 'upi' ? 'razorpay' : 'upi');
                  setPaymentState('PAYMENT_PENDING');
                  setFailureReason('');
                }}
                className="btn btn-secondary btn-block"
              >
                Choose Another Method
              </button>
            </div>
          </div>
        ) : (
          /* ---------------------------------------------------- */
          /* VIEW 3: PAYMENT PENDING & METHOD SELECTOR            */
          /* ---------------------------------------------------- */
          <div>
            {/* Method Selector Tabs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              <button
                type="button"
                onClick={() => setSelectedMethod('upi')}
                style={{
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${selectedMethod === 'upi' ? 'var(--primary)' : 'var(--border-card)'}`,
                  background: selectedMethod === 'upi' ? 'var(--primary-light)' : 'var(--bg-surface)',
                  color: selectedMethod === 'upi' ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Icons.QrCode size={18} />
                <span>Scan UPI QR</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedMethod('razorpay')}
                style={{
                  padding: '10px',
                  borderRadius: 'var(--radius-sm)',
                  border: `2px solid ${selectedMethod === 'razorpay' ? 'var(--primary)' : 'var(--border-card)'}`,
                  background: selectedMethod === 'razorpay' ? 'var(--primary-light)' : 'var(--bg-surface)',
                  color: selectedMethod === 'razorpay' ? 'var(--primary)' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <Icons.ShieldCheck size={18} />
                <span>Razorpay Gateway</span>
              </button>
            </div>

            {/* TAB 1: DYNAMIC SCANNABLE UPI QR CODE */}
            {selectedMethod === 'upi' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '18px' }}>
                <div
                  style={{
                    background: '#ffffff',
                    padding: '14px',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-md)',
                    border: '2.5px solid var(--primary)',
                    marginBottom: '12px',
                    textAlign: 'center'
                  }}
                >
                  {qrCodeDataUrl ? (
                    <img
                      src={qrCodeDataUrl}
                      alt="UPI Payment QR Code"
                      style={{ width: '190px', height: '190px', display: 'block' }}
                    />
                  ) : (
                    <div style={{ width: '190px', height: '190px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      Generating QR Code...
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Scan to Pay ₹{amountRupees}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Scan using Google Pay, PhonePe, Paytm, or BHIM
                  </div>
                </div>

                {/* Popular UPI Apps Badges */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '14px' }}>
                  {['Google Pay', 'PhonePe', 'Paytm', 'BHIM UPI'].map((app) => (
                    <span
                      key={app}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--bg-surface-muted)',
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: 'var(--text-secondary)'
                      }}
                    >
                      {app}
                    </span>
                  ))}
                </div>

                {/* REQUIRED BUTTON BEHAVIOR: "Verify Payment" with loading state */}
                <button
                  type="button"
                  id="verify-payment-btn"
                  onClick={() => handleVerifyPayment()}
                  disabled={paymentState === 'PAYMENT_PROCESSING'}
                  className="btn btn-primary btn-lg btn-block"
                  style={{
                    padding: '14px',
                    fontWeight: 800,
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {paymentState === 'PAYMENT_PROCESSING' ? (
                    <>
                      <div className="spinner" style={{ width: '16px', height: '16px', borderTopColor: '#fff' }} />
                      <span>Checking payment...</span>
                    </>
                  ) : (
                    <span>Verify Payment</span>
                  )}
                </button>

                {/* Status Notice */}
                <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  {failureReason ? (
                    <span style={{ color: 'var(--danger)', fontWeight: 600 }}>{failureReason}</span>
                  ) : (
                    <span>Payment status: <strong>Waiting for payment</strong></span>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: RAZORPAY GATEWAY CHECKOUT MODAL */}
            {selectedMethod === 'razorpay' && (
              <div style={{ marginBottom: '18px', textAlign: 'center' }}>
                <div
                  style={{
                    background: 'var(--bg-surface-muted)',
                    padding: '20px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '16px',
                    border: '1px solid var(--border-card)'
                  }}
                >
                  <Icons.ShieldCheck size={36} color="var(--primary)" style={{ marginBottom: '8px' }} />
                  <div style={{ fontWeight: 800, fontSize: '1.05rem', marginBottom: '4px' }}>
                    Razorpay Standard Gateway
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.4 }}>
                    Opens Razorpay's official checkout dialog with dynamic UPI QR code, Cards, NetBanking, and Wallets.
                  </p>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Amount: <strong>{formatPaise(amountPaise)}</strong>
                  </div>
                </div>

                {isKeyPlaceholder && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.08)',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '12px',
                      marginBottom: '14px',
                      textAlign: 'left',
                      fontSize: '0.8rem'
                    }}
                  >
                    <div style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icons.AlertTriangle size={15} />
                      <span>Razorpay Key Not Detected in .env</span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '8px' }}>
                      Server is running in test mode with placeholder keys. You can scan the UPI QR code above, or enter your test key below.
                    </div>

                    {showKeyInput ? (
                      <div style={{ marginTop: '8px' }}>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="rzp_test_..."
                          value={customKeyId}
                          onChange={(e) => setCustomKeyId(e.target.value)}
                          style={{ fontSize: '0.82rem', padding: '7px 10px', marginBottom: '8px' }}
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowKeyInput(true)}
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.75rem', padding: '4px 8px', color: 'var(--primary)' }}
                      >
                        + Enter Razorpay Key ID manually
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleOpenRazorpaySDK}
                  disabled={paymentState === 'PAYMENT_PROCESSING'}
                  className="btn btn-primary btn-lg btn-block"
                  style={{ marginBottom: '8px' }}
                >
                  {paymentState === 'PAYMENT_PROCESSING' ? 'Verifying payment...' : 'Launch Razorpay Gateway →'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* DEVELOPER TESTING SUITE BAR (For Test Cases 1, 2, 3) */}
        {/* ---------------------------------------------------- */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
              🧪 PAYMENT TEST BENCH
            </span>
            <button
              type="button"
              onClick={() => setShowDevTools(!showDevTools)}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.7rem', padding: '2px 6px', color: 'var(--text-secondary)' }}
            >
              {showDevTools ? 'Hide Tests' : 'Show Test Cases'}
            </button>
          </div>

          {showDevTools && (
            <div
              style={{
                background: 'var(--bg-surface-muted)',
                padding: '10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.74rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
                Simulate Payment & Verification Tests:
              </div>

              {/* Test Case 1: Unpaid verify click */}
              <button
                type="button"
                disabled={paymentState === 'PAYMENT_PROCESSING' || isSimulating}
                onClick={() => handleVerifyPayment()}
                className="btn btn-secondary btn-sm"
                style={{ textAlign: 'left', justifyContent: 'flex-start', fontSize: '0.72rem' }}
              >
                1. Test Case 1: Verify Without Paying (Expects PENDING)
              </button>

              {/* Test Case 2: Underpayment (₹4.00) */}
              <button
                type="button"
                disabled={paymentState === 'PAYMENT_PROCESSING' || isSimulating}
                onClick={async () => {
                  await handleSimulatePayment(400);
                  await handleVerifyPayment();
                }}
                className="btn btn-secondary btn-sm"
                style={{ textAlign: 'left', justifyContent: 'flex-start', fontSize: '0.72rem' }}
              >
                2. Test Case 2: Pay Incorrect Amount (₹4.00) (Expects FAILED)
              </button>

              {/* Test Case 3: Exact Payment (₹5.00) */}
              <button
                type="button"
                disabled={paymentState === 'PAYMENT_PROCESSING' || isSimulating}
                onClick={async () => {
                  await handleSimulatePayment(amountPaise);
                  await handleVerifyPayment();
                }}
                className="btn btn-secondary btn-sm"
                style={{ textAlign: 'left', justifyContent: 'flex-start', fontSize: '0.72rem' }}
              >
                3. Test Case 3: Pay Exact Amount (₹{amountRupees}) (Expects SUCCESS)
              </button>
            </div>
          )}
        </div>

        {/* Security Assurance */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '14px' }}>
          <Icons.ShieldCheck size={14} color="var(--primary)" />
          <span>256-Bit SSL Encrypted • Zero-Trust Server Verification</span>
        </div>
      </div>
    </div>
  );
};

export default RazorpayModal;
