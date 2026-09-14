const crypto = require('crypto');
const mongoose = require('mongoose');
const ExitPass = require('../models/ExitPass');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { getPhysicalVerificationService } = require('../services/physicalVerificationService');

/**
 * Helper: Find ExitPass and associated Transaction by pass identifier
 */
async function findPassAndOrder(identifier) {
  if (!identifier) return { exitPass: null, order: null };
  const cleanId = String(identifier).trim();

  // 1. Try finding by passId, uniquePassId, or shortCode directly
  let exitPass = await ExitPass.findOne({
    $or: [
      { passId: cleanId },
      { uniquePassId: cleanId },
      { shortCode: cleanId.toUpperCase() }
    ]
  });

  // 2. Try finding by orderId (if ObjectId)
  if (!exitPass && mongoose.Types.ObjectId.isValid(cleanId)) {
    exitPass = await ExitPass.findOne({ orderId: cleanId });
  }

  // 3. Try finding by Transaction exitToken
  if (!exitPass) {
    const tx = await Transaction.findOne({ exitToken: cleanId });
    if (tx) {
      exitPass = await ExitPass.findOne({ orderId: tx._id });
    }
  }

  // 4. Try finding by short code or suffix match
  if (!exitPass) {
    exitPass = await ExitPass.findOne({
      $or: [
        { uniquePassId: { $regex: new RegExp(cleanId + '$', 'i') } },
        { passId: { $regex: new RegExp(cleanId + '$', 'i') } }
      ]
    });
  }

  let order = null;
  if (exitPass) {
    order = await Transaction.findById(exitPass.orderId);
  } else if (mongoose.Types.ObjectId.isValid(cleanId)) {
    order = await Transaction.findById(cleanId);
  } else {
    order = await Transaction.findOne({ exitToken: cleanId });
  }

  // If order exists and is paid but ExitPass was not yet created (e.g. from older order)
  if (!exitPass && order && order.paymentStatus === 'paid') {
    const isCompleted = order.status === 'completed';
    const passId = order.exitToken || `EXIT-PASS-SS${order._id.toString().slice(-6).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const shortCode = crypto.randomBytes(3).toString('hex').toUpperCase();
    exitPass = await ExitPass.create({
      passId,
      uniquePassId: passId,
      shortCode,
      orderId: order._id,
      userId: order.userId,
      branchId: order.branchId || 'dmart-kukatpally',
      amount: order.totalAmount,
      amountPaise: Math.round(order.totalAmount * 100),
      items: order.items.map(it => ({
        productId: it.productId,
        name: it.name,
        barcode: it.barcode,
        quantity: it.quantity,
        price: it.price,
        subtotal: it.subtotal
      })),
      status: isCompleted ? 'USED' : 'ACTIVE',
      usedAt: isCompleted ? (order.updatedAt || new Date()) : null,
      verificationMethod: 'MANUAL_STAFF',
      basketVerified: isCompleted,
      randomCheckSelected: Math.random() < 0.25,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000)
    });
    order.exitToken = passId;
    await order.save();
  }

  return { exitPass, order };
}

/**
 * LAYER 1: Digital Exit Pass / QR Verification
 * POST /api/v1/exit/verify-pass
 */
exports.verifyExitPass = async (req, res) => {
  try {
    const { passId, exitCode, code, branchId, gateTerminalId } = req.body;
    const identifier = passId || exitCode || code;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        layer1Verified: false,
        rejectionReason: 'MISSING_PASS_ID',
        message: 'Exit Pass identifier or QR code is required.'
      });
    }

    const { exitPass, order } = await findPassAndOrder(identifier);

    // 1. Pass exists
    if (!exitPass) {
      return res.status(404).json({
        success: false,
        layer1Verified: false,
        rejectionReason: 'PASS_NOT_FOUND',
        message: 'Exit Pass not found. Please verify your order.'
      });
    }

    // 2. Pass has not already been used (PREVENT QR REUSE)
    if (exitPass.status === 'USED' || exitPass.usedAt) {
      return res.status(400).json({
        success: false,
        layer1Verified: false,
        rejectionReason: 'ALREADY_USED',
        message: '✕ EXIT PASS ALREADY USED. Customer cannot exit again with the same pass.'
      });
    }

    // 3. Pass is not CANCELLED
    if (exitPass.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        layer1Verified: false,
        rejectionReason: 'PASS_CANCELLED',
        message: 'Exit Pass is cancelled.'
      });
    }

    // 4. Pass has not expired
    if (exitPass.expiresAt && new Date(exitPass.expiresAt) < new Date()) {
      exitPass.status = 'EXPIRED';
      await exitPass.save();
      return res.status(400).json({
        success: false,
        layer1Verified: false,
        rejectionReason: 'PASS_EXPIRED',
        message: 'Exit Pass has expired. Please contact customer service.'
      });
    }

    // 5. Order belongs to authenticated session / exists
    if (!order) {
      return res.status(404).json({
        success: false,
        layer1Verified: false,
        rejectionReason: 'ORDER_NOT_FOUND',
        message: 'Associated order could not be found.'
      });
    }

    // 6. Payment is successful
    if (order.paymentStatus !== 'paid' || !order.paymentVerified) {
      return res.status(400).json({
        success: false,
        layer1Verified: false,
        rejectionReason: 'PAYMENT_PENDING',
        message: 'Payment has not been confirmed. Exit pass is not valid.'
      });
    }

    // 7. Order is not cancelled/refunded
    if (['cancelled', 'refunded', 'failed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        layer1Verified: false,
        rejectionReason: 'ORDER_INVALID',
        message: 'Order status is invalid or refunded.'
      });
    }

    // 8. Payment amount matches
    if (order.totalAmount !== exitPass.amount) {
      return res.status(400).json({
        success: false,
        layer1Verified: false,
        rejectionReason: 'AMOUNT_MISMATCH',
        message: 'Exit pass amount mismatch.'
      });
    }

    // Customer details
    const customer = await User.findById(order.userId).select('name email phoneNumber phone');
    const orderNumber = `SS-${String(order._id).slice(-5).toUpperCase()}`;

    // LAYER 1 VERIFIED!
    return res.status(200).json({
      success: true,
      layer1Verified: true,
      message: '✓ EXIT PASS VERIFIED',
      data: {
        passId: exitPass.uniquePassId,
        uniquePassId: exitPass.uniquePassId,
        orderId: order._id,
        orderNumber,
        branchId: exitPass.branchId,
        amount: exitPass.amount,
        amountPaise: exitPass.amountPaise,
        totalItemsCount: exitPass.items.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0),
        items: exitPass.items.map(it => ({
          productId: it.productId,
          name: it.name,
          barcode: it.barcode,
          quantity: it.quantity,
          price: it.price,
          subtotal: it.subtotal
        })),
        status: exitPass.status,
        randomCheckSelected: Boolean(exitPass.randomCheckSelected),
        createdAt: exitPass.createdAt,
        expiresAt: exitPass.expiresAt,
        customer: {
          name: customer?.name || 'Customer',
          phone: customer?.phoneNumber || customer?.phone || '—'
        }
      }
    });
  } catch (error) {
    console.error('[ExitController] verifyExitPass error:', error);
    return res.status(500).json({
      success: false,
      layer1Verified: false,
      message: 'Server error during digital pass verification',
      error: error.message
    });
  }
};

/**
 * LAYER 2: Physical Basket Verification
 * POST /api/v1/exit/verify-basket
 */
exports.verifyBasket = async (req, res) => {
  try {
    const {
      passId,
      exitCode,
      code,
      branchId,
      gateTerminalId,
      verificationMethod = 'MANUAL_STAFF',
      isConfirmed,
      hasMismatch,
      mismatchReason,
      verifiedItems,
      rfidTags,
      notes
    } = req.body;

    const identifier = passId || exitCode || code;
    if (!identifier) {
      return res.status(400).json({
        success: false,
        rejectionReason: 'MISSING_PASS_ID',
        message: 'Pass identifier is required.'
      });
    }

    const { exitPass, order } = await findPassAndOrder(identifier);

    if (!exitPass || !order) {
      return res.status(404).json({
        success: false,
        rejectionReason: 'PASS_NOT_FOUND',
        message: 'Exit pass or order not found.'
      });
    }

    // Prevent reuse
    if (exitPass.status === 'USED' || exitPass.usedAt) {
      return res.status(400).json({
        success: false,
        code: 'PASS_ALREADY_USED',
        rejectionReason: 'ALREADY_USED',
        message: '✕ EXIT PASS ALREADY USED. Customer cannot exit again.',
        passStatus: 'USED'
      });
    }

    if (exitPass.status === 'EXPIRED' || (exitPass.expiresAt && new Date(exitPass.expiresAt) <= new Date())) {
      exitPass.status = 'EXPIRED';
      await exitPass.save();
      return res.status(400).json({
        success: false,
        code: 'PASS_EXPIRED',
        rejectionReason: 'PASS_EXPIRED',
        message: 'Exit Pass has expired.',
        passStatus: 'EXPIRED'
      });
    }

    // Verify order is paid
    if (order.paymentStatus !== 'paid' || !order.paymentVerified) {
      return res.status(400).json({
        success: false,
        rejectionReason: 'PAYMENT_NOT_VERIFIED',
        message: 'Payment has not been confirmed for this order.'
      });
    }

    // Service abstraction: verify basket contents
    const verificationService = getPhysicalVerificationService(verificationMethod);
    const verificationResult = await verificationService.verifyBasket(exitPass.items, {
      isConfirmed,
      hasMismatch,
      mismatchReason,
      verifiedItems,
      rfidTags,
      notes
    });

    if (!verificationResult.matches) {
      // Mismatch detected: Neutral message, block exit temporarily, keep pass ACTIVE for staff resolution
      console.log(`[EXIT BASKET] Mismatch for pass ${exitPass.uniquePassId}: ${verificationResult.message}`);
      return res.status(400).json({
        success: false,
        exitApproved: false,
        basketVerified: false,
        rejectionReason: verificationResult.rejectionReason || 'ITEM_MISMATCH',
        message: verificationResult.message || 'Item mismatch detected. Staff verification required.',
        data: {
          expectedCount: verificationResult.expectedCount,
          verifiedCount: verificationResult.verifiedCount,
          mismatches: verificationResult.mismatches || verificationResult.discrepancies || []
        }
      });
    }

    // BOTH LAYERS PASS: LAYER 1 = PASS AND LAYER 2 = PASS!
    // Atomically approve exit and burn pass so it cannot be reused
    const now = new Date();
    const updatedPass = await ExitPass.findOneAndUpdate(
      {
        _id: exitPass._id,
        status: 'ACTIVE',
        expiresAt: { $gt: now }
      },
      {
        $set: {
          status: 'USED',
          usedAt: now,
          verifiedBy: req.user?._id || null,
          gateId: gateTerminalId || req.body.gateId || 'GATE-01',
          branchId: branchId || exitPass.branchId,
          basketVerified: true,
          verificationMethod: verificationMethod
        }
      },
      { new: true }
    );

    if (!updatedPass) {
      const currentPass = await ExitPass.findById(exitPass._id);
      if (currentPass?.status === 'USED' || currentPass?.usedAt) {
        return res.status(400).json({
          success: false,
          code: 'PASS_ALREADY_USED',
          rejectionReason: 'ALREADY_USED',
          message: '✕ EXIT PASS ALREADY USED. Customer cannot exit again.',
          passStatus: 'USED'
        });
      }
      return res.status(400).json({
        success: false,
        code: 'PASS_EXPIRED',
        rejectionReason: 'PASS_EXPIRED',
        message: 'Exit pass expired or could not be consumed.',
        passStatus: currentPass?.status || 'EXPIRED'
      });
    }

    order.status = 'completed';
    await order.save();

    console.log(`[EXIT VERIFICATION] 🟢 EXIT APPROVED for Pass ${updatedPass.uniquePassId}, Order ${order._id}`);

    const orderNumber = `SS-${String(order._id).slice(-5).toUpperCase()}`;

    return res.status(200).json({
      success: true,
      exitApproved: true,
      code: 'EXIT_AUTHORIZED',
      message: '🟢 EXIT APPROVED — Thank you!',
      data: {
        verified: true,
        exitApproved: true,
        passId: updatedPass.passId || updatedPass.uniquePassId,
        uniquePassId: updatedPass.uniquePassId || updatedPass.passId,
        shortCode: updatedPass.shortCode,
        status: 'USED',
        usedAt: updatedPass.usedAt,
        verifiedBy: updatedPass.verifiedBy,
        gateId: updatedPass.gateId,
        order: {
          _id: order._id,
          orderNumber,
          status: 'COMPLETED',
          totalAmount: order.totalAmount,
          items: updatedPass.items
        }
      }
    });
  } catch (error) {
    console.error('[ExitController] verifyBasket error:', error);
    return res.status(500).json({
      success: false,
      exitApproved: false,
      message: 'Server error during basket verification',
      error: error.message
    });
  }
};

/**
 * Authoritative STRICT ONE-TIME USE Exit Verification Endpoint
 * POST /api/v1/exit-passes/verify
 * POST /api/v1/exit/verify
 */
exports.verifyExitGatePass = async (req, res) => {
  try {
    const { passId, code, shortCode, exitCode, gateTerminalId, branchId } = req.body;
    const identifier = passId || code || shortCode || exitCode;

    if (!identifier) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_PASS_ID',
        message: 'Exit pass identifier or QR code is required.'
      });
    }

    const cleanId = String(identifier).trim();

    // A. Find ExitPass by passId / shortCode / uniquePassId / orderId
    const { exitPass, order } = await findPassAndOrder(cleanId);

    // B. If pass does not exist
    if (!exitPass) {
      return res.status(404).json({
        success: false,
        code: 'PASS_NOT_FOUND',
        message: 'Exit pass not found.'
      });
    }

    // C. If status === "USED"
    if (exitPass.status === 'USED' || exitPass.usedAt) {
      return res.status(400).json({
        success: false,
        code: 'PASS_ALREADY_USED',
        message: 'This exit pass has already been used.',
        passStatus: 'USED'
      });
    }

    // D. If status === "EXPIRED"
    if (exitPass.status === 'EXPIRED') {
      return res.status(400).json({
        success: false,
        code: 'PASS_EXPIRED',
        message: 'This exit pass has expired.',
        passStatus: 'EXPIRED'
      });
    }

    // E. If status === "CANCELLED"
    if (exitPass.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        code: 'PASS_CANCELLED',
        message: 'This exit pass is cancelled.',
        passStatus: 'CANCELLED'
      });
    }

    // F. Check expiresAt
    if (exitPass.expiresAt && new Date(exitPass.expiresAt) <= new Date()) {
      await ExitPass.updateOne({ _id: exitPass._id }, { $set: { status: 'EXPIRED' } });
      return res.status(400).json({
        success: false,
        code: 'PASS_EXPIRED',
        message: 'This exit pass has expired.',
        passStatus: 'EXPIRED'
      });
    }

    // G. Find associated order
    if (!order) {
      return res.status(404).json({
        success: false,
        code: 'ORDER_NOT_FOUND',
        message: 'Associated order not found.'
      });
    }

    // H. Verify order properties
    if (exitPass.userId && order.userId && exitPass.userId.toString() !== order.userId.toString()) {
      return res.status(400).json({
        success: false,
        code: 'USER_MISMATCH',
        message: 'Order does not belong to the exit pass user.'
      });
    }

    if (exitPass.branchId && order.branchId && exitPass.branchId !== order.branchId) {
      return res.status(400).json({
        success: false,
        code: 'BRANCH_MISMATCH',
        message: 'Order branch does not match exit pass branch.'
      });
    }

    if (order.paymentStatus !== 'paid' || !order.paymentVerified) {
      return res.status(400).json({
        success: false,
        code: 'PAYMENT_NOT_VERIFIED',
        message: 'Payment has not been confirmed for this order.'
      });
    }

    if (['cancelled', 'refunded', 'failed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        code: 'ORDER_INVALID',
        message: 'Order status is invalid, refunded or cancelled.'
      });
    }

    if (order.totalAmount !== exitPass.amount) {
      return res.status(400).json({
        success: false,
        code: 'AMOUNT_MISMATCH',
        message: 'Exit pass amount mismatch.'
      });
    }

    // I. ATOMIC ONE-TIME CONSUMPTION
    const now = new Date();
    const updatedPass = await ExitPass.findOneAndUpdate(
      {
        _id: exitPass._id,
        status: 'ACTIVE',
        expiresAt: { $gt: now }
      },
      {
        $set: {
          status: 'USED',
          usedAt: now,
          verifiedBy: req.user?._id || null,
          gateId: gateTerminalId || req.body.gateId || 'GATE-01',
          basketVerified: true
        }
      },
      { new: true }
    );

    // If atomic update failed, determine exact reason for double scan / race condition
    if (!updatedPass) {
      const currentPass = await ExitPass.findById(exitPass._id);
      if (!currentPass) {
        return res.status(404).json({
          success: false,
          code: 'PASS_NOT_FOUND',
          message: 'Exit pass not found.'
        });
      }
      if (currentPass.status === 'USED' || currentPass.usedAt) {
        return res.status(400).json({
          success: false,
          code: 'PASS_ALREADY_USED',
          message: 'This exit pass has already been used.',
          passStatus: 'USED'
        });
      }
      if (currentPass.status === 'EXPIRED' || (currentPass.expiresAt && new Date(currentPass.expiresAt) <= new Date())) {
        return res.status(400).json({
          success: false,
          code: 'PASS_EXPIRED',
          message: 'This exit pass has expired.',
          passStatus: 'EXPIRED'
        });
      }
      if (currentPass.status === 'CANCELLED') {
        return res.status(400).json({
          success: false,
          code: 'PASS_CANCELLED',
          message: 'This exit pass is cancelled.',
          passStatus: 'CANCELLED'
        });
      }
      return res.status(400).json({
        success: false,
        code: 'PASS_INVALID',
        message: 'Exit pass could not be consumed.'
      });
    }

    order.status = 'completed';
    await order.save();

    console.log(`[EXIT VERIFICATION] 🟢 EXIT AUTHORIZED for Pass ${updatedPass.passId || updatedPass.uniquePassId}, Order ${order._id}`);

    const customer = await User.findById(order.userId).select('name phoneNumber phone');
    const orderNumber = `SS-${String(order._id).slice(-5).toUpperCase()}`;

    // Return authoritative response format matching requirement 7
    return res.status(200).json({
      success: true,
      code: 'EXIT_AUTHORIZED',
      message: 'Exit authorized.',
      passStatus: 'USED',
      usedAt: updatedPass.usedAt,
      orderId: order._id,
      verified: true,
      exitApproved: true,
      data: {
        passId: updatedPass.passId || updatedPass.uniquePassId,
        uniquePassId: updatedPass.uniquePassId || updatedPass.passId,
        shortCode: updatedPass.shortCode,
        status: 'USED',
        usedAt: updatedPass.usedAt,
        verifiedBy: updatedPass.verifiedBy,
        gateId: updatedPass.gateId,
        orderId: order._id,
        orderNumber,
        branchId: updatedPass.branchId,
        totalItemsCount: updatedPass.items?.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0),
        items: updatedPass.items,
        order: {
          _id: order._id,
          orderNumber,
          status: 'COMPLETED',
          totalAmount: order.totalAmount,
          pricingSummary: {
            finalPayableAmountPaise: Math.round(order.totalAmount * 100)
          },
          items: updatedPass.items
        },
        customer: {
          name: customer?.name || 'Customer',
          phoneNumber: customer?.phoneNumber || customer?.phone || '—'
        }
      }
    });
  } catch (error) {
    console.error('[ExitController] verifyExitGatePass error:', error);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'Server error during exit verification',
      error: error.message
    });
  }
};

/**
 * Get exit pass details by passId or orderId
 * GET /api/v1/exit/pass/:id
 * GET /api/v1/exit/token/:id
 * GET /api/v1/exit-passes/:id
 */
exports.getExitPass = async (req, res) => {
  try {
    const identifier = req.params.id || req.params.orderId;
    const { exitPass, order } = await findPassAndOrder(identifier);

    if (!exitPass && !order) {
      return res.status(404).json({ success: false, code: 'PASS_NOT_FOUND', message: 'Exit pass not found' });
    }

    if (exitPass && exitPass.status === 'ACTIVE' && exitPass.expiresAt && new Date(exitPass.expiresAt) <= new Date()) {
      exitPass.status = 'EXPIRED';
      await exitPass.save();
    }

    const orderNumber = order ? `SS-${String(order._id).slice(-5).toUpperCase()}` : '—';
    const resolvedStatus = exitPass?.status || (order?.paymentStatus === 'paid' ? (order?.status === 'completed' ? 'USED' : 'ACTIVE') : 'PENDING');
    const token = exitPass?.passId || exitPass?.uniquePassId || order?.exitToken;

    return res.status(200).json({
      success: true,
      data: {
        exitPass,
        passId: token,
        uniquePassId: token,
        shortCode: exitPass?.shortCode,
        token,
        exitToken: token,
        status: resolvedStatus,
        usedAt: exitPass?.usedAt || null,
        expiresAt: exitPass?.expiresAt,
        orderNumber,
        order
      }
    });
  } catch (error) {
    console.error('[ExitController] getExitPass error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Unified / Backward Compatibility Gate Verification
 * POST /api/v1/exit/verify
 */
exports.legacyVerify = exports.verifyExitGatePass;

