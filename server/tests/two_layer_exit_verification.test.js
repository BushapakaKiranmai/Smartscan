require('dotenv').config();
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const Product = require('../models/Product');
const BranchInventory = require('../models/BranchInventory');
const Transaction = require('../models/Transaction');
const ExitPass = require('../models/ExitPass');
const User = require('../models/User');
const {
  ManualBasketVerificationService,
  RFIDBasketVerificationService
} = require('../services/physicalVerificationService');

describe('SmartScan Pay — Two-Layer Exit Verification (Digital Pass + Physical Basket)', () => {
  let customerUser;
  let customerToken;
  let staffUser;
  let staffToken;
  let testProduct1;
  let testProduct2;
  let activeBranchId = 'dmart-kukatpally';
  let verifiedTransaction;
  let activeExitPass;

  beforeAll(async () => {
    await connectDB();

    // Register or login customer
    const custEmail = `exit_cust_${Date.now()}@smartscan.io`;
    const custPhone = `+9198${Math.floor(10000000 + Math.random() * 90000000)}`;
    const custReg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Exit Test Customer',
        email: custEmail,
        phone: custPhone,
        password: 'Password@123',
        role: 'CUSTOMER'
      });
    customerToken = custReg.body.data?.token || custReg.body.token;
    customerUser = await User.findById(custReg.body.data?.user?.id || custReg.body.data?.user?._id || custReg.body.user?._id);

    // Register or login staff
    const staffEmail = `exit_staff_${Date.now()}@smartscan.io`;
    const staffPhone = `+9199${Math.floor(10000000 + Math.random() * 90000000)}`;
    const staffReg = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Exit Gate Guard',
        email: staffEmail,
        phone: staffPhone,
        password: 'Password@123',
        role: 'BRANCH_STAFF'
      });
    staffToken = staffReg.body.data?.token || staffReg.body.token;
    staffUser = await User.findById(staffReg.body.data?.user?.id || staffReg.body.data?.user?._id || staffReg.body.user?._id);

    // Setup two test products
    testProduct1 = await Product.findOne({ barcode: '8901063371040' });
    if (!testProduct1) {
      testProduct1 = await Product.create({
        name: 'Britannia Marie Gold Biscuits',
        barcode: '8901063371040',
        price: 5,
        stock: 50
      });
    }

    testProduct2 = await Product.findOne({ barcode: '8901063012585' });
    if (!testProduct2) {
      testProduct2 = await Product.create({
        name: 'Britannia Jim Jam Biscuits',
        barcode: '8901063012585',
        price: 10,
        stock: 30
      });
    }

    // Ensure inventory exists
    await BranchInventory.findOneAndUpdate(
      { branchId: activeBranchId, productId: testProduct1._id },
      { stockQuantity: 50, available: true, updatedAt: new Date() },
      { upsert: true }
    );
    await BranchInventory.findOneAndUpdate(
      { branchId: activeBranchId, productId: testProduct2._id },
      { stockQuantity: 30, available: true, updatedAt: new Date() },
      { upsert: true }
    );
  });

  afterAll(async () => {
    // Clean up test transactions and passes
    if (customerUser) {
      await Transaction.deleteMany({ userId: customerUser._id });
      await ExitPass.deleteMany({ userId: customerUser._id });
    }
    await disconnectDB();
  });

  // TEST 1: Checkout order is created with status pending, NO ExitPass generated yet
  it('TEST 1: Checkout order is created with status pending, NO ExitPass exists prior to payment', async () => {
    const checkoutRes = await request(app)
      .post('/api/v1/transactions/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        branchId: activeBranchId,
        items: [
          { productId: testProduct1._id, barcode: testProduct1.barcode, quantity: 2, price: 5 },
          { productId: testProduct2._id, barcode: testProduct2.barcode, quantity: 1, price: 10 }
        ]
      });

    expect(checkoutRes.statusCode).toBe(201);
    const orderId = checkoutRes.body.transaction?._id || checkoutRes.body.order?._id;
    expect(orderId).toBeDefined();

    // Verify NO ExitPass exists for this pending order
    const passBeforePayment = await ExitPass.findOne({ orderId });
    expect(passBeforePayment).toBeNull();
  });

  // TEST 2: Payment verification generates ExitPass with ACTIVE status and single-use ID
  it('TEST 2: Authoritative payment verification creates ACTIVE ExitPass with exact amount and items snapshot', async () => {
    // Create new transaction
    const tx = await Transaction.create({
      userId: customerUser._id,
      branchId: activeBranchId,
      items: [
        { productId: testProduct1._id, name: testProduct1.name, barcode: testProduct1.barcode, price: 5, quantity: 2, subtotal: 10 },
        { productId: testProduct2._id, name: testProduct2.name, barcode: testProduct2.barcode, price: 10, quantity: 1, subtotal: 10 }
      ],
      subtotal: 20,
      totalAmount: 20,
      paymentStatus: 'pending',
      paymentMethod: 'upi',
      status: 'pending'
    });

    // Simulate verified payment for exact amount (2000 paise)
    await request(app)
      .post('/api/v1/transactions/simulate-upi')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderId: tx._id,
        amountPaise: 2000,
        status: 'captured'
      });

    const verifyRes = await request(app)
      .post(`/api/v1/transactions/${tx._id}/verify`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({});

    expect(verifyRes.statusCode).toBe(200);
    expect(verifyRes.body.paymentStatus).toBe('PAYMENT_SUCCESS');
    expect(verifyRes.body.exitToken).toBeDefined();

    // Verify ExitPass document was created in MongoDB
    const pass = await ExitPass.findOne({ orderId: tx._id });
    expect(pass).not.toBeNull();
    expect(pass.uniquePassId).toBe(verifyRes.body.exitToken);
    expect(pass.status).toBe('ACTIVE');
    expect(pass.amount).toBe(20);
    expect(pass.items.length).toBe(2);
    expect(pass.basketVerified).toBe(false);
    expect(pass.usedAt).toBeNull();

    verifiedTransaction = tx;
    activeExitPass = pass;
  });

  // TEST 3: LAYER 1 — Gate scanner verifies Digital Exit Pass
  it('TEST 3: Layer 1 verify-pass validates active pass, paid order, items list, and returns order info', async () => {
    const res = await request(app)
      .post('/api/v1/exit/verify-pass')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        passId: activeExitPass.uniquePassId,
        gateTerminalId: 'GATE-NORTH-01',
        branchId: activeBranchId
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.layer1Verified).toBe(true);
    expect(res.body.message).toContain('EXIT PASS VERIFIED');
    expect(res.body.data.uniquePassId).toBe(activeExitPass.uniquePassId);
    expect(res.body.data.amount).toBe(20);
    expect(res.body.data.totalItemsCount).toBe(3); // 2 Marie Gold + 1 Jim Jam
    expect(res.body.data.items.length).toBe(2);
  });

  // TEST 4: Layer 1 rejects invalid, unpaid, or non-existent pass
  it('TEST 4: Layer 1 rejects non-existent or invalid pass ID', async () => {
    const res = await request(app)
      .post('/api/v1/exit/verify-pass')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        passId: 'PASS-INVALID-9999',
        gateTerminalId: 'GATE-NORTH-01'
      });

    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.rejectionReason).toBe('PASS_NOT_FOUND');
  });

  // TEST 5: LAYER 2 — Physical Basket Verification detects item count mismatch
  it('TEST 5: Layer 2 verify-basket flags missing item with neutral message (Marie Gold x 1 instead of 2)', async () => {
    const res = await request(app)
      .post('/api/v1/exit/verify-basket')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        passId: activeExitPass.uniquePassId,
        gateTerminalId: 'GATE-NORTH-01',
        verificationMethod: 'MANUAL_STAFF',
        verifiedItems: [
          { barcode: testProduct1.barcode, name: testProduct1.name, quantity: 1 }, // Expected 2!
          { barcode: testProduct2.barcode, name: testProduct2.name, quantity: 1 }
        ]
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.rejectionReason).toBe('ITEM_MISMATCH');
    expect(res.body.message).toContain('Staff verification required');
    // Ensure pass remains ACTIVE for staff resolution
    const pass = await ExitPass.findOne({ uniquePassId: activeExitPass.uniquePassId });
    expect(pass.status).toBe('ACTIVE');
    expect(pass.usedAt).toBeNull();
  });

  // TEST 6: Layer 2 Physical Basket Verification detects extra unscanned item
  it('TEST 6: Layer 2 verify-basket flags extra unscanned product with neutral message', async () => {
    const res = await request(app)
      .post('/api/v1/exit/verify-basket')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        passId: activeExitPass.uniquePassId,
        gateTerminalId: 'GATE-NORTH-01',
        verificationMethod: 'MANUAL_STAFF',
        verifiedItems: [
          { barcode: testProduct1.barcode, name: testProduct1.name, quantity: 2 },
          { barcode: testProduct2.barcode, name: testProduct2.name, quantity: 1 },
          { barcode: '8901234569999', name: 'Unscanned Shampoo', quantity: 1 } // Extra!
        ]
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.rejectionReason).toBe('ITEM_MISMATCH');
    expect(res.body.message).toContain('Item mismatch detected. Staff verification required.');
  });

  // TEST 7: LAYER 2 SUCCESS — When basket matches, EXIT APPROVED and pass status = USED
  it('TEST 7: When basket matches (Layer 1 = PASS & Layer 2 = PASS), system gives EXIT APPROVED and marks pass USED', async () => {
    const res = await request(app)
      .post('/api/v1/exit/verify-basket')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        passId: activeExitPass.uniquePassId,
        gateTerminalId: 'GATE-NORTH-01',
        verificationMethod: 'MANUAL_STAFF',
        isConfirmed: true,
        verifiedItems: [
          { barcode: testProduct1.barcode, name: testProduct1.name, quantity: 2 },
          { barcode: testProduct2.barcode, name: testProduct2.name, quantity: 1 }
        ]
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.exitApproved).toBe(true);
    expect(res.body.message).toContain('EXIT APPROVED');

    // Verify DB update
    const updatedPass = await ExitPass.findOne({ uniquePassId: activeExitPass.uniquePassId });
    expect(updatedPass.status).toBe('USED');
    expect(updatedPass.usedAt).not.toBeNull();
    expect(updatedPass.gateId).toBe('GATE-NORTH-01');
    expect(updatedPass.basketVerified).toBe(true);

    const updatedTx = await Transaction.findById(verifiedTransaction._id);
    expect(updatedTx.status).toBe('completed');
  });

  // TEST 8: PREVENT QR REUSE — Scanning the same pass again MUST fail
  it('TEST 8: Re-scanning an already-used pass rejects with ALREADY_USED and blocks departure', async () => {
    // Attempt Layer 1 re-scan
    const layer1Res = await request(app)
      .post('/api/v1/exit/verify-pass')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        passId: activeExitPass.uniquePassId,
        gateTerminalId: 'GATE-NORTH-01'
      });

    expect(layer1Res.statusCode).toBe(400);
    expect(layer1Res.body.success).toBe(false);
    expect(layer1Res.body.rejectionReason).toBe('ALREADY_USED');
    expect(layer1Res.body.message).toContain('EXIT PASS ALREADY USED');

    // Attempt Layer 2 re-scan
    const layer2Res = await request(app)
      .post('/api/v1/exit/verify-basket')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        passId: activeExitPass.uniquePassId,
        gateTerminalId: 'GATE-NORTH-01',
        isConfirmed: true
      });

    expect(layer2Res.statusCode).toBe(400);
    expect(layer2Res.body.success).toBe(false);
    expect(layer2Res.body.rejectionReason).toBe('ALREADY_USED');
    expect(layer2Res.body.message).toContain('EXIT PASS ALREADY USED');
  });

  // TEST 9: Unit test PhysicalVerificationService & RFIDBasketVerificationService abstraction
  it('TEST 9: RFIDBasketVerificationService correctly validates matching RFID tags vs discrepancy', async () => {
    const rfidService = new RFIDBasketVerificationService();
    const expectedItems = [
      { barcode: '8901063371040', name: 'Marie Gold', quantity: 2 },
      { barcode: '8901063012585', name: 'Jim Jam', quantity: 1 }
    ];

    // Case A: Matching RFID tags (2 Marie Gold tags, 1 Jim Jam tag)
    const matchingTags = [
      { epc: 'EPC001', barcode: '8901063371040', name: 'Marie Gold' },
      { epc: 'EPC002', barcode: '8901063371040', name: 'Marie Gold' },
      { epc: 'EPC003', barcode: '8901063012585', name: 'Jim Jam' }
    ];
    const matchResult = await rfidService.verifyBasket(expectedItems, { rfidTags: matchingTags });
    expect(matchResult.matches).toBe(true);
    expect(matchResult.success).toBe(true);

    // Case B: RFID mismatch (Extra Shampoo tag)
    const extraTags = [
      ...matchingTags,
      { epc: 'EPC004', barcode: '8909999999999', name: 'Shampoo' }
    ];
    const mismatchResult = await rfidService.verifyBasket(expectedItems, { rfidTags: extraTags });
    expect(mismatchResult.matches).toBe(false);
    expect(mismatchResult.rejectionReason).toBe('RFID_ITEM_MISMATCH');
    expect(mismatchResult.message).toContain('Item mismatch detected. Staff verification required.');
  });
});
