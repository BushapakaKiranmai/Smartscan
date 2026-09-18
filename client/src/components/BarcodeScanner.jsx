import React, { useState, useEffect, useRef, useCallback } from 'react';
import BarcodeScannerEngine from '../services/barcodeScannerEngine';
import { playScanBeep, playErrorBeep, triggerHapticFeedback } from '../utils/scanFeedback';
import Icons from './Icons';

/**
 * Supermarket Barcode Scanner Component
 * Uses BarcodeScannerEngine with:
 * - High-speed multi-region continuous sampling (native sensor resolution, no downscaling blur)
 * - ZXing GlobalHistogramBinarizer (superior 1D retail barcode sensitivity) & HybridBinarizer
 * - Real-time retail camera scanning & manual barcode digits keypad
 */
export const BarcodeScanner = ({
  onScan,
  isScanning = true,
  mode,
  onModeChange,
  scanState = 'SCANNING', // 'IDLE' | 'CAMERA_STARTING' | 'SCANNING' | 'DETECTED' | 'LOOKING_UP' | 'ADDED' | 'ERROR'
  soundEnabled = true,
  onSoundToggle,
  onVideoStatsUpdate
}) => {
  const [internalMode, setInternalMode] = useState('camera');
  const scannerMode = mode !== undefined ? mode : internalMode;

  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomSupported, setZoomSupported] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  const videoRef = useRef(null);
  const engineRef = useRef(null);
  const generationRef = useRef(0);
  const unmountReasonRef = useRef(null);

  const isScanningPropRef = useRef(isScanning);
  const onScanRef = useRef(onScan);
  const soundEnabledRef = useRef(soundEnabled);
  const onVideoStatsUpdateRef = useRef(onVideoStatsUpdate);
  const handleDetectedCodeRef = useRef(null);

  const setScannerMode = (newMode) => {
    if (newMode !== 'camera') {
      unmountReasonRef.current = 'CLEANUP REASON: SCANNING_DISABLED';
    }
    if (onModeChange) onModeChange(newMode);
    setInternalMode(newMode);
  };

  // Keep callback refs updated so prop changes never restart camera
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    onVideoStatsUpdateRef.current = onVideoStatsUpdate;
  }, [onVideoStatsUpdate]);

  useEffect(() => {
    isScanningPropRef.current = isScanning;
    if (engineRef.current) {
      engineRef.current.setLock(!isScanning);
    }
  }, [isScanning]);



  // Stable detection callback
  const handleDetectedCode = useCallback((code, formatName, result) => {
    if (!isScanningPropRef.current) return;

    // Play authentic supermarket register beep + haptic pulse
    playScanBeep(soundEnabledRef.current);
    triggerHapticFeedback();

    if (onScanRef.current) {
      onScanRef.current(code, formatName, result);
    }
  }, []);

  useEffect(() => {
    handleDetectedCodeRef.current = handleDetectedCode;
  }, [handleDetectedCode]);

  // Scanner Lifecycle (Automatically connects directly to the phone rear camera)
  useEffect(() => {

    console.log('[SCANNER] EFFECT START');

    // If camera scanning is disabled
    if (scannerMode !== 'camera') {
      if (engineRef.current) {
        const oldEngine = engineRef.current;
        engineRef.current = null;
        console.log('[SCANNER] CLEANUP REASON: SCANNING_DISABLED');
        oldEngine.stop(false, 'CLEANUP REASON: SCANNING_DISABLED');
      }
      setCameraActive(false);
      return;
    }

    const currentGen = ++generationRef.current;
    let cancelled = false;
    let engine = null;
    setCameraError(null);

    const initEngine = async () => {
      if (!videoRef.current || cancelled) return;

      // SINGLE INSTANCE: stop previous engine before creating new one
      if (engineRef.current) {
        console.log('[SCANNER] Stopping existing scanner engine before creating new one...');
        const oldEngine = engineRef.current;
        engineRef.current = null;
        await oldEngine.stop(false, 'CLEANUP REASON: ENGINE_REPLACED');
      }

      if (cancelled || generationRef.current !== currentGen) {
        return;
      }

      console.log('[SCANNER] ENGINE CREATED');

      engine = new BarcodeScannerEngine({
        onBarcodeDetected: (code, formatName, result) => {
          if (!cancelled && generationRef.current === currentGen) {
            if (handleDetectedCodeRef.current) {
              handleDetectedCodeRef.current(code, formatName, result);
            }
          }
        },
        onVideoStats: (stats) => {
          if (!cancelled && generationRef.current === currentGen) {
            setTorchSupported(stats.hasTorch);
            setZoomSupported(Boolean(stats.hasZoom));
            if (onVideoStatsUpdateRef.current) {
              onVideoStatsUpdateRef.current(stats);
            }
          }
        },
        onError: (err) => {
          if (!cancelled && generationRef.current === currentGen) {
            console.warn('[SCANNER] Engine error:', err);
            setCameraActive(false);
            const errName = err?.name || '';
            const errMsg = String(err?.message || err || '');
            if (
              errName === 'NotAllowedError' ||
              errName === 'PermissionDeniedError' ||
              errMsg.toLowerCase().includes('permission') ||
              errMsg.toLowerCase().includes('notallowed')
            ) {
              setCameraError('Camera access required. Please allow camera permissions to scan supermarket products.');
            } else {
              setCameraError('Unable to access the rear camera. Please allow camera permission and try again.');
            }
          }
        },
        onStatusChange: (status) => {
          if (!cancelled && generationRef.current === currentGen) {
            if (status === 'READY') {
              setCameraActive(true);
              setCameraError(null);
              if (engine) {
                setTorchSupported(engine.hasTorchSupport());
                setZoomSupported(engine.hasZoomSupport());
              }
            } else if (status === 'STOPPED') {
              setCameraActive(false);
            }
          }
        }
      });

      engineRef.current = engine;

      console.log('[SCANNER] ENGINE START REQUESTED');

      try {
        await engine.start(videoRef.current);

        if (cancelled) {
          console.log('[SCANNER] Engine start completed after cancellation; stopping engine...');
          await engine.stop(false, 'CLEANUP REASON: CANCELLED');
          return;
        }

        if (engineRef.current !== engine) {
          console.log('[SCANNER] Engine superseded by newer instance; stopping engine...');
          await engine.stop(false, 'CLEANUP REASON: SUPERSEDED');
          return;
        }

        if (engine) {
          setTorchSupported(engine.hasTorchSupport());
        }
      } catch (err) {
        if (!cancelled && generationRef.current === currentGen) {
          console.error('[SCANNER] Camera start failed:', err);
        }
      }
    };

    initEngine();

    return () => {
      cancelled = true;
      console.log('[SCANNER] CLEANUP REQUESTED');

      let reason = unmountReasonRef.current || 'CLEANUP REASON: COMPONENT_UNMOUNT';
      unmountReasonRef.current = null;
      console.log(`[SCANNER] ${reason}`);

      if (engine) {
        if (engineRef.current === engine) {
          engineRef.current = null;
        }
        engine.stop(false, reason).catch((err) => {
          console.warn('[SCANNER] Error stopping engine in cleanup:', err);
        });
      } else if (engineRef.current) {
        const currentEngine = engineRef.current;
        engineRef.current = null;
        currentEngine.stop(false, reason).catch((err) => {
          console.warn('[SCANNER] Error stopping currentEngine in cleanup:', err);
        });
      }
    };
  }, [scannerMode, retryCount]);

  // Torch Toggle
  const handleToggleTorch = async () => {
    if (engineRef.current) {
      const state = await engineRef.current.toggleTorch();
      setTorchOn(state);
    }
  };

  // Zoom Toggle (Cycles 1x -> 1.5x -> 2x)
  const handleToggleZoom = async () => {
    if (!engineRef.current || !zoomSupported) return;
    const nextZoom = zoomLevel === 1 ? 1.5 : zoomLevel === 1.5 ? 2 : 1;
    await engineRef.current.setZoom(nextZoom);
    setZoomLevel(nextZoom);
  };

  // Manual code submission
  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    playScanBeep(soundEnabled);
    triggerHapticFeedback();
    onScan(manualCode.trim());
    setManualCode('');
  };

  const isDetected = scanState === 'DETECTED' || scanState === 'ADDED';
  const isLookingUp = scanState === 'LOOKING_UP';
  const isError = scanState === 'ERROR';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {/* Top Controls Bar: Live Camera, Keypad, Sound, Torch */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'var(--bg-surface-muted)',
          padding: '4px',
          borderRadius: 'var(--radius-full)',
          marginBottom: '14px',
          border: '1px solid var(--border-card)',
          boxShadow: 'var(--shadow-sm)',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '4px'
        }}
      >
        <button
          type="button"
          onClick={() => setScannerMode('camera')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: scannerMode === 'camera' ? 'var(--primary)' : 'transparent',
            color: scannerMode === 'camera' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          <Icons.Camera size={16} />
          <span>Live Camera</span>
        </button>

        <button
          type="button"
          onClick={() => setScannerMode('manual')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: scannerMode === 'manual' ? 'var(--primary)' : 'transparent',
            color: scannerMode === 'manual' ? '#ffffff' : 'var(--text-secondary)',
            fontWeight: 800,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          <Icons.Barcode size={16} />
          <span>Keypad</span>
        </button>

        {/* Sound Toggle */}
        <button
          type="button"
          onClick={onSoundToggle}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '8px 10px',
            borderRadius: 'var(--radius-full)',
            border: 'none',
            background: 'transparent',
            color: soundEnabled ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer'
          }}
          title={soundEnabled ? 'Beep Sound On' : 'Beep Sound Muted'}
        >
          {soundEnabled ? <Icons.Volume2 size={18} /> : <Icons.VolumeX size={18} />}
        </button>

        {/* Flashlight / Torch Toggle */}
        {torchSupported && scannerMode === 'camera' && (
          <button
            type="button"
            onClick={handleToggleTorch}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 10px',
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: torchOn ? '#f59e0b' : 'transparent',
              color: torchOn ? '#ffffff' : 'var(--text-muted)',
              cursor: 'pointer'
            }}
            title={torchOn ? 'Flashlight On' : 'Flashlight Off'}
          >
            <Icons.Zap size={18} />
          </button>
        )}

        {/* 1x / 2x Zoom Toggle for 50MP Samsung/Android cameras */}
        {zoomSupported && scannerMode === 'camera' && (
          <button
            type="button"
            onClick={handleToggleZoom}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              border: '1.5px solid var(--border-card)',
              background: zoomLevel > 1 ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
              color: zoomLevel > 1 ? '#ffffff' : 'var(--text-primary)',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
            title="Toggle Camera Zoom"
          >
            <span>{zoomLevel}x</span>
          </button>
        )}
      </div>

      {/* Mode 1: Live Camera Viewfinder */}
      {scannerMode === 'camera' && (
        <div style={{ width: '100%', maxWidth: '440px', marginBottom: '14px' }}>
          <div
            onClick={() => {
              if (engineRef.current) {
                engineRef.current.triggerAutofocus();
              }
            }}
            style={{
              position: 'relative',
              borderRadius: '24px',
              overflow: 'hidden',
              background: '#090d16',
              boxShadow: isDetected
                ? '0 0 35px rgba(16, 185, 129, 0.7), 0 10px 30px rgba(0, 0, 0, 0.4)'
                : '0 10px 30px rgba(0, 0, 0, 0.25)',
              border: isDetected
                ? '2.5px solid #10b981'
                : isError
                ? '2.5px solid var(--danger)'
                : '2px solid var(--border-card)',
              minHeight: '340px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'box-shadow 0.15s ease, border-color 0.15s ease'
            }}
          >
            {/* HTML5 Video Element for Continuous Native Hardware Capture */}
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                minHeight: '340px',
                objectFit: 'cover',
                zIndex: 1
              }}
            />

            {/* SUPERMARKET SCANNING FRAME & RETICLE */}
            <div
              style={{
                position: 'absolute',
                inset: '20px',
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                zIndex: 10
              }}
            >
              {/* Top Corner Brackets */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderTop: `4px solid ${isDetected ? '#10b981' : '#ffffff'}`,
                    borderLeft: `4px solid ${isDetected ? '#10b981' : '#ffffff'}`,
                    borderRadius: '8px 0 0 0',
                    boxShadow: isDetected ? '0 0 16px #10b981' : '0 0 10px rgba(255, 255, 255, 0.5)',
                    transition: 'all 0.12s ease'
                  }}
                />
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderTop: `4px solid ${isDetected ? '#10b981' : '#ffffff'}`,
                    borderRight: `4px solid ${isDetected ? '#10b981' : '#ffffff'}`,
                    borderRadius: '0 8px 0 0',
                    boxShadow: isDetected ? '0 0 16px #10b981' : '0 0 10px rgba(255, 255, 255, 0.5)',
                    transition: 'all 0.12s ease'
                  }}
                />
              </div>

              {/* Horizontal Supermarket Laser Sweep Line */}
              <div
                style={{
                  width: '100%',
                  height: isDetected ? '4px' : '2.5px',
                  background: isDetected
                    ? 'linear-gradient(90deg, transparent 0%, #10b981 25%, #ffffff 50%, #10b981 75%, transparent 100%)'
                    : 'linear-gradient(90deg, transparent 0%, #ef4444 25%, #ff9999 50%, #ef4444 75%, transparent 100%)',
                  boxShadow: isDetected
                    ? '0 0 24px #10b981, 0 0 40px #10b981'
                    : '0 0 16px rgba(239, 68, 68, 0.9)',
                  animation: isDetected ? 'none' : 'laserSweep 1.8s ease-in-out infinite',
                  transition: 'all 0.12s ease'
                }}
              />

              {/* Bottom Corner Brackets */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderBottom: `4px solid ${isDetected ? '#10b981' : '#ffffff'}`,
                    borderLeft: `4px solid ${isDetected ? '#10b981' : '#ffffff'}`,
                    borderRadius: '0 0 0 8px',
                    boxShadow: isDetected ? '0 0 16px #10b981' : '0 0 10px rgba(255, 255, 255, 0.5)',
                    transition: 'all 0.12s ease'
                  }}
                />
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderBottom: `4px solid ${isDetected ? '#10b981' : '#ffffff'}`,
                    borderRight: `4px solid ${isDetected ? '#10b981' : '#ffffff'}`,
                    borderRadius: '0 0 8px 0',
                    boxShadow: isDetected ? '0 0 16px #10b981' : '0 0 10px rgba(255, 255, 255, 0.5)',
                    transition: 'all 0.12s ease'
                  }}
                />
              </div>
            </div>

            {/* Visual Flash on Instant Barcode Detection */}
            {isDetected && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(16, 185, 129, 0.22)',
                  boxShadow: 'inset 0 0 50px rgba(16, 185, 129, 0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 20,
                  pointerEvents: 'none',
                  animation: 'fadeIn 0.15s ease-out'
                }}
              >
                <div
                  style={{
                    background: '#10b981',
                    color: '#ffffff',
                    padding: '8px 22px',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 900,
                    fontSize: '1.05rem',
                    letterSpacing: '0.04em',
                    boxShadow: '0 8px 30px rgba(16, 185, 129, 0.65)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Icons.CheckCircle2 size={22} />
                  <span>BEEP! SCANNED</span>
                </div>
              </div>
            )}

            {/* Inactive Camera / Permission Denied Overlay */}
            {!cameraActive && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px',
                  textAlign: 'center',
                  background: 'rgba(15, 23, 42, 0.96)',
                  color: '#ffffff',
                  zIndex: 15
                }}
              >
                {cameraError ? (
                  <>
                    <Icons.AlertTriangle size={42} color="var(--danger)" style={{ marginBottom: '12px' }} />
                    <div style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: '8px', color: 'var(--danger)' }}>
                      Camera Access Required
                    </div>
                    <p style={{ fontSize: '0.84rem', color: '#94a3b8', maxWidth: '300px', marginBottom: '18px', lineHeight: 1.5 }}>
                      {cameraError}
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setCameraError(null);
                          setRetryCount((r) => r + 1);
                        }}
                        className="btn btn-primary btn-sm"
                        style={{ borderRadius: 'var(--radius-md)' }}
                      >
                        Try Again
                      </button>
                      <button
                        type="button"
                        onClick={() => setScannerMode('manual')}
                        className="btn btn-secondary btn-sm"
                        style={{ borderRadius: 'var(--radius-md)' }}
                      >
                        Use Keypad
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: 'var(--primary)', animation: 'spin 1s linear infinite', marginBottom: '14px' }} />
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                      Starting supermarket camera...
                    </div>
                  </>
                )}
              </div>
            )}
          </div>



          {/* Position & Focus Guide */}
          <div style={{ textAlign: 'center', marginTop: '8px' }}>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
              Align barcode across the red laser line
            </p>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
              💡 Hold 20–30 cm (1 foot) away so barcode lines stay sharp and in focus
            </p>
          </div>
        </div>
      )}

      {/* Mode 2: Keypad / Manual Entry */}
      {scannerMode === 'manual' && (
        <div
          className="glass-card scan-result-reveal"
          style={{ width: '100%', maxWidth: '440px', padding: '24px', borderRadius: '24px', marginBottom: '14px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Icons.Barcode size={24} color="var(--primary)" />
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Enter Barcode Digits</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                Type the numbers printed under the packaging lines
              </p>
            </div>
          </div>

          <form onSubmit={handleManualSubmit}>
            <div className="form-group" style={{ marginBottom: '14px' }}>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. 8901063371040"
                className="form-input"
                autoFocus
                style={{
                  fontSize: '1.25rem',
                  letterSpacing: '0.08em',
                  fontFamily: 'monospace',
                  fontWeight: 800,
                  textAlign: 'center',
                  padding: '14px',
                  borderRadius: '16px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setScannerMode('camera')}
                className="btn btn-secondary btn-block"
                style={{ borderRadius: '14px', fontWeight: 700 }}
              >
                ← Back to Camera
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-block"
                disabled={!manualCode.trim()}
                style={{ borderRadius: '14px', fontWeight: 800 }}
              >
                Add Product
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default BarcodeScanner;
