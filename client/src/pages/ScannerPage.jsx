import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import BarcodeScanner from '../components/BarcodeScanner';
import ScanSuccessHUD from '../components/ScanSuccessHUD';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { normalizeBarcode } from '../utils/barcodeNormalizer';
import { playErrorBeep } from '../utils/scanFeedback';
import Icons from '../components/Icons';

/**
 * Supermarket Continuous Shopping & Barcode Scanner Page
 *
 * Scanning Lifecycle:
 * SCANNING → DETECTED → LOOKING_UP → PRODUCT_FOUND → ADDING_TO_CART → PRODUCT_ADDED → READY → SCANNING
 *
 * Requirements:
 * - Continuous live camera scanning (camera stays open after every scan)
 * - Automatic cart addition with duplicate protection
 * - Small floating success notification (✓ Item added to cart • ₹Price)
 * - Branch availability & stock validation (no cart addition if unavailable)
 * - Compact basket summary (🛒 X Items • ₹Y)
 * - Exit scanner ONLY via intentional "Finish & View Cart" button
 * - NO payment or checkout buttons on scanner page
 */
export const ScannerPage = () => {
  const { isAuthenticated, isAdmin } = useAuth();
  const { selectedBranch } = useStore();

  const {
    items,
    addItem,
    updateQuantity,
    formatPaise,
    itemCount,
    pricingSummary,
    totalAmount
  } = useCart();

  const toast = useToast();
  const navigate = useNavigate();

  // ============================================================
  // SCANNER STATE
  // ============================================================
  const [scanState, setScanState] = useState('SCANNING');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [scanSuccessInfo, setScanSuccessInfo] = useState(null);
  const [scanErrorMsg, setScanErrorMsg] = useState(null);
  const [lastFailedBarcode, setLastFailedBarcode] = useState(null);
  const [unavailableProduct, setUnavailableProduct] = useState(null);

  // Video statistics from camera sensor
  const [videoStats, setVideoStats] = useState({
    width: 0,
    height: 0,
    facingMode: 'environment',
    label: '',
    frameRate: null
  });

  // ============================================================
  // SCAN LOCK & DUPLICATE PREVENTION
  // ============================================================
  const isProcessingRef = useRef(false);
  const lastScannedBarcodeRef = useRef(null);
  const lastScanTimeRef = useRef(0);

  const successTimerRef = useRef(null);
  const errorTimerRef = useRef(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  // ============================================================
  // HANDLE BARCODE SCAN
  // ============================================================
  const handleBarcodeScan = useCallback(
    async (rawCode, formatName = 'EAN_13', result = null) => {
      console.log('[SCANNER] BARCODE DETECTED:', rawCode, formatName);

      const cleanBarcode = normalizeBarcode(rawCode);
      if (!cleanBarcode || cleanBarcode.length < 3) {
        console.warn('[SCANNER] Invalid barcode received:', rawCode);
        return;
      }

      // Concurrency lock: avoid processing multiple scans simultaneously
      if (isProcessingRef.current) {
        console.log('[SCANNER] Busy processing prior scan, ignoring frame');
        return;
      }

      // Duplicate scan prevention:
      // Same barcode held in view is debounced for 1.2s to prevent duplicate cart additions.
      // Different barcode has 0 ms cooldown (can be scanned immediately!)
      const now = Date.now();
      const SAME_BARCODE_COOLDOWN_MS = 1200;
      if (
        lastScannedBarcodeRef.current === cleanBarcode &&
        now - lastScanTimeRef.current < SAME_BARCODE_COOLDOWN_MS
      ) {
        return;
      }

      // Lock scanner during active product resolution
      isProcessingRef.current = true;
      lastScannedBarcodeRef.current = cleanBarcode;
      lastScanTimeRef.current = now;

      try {
        // Step 1: Lookup Product
        const activeBranchId = selectedBranch?._id || 'dmart-kukatpally';
        console.log(`[API] GET /api/v1/products/barcode/${cleanBarcode}?branchId=${activeBranchId}`);

        const res = await api.get(
          `/products/barcode/${encodeURIComponent(cleanBarcode)}?branchId=${encodeURIComponent(activeBranchId)}`
        );

        const product = res?.product || res?.data?.product || res?.data;

        if (!product || !product.name) {
          const notRegisteredError = new Error('NOT_REGISTERED');
          notRegisteredError.code = 'NOT_REGISTERED';
          throw notRegisteredError;
        }

        console.log('[SCANNER] Product verified:', product.name, `₹${product.price}`);

        // Step 2: Branch Availability Check
        const branchAvail = res?.branchAvailability || res?.data?.branchAvailability;
        const isBranchAvailable = branchAvail !== undefined
          ? Boolean(branchAvail.available)
          : (Number(product.stock) > 0);

        if (!isBranchAvailable) {
          const branchName = selectedBranch?.name || branchAvail?.branchName || 'this supermarket';
          console.warn('[SCANNER] Product unavailable at selected branch:', branchName);
          playErrorBeep(soundEnabled);
          setScanState('ERROR');
          const message = `"${product.name}" is currently unavailable at this branch.`;
          setScanErrorMsg(message);
          setUnavailableProduct({
            ...product,
            branchName
          });

          if (errorTimerRef.current) {
            clearTimeout(errorTimerRef.current);
          }

          errorTimerRef.current = setTimeout(() => {
            setScanErrorMsg(null);
            setUnavailableProduct(null);
            setScanState('SCANNING');
            isProcessingRef.current = false;
          }, 2500);

          return;
        }

        // Step 3: Available Stock Validation
        const availableStock =
          branchAvail?.stock !== undefined && branchAvail?.stock !== null
            ? Number(branchAvail.stock)
            : product.stock !== undefined && product.stock !== null
            ? Number(product.stock)
            : Number(res?.data?.availableStock ?? res?.data?.stockQuantity ?? 0);

        const price = Number(product.price || 0);

        if (availableStock <= 0) {
          playErrorBeep(soundEnabled);
          setScanState('ERROR');
          const message = `"${product.name}" is out of stock.`;
          setScanErrorMsg(message);
          toast.error(message);

          if (errorTimerRef.current) {
            clearTimeout(errorTimerRef.current);
          }

          errorTimerRef.current = setTimeout(() => {
            setScanErrorMsg(null);
            setScanState('SCANNING');
            isProcessingRef.current = false;
          }, 1500);

          return;
        }

        // Step 4: Check Current Cart Limit (ONE USER + ONE PRODUCT = MAXIMUM ONE ITEM)
        const existingInCart = items.find(
          (item) =>
            (cleanBarcode && item.barcode === cleanBarcode) ||
            item.productId === (product._id || product.id)
        );

        if (existingInCart) {
          playErrorBeep(soundEnabled);
          setScanState('ERROR');
          const message = 'This product is already in your cart.';
          setScanErrorMsg(message);
          toast.warning(message);

          if (errorTimerRef.current) {
            clearTimeout(errorTimerRef.current);
          }

          errorTimerRef.current = setTimeout(() => {
            setScanErrorMsg(null);
            setScanState('SCANNING');
            isProcessingRef.current = false;
          }, 1500);

          return;
        }

        // Step 5: Add Product to Cart
        const prodData = {
          product,
          barcode: product.barcode || cleanBarcode,
          availableStock,
          stockQuantity: availableStock,
          sellingPricePaise: Math.round(price * 100),
          mrpPaise: Math.round(price * 100)
        };

        await addItem(cleanBarcode, product._id || product.id, 1, prodData);
        console.log('[CART] Product added to cart:', product.name);

        // Step 6: Product Added & Small Success Notification
        setScanState('PRODUCT_ADDED');

        const newTotalCount = itemCount + 1;
        const newTotalAmount = (totalAmount || 0) + price;

        setScanSuccessInfo({
          product,
          branchName: selectedBranch?.name || branchAvail?.branchName || 'D Mart Kukatpally',
          barcode: cleanBarcode,
          quantityAdded: 1,
          currentCartQuantity: 1,
          totalCartCount: newTotalCount,
          totalCartAmount: newTotalAmount,
          time: Date.now()
        });

        if (successTimerRef.current) {
          clearTimeout(successTimerRef.current);
        }

        successTimerRef.current = setTimeout(() => {
          setScanSuccessInfo(null);
        }, 3000);

        // Step 7: Return Scanner to SCANNING (Keep Camera Open)
        setTimeout(() => {
          setScanState('SCANNING');
          isProcessingRef.current = false;
          console.log('[SCANNER] Ready for next product scan');
        }, 200);

      } catch (err) {
        console.error('[SCANNER] Barcode processing error:', err);
        playErrorBeep(soundEnabled);
        setLastFailedBarcode(cleanBarcode);

        const errorCode = err?.response?.data?.code || err?.code;
        const statusCode = err?.status || err?.response?.status;

        if (errorCode === 'PRODUCT_ALREADY_IN_CART') {
          const message = 'This product is already in your cart.';
          setScanErrorMsg(message);
          setScanState('ERROR');
          toast.warning(message);
        } else if (errorCode === 'PRODUCT_SOLD_OUT' || statusCode === 409) {
          const message = 'Product not found or sold out.';
          setScanErrorMsg(message);
          setScanState('ERROR');
          toast.error(message);
        } else {
          const isNotFound =
            err?.code === 'NOT_REGISTERED' ||
            statusCode === 404 ||
            String(err?.message || '').toLowerCase().includes('not found');

          if (isNotFound) {
            const message = 'Product not found. Try again or use Keypad.';
            console.warn(`[API] barcode = ${cleanBarcode} - ${message}`);
            setScanErrorMsg(message);
            setScanState('ERROR');
          } else {
            const serverMessage = err?.response?.data?.message || err?.response?.data?.error;
            const message = serverMessage || 'Product not found or sold out.';
            setScanErrorMsg(message);
            setScanState('ERROR');
            toast.error(message);
          }
        }

        if (errorTimerRef.current) {
          clearTimeout(errorTimerRef.current);
        }

        errorTimerRef.current = setTimeout(() => {
          setScanErrorMsg(null);
          setScanState('SCANNING');
          isProcessingRef.current = false;
        }, 1500);
      }
    },
    [addItem, items, itemCount, totalAmount, soundEnabled, selectedBranch, toast]
  );

  // Undo Last Scanned Product
  const handleUndo = useCallback(() => {
    if (!scanSuccessInfo) return;

    const { barcode, product } = scanSuccessInfo;
    const target = items.find(
      (item) =>
        (barcode && item.barcode === barcode) ||
        item.productId === (product._id || product.id)
    );

    if (target) {
      updateQuantity(
        target.productId || target.barcode,
        Math.max(0, target.quantity - 1)
      );
      setScanSuccessInfo(null);
      toast.info(`Removed 1 × ${product.name}`);
    }
  }, [scanSuccessInfo, items, updateQuantity, toast]);

  return (
    <div
      className="container page-container"
      style={{
        maxWidth: '520px',
        margin: '0 auto',
        paddingBottom: '120px'
      }}
    >
      {/* ======================================================
          TOP HEADER
          ← Finish & View Cart          📷 LIVE SCANNER
      ======================================================= */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px'
        }}
      >
        <button
          type="button"
          onClick={() => navigate('/cart')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            fontWeight: 800,
            fontSize: '0.88rem',
            cursor: 'pointer',
            padding: '6px 8px',
            borderRadius: 'var(--radius-full)'
          }}
        >
          <Icons.ArrowLeft size={18} />
          <span>Finish & View Cart</span>
        </button>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 12px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            fontSize: '0.76rem',
            fontWeight: 800,
            letterSpacing: '0.04em'
          }}
        >
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: '#10b981',
              animation: 'pulse 1.5s infinite'
            }}
          />
          <span>📷 LIVE SCANNER</span>
        </div>
      </div>

      {/* Supermarket Branch Pill with Change & Search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          margin: '0 auto 12px',
          padding: '5px 14px',
          borderRadius: 'var(--radius-full)',
          background: 'var(--bg-surface)',
          border: '1.5px solid var(--border-card)',
          boxShadow: 'var(--shadow-xs)',
          maxWidth: 'fit-content'
        }}
      >
        <span style={{ fontSize: '0.88rem' }}>📍</span>
        <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          {selectedBranch?.name || 'D Mart Kukatpally'}
        </span>
        <button
          type="button"
          onClick={() => navigate('/stores')}
          style={{
            background: 'rgba(16, 185, 129, 0.12)',
            border: 'none',
            color: 'var(--primary)',
            fontSize: '0.74rem',
            fontWeight: 800,
            cursor: 'pointer',
            borderRadius: 'var(--radius-full)',
            padding: '2px 8px',
            marginLeft: '4px'
          }}
        >
          Change
        </button>
        <span style={{ color: 'var(--border-card)' }}>|</span>
        <button
          type="button"
          onClick={() => navigate('/catalog')}
          style={{
            background: 'rgba(59, 130, 246, 0.12)',
            border: 'none',
            color: '#2563eb',
            fontSize: '0.74rem',
            fontWeight: 800,
            cursor: 'pointer',
            borderRadius: 'var(--radius-full)',
            padding: '2px 8px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <span>🔍 Search</span>
        </button>
      </div>

      {/* ======================================================
          LIVE CAMERA SCANNER WITH RED LASER
      ======================================================= */}
      <div
        style={{
          position: 'relative',
          width: '100%'
        }}
      >
        {/* Small floating success feedback HUD */}
        <ScanSuccessHUD
          scanResult={scanSuccessInfo}
          onUndo={handleUndo}
        />

        {/* Barcode scanner component */}
        <BarcodeScanner
          onScan={handleBarcodeScan}
          isScanning={true}
          scanState={scanState}
          soundEnabled={soundEnabled}
          onSoundToggle={() => setSoundEnabled((prev) => !prev)}
          onVideoStatsUpdate={(stats) => setVideoStats(stats)}
        />
      </div>

      {/* ======================================================
          ERROR / UNKNOWN BARCODE NOTIFICATION
      ======================================================= */}
      {scanErrorMsg && (
        <div
          className="scan-result-reveal"
          style={{
            maxWidth: '440px',
            margin: '10px auto 0',
            padding: '12px 16px',
            borderRadius: '16px',
            background: 'var(--bg-surface)',
            border: '1.5px solid var(--danger)',
            boxShadow: '0 8px 24px rgba(239, 68, 68, 0.16)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
            <Icons.AlertTriangle
              size={22}
              color="var(--danger)"
              style={{ flexShrink: 0 }}
            />
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: 'var(--danger)' }}>
                {scanErrorMsg}
              </div>
              {lastFailedBarcode && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                  Barcode: {lastFailedBarcode}
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setScanErrorMsg(null);
              setLastFailedBarcode(null);
              setScanState('READY');
              setTimeout(() => {
                setScanState('SCANNING');
                isProcessingRef.current = false;
              }, 150);
            }}
            className="btn btn-primary btn-sm"
            style={{
              padding: '6px 14px',
              fontSize: '0.78rem',
              borderRadius: '10px',
              fontWeight: 800
            }}
          >
            Scan Again
          </button>
        </div>
      )}

      {/* ======================================================
          UNAVAILABLE PRODUCT MODAL
      ======================================================= */}
      {unavailableProduct && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setUnavailableProduct(null);
            setScanErrorMsg(null);
            setScanState('READY');
            setTimeout(() => {
              setScanState('SCANNING');
              isProcessingRef.current = false;
            }, 150);
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '380px',
              padding: '26px 22px',
              textAlign: 'center',
              border: '2px solid var(--danger)',
              borderRadius: '22px'
            }}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: '#fef2f2',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
                fontSize: '1.5rem',
                fontWeight: 900
              }}
            >
              ✕
            </div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--danger)', marginBottom: '6px' }}>
              Product Not Available
            </h3>
            <div style={{ fontWeight: 800, color: 'var(--text-primary)', fontSize: '1.02rem', marginBottom: '4px' }}>
              {unavailableProduct.name}
            </div>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.4 }}>
              "{unavailableProduct.name}" is currently unavailable at {unavailableProduct.branchName || selectedBranch?.name || 'this supermarket branch'}.
            </p>
            <button
              type="button"
              onClick={() => {
                setUnavailableProduct(null);
                setScanErrorMsg(null);
                setScanState('READY');
                setTimeout(() => {
                  setScanState('SCANNING');
                  isProcessingRef.current = false;
                }, 150);
              }}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '12px', fontWeight: 800, borderRadius: '12px' }}
            >
              Scan Another Product
            </button>
          </div>
        </div>
      )}

      {/* ======================================================
          COMPACT BASKET SUMMARY
          🛒 1 Item
          ₹10.00
          [ Finish & View Cart ]
      ======================================================= */}
      <div
        className="glass-card"
        style={{
          maxWidth: '440px',
          margin: '16px auto 0',
          padding: '16px 20px',
          borderRadius: '22px',
          border: '1.5px solid var(--border-card)',
          background: 'var(--bg-surface)',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: itemCount > 0 ? '14px' : '0'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '14px',
                background: itemCount > 0 ? 'var(--primary-light)' : 'var(--bg-surface-muted)',
                color: itemCount > 0 ? 'var(--primary)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Icons.ShoppingBag size={22} />
            </div>

            <div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                🛒 {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
              </div>
              <div
                style={{
                  fontSize: '1.18rem',
                  fontWeight: 900,
                  color: itemCount > 0 ? 'var(--primary)' : 'var(--text-muted)',
                  marginTop: '1px'
                }}
              >
                {formatPaise(
                  pricingSummary?.finalPayableAmountPaise ||
                  Math.round((totalAmount || 0) * 100)
                )}
              </div>
            </div>
          </div>

          {itemCount === 0 && (
            <button
              type="button"
              onClick={() => navigate('/cart')}
              className="btn btn-secondary btn-sm"
              style={{
                borderRadius: 'var(--radius-full)',
                fontWeight: 800,
                fontSize: '0.82rem',
                padding: '6px 14px'
              }}
            >
              Finish & View Cart
            </button>
          )}

          {itemCount > 0 && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                padding: '4px 10px',
                borderRadius: '10px',
                textAlign: 'right'
              }}
            >
              <div style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 800 }}>LIVE CART</div>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 700 }}>
                Continuous Scan
              </div>
            </div>
          )}
        </div>

        {/* Primary Action Button: Finish & View Cart */}
        {itemCount > 0 && (
          <button
            type="button"
            onClick={() => navigate('/cart')}
            className="btn btn-primary btn-block btn-lg"
            style={{
              borderRadius: '16px',
              fontWeight: 900,
              fontSize: '0.98rem',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)'
            }}
          >
            <Icons.ShoppingBag size={18} />
            <span>Finish & View Cart</span>
          </button>
        )}
      </div>

      {/* ======================================================
          STICKY BOTTOM BAR (MOBILE): FINISH & VIEW CART ONLY
      ======================================================= */}
      {itemCount > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '72px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 32px)',
            maxWidth: '440px',
            padding: '10px 16px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--bg-surface-elevated)',
            border: '1.5px solid var(--primary)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 800,
            animation: 'slideUp 0.25s ease-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icons.ShoppingBag size={18} color="var(--primary)" />
            <div style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              🛒 {itemCount} {itemCount === 1 ? 'Item' : 'Items'} •{' '}
              <span style={{ color: 'var(--primary)' }}>
                {formatPaise(pricingSummary?.finalPayableAmountPaise || Math.round((totalAmount || 0) * 100))}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/cart')}
            className="btn btn-primary btn-sm"
            style={{
              padding: '7px 16px',
              borderRadius: 'var(--radius-full)',
              fontWeight: 800,
              fontSize: '0.82rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span>Finish & View Cart</span>
            <Icons.ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default ScannerPage;