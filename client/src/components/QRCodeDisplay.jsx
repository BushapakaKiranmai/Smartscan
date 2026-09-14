import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import Icons from './Icons';

/**
 * Renders a genuine, camera-scannable digital QR code with embedded token payload
 * and high-visibility 6-character fallback code.
 */
export const QRCodeDisplay = ({ token, shortCode, size = 210, status = 'ACTIVE', usedAt }) => {
  const [qrDataUrl, setQrDataUrl] = useState('');

  const isUsed = status === 'USED';
  const isExpired = status === 'EXPIRED';

  useEffect(() => {
    const generateQr = async () => {
      try {
        const textToEncode = token || shortCode || 'SMARTSCAN-EXIT-PASS';
        const url = await QRCode.toDataURL(textToEncode, {
          width: size * 2,
          margin: 1,
          color: {
            dark: isUsed ? '#94a3b8' : isExpired ? '#94a3b8' : '#0f172a',
            light: '#ffffff'
          }
        });
        setQrDataUrl(url);
      } catch (err) {
        console.error('[QRCode] Generation error:', err);
      }
    };

    generateQr();
  }, [token, shortCode, size, isUsed, isExpired]);

  // USED State Display
  if (isUsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', width: '100%' }}>
        {/* Consumed / Disabled QR Container */}
        <div
          style={{
            position: 'relative',
            background: 'var(--bg-surface-muted, #f8fafc)',
            padding: '20px',
            borderRadius: 'var(--radius-lg, 16px)',
            border: '2px dashed var(--border-color, #cbd5e1)',
            textAlign: 'center',
            maxWidth: `${size + 40}px`,
            margin: '0 auto',
            overflow: 'hidden'
          }}
        >
          {/* Watermark / Void Stamp */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-18deg)',
              background: 'rgba(239, 68, 68, 0.92)',
              color: '#ffffff',
              padding: '8px 24px',
              borderRadius: '8px',
              fontWeight: 900,
              fontSize: '1.05rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
              zIndex: 10,
              pointerEvents: 'none',
              border: '2px solid #ffffff'
            }}
          >
            USED • CONSUMED
          </div>

          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Exit Verification Pass Consumed"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                display: 'block',
                borderRadius: '4px',
                filter: 'grayscale(100%) opacity(28%) blur(1px)'
              }}
            />
          ) : (
            <div
              style={{
                width: `${size}px`,
                height: `${size}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)'
              }}
            >
              Pass Consumed
            </div>
          )}
        </div>

        {/* Struck-through Shortcode in Used State */}
        {shortCode && (
          <div style={{ textAlign: 'center', opacity: 0.65 }}>
            <div
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                fontWeight: 700,
                marginBottom: '6px'
              }}
            >
              Passcode (Consumed)
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '1.75rem',
                fontWeight: 900,
                letterSpacing: '0.2em',
                background: 'var(--bg-surface-muted, #f1f5f9)',
                border: '1px solid var(--border-color, #cbd5e1)',
                color: 'var(--text-muted, #94a3b8)',
                padding: '6px 20px',
                borderRadius: 'var(--radius-md, 8px)',
                display: 'inline-block',
                textDecoration: 'line-through'
              }}
            >
              {shortCode}
            </div>
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              This exit code is now inactive and cannot be reused
            </div>
          </div>
        )}
      </div>
    );
  }

  // EXPIRED State Display
  if (isExpired) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', width: '100%' }}>
        <div
          style={{
            position: 'relative',
            background: 'var(--bg-surface-muted, #f8fafc)',
            padding: '20px',
            borderRadius: 'var(--radius-lg, 16px)',
            border: '2px dashed #f59e0b',
            textAlign: 'center',
            maxWidth: `${size + 40}px`,
            margin: '0 auto',
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%) rotate(-15deg)',
              background: '#f59e0b',
              color: '#ffffff',
              padding: '6px 20px',
              borderRadius: '6px',
              fontWeight: 900,
              fontSize: '1rem',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              zIndex: 10,
              border: '2px solid #ffffff'
            }}
          >
            EXPIRED
          </div>
          {qrDataUrl && (
            <img
              src={qrDataUrl}
              alt="Expired Pass"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                display: 'block',
                filter: 'grayscale(100%) opacity(30%)'
              }}
            />
          )}
        </div>
        <div style={{ fontSize: '0.8rem', color: '#d97706', fontWeight: 600 }}>
          This pass has exceeded its validity window. Please visit customer service.
        </div>
      </div>
    );
  }

  // ACTIVE State Display: Clean, original high-resolution design
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
      {/* Real Camera-Scannable QR Image */}
      <div
        style={{
          background: '#ffffff',
          padding: '16px',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          display: 'inline-block',
          border: '3px solid var(--primary)',
          textAlign: 'center'
        }}
      >
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="Exit Verification QR Code"
            style={{ width: `${size}px`, height: `${size}px`, display: 'block', borderRadius: '4px' }}
          />
        ) : (
          <div
            style={{
              width: `${size}px`,
              height: `${size}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)'
            }}
          >
            Generating QR Code...
          </div>
        )}
      </div>

      {/* High-Visibility Fallback Short Code */}
      {shortCode && (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 700,
              marginBottom: '6px'
            }}
          >
            Store Gate Exit Passcode
          </div>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: '2rem',
              fontWeight: 900,
              letterSpacing: '0.25em',
              background: 'var(--primary-light)',
              border: '2px dashed var(--primary)',
              color: 'var(--primary)',
              padding: '6px 24px',
              borderRadius: 'var(--radius-md)',
              display: 'inline-block'
            }}
          >
            {shortCode}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Show this code to gate security or scan at exit kiosk
          </div>
        </div>
      )}
    </div>
  );
};

export default QRCodeDisplay;

