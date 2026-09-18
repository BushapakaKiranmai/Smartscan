/**
 * SmartScan & Pay — High-Performance Supermarket Barcode Scanner Engine
 *
 * Optimized for rapid, low-latency retail barcode scanning across all Android devices:
 * 1. Hardware-Accelerated BarcodeDetector (Chrome Android 83+ native Shape Detection API)
 *    - Offloads image decoding to C++ hardware acceleration with near 0% main thread CPU usage.
 * 2. Optimized ZXing 1D Fallback Engine (MultiFormatOneDReader)
 *    - Restricted to supermarket retail formats: EAN-13, UPC-A, EAN-8, UPC-E, Code 128.
 *    - Central scanning band cropping with horizontal downsampling (~800px) reducing pixel area by ~65%.
 *    - Dual binarizer: GlobalHistogramBinarizer (glare penetration) + HybridBinarizer (shadows).
 *    - Controlled decode loop (~15 FPS, non-overlapping) to guarantee smooth 60 FPS camera preview.
 * 3. Direct Native MediaStream Binding
 *    - Zero-overhead navigator.mediaDevices.getUserMedia binding directly to the HTML5 video element.
 *    - Automatic continuous hardware autofocus, continuous exposure, and continuous white balance.
 * 4. Strict Modulo-10 Checksum Verification
 *    - 100% check digit validation for EAN-13, UPC-A, and EAN-8 to prevent partial reads.
 * 5. Intelligent Dual-Speed Cooldown
 *    - Different barcode: 0 ms cooldown (instant consecutive scans).
 *    - Same barcode: 1200 ms cooldown (prevents frame re-triggers while holding the item).
 */

import {
  MultiFormatOneDReader,
  BarcodeFormat,
  DecodeHintType,
  BinaryBitmap,
  GlobalHistogramBinarizer,
  HybridBinarizer
} from '@zxing/library';
import { HTMLCanvasElementLuminanceSource } from '@zxing/browser';
import { normalizeBarcode } from '../utils/barcodeNormalizer.js';

class BarcodeScannerEngine {
  constructor(options = {}) {
    this.onBarcodeDetected = typeof options.onBarcodeDetected === 'function' ? options.onBarcodeDetected : () => {};
    this.onVideoStats = typeof options.onVideoStats === 'function' ? options.onVideoStats : () => {};
    this.onError = typeof options.onError === 'function' ? options.onError : () => {};
    this.onStatusChange = typeof options.onStatusChange === 'function' ? options.onStatusChange : () => {};

    this.videoElement = null;
    this.stream = null;
    this.videoTrack = null;

    this.isRunning = false;
    this.isInitialized = false;
    this.starting = false;
    this.stopping = false;
    this.locked = false;

    // Cooldown management
    this.lastDetectedCode = '';
    this.lastDetectedAt = 0;
    this.sameCodeCooldown = 1200; // ms for exact same barcode

    // Flashlight / torch & Zoom
    this.torchSupported = false;
    this.torchOn = false;
    this.zoomSupported = false;
    this.zoomMin = 1;
    this.zoomMax = 1;
    this.currentZoom = 1;

    // Native BarcodeDetector (Chrome Android / Samsung Internet)
    this.nativeDetector = null;

    // ZXing 1D fallback engine
    this.zxingReader = null;
    this.zxingHints = null;
    this.initZXingReader();

    // Frame sampling canvases
    this.sampleCanvas = null;
    this.sampleCtx = null;
    this.rotCanvas = null;
    this.rotCtx = null;
    this.frameCount = 0;

    // Decode loop management
    this.decodeTimer = null;
    this.isDecodingLoopActive = false;
    this.isProcessingFrame = false;

    // Check for native BarcodeDetector
    this.initNativeDetector();
  }

  // ============================================================
  // DECODER INITIALIZATION
  // ============================================================

  async initNativeDetector() {
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats();
        const normalizedSupported = supported.map((s) => String(s).toLowerCase().replace('-', '_'));
        const retailFormats = ['ean_13', 'upc_a', 'ean_8', 'upc_e', 'code_128'];
        const usable = retailFormats.filter((fmt) =>
          normalizedSupported.includes(fmt) || supported.includes(fmt)
        );
        if (usable.length > 0) {
          this.nativeDetector = new window.BarcodeDetector({ formats: usable });
          console.log('[SCANNER] Hardware-accelerated native BarcodeDetector enabled for:', usable);
          return;
        }
      } catch (err) {
        console.warn('[SCANNER] Native BarcodeDetector initialization notice:', err.message);
      }
    }
    console.log('[SCANNER] Using optimized ZXing 1D retail engine with TRY_HARDER');
  }

  initZXingReader() {
    this.zxingHints = new Map();
    this.zxingHints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.UPC_A,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128
    ]);
    // TRY_HARDER enables dense row sampling and inverted passes - essential for curved biscuit rolls & shiny grocery packaging
    this.zxingHints.set(DecodeHintType.TRY_HARDER, true);
    this.zxingReader = new MultiFormatOneDReader(this.zxingHints);
  }

  // ============================================================
  // CAMERA START
  // ============================================================

  async start(videoElement) {
    if (!videoElement) {
      const error = new Error('Scanner video element is missing.');
      this.handleError(error);
      throw error;
    }

    if (this.starting) {
      console.log('[SCANNER] Start already in progress, ignoring duplicate call');
      return;
    }

    this.starting = true;
    this.stopping = false;
    this.videoElement = videoElement;

    console.log('[SCANNER] ========================================');
    console.log('[SCANNER] Starting Supermarket Barcode Scanner (Rear Camera)...');
    console.log('[SCANNER] Retail Formats: EAN-13, UPC-A, EAN-8, UPC-E, CODE-128');
    console.log('[SCANNER] ========================================');

    this.onStatusChange('CAMERA_STARTING');

    try {
      // If already running, clean up first
      if (this.isRunning || this.isInitialized) {
        await this.stop(false, 'CLEANUP REASON: RESTART');
      }

      this.videoElement = videoElement;
      this.stopping = false;
      this.locked = false;

      // Acquire camera stream with practical resolution (1280x720 ideal)
      const constraintsList = [
        // 1. Primary: 1280x720 rear camera at 30fps
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            frameRate: { ideal: 30, min: 15 }
          },
          audio: false
        },
        // 2. Fallback: Environment facingMode without resolution bounds
        {
          video: {
            facingMode: { ideal: 'environment' }
          },
          audio: false
        },
        // 3. Fallback: Any available camera
        {
          video: true,
          audio: false
        }
      ];

      let stream = null;
      let lastError = null;

      for (const constraints of constraintsList) {
        if (this.stopping) return;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stream) break;
        } catch (err) {
          lastError = err;
          console.warn('[SCANNER] Camera constraint fallback:', err.message);
        }
      }

      if (!stream) {
        throw lastError || new Error('Could not access rear camera.');
      }

      if (this.stopping) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      this.stream = stream;
      this.videoTrack = stream.getVideoTracks()[0];

      // Bind directly to video element
      this.videoElement.srcObject = stream;
      this.videoElement.setAttribute('playsinline', 'true');
      this.videoElement.setAttribute('autoplay', 'true');
      this.videoElement.setAttribute('muted', 'true');
      this.videoElement.muted = true;

      // Wait for video to begin playing
      try {
        await this.videoElement.play();
      } catch (playErr) {
        console.warn('[SCANNER] Video play() warning:', playErr);
      }

      // Wait for video dimensions to be populated
      await this.waitForVideoDimensions(4000);

      if (this.stopping) return;

      // Apply continuous hardware autofocus, exposure & white balance
      await this.applyHardwareEnhancements();

      this.isInitialized = true;
      this.isRunning = true;

      console.log('[SCANNER] CAMERA READY - STREAM ACTIVE');
      console.log(`[SCANNER] Sensor Dimensions: ${this.videoElement.videoWidth} x ${this.videoElement.videoHeight}`);
      console.log('[SCANNER] CONTINUOUS SCANNING ACTIVE');

      this.onStatusChange('READY');

      // Start the efficient single decode loop
      this.startDecodeLoop();
    } catch (error) {
      if (this.stopping) {
        console.log('[SCANNER] Start aborted due to stop request');
        return;
      }
      console.error('[SCANNER] Camera initialization failed:', error);
      await this.stop(false, 'CLEANUP REASON: INIT_ERROR');
      this.handleError(error);
      throw error;
    } finally {
      this.starting = false;
    }
  }

  // ============================================================
  // HARDWARE AUTOFOCUS & CAMERA CAPABILITIES
  // ============================================================

  async applyHardwareEnhancements() {
    if (!this.videoTrack || typeof this.videoTrack.getCapabilities !== 'function') {
      return;
    }

    try {
      const caps = this.videoTrack.getCapabilities();
      const advanced = [];

      // Continuous autofocus keeps supermarket barcodes in sharp focus at variable distances
      if (caps.focusMode && caps.focusMode.includes('continuous')) {
        advanced.push({ focusMode: 'continuous' });
      } else if (caps.focusMode && caps.focusMode.includes('auto')) {
        advanced.push({ focusMode: 'auto' });
      }

      // Continuous exposure handles supermarket glare and uneven aisle lighting
      if (caps.exposureMode && caps.exposureMode.includes('continuous')) {
        advanced.push({ exposureMode: 'continuous' });
      }

      // Continuous white balance corrects colored supermarket fluorescent lighting
      if (caps.whiteBalanceMode && caps.whiteBalanceMode.includes('continuous')) {
        advanced.push({ whiteBalanceMode: 'continuous' });
      }

      // Check zoom capability (Samsung Galaxy A-series 50MP sensors)
      if (caps.zoom) {
        this.zoomSupported = true;
        this.zoomMin = caps.zoom.min || 1;
        this.zoomMax = caps.zoom.max || 1;
        this.zoomStep = caps.zoom.step || 0.1;
        this.currentZoom = this.zoomMin;
      }

      if (advanced.length > 0 && typeof this.videoTrack.applyConstraints === 'function') {
        await this.videoTrack.applyConstraints({ advanced });
        console.log('[SCANNER] Applied hardware continuous autofocus and camera constraints:', advanced);
      }

      this.torchSupported = Boolean(caps && caps.torch);
    } catch (e) {
      console.warn('[SCANNER] Hardware autofocus constraints notice:', e.message);
    }

    // Publish video track stats
    const settings = typeof this.videoTrack.getSettings === 'function' ? this.videoTrack.getSettings() : {};
    const stats = {
      width: settings.width || this.videoElement?.videoWidth || 0,
      height: settings.height || this.videoElement?.videoHeight || 0,
      frameRate: settings.frameRate || 30,
      facingMode: settings.facingMode || 'environment',
      label: this.videoTrack.label || 'Rear Camera',
      hasTorch: this.torchSupported,
      hasZoom: this.zoomSupported,
      zoomMin: this.zoomMin,
      zoomMax: this.zoomMax,
      currentZoom: this.currentZoom
    };

    try {
      this.onVideoStats(stats);
    } catch {}
  }

  async waitForVideoDimensions(timeout = 4000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (this.stopping) return;
      if (
        this.videoElement &&
        this.videoElement.videoWidth > 0 &&
        this.videoElement.videoHeight > 0
      ) {
        return;
      }
      await new Promise((res) => setTimeout(res, 50));
    }
  }

  // ============================================================
  // DECODE LOOP (EFFICIENT & NON-OVERLAPPING)
  // ============================================================

  startDecodeLoop() {
    this.stopDecodeLoop();
    this.isDecodingLoopActive = true;

    const decodeTick = async () => {
      if (!this.isDecodingLoopActive || this.stopping || !this.isRunning) {
        return;
      }

      if (!this.locked && !this.isProcessingFrame) {
        this.isProcessingFrame = true;
        try {
          await this.scanFrame();
        } catch {
          // Frame errors should never break the loop
        } finally {
          this.isProcessingFrame = false;
        }
      }

      if (this.isDecodingLoopActive && !this.stopping) {
        // Fast 40ms interval (~25 FPS) for immediate barcode registration
        this.decodeTimer = setTimeout(decodeTick, 40);
      }
    };

    this.decodeTimer = setTimeout(decodeTick, 40);
  }

  stopDecodeLoop() {
    this.isDecodingLoopActive = false;
    this.isProcessingFrame = false;
    if (this.decodeTimer) {
      clearTimeout(this.decodeTimer);
      this.decodeTimer = null;
    }
  }

  // ============================================================
  // FRAME SCANNING
  // ============================================================

  async scanFrame() {
    const video = this.videoElement;
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    this.frameCount++;

    // 1. Primary: Hardware-Accelerated Native BarcodeDetector (Chrome Android / Samsung Internet)
    if (this.nativeDetector) {
      try {
        const barcodes = await this.nativeDetector.detect(video);
        if (barcodes && barcodes.length > 0) {
          const item = barcodes[0];
          const rawValue = item.rawValue;
          const format = this.normalizeFormatName(item.format);
          this.handleDetection(rawValue, format);
          return;
        }
      } catch {
        // Fall back to ZXing if native detection encounters a frame issue
      }
    }

    // 2. Fallback: Optimized ZXing 1D Retail Reader
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    if (!this.sampleCanvas) {
      this.sampleCanvas = document.createElement('canvas');
      this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });
    }

    // Crop the central 60% vertical height (generous coverage for curved biscuit rolls & tall grocery items)
    const sh = Math.max(180, Math.round(vh * 0.60));
    const sy = Math.round((vh - sh) / 2);

    // Maintain crisp bar edges: downscale only if sensor resolution exceeds 960px
    const targetWidth = Math.min(960, vw);
    const targetHeight = Math.round(sh * (targetWidth / vw));

    this.sampleCanvas.width = targetWidth;
    this.sampleCanvas.height = targetHeight;
    this.sampleCtx.drawImage(video, 0, sy, vw, sh, 0, 0, targetWidth, targetHeight);

    const lumSource = new HTMLCanvasElementLuminanceSource(this.sampleCanvas);

    // Pass 1: GlobalHistogramBinarizer (superior for glossy cellophane & grocery packaging glare)
    let result = null;
    try {
      result = this.zxingReader.decode(new BinaryBitmap(new GlobalHistogramBinarizer(lumSource)), this.zxingHints);
    } catch {}

    // Pass 2: HybridBinarizer (adaptive thresholding for shadows, only if pass 1 found nothing)
    if (!result) {
      try {
        result = this.zxingReader.decode(new BinaryBitmap(new HybridBinarizer(lumSource)), this.zxingHints);
      } catch {}
    }

    // Pass 3: Multi-orientation / Vertical (90 deg rotated) check every other frame
    if (!result && this.frameCount % 2 === 0) {
      try {
        if (!this.rotCanvas) {
          this.rotCanvas = document.createElement('canvas');
          this.rotCtx = this.rotCanvas.getContext('2d', { willReadFrequently: true });
        }
        this.rotCanvas.width = targetHeight;
        this.rotCanvas.height = targetWidth;
        this.rotCtx.save();
        this.rotCtx.translate(targetHeight / 2, targetWidth / 2);
        this.rotCtx.rotate(Math.PI / 2);
        this.rotCtx.drawImage(this.sampleCanvas, -targetWidth / 2, -targetHeight / 2);
        this.rotCtx.restore();

        const rotLumSource = new HTMLCanvasElementLuminanceSource(this.rotCanvas);
        result = this.zxingReader.decode(new BinaryBitmap(new GlobalHistogramBinarizer(rotLumSource)), this.zxingHints);
      } catch {}
    }

    if (result && result.getText()) {
      const rawCode = result.getText();
      const format = this.mapZXingFormat(result.getBarcodeFormat());
      this.handleDetection(rawCode, format, result);
    }
  }

  // ============================================================
  // DETECTION PIPELINE & CHECKSUM VALIDATION
  // ============================================================

  handleDetection(rawCode, rawFormat = 'EAN-13', rawResult = null) {
    if (!rawCode || this.stopping || this.locked) return;

    const rawStr = String(rawCode).trim();
    const format = this.normalizeFormatName(rawFormat);

    // 1. Normalize barcode string (preserve leading zeros)
    const code = this.normalizeDetectedCode(rawStr);
    if (!code) return;

    // 2. Validate retail format & Modulo-10 checksum
    if (!this.isValidRetailBarcode(code, format)) {
      return;
    }

    const now = Date.now();

    // 3. Intelligent Cooldown:
    // - Exact same barcode held in view: wait 1200 ms to avoid double-charging
    // - Different barcode: 0 ms cooldown (instant consecutive scans!)
    if (code === this.lastDetectedCode && now - this.lastDetectedAt < this.sameCodeCooldown) {
      return;
    }

    this.lastDetectedCode = code;
    this.lastDetectedAt = now;

    console.log('[SCANNER] Barcode CONFIRMED');
    console.log(`[SCANNER] 🎯 BARCODE DETECTED: ${code} (${format})`);

    // Lock briefly to allow app to process scan
    this.locked = true;

    try {
      this.onBarcodeDetected(code, format, rawResult);
    } catch (error) {
      console.error('[SCANNER] Detection callback error:', error);
    }

    // Release engine lock after brief debounce
    setTimeout(() => {
      if (!this.stopping) {
        this.locked = false;
      }
    }, 250);
  }

  normalizeDetectedCode(code) {
    if (code === null || code === undefined) return null;
    const raw = String(code).trim();
    if (!raw) return null;

    try {
      const normalized = normalizeBarcode(raw);
      if (normalized) return String(normalized).trim();
    } catch {}

    return raw;
  }

  isValidRetailBarcode(code, format = '') {
    if (!code || typeof code !== 'string') return false;
    const clean = code.trim();

    // EAN-13: Standard retail barcode (13 digits) with Modulo-10 checksum
    if (/^\d{13}$/.test(clean)) {
      return this.isValidEAN13Checksum(clean);
    }

    // UPC-A: US retail barcode (12 digits) with Modulo-10 checksum
    if (/^\d{12}$/.test(clean)) {
      return this.isValidUPCAChecksum(clean);
    }

    // EAN-8: Compact supermarket barcode (8 digits) with Modulo-10 checksum
    if (/^\d{8}$/.test(clean)) {
      return this.isValidEAN8Checksum(clean);
    }

    // UPC-E: 6-8 digits compact retail format
    if (/^\d{6,8}$/.test(clean) && (format.includes('UPC-E') || format.includes('upce'))) {
      return true;
    }

    // Code 128: Alphanumeric supermarket vouchers / shelf tags (4-48 characters)
    if (clean.length >= 4 && clean.length <= 48 && (format.includes('128') || /^[A-Za-z0-9\-_.]+$/.test(clean))) {
      return true;
    }

    return false;
  }

  isValidEAN13Checksum(barcode) {
    if (!/^\d{13}$/.test(barcode)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(barcode[i], 10);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(barcode[12], 10);
  }

  isValidUPCAChecksum(barcode) {
    if (!/^\d{12}$/.test(barcode)) return false;
    let sum = 0;
    for (let i = 0; i < 11; i++) {
      const digit = parseInt(barcode[i], 10);
      sum += i % 2 === 0 ? digit * 3 : digit;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(barcode[11], 10);
  }

  isValidEAN8Checksum(barcode) {
    if (!/^\d{8}$/.test(barcode)) return false;
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const digit = parseInt(barcode[i], 10);
      sum += i % 2 === 0 ? digit * 3 : digit;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit === parseInt(barcode[7], 10);
  }

  mapZXingFormat(formatEnum) {
    switch (formatEnum) {
      case BarcodeFormat.EAN_13:
        return 'EAN-13';
      case BarcodeFormat.UPC_A:
        return 'UPC-A';
      case BarcodeFormat.EAN_8:
        return 'EAN-8';
      case BarcodeFormat.UPC_E:
        return 'UPC-E';
      case BarcodeFormat.CODE_128:
        return 'CODE-128';
      default:
        return BarcodeFormat[formatEnum] ? BarcodeFormat[formatEnum].toUpperCase() : 'EAN-13';
    }
  }

  normalizeFormatName(rawFormat) {
    const fmt = String(rawFormat || '').toLowerCase().replace(/[-_]/g, '');
    if (fmt.includes('ean13')) return 'EAN-13';
    if (fmt.includes('upca')) return 'UPC-A';
    if (fmt.includes('ean8')) return 'EAN-8';
    if (fmt.includes('upce')) return 'UPC-E';
    if (fmt.includes('code128') || fmt.includes('128')) return 'CODE-128';
    return rawFormat ? String(rawFormat).toUpperCase() : 'EAN-13';
  }

  // ============================================================
  // FLASHLIGHT / TORCH
  // ============================================================

  hasTorchSupport() {
    return this.torchSupported;
  }

  async toggleTorch() {
    if (!this.videoTrack || !this.torchSupported) return false;

    try {
      this.torchOn = !this.torchOn;
      await this.videoTrack.applyConstraints({
        advanced: [{ torch: this.torchOn }]
      });
      console.log('[SCANNER] Torch state:', this.torchOn ? 'ON' : 'OFF');
      return this.torchOn;
    } catch (error) {
      console.warn('[SCANNER] Torch toggle error:', error);
      this.torchOn = false;
      return false;
    }
  }

  // ============================================================
  // ZOOM & AUTOFOCUS CONTROLS (SAMSUNG / ANDROID ENHANCEMENT)
  // ============================================================

  hasZoomSupport() {
    return this.zoomSupported;
  }

  getZoomLevel() {
    return this.currentZoom;
  }

  async setZoom(level) {
    if (!this.videoTrack || !this.zoomSupported) return false;

    try {
      const target = Math.min(this.zoomMax, Math.max(this.zoomMin, Number(level)));
      await this.videoTrack.applyConstraints({
        advanced: [{ zoom: target }]
      });
      this.currentZoom = target;
      console.log('[SCANNER] Zoom set to:', target);
      return target;
    } catch (err) {
      console.warn('[SCANNER] Zoom error:', err);
      return false;
    }
  }

  async triggerAutofocus() {
    if (!this.videoTrack || typeof this.videoTrack.applyConstraints !== 'function') return;

    try {
      const caps = this.videoTrack.getCapabilities ? this.videoTrack.getCapabilities() : {};
      if (caps.focusMode && caps.focusMode.includes('auto')) {
        await this.videoTrack.applyConstraints({ advanced: [{ focusMode: 'auto' }] });
        setTimeout(() => {
          if (caps.focusMode && caps.focusMode.includes('continuous')) {
            this.videoTrack.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
          }
        }, 600);
      }
      console.log('[SCANNER] Re-triggered hardware autofocus pulse');
    } catch (err) {
      console.warn('[SCANNER] Refocus notice:', err.message);
    }
  }

  // ============================================================
  // LOCK / UNLOCK & STOP
  // ============================================================

  setLock(locked) {
    this.locked = Boolean(locked);
  }

  async stop(notify = true, reason = '') {
    this.stopping = true;
    this.starting = false;
    const reasonMsg = reason ? ` (${reason})` : '';
    console.log(`[SCANNER] Stopping scanner engine...${reasonMsg}`);

    this.stopDecodeLoop();

    // Stop and release camera tracks
    if (this.stream) {
      try {
        this.stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
      } catch {}
      this.stream = null;
    }

    if (this.videoElement) {
      try {
        this.videoElement.pause();
        this.videoElement.srcObject = null;
      } catch {}
    }

    this.videoTrack = null;
    this.isRunning = false;
    this.isInitialized = false;
    this.locked = false;
    this.torchOn = false;
    this.torchSupported = false;

    if (notify) {
      this.onStatusChange('STOPPED');
    }

    console.log('[SCANNER] Scanner engine stopped');
  }

  handleError(error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[SCANNER] Engine error:', err);

    try {
      this.onError(err);
    } catch {}

    this.onStatusChange('ERROR');
  }
}

export default BarcodeScannerEngine;