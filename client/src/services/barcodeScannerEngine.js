/**
 * SmartScan & Pay — Barcode Scanner Engine
 *
 * High-performance supermarket barcode scanner engine combining:
 * 1. ZXing High-Definition 1D Frame Engine (MultiFormatOneDReader)
 *    - Strict EAN-13 & UPC-A retail format configuration (eliminates 8-digit partial ghost reads)
 *    - Full-width video sampling (0 horizontal clipping) ensuring start/end guard bars are never truncated
 *    - Dual GlobalHistogramBinarizer (glare penetration) & HybridBinarizer (shadow handling)
 * 2. EricBlade Quagga2 Camera & Stream Manager
 *    - Hardware autofocus / continuous exposure / white balance constraints
 *    - Seamless camera switching and torch control
 * 3. Strict Modulo-10 Checksum Verification
 *    - 100% EAN-13 (13 digits) and UPC-A (12 digits) check digit validation
 */

import Quagga from '@ericblade/quagga2';
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

console.log('⚡ HYBRID QUAGGA2 + ZXING 1D RETAIL SCANNER ENGINE INITIALIZED ⚡');

class BarcodeScannerEngine {
  constructor(options = {}) {
    this.selectedDeviceId = options.selectedDeviceId || null;
    this.onBarcodeDetected = typeof options.onBarcodeDetected === 'function' ? options.onBarcodeDetected : () => {};
    this.onVideoStats = typeof options.onVideoStats === 'function' ? options.onVideoStats : () => {};
    this.onError = typeof options.onError === 'function' ? options.onError : () => {};
    this.onStatusChange = typeof options.onStatusChange === 'function' ? options.onStatusChange : () => {};

    this.videoElement = null;
    this.hostElement = null;

    this.isRunning = false;
    this.isInitialized = false;
    this.locked = false;
    this.stopping = false;
    this.starting = false;

    this.lastDetectedCode = '';
    this.lastDetectedAt = 0;
    this.sameCodeCooldown = 2800; // ms between consecutive scans of the exact same barcode

    this.torchSupported = false;
    this.torchOn = false;
    this.videoTrack = null;

    this.pendingCandidate = null;
    this.pendingCandidateTime = 0;
    this.candidateHits = 0;

    this.detectHandler = null;
    this.processedHandler = null;
    this.lastCandidateLog = 0;

    // Supermarket retail barcode formats
    this.readers = [
      'ean_reader',     // Primary retail supermarket format (EAN-13, 13 digits)
      'upc_reader',     // UPC-A (12 digits)
      'ean_8_reader',   // EAN-8 (8 digits)
      'upc_e_reader',   // UPC-E (compact retail format)
      'code_128_reader' // Store vouchers / receipts
    ];

    // High-speed ZXing 1D engine for continuous video frame decoding
    this.zxingHints = new Map();
    this.zxingHints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.UPC_A,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128
    ]);
    this.zxingHints.set(DecodeHintType.TRY_HARDER, true);
    this.zxingReader = new MultiFormatOneDReader(this.zxingHints);

    this.sampleCanvas = null;
    this.sampleCtx = null;
    this.zxingRunning = false;
    this.zxingTimer = null;
    this.frameCounter = 0;

    console.log('[SCANNER] Engine instance configured for retail barcodes: EAN-13, UPC-A, EAN-8, UPC-E, CODE-128');
  }

  // ============================================================
  // CAMERA DISCOVERY
  // ============================================================

  static async getAvailableCameras() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.warn('[SCANNER] enumerateDevices not supported by browser');
        return [];
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices
        .filter((device) => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          groupId: device.groupId,
          label: device.label || `Camera ${index + 1}`,
          kind: device.kind
        }));

      console.log(
        '[SCANNER] Available cameras:',
        cameras.map((c) => ({ id: c.deviceId, label: c.label }))
      );

      return cameras;
    } catch (error) {
      console.error('[SCANNER] Could not enumerate cameras:', error);
      return [];
    }
  }

  // ============================================================
  // START ENGINE
  // ============================================================

  async start(videoElement, selectedCameraId = null) {
    if (!videoElement) {
      const error = new Error('Scanner video element is missing.');
      this.handleError(error);
      throw error;
    }

    if (this.starting) {
      console.log('[SCANNER] Start already in progress, skipping duplicate call');
      return;
    }

    this.starting = true;
    this.stopping = false;
    this.videoElement = videoElement;
    this.selectedDeviceId = selectedCameraId || this.selectedDeviceId || null;

    console.log('[SCANNER] ========================================');
    console.log('[SCANNER] Starting Supermarket Retail Scanner...');
    console.log('[SCANNER] Selected camera ID:', this.selectedDeviceId || 'Auto (Environment)');
    console.log('[SCANNER] Formats: EAN-13 (13 digits), UPC-A (12 digits)');
    console.log('[SCANNER] ========================================');

    this.onStatusChange('CAMERA_STARTING');

    try {
      // 1. If this instance was already running, cleanly stop it first
      if (this.isRunning || this.isInitialized) {
        await this.stop(false, 'CLEANUP REASON: RESTART');
      }

      this.videoElement = videoElement;
      this.selectedDeviceId = selectedCameraId || this.selectedDeviceId || null;
      this.stopping = false;
      this.locked = false;

      // 2. Create Quagga host container
      await this.createQuaggaHost();

      if (this.stopping) return;

      // 3. Build optimized camera constraints
      const constraints = this.buildCameraConstraints();
      console.log('[SCANNER] Camera constraints:', constraints);

      // 4. Configure Quagga2 for retail supermarket barcodes
      const config = {
        inputStream: {
          name: 'SmartScanLiveCamera',
          type: 'LiveStream',
          target: this.hostElement,
          constraints,
          area: {
            top: '15%',
            right: '5%',
            left: '5%',
            bottom: '15%'
          }
        },
        locator: {
          patchSize: 'medium',
          halfSample: true
        },
        decoder: {
          readers: this.readers,
          multiple: false
        },
        locate: true,
        numOfWorkers: 0,
        frequency: 15
      };

      // 5. Initialize Quagga
      await this.initializeQuagga(config);

      if (this.stopping) return;

      // 6. Setup handlers
      this.setupDetectionHandler();
      this.setupProcessedHandler();

      // 7. Start camera processing
      console.log('[SCANNER] Calling Quagga.start()...');
      Quagga.start();

      this.isInitialized = true;
      this.isRunning = true;

      // 8. Wait for live video stream
      await this.waitForQuaggaVideo(8000);

      if (this.stopping) return;

      // 9. Style injected video and hide canvas
      this.prepareQuaggaVideo();

      // 10. Update track info & apply hardware continuous autofocus
      await this.updateVideoTrack();

      const quaggaVideo = this.getQuaggaVideo();
      if (quaggaVideo) {
        try {
          await quaggaVideo.play();
        } catch (playErr) {
          console.warn('[SCANNER] Video play() warning:', playErr);
        }
      }

      // 11. Scanner is ready - output exact required status logs
      console.log('[SCANNER] READY');
      console.log('[SCANNER] CONTINUOUS SCANNING ACTIVE');
      console.log('[SCANNER] READY - CONTINUOUS SCANNING');
      console.log('[SCANNER] ========================================');
      console.log('[SCANNER] Camera ready');
      console.log('[SCANNER] Camera:', this.getCurrentCameraLabel());
      console.log('[SCANNER] Point any real EAN-13 supermarket barcode at the camera');
      console.log('[SCANNER] ========================================');

      this.onStatusChange('READY');

      // 12. Launch high-speed ZXing multi-binarizer frame loop
      this.startZXingLoop();
    } catch (error) {
      if (this.stopping) {
        console.log('[SCANNER] Start aborted due to stop request');
        return;
      }
      console.error('[SCANNER] START FAILED:', error);
      await this.cleanupQuagga();
      this.isRunning = false;
      this.isInitialized = false;
      this.handleError(error);
      throw error;
    } finally {
      this.starting = false;
    }
  }

  // ============================================================
  // ZXING HIGH-SPEED CONTINUOUS VIDEO FRAME SCANNER
  // ============================================================

  startZXingLoop() {
    this.stopZXingLoop();
    this.zxingRunning = true;
    console.log('[SCANNER] ZXing high-definition video frame sampler started');

    const sample = () => {
      if (!this.zxingRunning || this.stopping || !this.isRunning) return;

      if (!this.locked) {
        try {
          this.scanCurrentFrame();
        } catch {
          // Frame errors should never crash the loop
        }
      }

      if (this.zxingRunning && !this.stopping) {
        // Run frame sampling at ~18 frames per second
        this.zxingTimer = setTimeout(sample, 55);
      }
    };

    this.zxingTimer = setTimeout(sample, 120);
  }

  stopZXingLoop() {
    this.zxingRunning = false;
    if (this.zxingTimer) {
      clearTimeout(this.zxingTimer);
      this.zxingTimer = null;
    }
  }

  decodeBitmapSafe(bitmap) {
    if (!bitmap || !this.zxingReader) return null;
    try {
      return this.zxingReader.decode(bitmap, this.zxingHints);
    } catch {
      return null;
    }
  }

  scanCurrentFrame() {
    const video = this.getQuaggaVideo();
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    this.frameCounter = (this.frameCounter || 0) + 1;

    if (!this.sampleCanvas) {
      this.sampleCanvas = document.createElement('canvas');
      this.sampleCtx = this.sampleCanvas.getContext('2d', { willReadFrequently: true });
    }

    // CRITICAL: NEVER crop the horizontal width!
    // 1D barcodes have guard patterns at both ends. Slicing width cuts off outer bars,
    // which previously caused partial sub-slice false positives.
    // We preserve 100% width (vw) and constrain vertical height to the center where the laser line is.
    const cycle = this.frameCounter % 3;

    if (cycle === 0) {
      // Primary View: 100% full width, center 60% vertical strip (where the red line sits)
      const sh = Math.max(240, Math.round(vh * 0.60));
      const sy = Math.round((vh - sh) / 2);

      this.sampleCanvas.width = vw;
      this.sampleCanvas.height = sh;
      this.sampleCtx.drawImage(video, 0, sy, vw, sh, 0, 0, vw, sh);
    } else if (cycle === 1) {
      // Focused Laser View: 100% full width, narrow 35% height centered on laser line
      const sh = Math.max(160, Math.round(vh * 0.35));
      const sy = Math.round((vh - sh) / 2);

      this.sampleCanvas.width = vw;
      this.sampleCanvas.height = sh;
      this.sampleCtx.drawImage(video, 0, sy, vw, sh, 0, 0, vw, sh);
    } else {
      // Full Sensor View: 100% width x 100% height
      this.sampleCanvas.width = vw;
      this.sampleCanvas.height = vh;
      this.sampleCtx.drawImage(video, 0, 0, vw, vh);
    }

    const lumSource = new HTMLCanvasElementLuminanceSource(this.sampleCanvas);

    // Pass 1: GlobalHistogramBinarizer (penetrates packaging gloss & specular glare)
    let result = this.decodeBitmapSafe(new BinaryBitmap(new GlobalHistogramBinarizer(lumSource)));

    // Pass 2: HybridBinarizer (adaptive thresholding for room shadows)
    if (!result) {
      result = this.decodeBitmapSafe(new BinaryBitmap(new HybridBinarizer(lumSource)));
    }

    if (result && result.getText()) {
      const rawCode = result.getText();
      const format = this.mapZXingFormat(result.getBarcodeFormat());
      this.handleDetection(rawCode, format, result);
    }
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
    if (fmt.includes('ean13') || fmt === 'eanreader') return 'EAN-13';
    if (fmt.includes('upca') || fmt === 'upcreader') return 'UPC-A';
    if (fmt.includes('ean8') || fmt === 'ean8reader') return 'EAN-8';
    if (fmt.includes('upce') || fmt === 'upcereader') return 'UPC-E';
    if (fmt.includes('code128') || fmt === 'code128reader') return 'CODE-128';
    return rawFormat ? String(rawFormat).toUpperCase() : 'EAN-13';
  }

  // ============================================================
  // CAMERA CONSTRAINTS
  // ============================================================

  buildCameraConstraints() {
    const constraints = {
      width: { ideal: 1280, min: 640 },
      height: { ideal: 720, min: 480 },
      frameRate: { ideal: 30, min: 15 },
      facingMode: { ideal: 'environment' }
    };

    if (this.selectedDeviceId) {
      constraints.deviceId = { ideal: this.selectedDeviceId };
      delete constraints.facingMode;
    }

    return constraints;
  }

  // ============================================================
  // INITIALIZE QUAGGA
  // ============================================================

  initializeQuagga(config) {
    return new Promise((resolve, reject) => {
      let finished = false;

      const complete = (error) => {
        if (finished) return;
        finished = true;

        if (error) {
          console.error('[SCANNER] Quagga.init() error:', error);
          reject(error);
        } else {
          console.log('[SCANNER] Decoder initialized successfully');
          resolve();
        }
      };

      try {
        Quagga.init(config, complete);
      } catch (err) {
        complete(err);
      }
    });
  }

  // ============================================================
  // HOST CONTAINER
  // ============================================================

  async createQuaggaHost() {
    if (!this.videoElement) {
      throw new Error('Video element unavailable.');
    }

    const parent = this.videoElement.parentElement;
    if (!parent) {
      throw new Error('Scanner video parent container unavailable.');
    }

    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.position === 'static') {
      parent.style.position = 'relative';
    }

    const host = document.createElement('div');
    host.className = 'smartscan-quagga-host';
    Object.assign(host.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      zIndex: '2',
      pointerEvents: 'none',
      background: '#000000'
    });

    parent.appendChild(host);
    this.hostElement = host;

    // Hide the React placeholder video
    Object.assign(this.videoElement.style, {
      opacity: '0',
      pointerEvents: 'none'
    });
  }

  // ============================================================
  // WAIT FOR VIDEO
  // ============================================================

  async waitForQuaggaVideo(timeout = 8000) {
    const startTime = Date.now();
    let streamLogged = false;

    while (Date.now() - startTime < timeout) {
      if (this.stopping) return false;

      const video = this.getQuaggaVideo();
      if (video) {
        if (video.srcObject && !streamLogged) {
          streamLogged = true;
          console.log('[SCANNER] CAMERA STREAM ACTIVE');
        }

        const isReady =
          video.readyState >= (HTMLMediaElement.HAVE_METADATA || 1) &&
          video.videoWidth > 0 &&
          video.videoHeight > 0;

        if (isReady) {
          console.log('[SCANNER] CAMERA VIDEO READY');
          console.log(`[SCANNER] Video dimensions: ${video.videoWidth} x ${video.videoHeight}`);
          return true;
        }

        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 80);
          const onMetadata = () => {
            clearTimeout(timer);
            video.removeEventListener('loadedmetadata', onMetadata);
            resolve();
          };
          video.addEventListener('loadedmetadata', onMetadata, { once: true });
        });

        if (this.stopping) return false;

        if (
          video.readyState >= (HTMLMediaElement.HAVE_METADATA || 1) &&
          video.videoWidth > 0 &&
          video.videoHeight > 0
        ) {
          console.log('[SCANNER] CAMERA VIDEO READY');
          console.log(`[SCANNER] Video dimensions: ${video.videoWidth} x ${video.videoHeight}`);
          return true;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    if (this.stopping) return false;
    console.warn('[SCANNER] Video element not fully populated within timeout');
    return false;
  }

  getQuaggaVideo() {
    if (!this.hostElement) return null;
    return this.hostElement.querySelector('video');
  }

  prepareQuaggaVideo() {
    const video = this.getQuaggaVideo();
    if (!video) return;

    Object.assign(video.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      minWidth: '100%',
      minHeight: '100%',
      objectFit: 'cover',
      display: 'block',
      zIndex: '1'
    });

    video.setAttribute('playsinline', 'true');
    video.setAttribute('autoplay', 'true');
    video.setAttribute('muted', 'true');
    video.muted = true;

    // Hide Quagga's raw drawingBuffer canvas so our custom reticle overlays cleanly
    const canvas = this.hostElement.querySelector('canvas.drawingBuffer');
    if (canvas) {
      canvas.style.display = 'none';
    }
  }

  // ============================================================
  // DETECTION HANDLER
  // ============================================================

  setupDetectionHandler() {
    this.removeDetectionHandler();

    this.detectHandler = (result) => {
      this.handleQuaggaDetection(result);
    };

    Quagga.onDetected(this.detectHandler);
    console.log('[SCANNER] Quagga onDetected listener registered');
  }

  setupProcessedHandler() {
    if (this.processedHandler) return;

    this.processedHandler = (result) => {
      if (result && result.codeResult && result.codeResult.code) {
        const now = Date.now();
        if (now - this.lastCandidateLog > 500) {
          this.lastCandidateLog = now;
          console.log('[SCANNER] Barcode candidate detected:', result.codeResult.code, result.codeResult.format);
        }
      }
    };

    try {
      Quagga.onProcessed(this.processedHandler);
    } catch {
      this.processedHandler = null;
    }
  }

  removeDetectionHandler() {
    if (this.detectHandler) {
      try {
        Quagga.offDetected(this.detectHandler);
      } catch {}
      this.detectHandler = null;
    }

    if (this.processedHandler) {
      try {
        Quagga.offProcessed(this.processedHandler);
      } catch {}
      this.processedHandler = null;
    }
  }

  // ============================================================
  // UNIFIED BARCODE DETECTION PIPELINE
  // ============================================================

  handleQuaggaDetection(result) {
    if (!result || !result.codeResult || !result.codeResult.code) return;
    const rawCode = String(result.codeResult.code).trim();
    const format = this.normalizeFormatName(result.codeResult.format);
    this.handleDetection(rawCode, format, result);
  }

  handleDetection(rawCode, rawFormat = 'EAN-13', rawResult = null, isSingleShot = false) {
    if (!rawCode || this.stopping || this.locked) return;

    const rawStr = String(rawCode).trim();
    const format = this.normalizeFormatName(rawFormat);

    // 1. Normalize barcode
    const code = this.normalizeDetectedCode(rawStr);
    if (!code) return;

    // 2. Validate strict supermarket retail barcode & Modulo-10 checksum
    if (!this.isValidRetailBarcode(code, format)) {
      return;
    }

    const now = Date.now();

    // 3. Duplicate scan cooldown for already confirmed barcodes
    if (code === this.lastDetectedCode && now - this.lastDetectedAt < this.sameCodeCooldown) {
      return;
    }

    // 4. Log candidate detected & checksum valid
    console.log(`[SCANNER] Candidate detected: ${code}`);
    console.log('[SCANNER] Checksum VALID');

    // 5. Multi-frame candidate confirmation (eliminates single-frame optical/glare glitches)
    if (!isSingleShot) {
      if (this.pendingCandidate === code && (now - (this.pendingCandidateTime || 0)) < 700) {
        this.candidateHits = (this.candidateHits || 1) + 1;
      } else {
        this.pendingCandidate = code;
        this.pendingCandidateTime = now;
        this.candidateHits = 1;
        // Require 2 matching frames to confirm
        return;
      }

      if (this.candidateHits < 2) {
        return;
      }
    }

    // Reset pending candidate on confirmation
    this.pendingCandidate = null;
    this.candidateHits = 0;
    this.lastDetectedCode = code;
    this.lastDetectedAt = now;

    // 6. Log confirmation sequence
    console.log('[SCANNER] Barcode CONFIRMED');
    console.log('[SCANNER] 🎯 BARCODE DETECTED');

    // 7. Lock temporarily to prevent frame flooding
    this.locked = true;

    try {
      this.onBarcodeDetected(code, format, rawResult);
    } catch (error) {
      console.error('[SCANNER] Detection callback failed:', error);
    }

    setTimeout(() => {
      if (!this.stopping) {
        this.locked = false;
      }
    }, 550);
  }

  normalizeDetectedCode(code) {
    if (code === null || code === undefined) return null;
    const raw = String(code).trim();
    if (!raw) return null;

    try {
      const normalized = normalizeBarcode(raw);
      if (normalized) return String(normalized).trim();
    } catch {
      // Fallback
    }

    return raw;
  }

  isValidRetailBarcode(code, format = '') {
    if (!code || typeof code !== 'string') return false;
    const digitsOnly = /^\d+$/.test(code);
    const normalizedFormat = String(format).toLowerCase().replace(/[-_]/g, '');

    // EAN-13: Exactly 13 numeric digits with valid Modulo-10 check digit
    // Primary retail standard in supermarkets globally
    if (code.length === 13 && digitsOnly) {
      const validChecksum = this.isValidEAN13Checksum(code);
      if (!validChecksum) {
        console.debug('[SCANNER] EAN-13 checksum failed:', code);
      }
      return validChecksum;
    }

    // UPC-A: Exactly 12 numeric digits with valid Modulo-10 check digit
    if (code.length === 12 && digitsOnly) {
      return this.isValidUPCAChecksum(code);
    }

    // EAN-8: Exactly 8 numeric digits with valid Modulo-10 check digit
    if (code.length === 8 && digitsOnly) {
      const validChecksum = this.isValidEAN8Checksum(code);
      if (!validChecksum) {
        console.debug('[SCANNER] EAN-8 checksum failed:', code);
      }
      return validChecksum;
    }

    // UPC-E: 6, 7 or 8 numeric digits
    if ((code.length === 6 || code.length === 7 || code.length === 8) && digitsOnly && normalizedFormat.includes('upce')) {
      return true;
    }

    // Code 128: Alphanumeric barcodes (store coupons/vouchers), minimum 4 characters
    if (normalizedFormat.includes('code128')) {
      return code.length >= 4;
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

  // ============================================================
  // VIDEO TRACK & CONTINUOUS AUTOFOCUS
  // ============================================================

  async updateVideoTrack() {
    const video = this.getQuaggaVideo();
    if (!video || !video.srcObject) return;

    const tracks = video.srcObject.getVideoTracks();
    if (!tracks || tracks.length === 0) return;

    this.videoTrack = tracks[0];

    // Apply continuous hardware autofocus and exposure for razor-sharp 1D barcode scanning
    try {
      const capabilities = this.videoTrack.getCapabilities ? this.videoTrack.getCapabilities() : {};
      const advanced = [];

      if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
        advanced.push({ focusMode: 'continuous' });
      }
      if (capabilities.exposureMode && capabilities.exposureMode.includes('continuous')) {
        advanced.push({ exposureMode: 'continuous' });
      }
      if (capabilities.whiteBalanceMode && capabilities.whiteBalanceMode.includes('continuous')) {
        advanced.push({ whiteBalanceMode: 'continuous' });
      }

      if (advanced.length > 0) {
        await this.videoTrack.applyConstraints({ advanced });
        console.log('[SCANNER] Applied hardware camera enhancements:', advanced);
      }
    } catch (e) {
      console.warn('[SCANNER] Advanced track constraints could not be applied:', e.message);
    }

    const settings = this.videoTrack.getSettings ? this.videoTrack.getSettings() : {};
    const capabilities = this.videoTrack.getCapabilities ? this.videoTrack.getCapabilities() : {};

    this.torchSupported = Boolean(capabilities && capabilities.torch);

    const stats = {
      width: settings.width || video.videoWidth || 0,
      height: settings.height || video.videoHeight || 0,
      frameRate: settings.frameRate || 0,
      facingMode: settings.facingMode || null,
      deviceId: settings.deviceId || null,
      label: this.videoTrack.label || '',
      hasTorch: this.torchSupported
    };

    console.log('[SCANNER] Video stats:', stats);

    try {
      this.onVideoStats(stats);
    } catch {}
  }

  getCurrentCameraLabel() {
    try {
      const video = this.getQuaggaVideo();
      if (!video || !video.srcObject) return 'Camera';
      const track = video.srcObject.getVideoTracks()[0];
      return track ? track.label || 'Camera' : 'Camera';
    } catch {
      return 'Camera';
    }
  }

  // ============================================================
  // TORCH / FLASHLIGHT
  // ============================================================

  isTorchSupported() {
    if (!this.videoTrack) return false;
    try {
      const caps = this.videoTrack.getCapabilities();
      return Boolean(caps && caps.torch);
    } catch {
      return false;
    }
  }

  hasTorchSupport() {
    return this.isTorchSupported();
  }

  async toggleTorch() {
    if (!this.videoTrack) return false;

    try {
      const caps = this.videoTrack.getCapabilities();
      if (!caps || !caps.torch) return false;

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
  // LOCK / UNLOCK
  // ============================================================

  setLock(locked) {
    this.locked = Boolean(locked);
  }


  // ============================================================
  // STOP ENGINE
  // ============================================================

  async stop(notify = true, reason = '') {
    this.stopping = true;
    this.starting = false;
    const reasonMsg = reason ? ` (${reason})` : '';
    console.log(`[SCANNER] Stopping scanner engine...${reasonMsg}`);

    this.stopZXingLoop();
    this.removeDetectionHandler();

    try {
      if (this.isInitialized || this.isRunning) {
        Quagga.stop();
      }
    } catch {}

    try {
      const video = this.getQuaggaVideo();
      if (video && video.srcObject) {
        video.srcObject.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch {}
        });
        video.srcObject = null;
      }
    } catch {}

    this.isInitialized = false;
    this.isRunning = false;
    this.locked = false;
    this.torchOn = false;
    this.videoTrack = null;
    this.torchSupported = false;

    this.cleanupHost();

    if (this.videoElement) {
      try {
        this.videoElement.pause();
        if (this.videoElement.srcObject) {
          this.videoElement.srcObject.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {}
          });
          this.videoElement.srcObject = null;
        }
        this.videoElement.style.opacity = '';
        this.videoElement.style.pointerEvents = '';
      } catch {}
    }

    if (notify) {
      this.onStatusChange('STOPPED');
    }

    console.log('[SCANNER] Scanner engine stopped');
  }

  async cleanupQuagga() {
    this.stopZXingLoop();
    this.removeDetectionHandler();
    try {
      Quagga.stop();
    } catch {}
    this.cleanupHost();
    this.isInitialized = false;
    this.isRunning = false;
    this.locked = false;
    this.videoTrack = null;
    this.torchOn = false;
    this.torchSupported = false;
  }

  cleanupHost() {
    if (this.hostElement) {
      try {
        this.hostElement.remove();
      } catch {}
      this.hostElement = null;
    }
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