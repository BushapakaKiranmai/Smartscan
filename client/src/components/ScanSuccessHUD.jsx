import React from 'react';
import Icons from './Icons';

/**
 * ScanSuccessHUD Component
 * Renders a compact, supermarket-grade floating success notification
 * immediately after an item is scanned and added to the cart,
 * without interrupting the camera or prompting checkout.
 */
export const ScanSuccessHUD = ({ scanResult, onUndo }) => {
  if (!scanResult) return null;

  const { product, currentCartQuantity = 1 } = scanResult;

  return (
    <div
      style={{
        position: 'absolute',
        top: '14px',
        left: '14px',
        right: '14px',
        zIndex: 50,
        pointerEvents: 'auto',
        animation: 'slideDownHUD 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <div
        style={{
          background: 'rgba(15, 23, 42, 0.94)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1.5px solid #10b981',
          borderRadius: '18px',
          padding: '10px 14px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.45), 0 0 20px rgba(16, 185, 129, 0.3)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}
      >
        {/* Left: Checkmark & Details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: '#10b981',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 12px rgba(16, 185, 129, 0.6)'
            }}
          >
            <Icons.CheckCircle2 size={20} />
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontSize: '0.86rem',
                fontWeight: 800,
                color: '#f8fafc',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              ✓ {product.name} added to cart
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1px' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 900, color: '#34d399' }}>
                ₹{product.price}
              </span>

              {currentCartQuantity > 1 && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    background: 'rgba(52, 211, 153, 0.2)',
                    color: '#a7f3d0',
                    padding: '1px 6px',
                    borderRadius: '6px'
                  }}
                >
                  Qty: {currentCartQuantity}
                </span>
              )}

              {scanResult.branchName && (
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    color: '#94a3b8'
                  }}
                >
                  📍 {scanResult.branchName}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Quick Undo */}
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#cbd5e1',
              padding: '5px 10px',
              borderRadius: '8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            Undo
          </button>
        )}
      </div>
    </div>
  );
};

export default ScanSuccessHUD;
