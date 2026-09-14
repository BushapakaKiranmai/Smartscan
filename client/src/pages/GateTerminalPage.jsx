import React, { useState } from 'react';
import api from '../api/client';
import { verifyExitPass } from '../services/exitService';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import Icons from '../components/Icons';

export const GateTerminalPage = () => {
  const { user } = useAuth();
  const { selectedBranch } = useStore();
  const toast = useToast();

  // Terminal & Input State
  const [inputCode, setInputCode] = useState('');
  const [terminalId, setTerminalId] = useState('GATE-TERMINAL-01');
  const [loading, setLoading] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState('MANUAL_STAFF');

  // Multi-step Flow State: 'SCAN' | 'LAYER1_VERIFIED' | 'APPROVED' | 'MISMATCH' | 'REJECTED'
  const [stage, setStage] = useState('SCAN');
  const [activePassData, setActivePassData] = useState(null);
  const [itemInspectionCounts, setItemInspectionCounts] = useState({});
  const [mismatchError, setMismatchError] = useState(null);
  const [approvedDetails, setApprovedDetails] = useState(null);
  const [history, setHistory] = useState([]);

  /**
   * Fast Lane: Authoritative One-Touch Exit Verification & Consumption
   */
  const handleExpressGateClear = async () => {
    const cleanCode = inputCode.trim();
    if (!cleanCode) return;
    const branchId = selectedBranch?._id || user?.assignedBranchIds?.[0] || 'dmart-kukatpally';

    try {
      setLoading(true);
      setMismatchError(null);
      const res = await verifyExitPass(cleanCode, { gateTerminalId: terminalId, branchId });

      if (res.success && res.verified) {
        setApprovedDetails(res.data);
        setStage('APPROVED');
        toast.success('🟢 EXIT AUTHORIZED: Pass consumed successfully.');
        setHistory((prev) => [
          {
            code: cleanCode,
            time: new Date().toLocaleTimeString(),
            success: true,
            orderNumber: res.data?.orderNumber || res.data?.order?._id,
            customer: res.data?.customer?.name || 'Customer'
          },
          ...prev
        ]);
        setInputCode('');
      } else {
        throw new Error(res.message || 'Exit verification failed');
      }
    } catch (err) {
      const errMsg = err.message || err.data?.message || 'Verification rejected';
      const code = err.data?.code || err.code || err.rejectionReason || 'REJECTED';

      if (code === 'PASS_ALREADY_USED' || errMsg.includes('already been used') || errMsg.includes('ALREADY USED')) {
        setStage('REJECTED');
        setMismatchError({
          title: '✕ EXIT PASS ALREADY USED',
          description: 'This pass has already been consumed. Departure is blocked.',
          reason: 'ALREADY_USED'
        });
        toast.error('✕ EXIT PASS ALREADY USED');
      } else if (code === 'PASS_EXPIRED' || errMsg.includes('expired')) {
        setStage('REJECTED');
        setMismatchError({
          title: '✕ EXIT PASS EXPIRED',
          description: 'This exit pass has expired. Customer must visit customer service.',
          reason: 'PASS_EXPIRED'
        });
        toast.error('✕ EXIT PASS EXPIRED');
      } else {
        setStage('REJECTED');
        setMismatchError({
          title: '✕ EXIT PASS REJECTED',
          description: errMsg,
          reason: code
        });
        toast.error(`EXIT REJECTED: ${errMsg}`);
      }

      setHistory((prev) => [
        {
          code: cleanCode,
          time: new Date().toLocaleTimeString(),
          success: false,
          reason: code,
          message: errMsg
        },
        ...prev
      ]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * LAYER 1: Verify Digital Exit Pass / QR Code
   */
  const handleVerifyPass = async (e) => {
    if (e) e.preventDefault();
    const cleanCode = inputCode.trim();
    if (!cleanCode) return;

    const branchId = selectedBranch?._id || user?.assignedBranchIds?.[0] || 'dmart-kukatpally';

    try {
      setLoading(true);
      setMismatchError(null);

      const res = await api.post('/exit/verify-pass', {
        passId: cleanCode,
        exitCode: cleanCode,
        gateTerminalId: terminalId,
        branchId
      });

      if (res.data?.success && res.data?.layer1Verified) {
        const pass = res.data.data;
        setActivePassData(pass);

        // Pre-fill inspection counts to expected quantities
        const initialCounts = {};
        (pass.items || []).forEach((it) => {
          initialCounts[it.barcode || it.productId || it.name] = it.quantity;
        });
        setItemInspectionCounts(initialCounts);

        setStage('LAYER1_VERIFIED');
        toast.success('✓ Layer 1: Digital Exit Pass & Payment Verified');
      } else {
        throw new Error(res.data?.message || 'Exit pass verification failed');
      }
    } catch (err) {
      const errMsg = err.message || 'Verification rejected';
      const rejectionReason = err.errors?.rejectionReason || err.rejectionReason || 'REJECTED';

      if (rejectionReason === 'ALREADY_USED' || errMsg.includes('ALREADY USED')) {
        setStage('REJECTED');
        setMismatchError({
          title: '✕ EXIT PASS ALREADY USED',
          description: 'This pass has already been used to exit. Departure is blocked.',
          reason: 'ALREADY_USED'
        });
        toast.error('✕ EXIT PASS ALREADY USED');
      } else {
        setStage('REJECTED');
        setMismatchError({
          title: '✕ EXIT PASS REJECTED',
          description: errMsg,
          reason: rejectionReason
        });
        toast.error(`EXIT REJECTED: ${errMsg}`);
      }

      setHistory((prev) => [
        {
          code: cleanCode,
          time: new Date().toLocaleTimeString(),
          success: false,
          reason: rejectionReason,
          message: errMsg
        },
        ...prev
      ]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * LAYER 2: Physical Basket Verification
   * @param {boolean} isApproved - Staff clicked Approve or Mismatch
   */
  const handleVerifyBasket = async (isApproved) => {
    if (!activePassData) return;

    const branchId = selectedBranch?._id || user?.assignedBranchIds?.[0] || 'dmart-kukatpally';

    if (!isApproved) {
      // Staff reported manual mismatch
      try {
        setLoading(true);
        const res = await api.post('/exit/verify-basket', {
          passId: activePassData.uniquePassId,
          gateTerminalId: terminalId,
          branchId,
          verificationMethod,
          isConfirmed: false,
          hasMismatch: true,
          mismatchReason: 'Item mismatch detected. Staff verification required.'
        });
      } catch (err) {
        // Backend returns 400 with neutral message as designed
        setStage('MISMATCH');
        setMismatchError({
          title: '⚠ ITEM MISMATCH',
          description: err.message || 'Item mismatch detected. Staff verification required.',
          expected: activePassData.totalItemsCount,
          verified: 'Discrepancy reported'
        });
        toast.warning('⚠ Item mismatch detected. Staff verification required.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Build verified items payload from staff checklist
    const verifiedItems = (activePassData.items || []).map((it) => {
      const key = it.barcode || it.productId || it.name;
      return {
        barcode: it.barcode,
        name: it.name,
        quantity: itemInspectionCounts[key] !== undefined ? itemInspectionCounts[key] : it.quantity
      };
    });

    try {
      setLoading(true);
      const res = await api.post('/exit/verify-basket', {
        passId: activePassData.uniquePassId,
        gateTerminalId: terminalId,
        branchId,
        verificationMethod,
        isConfirmed: true,
        verifiedItems
      });

      if (res.data?.success && res.data?.exitApproved) {
        setApprovedDetails(res.data.data);
        setStage('APPROVED');
        toast.success('🟢 EXIT APPROVED: Customer cleared to leave.');

        setHistory((prev) => [
          {
            code: activePassData.uniquePassId,
            time: new Date().toLocaleTimeString(),
            success: true,
            orderNumber: activePassData.orderNumber,
            customer: activePassData.customer?.name
          },
          ...prev
        ]);
        setInputCode('');
      } else {
        throw new Error(res.data?.message || 'Basket verification failed');
      }
    } catch (err) {
      const errMsg = err.message || 'Item mismatch detected. Staff verification required.';
      setStage('MISMATCH');
      setMismatchError({
        title: '⚠ ITEM MISMATCH',
        description: errMsg,
        mismatches: err.data?.mismatches || []
      });
      toast.warning('⚠ Item mismatch detected. Staff verification required.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset terminal for next customer
   */
  const handleReset = () => {
    setStage('SCAN');
    setActivePassData(null);
    setItemInspectionCounts({});
    setMismatchError(null);
    setApprovedDetails(null);
    setInputCode('');
  };

  /**
   * Adjust physical item count counter
   */
  const updateItemCount = (key, delta) => {
    setItemInspectionCounts((prev) => {
      const curr = prev[key] || 0;
      const next = Math.max(0, curr + delta);
      return { ...prev, [key]: next };
    });
  };

  return (
    <div className="container page-container" style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '80px' }}>
      {/* Header Banner */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Icons.ShieldCheck size={14} />
            Two-Layer Anti-Theft Verification
          </span>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Staff Guard: <strong style={{ color: 'var(--text-primary)' }}>{user?.name || 'Gate Officer'}</strong>
          </span>
        </div>
        <h1 className="title-section" style={{ fontSize: '2rem', fontWeight: 900 }}>
          SMARTSCAN EXIT GATE
        </h1>
        <p className="subtitle">
          Mandatory Dual Verification: <strong>Layer 1 (Digital QR)</strong> + <strong>Layer 2 (Physical Basket)</strong>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '28px' }}>
        {/* LEFT COLUMN: Input / Gate Controls */}
        <div className="glass-card-elevated" style={{ padding: '26px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Scan Exit Pass</h2>
            <span className="badge badge-primary" style={{ fontFamily: 'monospace' }}>
              {terminalId}
            </span>
          </div>

          <form onSubmit={handleVerifyPass} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Scan Customer QR or Enter Pass ID</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="e.g. PASS-SS10482-1234 or SS-..."
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value.toUpperCase())}
                  className="form-input"
                  style={{
                    fontSize: '1.15rem',
                    fontFamily: 'monospace',
                    letterSpacing: '0.08em',
                    fontWeight: 800,
                    paddingRight: '40px'
                  }}
                  autoFocus
                  disabled={stage === 'LAYER1_VERIFIED' || stage === 'APPROVED'}
                />
                {inputCode && (
                  <button
                    type="button"
                    onClick={() => setInputCode('')}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '1.1rem'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {stage === 'SCAN' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="submit"
                  disabled={loading || !inputCode.trim()}
                  className="btn btn-primary btn-lg btn-block"
                  style={{ padding: '14px' }}
                >
                  <Icons.Scan size={20} />
                  <span>{loading ? 'Verifying Digital Pass...' : '1. Verify Pass (2-Step Basket Check)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleExpressGateClear}
                  disabled={loading || !inputCode.trim()}
                  className="btn btn-secondary btn-block"
                  style={{
                    padding: '12px',
                    borderColor: 'var(--primary)',
                    color: 'var(--primary)',
                    fontWeight: 800,
                    background: 'var(--primary-light)'
                  }}
                >
                  <Icons.Zap size={18} />
                  <span>⚡ Fast Lane One-Touch Exit Clear</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleReset}
                className="btn btn-secondary btn-block"
              >
                <Icons.ArrowRight size={18} />
                <span>Scan New Customer</span>
              </button>
            )}
          </form>

          {/* Verification Method Switcher */}
          <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '10px' }}>
              PHYSICAL BASKET VERIFICATION METHOD:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: verificationMethod === 'MANUAL_STAFF' ? 'var(--primary-light)' : 'var(--bg-surface-muted)',
                  border: `1.5px solid ${verificationMethod === 'MANUAL_STAFF' ? 'var(--primary)' : 'var(--border-subtle)'}`,
                  cursor: 'pointer',
                  fontSize: '0.88rem'
                }}
              >
                <input
                  type="radio"
                  name="vMethod"
                  checked={verificationMethod === 'MANUAL_STAFF'}
                  onChange={() => setVerificationMethod('MANUAL_STAFF')}
                />
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>● Manual Staff Verification</strong>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Staff verifies basket items against digital order (MVP)</div>
                </div>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: 'var(--bg-surface-muted)',
                  border: '1.5px dashed var(--border-subtle)',
                  opacity: 0.65,
                  cursor: 'not-allowed',
                  fontSize: '0.88rem'
                }}
              >
                <input type="radio" name="vMethod" disabled checked={verificationMethod === 'RFID'} />
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>○ RFID Gate Portal (Future)</strong>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    Automated RFID sensor array (Clean architecture abstraction ready)
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Stage Cards */}
        <div>
          {/* STAGE 1: Idle / Ready */}
          {stage === 'SCAN' && (
            <div
              className="glass-card"
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '380px'
              }}
            >
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  background: 'var(--bg-surface-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}
              >
                <Icons.Scan size={36} color="var(--primary)" />
              </div>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '8px', fontSize: '1.25rem', fontWeight: 800 }}>
                Awaiting Exit Pass
              </h3>
              <p className="subtitle" style={{ maxWidth: '320px', margin: '0 auto 20px auto', fontSize: '0.88rem' }}>
                Customer scans their digital QR pass at the exit gate. System validates payment before physical inspection.
              </p>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg-surface-muted)', padding: '6px 14px', borderRadius: '20px' }}>
                Gate Status: 🟢 Online & Monitoring
              </div>
            </div>
          )}

          {/* STAGE 2: Layer 1 Verified -> Inspect Physical Basket */}
          {stage === 'LAYER1_VERIFIED' && activePassData && (
            <div
              className="glass-card-elevated"
              style={{
                padding: '26px',
                border: '2px solid var(--primary)',
                boxShadow: 'var(--shadow-glow)'
              }}
            >
              {/* Layer 1 Success Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
                <div>
                  <div style={{ color: 'var(--primary)', fontWeight: 900, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icons.CheckCircle2 size={20} />
                    <span>✓ PAYMENT VERIFIED</span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
                    ✓ Digital Exit Pass Valid • Single-Use Token Confirmed
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Order Number</div>
                  <strong style={{ fontFamily: 'monospace', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                    {activePassData.orderNumber}
                  </strong>
                </div>
              </div>

              {/* Order Meta Pills */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
                <div style={{ background: 'var(--bg-surface-muted)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Paid Amount</div>
                  <strong style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>₹{activePassData.amount}</strong>
                </div>
                <div style={{ background: 'var(--bg-surface-muted)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Paid Items</div>
                  <strong style={{ fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                    {activePassData.totalItemsCount}
                  </strong>
                </div>
                <div style={{ background: 'var(--bg-surface-muted)', padding: '10px', borderRadius: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Customer</div>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                    {activePassData.customer?.name || 'Shopper'}
                  </strong>
                </div>
              </div>

              {/* Random Check Banner if selected */}
              {activePassData.randomCheckSelected && (
                <div
                  style={{
                    background: 'rgba(245, 158, 11, 0.12)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    color: '#d97706',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Icons.ShieldAlert size={18} />
                  <span>Quick basket verification required. Random audit selected for this customer.</span>
                </div>
              )}

              {/* Layer 2: Paid Items Checklist */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                    LAYER 2: PAID ITEMS CHECKLIST
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Verify basket contents
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                  {activePassData.items?.map((it, idx) => {
                    const key = it.barcode || it.productId || it.name;
                    const verifiedQty = itemInspectionCounts[key] !== undefined ? itemInspectionCounts[key] : it.quantity;
                    const isMatched = verifiedQty === it.quantity;

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '12px',
                          background: isMatched ? 'var(--bg-surface-muted)' : 'rgba(239, 68, 68, 0.08)',
                          border: `1px solid ${isMatched ? 'var(--border-subtle)' : 'var(--danger)'}`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            • {it.name}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            Expected: <strong style={{ color: 'var(--text-primary)' }}>× {it.quantity}</strong>
                          </div>
                        </div>

                        {/* Interactive inspection counter */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => updateItemCount(key, -1)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}
                          >
                            -
                          </button>
                          <strong style={{ minWidth: '24px', textAlign: 'center', color: isMatched ? 'var(--text-primary)' : 'var(--danger)' }}>
                            × {verifiedQty}
                          </strong>
                          <button
                            type="button"
                            onClick={() => updateItemCount(key, 1)}
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 8px', borderRadius: '6px', border: '1px solid var(--border-card)' }}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Two Primary Layer 2 Actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => handleVerifyBasket(true)}
                  disabled={loading}
                  className="btn btn-primary btn-lg"
                  style={{
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                    padding: '14px'
                  }}
                >
                  <Icons.CheckCircle2 size={18} />
                  <span>{loading ? 'Verifying...' : '✓ Basket Verified'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleVerifyBasket(false)}
                  disabled={loading}
                  className="btn btn-danger btn-lg"
                  style={{
                    background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                    padding: '14px'
                  }}
                >
                  <Icons.AlertTriangle size={18} />
                  <span>⚠ Item Mismatch</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: Approved Exit Card */}
          {stage === 'APPROVED' && (
            <div
              className="glass-card-elevated"
              style={{
                padding: '36px 24px',
                textAlign: 'center',
                border: '2px solid var(--primary)',
                boxShadow: 'var(--shadow-glow)',
                background: 'var(--bg-surface)'
              }}
            >
              <div
                style={{
                  width: '84px',
                  height: '84px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px',
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.4)'
                }}
              >
                <Icons.CheckCircle2 size={48} />
              </div>

              <h2 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--primary)', marginBottom: '4px' }}>
                🟢 EXIT APPROVED
              </h2>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Thank you!
              </div>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '340px', margin: '0 auto 24px auto' }}>
                Layer 1 (Digital Pass) and Layer 2 (Physical Basket) verified successfully. Customer is cleared to exit.
              </p>

              <div
                style={{
                  background: 'var(--bg-surface-muted)',
                  padding: '14px',
                  borderRadius: '14px',
                  textAlign: 'left',
                  fontSize: '0.82rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  marginBottom: '24px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Order ID:</span>
                  <strong style={{ fontFamily: 'monospace' }}>{approvedDetails?.order?.orderNumber || 'SS-CONFIRMED'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Exit Token:</span>
                  <strong style={{ fontFamily: 'monospace', color: 'var(--primary)' }}>{approvedDetails?.passId || 'USED'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Gate Terminal:</span>
                  <span>{approvedDetails?.gateId || terminalId}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Pass Status:</span>
                  <span className="badge badge-success" style={{ padding: '2px 8px' }}>BURNED / USED</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="btn btn-primary btn-lg btn-block"
              >
                <Icons.Scan size={18} />
                <span>Next Customer</span>
              </button>
            </div>
          )}

          {/* STAGE 4: Item Mismatch Alert (Neutral Wording) */}
          {stage === 'MISMATCH' && (
            <div
              className="glass-card-elevated"
              style={{
                padding: '32px 24px',
                textAlign: 'center',
                border: '2px solid var(--danger)',
                boxShadow: '0 0 24px rgba(239, 68, 68, 0.25)'
              }}
            >
              <div
                style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '50%',
                  background: 'var(--danger-light)',
                  color: 'var(--danger)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}
              >
                <Icons.AlertTriangle size={42} />
              </div>

              <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--danger)', marginBottom: '8px' }}>
                {mismatchError?.title || '⚠ ITEM MISMATCH'}
              </h2>
              <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 600, maxWidth: '380px', margin: '0 auto 18px auto' }}>
                {mismatchError?.description || 'Item mismatch detected. Staff verification required.'}
              </div>

              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.08)',
                  padding: '14px',
                  borderRadius: '14px',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  textAlign: 'left',
                  marginBottom: '24px',
                  border: '1px solid rgba(239, 68, 68, 0.2)'
                }}
              >
                <div>• Automatic exit has been temporarily blocked.</div>
                <div>• Staff member must inspect basket items against digital order.</div>
                <div>• Unscanned items can be scanned and added, or returned to shelf.</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setStage('LAYER1_VERIFIED')}
                  className="btn btn-secondary"
                >
                  <Icons.ArrowRight size={16} />
                  <span>Re-check Basket</span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn btn-ghost"
                >
                  <span>Reset Gate</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGE 5: Rejected / Already Used State */}
          {stage === 'REJECTED' && (
            <div
              className="glass-card-elevated"
              style={{
                padding: '32px 24px',
                textAlign: 'center',
                border: '2px solid var(--danger)'
              }}
            >
              <div
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  background: 'var(--danger-light)',
                  color: 'var(--danger)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}
              >
                <Icons.AlertCircle size={38} />
              </div>

              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--danger)', marginBottom: '8px' }}>
                {mismatchError?.title || '✕ EXIT PASS REJECTED'}
              </h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', maxWidth: '340px', margin: '0 auto 24px auto' }}>
                {mismatchError?.description || 'Exit Pass could not be verified.'}
              </p>

              <button
                type="button"
                onClick={handleReset}
                className="btn btn-primary btn-block"
              >
                <span>Scan Another Pass</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Audit History Log */}
      {history.length > 0 && (
        <div style={{ marginTop: '40px' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '14px' }}>
            Recent Exit Verifications ({history.length})
          </h3>
          <div className="glass-card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-muted)', borderBottom: '1px solid var(--border-card)' }}>
                  <th style={{ padding: '12px 16px' }}>Time</th>
                  <th style={{ padding: '12px 16px' }}>Pass Code</th>
                  <th style={{ padding: '12px 16px' }}>Order</th>
                  <th style={{ padding: '12px 16px' }}>Customer</th>
                  <th style={{ padding: '12px 16px' }}>Decision</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{h.time}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700 }}>{h.code}</td>
                    <td style={{ padding: '12px 16px' }}>{h.orderNumber || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>{h.customer || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge ${h.success ? 'badge-success' : 'badge-danger'}`}>
                        {h.success ? '🟢 APPROVED' : '✕ REJECTED'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default GateTerminalPage;
